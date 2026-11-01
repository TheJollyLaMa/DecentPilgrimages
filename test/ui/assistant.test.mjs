import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAssistantServer, loadSettings } from '../../assistant/server.mjs';
import { askModel, validateAnswer } from '../../assistant/model.mjs';
import { createStaticServer } from '../../assistant/static-server.mjs';

const origin = 'http://127.0.0.1:8080';
const settings = () => ({ enabled: true, apiKey: 'fixture-key-never-real', model: 'fixture-model', origins: [origin], timeoutMs: 100, maxConcurrent: 1, maxCalls: 10 });
async function serve(server, run) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
const post = (url, body, headers = {}) => fetch(`${url}/message`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
test('assistant defaults disabled, holds key only server-side and rejects invalid origins/settings', () => {
  assert.equal(loadSettings({}).enabled, false); assert.equal(loadSettings({}).apiKey, '');
  assert.throws(() => loadSettings({ PILGRIMAGE_ASSISTANT_ORIGINS: 'https://example.com/path' }), /exact HTTPS origins/);
  assert.throws(() => loadSettings({ PILGRIMAGE_ASSISTANT_CONCURRENCY: '5' }), /Invalid/);
  assert.throws(() => loadSettings({ PILGRIMAGE_ASSISTANT_TIMEOUT_MS: '0' }), /Invalid/);
});
test('disabled assistant, missing key and allowed-origin gates make no model calls', async () => {
  let calls = 0;
  for (const patch of [{ enabled: false }, { apiKey: '' }, { model: '' }]) {
    await serve(createAssistantServer({ ...settings(), ...patch }, { modelCall: () => { ++calls; throw new Error('must not call'); } }), async url => {
      const response = await post(url, { consent: true, message: 'Hello' }); assert.equal(response.status, 503);
      assert.equal((await (await fetch(`${url}/health`)).json()).enabled, false);
      assert.equal((await post(url, { consent: true, message: 'Hello' }, { Origin: 'https://denied.example' })).status, 403);
    });
  }
  assert.equal(calls, 0);
});
test('explicit per-message consent, bounded body and no automatically accepted context', async () => {
  let calls = 0;
  await serve(createAssistantServer(settings(), { modelCall: async request => {
    ++calls; assert.equal(request.message, 'Can I participate freely?'); assert.equal(request.apiKey, 'fixture-key-never-real');
    assert.ok(!('wallet' in request)); return { answer: 'Participation is free.', sourceIds: ['participation'], abstained: false };
  } }), async url => {
    for (const body of [{ consent: false, message: 'Hi' }, { message: 'Hi' }, { consent: true, message: '' }, { consent: true, message: 'x'.repeat(1201) }, { consent: true, message: 'Hi', location: [1, 2] }, { consent: true, message: 'Hi', wallet: 'secret' }]) assert.equal((await post(url, body)).status, 400);
    assert.equal((await post(url, { consent: true, message: 'x'.repeat(7000) })).status, 413);
    const response = await post(url, { consent: true, message: 'Can I participate freely?' });
    assert.equal(response.status, 200); assert.equal((await response.json()).answer, 'Participation is free.'); assert.equal(calls, 1);
  });
});
test('concurrency, timeout, failed provider and oversized unchecked outputs are bounded', async () => {
  let resolve, called;
  const started = new Promise(done => { called = done; });
  await serve(createAssistantServer({ ...settings(), timeoutMs: 1000 }, { modelCall: () => { called(); return new Promise(done => { resolve = done; }); } }), async url => {
    const first = post(url, { consent: true, message: 'First' }); await started;
    assert.equal((await post(url, { consent: true, message: 'Second' })).status, 429);
    resolve({ answer: 'Free.', sourceIds: ['participation'], abstained: false }); assert.equal((await first).status, 200);
  });
  for (const modelCall of [() => new Promise(() => {}), async () => { throw new Error('SECRET-provider-details'); }, async () => ({ answer: 'x'.repeat(2401), sourceIds: ['participation'], abstained: false })]) {
    await serve(createAssistantServer({ ...settings(), timeoutMs: 10 }, { modelCall }), async url => {
      const response = await post(url, { consent: true, message: 'Hello' }); assert.ok([503, 504].includes(response.status));
      assert.doesNotMatch(await response.text(), /SECRET-provider-details|fixture-key/);
    });
  }
});
test('request budget and strict evidence validation do not authorize payouts', async () => {
  await serve(createAssistantServer({ ...settings(), maxCalls: 1 }, { modelCall: async () => ({ answer: 'I cannot determine eligibility.', sourceIds: ['approval'], abstained: true }) }), async url => {
    assert.equal((await post(url, { consent: true, message: 'Can I claim?' })).status, 200);
    assert.equal((await post(url, { consent: true, message: 'Another?' })).status, 503);
  });
  assert.throws(() => validateAnswer({ answer: 'Guaranteed payment', sourceIds: ['invented'], abstained: false }));
  assert.throws(() => validateAnswer({ answer: 'Guaranteed payment', sourceIds: [], abstained: false }));
});
test('model transport is mocked; provider receives no wallet/context and failures are not partial answers', async () => {
  let calls = 0;
  const responseData = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ answer: 'Participation is free.', sourceIds: ['participation'], abstained: false }) }] }] };
  const answer = await askModel({ apiKey: 'fixture-key', model: 'fixture-model', message: 'Hello', signal: new AbortController().signal, fetchImpl: async (url, request) => {
    ++calls; assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(request.body); assert.equal(body.store, false); assert.equal(body.max_output_tokens, 800);
    assert.equal(body.input.at(-1).content, 'Hello'); assert.doesNotMatch(JSON.stringify(body), /0x[0-9a-f]{40}|privateKey|fixture-key/);
    return new Response(JSON.stringify(responseData));
  } });
  assert.equal(answer.answer, 'Participation is free.'); assert.equal(calls, 1);
  await assert.rejects(askModel({ apiKey: 'fixture', model: 'fixture', message: 'Hello', fetchImpl: async () => new Response(JSON.stringify({ ...responseData, status: 'incomplete' })) }), /incomplete/);
  await assert.rejects(askModel({ apiKey: 'fixture', model: 'fixture', message: 'Hello', fetchImpl: async () => new Response('x'.repeat(64001)) }), /too large/);
});
test('preview serves only public files with correct module MIME, not private repository/assistant data', async () => {
  await serve(createStaticServer(), async url => {
    const index = await fetch(url); assert.equal(index.status, 200); assert.match(await index.text(), /A trail worth/);
    const module = await fetch(`${url}/scripts/v1/app.mjs`); assert.match(module.headers.get('content-type'), /text\/javascript/);
    for (const file of ['/assistant/server.mjs', '/payroll/contributor-accounts.json', '/.git', '/%2e%2e/assistant/server.mjs']) assert.equal((await fetch(`${url}${file}`)).status, 404);
    const head = await fetch(url, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
    const mutation = await fetch(url, { method: 'POST' }); assert.equal(mutation.status, 405); assert.equal(mutation.headers.get('allow'), 'GET, HEAD');
    const malformed = await fetch(`${url}/%E0%A4%A`); assert.equal(malformed.status, 400); assert.equal(await malformed.text(), 'Invalid path');
  });
});
test('preview logs unexpected filesystem errors and returns 500 without exposing private details', async t => {
  if (typeof process.getuid !== 'function' || process.getuid() === 0) { t.skip('Filesystem permission denial requires a non-root POSIX process'); return; }
  const directory = await mkdtemp(path.join(fileURLToPath(new URL('../../public/', import.meta.url)), 'preview-fixture-'));
  const file = path.join(directory, 'locked.txt');
  const errors = [];
  t.mock.method(console, 'error', (...args) => errors.push(args));
  try {
    await writeFile(file, 'Public preview fixture', { mode: 0o000 });
    await serve(createStaticServer(), async url => {
      const response = await fetch(`${url}/${path.basename(directory)}/locked.txt`);
      assert.equal(response.status, 500); assert.equal(await response.text(), 'Unable to serve public file');
      assert.equal(errors.length, 1); assert.equal(errors[0][1].code, 'EACCES');
    });
  } finally { await unlink(file); await rmdir(directory); }
});
