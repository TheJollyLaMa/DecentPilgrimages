# V1 operations & activation

This release is a new Base contract/interface, not a migration of old balances,
wallet approvals or whitelist state. No public address is configured. Refer to
the [contract-owned reproducible deployment/verification runbook](contracts/base-v1.md);
do not deploy or claim source verification merely because UI tests pass.

## Enable an audited deployment, not a guessed address

1. Steward reviews the exact contract build, owner, chain and published source
   verification evidence. Deploy separately under that runbook; keep secrets
   outside public configuration. This repository has not performed that deployment.
2. In `public/scripts/v1/config.mjs`, explicitly set `contractVersion` to
   `DecentPilgrimageBaseV1`, `chainId` to **8453**, and the actual reviewed address.
   Keep the compiled `baseV1Abi`; `public/scripts/v1/abi.mjs`,
   `public/abis/DecentPilgrimageBaseV1.json` and
   `contracts/abi/DecentPilgrimageBaseV1.json` must match exactly.
   Do not substitute any legacy ABI or Polygon address.
3. Configure each standard exact-transfer ERC20 as
   `{ address: ACTUAL_REVIEWED_ADDRESS, symbol: REVIEWED_SYMBOL, decimals: EXACT_ON_CHAIN_INTEGER }`.
   Native ETH is the **zero-address sentinel**, not a deployed token or copied
   deployment; it uses 18 decimals/wei. `fundNative({value: wei})` needs no ERC20
   approval. All shared allocation/approval/claim methods accept the same zero
   sentinel for ETH. No USDC/other ERC20 address is guessed or preconfigured:
   runtime reads must match the integer decimals exactly. Fee-on-transfer
   tokens are unsupported.
4. Run receiving tests, then explicitly connect and **Read Base deployment**.
   The read verifies chain, code presence, owner and interface reads, not
   explorer source verification. It does not send a transaction.
5. The owner uses the left ankh to allowlist sponsors. The owner or approved
   sponsor funds native ETH directly, or confirms a separate **exact ERC20
   allowance** before ERC20 funding. **Add USDC or another ERC20 to this desk**
   explicitly checks the entered Base token address/code/decimals and makes it
   available only in this page. Its display label is not identity or endorsement;
   the address is always shown. This read grants no sponsor or claim approval.
   The owner creates public trail locations and allocates available funds.
6. Agree on private registration and accepted evidence. The owner approves the
   exact location, token, wallet and amount after review. Participants explicitly
   recheck on-chain approval and claim. GPS is never a prerequisite.
7. Submission only displays a pending hash. Success requires two successful Base
   confirmations and the exact contract `ClaimPaid(locationId,token,participant,amount)`
   event. RPC failure, wrong chain, replacement/cancellation, account changes or
   a missing event cannot produce a paid-success celebration.

### Owner lifecycle and unused-fund recovery

The left ankh also implements `setLocationActive`, `cancelClaimApproval`,
`releaseAllocation` and `recoverToken` using the exact V1 interface. Deactivate
a trail to prevent claims/new allocations; this alone does not cancel approvals.
Cancel each pending approval for the location/asset before releasing unused
allocation (the contract refuses release while approvals remain). Released
allocation becomes unallocated contract funds, not a wallet payout.
Recover only unallocated funds to the explicitly entered nonzero reviewed
recipient, after the confirmation checkbox and wallet authorization. Allocated
funds cannot be recovered. Native ETH and ERC20 precision remain distinct.
All actions remain owner/chain/deployment-gated and successful only after actual
successful receipts; recovery is not `ClaimPaid` or a celebration.
An owner is not implicitly a sponsor: use `setSponsor(owner,true)` and reread
after confirmation before owner-wallet allowance/funding actions are enabled.

Approval amount changes, exhausted funds or another state change between check
and claim can revert safely. Recheck rather than assuming eligibility.
No transaction is sent on load, tutorial steps, menu opening or location consent.
When RPC/config is unavailable, the demonstration explorer remains usable.

## Host privacy & IPFS

Serve only `public/` using `node assistant/static-server.mjs`.
The shared Head host adapter opens the app’s local journal backup/recovery panel.
It reports **local export only**, not a stored CID. Public replication and pinning
rewards are unavailable. Selecting Pinata/Kubo in the shared kit is not an upload
or payout; those generic credentials/provider/upload/pin controls are hidden,
disabled and handler-guarded in this host-only receiving adaptation.
The header reads **IPFS · unconfigured · local files only** rather than suggesting
an available Pinata service. No automatic ENS lookup, upload or pinning reward request occurs.
Do not place provider credentials in `config.mjs` or publish journal nicknames
without consent. Browser data clears only when the user asks; GPS is always
memory-only and discarded on pagehide.

The optional radio pin comes from the committed Canopy widget source. It is a
remote module/service contacted only after **Load radio**; playback needs the
widget’s explicit play control. Loading/unloading has no bounty or payment role.

## Separate steward activation

Payroll configuration and workflows remain disabled; see
[Development-Payroll](../wiki/Development-Payroll.md). No signing key or transfer
method exists in the settlement workflow: it records proofs of prior payments.
Its current donor-strength receipt boundary is Base ERC20-only; native trail
claims do not silently reinterpret historical ETH payroll or invent native
router proof. Native payroll needs separate reviewed router evidence.
The optional assistant requires a separate reviewed server, origins/model/key
and explicit browser endpoint; see [Assistant](Assistant.md). Do not activate
either just to demonstrate the UI.
