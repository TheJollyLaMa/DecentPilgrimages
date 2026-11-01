const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DecentPilgrimageBaseV1", function () {
    async function deployFixture() {
        const [owner, sponsor, participant, other, recovery] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("TestToken");
        const token = await Token.deploy();
        const Pilgrimage = await ethers.getContractFactory("DecentPilgrimageBaseV1");
        const pilgrimage = await Pilgrimage.deploy("Base pilgrimage", owner.address);

        await token.mint(sponsor.address, 1_000n);
        await token.connect(sponsor).approve(await pilgrimage.getAddress(), 1_000n);
        await pilgrimage.setSponsor(sponsor.address, true);
        await pilgrimage.connect(sponsor).fundToken(await token.getAddress(), 100n);
        const locationId = await pilgrimage.locationCount();
        await pilgrimage.createLocation("West End", 51_500_000n, -1_200_000n, 250n, "Visit the place");

        return { owner, sponsor, participant, other, recovery, token, pilgrimage, locationId };
    }

    it("stores location fields and exposes token addresses through an explicit getter", async function () {
        const { token, pilgrimage, locationId } = await deployFixture();
        await pilgrimage.addAllocation(locationId, await token.getAddress(), 80n);

        const location = await pilgrimage.getLocation(locationId);
        expect(location.name).to.equal("West End");
        expect(location.latitudeMicrodegrees).to.equal(51_500_000n);
        expect(location.longitudeMicrodegrees).to.equal(-1_200_000n);
        expect(location.radiusMeters).to.equal(250n);
        expect(location.active).to.equal(true);
        expect(await pilgrimage.getLocationTokens(locationId)).to.deep.equal([await token.getAddress()]);
        await expect(pilgrimage.getLocationTokens(2n)).to.be.revertedWith("Unknown location");
    });

    it("allows approved sponsors to fund but keeps allocation and claim approval organizer-controlled", async function () {
        const { owner, sponsor, participant, token, pilgrimage, locationId } = await deployFixture();
        await expect(pilgrimage.connect(sponsor).addAllocation(locationId, await token.getAddress(), 1n))
            .to.be.revertedWithCustomError(pilgrimage, "OwnableUnauthorizedAccount");
        await expect(pilgrimage.connect(sponsor).approveClaim(locationId, await token.getAddress(), participant.address, 1n))
            .to.be.revertedWithCustomError(pilgrimage, "OwnableUnauthorizedAccount");
        await expect(pilgrimage.connect(participant).fundToken(await token.getAddress(), 1n))
            .to.be.revertedWith("Sponsor is not approved");
        expect(await pilgrimage.owner()).to.equal(owner.address);
    });

    it("accepts latitude and longitude microdegree domain boundaries", async function () {
        const { pilgrimage } = await deployFixture();
        const firstId = await pilgrimage.locationCount();
        await pilgrimage.createLocation("South West", -90_000_000n, -180_000_000n, 1n, "Boundary");
        await pilgrimage.createLocation("North East", 90_000_000n, 180_000_000n, 1n, "Boundary");

        const southWest = await pilgrimage.getLocation(firstId);
        const northEast = await pilgrimage.getLocation(firstId + 1n);
        expect(southWest.latitudeMicrodegrees).to.equal(-90_000_000n);
        expect(southWest.longitudeMicrodegrees).to.equal(-180_000_000n);
        expect(northEast.latitudeMicrodegrees).to.equal(90_000_000n);
        expect(northEast.longitudeMicrodegrees).to.equal(180_000_000n);
    });

    it("rejects coordinates outside the latitude and longitude domains without creating a location", async function () {
        const { pilgrimage } = await deployFixture();
        const countBefore = await pilgrimage.locationCount();
        for (const latitude of [-90_000_001n, 90_000_001n]) {
            await expect(pilgrimage.createLocation("Invalid latitude", latitude, 0n, 1n, "Invalid"))
                .to.be.revertedWith("Invalid latitude");
        }
        for (const longitude of [-180_000_001n, 180_000_001n]) {
            await expect(pilgrimage.createLocation("Invalid longitude", 0n, longitude, 1n, "Invalid"))
                .to.be.revertedWith("Invalid longitude");
        }
        expect(await pilgrimage.locationCount()).to.equal(countBefore);
    });

    it("bounds aggregate pending approvals by the funded location allocation", async function () {
        const { participant, other, token, pilgrimage, locationId } = await deployFixture();
        await pilgrimage.addAllocation(locationId, await token.getAddress(), 50n);

        await pilgrimage.approveClaim(locationId, await token.getAddress(), participant.address, 30n);
        await expect(
            pilgrimage.approveClaim(locationId, await token.getAddress(), other.address, 21n)
        ).to.be.revertedWith("Approvals exceed allocation");
        await pilgrimage.approveClaim(locationId, await token.getAddress(), other.address, 20n);
        expect(await pilgrimage.pendingApprovedAmount(locationId, await token.getAddress())).to.equal(50n);
    });

    it("pays only an organizer-approved participant once and updates token accounting", async function () {
        const { participant, token, pilgrimage, locationId } = await deployFixture();
        const tokenAddress = await token.getAddress();
        await pilgrimage.addAllocation(locationId, tokenAddress, 80n);
        await pilgrimage.approveClaim(locationId, tokenAddress, participant.address, 25n);

        await expect(pilgrimage.connect(participant).claim(locationId, tokenAddress))
            .to.emit(pilgrimage, "ClaimPaid")
            .withArgs(locationId, tokenAddress, participant.address, 25n);
        expect(await token.balanceOf(participant.address)).to.equal(25n);
        expect(await pilgrimage.accountedBalance(tokenAddress)).to.equal(75n);
        expect(await pilgrimage.totalAllocated(tokenAddress)).to.equal(55n);
        expect(await pilgrimage.allocationRemaining(locationId, tokenAddress)).to.equal(55n);
        expect(await pilgrimage.hasClaimed(locationId, tokenAddress, participant.address)).to.equal(true);
        await expect(pilgrimage.connect(participant).claim(locationId, tokenAddress))
            .to.be.revertedWith("Claim already paid");
        await expect(pilgrimage.approveClaim(locationId, tokenAddress, participant.address, 1n))
            .to.be.revertedWith("Claim already paid");
    });

    it("prevents recovery of reserved funds and permits recovery after allocation release", async function () {
        const { owner, recovery, token, pilgrimage, locationId } = await deployFixture();
        const tokenAddress = await token.getAddress();
        await pilgrimage.addAllocation(locationId, tokenAddress, 80n);

        await expect(pilgrimage.recoverToken(tokenAddress, recovery.address, 21n))
            .to.be.revertedWith("Amount exceeds unallocated balance");
        await expect(pilgrimage.releaseAllocation(locationId, tokenAddress, 81n))
            .to.be.revertedWith("Amount exceeds allocation");
        await pilgrimage.releaseAllocation(locationId, tokenAddress, 30n);
        await pilgrimage.recoverToken(tokenAddress, recovery.address, 30n);
        expect(await token.balanceOf(recovery.address)).to.equal(30n);
        expect(await pilgrimage.accountedBalance(tokenAddress)).to.equal(70n);
        expect(await pilgrimage.totalAllocated(tokenAddress)).to.equal(50n);
        expect(await pilgrimage.owner()).to.equal(owner.address);
    });

    it("requires outstanding approvals to be cancelled before allocation release", async function () {
        const { participant, token, pilgrimage, locationId } = await deployFixture();
        const tokenAddress = await token.getAddress();
        await pilgrimage.addAllocation(locationId, tokenAddress, 80n);
        await pilgrimage.approveClaim(locationId, tokenAddress, participant.address, 20n);

        await expect(pilgrimage.releaseAllocation(locationId, tokenAddress, 10n))
            .to.be.revertedWith("Pending approvals exist");
        await pilgrimage.cancelClaimApproval(locationId, tokenAddress, participant.address);
        await pilgrimage.releaseAllocation(locationId, tokenAddress, 10n);
        expect(await pilgrimage.pendingApprovalCount(locationId, tokenAddress)).to.equal(0n);
        expect(await pilgrimage.allocationRemaining(locationId, tokenAddress)).to.equal(70n);
    });

    it("blocks claims at inactive locations without consuming organizer approvals", async function () {
        const { participant, token, pilgrimage, locationId } = await deployFixture();
        const tokenAddress = await token.getAddress();
        await pilgrimage.addAllocation(locationId, tokenAddress, 50n);
        await pilgrimage.approveClaim(locationId, tokenAddress, participant.address, 20n);
        await pilgrimage.setLocationActive(locationId, false);

        await expect(pilgrimage.connect(participant).claim(locationId, tokenAddress))
            .to.be.revertedWith("Location is inactive");
        expect(await pilgrimage.approvedClaimAmount(locationId, tokenAddress, participant.address)).to.equal(20n);
    });

    it("rejects fee-on-transfer funding so accounting cannot overstate token custody", async function () {
        const [owner, sponsor] = await ethers.getSigners();
        const FeeToken = await ethers.getContractFactory("FeeToken");
        const token = await FeeToken.deploy();
        const Pilgrimage = await ethers.getContractFactory("DecentPilgrimageBaseV1");
        const pilgrimage = await Pilgrimage.deploy("Fee token case", owner.address);

        await token.mint(sponsor.address, 100n);
        await token.connect(sponsor).approve(await pilgrimage.getAddress(), 100n);
        await pilgrimage.setSponsor(sponsor.address, true);
        await expect(pilgrimage.connect(sponsor).fundToken(await token.getAddress(), 100n))
            .to.be.revertedWith("Token must transfer exact amount");
        expect(await pilgrimage.accountedBalance(await token.getAddress())).to.equal(0n);
    });

    it("reverts fee-on-transfer payouts without consuming an approved claim or accounting balance", async function () {
        const [owner, sponsor, participant] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("OutboundFeeToken");
        const token = await Token.deploy();
        const Pilgrimage = await ethers.getContractFactory("DecentPilgrimageBaseV1");
        const pilgrimage = await Pilgrimage.deploy("Outbound fee case", owner.address);
        const tokenAddress = await token.getAddress();
        const pilgrimageAddress = await pilgrimage.getAddress();

        await token.mint(sponsor.address, 100n);
        await token.connect(sponsor).approve(pilgrimageAddress, 100n);
        await pilgrimage.setSponsor(sponsor.address, true);
        await pilgrimage.connect(sponsor).fundToken(tokenAddress, 100n);
        await token.setFeePayer(pilgrimageAddress);
        await pilgrimage.createLocation("Fee test", 0n, 0n, 1n, "Test exact delivery");
        await pilgrimage.addAllocation(0n, tokenAddress, 100n);
        await pilgrimage.approveClaim(0n, tokenAddress, participant.address, 100n);

        await expect(pilgrimage.connect(participant).claim(0n, tokenAddress))
            .to.be.revertedWith("Token must transfer exact amount");
        expect(await pilgrimage.accountedBalance(tokenAddress)).to.equal(100n);
        expect(await pilgrimage.allocationRemaining(0n, tokenAddress)).to.equal(100n);
        expect(await pilgrimage.approvedClaimAmount(0n, tokenAddress, participant.address)).to.equal(100n);
        expect(await token.balanceOf(participant.address)).to.equal(0n);
    });

    it("funds native ETH under address(0), pays approved claims once, and conserves accounting", async function () {
        const { sponsor, participant, token, pilgrimage, locationId } = await deployFixture();
        const native = ethers.ZeroAddress;
        const fundAmount = ethers.parseEther("1");
        const allocation = ethers.parseEther("0.8");
        const claimAmount = ethers.parseEther("0.25");
        const pilgrimageAddress = await pilgrimage.getAddress();

        await pilgrimage.connect(sponsor).fundNative({ value: fundAmount });
        await pilgrimage.addAllocation(locationId, native, allocation);
        await pilgrimage.approveClaim(locationId, native, participant.address, claimAmount);
        expect(await pilgrimage.getLocationTokens(locationId)).to.deep.equal([native]);

        await expect(pilgrimage.connect(participant).claim(locationId, native))
            .to.emit(pilgrimage, "ClaimPaid")
            .withArgs(locationId, native, participant.address, claimAmount);
        expect(await ethers.provider.getBalance(pilgrimageAddress)).to.equal(fundAmount - claimAmount);
        expect(await pilgrimage.accountedBalance(native)).to.equal(fundAmount - claimAmount);
        expect(await pilgrimage.totalAllocated(native)).to.equal(allocation - claimAmount);
        expect(await pilgrimage.allocationRemaining(locationId, native)).to.equal(allocation - claimAmount);
        expect(await pilgrimage.hasClaimed(locationId, native, participant.address)).to.equal(true);
        await expect(pilgrimage.connect(participant).claim(locationId, native))
            .to.be.revertedWith("Claim already paid");
        await expect(pilgrimage.approveClaim(locationId, native, participant.address, 1n))
            .to.be.revertedWith("Claim already paid");
    });

    it("cancels native claim approvals before releasing allocation and recovers only unallocated ETH", async function () {
        const { sponsor, participant, recovery, pilgrimage, locationId } = await deployFixture();
        const native = ethers.ZeroAddress;
        const fundAmount = 100n;
        const pilgrimageAddress = await pilgrimage.getAddress();
        const recoveryBalanceBefore = await ethers.provider.getBalance(recovery.address);

        await pilgrimage.connect(sponsor).fundNative({ value: fundAmount });
        await pilgrimage.addAllocation(locationId, native, 80n);
        await pilgrimage.approveClaim(locationId, native, participant.address, 20n);
        await expect(pilgrimage.releaseAllocation(locationId, native, 30n))
            .to.be.revertedWith("Pending approvals exist");

        await pilgrimage.cancelClaimApproval(locationId, native, participant.address);
        await pilgrimage.releaseAllocation(locationId, native, 30n);
        await expect(pilgrimage.recoverToken(native, recovery.address, 51n))
            .to.be.revertedWith("Amount exceeds unallocated balance");
        await pilgrimage.recoverToken(native, recovery.address, 30n);

        expect(await ethers.provider.getBalance(pilgrimageAddress)).to.equal(70n);
        expect(await ethers.provider.getBalance(recovery.address) - recoveryBalanceBefore).to.equal(30n);
        expect(await pilgrimage.accountedBalance(native)).to.equal(70n);
        expect(await pilgrimage.totalAllocated(native)).to.equal(50n);
        expect(await pilgrimage.pendingApprovalCount(locationId, native)).to.equal(0n);
        expect(await pilgrimage.allocationRemaining(locationId, native)).to.equal(50n);
    });

    it("requires sponsor approval and positive value for native funding", async function () {
        const [owner, sponsor, other] = await ethers.getSigners();
        const Pilgrimage = await ethers.getContractFactory("DecentPilgrimageBaseV1");
        const pilgrimage = await Pilgrimage.deploy("Native funding checks", owner.address);

        await expect(pilgrimage.connect(other).fundNative({ value: 1n }))
            .to.be.revertedWith("Sponsor is not approved");
        await pilgrimage.setSponsor(sponsor.address, true);
        await expect(pilgrimage.connect(sponsor).fundNative())
            .to.be.revertedWith("Amount is zero");
        await pilgrimage.connect(sponsor).fundNative({ value: 5n });
        expect(await pilgrimage.accountedBalance(ethers.ZeroAddress)).to.equal(5n);
        expect(await ethers.provider.getBalance(await pilgrimage.getAddress())).to.equal(5n);
    });

    it("blocks reentrant native claims while completing the approved transfer", async function () {
        const { sponsor, pilgrimage, locationId } = await deployFixture();
        const Receiver = await ethers.getContractFactory("ReenteringNativeClaimReceiver");
        const receiver = await Receiver.deploy();
        const native = ethers.ZeroAddress;
        const pilgrimageAddress = await pilgrimage.getAddress();

        await pilgrimage.connect(sponsor).fundNative({ value: 100n });
        await pilgrimage.addAllocation(locationId, native, 50n);
        await pilgrimage.approveClaim(locationId, native, await receiver.getAddress(), 20n);
        await receiver.claim(pilgrimageAddress, locationId);

        expect(await ethers.provider.getBalance(await receiver.getAddress())).to.equal(20n);
        expect(await receiver.reentrySucceeded()).to.equal(false);
        expect(await pilgrimage.hasClaimed(locationId, native, await receiver.getAddress())).to.equal(true);
        expect(await pilgrimage.accountedBalance(native)).to.equal(80n);
        expect(await pilgrimage.totalAllocated(native)).to.equal(30n);
    });
});
