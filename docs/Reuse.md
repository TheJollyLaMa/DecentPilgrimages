# Receiving-app reuse decision & provenance

Need: a private-by-default trail explorer with a real shared Decent wallet/IPFS
session, exact Base organizer/sponsor/claim actions, opt-in helper/radio and a
steward-gated development queue with donor-strength receipt evidence.

Scope inspected: committed current DecentHead, DecentBusking, DecentCanopy and
BigNuten_Vanilla; Canopy’s curated `data/agency-map.json` offers/needs/evidence
were a lead, not a live code index. Donor root status/worktrees revealed unfinished
work, which was not copied. Original Pilgrimages dirty sources were not edited
or used as a state snapshot. This is not a whole-library search or live sync.

| Donor / exact commit | File / symbol | Decision & receiving result |
| --- | --- | --- |
| DecentHead `426ccb7ad8de658cda374b11ebc4b544b35257e6` (2.0.0) | `docs/ADOPTING.md` release manifest; `js/main.js:DecentHead`; `js/wallet.js:WalletSession`; `js/ipfs-host.js` V1 adapter; `AnkhMenu.js` | Vendor the supported module/asset closure under `public/vendor/decent-head/2.0.0`, preserving relative paths, Apache LICENSE/NOTICE, CC-BY art attribution and local ethers MIT license. Host adapts inert ankhs to real permission-checked desk/profile; one shared session. ENS disabled to avoid optional mainnet background RPC. Browser fixture: no external/wallet requests on load, functional ankhs and reduced motion. |
| DecentCanopy `bcf2572e57f0a934a4590af83fb5c9b5b805adbf` | `scripts/canopy-radio.js:WIDGET_URL,mountCanopyRadio`; `test/canopy-radio.test.js` | Adapt actual ES-module `mount(element,options)` and destroy/retry lifecycle; remove automatic on-load mount. Exact source pin ends **ee9**, `1fe9ed0c2afc61552328fdda10d0f199bc3eaee9`, not the stale report’s ee2. No iframe API. Node fixtures verify no import/autoplay until Load and late-load/pagehide cleanup. Live radio service not tested. |
| DecentBusking `bf852757d23f7c088ef78e9b49261bcad7a9583a` | `scripts/payroll.js:createBountyEntries,settleEntries`; `processMergedBounty.js`; `validatePayrollQueue.js`; `settlePayroll.js`; `discord-bot/payment-ledger.js:verifyRepositoryPayment`; `rpc-failover.js` | Adapt actual queue/validator/merge pipeline and exact canonical receipt proof; extra config/actor/environment activation gates. No copied financial data. Retain donor exact ART work-reference compatibility; other assets include currency, not an invented reference format. Receipt fixtures verify amount/fund/asset/recipient/repo/contributor/work and all rejection gates. |
| Same DecentBusking commit | `agent-service/server.mjs` generic consent/origin/body/timeout boundary; `model.mjs:askModel` bounded Responses/evidence validation | Adapt generic server-side boundary only. Build receiving public-facts-only helper; no private handoff/routing/deployment context or wallet authentication copied. No browser-key pattern. All model calls mocked in receiving tests; default disabled. |
| BigNuten_Vanilla `7bac130d393f390dd2d3a8aca0a38db9e89c5d47` | `scripts/payroll.js`, `validatePayrollQueue.js`, `settlePayroll.js` | Inspect/reject as settlement donor here: simpler receipt settlement does not provide the current DBusk canonical `PayrollPaid` proof boundary. Browser-key helper pattern is incompatible with server-held-key consent requirements. |

No shared package was extracted: these are compatible receiving adaptations,
not speculative architecture. Runtime is static native modules + local ethers,
Node HTTP/fetch for optional helper, and existing root ethers for receipt tests.
Base 8453 differs from the now-confirmed legacy Polygon state; no donor chain address,
private storage, auth session, budget, account or deployed fund is transplanted.
Browser GPS never enters on-chain eligibility or the helper.

### Documented Head host-only component adaptation

The pinned 2.0.0 release is adapted in
`js/components/Header/IPFSStatus.js` and `IPFSControls.js` for this host’s
local-files-only boundary. `providerLabel` explicitly says
`unconfigured · local files only`; `ipfsControlsMode: 'host-only'` hides and
disables generic provider credentials, uploads/restores and community pins,
guards their handlers and `openBackup`, and suppresses the remote-provider setup
link. The version-1 host backup capability still opens the local journal.
No private/shared `getIpfs()` facade or wallet lifecycle is monkeypatched.
This is a documented receiving component patch, not an unchanged upstream
release or a claim of configured Pinata/Kubo service.

The host About infographic reuses the Head title's existing
`decenthead:about` event. Two explicit compatibility changes in `AppTitle.js`
and `Header.js` make that event cancelable and preserve the default modal unless
the host cancels it. The app handles it during capture to open its own semantic
dialog, with an original inline temple SVG, a three-stop sponsorship infographic,
direct tutorial/help buttons and links. No private shadow methods or raw HTML
configuration are used. The generic Head About remains the fallback for other
hosts. Receiving tests cover this contract and browser acceptance checks both
host and default behavior.

## Licenses / attribution

All four committed donors carry Apache-2.0 plus current NOTICE, with original
creative work under CC-BY-4.0 as declared. Attribute **The Jolly LaMa / A Decent
Agency** and the linked donor projects. Head notices/licenses travel inside its
vendor directory; copied Busking code keeps donor LICENSE/NOTICE/CC-BY license in
`payroll/vendor/decentbusking/`. The helper and radio adaptations share those
donor attributions. This app’s original NOTICE/LICENSE remain in force.

Public approved evidence only is documented here. No private/root worktree
findings or private donor state have been published into a Canopy snapshot.
Candidate reuse is not a verified deployment or a tested live external service.
