export const CONTRACT_VERSION = 'DecentPilgrimageBaseV1';
export const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
export const ZERO_ADDRESS = /^0x0{40}$/i;
export const NATIVE_ETH = Object.freeze({ address: `0x${'0'.repeat(40)}`, kind: 'native', symbol: 'ETH', decimals: 18 });
export const isNativeToken = token => token?.kind === 'native' && ZERO_ADDRESS.test(token.address);
export const REQUIRED_METHODS = ['owner', 'locationCount', 'getLocation', 'getLocationTokens', 'approvedSponsors', 'fundNative', 'fundToken', 'createLocation', 'setSponsor', 'addAllocation', 'approveClaim', 'cancelClaimApproval', 'claim', 'approvedClaimAmount', 'hasClaimed', 'allocationRemaining'];

export function deploymentProblem(config) {
  if (config?.chainId !== 8453) return 'Unsupported deployment chain. This release requires Base mainnet (8453).';
  if (config.contractVersion !== CONTRACT_VERSION) return 'Deployment unconfigured: exact Base V1 contract version is required.';
  if (!ADDRESS.test(config.address || '') || ZERO_ADDRESS.test(config.address)) return 'Deployment unconfigured: a verified nonzero Base address is required.';
  if (!Array.isArray(config.abi) || !REQUIRED_METHODS.every(name => config.abi.some(item => item.type === 'function' && item.name === name))) return 'Deployment unconfigured: exact Base V1 ABI is required.';
  if (JSON.stringify(config.abi) !== JSON.stringify(baseV1Abi)) return 'Deployment unconfigured: ABI differs from this release’s exact compiled Base V1 artifact.';
  if (!Array.isArray(config.tokens) || config.tokens.some(token => !ADDRESS.test(token.address || '') || (isNativeToken(token) ? token.decimals !== 18 || token.symbol !== 'ETH' : ZERO_ADDRESS.test(token.address) || token.kind && token.kind !== 'erc20') ||
      !Number.isInteger(token.decimals) || token.decimals < 0 || token.decimals > 36 || !/^[A-Za-z0-9_-]{1,12}$/.test(token.symbol || ''))) return 'Invalid exact ERC20 token configuration.';
  if (new Set(config.tokens.map(token => token.address.toLowerCase())).size !== config.tokens.length) return 'Duplicate token configuration.';
  return '';
}

export function writeProblem(config, session, ready = false) {
  const problem = deploymentProblem(config);
  if (problem) return problem;
  if (!session?.connected || !session.address || !session.provider) return 'Connect a wallet explicitly before on-chain actions.';
  if (Number(session.chainId) !== 8453) return 'Wrong chain. Switch your wallet to Base (8453) before continuing.';
  if (!ready) return 'Deployment not verified or RPC unavailable. Explicitly read the deployment first.';
  return '';
}

export function parseTokenAmount(value, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('Invalid token decimals');
  if (typeof value !== 'string' || value.length > 100 || !/^\d+(?:\.\d+)?$/.test(value)) throw new Error('Enter a positive decimal token amount without exponent notation.');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw new Error(`This token supports exactly ${decimals} decimal places at most.`);
  const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
  if (units <= 0n || units >= 2n ** 256n) throw new Error('Token amount is outside the positive uint256 range.');
  return units;
}

export function formatTokenAmount(value, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('Invalid token decimals');
  const units = BigInt(value.toString());
  if (units < 0n) throw new Error('Negative token amount');
  const scale = 10n ** BigInt(decimals);
  const fraction = (units % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${units / scale}${fraction ? `.${fraction}` : ''}`;
}

export function coordinateToMicrodegrees(value, limit) {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d{1,6})?$/.test(value)) throw new Error('Use decimal coordinates with at most six decimal places.');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const result = (BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'))) * (negative ? -1n : 1n);
  if (result < -BigInt(limit) * 1000000n || result > BigInt(limit) * 1000000n) throw new Error('Coordinate out of range.');
  return result;
}

export function microdegreesToDecimal(value) {
  // Legacy ethers BigNumber must first become a string; never pass it to Number directly.
  const units = BigInt(value.toString());
  const magnitude = units < 0n ? -units : units;
  return `${units < 0n ? '-' : ''}${magnitude / 1000000n}.${(magnitude % 1000000n).toString().padStart(6, '0')}`;
}

export const fixtures = Object.freeze([
  { id: 'demo-care', name: 'The Care Trail', latitude: '37.774900', longitude: '-122.419400', radius: 200, mission: 'Notice a shared space that needs care. Plan a safe, permission-based cleanup with its community. Demonstration only: no registration, contract or reward is attached.', theme: 'Care for a shared place', demo: true },
  { id: 'demo-memory', name: 'The Memory Trail', latitude: '51.507400', longitude: '-0.127800', radius: 250, mission: 'Listen to a place’s story. With permission, preserve a small piece of local history without exposing anyone’s identity. Demonstration only; agree on real missions with an organizer.', theme: 'Listen before documenting', demo: true },
  { id: 'demo-canopy', name: 'The Canopy Trail', latitude: '35.676200', longitude: '139.650300', radius: 300, mission: 'Look for the life between buildings. Learn about a native plant and share a respectful observation. Do not enter private property or publish sensitive habitat coordinates. No reward is attached to this demo.', theme: 'Make room for living things', demo: true },
]);

export function normalizeLocation(location, id) {
  const name = String(location.name);
  const latitude = microdegreesToDecimal(location.latitudeMicrodegrees);
  const longitude = microdegreesToDecimal(location.longitudeMicrodegrees);
  coordinateToMicrodegrees(latitude, 90);
  coordinateToMicrodegrees(longitude, 180);
  return { id: String(id), name: name.slice(0, 100), latitude, longitude, radius: location.radiusMeters.toString(),
    mission: String(location.mission).slice(0, 2000), active: Boolean(location.active), demo: false, theme: 'Organizer-reviewed on Base' };
}

export function validateJournal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['schemaVersion', 'nickname', 'savedTrailIds', 'tutorialComplete'].includes(key)) ||
      value.schemaVersion !== 1 || typeof value.nickname !== 'string' || value.nickname.length > 60 ||
      !Array.isArray(value.savedTrailIds) || value.savedTrailIds.length > 100 ||
      value.savedTrailIds.some(id => typeof id !== 'string' || !/^(demo-[a-z]+|\d{1,20})$/.test(id)) || typeof value.tutorialComplete !== 'boolean') throw new Error('Invalid version 1 local journal. No wallet, secrets or location fields are accepted.');
  return { schemaVersion: 1, nickname: value.nickname, savedTrailIds: [...new Set(value.savedTrailIds)], tutorialComplete: value.tutorialComplete };
}

export const emptyJournal = () => ({ schemaVersion: 1, nickname: '', savedTrailIds: [], tutorialComplete: false });

export function requestAdvisoryLocation(geolocation) {
  if (!geolocation?.getCurrentPosition) return Promise.reject(new Error('Geolocation is unavailable. You can still explore freely.'));
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
      error => reject(new Error(error.code === 1 ? 'Location permission denied. Participation is still free; no data was saved.' : 'Location unavailable. Try later or explore without it.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  });
}

export function advisoryDistanceMeters(position, place) {
  const radians = degrees => Number(degrees) * Math.PI / 180;
  const latitude = radians(place.latitude) - radians(position.latitude);
  const longitude = radians(place.longitude) - radians(position.longitude);
  const a = Math.sin(latitude / 2) ** 2 + Math.cos(radians(position.latitude)) * Math.cos(radians(place.latitude)) * Math.sin(longitude / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))));
}

export function assistantRequest(endpoint, question, consent) {
  if (!endpoint) throw new Error('Helper disabled — endpoint not configured.');
  const url = new URL(endpoint);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Invalid helper endpoint.');
  if (consent !== true) throw new Error('Explicit consent is required for each message.');
  if (typeof question !== 'string' || !question.trim() || question.length > 1200) throw new Error('Question must contain 1–1,200 characters.');
  return { consent: true, message: question.trim() };
}

export const tutorial = Object.freeze([
  { title: 'Welcome, fellow traveler.', text: 'People sponsor your travels by placing tokens at places of pilgrimage along your route. Explore this preview without a wallet or location sharing.', target: '#start-tour' },
  { title: 'Pick a place with purpose.', text: 'Select a marker or trail card to explore a stop. These are demo places with no tokens to collect. Check real-world access and safety before traveling.', target: '.marker' },
  { title: 'Keep your bearings private.', text: '“Use my location once” is optional high-accuracy guidance. Coordinates stay in memory, are never published, and do not prove reward eligibility.', target: '#request-location' },
  { title: 'Arrange your collection.', text: 'Agree with the organizer on your journey and collection conditions. This Base preview requires approval for your wallet, stop, token and amount. Demo collection stays locked.', target: '#check-claim', fallback: '#open-help' },
  { title: 'Your journal. Your journey.', text: 'The right ankh opens your local journal and backup. The left ankh opens the authorized sponsor and organizer desk. IPFS is not configured; nothing uploads.', target: 'decent-header', control: 'profile' },
  { title: 'Collect when it is ready.', text: 'Real collections need a configured deployment, funded stops and organizer approval. Only a successful confirmed receipt means tokens were collected. This preview and tutorial pay nothing.', target: '#refresh-chain', fallback: '#open-help' },
]);
import { baseV1Abi } from './abi.mjs';
