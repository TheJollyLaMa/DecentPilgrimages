// Adapted from DecentBusking bf852757, discord-bot/payment-ledger.js: verifyRepositoryPayment.
import { Interface, id, parseUnits } from 'ethers';

export const PAYMENT_EVENT_ABI = ['event PayrollPaid(bytes32 indexed fundId,address indexed asset,address indexed recipient,uint256 amount,bytes32 workReference,bytes32 repositoryIdHash,bytes32 contributorIdHash,string metadataUri,bytes32 metadataHash)'];
const iface = new Interface(PAYMENT_EVENT_ABI);

export async function verifyRepositoryPayment({ entry, config, txHash, provider }) {
  if (!provider) throw new Error('An explicitly configured provider is required.');
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash || '')) throw new Error('Invalid payment transaction hash.');
  const currency = String(entry.currency || '').toUpperCase();
  const asset = config.assets[currency];
  if (!asset || currency === 'ETH') throw new Error('Only configured Base repository assets can settle');
  if (config.chainId !== 8453 || Number((await provider.getNetwork()).chainId) !== 8453) throw new Error('Repository proof is Base-only');
  const receipt = await provider.getTransactionReceipt(txHash);
  const head = await provider.getBlockNumber();
  if (!receipt || receipt.status !== 1 || head - receipt.blockNumber + 1 < 2) throw new Error('Repository payment needs two successful Base confirmations');
  if (receipt.hash && receipt.hash.toLowerCase() !== txHash.toLowerCase()) throw new Error('Payment receipt hash mismatch');
  if ((await provider.getBlock(receipt.blockNumber))?.hash !== receipt.blockHash) throw new Error('Repository payment is not canonical');
  const base = `${entry.issueRef}:${entry.contributorGithub}:${entry.role || 'contributor'}`;
  const workReference = id(currency === 'ART' ? base : `${base}:${currency}`);
  const matches = receipt.logs.filter(log => {
    if (log.address?.toLowerCase() !== config.routerAddress.toLowerCase()) return false;
    let event;
    try { event = iface.parseLog(log); } catch { return false; }
    const args = event?.args;
    return event?.name === 'PayrollPaid' && args.fundId === id(entry.fund || config.fundSlug) &&
      args.asset.toLowerCase() === asset.address.toLowerCase() && args.recipient.toLowerCase() === entry.contributor.toLowerCase() &&
      args.amount === parseUnits(String(entry.amount), asset.decimals) && args.workReference === workReference &&
      args.repositoryIdHash === id(entry.issueRef.split('#')[0]) && args.contributorIdHash === id(entry.contributorGithub.trim());
  });
  if (matches.length !== 1) throw new Error('No exact router payment proof for this repository ledger entry');
  return { txHash, workReference, blockNumber: receipt.blockNumber };
}
