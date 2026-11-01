// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DecentPilgrimageBaseV1 is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Location {
        string name;
        int256 latitudeMicrodegrees;
        int256 longitudeMicrodegrees;
        uint256 radiusMeters;
        string mission;
        bool active;
        address addedBy;
    }

    string public pilgrimageName;
    uint256 public locationCount;

    mapping(uint256 locationId => Location) private _locations;
    mapping(address token => bool) public approvedSponsors;
    mapping(address token => uint256) public accountedBalance;
    mapping(address token => uint256) public totalAllocated;
    mapping(uint256 locationId => mapping(address token => uint256)) public allocationRemaining;
    mapping(uint256 locationId => address[]) private _locationTokens;
    mapping(uint256 locationId => mapping(address token => bool)) private _locationTokenListed;
    mapping(uint256 locationId => mapping(address token => uint256)) public pendingApprovalCount;
    mapping(uint256 locationId => mapping(address token => uint256)) public pendingApprovedAmount;
    mapping(uint256 locationId => mapping(address token => mapping(address participant => uint256)))
        public approvedClaimAmount;
    mapping(uint256 locationId => mapping(address token => mapping(address participant => bool)))
        public hasClaimed;

    event SponsorStatusChanged(address indexed sponsor, bool approved);
    event TokensFunded(address indexed sponsor, address indexed token, uint256 amount);
    event LocationCreated(uint256 indexed locationId, string name, address indexed addedBy);
    event LocationStatusChanged(uint256 indexed locationId, bool active);
    event AllocationAdded(uint256 indexed locationId, address indexed token, uint256 amount);
    event AllocationReleased(uint256 indexed locationId, address indexed token, uint256 amount);
    event ClaimApproved(
        uint256 indexed locationId,
        address indexed token,
        address indexed participant,
        uint256 amount
    );
    event ClaimApprovalCancelled(
        uint256 indexed locationId,
        address indexed token,
        address indexed participant,
        uint256 amount
    );
    event ClaimPaid(
        uint256 indexed locationId,
        address indexed token,
        address indexed participant,
        uint256 amount
    );
    event TokensRecovered(address indexed token, address indexed recipient, uint256 amount);

    constructor(string memory name_, address initialOwner) Ownable(initialOwner) {
        pilgrimageName = name_;
    }

    function setSponsor(address sponsor, bool approved) external onlyOwner {
        require(sponsor != address(0), "Sponsor is zero address");
        approvedSponsors[sponsor] = approved;
        emit SponsorStatusChanged(sponsor, approved);
    }

    function fundToken(address token, uint256 amount) external nonReentrant {
        require(approvedSponsors[msg.sender], "Sponsor is not approved");
        require(token != address(0) && token.code.length != 0, "Invalid token");
        require(amount != 0, "Amount is zero");

        IERC20 erc20 = IERC20(token);
        uint256 balanceBefore = erc20.balanceOf(address(this));
        erc20.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = erc20.balanceOf(address(this)) - balanceBefore;
        require(received == amount, "Token must transfer exact amount");

        accountedBalance[token] += received;
        emit TokensFunded(msg.sender, token, received);
    }

    function fundNative() external payable nonReentrant {
        require(approvedSponsors[msg.sender], "Sponsor is not approved");
        require(msg.value != 0, "Amount is zero");

        accountedBalance[address(0)] += msg.value;
        emit TokensFunded(msg.sender, address(0), msg.value);
    }

    function createLocation(
        string calldata name_,
        int256 latitudeMicrodegrees,
        int256 longitudeMicrodegrees,
        uint256 radiusMeters,
        string calldata mission
    ) external onlyOwner returns (uint256 locationId) {
        require(
            latitudeMicrodegrees >= -90_000_000 && latitudeMicrodegrees <= 90_000_000,
            "Invalid latitude"
        );
        require(
            longitudeMicrodegrees >= -180_000_000 && longitudeMicrodegrees <= 180_000_000,
            "Invalid longitude"
        );
        locationId = locationCount++;
        _locations[locationId] = Location({
            name: name_,
            latitudeMicrodegrees: latitudeMicrodegrees,
            longitudeMicrodegrees: longitudeMicrodegrees,
            radiusMeters: radiusMeters,
            mission: mission,
            active: true,
            addedBy: msg.sender
        });
        emit LocationCreated(locationId, name_, msg.sender);
    }

    function getLocation(uint256 locationId) external view returns (Location memory) {
        _requireLocation(locationId);
        return _locations[locationId];
    }

    function getLocationTokens(uint256 locationId) external view returns (address[] memory) {
        _requireLocation(locationId);
        return _locationTokens[locationId];
    }

    function setLocationActive(uint256 locationId, bool active) external onlyOwner {
        _requireLocation(locationId);
        _locations[locationId].active = active;
        emit LocationStatusChanged(locationId, active);
    }

    function addAllocation(uint256 locationId, address token, uint256 amount) external onlyOwner {
        _requireLocation(locationId);
        require(_locations[locationId].active, "Location is inactive");
        require(token == address(0) || token.code.length != 0, "Invalid token");
        require(amount != 0, "Amount is zero");

        uint256 available = accountedBalance[token] - totalAllocated[token];
        require(amount <= available, "Insufficient unallocated balance");

        if (!_locationTokenListed[locationId][token]) {
            _locationTokenListed[locationId][token] = true;
            _locationTokens[locationId].push(token);
        }
        allocationRemaining[locationId][token] += amount;
        totalAllocated[token] += amount;
        emit AllocationAdded(locationId, token, amount);
    }

    function releaseAllocation(uint256 locationId, address token, uint256 amount) external onlyOwner {
        _requireLocation(locationId);
        require(amount != 0, "Amount is zero");
        require(pendingApprovalCount[locationId][token] == 0, "Pending approvals exist");

        uint256 remaining = allocationRemaining[locationId][token];
        require(amount <= remaining, "Amount exceeds allocation");
        allocationRemaining[locationId][token] = remaining - amount;
        totalAllocated[token] -= amount;
        emit AllocationReleased(locationId, token, amount);
    }

    function approveClaim(
        uint256 locationId,
        address token,
        address participant,
        uint256 amount
    ) external onlyOwner {
        _requireLocation(locationId);
        require(_locations[locationId].active, "Location is inactive");
        require(participant != address(0), "Participant is zero address");
        require(amount != 0, "Amount is zero");
        require(!hasClaimed[locationId][token][participant], "Claim already paid");

        uint256 previousApproval = approvedClaimAmount[locationId][token][participant];
        uint256 pendingAfterUpdate =
            pendingApprovedAmount[locationId][token] - previousApproval + amount;
        require(
            pendingAfterUpdate <= allocationRemaining[locationId][token],
            "Approvals exceed allocation"
        );

        if (previousApproval == 0) {
            pendingApprovalCount[locationId][token] += 1;
        }
        pendingApprovedAmount[locationId][token] = pendingAfterUpdate;
        approvedClaimAmount[locationId][token][participant] = amount;
        emit ClaimApproved(locationId, token, participant, amount);
    }

    function cancelClaimApproval(
        uint256 locationId,
        address token,
        address participant
    ) external onlyOwner {
        _requireLocation(locationId);
        uint256 amount = approvedClaimAmount[locationId][token][participant];
        require(amount != 0, "No pending approval");

        approvedClaimAmount[locationId][token][participant] = 0;
        pendingApprovedAmount[locationId][token] -= amount;
        pendingApprovalCount[locationId][token] -= 1;
        emit ClaimApprovalCancelled(locationId, token, participant, amount);
    }

    function claim(uint256 locationId, address token) external nonReentrant {
        _requireLocation(locationId);
        require(_locations[locationId].active, "Location is inactive");
        require(!hasClaimed[locationId][token][msg.sender], "Claim already paid");

        uint256 amount = approvedClaimAmount[locationId][token][msg.sender];
        require(amount != 0, "No approved claim");

        hasClaimed[locationId][token][msg.sender] = true;
        approvedClaimAmount[locationId][token][msg.sender] = 0;
        pendingApprovedAmount[locationId][token] -= amount;
        pendingApprovalCount[locationId][token] -= 1;
        allocationRemaining[locationId][token] -= amount;
        totalAllocated[token] -= amount;
        accountedBalance[token] -= amount;

        if (token == address(0)) {
            _transferNative(msg.sender, amount);
        } else {
            _transferExact(token, msg.sender, amount);
        }
        emit ClaimPaid(locationId, token, msg.sender, amount);
    }

    function recoverToken(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
        require(recipient != address(0), "Recipient is zero address");
        require(recipient != address(this), "Recipient is contract");
        require(amount != 0, "Amount is zero");

        uint256 unallocated = accountedBalance[token] - totalAllocated[token];
        require(amount <= unallocated, "Amount exceeds unallocated balance");
        accountedBalance[token] -= amount;
        if (token == address(0)) {
            _transferNative(recipient, amount);
        } else {
            _transferExact(token, recipient, amount);
        }
        emit TokensRecovered(token, recipient, amount);
    }

    function _transferNative(address recipient, uint256 amount) private {
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Native transfer failed");
    }

    function _transferExact(address token, address recipient, uint256 amount) private {
        IERC20 erc20 = IERC20(token);
        uint256 contractBalanceBefore = erc20.balanceOf(address(this));
        uint256 recipientBalanceBefore = erc20.balanceOf(recipient);
        erc20.safeTransfer(recipient, amount);
        uint256 contractBalanceAfter = erc20.balanceOf(address(this));
        uint256 recipientBalanceAfter = erc20.balanceOf(recipient);

        require(
            contractBalanceBefore >= contractBalanceAfter
                && contractBalanceBefore - contractBalanceAfter == amount
                && recipientBalanceAfter >= recipientBalanceBefore
                && recipientBalanceAfter - recipientBalanceBefore == amount,
            "Token must transfer exact amount"
        );
    }

    function _requireLocation(uint256 locationId) private view {
        require(locationId < locationCount, "Unknown location");
    }
}
