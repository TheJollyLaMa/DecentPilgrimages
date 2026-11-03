// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @notice Experimental, undeployed basket escrow. A trusted verifier attests visits;
/// neither metadata, an NFT nor browser GPS proves physical presence.
contract DecentPilgrimageGateV2 is Ownable2Step, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    enum Mode { PerParticipant, FirstCollector }
    enum VisitMethod { Video, Knowledge }
    struct GateInput {
        int32 latitudeMicrodegrees;
        int32 longitudeMicrodegrees;
        uint32 radiusMeters;
        uint64 expiresAt;
        Mode mode;
        VisitMethod method;
        address verifier;
        bytes32 metadataHash;
        string metadataURI;
    }
    struct Gate {
        address sponsor;
        GateInput terms;
        uint32 remainingCollections;
        bool refunded;
    }
    struct Asset {
        address token;
        uint256 amountPerCollection;
    }

    bytes32 public constant VISIT_TYPEHASH = keccak256(
        "Visit(uint256 gateId,address participant,bytes32 metadataHash,uint8 method,uint64 issuedAt,uint64 validUntil)"
    );
    uint256 public gateCount;
    mapping(address => bool) public approvedSponsors;
    mapping(uint256 => Gate) private _gates;
    mapping(uint256 => Asset[]) private _assets;
    mapping(uint256 => mapping(address => bool)) public whitelisted;
    mapping(uint256 => mapping(address => bool)) public collected;
    mapping(address => uint256) public reserved;

    event SponsorSet(address indexed sponsor, bool approved);
    event GateCreated(uint256 indexed gateId, address indexed sponsor, bytes32 indexed metadataHash, uint32 collections);
    event ParticipantAllowed(uint256 indexed gateId, address indexed participant);
    event BasketCollected(uint256 indexed gateId, address indexed participant, bytes32 indexed metadataHash);
    event AssetTransferred(uint256 indexed gateId, address indexed participant, address indexed token, uint256 amount);
    event GateRefunded(uint256 indexed gateId, address indexed sponsor, uint32 unusedCollections);

    constructor(address initialOwner) Ownable(initialOwner) EIP712("DecentPilgrimageGate", "2") {}

    function setSponsor(address sponsor, bool approved) external onlyOwner {
        require(sponsor != address(0), "Zero sponsor");
        approvedSponsors[sponsor] = approved;
        emit SponsorSet(sponsor, approved);
    }

    function createGate(GateInput calldata terms, Asset[] calldata assets, address[] calldata participants)
        external payable nonReentrant returns (uint256 gateId)
    {
        require(approvedSponsors[msg.sender], "Sponsor not approved");
        require(terms.latitudeMicrodegrees >= -90_000_000 && terms.latitudeMicrodegrees <= 90_000_000, "Invalid latitude");
        require(terms.longitudeMicrodegrees >= -180_000_000 && terms.longitudeMicrodegrees <= 180_000_000, "Invalid longitude");
        require(terms.radiusMeters >= 5 && terms.radiusMeters <= 10_000, "Invalid radius");
        require(terms.expiresAt > block.timestamp && terms.expiresAt <= block.timestamp + 366 days, "Invalid expiry");
        require(terms.verifier != address(0) && terms.metadataHash != bytes32(0), "Missing verifier or metadata");
        require(bytes(terms.metadataURI).length > 7 && bytes(terms.metadataURI).length <= 256, "Invalid metadata URI");
        require(bytes(terms.metadataURI)[0] == "i" && bytes(terms.metadataURI)[1] == "p"
            && bytes(terms.metadataURI)[2] == "f" && bytes(terms.metadataURI)[3] == "s"
            && bytes(terms.metadataURI)[4] == ":" && bytes(terms.metadataURI)[5] == "/"
            && bytes(terms.metadataURI)[6] == "/", "Use IPFS metadata");
        require(assets.length > 0 && assets.length <= 8 && participants.length > 0 && participants.length <= 100, "Invalid basket or whitelist size");
        gateId = gateCount++;
        uint32 slots = terms.mode == Mode.PerParticipant ? uint32(participants.length) : 1;
        _gates[gateId] = Gate(msg.sender, terms, slots, false);
        for (uint256 i; i < participants.length; i++) {
            address participant = participants[i];
            require(participant != address(0) && !whitelisted[gateId][participant], "Invalid or duplicate participant");
            whitelisted[gateId][participant] = true;
            emit ParticipantAllowed(gateId, participant);
        }
        uint256 expectedNative;
        for (uint256 i; i < assets.length; i++) {
            Asset calldata asset = assets[i];
            require(asset.amountPerCollection > 0, "Zero asset amount");
            for (uint256 j; j < i; j++) require(assets[j].token != asset.token, "Duplicate asset");
            uint256 amount = asset.amountPerCollection * slots;
            _assets[gateId].push(asset);
            reserved[asset.token] += amount;
            if (asset.token == address(0)) expectedNative = amount;
            else {
                require(asset.token.code.length > 0, "Invalid token");
                IERC20 token = IERC20(asset.token);
                uint256 beforeBalance = token.balanceOf(address(this));
                token.safeTransferFrom(msg.sender, address(this), amount);
                require(token.balanceOf(address(this)) - beforeBalance == amount, "Inexact funding");
            }
        }
        require(msg.value == expectedNative, "Incorrect native funding");
        emit GateCreated(gateId, msg.sender, terms.metadataHash, slots);
    }

    function getGate(uint256 gateId) external view returns (Gate memory gate, Asset[] memory assets) {
        require(gateId < gateCount, "Unknown gate");
        return (_gates[gateId], _assets[gateId]);
    }

    function collect(uint256 gateId, uint64 issuedAt, uint64 validUntil, bytes calldata authorization) external nonReentrant {
        require(gateId < gateCount, "Unknown gate");
        Gate storage gate = _gates[gateId];
        require(block.timestamp < gate.terms.expiresAt && !gate.refunded && gate.remainingCollections > 0, "Gate closed");
        require(whitelisted[gateId][msg.sender] && !collected[gateId][msg.sender], "Participant not eligible");
        require(issuedAt <= block.timestamp && validUntil >= block.timestamp && validUntil > issuedAt && validUntil - issuedAt <= 10 minutes
            && validUntil <= gate.terms.expiresAt, "Invalid visit deadline");
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            VISIT_TYPEHASH, gateId, msg.sender, gate.terms.metadataHash, uint8(gate.terms.method), issuedAt, validUntil
        )));
        require(SignatureChecker.isValidSignatureNow(gate.terms.verifier, digest, authorization), "Invalid visit authorization");
        collected[gateId][msg.sender] = true;
        gate.remainingCollections--;
        _transferBasket(gateId, msg.sender, 1);
        emit BasketCollected(gateId, msg.sender, gate.terms.metadataHash);
    }

    function refundExpired(uint256 gateId) external nonReentrant {
        require(gateId < gateCount, "Unknown gate");
        Gate storage gate = _gates[gateId];
        require(msg.sender == gate.sponsor, "Only gate sponsor");
        require(block.timestamp >= gate.terms.expiresAt && !gate.refunded, "Not refundable");
        uint32 unused = gate.remainingCollections;
        gate.refunded = true;
        gate.remainingCollections = 0;
        if (unused > 0) _transferBasket(gateId, gate.sponsor, unused);
        emit GateRefunded(gateId, gate.sponsor, unused);
    }

    function _transferBasket(uint256 gateId, address recipient, uint32 slots) private {
        Asset[] storage assets = _assets[gateId];
        for (uint256 i; i < assets.length; i++) {
            Asset storage asset = assets[i];
            uint256 amount = asset.amountPerCollection * slots;
            reserved[asset.token] -= amount;
            if (asset.token == address(0)) {
                (bool success,) = payable(recipient).call{value: amount}("");
                require(success, "Native transfer failed");
            } else {
                IERC20 token = IERC20(asset.token);
                uint256 beforeRecipient = token.balanceOf(recipient);
                uint256 beforeEscrow = token.balanceOf(address(this));
                token.safeTransfer(recipient, amount);
                require(token.balanceOf(recipient) - beforeRecipient == amount
                    && beforeEscrow - token.balanceOf(address(this)) == amount, "Inexact payout");
            }
            emit AssetTransferred(gateId, recipient, asset.token, amount);
        }
    }
}
