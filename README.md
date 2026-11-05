# DecentPilgrimages · sponsored journeys

A meaningful trail, not a promise of payment. Explore freely without a wallet;
optional location is advisory, memory-only and never reward eligibility.
The existing Base V1 adapter uses organizer-approved claims. The separate
Gate V2 prototype models funded token baskets and verifier-attested visits.

Canonical app URL: **https://thejollylama.github.io/DecentPilgrimages/**.
The legacy Pages root uses a small `index.html` redirect into `public/`,
preserving query/hash. Direct app: https://thejollylama.github.io/DecentPilgrimages/public/.
The deployed root/About and corrected title were browser-checked after publication.

ENS website: **[decentpilgrimages.decentagency.eth](https://decentpilgrimages.decentagency.eth.limo)**.
It serves the reviewed v0.1.1 public build at `a2f5930`, with the title on one
line where it fits and whole-word stacking only on the narrowest screens.
Its project-specific temple avatar/banner and site records were verified on
Ethereum using two RPC endpoints on 2026-11-05; the DecentAgency owner retains
the subname. [Public deployment evidence](https://github.com/TheJollyLaMa/DecentCanopy/blob/main/data/ens-project-deployments.json)
records the exact CID and successful transactions.

ENS is a dated public site snapshot, not a journey deployment, reward activation
or Supporter mint receipt. Frozen v0.1.1 NFT metadata/art remain unchanged, and
v0.1.0 remains superseded. `SUPPORTER_ENS_NAME` configures this name for future
release preparations only. Gateways may cache older DNS/content responses.

## Run & verify locally

Requires Node 22+; no UI build step.

```sh
npm ci
node assistant/static-server.mjs
# Open http://127.0.0.1:8080 — only public/ is served.
npm test
npm run payroll:validate
npm run test:browser
```

No external model, deployed-chain, radio or payment calls are made by these
tests. Contract tests use a local EVM; helper/receipt/wallet/radio tests use
fixtures and loopback servers.
`npm test` runs the explicit contract/verification selectors and then the UI
runner once: 35 local-EVM/offline verification tests and 44 UI tests.
`test:browser` adds ten real Chromium map/gate/arrival/tutorial/About/title/redirect tests; install
its browser once with `npx playwright install chromium` if unavailable.

## Available now

- Contextual trail explorer, keyboard-friendly demo markers/cards, stop details,
  free-participation help and a six-hop modeless bunny tutorial that highlights
  actual controls and returns focus to the trail.
- Restored geographic Leaflet map with real coordinate pins and radius circles,
  optional OpenStreetMap streets, a purpose-led stop/basket design studio,
  exact metadata hash/export/recovery and fresh/accurate GPS arrival rehearsal.
  Video/knowledge visit services are explicitly unconfigured, never fake-success.
  See [Geographic gates & next-level contracts](docs/Geographic-Gates.md).
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
Demo trails and tutorial completion have no bounty. Historical
Polygon contracts/ABIs remain in `public/contracts/` and `public/abis/`;
their old fake-whitelist scripts are preserved but never loaded by this UI.
The three legacy addresses are now confirmed on Polygon, including existing
token custody. Deployed-source equivalence and migration obligations still need
review; the newly versioned V1 is not an in-place migration of old chain state.
See the read-only Polygon findings in the contract runbook.

Configure only after review: [Operations](docs/Operations.md),
[contract runbook](docs/contracts/base-v1.md),
[experience & tutorial](wiki/Experience.md), [payroll](wiki/Development-Payroll.md),
[helper boundary](docs/Assistant.md), [reuse decision & licenses](docs/Reuse.md).
Browser fixture procedure/results: [testing](docs/Testing.md).
The isolated `DecentPilgrimageGateV2` contract is an undeployed basket-escrow
prototype with sponsor-created gates, participant allowlists, two collection
modes, signed video/knowledge attestations and expiry refunds. It is not wired
to the existing V1 transaction desk or production deploy/verify scripts. No NFT
is minted; metadata/NFT reuse recommendations are in the geographic-gates guide.

## Versioned Supporter edition · token 78 / listing 8

The corrective **v0.1.1** Supporter edition is optional development support:
**1,000 editions at 10 USDC (`10000000`) on Base**, using the existing
NFT `0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B` and community escrow
`0x31b07b83e99A9bdF379bf40225b8A80d3804C89d`.
Token **78** is minted and escrowed in listing **8**. Independent shared Head
verification at Base block **53547399** checked the frozen metadata URI, 1,000
minted editions, at least 12 confirmations, 10 USDC price and active escrow stock
(1,000 then, not a live promise). The current About links to external DecentHead
checkout, which rechecks stock/price; this app adds no purchase-signing logic.

- [Support Pilgrimages — 10 USDC](https://thejollylama.github.io/DecentHead/supporter/buy.html?chainId=8453&escrow=0x31b07b83e99A9bdF379bf40225b8A80d3804C89d&listingId=8&priceUSDC=10000000)
- [Verified public release evidence](https://github.com/TheJollyLaMa/DecentPilgrimages/releases/download/v0.1.1/supporter-minted.json)
- [Mint receipt](https://basescan.org/tx/0xea8c501ab694cda30b31f9a0336af9ad3d31c1897de4e3f2e1f6af068cb11652)

The existing ENS site is a fixed pre-mint snapshot and still shows its original
preparing state. Current GitHub Pages has the verified links; repointing ENS
requires a separately reviewed public build. Frozen NFT metadata/art are unchanged.

Support does **not** prove health, financial functionality, deployment safety,
returns or future delivery. It is not a reward allocation or contributor payment.
Base V1, payroll and helper activation remain separately gated.

The standard caller workflows pin DecentHead
`599241344849af1921f6a9a59431f4b2f300d417`, render/pin only `public/` as the
runnable site (no build), and archive the exact tagged source. The user has
configured repository `PINATA_JWT`; the parent verified its name without reading
its value. Announcements remain disabled unless
explicitly enabled/configured; minting does not automatically repoint ENS.
See [Supporter release scope, evidence and all issue/PR/branch dispositions](docs/Supporter-Release.md).
The published GitHub release is non-prerelease, named **v0.1.1 · sponsored-journey
preview**; that publication flag does not imply production maturity or activate
Base V1. [Release notes body](docs/releases/v0.1.1.md).
Prepared **v0.1.0 remains frozen, unminted and superseded**: art review found
orphan characters in the app header and generic card title. v0.1.1 corrects the
app's natural **Decent Pilgrimages** word-boundary/responsive typography and pins
the corrected shared renderer. No financial or service functionality activates.

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
