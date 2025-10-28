// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {SupplyChain} from "../src/SupplyChain.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        SupplyChain sc = new SupplyChain();
        console2.log("SupplyChain:", address(sc));
        vm.stopBroadcast();
    }
}
