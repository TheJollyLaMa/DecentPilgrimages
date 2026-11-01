import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Interface, id, parseUnits } from 'ethers';
import { PAYMENT_EVENT_ABI, verifyRepositoryPayment } from '../../payroll/payment-ledger.mjs';

const require = createRequire(import.meta.url);
const { assertAssetConfig, assertStewardGate } = require('../../payroll/scripts/gates.js');
const { createBountyEntries, extractIssueNumbers } = require('../../payroll/scripts/payroll.js');
const { canQueueMergedPullRequest } = require('../../payroll/scripts/processMergedBounty.js');
const activation = require('../../payroll/activation.json'), emptyAssets = require('../../payroll/payroll-assets.json');
const router = `0x${'1'.repeat(40)}`, asset = `0x${'2'.repeat(40)}`, recipient = `0x${'3'.repeat(40)}`, txHash = `0x${'a'.repeat(64)}`, blockHash = `0x${'b'.repeat(64)}`;
const config = { chainId: 8453, rpcUrl: 'https://rpc.example', rpcFallbackUrls: [], routerAddress: router, fundSlug: 'fixture-repo-dev', assets: { TEST: { address: asset, decimals: 6, ledgerDecimals: 6 } } };
const entry = { issueRef: 'TheJollyLaMa/DecentPilgrimages#4', contributorGithub: 'fixture', contributor: recipient, role: 'implementer', currency: 'TEST', amount: '1.234567', fund: config.fundSlug };
const iface = new Interface(PAYMENT_EVENT_ABI);
function fixture({ chain = 8453, status = 1, head = 101, canonical = true, overrides = {}, logs = 1 } = {}) {
  const values = { fundId: id(config.fundSlug), asset, recipient, amount: parseUnits(entry.amount, 6),
    workReference: id(`${entry.issueRef}:${entry.contributorGithub}:${entry.role}:${entry.currency}`),
    repositoryIdHash: id('TheJollyLaMa/DecentPilgrimages'), contributorIdHash: id('fixture'), metadataUri: '', metadataHash: id('fixture'), ...overrides };
  const encoded = iface.encodeEventLog(iface.getEvent('PayrollPaid'), Object.values(values));
  return { getNetwork: async () => ({ chainId: chain }), getTransactionReceipt: async () => ({ hash: txHash, status, blockNumber: 100, blockHash, logs: Array.from({ length: logs }, () => ({ address: router, ...encoded })) }),
    getBlockNumber: async () => head, getBlock: async () => ({ hash: canonical ? blockHash : 'reorg' }) };
}
test('empty assets/accounts/queue and disabled activation contain no donor wallet, budget or fund', () => {
  assert.deepEqual(require('../../payroll/contributor-accounts.json'), { contributors: [] });
  assert.deepEqual(require('../../payroll/payroll-queue.json'), { pending: [], settled: [], retained: [] });
  assert.equal(emptyAssets.routerAddress, null); assert.equal(emptyAssets.fundSlug, null); assert.deepEqual(emptyAssets.assets, {});
  assert.deepEqual(activation.stewards, []); assert.equal(activation.queueEnabled, false); assert.equal(activation.settlementEnabled, false);
  const result = spawnSync(process.execPath, ['payroll/scripts/validatePayrollQueue.js'], { cwd: new URL('../..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /disabled, empty/);
});
test('all financial/queue paths fail closed before credentials, events, RPC or writes', () => {
  assert.throws(() => assertStewardGate('queue', activation, emptyAssets, {}), /disabled/);
  assert.throws(() => assertStewardGate('settle', activation, emptyAssets, { PAYROLL_ACTIVATE: 'true' }), /disabled/);
  const active = { queueEnabled: true, settlementEnabled: true, stewards: ['steward'], reviewedBy: 'steward', acceptancePolicy: 'reviewed fixture policy' };
  assert.throws(() => assertStewardGate('settle', active, config, { PAYROLL_ACTIVATE: 'true', GITHUB_ACTOR: 'outsider' }), /allowlisted/);
  assert.throws(() => assertStewardGate('settle', active, emptyAssets, { PAYROLL_ACTIVATE: 'true', GITHUB_ACTOR: 'steward' }), /unconfigured/);
  assert.doesNotThrow(() => assertStewardGate('settle', active, config, { PAYROLL_ACTIVATE: 'true', GITHUB_ACTOR: 'steward' }));
  assert.throws(() => assertAssetConfig({ ...config, chainId: 10 }), /Base/);
  for (const script of ['processMergedBounty', 'settlePayroll']) {
    const result = spawnSync(process.execPath, [`payroll/scripts/${script}.js`], { cwd: new URL('../..', import.meta.url), encoding: 'utf8', env: { ...process.env, PAYROLL_ACTIVATE: 'false' } });
    assert.equal(result.status, 1); assert.match(result.stderr, /disabled pending explicit steward activation/);
  }
});
test('real donor merged pipeline does not invent eligibility from assignments, issues or tutorials', () => {
  assert.equal(canQueueMergedPullRequest({ merged: false }), false); assert.equal(canQueueMergedPullRequest({ merged: true }), true);
  assert.deepEqual(extractIssueNumbers({ body: 'Fixes #4', title: 'Work #3' }), [4, 3]);
  const result = createBountyEntries({ issue: { number: 4, labels: [], assignees: [{ login: 'fixture' }] }, pr: { user: { login: 'fixture' } }, accounts: { contributors: [] }, queue: { pending: [], settled: [], retained: [] }, repoSlug: 'TheJollyLaMa/DecentPilgrimages' });
  assert.equal(result.reason, 'missing-bounty-label'); assert.deepEqual(result.entries, []);
});
test('canonical exact Base PayrollPaid receipt verifies amount/decimals, repository, contributor, asset, role/work/fund', async () => {
  const proof = await verifyRepositoryPayment({ entry, config, txHash, provider: fixture() }); assert.equal(proof.txHash, txHash);
  for (const overrides of [{ fundId: id('wrong-fund') }, { asset: router }, { recipient: router }, { amount: 1234568n }, { repositoryIdHash: id('other/repo') }, { contributorIdHash: id('other') }, { workReference: id('wrong-role-or-work') }]) {
    await assert.rejects(verifyRepositoryPayment({ entry, config, txHash, provider: fixture({ overrides }) }), /No exact router payment proof/);
  }
  await assert.rejects(verifyRepositoryPayment({ entry, config, txHash, provider: fixture({ logs: 2 }) }), /No exact/);
  await assert.rejects(verifyRepositoryPayment({ entry, config: { ...config, assets: { TEST: { address: asset, decimals: 18 } } }, txHash, provider: fixture() }), /No exact/);
  await assert.rejects(verifyRepositoryPayment({ entry, config: { ...config, routerAddress: recipient }, txHash, provider: fixture() }), /No exact/);
});
test('wrong chain, insufficient confirmation, reverted, absent, unavailable and reorg receipts cannot settle', async () => {
  for (const options of [{ chain: 10 }, { status: 0 }, { head: 100 }, { canonical: false }, { logs: 0 }]) await assert.rejects(verifyRepositoryPayment({ entry, config, txHash, provider: fixture(options) }));
  await assert.rejects(verifyRepositoryPayment({ entry, config, txHash, provider: { ...fixture(), getTransactionReceipt: async () => null } }), /confirmations/);
  await assert.rejects(verifyRepositoryPayment({ entry, config, txHash, provider: { ...fixture(), getNetwork: async () => { throw new Error('fixture RPC unavailable'); } } }), /RPC unavailable/);
  await assert.rejects(verifyRepositoryPayment({ entry, config, txHash }), /explicitly configured/);
});
test('workflows remain environment/variable/steward-gated, execute trusted default branch and have no transfer/signing key', () => {
  for (const [name, variable] of [['bounty-bot', 'PAYROLL_QUEUE_ENABLED'], ['settle-payroll', 'PAYROLL_SETTLEMENT_ENABLED']]) {
    const text = readFileSync(new URL(`../../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
    assert.match(text, /environment: payroll-steward/); assert.ok(text.includes(`vars.${variable} == 'true'`));
    assert.match(text, /github\.event\.repository\.default_branch/);
    assert.match(text, /Co-authored-by: Copilot <223556219\+Copilot@users\.noreply\.github\.com>/);
    assert.doesNotMatch(text, /PRIVATE_KEY|MNEMONIC|sendTransaction|transfer\(/);
  }
});
