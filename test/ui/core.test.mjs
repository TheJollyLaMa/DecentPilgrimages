import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deployment } from '../../public/scripts/v1/config.mjs';
import { baseV1Abi } from '../../public/scripts/v1/abi.mjs';
import { CONTRACT_VERSION, NATIVE_ETH, deploymentProblem, writeProblem, parseTokenAmount, formatTokenAmount, coordinateToMicrodegrees, microdegreesToDecimal, normalizeLocation, fixtures, validateJournal, emptyJournal, requestAdvisoryLocation, advisoryDistanceMeters, assistantRequest, tutorial } from '../../public/scripts/v1/core.mjs';

const configured = { ...deployment, contractVersion: CONTRACT_VERSION, address: `0x${'1'.repeat(40)}`, tokens: [{ address: `0x${'2'.repeat(40)}`, symbol: 'TEST', decimals: 6 }] };
test('exact generated browser ABI equals the contract artifact; historical ABIs stay separate', () => {
  assert.deepEqual(baseV1Abi, JSON.parse(readFileSync(new URL('../../contracts/abi/DecentPilgrimageBaseV1.json', import.meta.url))));
  assert.deepEqual(baseV1Abi, JSON.parse(readFileSync(new URL('../../public/abis/DecentPilgrimageBaseV1.json', import.meta.url))));
});
test('configuration and wrong-chain gates do not infer deployment', () => {
  assert.match(deploymentProblem(deployment), /unconfigured/);
  assert.equal(deploymentProblem(configured), '');
  assert.match(deploymentProblem({ ...configured, chainId: 10 }), /Unsupported/);
  assert.match(deploymentProblem({ ...configured, address: `0x${'0'.repeat(40)}` }), /nonzero/);
  assert.match(deploymentProblem({ ...configured, abi: [] }), /ABI/);
  assert.match(deploymentProblem({ ...configured, abi: baseV1Abi.map(item => item.name === 'claim' ? { ...item, inputs: [] } : item) }), /exact compiled/);
  assert.equal(deploymentProblem({ ...configured, tokens: [NATIVE_ETH] }), '');
  assert.match(deploymentProblem({ ...configured, tokens: [{ ...NATIVE_ETH, kind: 'erc20' }] }), /token configuration/);
  assert.match(deploymentProblem({ ...configured, tokens: [{ ...NATIVE_ETH, decimals: 6 }] }), /token configuration/);
  assert.match(writeProblem(configured, {}), /Connect/);
  const session = { connected: true, address: configured.address, provider: {}, chainId: '0xa' };
  assert.match(writeProblem(configured, session, true), /Wrong chain/);
  assert.match(writeProblem(configured, { ...session, chainId: '0x2105' }), /RPC unavailable/);
  assert.equal(writeProblem(configured, { ...session, chainId: '0x2105' }, true), '');
});
test('exact decimals never use floating point or assumed 18 decimals', () => {
  assert.equal(parseTokenAmount('9007199254740993.123456', 6), 9007199254740993123456n);
  assert.equal(formatTokenAmount(9007199254740993123456n, 6), '9007199254740993.123456');
  assert.equal(parseTokenAmount('12', 0), 12n);
  for (const amount of ['0', '-1', '1e18', 'NaN', '1.0000001', 'Infinity']) assert.throws(() => parseTokenAmount(amount, 6));
  assert.throws(() => parseTokenAmount('1', 99));
});
test('BigNumber coordinates convert via string, preserve signs and six decimals', () => {
  const bigNumber = { toString: () => '-122419400', valueOf: () => { throw new Error('Implicit BigNumber conversion forbidden'); } };
  assert.equal(microdegreesToDecimal(bigNumber), '-122.419400');
  assert.equal(coordinateToMicrodegrees('-0.000001', 90), -1n);
  assert.equal(coordinateToMicrodegrees('180.000000', 180), 180000000n);
  assert.throws(() => coordinateToMicrodegrees('180.000001', 180));
  assert.throws(() => coordinateToMicrodegrees('1.0000001', 90));
  assert.equal(normalizeLocation({ name: 'Trail', latitudeMicrodegrees: { toString: () => '1000000' }, longitudeMicrodegrees: bigNumber, radiusMeters: 200n, mission: 'Care', active: true }, 0n).latitude, '1.000000');
});
test('local recovery schema rejects keys, location, arbitrary wallet/context and oversized journals', () => {
  assert.deepEqual(validateJournal(emptyJournal()), emptyJournal());
  for (const key of ['wallet', 'privateKey', 'location', 'apiKey']) assert.throws(() => validateJournal({ ...emptyJournal(), [key]: 'secret' }));
  assert.throws(() => validateJournal({ ...emptyJournal(), nickname: 'x'.repeat(61) }));
  assert.throws(() => validateJournal({ ...emptyJournal(), savedTrailIds: ['../../private'] }));
});
test('geolocation opt-in is high accuracy, denial does not disable participation', async () => {
  let requests = 0;
  const geolocation = { getCurrentPosition(success, error, options) { ++requests; assert.deepEqual(options, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }); error({ code: 1 }); } };
  assert.equal(requests, 0);
  await assert.rejects(requestAdvisoryLocation(geolocation), /denied.*Participation/);
  assert.equal(requests, 1); assert.equal(fixtures.length, 3);
  await assert.rejects(requestAdvisoryLocation(null), /unavailable/);
  const position = await requestAdvisoryLocation({ getCurrentPosition(success) { success({ timestamp: Date.now(), coords: { latitude: 0, longitude: 0, accuracy: 10 } }); } });
  assert.equal(advisoryDistanceMeters(position, { latitude: '0', longitude: '0' }), 0);
  assert.ok(advisoryDistanceMeters(position, { latitude: '0', longitude: '1' }) > 111000);
});
test('helper requires per-message consent and carries only visitor text', () => {
  assert.throws(() => assistantRequest(null, 'hello', true), /disabled/);
  assert.throws(() => assistantRequest('https://helper.example/message', 'hello', false), /consent/);
  assert.throws(() => assistantRequest('http://helper.example/message', 'hello', true), /endpoint/);
  assert.throws(() => assistantRequest('https://helper.example/message', 'x'.repeat(1201), true), /1,200/);
  assert.deepEqual(assistantRequest('https://helper.example/message', ' hello ', true), { consent: true, message: 'hello' });
});
test('supported entrypoint never loads legacy fake-whitelist sources; tutorial targets actual elements; all motion has reduced-motion rules', () => {
  const html = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../../public/scripts/v1/app.mjs', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../public/styles/trail.css', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /scripts\/(main|wallet|contract|landmarks)\.js|whitelist\.json|unpkg/i);
  assert.match(html, /vendor\/leaflet\/1\.9\.4\/leaflet\.js/);
  assert.match(html, /scripts\/v1\/app\.mjs/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(app, /if \(!reducedMotion\(\)\)/);
  for (const step of tutorial) assert.ok(step.target && step.text);
  assert.match(app, /destination\.focus/);
  assert.match(app, /No reward or eligibility was created/);
});
test('local backup-only IPFS host has accurate label and component-level disabled generic controls', () => {
  const app = readFileSync(new URL('../../public/scripts/v1/app.mjs', import.meta.url), 'utf8');
  const controls = readFileSync(new URL('../../public/vendor/decent-head/2.0.0/js/components/Header/IPFSControls.js', import.meta.url), 'utf8');
  const status = readFileSync(new URL('../../public/vendor/decent-head/2.0.0/js/components/Header/IPFSStatus.js', import.meta.url), 'utf8');
  assert.match(app, /providerLabel: 'unconfigured · local files only', ipfsControlsMode: 'host-only'/);
  assert.match(status, /config\.providerLabel/);
  assert.match(controls, /\['provider-settings', 'community-settings', 'data-controls'\]/);
  assert.match(controls, /control\.disabled = true/);
  assert.match(controls, /openBackup\(\) \{\s*if \(config\.ipfsControlsMode === 'host-only'\) return/);
  assert.match(controls, /this\.action = async \(id, run\) => \{\s*if \(config\.ipfsControlsMode === 'host-only'\) return/);
  assert.doesNotMatch(app, /getIpfs\(\)\.[a-zA-Z]+ =|ipfs\.(upload|pin|configure) =/);
});
