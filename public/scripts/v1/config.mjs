// Public deployment metadata only. Exact audited addresses and ABI must be configured together.
import { baseV1Abi } from './abi.mjs';

export const deployment = Object.freeze({
  chainId: 8453,
  contractVersion: null,
  address: null,
  abi: baseV1Abi,
  tokens: [{ address: '0x0000000000000000000000000000000000000000', kind: 'native', symbol: 'ETH', decimals: 18 }],
});

export const assistant = Object.freeze({ endpoint: null });

export const radio = Object.freeze({
  widgetUrl: 'https://cdn.jsdelivr.net/gh/A-Decent-Agency/DBuskRadio@1fe9ed0c2afc61552328fdda10d0f199bc3eaee9/widget.js',
  workerUrl: 'https://decentbusking.onrender.com',
});
