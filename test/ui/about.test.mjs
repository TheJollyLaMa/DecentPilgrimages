import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');

test('About explains travel sponsorship with an accessible temple infographic and direct actions', async () => {
  const html = await read('public/index.html');
  const about = html.match(/<dialog id="about-dialog"[\s\S]*?<\/dialog>/)?.[0];
  assert.ok(about);
  assert.match(about, /aria-labelledby="about-title"/);
  assert.match(about, /class="temple-backdrop"[\s\S]*?aria-hidden="true"/);
  for (const word of ['Sponsor', 'Place', 'Pilgrimage']) assert.match(about, new RegExp(`<h3>${word}</h3>`));
  assert.doesNotMatch(about, /<details|<summary/);
  assert.match(about, /No live Base rewards/);
  for (const id of ['about-tour', 'about-help']) assert.match(about, new RegExp(`id="${id}"`));
  assert.match(about, /polygonscan.com\/address\/0x8FD1A345F65D27a3c360933e38CC653E0dE37CC1/);
  const app = await read('public/scripts/v1/app.mjs');
  assert.match(app, /event\.preventDefault\(\);[\s\S]*?openDialog\('about-dialog'\)/);
  assert.match(app, /\$\('about-tour'\)[^\n]*close\(\); startTour\(\)/);
  const title = await read('public/vendor/decent-head/2.0.0/js/components/Header/AppTitle.js');
  const header = await read('public/vendor/decent-head/2.0.0/js/components/Header.js');
  assert.match(title, /'decenthead:about'.*cancelable:true/);
  assert.match(header, /if \(!event.defaultPrevented\).*about-modal/);
});
