// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract GateVerifierFixture {
    address public immutable signer;
    bool public enabled = true;
    constructor(address signer_) { signer = signer_; }
    function setEnabled(bool value) external { enabled = value; }
    function isValidSignature(bytes32 digest, bytes calldata signature) external view returns (bytes4) {
        (address recovered, ECDSA.RecoverError error,) = ECDSA.tryRecover(digest, signature);
        return enabled && error == ECDSA.RecoverError.NoError && recovered == signer ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }
}

contract GateVisitorFixture {
    bool public reentrySucceeded;
    bytes private _request;
    address private _escrow;
    function visit(address escrow, bytes calldata request) external {
        _escrow = escrow;
        _request = request;
        (bool success, bytes memory reason) = escrow.call(request);
        if (!success) assembly ("memory-safe") { revert(add(reason, 32), mload(reason)) }
    }
    receive() external payable {
        (reentrySucceeded,) = _escrow.call(_request);
    }
}
