import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GATE_SCHEMA, assessArrival, gateMetadata, metadataBytes, metadataDigest, fundingSummary } from '../../public/scripts/v1/gates.mjs';
const now = 1800000000000;
const wallet = `0x${'1'.repeat(40)}`, verifier = `0x${'2'.repeat(40)}`;
const draft = () => ({ schema: GATE_SCHEMA, status: 'unfunded-draft', name: 'Museum visit', description: 'Learn about the latest exhibit.',
  gate: { latitude: '43.000000', longitude: '-76.000000', radius: 30, verification: 'video', prompt: 'Tell the host what you noticed.' },
  mode: 'per-participant', participants: [wallet], verifier, expiresAt: now / 1000 + 3600,
  basket: [{ address: `0x${'0'.repeat(40)}`, symbol: 'ETH', decimals: 18, amount: '0.001' }] });
const position = (patch = {}) => ({ latitude: 43, longitude: -76, accuracy: 5, timestamp: now, ...patch });

test('arrival needs a fresh accuracy-contained fix, not simply a rounded distance inside the circle', () => {
  const gate = { latitude: '43.000000', longitude: '-76.000000', radius: 30 };
  assert.equal(assessArrival(position(), gate, now).state, 'inside');
  assert.equal(assessArrival(position({ accuracy: 31 }), gate, now).state, 'uncertain');
  assert.equal(assessArrival(position({ latitude: 44 }), gate, now).state, 'outside');
  assert.equal(assessArrival(position({ timestamp: now - 60001 }), gate, now).state, 'stale');
  assert.equal(assessArrival(position({ timestamp: now + 1 }), gate, now).state, 'stale');
  assert.equal(assessArrival(null, gate, now).state, 'stale');
  assert.equal(assessArrival(position({ accuracy: -1 }), gate, now).state, 'unavailable');
  assert.equal(assessArrival(position({ latitude: NaN }), gate, now).state, 'unavailable');
  const barelyOutside = { latitude: String(43 + 30.2 / 6371000 * 180 / Math.PI), longitude: '-76', radius: 30 };
  assert.equal(assessArrival(position({ accuracy: 0 }), barelyOutside, now).state, 'outside', '30.2 meters must not round into a 30m gate');
  assert.equal(assessArrival(position(), { ...gate, latitude: 'invalid' }, now).state, 'unavailable');
  assert.equal(assessArrival(position(), null, now).state, 'unavailable');
});
test('metadata exports canonical exact bytes with matching SHA-256 and exact per-person funding', async () => {
  const input = draft(); input.participants.push(verifier);
  const metadata = gateMetadata(input, now);
  assert.equal(fundingSummary(metadata)[0].totalUnits, '2000000000000000');
  assert.equal(await metadataDigest(metadata), `0x${createHash('sha256').update(metadataBytes(metadata)).digest('hex')}`);
  assert.deepEqual(gateMetadata(JSON.parse(metadataBytes(metadata)), now), metadata);
  input.mode = 'first-collector';
  assert.equal(fundingSummary(gateMetadata(input, now))[0].totalUnits, '1000000000000000');
});
test('invalid geographic, distribution, private context and eligibility fields fail explicitly', () => {
  for (const patch of [
    { schema: 'unknown' }, { status: 'funded' }, { mode: 'maybe' }, { participants: [] },
    { participants: [wallet, wallet] }, { verifier: `0x${'0'.repeat(40)}` }, { expiresAt: now / 1000 },
    { secretAnswer: 'do not export' }, { gate: { ...draft().gate, radius: 1 } },
    { gate: { ...draft().gate, latitude: '91' } }, { gate: { ...draft().gate, verification: 'gps-only' } },
    { basket: [{ ...draft().basket[0], amount: '0' }] },
    { basket: [{ ...draft().basket[0], decimals: 6 }] }
  ]) assert.throws(() => gateMetadata({ ...draft(), ...patch }, now));
});
