export const supporterEdition = Object.freeze({
  version: 'v0.1.1',
  chainId: 8453,
  supply: '1000',
  priceUSDC: '10000000',
  nftContract: '0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B',
  escrow: '0x31b07b83e99A9bdF379bf40225b8A80d3804C89d',
  verification: null,
});

// Only a steward-reviewed, public verifier result may populate verification.
// This local presentation gate is not an independent on-chain verification.
export function supporterLinks(edition = supporterEdition) {
  const receipt = edition.verification;
  if (!receipt || edition.chainId !== 8453 || edition.supply !== '1000' || edition.priceUSDC !== '10000000'
    || edition.nftContract !== supporterEdition.nftContract || edition.escrow !== supporterEdition.escrow
    || receipt.version !== edition.version || receipt.chainId !== edition.chainId
    || receipt.nftContract !== edition.nftContract || receipt.escrow !== edition.escrow
    || receipt.supply !== edition.supply || receipt.priceUSDC !== edition.priceUSDC
    || typeof receipt.tokenId !== 'string' || typeof receipt.listingId !== 'string'
    || !/^(0|[1-9]\d*)$/.test(receipt.tokenId) || !/^(0|[1-9]\d*)$/.test(receipt.listingId)
    || !/^0x[0-9a-fA-F]{64}$/.test(receipt.mintTxHash)
    || !Number.isSafeInteger(receipt.verifiedBlock) || receipt.verifiedBlock <= 0
    || !Number.isSafeInteger(receipt.confirmations) || receipt.confirmations < 12) return null;
  try {
    const evidence = new URL(receipt.evidenceUrl);
    const checkout = new URL(receipt.purchaseUrl);
    if (evidence.origin !== 'https://github.com' || evidence.username || evidence.password
      || evidence.search || evidence.hash
      || !evidence.pathname.startsWith(`/TheJollyLaMa/DecentPilgrimages/releases/download/${encodeURIComponent(edition.version)}/`)
      || !evidence.pathname.endsWith('.json')) return null;
    if (checkout.origin !== 'https://thejollylama.github.io' || checkout.username || checkout.password
      || checkout.pathname !== '/DecentHead/supporter/buy.html' || checkout.hash
      || checkout.searchParams.get('chainId') !== '8453'
      || checkout.searchParams.get('escrow') !== edition.escrow
      || checkout.searchParams.get('listingId') !== receipt.listingId
      || (checkout.searchParams.get('priceUSDC') ?? '10000000') !== edition.priceUSDC
      || [...checkout.searchParams.keys()].some(key => !['chainId', 'escrow', 'listingId', 'priceUSDC'].includes(key))
      || [...checkout.searchParams.keys()].some(key => checkout.searchParams.getAll(key).length !== 1)) return null;
    return { evidenceUrl: evidence.href, purchaseUrl: checkout.href };
  } catch { return null; }
}

export function mountSupporterCard(document, edition = supporterEdition) {
  const links = supporterLinks(edition);
  if (!links) return;
  const checkout = document.getElementById('supporter-checkout');
  const evidence = document.getElementById('supporter-evidence');
  checkout.href = links.purchaseUrl;
  checkout.hidden = false;
  evidence.href = links.evidenceUrl;
  evidence.hidden = false;
  document.getElementById('supporter-preparing').hidden = true;
  document.getElementById('supporter-status').textContent = 'Steward-reviewed mint and listing evidence available. Check the receipt and checkout before signing.';
}
