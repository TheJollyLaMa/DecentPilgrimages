import { ADDRESS, ZERO_ADDRESS, isNativeToken, deploymentProblem, writeProblem, normalizeLocation, parseTokenAmount } from './core.mjs';

const ERC20_ABI = ['function decimals() view returns (uint8)', 'function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'];
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

export async function withDeadline(operation, milliseconds = 12000) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('RPC unavailable or timed out. No confirmed success was recorded.')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export function createPilgrimageClient(config, { getSession, loadEthers, onSubmitted = () => {} }) {
  let verified = false, owner = null, sponsor = false, generation = 0;
  let contract, ethers;
  const state = () => ({ verified, owner, sponsor, organizer: verified && same(owner, getSession().address) });
  function invalidate() { verified = false; owner = null; sponsor = false; contract = null; ++generation; }
  function check() {
    const issue = writeProblem(config, getSession(), verified);
    if (issue) throw new Error(issue);
  }
  async function assertCurrentNetwork() {
    if (Number((await getSession().provider.getNetwork()).chainId) !== 8453) throw new Error('Wrong chain. Base (8453) is required.');
  }
  function assertGeneration(expected) {
    if (expected !== generation) throw new Error('Wallet context changed. Read the deployment again.');
  }
  async function read() {
    invalidate();
    const expected = generation;
    const issue = writeProblem(config, getSession(), true);
    if (issue) throw new Error(issue);
    try {
      const result = await withDeadline((async () => {
        await assertCurrentNetwork();
        ethers = await loadEthers();
        const session = getSession();
        const code = await session.provider.getCode(config.address);
        if (!code || code === '0x') throw new Error('No contract exists at this configured Base address.');
        contract = new ethers.Contract(config.address, config.abi, session.provider);
        const [contractOwner, isSponsor, count] = await Promise.all([contract.owner(), contract.approvedSponsors(session.address), contract.locationCount()]);
        if (!ADDRESS.test(contractOwner) || BigInt(count.toString()) > 500n) throw new Error('Deployment owner or location count is invalid; V1 safely reads up to 500 locations.');
        const locations = [];
        for (let id = 0n; id < BigInt(count.toString()); id++) locations.push(normalizeLocation(await contract.getLocation(id), id));
        assertGeneration(expected);
        return { contractOwner, isSponsor, locations };
      })());
      assertGeneration(expected);
      owner = result.contractOwner;
      sponsor = Boolean(result.isSponsor);
      verified = true;
      return { ...state(), locations: result.locations };
    } catch (error) {
      if (expected === generation) invalidate();
      throw error;
    }
  }
  function configuredToken(address) {
    const token = config.tokens.find(token => same(token.address, address));
    if (!token) throw new Error('Token address and exact decimals are not configured.');
    return token;
  }
  async function tokenContract(address, signer = false) {
    check();
    await assertCurrentNetwork();
    const token = configuredToken(address);
    if (isNativeToken(token)) return { token, erc20: null };
    const runner = signer ? await getSession().provider.getSigner() : getSession().provider;
    const erc20 = new ethers.Contract(token.address, ERC20_ABI, runner);
    const decimals = Number((await withDeadline(erc20.decimals())).toString());
    if (decimals !== token.decimals) throw new Error('On-chain ERC20 decimals differ from the reviewed token configuration.');
    return { token, erc20 };
  }
  async function eligibility(locationId, address) {
    check();
    await assertCurrentNetwork();
    const expected = generation;
    const { token } = await tokenContract(address);
    const participant = getSession().address;
    const result = await withDeadline((async () => {
      const [location, amount, claimed, allocation, locationTokens] = await Promise.all([
        contract.getLocation(locationId), contract.approvedClaimAmount(locationId, token.address, participant),
        contract.hasClaimed(locationId, token.address, participant), contract.allocationRemaining(locationId, token.address),
        contract.getLocationTokens(locationId),
      ]);
      return { amount: BigInt(amount.toString()), claimed: Boolean(claimed), active: Boolean(location.active),
        funded: BigInt(allocation.toString()) >= BigInt(amount.toString()), token,
        allocatedToken: locationTokens.some(address => same(address, token.address)), participant };
    })());
    assertGeneration(expected);
    return { ...result, eligible: result.active && !result.claimed && result.amount > 0n && result.funded && result.allocatedToken };
  }
  async function transaction(makeTransaction, receiptCheck) {
    check();
    const expected = generation;
    await assertCurrentNetwork();
    const session = getSession();
    const signer = await session.provider.getSigner();
    if (!same(await signer.getAddress(), session.address)) throw new Error('Signer differs from current wallet session.');
    assertGeneration(expected);
    const tx = await makeTransaction(signer);
    onSubmitted(tx.hash);
    const receipt = await withDeadline(tx.wait(2), 120000);
    assertGeneration(expected);
    if (!receipt || receipt.status !== 1) throw new Error('Transaction did not produce a successful confirmed receipt.');
    if (receipt.to && !same(receipt.to, config.address) && !config.tokens.some(token => same(token.address, receipt.to))) throw new Error('Unexpected transaction receipt destination.');
    await assertCurrentNetwork();
    if (receiptCheck) receiptCheck(receipt);
    return receipt;
  }
  function ownerCheck() {
    check();
    if (!same(owner, getSession().address)) throw new Error('Only the on-chain owner can organize and approve claims.');
  }
  async function sponsorAllowance(address, amount) {
    check();
    if (!sponsor) throw new Error('Only an owner-allowlisted sponsor can fund. The owner must explicitly allowlist their own wallet to fund.');
    const { token, erc20 } = await tokenContract(address);
    if (isNativeToken(token)) throw new Error('Native ETH needs no ERC20 allowance. Use Fund pilgrimage directly.');
    const units = parseTokenAmount(amount, token.decimals);
    return transaction(signer => erc20.connect(signer).approve(config.address, units));
  }
  async function fund(address, amount) {
    check();
    if (!sponsor) throw new Error('Only an owner-allowlisted sponsor can fund. The owner must explicitly allowlist their own wallet to fund.');
    const { token, erc20 } = await tokenContract(address);
    const units = parseTokenAmount(amount, token.decimals);
    if (isNativeToken(token)) return transaction(signer => contract.connect(signer).fundNative({ value: units }));
    if (BigInt((await withDeadline(erc20.allowance(getSession().address, config.address))).toString()) < units) throw new Error('Confirm the exact ERC20 allowance approval first.');
    return transaction(signer => contract.connect(signer).fundToken(token.address, units));
  }
  async function ownerWrite(method, args) {
    ownerCheck();
    if (!['setSponsor', 'createLocation', 'addAllocation', 'approveClaim', 'cancelClaimApproval', 'releaseAllocation', 'recoverToken', 'setLocationActive'].includes(method)) throw new Error('Unsupported organizer action.');
    return transaction(signer => contract.connect(signer)[method](...args));
  }
  async function ownerTokenWrite(method, location, address, amount, participant) {
    ownerCheck();
    const { token } = await tokenContract(address);
    if (method === 'cancelClaimApproval') return ownerWrite(method, [location, token.address, participant]);
    const units = parseTokenAmount(amount, token.decimals);
    if (method === 'recoverToken') {
      if (!ADDRESS.test(participant || '') || ZERO_ADDRESS.test(participant) || same(participant, config.address)) throw new Error('Recovery recipient must be a nonzero wallet other than this contract.');
      return ownerWrite(method, [token.address, participant, units]);
    }
    return ownerWrite(method, method === 'approveClaim' ? [location, token.address, participant, units] : [location, token.address, units]);
  }
  async function claim(location, address) {
    const approval = await eligibility(location, address);
    if (!approval.eligible) throw new Error('No active funded organizer-approved claim exists for this wallet and token.');
    return transaction(signer => contract.connect(signer).claim(location, address), receipt => {
      const exact = receipt.logs.filter(log => {
        if (!same(log.address, config.address)) return false;
        let event;
        try { event = contract.interface.parseLog(log); } catch { return false; }
        return event?.name === 'ClaimPaid' && event.args.locationId.toString() === String(location) &&
          same(event.args.token, address) && same(event.args.participant, approval.participant) && event.args.amount === approval.amount;
      });
      if (exact.length !== 1) throw new Error('Receipt did not prove the exact approved ClaimPaid event. No paid success was recorded.');
    });
  }
  async function inspectToken(address, symbol) {
    check();
    await assertCurrentNetwork();
    const expected = generation;
    if (!ADDRESS.test(address || '') || ZERO_ADDRESS.test(address)) throw new Error('Enter an ERC20 address. Native ETH already uses the zero-address sentinel.');
    if (!/^[A-Za-z0-9_-]{1,12}$/.test(symbol || '')) throw new Error('Choose a short display label; the token address remains the identity.');
    if (config.tokens.some(token => same(token.address, address))) throw new Error('This token is already available in the desk.');
    if (await withDeadline(getSession().provider.getCode(address)) === '0x') throw new Error('No token contract exists at that Base address.');
    const erc20 = new ethers.Contract(address, ERC20_ABI, getSession().provider);
    const decimals = Number((await withDeadline(erc20.decimals())).toString());
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('Unsupported on-chain ERC20 decimals.');
    assertGeneration(expected);
    const token = { address, kind: 'erc20', symbol, decimals };
    config.tokens.push(token);
    return token;
  }
  return { state, read, invalidate, eligibility, sponsorAllowance, fund, ownerWrite, ownerTokenWrite, inspectToken, claim, problem: () => deploymentProblem(config) };
}
