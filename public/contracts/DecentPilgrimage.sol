// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DecentPilgrimage {
    struct TokenDetails {
        address tokenAddress;
        uint256 amount;
    }

    struct Location {
        string name;
        int256 lat; // Latitude in microdegrees (1 degree = 10^6 microdegrees, can be negative)
        int256 lng; // Longitude in microdegrees (can be negative)
        uint256 radius; // Radius in meters
        TokenDetails[] tokens; // List of tokens and their amounts
        string mission; // Mission object note
        bool active; // Whether the location is active
        address addedBy; // Address of the user who added this location
    }

    address public owner;
    string public pilgrimageName; // Name of the pilgrimage
    mapping(address => bool) public whitelist; // Participants whitelist
    mapping(address => bool) public sponsorWhitelist; // Sponsors whitelist
    mapping(uint256 => Location) public locations;
    mapping(address => uint256) public sponsorBalances; // Token address => balance
    uint256 public locationCount;

    // New state variables for sponsor iteration
    address[] public whitelistedSponsors;
    mapping(address => bool) internal isSponsorAdded;

    // New state variables for tracking collected tokens per participant
    mapping(address => mapping(address => uint256)) public collectedTokens; // participant => (tokenAddress => amount)
    mapping(address => address[]) private participantTokenAddresses; // participant => list of token addresses collected

    event TokensLocked(address indexed tokenAddress, uint256 totalTokens);
    event TokensClaimed(
        address indexed claimant,
        uint256 locationId,
        string locationName,
        address tokenAddress,
        uint256 amount,
        uint256 timestamp
    );
    event LocationAdded(
        uint256 locationId,
        string name,
        int256 lat,
        int256 lng,
        uint256 radius,
        string mission
    );
    event LocationRemoved(uint256 locationId, string name, address removedBy);
    event TokensWithdrawn(address indexed tokenAddress, uint256 amount, uint256 timestamp);
    event SponsorTokensAdded(address indexed sponsor, address tokenAddress, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action");
        _;
    }

    modifier onlyWhitelistedSponsor() {
        require(sponsorWhitelist[msg.sender], "You are not a whitelisted sponsor");
        _;
    }

    constructor(string memory _name) {
        owner = msg.sender;
        pilgrimageName = _name;
    }

    // Lock initial tokens into the contract
    function lockTokens(address tokenAddress, uint256 totalTokens) external onlyOwner {
        require(totalTokens > 0, "Token amount must be greater than 0");
        require(IERC20(tokenAddress).transferFrom(msg.sender, address(this), totalTokens), "Token transfer failed");

        sponsorBalances[tokenAddress] += totalTokens;
        emit TokensLocked(tokenAddress, totalTokens);
    }

    // Add a new sponsor's token (restricted to whitelisted sponsors)
    function addSponsorTokens(address tokenAddress, uint256 amount) external onlyWhitelistedSponsor {
        require(amount > 0, "Token amount must be greater than 0");
        require(IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount), "Token transfer failed");

        sponsorBalances[tokenAddress] += amount;
        emit SponsorTokensAdded(msg.sender, tokenAddress, amount);
    }

    // Add a new location (Owner or Whitelisted Sponsor)
    function addLocation(
        string memory name,
        int256 lat,
        int256 lng,
        uint256 radius,
        TokenDetails[] memory tokens,
        string memory mission
    ) external {
        // Ensure only owner or whitelisted sponsor can add a location
        if (msg.sender != owner) {
            require(sponsorWhitelist[msg.sender], "You are not a whitelisted sponsor");
        }

        require(tokens.length > 0, "At least one token must be provided");

        // Create a new location in storage
        Location storage newLocation = locations[locationCount];
        newLocation.name = name;
        newLocation.lat = lat;
        newLocation.lng = lng;
        newLocation.radius = radius;
        newLocation.mission = mission;
        newLocation.active = true;
        newLocation.addedBy = msg.sender;

        // Deduct tokens and add them to the location's tokens array
        for (uint256 i = 0; i < tokens.length; i++) {
            TokenDetails memory token = tokens[i];

            require(token.amount > 0, "Token amount must be greater than 0");
            require(
                sponsorBalances[token.tokenAddress] >= token.amount,
                "Insufficient sponsor token balance"
            );

            sponsorBalances[token.tokenAddress] -= token.amount;

            // Manually push each token into the storage array
            newLocation.tokens.push(TokenDetails({
                tokenAddress: token.tokenAddress,
                amount: token.amount
            }));
        }

        emit LocationAdded(locationCount, name, lat, lng, radius, mission);
        locationCount++;
    }

    // Remove a location and recover tokens
    function removeLocation(uint256 locationId) external {
        Location storage location = locations[locationId];
        require(location.active, "Location is not active or already removed");
        require(msg.sender == location.addedBy || msg.sender == owner, "You are not authorized to remove this location");

        // Recover all tokens from the location
        for (uint256 i = 0; i < location.tokens.length; i++) {
            TokenDetails storage tokenDetails = location.tokens[i];
            sponsorBalances[tokenDetails.tokenAddress] += tokenDetails.amount;
        }

        location.active = false; // Mark the location as inactive

        emit LocationRemoved(locationId, location.name, msg.sender);
    }

    // Whitelist a participant
    function whitelistAddress(address participant) external onlyOwner {
        whitelist[participant] = true;
    }

    // Remove a participant from the whitelist (only owner can do this)
    function removeWhitelisted(address participant) external onlyOwner {
        whitelist[participant] = false;
    }

    // Whitelist a sponsor
    function whitelistSponsor(address sponsor) external onlyOwner {
        sponsorWhitelist[sponsor] = true;
        if (!isSponsorAdded[sponsor]) {
            whitelistedSponsors.push(sponsor);
            isSponsorAdded[sponsor] = true;
        }
    }

    // Remove a sponsor from the whitelist
    function removeSponsor(address sponsor) external onlyOwner {
        sponsorWhitelist[sponsor] = false;
        if (isSponsorAdded[sponsor]) {
            for (uint256 i = 0; i < whitelistedSponsors.length; i++) {
                if (whitelistedSponsors[i] == sponsor) {
                    whitelistedSponsors[i] = whitelistedSponsors[whitelistedSponsors.length - 1];
                    whitelistedSponsors.pop();
                    break;
                }
            }
            isSponsorAdded[sponsor] = false;
        }
    }

    // Get the list of whitelisted sponsors
    function getWhitelistedSponsors() external view returns (address[] memory) {
        return whitelistedSponsors;
    }

    // Claim all tokens at a location
    function claimTokens(uint256 locationId) external {
        require(whitelist[msg.sender], "You are not whitelisted");
        Location storage location = locations[locationId];
        require(location.active, "Location is not active");
        require(location.tokens.length > 0, "No tokens available at this location");

        for (uint256 i = 0; i < location.tokens.length; i++) {
            TokenDetails storage tokenDetails = location.tokens[i];
            require(tokenDetails.amount > 0, "No tokens left to claim for this token");

            uint256 claimAmount = tokenDetails.amount;
            if (collectedTokens[msg.sender][tokenDetails.tokenAddress] == 0) {
                participantTokenAddresses[msg.sender].push(tokenDetails.tokenAddress);
            }
            collectedTokens[msg.sender][tokenDetails.tokenAddress] += claimAmount;
            tokenDetails.amount = 0; // Set token amount to zero after claiming

            require(IERC20(tokenDetails.tokenAddress).transfer(msg.sender, claimAmount), "Token transfer failed");
            emit TokensClaimed(
                msg.sender,
                locationId,
                location.name,
                tokenDetails.tokenAddress,
                claimAmount,
                block.timestamp
            );
        }

        // Deactivate the location after all tokens are claimed
        location.active = false;
    }

    // Get collected tokens for a participant
    function getCollectedTokens(address participant) external view returns (TokenDetails[] memory) {
        uint256 len = participantTokenAddresses[participant].length;
        TokenDetails[] memory tokens = new TokenDetails[](len);
        for (uint256 i = 0; i < len; i++) {
            address tokenAddr = participantTokenAddresses[participant][i];
            tokens[i] = TokenDetails(tokenAddr, collectedTokens[participant][tokenAddr]);
        }
        return tokens;
    }

    // Withdraw unclaimed tokens (only owner can withdraw)
    function withdrawUnusedTokens(address tokenAddress, uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(sponsorBalances[tokenAddress] >= amount, "Insufficient token balance");

        sponsorBalances[tokenAddress] -= amount;

        require(IERC20(tokenAddress).transfer(owner, amount), "Token transfer failed");
        emit TokensWithdrawn(tokenAddress, amount, block.timestamp);
    }
}