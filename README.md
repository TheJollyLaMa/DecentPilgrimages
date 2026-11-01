# DecentPilgrimages · Base V1

A meaningful trail, not a promise of payment. Explore freely without a wallet;
optional location is advisory, memory-only and never reward eligibility.
Only the organizer’s on-chain approval can authorize an exact participant,
location, native ETH/ERC20 asset and amount.

## Run & verify locally

Requires Node 22+; no UI build step.

```sh
npm ci
node assistant/static-server.mjs
# Open http://127.0.0.1:8080 — only public/ is served.
npm test
npm run payroll:validate
```

No external model, deployed-chain, radio or payment calls are made by these
tests. Contract tests use a local EVM; helper/receipt/wallet/radio tests use
fixtures and loopback servers.
`npm test` runs the explicit contract/verification selectors and then the UI
runner once: 21 local-EVM/offline verification tests and 35 UI tests.

## Available now

- Contextual trail atlas, keyboard-friendly demo markers/cards, mission details,
  free-participation help and a six-hop modeless bunny tutorial that highlights
  actual controls and returns focus to the trail.
- Pinned **DecentHead 2.0.0**, one shared wallet/IPFS lifecycle, left-ankh
  permission-checked organizer/sponsor desk, right-ankh local journal,
  bounded JSON export/recovery. ENS RPC lookup is disabled.
- Real V1 contract adapter for owner sponsor allowlisting, native ETH funding
  without allowance, ERC20 allowance/funding (USDC and additional address-selected
  assets using individually verified decimals), public location creation, allocation, per-participant approval/
  cancellation, trail deactivation/reactivation, unused-allocation release,
  unallocated-fund recovery to a reviewed recipient, eligibility reads and claims.
  Owner funding requires explicit sponsor allowlisting, not just owner status.
  Wrong chain, missing configuration,
  unavailable RPC, token-decimal mismatch or changed wallet context disables
  writes. Claim success requires two confirmations and an exact `ClaimPaid` event.
- Radio is opt-in, uses the actual pinned DBuskRadio `mount` API, never
  autoplays, and unloads on opt-out/pagehide. Browser fixtures mock the widget;
  live service availability is not asserted.
- Optional server-held-key assistant with per-message consent, exact allowed
  origins, bounded text/body/output/concurrency/budget, deadline and unavailable
  states. No journal, wallet or GPS context is attached.

- Actual committed DecentBusking merged-bounty queue, queue validation and
  canonical ERC20 `PayrollPaid` receipt settlement, adapted with additional steward
  gates. Empty accounts/assets/queues: no copied recipient, budget or deployed fund.

The IPFS header explicitly reports **unconfigured · local files only**.
Documented host-only component adaptations disable generic credentials/upload/
pin controls; the supported host capability opens only local journal backup.

## Deliberately not activated

**No Base address is deployed/configured. No payroll is enabled. No helper/model
key is configured. No payments or live OpenAI tests have occurred.**
Demo trails and tutorial completion have no bounty. Historical presumed
Optimism contracts/ABIs remain in `public/contracts/` and `public/abis/`;
their old fake-whitelist scripts are preserved but never loaded by this UI.
Old deployment chain/addresses are unverified; the newly versioned V1 is not
an in-place migration of old chain state.

Configure only after review: [Operations](docs/Operations.md),
[contract runbook](docs/contracts/base-v1.md),
[experience & tutorial](wiki/Experience.md), [payroll](wiki/Development-Payroll.md),
[helper boundary](docs/Assistant.md), [reuse decision & licenses](docs/Reuse.md).
Browser fixture procedure/results: [testing](docs/Testing.md).

## Logical public team jobs

- [#2 · contracts](https://github.com/TheJollyLaMa/DecentPilgrimages/issues/2)
- [#3 · experience](https://github.com/TheJollyLaMa/DecentPilgrimages/issues/3)
- [#4 · payroll/helper](https://github.com/TheJollyLaMa/DecentPilgrimages/issues/4)
- [#5 · integration/steward](https://github.com/TheJollyLaMa/DecentPilgrimages/issues/5)

Assignments are coordination, not bounty eligibility. Agree on acceptance
evidence first, register privately with the steward when asked, and rely on
verified receipts rather than chat promises.

Code: Apache-2.0; original creative work: CC-BY-4.0, subject to NOTICE.
Reuse credits: The Jolly LaMa / A Decent Agency; DecentHead, DecentBusking and
DecentCanopy. Vendored ethers carries its MIT license.
