# Receiving V1 validation

Focused, offline/loopback commands:

```sh
node --test test/ui/*.test.mjs
node payroll/scripts/validatePayrollQueue.js
npm test
```

`npm test` runs `test:contracts` (15 local-EVM contract tests and six offline
Etherscan V2 verification regressions, plus 14 isolated V2 basket-escrow tests),
followed by the 44 Node UI tests (including five Supporter regressions).
Explicit Hardhat selectors prevent Node UI tests from also running inside Mocha.
CI uses this same sequential command and validates the inactive payroll queue.
Imported donor licenses and the Head README retain exact pinned upstream bytes.
Their existing whitespace is excluded from staged whitespace checks rather than
rewriting third-party attribution; all application/source changes are checked.
The vendored Leaflet distribution likewise retains npm package bytes (including
upstream CRLF/whitespace), independently compared to installed Leaflet 1.9.4.

## Supporter preview acceptance · 2026-11-05

`test/ui/supporter.test.mjs` verifies the default receipt-free unavailable state,
the reviewed-public-receipt/external-checkout gate, wrong-chain/price/edition/
receipt rejection, hostile/duplicate URL rejection, immutable kit caller pins and
preserved static-distribution NOTICE/full license texts.
It never sends transactions or treats a synthetically shaped receipt as live
evidence. The browser card is not an independent chain verifier.

`npm run test:browser` now passes six real Chromium tests: the existing three
map/gate/tutorial cases and About Supporter availability at 320, 390 and 1024 px.
The new cases confirm disabled purchase, no fabricated `href`, clear support
limitations, no overflow, Escape dismissal and no external network requests.
All browser servers use private ephemeral loopback ports; the shared preview
on port 8823 is not stopped or modified.

Final local validation: 35 contract/offline tests, 44 UI tests and six browser
tests passed; disabled/empty payroll validation and source diff checks passed.
YAML parsing and immutable caller `uses`/`head_ref` equality were checked.
See [release scope and outstanding activation gates](Supporter-Release.md).

`test/ui/core.test.mjs`: exact compiled/public/module ABI equality, configuration/
wrong-chain/unavailable-RPC gates, integer decimals, BigNumber-to-string
coordinates, bounded journal schema, opt-in/denied high-accuracy location,
per-message consent and no legacy script imports.

`client.test.mjs`: actual ABI-shaped owner/sponsor/location/allowance/funding/
allocation/per-participant approval/cancellation calls; native ETH zero-sentinel
funding/claims with no ERC20 allowance/decimals calls; explicit additional ERC20
address inspection and individually verified decimals; exact eligible claim;
missing/reverted/mismatched event rejection, two confirmations, account/chain
invalidation and decimal mismatch. Providers and contracts are fixtures, not
live network calls.

`assistant.test.mjs`: disabled/missing-key/origin/consent/input/context/output
gates, concurrency/budget/deadline/error handling, mock Responses transport,
and public-only static hosting. `payroll.test.mjs`: empty defaults and gate-before-
side-effects, actual donor missing-bounty behavior and exact canonical
`PayrollPaid` matching/rejection. `radio.test.mjs`: no on-load import/autoplay,
actual pinned mount options, retry and late-load/pagehide cleanup.
The preview distinguishes missing/private paths (404), malformed encoding (400)
and unexpected filesystem failures (logged 500). HEAD, rejected mutations and
real permission-denial failures are regression-tested; the permission test needs
a non-root process and cleans up only its own temporary fixture.

## Browser fixture procedure

Start `node assistant/static-server.mjs`, then use a local browser. Test only
loopback, inject denied geolocation/inert wallet fixtures, and do **not** call
live model, wallet provider, chain or radio services:

1. Verify three demo cards/markers and no wallet/geolocation/external service
   request on load. The pinned local Head module/assets may load.
2. Select The Memory Trail. Request location with a denied fixture; participation
   remains available and status explicitly explains denial.
3. Follow all six bunny hops, Back/Escape as applicable; confirm highlighted
   actual controls and return focus. Repeat with reduced motion, checking
   animation name `none` and no celebration for tutorial completion.
4. Open the right ankh, save a nickname, export/recover a valid bounded journal,
   reject recovery with GPS/secrets/context fields, and forget local state.
5. Open the left ankh: unconfigured deployment/owner/sponsor actions disabled.
   Open About/help and optional helper: disabled helper makes no request.
6. For radio only use a mocked `loadWidget` returning `mount`/`destroy`; do not
   click live-service Load during tests. Verify opt-in, unavailable retry and
   destruction; Node fixtures automate this boundary.

Receiving integrated browser validation covered local module load, three demo
trails, Memory Trail selection, explicit denied high-accuracy GPS, all six
tutorial steps/completion and synchronous return to help when the highlighted
read control is disabled, native ETH option, bounded journal recovery, both actual ankh actions, disabled
owner/claim/helper, reduced-motion `none`, **zero wallet RPC requests and zero
external resource requests**, and a browser-mocked radio mount/destroy lifecycle.
The integrated page was hidden, so DOM-event
fixture actions were used rather than claiming visible pointer automation.
Those fixtures did not test live deployment/source verification, GPS providers,
radio availability, OpenAI requests or payments.

Final lifecycle validation: **39 UI tests pass** including non-allowlisted-owner
funding rejection, exact native/ERC20 recovery calls and failed-receipt rejection.
A fresh integrated browser fixture confirmed the exact
`IPFS · unconfigured · local files only` label, hidden **and disabled** generic
provider/community/upload controls, guarded `openBackup`, the host backup opening
the actual local journal, all new owner lifecycle forms gated while unconfigured,
and zero external resource requests. Local queue validation and diff checks pass.

## Separate parent acceptance

Headless Chromium at 1024x768 with reduced motion completed all six hops using
normal pointer actions (no forced clicks), opened the actual ankh disclosures
and their organizer/profile actions, and confirmed the accurate local-only IPFS
label. No wallet RPC or external request occurred before radio consent.
After explicit Load radio, the actual pinned public widget mounted into its
Shadow DOM with visible controls. Instrumented `HTMLMediaElement.play` recorded
zero playback calls; Unload cleared the widget. Only the approved CDN and radio
service origins were contacted. This proves the mount/consent/no-autoplay/
cleanup integration, not uninterrupted streaming or deployment readiness.

Stop the preview/helper process after bounded checks. Full production acceptance
requires separately reviewed deployment metadata and operations; fixture
success must never be described as deployed or paid.

## Travel-sponsorship About redesign

The About dialog is a 70-word, three-step infographic over an original inline
temple SVG: Sponsor / Place / Pilgrimage. There are no dropdowns; project,
contributor and original Polygon links are visible, with direct tutorial/help
actions and a short preview/approval notice. `about.test.mjs` protects the
semantic markup and cancelable title-event/default-modal contract.

Separate headless Chromium acceptance at 1024px and 390px confirmed normal title
clicks open only the host dialog; no horizontal overflow; all three steps and
the large backdrop render; Escape returns focus to the title; tutorial/help
buttons close About and open the correct destination; zero external requests.
A host-free fixture confirmed the generic Head About still opens by default.

## Geographic-map and V2 escrow acceptance

`npm run test:browser` runs three persistent real Chromium tests at 1024px/390px:
local Leaflet marker/radius initialization, selecting real-coordinate stops,
map-click draft positioning, exact hash/download/recovery, per-person versus
first-collector budget, inside/outside/denied GPS and timed 60-second fix expiry,
both explicitly unavailable
visit services, invalidation on edits/rejected recovery, tile consent/failure,
no horizontal overflow, no external traffic before consent, and all six hops
from About. Tile requests are aborted by the test: this checks failure behavior,
not live OSM availability. A separate integrated browser loaded actual OSM tiles
after consent and visually confirmed the museum pin.

`gates.test.mjs` measures fresh/uncertain/stale/boundary/error cases, including
30.2 meters **not** rounding into a 30-meter gate, validates strict metadata and
integer funding, and independently recomputes SHA-256 over exported bytes.
Fourteen local-EVM V2 tests execute real native/ERC20 collection/refund,
two distribution modes, cross-wallet/gate/chain/escrow/metadata/method proof
rejection, short-lived proofs, funding/payout rollback, remaining reserves,
ERC1271 acceptance/rejection and reentrant recipient protection.
These are not a security audit or an implemented video/quiz attestation service.
V1 remains on 0.8.24; isolated V2 uses 0.8.26/Cancun for current crypto helpers.
