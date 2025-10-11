// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { SupplyChain } from "../src/SupplyChain.sol";

contract SupplyChainTest is Test {
    SupplyChain internal sc;

    address internal admin = address(this);
    address internal producer = address(0x1);
    address internal factory = address(0x2);

    function setUp() public {
        sc = new SupplyChain();
    }

    // --- Admin basics ---

    function test_AdminIsDeployer() public view {
        assertTrue(sc.isAdmin(admin));
    }

    function test_onlyAdmin_canChangeStatus() public {
        vm.prank(producer);
        sc.requestUserRole("Producer");

        // non-admin cannot change status
        vm.prank(producer);
        vm.expectRevert(); // NotAdmin
        sc.changeStatusUser(producer, SupplyChain.UserStatus.Approved);

        // admin can change
        sc.changeStatusUser(producer, SupplyChain.UserStatus.Approved);
        SupplyChain.User memory u = sc.getUserInfo(producer);
        assertEq(u.userAddress, producer);
        assertEq(uint256(u.status), uint256(SupplyChain.UserStatus.Approved));
    }

    // --- requestUserRole ---

    function test_requestUserRole_setsPendingAndStoresRole() public {
        vm.prank(producer);
        sc.requestUserRole("Producer");

        SupplyChain.User memory u = sc.getUserInfo(producer);
        assertGt(u.id, 0);
        assertEq(u.userAddress, producer);
        assertEq(u.role, "Producer");
        assertEq(uint256(u.status), uint256(SupplyChain.UserStatus.Pending));
    }

    function test_requestUserRole_twice_updatesRole_andResetsToPending() public {
        vm.prank(producer);
        sc.requestUserRole("Producer");
        sc.changeStatusUser(producer, SupplyChain.UserStatus.Approved);

        vm.prank(producer);
        sc.requestUserRole("Factory");

        SupplyChain.User memory u = sc.getUserInfo(producer);
        assertEq(u.role, "Factory");
        assertEq(uint256(u.status), uint256(SupplyChain.UserStatus.Pending));
    }

    function test_requestUserRole_emptyRole_reverts() public {
        vm.prank(factory);
        vm.expectRevert(); // EmptyRole
        sc.requestUserRole("");
    }

    // --- getUserInfo ---

    function test_getUserInfo_nonexistentUser_reverts() public {
        vm.expectRevert(); // NoUser
        sc.getUserInfo(address(0xBEEF));
    }

    // --- Events ---

    function test_event_UserRoleRequested_emitted() public {
        vm.expectEmit(true, false, false, true);
        emit SupplyChain.UserRoleRequested(producer, "Producer");

        vm.prank(producer);
        sc.requestUserRole("Producer");
    }

    function test_event_UserStatusChanged_emitted() public {
        vm.prank(producer);
        sc.requestUserRole("Producer");

        vm.expectEmit(true, false, false, true);
        emit SupplyChain.UserStatusChanged(producer, SupplyChain.UserStatus.Approved);

        sc.changeStatusUser(producer, SupplyChain.UserStatus.Approved);
    }
}
