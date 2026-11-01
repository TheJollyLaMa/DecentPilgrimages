// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface INativeClaim {
    function claim(uint256 locationId, address token) external;
}

contract TestToken is ERC20 {
    constructor() ERC20("Test Token", "TEST") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FeeToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && value > 1) {
            uint256 fee = value / 100;
            super._update(from, to, value - fee);
            super._update(from, address(0), fee);
        } else {
            super._update(from, to, value);
        }
    }
}

contract OutboundFeeToken is ERC20 {
    address public feePayer;

    constructor() ERC20("Outbound Fee Token", "OUT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFeePayer(address payer) external {
        feePayer = payer;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == feePayer && feePayer != address(0) && to != address(0) && value > 1) {
            uint256 fee = value / 100;
            super._update(from, to, value - fee);
            super._update(from, address(0), fee);
        } else {
            super._update(from, to, value);
        }
    }
}

contract ReenteringNativeClaimReceiver {
    bool public reentrySucceeded;

    function claim(address pilgrimage, uint256 locationId) external {
        INativeClaim(pilgrimage).claim(locationId, address(0));
    }

    receive() external payable {
        (reentrySucceeded, ) = msg.sender.call(
            abi.encodeWithSelector(INativeClaim.claim.selector, 0, address(0))
        );
    }
}
