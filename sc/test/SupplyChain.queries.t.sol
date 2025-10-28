// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { SupplyChain } from "../src/SupplyChain.sol";

contract SupplyChainQueriesTest is Test {
    SupplyChain sc;
    address admin = address(this);
    address producer = address(0xC1);
    address factory = address(0xC2);

    function setUp() public {
        sc = new SupplyChain();
        vm.prank(producer);
        sc.registerAndRequestRole("Producer Co", "Test", "User", "Producer");
        sc.changeStatusUser(producer, SupplyChain.UserStatus.Approved);
        vm.prank(factory);
        sc.registerAndRequestRole("Factory Inc", "Test", "User", "Factory");
        sc.changeStatusUser(factory, SupplyChain.UserStatus.Approved);

        vm.prank(producer);
        uint256[] memory empty = new uint256[](0);
        sc.createToken("L1", "Root lot", 100, "{}", empty, empty); // tokenId=1
        vm.prank(producer);
        sc.createToken("L2", "Second lot", 50, "{}", empty, empty); // tokenId=2
        vm.prank(producer);
        sc.transfer(factory, 1, 40); // transferId=1
        vm.prank(factory);
        sc.acceptTransfer(1);
    }

    function test_getUserTokens_returnsDistinctTokenIds() public view {
        uint256[] memory p = sc.getUserTokens(producer);
        uint256[] memory f = sc.getUserTokens(factory);
        // producer should have [1,2], factory should have [1]
        assertEq(p.length, 2);
        assertEq(p[0], 1);
        assertEq(p[1], 2);
        assertEq(f.length, 1);
        assertEq(f[0], 1);
    }

    function test_getUserTransfers_returnsAllInvolved() public view {
        uint256[] memory pt = sc.getUserTransfers(producer);
        uint256[] memory ft = sc.getUserTransfers(factory);
        assertEq(pt.length, 1);
        assertEq(ft.length, 1);
        assertEq(pt[0], 1);
        assertEq(ft[0], 1);
    }
}
