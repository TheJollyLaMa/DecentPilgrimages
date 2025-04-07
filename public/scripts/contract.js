let registryABI, pilgrimageABI;

const CONTRACT_ADDRESSES = {
    registry: "0x4a50bbf238279E7F816Ef0Eaf523ae27962EC5E2",
    pilgrimage: "0x8FD1A345F65D27a3c360933e38CC653E0dE37CC1" //  1st try Doobetter Does the East Coast - "0x396e0e11E26A3aCfF7BAcBe9d5943b6b4fdD181d",
};

let registryContract, pilgrimageContract;
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function allowance(address owner, address spender) public view returns (uint256)"
];

async function loadABIs() {
    try {
        const registryResponse = await fetch("./abis/DecentPilgrimagesRegistry.json");
        if (!registryResponse.ok) throw new Error("Failed to load DecentPilgrimagesRegistry ABI");
        registryABI = await registryResponse.json();

        const pilgrimageResponse = await fetch("./abis/DecentPilgrimage_v0.2.json");
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
        const name = await window.pilgrimageContract.pilgrimageName();
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
        const tx = await window.pilgrimageContract.addLocation(name, lat, lng, radius, tokens, mission);
        await tx.wait();
        console.log("Location added successfully:", tx);
    } catch (error) {
        console.error("Error adding location:", error);
    }
}

// Claim tokens at a location
export async function claimTokens(locationId) {
    try {
        const tx = await window.pilgrimageContract.claimTokens(locationId);
        await tx.wait();
        console.log(`Tokens claimed at location ${locationId}:`, tx);
    } catch (error) {
        console.error(`Error claiming tokens at location ${locationId}:`, error);
    }
}

// Fetch all locations
export async function fetchLocations() {
    try {
        const locationCount = await window.pilgrimageContract.locationCount();
        const locations = [];

        for (let i = 0; i < locationCount; i++) {
            const location = await window.pilgrimageContract.locations(i);

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
                lat: parseFloat(location.lat) / 1e6,
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
        // Convert the human-friendly amount to the correct 18-decimal BigNumber
        const parsedAmount = ethers.utils.parseUnits(amount.toString(), 18);

        // Create a new instance of the ERC20 token contract using the minimal ABI
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

        // Approve the pilgrimage contract to spend the specified amount of tokens
        const approveTx = await tokenContract.approve(window.pilgrimageContract.address, parsedAmount);
        await approveTx.wait();
        console.log(`Approved ${parsedAmount.toString()} tokens for contract ${window.pilgrimageContract.address} on token ${tokenAddress}`);

        // Now add the sponsor tokens to the pilgrimage
        const tx = await window.pilgrimageContract.addSponsorTokens(tokenAddress, parsedAmount);
        await tx.wait();
        console.log("Sponsor tokens added:", tx);
    } catch (error) {
        console.error("Error adding sponsor tokens:", error);
    }
}

// Withdraw unused tokens
export async function withdrawTokens(tokenAddress, amount) {
    try {
        const tx = await window.pilgrimageContract.withdrawUnusedTokens(tokenAddress, amount);
        await tx.wait();
        console.log("Tokens withdrawn:", tx);
    } catch (error) {
        console.error("Error withdrawing tokens:", error);
    }
}

// Lock tokens into the pilgrimage
export async function lockTokens(tokenAddress, amount) {
    try {
        const tx = await window.pilgrimageContract.lockTokens(tokenAddress, amount);
        await tx.wait();
        console.log("Tokens locked:", tx);
    } catch (error) {
        console.error("Error locking tokens:", error);
    }
}

// Whitelist a participant
export async function whitelistParticipant(address) {
    try {
        const tx = await window.pilgrimageContract.whitelistAddress(address);
        await tx.wait();
        console.log("Participant whitelisted:", tx);
    } catch (error) {
        console.error("Error whitelisting participant:", error);
    }
}

// Remove a participant from the whitelist
export async function removeParticipantFromWhitelist(address) {
    try {
        const tx = await window.pilgrimageContract.removeWhitelisted(address);
        await tx.wait();
        console.log("Participant removed from whitelist:", tx);
    } catch (error) {
        console.error("Error removing participant from whitelist:", error);
    }
}

// Whitelist a sponsor
export async function whitelistSponsor(address) {
    try {
        const tx = await window.pilgrimageContract.whitelistSponsor(address);
        await tx.wait();
        console.log("Sponsor whitelisted:", tx);
    } catch (error) {
        console.error("Error whitelisting sponsor:", error);
    }
}

// Remove a sponsor from the whitelist
export async function removeSponsorFromWhitelist(address) {
    try {
        const tx = await window.pilgrimageContract.removeSponsor(address);
        await tx.wait();
        console.log("Sponsor removed from whitelist:", tx);
    } catch (error) {
        console.error("Error removing sponsor from whitelist:", error);
    }
}

// Fetch sponsors and their token balances using the new getWhitelistedSponsors function
export async function fetchSponsors() {
    console.log("Pilgrimage Contract: ", window.pilgrimageContract);
    try {
        const sponsors = await window.pilgrimageContract.getWhitelistedSponsors();
        const sponsorList = [];
        for (const sponsor of sponsors) {
            const balance = await window.pilgrimageContract.sponsorBalances(sponsor);
            sponsorList.push({
                sponsorAddress: sponsor,
                balance: balance.toString(),
            });
        }
        console.log("Sponsors and balances fetched:", sponsorList);
        return sponsorList;
    } catch (error) {
        console.error("Error fetching sponsors and balances:", error);
        return [];
    }
}

// Fetch tokens collected by a specific wallet using the new getCollectedTokens function
export async function fetchCollectedTokens(walletAddress) {
    try {
        const tokens = await window.pilgrimageContract.getCollectedTokens(walletAddress);
        const tokenList = tokens.map(token => ({
            tokenAddress: token.tokenAddress,
            amount: token.amount.toString(),
        }));
        console.log(`Tokens collected by ${walletAddress}:`, tokenList);
        return tokenList;
    } catch (error) {
        console.error("Error fetching collected tokens:", error);
        return [];
    }
}