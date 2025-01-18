let registryABI, pilgrimageABI;

const CONTRACT_ADDRESSES = {
    registry: "0x4a50bbf238279E7F816Ef0Eaf523ae27962EC5E2",
    pilgrimage: "0x396e0e11E26A3aCfF7BAcBe9d5943b6b4fdD181d",
};

let registryContract, pilgrimageContract;

async function loadABIs() {
    try {
        const registryResponse = await fetch("./abis/DecentPilgrimagesRegistry.json");
        if (!registryResponse.ok) throw new Error("Failed to load DecentPilgrimagesRegistry ABI");
        registryABI = await registryResponse.json();

        const pilgrimageResponse = await fetch("./abis/DecentPilgrimage.json");
        if (!pilgrimageResponse.ok) throw new Error("Failed to load DecentPilgrimage ABI");
        pilgrimageABI = await pilgrimageResponse.json();

        console.log("ABIs loaded successfully");
    } catch (error) {
        console.error("Error loading ABIs:", error);
    }
}

export async function connectContracts() {
    try {
        // Ensure ABIs are loaded
        await loadABIs();

        // Validate ABIs
        if (!registryABI || !pilgrimageABI) {
            throw new Error("ABIs are not loaded properly.");
        }

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();

        // Validate CONTRACT_ADDRESSES
        if (!CONTRACT_ADDRESSES.registry || !CONTRACT_ADDRESSES.pilgrimage) {
            throw new Error("Contract addresses are missing or invalid.");
        }

        // Initialize contracts
        window.registryContract = new ethers.Contract(
            CONTRACT_ADDRESSES.registry,
            registryABI,
            signer
        );

        window.pilgrimageContract = new ethers.Contract(
            CONTRACT_ADDRESSES.pilgrimage,
            pilgrimageABI,
            signer
        );

        // Validate initialized contracts
        if (!window.registryContract.address || !window.pilgrimageContract.address) {
            throw new Error("Failed to initialize contracts.");
        }

        console.log("Connected to contracts:", {
            registry: window.registryContract.address,
            pilgrimage: window.pilgrimageContract.address,
        });

        return { registryContract: window.registryContract, pilgrimageContract: window.pilgrimageContract };
    } catch (error) {
        console.error("Error connecting to contracts:", error);
        return null;
    }
}

// Fetch the pilgrimage name
export async function fetchPilgrimageName() {
    try {
        const name = await pilgrimageContract.pilgrimageName();
        console.log("Pilgrimage Name:", name);
        return name;
    } catch (error) {
        console.error("Error fetching pilgrimage name:", error);
        return null;
    }
}

// Add a location to the pilgrimage
export async function addLocation(name, lat, lng, radius, tokens, mission) {
    try {
        const tx = await pilgrimageContract.addLocation(name, lat, lng, radius, tokens, mission);
        await tx.wait();
        console.log("Location added successfully:", tx);
    } catch (error) {
        console.error("Error adding location:", error);
    }
}

// Claim tokens at a location
export async function claimTokens(locationId) {
    try {
        const tx = await pilgrimageContract.claimTokens(locationId);
        await tx.wait();
        console.log(`Tokens claimed at location ${locationId}:`, tx);
    } catch (error) {
        console.error(`Error claiming tokens at location ${locationId}:`, error);
    }
}

// Fetch all locations
export async function fetchLocations() {
    try {
        const locationCount = await pilgrimageContract.locationCount();
        const locations = [];

        for (let i = 0; i < locationCount; i++) {
            const location = await pilgrimageContract.locations(i);

            // Decode location tokens
            const tokens = [];
            for (let j = 0; j < location.tokens.length; j++) {
                tokens.push({
                    tokenAddress: location.tokens[j].tokenAddress,
                    amount: location.tokens[j].amount.toString(),
                });
            }

            locations.push({
                id: i,
                name: location.name,
                lat: parseFloat(location.lat) / 1e6, // Convert microdegrees to degrees
                lng: parseFloat(location.lng) / 1e6,
                radius: location.radius,
                tokens,
                mission: location.mission,
                active: location.active,
            });
        }

        console.log("Fetched locations:", locations);
        return locations;
    } catch (error) {
        console.error("Error fetching locations:", error);
        return [];
    }
}

// Add sponsor tokens
export async function addSponsorTokens(tokenAddress, amount) {
    try {
        const tx = await pilgrimageContract.addSponsorTokens(tokenAddress, amount);
        await tx.wait();
        console.log("Sponsor tokens added:", tx);
    } catch (error) {
        console.error("Error adding sponsor tokens:", error);
    }
}

// Withdraw unused tokens
export async function withdrawTokens(tokenAddress, amount) {
    try {
        const tx = await pilgrimageContract.withdrawUnusedTokens(tokenAddress, amount);
        await tx.wait();
        console.log("Tokens withdrawn:", tx);
    } catch (error) {
        console.error("Error withdrawing tokens:", error);
    }
}

// Lock tokens into the pilgrimage
export async function lockTokens(tokenAddress, amount) {
    try {
        const tx = await pilgrimageContract.lockTokens(tokenAddress, amount);
        await tx.wait();
        console.log("Tokens locked:", tx);
    } catch (error) {
        console.error("Error locking tokens:", error);
    }
}

// Whitelist a participant
export async function whitelistParticipant(address) {
    try {
        const tx = await pilgrimageContract.whitelistAddress(address);
        await tx.wait();
        console.log("Participant whitelisted:", tx);
    } catch (error) {
        console.error("Error whitelisting participant:", error);
    }
}

// Remove a participant from the whitelist
export async function removeParticipantFromWhitelist(address) {
    try {
        const tx = await pilgrimageContract.removeWhitelisted(address);
        await tx.wait();
        console.log("Participant removed from whitelist:", tx);
    } catch (error) {
        console.error("Error removing participant from whitelist:", error);
    }
}

// Whitelist a sponsor
export async function whitelistSponsor(address) {
    try {
        const tx = await pilgrimageContract.whitelistSponsor(address);
        await tx.wait();
        console.log("Sponsor whitelisted:", tx);
    } catch (error) {
        console.error("Error whitelisting sponsor:", error);
    }
}

// Remove a sponsor from the whitelist
export async function removeSponsorFromWhitelist(address) {
    try {
        const tx = await pilgrimageContract.removeSponsor(address);
        await tx.wait();
        console.log("Sponsor removed from whitelist:", tx);
    } catch (error) {
        console.error("Error removing sponsor from whitelist:", error);
    }
}

// Fetch sponsors and their token balances
export async function fetchSponsors() {
    try {
        const sponsorWhitelist = await pilgrimageContract.sponsorWhitelist();
        const sponsors = [];

        for (const sponsor of Object.keys(sponsorWhitelist)) {
            if (sponsorWhitelist[sponsor]) {
                const balance = await pilgrimageContract.sponsorBalances(sponsor);
                sponsors.push({
                    sponsorAddress: sponsor,
                    balance: balance.toString(),
                });
            }
        }

        console.log("Sponsors and balances fetched:", sponsors);
        return sponsors;
    } catch (error) {
        console.error("Error fetching sponsors and balances:", error);
        return [];
    }
}

// Fetch tokens collected by a specific wallet
export async function fetchCollectedTokens(walletAddress) {
    try {
        const collectedTokens = await pilgrimageContract.getCollectedTokens(walletAddress);
        console.log(`Tokens collected by ${walletAddress}:`, collectedTokens);
        return collectedTokens;
    } catch (error) {
        console.error("Error fetching collected tokens:", error);
        return [];
    }
}