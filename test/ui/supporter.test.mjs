import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { supporterEdition, supporterLinks, mountSupporterCard } from '../../public/scripts/v1/supporter.mjs';

const read = file => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
const fixture = () => ({
  ...supporterEdition,
  verification: {
    ...supporterEdition, verification: undefined,
    tokenId: '7', listingId: '3', mintTxHash: `0x${'a'.repeat(64)}`,
    verifiedBlock: 100, confirmations: 12,
    evidenceUrl: 'https://github.com/TheJollyLaMa/DecentPilgrimages/releases/download/v0.1.1/supporter-mint-evidence.json',
    purchaseUrl: `https://thejollylama.github.io/DecentHead/supporter/buy.html?chainId=8453&escrow=${supporterEdition.escrow}&listingId=3`,
  },
});

test('absent receipt stays unavailable and cannot construct a listing', async () => {
  assert.equal(supporterEdition.version, 'v0.1.1');
  const pending = { ...supporterEdition, verification: null };
  assert.equal(supporterLinks(pending), null);
  mountSupporterCard({ getElementById() { assert.fail('pending state must not mutate purchase links'); } }, pending);
  const html = await read('public/index.html');
  assert.match(html, /id="supporter-preparing" disabled/);
  assert.match(html, /id="supporter-checkout" hidden(?![^>]*href)/);
  assert.match(html, /id="supporter-evidence" hidden(?![^>]*href)/);
  assert.match(html, /proof of health, financial functionality/);
  assert.match(html, /id="supporter-title">Support this journey · v0\.1\.1</);
});

test('default edition binds verified token 78/listing 8 and versioned public evidence', () => {
  const receipt = supporterEdition.verification;
  assert.equal(receipt.tokenId, '78');
  assert.equal(receipt.listingId, '8');
  assert.equal(receipt.verifiedBlock, 53547399);
  assert.equal(supporterLinks().purchaseUrl, receipt.purchaseUrl);
  assert.ok(supporterLinks().evidenceUrl.endsWith('/v0.1.1/supporter-minted.json'));
});

test('reviewed receipt can link only to pinned external checkout and versioned public evidence', () => {
  const edition = fixture();
  assert.deepEqual(supporterLinks(edition), {
    evidenceUrl: edition.verification.evidenceUrl, purchaseUrl: edition.verification.purchaseUrl,
  });
  const nodes = Object.fromEntries(['supporter-checkout', 'supporter-evidence', 'supporter-preparing', 'supporter-status'].map(id => [id, { hidden: id !== 'supporter-preparing' }]));
  mountSupporterCard({ getElementById: id => nodes[id] }, edition);
  assert.equal(nodes['supporter-checkout'].href, edition.verification.purchaseUrl);
  assert.equal(nodes['supporter-evidence'].hidden, false);
  assert.equal(nodes['supporter-preparing'].hidden, true);
});

test('malformed, incomplete, unconfirmed, wrong-price or mismatched evidence fails closed', () => {
  const patches = [
    { version: 'v0.2.0' }, { chainId: 10 }, { supply: '100' }, { priceUSDC: '100000000' },
    { confirmations: 11 }, { confirmations: '12' }, { verifiedBlock: 0 },
    { mintTxHash: 'pending' }, { tokenId: 7 }, { listingId: '-1' },
    { nftContract: supporterEdition.escrow }, { escrow: supporterEdition.nftContract },
    { evidenceUrl: 'https://example.com/evidence.json' },
    { evidenceUrl: 'https://github.com/TheJollyLaMa/DecentPilgrimages/releases/download/v0.2.0/evidence.json' },
    { evidenceUrl: 'https://github.com/TheJollyLaMa/DecentPilgrimages/releases/download/v0.1.1/evidence.json?secret=bad' },
    { purchaseUrl: 'javascript:alert(1)' }, { purchaseUrl: 'https://thejollylama.github.io/DecentHead/' },
  ];
  for (const patch of patches) {
    const edition = fixture();
    Object.assign(edition.verification, patch);
    assert.equal(supporterLinks(edition), null, JSON.stringify(patch));
  }
  for (const suffix of ['&listingId=4', '&priceUSDC=100000000', '&redirect=https://example.com', '#bad']) {
    const edition = fixture();
    edition.verification.purchaseUrl += suffix;
    assert.equal(supporterLinks(edition), null, suffix);
  }
  assert.equal(supporterLinks({ ...fixture(), supply: '100' }), null);
  const superseded = fixture();
  superseded.verification.version = 'v0.1.0';
  superseded.verification.evidenceUrl = superseded.verification.evidenceUrl.replace('v0.1.1', 'v0.1.0');
  assert.equal(supporterLinks(superseded), null);
});

test('caller workflows use the same immutable Head kit, safe public root and approved edition units', async () => {
  const prepare = await read('.github/workflows/supporter-release.yml');
  const announce = await read('.github/workflows/supporter-announce.yml');
  const sha = '599241344849af1921f6a9a59431f4b2f300d417';
  for (const file of [prepare, announce]) {
    assert.match(file, new RegExp(`uses: TheJollyLaMa/DecentHead/.github/workflows/product-supporter-\\w+.yml@${sha}`));
    assert.match(file, new RegExp(`head_ref: ${sha}`));
  }
  assert.match(prepare, /site_root: public/);
  assert.match(prepare, /quantity: '1000'/);
  assert.match(prepare, /price_usdc: '10000000'/);
  assert.match(announce, /vars.SUPPORTER_DISCORD_ENABLED == 'true'/);
});

test('public-only static distribution retains project NOTICE and exact full license texts', async () => {
  const notice = await read('public/NOTICE');
  assert.ok(notice.startsWith((await read('NOTICE')).trimEnd()));
  assert.equal(await read('LICENSE'), await read('public/vendor/decent-head/2.0.0/LICENSE'));
  assert.equal(await read('LICENSES/CC-BY-4.0.txt'), await read('public/vendor/decent-head/2.0.0/LICENSES/CC-BY-4.0.txt'));
  assert.match(notice, /https:\/\/creativecommons.org\/licenses\/by\/4.0\//);
  assert.match(await read('public/index.html'), /href="\.\/NOTICE"/);
});
