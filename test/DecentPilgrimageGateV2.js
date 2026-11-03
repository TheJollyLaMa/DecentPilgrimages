const { expect } = require("chai");
const { ethers, artifacts } = require("hardhat");
const exportedAbi = require("../contracts/abi/DecentPilgrimageGateV2.json");

const types = { Visit: [
    { name: "gateId", type: "uint256" }, { name: "participant", type: "address" },
    { name: "metadataHash", type: "bytes32" }, { name: "method", type: "uint8" },
    { name: "issuedAt", type: "uint64" }, { name: "validUntil", type: "uint64" }
] };

describe("DecentPilgrimageGateV2 (undeployed prototype)", function () {
    async function fixture(mode = 0, method = 0) {
        const [owner, sponsor, visitor, second, verifier, stranger] = await ethers.getSigners();
        const escrow = await (await ethers.getContractFactory("DecentPilgrimageGateV2")).deploy(owner.address);
        const token = await (await ethers.getContractFactory("TestToken")).deploy();
        await escrow.setSponsor(sponsor.address, true);
        await token.mint(sponsor.address, 1000n);
        await token.connect(sponsor).approve(escrow.target, 1000n);
        const now = (await ethers.provider.getBlock("latest")).timestamp;
        const terms = { latitudeMicrodegrees: 43_000_000, longitudeMicrodegrees: -76_000_000, radiusMeters: 30,
            expiresAt: now + 3600, mode, method, verifier: verifier.address, metadataHash: ethers.id("exact public metadata bytes"),
            metadataURI: "ipfs://bafy-test-fixture/gate.json" };
        const assets = [{ token: ethers.ZeroAddress, amountPerCollection: 5n }, { token: token.target, amountPerCollection: 100n }];
        const participants = [visitor.address, second.address];
        async function create(overrides = {}, basket = assets, list = participants, sender = sponsor, value = mode === 0 ? 10n : 5n) {
            return escrow.connect(sender).createGate({ ...terms, ...overrides }, basket, list, { value });
        }
        async function proof(participant = visitor, patch = {}, signer = verifier, domainPatch = {}) {
            const issuedAt = (await ethers.provider.getBlock("latest")).timestamp;
            const data = { gateId: 0, participant: participant.address, metadataHash: terms.metadataHash, method,
                issuedAt, validUntil: issuedAt + 120, ...patch };
            const domain = { name: "DecentPilgrimageGate", version: "2", chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: escrow.target, ...domainPatch };
            return { ...data, signature: await signer.signTypedData(domain, types, data) };
        }
        async function collect(who = visitor, authorization = null, gateId = 0) {
            const p = authorization || await proof(who);
            return escrow.connect(who).collect(gateId, p.issuedAt, p.validUntil, p.signature);
        }
        return { owner, sponsor, visitor, second, verifier, stranger, escrow, token, terms, assets, participants, create, proof, collect };
    }

    it("approved sponsors create immutable funded geographic basket gates with per-person reserves", async function () {
        expect((await artifacts.readArtifact("DecentPilgrimageGateV2")).abi).to.deep.equal(exportedAbi);
        const f = await fixture(); await f.create();
        const [gate, basket] = await f.escrow.getGate(0);
        expect(gate.sponsor).to.equal(f.sponsor.address);
        expect(gate.terms.latitudeMicrodegrees).to.equal(43_000_000);
        expect(gate.terms.radiusMeters).to.equal(30);
        expect(gate.terms.metadataHash).to.equal(f.terms.metadataHash);
        expect(gate.remainingCollections).to.equal(2);
        expect(basket.length).to.equal(2);
        expect(await f.escrow.reserved(ethers.ZeroAddress)).to.equal(10);
        expect(await f.escrow.reserved(f.token.target)).to.equal(200);
        await expect(f.create({}, f.assets, f.participants, f.stranger)).to.be.revertedWith("Sponsor not approved");
    });

    it("atomically transfers each fixed native/ERC20 basket once to every approved visitor", async function () {
        const f = await fixture(); await f.create();
        await expect(f.collect()).to.emit(f.escrow, "BasketCollected").withArgs(0, f.visitor.address, f.terms.metadataHash);
        expect(await f.token.balanceOf(f.visitor.address)).to.equal(100);
        await expect(f.collect()).to.be.revertedWith("Participant not eligible");
        await f.collect(f.second);
        expect(await f.token.balanceOf(f.second.address)).to.equal(100);
        expect(await f.escrow.reserved(f.token.target)).to.equal(0);
        expect(await ethers.provider.getBalance(f.escrow.target)).to.equal(0);
    });

    it("first eligible collector takes the whole basket and later participants cannot collect", async function () {
        const f = await fixture(1, 1); await f.create(); await f.collect(f.second);
        expect(await f.token.balanceOf(f.second.address)).to.equal(100);
        await expect(f.collect()).to.be.revertedWith("Gate closed");
        expect(await f.escrow.reserved(f.token.target)).to.equal(0);
    });

    it("rejects copied authorizations, non-whitelisted callers and cross-gate replay", async function () {
        const f = await fixture(); await f.create(); const p = await f.proof();
        await expect(f.collect(f.second, p)).to.be.revertedWith("Invalid visit authorization");
        await expect(f.collect(f.stranger, await f.proof(f.stranger))).to.be.revertedWith("Participant not eligible");
        await f.create();
        await expect(f.collect(f.visitor, p, 1)).to.be.revertedWith("Invalid visit authorization");
    });

    it("binds proof to verifier, chain, escrow, metadata and video/knowledge method", async function () {
        const f = await fixture(); await f.create();
        const invalid = [
            await f.proof(f.visitor, {}, f.stranger),
            await f.proof(f.visitor, { metadataHash: ethers.id("changed") }),
            await f.proof(f.visitor, { method: 1 }),
            await f.proof(f.visitor, {}, f.verifier, { chainId: 8453 }),
            await f.proof(f.visitor, {}, f.verifier, { verifyingContract: f.stranger.address })
        ];
        for (const p of invalid) await expect(f.collect(f.visitor, p)).to.be.revertedWith("Invalid visit authorization");
        await f.collect();
    });

    it("requires a short-lived attestation, rejects future issuance and expires it", async function () {
        const f = await fixture(); await f.create();
        const now = (await ethers.provider.getBlock("latest")).timestamp;
        for (const patch of [
            { issuedAt: now + 100, validUntil: now + 200 },
            { issuedAt: now - 100, validUntil: now - 1 },
            { issuedAt: now, validUntil: now + 601 },
            { issuedAt: now, validUntil: f.terms.expiresAt + 1 }
        ]) await expect(f.collect(f.visitor, await f.proof(f.visitor, patch))).to.be.revertedWith("Invalid visit deadline");
    });

    it("refunds only the sponsor's unused baskets after expiry, never another gate's reserves", async function () {
        const f = await fixture(); await f.create(); await f.create(); await f.collect();
        await expect(f.escrow.connect(f.sponsor).refundExpired(0)).to.be.revertedWith("Not refundable");
        await ethers.provider.send("evm_setNextBlockTimestamp", [f.terms.expiresAt]);
        await ethers.provider.send("evm_mine", []);
        await expect(f.collect(f.second)).to.be.revertedWith("Gate closed");
        await expect(f.escrow.connect(f.owner).refundExpired(0)).to.be.revertedWith("Only gate sponsor");
        await expect(f.escrow.connect(f.sponsor).refundExpired(0)).to.emit(f.escrow, "GateRefunded").withArgs(0, f.sponsor.address, 1);
        expect(await f.escrow.reserved(f.token.target)).to.equal(200);
        expect(await f.token.balanceOf(f.escrow.target)).to.equal(200);
        await expect(f.escrow.connect(f.sponsor).refundExpired(0)).to.be.revertedWith("Not refundable");
        await f.escrow.connect(f.sponsor).refundExpired(1);
        expect(await f.escrow.reserved(f.token.target)).to.equal(0);
    });

    it("rejects invalid coordinates, tiny gates, missing metadata/verifier and expired terms", async function () {
        const f = await fixture();
        for (const [patch, message] of [
            [{ latitudeMicrodegrees: 90_000_001 }, "Invalid latitude"],
            [{ longitudeMicrodegrees: -180_000_001 }, "Invalid longitude"],
            [{ radiusMeters: 4 }, "Invalid radius"], [{ radiusMeters: 10001 }, "Invalid radius"],
            [{ metadataHash: ethers.ZeroHash }, "Missing verifier or metadata"],
            [{ verifier: ethers.ZeroAddress }, "Missing verifier or metadata"],
            [{ metadataURI: "https://example.com/gate.json" }, "Use IPFS metadata"],
            [{ expiresAt: 1 }, "Invalid expiry"]
        ]) await expect(f.create(patch)).to.be.revertedWith(message);
        expect(await f.escrow.gateCount()).to.equal(0);
    });

    it("rejects duplicate/empty wallets/assets and exact native under/over-funding", async function () {
        const f = await fixture();
        await expect(f.create({}, f.assets, [f.visitor.address, f.visitor.address])).to.be.revertedWith("Invalid or duplicate participant");
        await expect(f.create({}, f.assets, [ethers.ZeroAddress])).to.be.revertedWith("Invalid or duplicate participant");
        await expect(f.create({}, [f.assets[0], f.assets[0]])).to.be.revertedWith("Duplicate asset");
        await expect(f.create({}, [])).to.be.revertedWith("Invalid basket or whitelist size");
        for (const value of [0n, 9n, 11n]) await expect(f.create({}, f.assets, f.participants, f.sponsor, value)).to.be.revertedWith("Incorrect native funding");
        expect(await f.escrow.reserved(f.token.target)).to.equal(0);
    });

    it("rejects fee-on-transfer funding without leaving a partial gate or reserve", async function () {
        const f = await fixture(); const fee = await (await ethers.getContractFactory("FeeToken")).deploy();
        await fee.mint(f.sponsor.address, 1000); await fee.connect(f.sponsor).approve(f.escrow.target, 1000);
        await expect(f.create({}, [{ token: fee.target, amountPerCollection: 100n }], f.participants, f.sponsor, 0n)).to.be.revertedWith("Inexact funding");
        expect(await f.escrow.gateCount()).to.equal(0);
        expect(await fee.balanceOf(f.escrow.target)).to.equal(0);
    });

    it("rolls back the entire native/ERC20 basket and eligibility if a payout is inexact", async function () {
        const f = await fixture(); const fee = await (await ethers.getContractFactory("OutboundFeeToken")).deploy();
        await fee.mint(f.sponsor.address, 1000); await fee.connect(f.sponsor).approve(f.escrow.target, 1000);
        await f.create({}, [f.assets[0], { token: fee.target, amountPerCollection: 100n }]);
        await fee.setFeePayer(f.escrow.target);
        await expect(f.collect()).to.be.revertedWith("Inexact payout");
        expect(await f.escrow.collected(0, f.visitor.address)).to.equal(false);
        expect((await f.escrow.getGate(0))[0].remainingCollections).to.equal(2);
        expect(await ethers.provider.getBalance(f.escrow.target)).to.equal(10);
        expect(await f.escrow.reserved(fee.target)).to.equal(200);
    });

    it("sponsor revocation stops new gates but cannot confiscate existing traveler baskets", async function () {
        const f = await fixture(); await f.create(); await f.escrow.setSponsor(f.sponsor.address, false);
        await expect(f.create()).to.be.revertedWith("Sponsor not approved");
        await f.collect(); expect(await f.token.balanceOf(f.visitor.address)).to.equal(100);
    });

    it("accepts a designated ERC1271 verifier and honors its current rejection", async function () {
        const f = await fixture();
        const verifier = await (await ethers.getContractFactory("GateVerifierFixture")).deploy(f.verifier.address);
        await f.create({ verifier: verifier.target });
        const p = await f.proof();
        await verifier.setEnabled(false);
        await expect(f.collect(f.visitor, p)).to.be.revertedWith("Invalid visit authorization");
        await verifier.setEnabled(true);
        await f.collect(f.visitor, p);
        expect(await f.token.balanceOf(f.visitor.address)).to.equal(100);
    });

    it("prevents reentrant collection from a whitelisted receiving contract", async function () {
        const f = await fixture();
        const receiver = await (await ethers.getContractFactory("GateVisitorFixture")).deploy();
        await f.create({}, f.assets, [receiver.target], f.sponsor, 5n);
        const p = await f.proof({ address: receiver.target });
        const request = f.escrow.interface.encodeFunctionData("collect", [0, p.issuedAt, p.validUntil, p.signature]);
        await receiver.visit(f.escrow.target, request);
        expect(await receiver.reentrySucceeded()).to.equal(false);
        expect(await f.token.balanceOf(receiver.target)).to.equal(100);
        expect(await f.escrow.reserved(f.token.target)).to.equal(0);
    });
});
