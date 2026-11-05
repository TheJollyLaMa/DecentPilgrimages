import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import { baseV1Abi } from '../../public/scripts/v1/abi.mjs';
import { CONTRACT_VERSION, NATIVE_ETH } from '../../public/scripts/v1/core.mjs';
import { createPilgrimageClient, withDeadline } from '../../public/scripts/v1/client.mjs';

const owner = `0x${'1'.repeat(40)}`, participant = `0x${'2'.repeat(40)}`, tokenAddress = `0x${'3'.repeat(40)}`, address = `0x${'4'.repeat(40)}`, hash = `0x${'a'.repeat(64)}`;
const config = { chainId: 8453, contractVersion: CONTRACT_VERSION, address, abi: baseV1Abi, tokens: [{ address: tokenAddress, decimals: 6, symbol: 'TEST' }] };
function fixture({ current = participant, chain = 8453, code = '0x1234', approved = 1234567n, claimed = false, active = true, allocation = 2000000n, receiptStatus = 1, paidEvent = true, decimals = 6, native = false, sponsorApproved = current === owner } = {}) {
  const calls = [], iface = new Interface(baseV1Abi);
  const selectedToken = native ? NATIVE_ETH.address : tokenAddress;
  const fixtureConfig = { ...config, tokens: native ? [{ ...NATIVE_ETH }] : config.tokens.map(token => ({ ...token })) };
  let network = chain, receiptEvent = paidEvent;
  const session = { connected: true, address: current, chainId: chain, provider: {
    getNetwork: async () => ({ chainId: BigInt(network) }),
    getCode: async () => { calls.push('code'); return code; },
    getSigner: async () => ({ getAddress: async () => session.address }),
  } };
  const log = iface.encodeEventLog(iface.getEvent('ClaimPaid'), [0n, selectedToken, participant, approved]);
  const tx = method => { calls.push(method); return { hash, wait: async confirmations => { assert.equal(confirmations, 2); return { hash, status: receiptStatus, to: address, logs: receiptEvent ? [{ address, ...log }] : [] }; } }; };
  const contract = {
    interface: iface, owner: async () => owner, approvedSponsors: async () => sponsorApproved,
    locationCount: async () => 1n, getLocation: async () => ({ name: 'Receiving fixture', latitudeMicrodegrees: 1000000n, longitudeMicrodegrees: -1000000n, radiusMeters: 100n, mission: 'Reviewed fixture', active }),
    getLocationTokens: async () => [selectedToken], approvedClaimAmount: async () => approved, hasClaimed: async () => claimed,
    allocationRemaining: async () => allocation,
    connect() { return this; },
    claim: async (location, token) => { assert.equal(location, '0'); assert.equal(token, selectedToken); return tx('claim'); },
    setSponsor: async (...args) => { calls.push(args); return tx('setSponsor'); },
    createLocation: async (...args) => { calls.push(args); return tx('createLocation'); },
    addAllocation: async (...args) => { calls.push(args); return tx('addAllocation'); },
    approveClaim: async (...args) => { calls.push(args); return tx('approveClaim'); },
    cancelClaimApproval: async (...args) => { calls.push(args); return tx('cancelClaimApproval'); },
    setLocationActive: async (...args) => { calls.push(args); return tx('setLocationActive'); },
    releaseAllocation: async (...args) => { calls.push(args); return tx('releaseAllocation'); },
    recoverToken: async (...args) => { calls.push(args); return tx('recoverToken'); },
    fundToken: async (...args) => { calls.push(args); return tx('fundToken'); },
    fundNative: async (...args) => { calls.push(args); return tx('fundNative'); },
  };
  const erc20 = { decimals: async () => { calls.push('decimals'); return decimals; }, allowance: async () => 2000000n, connect() { return this; }, approve: async (...args) => { calls.push(args); return tx('approve'); } };
  const ethers = { Contract: class { constructor(target) { return target === address ? contract : erc20; } } };
  const client = createPilgrimageClient(fixtureConfig, { getSession: () => session, loadEthers: async () => { calls.push('ethers'); return ethers; }, onSubmitted: submitted => calls.push(`submitted:${submitted}`) });
  return { client, calls, session, setChain: value => { network = value; session.chainId = value; }, setPaidEvent: value => { receiptEvent = value; } };
}
test('client performs no calls on construction and rejects unconfigured/wrong chain/RPC absence', async () => {
  const f = fixture(); assert.deepEqual(f.calls, []);
  await assert.rejects(f.client.claim('0', tokenAddress), /not verified/);
  assert.deepEqual(f.calls, []);
  const wrong = fixture({ chain: 10 }); await assert.rejects(wrong.client.read(), /Wrong chain/); assert.deepEqual(wrong.calls, []);
  const missing = fixture({ code: '0x' }); await assert.rejects(missing.client.read(), /No contract/); assert.equal(missing.client.state().verified, false);
  const disabled = createPilgrimageClient({ ...config, address: null }, { getSession: () => f.session, loadEthers: () => { throw new Error('must not load'); } });
  await assert.rejects(disabled.read(), /unconfigured/);
});
test('actual claim eligibility is organizer-approved, funded, active and unclaimed only', async () => {
  for (const options of [{ approved: 0n }, { claimed: true }, { active: false }, { allocation: 1n }]) {
    const f = fixture(options); await f.client.read(); assert.equal((await f.client.eligibility('0', tokenAddress)).eligible, false);
    await assert.rejects(f.client.claim('0', tokenAddress), /No active funded organizer-approved/); assert.ok(!f.calls.includes('claim'));
  }
});
test('claim succeeds only with two-confirmation exact ClaimPaid receipt, never a submitted hash alone', async () => {
  const f = fixture(); await f.client.read(); assert.equal((await f.client.eligibility('0', tokenAddress)).amount, 1234567n);
  const receipt = await f.client.claim('0', tokenAddress); assert.equal(receipt.status, 1); assert.ok(f.calls.includes(`submitted:${hash}`));
  const failed = fixture({ receiptStatus: 0 }); await failed.client.read(); await assert.rejects(failed.client.claim('0', tokenAddress), /successful confirmed receipt/);
  const forged = fixture({ paidEvent: false }); await forged.client.read(); await assert.rejects(forged.client.claim('0', tokenAddress), /exact approved ClaimPaid/);
});
test('shared wallet change invalidates approval and later chain changes block all writes', async () => {
  const f = fixture(); await f.client.read(); f.setChain(10); await assert.rejects(f.client.claim('0', tokenAddress), /Wrong chain/);
  f.client.invalidate(); assert.equal(f.client.state().verified, false);
  f.setChain(8453); await assert.rejects(f.client.claim('0', tokenAddress), /not verified/);
});
test('owner/sponsor funding, location, allowlist, allocation and per-participant approvals call exact ABI', async () => {
  const f = fixture({ current: owner }); await f.client.read();
  assert.equal(f.client.state().organizer, true);
  await f.client.sponsorAllowance(tokenAddress, '1.234567');
  await f.client.fund(tokenAddress, '1.234567');
  await f.client.ownerWrite('setSponsor', [participant, true]);
  await f.client.ownerWrite('createLocation', ['New trail', 1000000n, -1000000n, 100n, 'Mission']);
  await f.client.ownerTokenWrite('addAllocation', 0n, tokenAddress, '1.234567');
  await f.client.ownerTokenWrite('approveClaim', 0n, tokenAddress, '1.234567', participant);
  await f.client.ownerTokenWrite('cancelClaimApproval', 0n, tokenAddress, '', participant);
  for (const action of ['approve', 'fundToken', 'setSponsor', 'createLocation', 'addAllocation', 'approveClaim', 'cancelClaimApproval']) assert.ok(f.calls.includes(action));
  assert.ok(f.calls.some(args => Array.isArray(args) && args.includes(1234567n)));
  const visitor = fixture(); await visitor.client.read(); await assert.rejects(visitor.client.ownerWrite('setSponsor', [participant, true]), /Only the on-chain owner/);
  await assert.rejects(visitor.client.fund(tokenAddress, '1'), /allowlisted/);
});
test('on-chain decimals mismatch and unavailable RPC timeout cannot become paid success', async () => {
  const f = fixture({ decimals: 18 }); await f.client.read(); await assert.rejects(f.client.claim('0', tokenAddress), /decimals differ/);
  await assert.rejects(withDeadline(new Promise(() => {}), 5), /RPC unavailable/);
});
test('native ETH funds/allocates/approves/claims wei with zero sentinel and never calls ERC20 approve or decimals', async () => {
  const ownerFixture = fixture({ current: owner, native: true }); await ownerFixture.client.read();
  await assert.rejects(ownerFixture.client.sponsorAllowance(NATIVE_ETH.address, '0.5'), /no ERC20 allowance/);
  await ownerFixture.client.fund(NATIVE_ETH.address, '0.5');
  await ownerFixture.client.ownerTokenWrite('addAllocation', 0n, NATIVE_ETH.address, '0.5');
  await ownerFixture.client.ownerTokenWrite('approveClaim', 0n, NATIVE_ETH.address, '0.5', participant);
  assert.ok(ownerFixture.calls.includes('fundNative'));
  assert.ok(ownerFixture.calls.some(args => Array.isArray(args) && args[0]?.value === 500000000000000000n));
  assert.ok(!ownerFixture.calls.includes('approve')); assert.ok(!ownerFixture.calls.includes('decimals'));
  const claimant = fixture({ native: true }); await claimant.client.read(); await claimant.client.claim('0', NATIVE_ETH.address);
  assert.ok(claimant.calls.includes('claim')); assert.ok(!claimant.calls.includes('decimals'));
});
test('explicit additional ERC20 address inspection verifies on-chain decimals and does not invent funding or eligibility', async () => {
  const f = fixture({ decimals: 8 }); await f.client.read();
  const token = await f.client.inspectToken(`0x${'5'.repeat(40)}`, 'OTHER');
  assert.equal(token.decimals, 8); assert.equal(token.kind, 'erc20'); assert.equal(token.symbol, 'OTHER');
  assert.ok(!f.calls.includes('fundToken')); assert.ok(!f.calls.includes('approveClaim'));
  await assert.rejects(f.client.inspectToken(token.address, 'OTHER'), /already/);
  await assert.rejects(f.client.inspectToken(NATIVE_ETH.address, 'ETH'), /sentinel/);
});
test('owner must explicitly allowlist own address before native/ERC20 funding or token allowance', async () => {
  for (const native of [false, true]) {
    const f = fixture({ current: owner, sponsorApproved: false, native }); await f.client.read();
    assert.equal(f.client.state().organizer, true); assert.equal(f.client.state().sponsor, false);
    const token = native ? NATIVE_ETH.address : tokenAddress;
    await assert.rejects(f.client.fund(token, '1'), /owner must explicitly allowlist/);
    await assert.rejects(f.client.sponsorAllowance(token, '1'), /owner must explicitly allowlist/);
    assert.ok(!f.calls.includes('fundNative') && !f.calls.includes('fundToken') && !f.calls.includes('approve'));
    await f.client.ownerWrite('setSponsor', [owner, true]);
  }
});
test('owner deactivation, release and native/ERC20 recovery use exact ABI and require successful receipts', async () => {
  for (const native of [false, true]) {
    const f = fixture({ current: owner, native }); await f.client.read();
    const token = native ? NATIVE_ETH.address : tokenAddress, units = native ? 1234567000000000000n : 1234567n;
    await f.client.ownerWrite('setLocationActive', [0n, false]);
    await f.client.ownerTokenWrite('releaseAllocation', 0n, token, '1.234567');
    const receipt = await f.client.ownerTokenWrite('recoverToken', null, token, '1.234567', participant);
    assert.equal(receipt.status, 1);
    assert.ok(f.calls.some(args => Array.isArray(args) && args[0] === token && args[1] === participant && args[2] === units));
    for (const action of ['setLocationActive', 'releaseAllocation', 'recoverToken']) assert.ok(f.calls.includes(action));
    for (const recipient of [NATIVE_ETH.address, address, 'invalid']) await assert.rejects(f.client.ownerTokenWrite('recoverToken', null, token, '1', recipient), /recipient/);
    const failed = fixture({ current: owner, native, receiptStatus: 0 }); await failed.client.read();
    await assert.rejects(failed.client.ownerTokenWrite('recoverToken', null, token, '1', participant), /successful confirmed receipt/);
    const visitor = fixture({ native }); await visitor.client.read();
    await assert.rejects(visitor.client.ownerWrite('setLocationActive', [0n, false]), /Only the on-chain owner/);
    await assert.rejects(visitor.client.ownerTokenWrite('releaseAllocation', 0n, token, '1'), /Only the on-chain owner/);
    await assert.rejects(visitor.client.ownerTokenWrite('recoverToken', null, token, '1', participant), /Only the on-chain owner/);
  }
});
