# A trail worth taking together

Participation is free. Select a demo marker or a keyboard-friendly trail card
without a wallet. Demo missions illustrate care, listening and nature; they are
not funded locations, route navigation, permission to enter land or bounty offers.
Respect accessibility, local access, safety and community consent.

## Follow the bunny

Use **Follow the bunny** or help’s tutorial button. The modeless guide highlights
the actual start button, atlas marker, location button, approval-check button,
right-ankh control and Base-read button in six hops. It scrolls those controls into context,
supports Back/Next, and returns focus to the highlighted trail context on finish
or Escape (disabled actions return focus to the enabled help button). You can
inspect the underlying page without granting permissions.
Reduced-motion preference disables decorative hopping/orbits, moving route
effects, transitions and transaction celebration; the guide still works.
Completion is a local journal flag only, never an eligibility claim.

## Your bearings, your choice

**Use my location once** explicitly asks for high accuracy with a ten-second
timeout and no cached result. Denial/unavailability leaves participation intact.
The result stays in page memory, never in export, local storage, assistant
requests, chain writes or public evidence. Clear it whenever desired; pagehide
discards it. Trail coordinates created by the owner are deliberately public
place metadata, a separate thing from a visitor’s private GPS.

## Ankhs and shared controls

- **Right ankh:** local journal, optional nickname, saved trail IDs, tutorial
  completion, JSON export and bounded schema-checked recovery. No wallet
  credentials, GPS, private registration or paid status is included.
- **Left ankh:** organizer/sponsor desk. The menu grants no privileges. The
  configured chain’s actual owner can allowlist sponsors, create public locations,
  allocate funds and approve/cancel exact participant claims. Approved sponsors
  fund native ETH directly with 18-decimal wei amounts, or separately approve
  exact ERC20 allowance and fund USDC/other tokens using verified runtime
  decimals. Add a real Base ERC20 address explicitly to the page’s desk; no
  USDC address is guessed and additional tokens do not gain automatic approval.
  Owner status alone never grants sponsor funding: explicitly allowlist the
  owner wallet first. Owner controls also pause/reactivate locations, cancel
  participant approvals, release unused allocations only after every pending
  approval is canceled, and recover only unallocated funds to a reviewed
  recipient. These operations require actual successful receipts; recovery is
  not a participant reward and does not celebrate.
- **Title / How this works:** accessible About/help explains the real rules.
- **Fox:** the pinned shared Head wallet connects only on a click. Account/chain
  changes or disconnect invalidate write/approval state. Exploration stays free.
- **IPFS:** the shared host panel opens local journal export/recovery. It does not
  assert a pin, CID, public replica, live sync or pinning reward.
  The header says unconfigured, local files only. Generic provider credentials,
  uploads/restores and public pin actions are unavailable in this host-only mode.

## Real work and real receipts

Agree privately with the organizer on registration, work acceptance criteria and
evidence before expecting a reward. Never publish private evidence or wallet
secrets. On-chain approval is the owner’s deliberate review decision, not GPS,
a saved trail, a tutorial or a logical team-job assignment.

If configured, **Read Base deployment** and **Check organizer approval** are
explicit read actions. The claim button requires active, funded, unclaimed,
organizer-approved eligibility for your exact wallet/location/token. It is not a
guarantee against later state changes. Only two-confirmation successful exact
`ClaimPaid` receipts produce paid-success text and optional celebration.

Development tasks are separate: [issue #3](https://github.com/TheJollyLaMa/DecentPilgrimages/issues/3)
coordinates experience work; [#4](https://github.com/TheJollyLaMa/DecentPilgrimages/issues/4)
coordinates helper/payroll. These jobs are not invented bounties. See
[Development-Payroll](Development-Payroll.md) for private registration, maintainer
acceptance and canonical receipt requirements.

## Optional company

DBuskRadio loads only on consent to its external service, does not autoplay, can
retry when unavailable, and unloads on opt-out/pagehide. The helper remains
disabled until a reviewed server endpoint exists, requires fresh consent for
each typed message, and receives no automatic wallet/GPS/journal context.
