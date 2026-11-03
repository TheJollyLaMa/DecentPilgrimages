import { ADDRESS, ZERO_ADDRESS, parseTokenAmount, coordinateToMicrodegrees, exactDistanceMeters } from './core.mjs';

export const GATE_SCHEMA = 'decentpilgrimage-gate-v2-draft';
export const MAX_FIX_AGE_MS = 60_000;

export function assessArrival(position, gate, now = Date.now()) {
  if (!position || !Number.isFinite(position.timestamp) || now < position.timestamp || now - position.timestamp > MAX_FIX_AGE_MS) return { state: 'stale', message: 'Request a fresh location fix to check this gate.' };
  if (![position.latitude, position.longitude, position.accuracy].every(Number.isFinite) || Math.abs(position.latitude) > 90 || Math.abs(position.longitude) > 180 || position.accuracy < 0) return { state: 'unavailable', message: 'Location fix is invalid. No arrival was recorded.' };
  if (!gate || typeof gate !== 'object') return { state: 'unavailable', message: 'No geographic gate is configured.' };
  const radius = Number(gate.radius);
  if (!Number.isFinite(radius) || radius < 5 || radius > 10000 || !Number.isFinite(Number(gate.latitude)) || !Number.isFinite(Number(gate.longitude)) || Math.abs(Number(gate.latitude)) > 90 || Math.abs(Number(gate.longitude)) > 180) return { state: 'unavailable', message: 'This gate has no valid collection radius or coordinates.' };
  const distance = exactDistanceMeters(position, gate);
  if (distance + position.accuracy <= radius) return { state: 'inside', distance, message: `Inside the ${radius} m gate (about ${Math.round(distance)} m away, ±${Math.ceil(position.accuracy)} m). Ready to request a visit check, not payment.` };
  if (distance - position.accuracy <= radius) return { state: 'uncertain', distance, message: 'GPS accuracy overlaps the boundary. Stay on a safe public path and request a better fix; do not enter private property.' };
  return { state: 'outside', distance, message: `Outside this gate (about ${Math.round(distance)} m away). No visit check or collection unlocked.` };
}

export function gateMetadata(input, now = Date.now()) {
  const fail = message => { throw new Error(message); };
  if (!input || input.schema !== GATE_SCHEMA || input.status !== 'unfunded-draft') fail('Only an unfunded V2 draft is accepted.');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100 ||
      typeof input.description !== 'string' || !input.description.trim() || input.description.length > 1000) fail('Give the stop a name and a short purpose.');
  if (!input.gate || Object.keys(input.gate).some(key => !['latitude', 'longitude', 'radius', 'verification', 'prompt'].includes(key))) fail('Invalid geographic gate fields.');
  coordinateToMicrodegrees(input.gate.latitude, 90); coordinateToMicrodegrees(input.gate.longitude, 180);
  if (!Number.isInteger(input.gate.radius) || input.gate.radius < 5 || input.gate.radius > 10000) fail('Choose a gate radius from 5 to 10,000 meters.');
  if (!['video', 'knowledge'].includes(input.gate.verification)) fail('Choose a video check-in or private local-knowledge test.');
  if (typeof input.gate.prompt !== 'string' || !input.gate.prompt.trim() || input.gate.prompt.length > 500) fail('Describe the visit check without including private answers or a meeting link.');
  if (!['per-participant', 'first-collector'].includes(input.mode)) fail('Choose an explicit collection mode.');
  if (!Array.isArray(input.participants) || input.participants.length < 1 || input.participants.length > 100 || input.participants.some(a => !ADDRESS.test(a) || ZERO_ADDRESS.test(a)) ||
      new Set(input.participants.map(a => a.toLowerCase())).size !== input.participants.length) fail('Use 1–100 unique, nonzero participant wallet addresses.');
  if (!ADDRESS.test(input.verifier || '') || ZERO_ADDRESS.test(input.verifier)) fail('Choose a nonzero verifier wallet. It must attest visits, not browser GPS alone.');
  if (!Number.isInteger(input.expiresAt) || input.expiresAt * 1000 <= now || input.expiresAt * 1000 > now + 366 * 86400000) fail('Choose an expiry within the next year.');
  if (!Array.isArray(input.basket) || input.basket.length < 1 || input.basket.length > 8) fail('A basket needs 1–8 assets.');
  const basket = input.basket.map(token => {
    if (!token || Object.keys(token).some(key => !['address', 'symbol', 'decimals', 'amount'].includes(key)) || !ADDRESS.test(token.address || '') ||
        !/^[A-Za-z0-9_-]{1,12}$/.test(token.symbol || '') || !Number.isInteger(token.decimals) || token.decimals < 0 || token.decimals > 36 ||
        (ZERO_ADDRESS.test(token.address) && (token.symbol !== 'ETH' || token.decimals !== 18))) fail('Invalid basket asset. Native ETH uses zero address and 18 decimals.');
    const units = parseTokenAmount(token.amount, token.decimals);
    const slots = input.mode === 'per-participant' ? input.participants.length : 1;
    if (units * BigInt(slots) >= 2n ** 256n) fail('Basket funding exceeds uint256.');
    return { address: token.address.toLowerCase(), symbol: token.symbol, decimals: token.decimals, amount: token.amount };
  });
  if (new Set(basket.map(t => t.address)).size !== basket.length) fail('Duplicate basket assets are not allowed.');
  if (Object.keys(input).some(key => !['schema', 'status', 'name', 'description', 'gate', 'mode', 'participants', 'verifier', 'expiresAt', 'basket'].includes(key))) fail('Unknown fields or private context are not accepted.');
  return {
    schema: GATE_SCHEMA, status: 'unfunded-draft', name: input.name.trim(), description: input.description.trim(),
    gate: { latitude: input.gate.latitude, longitude: input.gate.longitude, radius: input.gate.radius, verification: input.gate.verification, prompt: input.gate.prompt.trim() },
    mode: input.mode, participants: input.participants.map(a => a.toLowerCase()), verifier: input.verifier.toLowerCase(), expiresAt: input.expiresAt, basket,
  };
}

export function metadataBytes(metadata) { return JSON.stringify(metadata); }

export async function metadataDigest(metadata) {
  const bytes = new TextEncoder().encode(metadataBytes(metadata));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `0x${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function fundingSummary(metadata) {
  const slots = metadata.mode === 'per-participant' ? metadata.participants.length : 1;
  return metadata.basket.map(token => ({ ...token, slots, unitsPerCollection: parseTokenAmount(token.amount, token.decimals).toString(),
    totalUnits: (parseTokenAmount(token.amount, token.decimals) * BigInt(slots)).toString() }));
}
