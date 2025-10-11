// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SupplyChain} from "../src/SupplyChain.sol";

contract SupplyChainTest is Test {
    SupplyChain internal sc;
    address internal admin = address(this);
    address internal producer = address(0x1);
    address internal factory = address(0x2);
    address internal retailer = address(0x3);
    address internal consumer = address(0x4);

    function setUp() public {
        sc = new SupplyChain();
    }

    function testAdminIsDeployer() public view {
        assertTrue(sc.isAdmin(admin));
    }

    function testUserCanRequestRole() public {
        vm.prank(producer);
        sc.requestUserRole("Producer");
        SupplyChain.User memory u = sc.getUserInfo(producer);
        assertEq(u.role, "Producer");
        assertEq(uint(u.status), uint(SupplyChain.UserStatus.Pending));
    }

    function testOnlyAdminCanChangeStatus() public {
        vm.prank(producer);
        sc.requestUserRole("Producer");

        vm.prank(producer);
        vm.expectRevert();
        sc.changeStatusUser(producer, SupplyChain.UserStatus.Approved);

        sc.changeStatusUser(producer, SupplyChain.UserStatus.Approved);
        SupplyChain.User memory u = sc.getUserInfo(producer);
        assertEq(u.userAddress, producer);
        assertEq(uint(u.status), uint(SupplyChain.UserStatus.Approved));
    }
}
