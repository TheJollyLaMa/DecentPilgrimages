# Geographic gates: a reason to go

A sponsor places tokens at a meaningful stop. A whitelisted traveler reaches
the stop, completes a video check-in or local-knowledge test, and collects a
basket. A walk, a museum visit or a garden can be a pilgrimage; it need not be
a competition. No leaderboards, location trails, compulsory camera access,
speed incentives or promises of payment for visiting demo pins.

## What works in this branch

- Geographic Leaflet map with real coordinates, pan/zoom, keyboard-accessible
  pins and radius circles. The pinned 1.9.4 library and license are local.
  OpenStreetMap tiles are **opt-in**: the provider sees IP/viewed tiles and can
  infer the viewed area. There is no geocoder, routing API, tile prefetch or
  offline bulk download. Respect OSM attribution and service policy.
- Select a stop or click a map location to position an **unfunded draft**.
  Coordinate inputs remain usable without pointer interaction or tiles.
- One-asset draft editor with explicit token address/decimals/amount, gate
  coordinates/radius, participant wallets, verifier, visit method and deadline.
  The contract prototype supports baskets of up to eight assets. Labels and
  decimals in drafts are user input, **not on-chain verified token identity**.
- Per-participant mode reserves a full basket for every whitelisted wallet.
  First-collector mode reserves one basket shared competitively by that explicit
  whitelist. The UI shows total required raw units; no token purchase is implied.
- Review normalizes and hashes the exact exported UTF-8 JSON with SHA-256.
  Recovery validates the schema and size, resets consent, and requires review.
  Editing invalidates the hash/export/arrival state. No draft is autosaved or
  uploaded. Expired drafts cannot be reviewed as active.
- GPS stays in page memory. A fix must be at most 60 seconds old, with its
  distance **plus reported accuracy** inside the radius. Overlapping uncertainty,
  stale fixes, denial and unavailable location do not open visit controls.
  This is guidance, **not spoof-resistant proof of presence**.
- An inside fix enables the selected visit-request control. Both live visit
  services are currently **unconfigured** and explicitly say so when requested.
  No camera/microphone permission, test answer, wallet signing, authorization,
  mint, funding, visit recording or payment occurs in this rehearsal.

The existing V1 read/claim desk is a separate, still-unconfigured adapter. It
does not consume V2 drafts or pretend its owner-approved claims are V2 visits.
Polygon contracts, original dirty checkout, balances and legacy rights are
unchanged. See [dated Polygon evidence](contracts/base-v1.md#legacy-polygon-findings-read-only-2026-11-02).

## Next-level escrow prototype

`contracts/DecentPilgrimageGateV2.sol` is a separately versioned **undeployed,
unaudited prototype**, not a production replacement or upgrade of V1.

1. Owner approves a sponsor. The sponsor creates a gate, sets its participant
   allowlist and designated verifier, and deposits the **entire** native ETH/
   ERC20 basket budget atomically. No pooled sponsor balance crosses gates.
2. Immutable terms hold microdegree coordinates, radius, expiry, collection mode,
   video/knowledge method, verifier, metadata URI and exact metadata digest.
   No owner or sponsor can rewrite terms, replace the verifier, withdraw before
   expiry or confiscate reserved baskets. Sponsor revocation stops new gates,
   not collection from already-funded ones.
3. After the visit check, the verifier signs an EIP-712 `Visit`:

   ```
   domain: name=DecentPilgrimageGate, version=2,
           chainId=<actual chain>, verifyingContract=<actual escrow>
   gateId, participant, metadataHash, method, issuedAt, validUntil
   ```

   Validity is at most 10 minutes, cannot begin in the future, and cannot extend
   past gate expiry. The actual participant calls `collect`; another wallet,
   gate, escrow, chain, method or metadata hash cannot reuse the proof.
   Each participant collects at most once per gate. ERC1271 verifier wallets
   are supported alongside EOAs; signatures are checked at collection time.
4. Collection transfers **all basket assets atomically**. First-collector mode
   closes after one collection; fixed mode serves every whitelisted wallet once.
   Exact-transfer checks reject fee-on-transfer funding/payouts. Reentrancy is
   blocked. No success event survives a failed asset transfer.
5. After expiry, only that gate's sponsor can recover its remaining baskets.
   No administrative sweep of reserved funds is present. Unexpected direct token
   transfers/forced ETH have no recovery facility in this prototype: the sponsor
   must use `createGate` and review assets before funding.

The contract verifies an authorization, **not latitude or a video stream**.
Sponsor-selected verifiers are a stated trust boundary. A dishonest verifier,
shared answers or spoofed GPS can undermine the real-world visit policy.
The prototype has immutable whitelists/verifiers: key rotation, lost wallets,
emergency pause, cancellation policy, disputed visits and accessibility
alternatives need a steward/product decision before production. A participant
may decline a camera check; organizers must agree on an alternative rather than
silently overriding a funded gate.

V2 uses Solidity 0.8.26 / optimizer 200 / Cancun, separately from V1's exact
0.8.24 / optimizer 200 artifact. Current OpenZeppelin signature helpers need
the newer compiler/EVM; pinning an older advisory-affected release was rejected.
Existing deploy/verify scripts still target **V1 only**. There is no V2 production
deploy script, configured address, auto-relayer or activated verifier key.

## What the real visit service must implement

Do not ship a browser quiz with an answer embedded in JavaScript or public
metadata. A production verifier must:

- authenticate the participant by a fresh wallet-bound challenge; load the
  correct chain/gate/whitelist, compare immutable on-chain terms to fetched
  metadata and its exact digest, and reject closed or unfunded gates;
- use explicit per-visit consent, bounded request/session lifetimes, rate/
  attempt limits, nonce replay protection and server-held signer credentials;
- for video, arrange an approved ephemeral call and have an authenticated human
  verifier accept/reject it; do not record or expose meeting links by default;
- for local knowledge, keep answers/server-side grading private, vary challenges
  where appropriate, limit attempts and explain that local knowledge does not
  cryptographically prove arrival;
- issue the exact wallet/gate-bound authorization only after success, report
  failures as failures, and never let a public endpoint mint signatures merely
  because a browser says it is inside a circle.

These are activation prerequisites, **not claims of an implemented service**.
No live video/test provider was chosen or contacted.

## Metadata / NFT recommendation and reuse decision

Inspected the curated Canopy offers and committed DecentMarket
`2942cf8` `metadata.json`, `docs/decenthead-v1-metadata.json`,
`contracts/DecentNFT_v0.3.sol:registerAndMintProductsBatch`, plus donor status,
worktrees and current issue #47. Dirty Market contracts/deployment work were
not copied. The current mint helper is admin-only, ERC1155 product/royalty
oriented and has **no geographic escrow or arrival policy**.

**Adapt the metadata shape; do not copy product minting as claim authorization.**
Use an optional collectible journey/stop receipt with `name`, `description`,
`image`, `attributes` and `properties.pilgrimage` pointing to the finalized
gate metadata and escrow identity. Its ownership/transfer must not confer or
transfer the participant allowlist or drain the token basket.

Start with contract-held hard gate terms and a content-addressed metadata URI
plus digest. An NFT can be added as a presentation/commemorative layer once
the visit policy is proven. Metadata cannot itself enforce a geofence.
The current exported `unfunded-draft` document is a design artifact; finalize
the production schema without mutable funding/status labels before publication.
Never silently relabel a draft as minted or funded. The funding client must
compare all reviewed terms and token decimals against chain state before signing.

Original map intent is adapted from preserved Pilgrimages Leaflet code, not its
automatic GPS watcher. Upstream Leaflet 1.9.4 is BSD-2-Clause, with its license
vendored. No donor NFT code/assets/private config were copied. No shared package
was extracted or public Canopy inventory changed for an unactivated prototype.

## Boundaries for good journeys

Use permitted public access points, accessible routes, reasonable hours and
safe stopping places. A driveway gate requires the landowner's permission and
must not publish a private home's exact location without informed agreement.
Never encourage road entry, trespass, unsafe walking, handling a device while
moving or exposing sensitive habitats. A radius is not a route or navigation
instruction. No exercise, health or educational outcome is guaranteed.

See [receiving tests](Testing.md) for what was actually executed.
