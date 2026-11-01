const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const ZERO = /^0x0{40}$/i;

function assertAssetConfig(config) {
  if (config?.chainId !== 8453 || !ADDRESS.test(config.routerAddress || '') || ZERO.test(config.routerAddress) ||
      !/^[a-z0-9][a-z0-9-]*$/.test(config.fundSlug || '') || !config.assets || !Object.keys(config.assets).length) {
    throw new Error('Payroll deployment is unconfigured. A reviewed Base router, fund and exact ERC20 assets are required.');
  }
  const urls = [config.rpcUrl, ...(config.rpcFallbackUrls || [])].filter(Boolean);
  if (!urls.length || urls.some(value => {
    try { const url = new URL(value); return url.protocol !== 'https:' || Boolean(url.username || url.password || url.search || url.hash); }
    catch { return true; }
  })) throw new Error('Payroll requires reviewed HTTPS RPC URLs without credentials.');
  for (const [symbol, asset] of Object.entries(config.assets)) {
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(symbol) || symbol === 'ETH' || !ADDRESS.test(asset.address || '') || ZERO.test(asset.address) ||
        !Number.isInteger(asset.decimals) || asset.decimals < 0 || asset.decimals > 36 ||
        !Number.isInteger(asset.ledgerDecimals) || asset.ledgerDecimals < 0 || asset.ledgerDecimals > Math.min(18, asset.decimals)) {
      throw new Error('Invalid exact payroll ERC20 asset configuration.');
    }
  }
}

function assertStewardGate(operation, activation, config, env = process.env) {
  const field = operation === 'queue' ? 'queueEnabled' : operation === 'settle' ? 'settlementEnabled' : null;
  if (!field || activation?.[field] !== true || env.PAYROLL_ACTIVATE !== 'true') throw new Error(`Payroll ${operation} disabled pending explicit steward activation.`);
  const actor = String(env.GITHUB_ACTOR || '').toLowerCase();
  if (!actor || !Array.isArray(activation.stewards) || !activation.stewards.some(value => String(value).toLowerCase() === actor) ||
      !activation.reviewedBy || !activation.acceptancePolicy) throw new Error('Payroll requires an allowlisted steward and reviewed acceptance policy.');
  assertAssetConfig(config);
}

module.exports = { assertAssetConfig, assertStewardGate };
