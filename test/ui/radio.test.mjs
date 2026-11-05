import test from 'node:test';
import assert from 'node:assert/strict';
import { createRadioController } from '../../public/scripts/v1/radio.mjs';
import { radio } from '../../public/scripts/v1/config.mjs';
test('radio has no load/autoplay on construction, uses pinned actual mount and destroys on pagehide', async () => {
  const windowRef = new EventTarget(), element = { textContent: '', replaceChildren() { this.textContent = ''; } };
  let imports = 0, destroyed = 0;
  const controller = createRadioController(element, radio, { windowRef, loadWidget: async url => {
    ++imports; assert.match(url, /A-Decent-Agency\/DBuskRadio@1fe9ed0c2afc61552328fdda10d0f199bc3eaee9\/widget\.js$/);
    return { mount(target, options) { assert.equal(target, element); assert.equal(options.volume, 0.08); assert.equal(options.compact, true); assert.ok(!('autoplay' in options)); return { destroy() { ++destroyed; } }; } };
  } });
  assert.equal(imports, 0);
  await controller.load(); assert.equal(imports, 1);
  windowRef.dispatchEvent(new Event('pagehide')); assert.equal(destroyed, 1);
  controller.dispose();
});
test('radio unavailable state can retry and late module cannot mount after opt-out', async () => {
  const element = { textContent: '', replaceChildren() { this.textContent = ''; } }, windowRef = new EventTarget();
  let fail = true, mounts = 0, resolve;
  const controller = createRadioController(element, radio, { windowRef, loadWidget: async () => {
    if (fail) throw new Error('fixture offline'); return { mount() { ++mounts; return { destroy() {} }; } };
  } });
  await controller.load(); assert.match(element.textContent, /unavailable.*No playback/);
  fail = false; await controller.load(); assert.equal(mounts, 1); controller.dispose();
  const late = createRadioController(element, radio, { windowRef, loadWidget: () => new Promise(done => { resolve = done; }) });
  const loading = late.load(); late.destroy(); resolve({ mount() { throw new Error('must not mount'); } }); await loading; late.dispose();
});
