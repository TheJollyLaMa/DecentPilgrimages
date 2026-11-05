# v0.1.0 · sponsored-journey preview Supporter edition

Release-readiness review: 2026-11-05. Recommended tag: **v0.1.0** (not created).
This is a versioned development-support artifact, **not an activated Base reward
service**. A Supporter purchase does not prove health, financial functionality,
deployment safety, profitability, a contributor entitlement or future delivery.
Travel participation remains free. No token ID, listing ID or mint is invented.

## Exact shipped scope

- PR [#6](https://github.com/TheJollyLaMa/DecentPilgrimages/pull/6), reviewed at
  `707338886626ca70eea916b864ab6e3a2797f8e3`: geographic trail explorer, optional
  map tiles/GPS, six-hop tutorial, accessible About, local journal export/recovery,
  shared pinned Head, opt-in radio and guarded organizer/sponsor transaction desk.
- Reproducible Base V1 contracts/ABI and exact-unit client, but **no configured
  Base V1 address**. Organizer-authorized location claims remain disabled.
- An explicitly undeployed Gate V2 basket/attestation prototype and local draft
  design/export/recovery. Video/knowledge providers remain unavailable; GPS is
  advisory and memory-only, never proof sufficient for a reward.
- Steward-gated payroll/optional helper scaffolding, both disabled.
- About Supporter card: default **preparing/unavailable**, no purchase `href`,
  no automatic receipt/RPC/wallet requests. A future reviewed public receipt may
  enable only the existing external DecentHead checkout; this app adds no
  purchase/signing implementation.
- Standard immutable Head product preparation/announcement callers.

No contract, historical ABI, financial execution, deployment, migration,
transaction, ENS change, tag, release or workflow dispatch is part of this review.

## Edition and public configuration

| Field | Approved value |
| --- | --- |
| Chain | Base, `8453` |
| Edition supply | `1000` |
| Unit price | 10 USDC, six decimals: `10000000` |
| Existing NFT | `0xe63EC9f8228720bAAC2fD528C0A6d06B3Dc5439B` |
| Community escrow | `0x31b07b83e99A9bdF379bf40225b8A80d3804C89d` |
| Shared kit | DecentHead `2b87543db1ff5c44c720e5c7f782386bbd702bc1` |
| Runnable static root | `public/`; entry `public/index.html`; no build |

Final caller files: `.github/workflows/supporter-release.yml` and
`.github/workflows/supporter-announce.yml`. `uses` and `head_ref` use the same
immutable kit SHA. Preparation passes `site_root: public`, `quantity: '1000'`
and `price_usdc: '10000000'`. The exact-tag source archive is the repository;
only the selected public directory is the runnable site.
Never serve the repository root or expose assistant/payroll configuration.
Preview with `node assistant/static-server.mjs`; it serves only `public/`.

Public browser configuration:

- `public/scripts/v1/config.mjs`: Base V1 deployment remains absent; assistant
  endpoint remains absent; existing opt-in radio unchanged.
- `public/scripts/v1/supporter.mjs`: edition configuration with
  `verification: null`. This is intentionally not a receipt.

### Receipt activation boundary

After the steward mints/lists and the shared Head verifier validates the actual
on-chain receipt, listing, metadata and price, a separate reviewed update can
populate `supporterEdition.verification`. Required fields mirror the edition's
`version`, `chainId`, `supply`, `priceUSDC`, `nftContract`, `escrow`, plus exact
string `tokenId`/`listingId`, `mintTxHash`, positive `verifiedBlock`,
`confirmations >= 12`, `evidenceUrl` and `purchaseUrl`.

`evidenceUrl` must be a public JSON release asset under
`https://github.com/TheJollyLaMa/DecentPilgrimages/releases/download/v0.1.0/`.
The checkout route is the existing DecentHead
`https://thejollylama.github.io/DecentHead/supporter/buy.html` with
`chainId=8453`, the approved `escrow`, the **actual** `listingId`, and optionally
`priceUSDC=10000000` (the checkout's legacy default).
No credentials, redirects, duplicate parameters or substitute hosts are accepted.
Reconfirm the deployed checkout is compatible before enabling the link.

The browser's shape/context gate is **not independent chain verification**.
Never populate it from a submitted transaction, an unverified screenshot, a
fabricated listing, or a preparation manifest. Receipt availability is not a
promise that an edition remains in stock; the external checkout must re-read
the current listing. The frozen tagged preview deliberately stays preparing;
verified release assets and a separately reviewed later site update carry the
receipt without rewriting the tag.

## Preparation blockers and steward handoff

1. Parent/release steward reviews this branch and PR #6; neither is merged here.
   The release must include these workflows and use the exact reviewed commit.
2. Set repository **secret `PINATA_JWT`** through GitHub settings. It is currently
   missing; no secret was read, copied or published.
3. Keep `SUPPORTER_DISCORD_ENABLED` unset/false. Only if announcements are approved,
   configure `DISCORD_SUPPORTER_WEBHOOK` privately, then enable that variable.
   `SUPPORTER_ENS_NAME` is optional and requires separate steward authorization;
   this work does not choose, register or change ENS.
4. Parent coordinates release/tag, preparation, public pin/manifest review,
   steward mint/listing, verified evidence, announcement/ENS and Canopy inventory.
   Preparation itself signs no transaction. A candidate is not a minted edition.
5. Before pinning, approve the exact tagged public source archive and artifacts;
   do not include local/private configuration, journals or runtime evidence.

## All open work: explicit dispositions

Open GitHub work and remote branch heads were inspected 2026-11-05. No issues
were closed and no new PR was opened.

| Work | This version | Disposition / remaining gate |
| --- | --- | --- |
| #1 · standard Supporter workflows | Immutable callers, safe static root, About card and release boundary implemented | Keep open until parent publishes/prepares and steward verifies actual mint/listing; secrets/optional announcement/ENS remain gated. The issue's old repo-root hosting requirement is superseded by `site_root: public`. |
| #2 · version Base contracts | V1 source/ABI/client and local coverage retained and reproduced | Local implementation ready for review; do not close as deployed. Source verification, steward authorization, live deployment and historic obligations are deferred to a separately approved activation version. |
| #3 · shared Head/onboarding/radio | Pinned shared components, accessible tutorial/About, optional GPS/radio and local records retained; Supporter card tested | Local experience acceptance reproduced. Live external service availability and real wallet/device acceptance remain release-steward checks, not claims of live reward readiness. |
| #4 · steward payroll/helper | Disabled scaffold and validation retained | Defer activation to next authorized operations version: accepted work, reviewed accounts/assets/budgets, provider/origin review, service configuration and actual receipts. No setup equals payment. |
| #5 · overseer/migration readiness | Local tests and explicit preview/support boundaries documented | Keep open: no blanket production/migration approval. Historic chain custody/obligations, independently verified deployed source, real-wallet browser acceptance and steward deployment/funding approval are outstanding. |
| PR #6 · Base V1/onboarding | Reviewed at `7073388`, all existing tests reproduced; Supporter changes layered here | Parent integrates this branch with PR #6; no merge performed. No review approvals were present; existing GitHub validation checks were green at inspection. |
| Remote `main` | `0b2ae6be822f4bc9ec8c2cacca37d56476653aac` is already an ancestor of PR #6 | Integrated without conflict or history rewrite. Dirty main checkout untouched. |
| Remote `feat/base-v1-onboarding` | PR #6 head `7073388` | Source worktree inspected read-only; preserved. |
| Dedicated `feat/supporter-release` | This worktree and new changes | Parent review/integration only; no force push, branch deletion, tag or release. |

Only the two pre-existing remote branch heads above were present in the remote
inspection. No unfinished implementation was copied from the dirty main checkout.
Gate V2 production wiring, video/knowledge services, token/NFT metadata publication,
historic migration and financial changes are expressly deferred rather than
silently treated as complete.

## Review and validation evidence

The review followed the PR's Base V1 allocation/approval/claim/recovery source,
client wrong-chain/wallet-generation/exact-decimal/receipt gates, absent public
deployment configuration, deployment-script target, static-root boundary and
existing acceptance suites. No new financial code was needed for this Supporter
release. This is not a formal audit or deployed-source equivalence finding.

- `npm test`: **35 local-EVM/offline verification tests + 43 UI tests passed**.
  Includes unauthorized actions, reservations/cancellation/recovery, claim receipt
  identity, rejected signatures, wallet/network changes, absent deployment,
  unavailable provider/helper and exact decimals.
- `npm run payroll:validate`: passed, disabled/empty/no payments.
- `npm run test:browser`: **6 Chromium tests passed**. Existing map/basket,
  consent, export/recovery, declined location/tutorial checks plus receipt-free
  About at **320, 390 and 1024 px**, no horizontal overflow, no checkout links,
  no automatic network requests and Escape dismissal.
- Browser fixtures serve a private ephemeral loopback port and block external
  services; shared preview on port 8823 is untouched.
- Dependencies were restored with `npm ci` only after `npm test` reported missing
  Hardhat. No dependency manifest was changed.

These are synthetic/local results, not live mint, purchase, deployed contract,
funding, payroll, provider or migration acceptance.

## Reuse decision

Need: archive the exact version, prepare an approved Supporter edition and expose
honest About support status without duplicating wallet/payment logic.
Consulted Canopy `data/agency-map.json` Pilgrimages/Head offers and evidence; its
legacy Pilgrimages snapshot is a lead, not current activation evidence.
Adapted DecentHead workflow templates at
`426ccb7ad8de658cda374b11ebc4b544b35257e6`, then pinned the parent-approved
static-root-capable kit at `2b87543db1ff5c44c720e5c7f782386bbd702bc1`.
Rendering/pinning/verification remain shared, not copied. The receiving app's
`public/` root is incompatible with the donor's former root-only assumption;
`site_root` resolves that without exposing operational files.

Adapted the receiving app's `public/index.html` About UI and pinned shared Head
checkout route rather than creating a new wallet path. The requested BigNuten
`js/supporterToken.mjs` prior art was unavailable in the inspected local checkout
and GitHub contents lookup; no unverified donor code was invented. Existing
Apache-2.0/NOTICE attribution stays intact. The browser card consumes only public
reviewed evidence, never secrets/private travel or contributor records.
