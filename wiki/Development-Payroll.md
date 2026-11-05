# Steward-reviewed development payroll

**Disabled and empty.** No wallet, budget, copied deployment/fund, bounty,
payment or live receipt settlement is configured. The logical jobs
[#2](https://github.com/TheJollyLaMa/DecentPilgrimages/issues/2),
[#3](https://github.com/TheJollyLaMa/DecentPilgrimages/issues/3),
[#4](https://github.com/TheJollyLaMa/DecentPilgrimages/issues/4) and
[#5](https://github.com/TheJollyLaMa/DecentPilgrimages/issues/5) organize work.
Assignment, a patch, GPS or tutorial completion alone is not bounty eligibility.

## Acceptance before accrual

1. Agree on the task and acceptance evidence with a maintainer/steward.
   Publish only appropriate public patch/test evidence in the agreed issue/PR.
2. Register payout preferences/wallet privately when asked. Never put secrets,
   private evidence or unsolicited recipient data in issues/configuration.
   This app has no public registration form. The public ledger must stay empty
   until the steward reviews an explicit, consented public payout mapping or
   arranges an approved private operational alternative.
3. Only reviewed supported `bounty: AMOUNT SYMBOL` labels and registered accounts
   can enter the actual donor queue logic after merged work. Missing labels,
   unsupported assets, unmerged work or unregistered accounts cannot become a
   promised payment. Existing donor idea-credit/retained-credit semantics remain
   available only where explicitly accepted; V1 does not assign those credits.
4. Queue accrual is **not paid success**. Settlement needs a prior exact on-chain
   payment with canonical verified receipts and steward authorization.

## Receiving implementation

`payroll/scripts/payroll.js`, `processMergedBounty.js`, `validatePayrollQueue.js`,
`settlePayroll.js`, `githubApi.js` and comment formatting adapt committed
DecentBusking **bf852757d23f7c088ef78e9b49261bcad7a9583a**.
`payroll/payment-ledger.mjs` adapts its exact `verifyRepositoryPayment`;
`rpc-failover.mjs` retains the committed failover provider.
No donor financial configuration, private accounts or deployed fund was copied.
See [provenance](../docs/Reuse.md).

The validator accepts the deliberately empty disabled state, but rejects
nonempty accounts/queue/assets or a copied router/fund in that state. When
enabled it retains the donor queue/account/amount/role/asset/duplicate checks and
requires reviewed Base assets. Configuration is in `payroll/`, not a public
browser credential file.

## Activation is a separate steward decision

Review and populate `payroll/activation.json`: the independent `queueEnabled`
and `settlementEnabled` flags, allowlisted `stewards`, `reviewedBy` and an agreed
`acceptancePolicy`. Configure only the actual Base router, fund, HTTPS RPC and
exact ERC20 `decimals` plus supported ledger precision in `payroll-assets.json`.
No address, recipient or budget is supplied as an example to copy.

Both entry scripts gate **before** reading GitHub events, requesting credentials
or constructing an RPC provider. They require the configuration flag,
`PAYROLL_ACTIVATE=true` and a matching `GITHUB_ACTOR` steward. Workflow variables
`PAYROLL_QUEUE_ENABLED` / `PAYROLL_SETTLEMENT_ENABLED` default absent/off.
Configure GitHub’s **payroll-steward** environment with required human reviewers
and default-branch restrictions before any activation. The queue workflow
executes only reviewed default-branch code after merge, never a PR head.
The separate receipt workflow is manual, default-branch-only and uses the same
ledger concurrency group. Both persist only reviewed queue/account files.

## Settlement is receipt verification, not a transfer

The receipt workflow has no transfer call, signer, private key or mnemonic.
It preserves the committed donor’s **Base ERC20-only** repository proof boundary.
Native ETH is supported separately for pilgrimage funding/claims; it does not
reinterpret donor historical ETH entries or authorize native payroll.
Native repository payroll needs a separately reviewed router/proof contract.
It can record an existing `tx_hash` only after exact donor-strength proof:

- Base **8453**, successful receipt, at least **two confirmations**.
- Canonical receipt block hash (reject reorg/absent/unavailable proof).
- Exactly one `PayrollPaid` event from the configured router.
- Exact fund ID, asset, registered recipient, integer amount using exact ERC20
  decimals, work reference (including issue/contributor/role/currency),
  repository hash and contributor hash.

Wrong-chain, reverted, missing, ambiguous, incorrect amount/recipient/work/repo/
asset/fund or unconfirmed receipts cannot settle. The ledger moves only proven
pending entries and retains the transaction hash. A queue entry, chat answer,
ERC20 transfer lacking that router evidence, or submitted hash is not settlement.
Stewards must review actual payment tooling separately; this release sends none.

## Local evidence

```sh
node payroll/scripts/validatePayrollQueue.js
node --test test/ui/payroll.test.mjs
```

Tests use synthetic addresses/receipts solely in memory and make no external RPC
or payments. They verify empty configuration, disabled gates before side effects,
no assignment-derived bounty, exact canonical proof and rejection cases.
