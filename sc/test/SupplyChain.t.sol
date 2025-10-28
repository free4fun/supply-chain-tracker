// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { SupplyChain } from "../src/SupplyChain.sol";

contract SupplyChainCoreTest is Test {
    SupplyChain internal sc;

    address internal admin = address(this);
    address internal producer = address(0xC1);
    address internal factory = address(0xC2);
    address internal retailer = address(0xC3);
    address internal consumer = address(0xC4);

    function setUp() public {
        sc = new SupplyChain();
    }

    function _registerAndApprove(address who, string memory role) internal {
        vm.prank(who);
        sc.requestUserRole(role);
        sc.changeStatusUser(who, SupplyChain.UserStatus.Approved);
    }

    function testAdminIsDetected() public view {
        assertTrue(sc.isAdmin(admin));
        assertFalse(sc.isAdmin(producer));
    }

    function testRequestUserRoleStoresPendingStatus() public {
        vm.prank(producer);
        sc.requestUserRole("Producer");

        SupplyChain.User memory u = sc.getUserInfo(producer);
        assertEq(u.userAddress, producer);
        assertEq(u.role, "Producer");
        assertEq(uint256(u.status), uint256(SupplyChain.UserStatus.Pending));
    }

    function testStatusLockPreventsReapproval() public {
        vm.prank(factory);
        sc.requestUserRole("Factory");
        sc.changeStatusUser(factory, SupplyChain.UserStatus.Rejected);

        vm.expectRevert(SupplyChain.StatusLocked.selector);
        sc.changeStatusUser(factory, SupplyChain.UserStatus.Approved);
    }

    function testStatusLockAllowsIdempotentUpdate() public {
        vm.prank(retailer);
        sc.requestUserRole("Retailer");
        sc.changeStatusUser(retailer, SupplyChain.UserStatus.Approved);

        // Same status should be allowed (no-op)
        sc.changeStatusUser(retailer, SupplyChain.UserStatus.Approved);
    }

    function testSuggestedParentDefaultsToZeroForProducer() public {
        _registerAndApprove(producer, "Producer");

        vm.prank(producer);
        sc.createToken("Seed Lot", "Root asset", 1_000, "{}");

        uint256 suggested = sc.getSuggestedParent(producer);
        assertEq(suggested, 0);
    }

    function testAcceptTransferUpdatesSuggestedParent() public {
        _registerAndApprove(producer, "Producer");
        _registerAndApprove(factory, "Factory");

        vm.prank(producer);
        sc.createToken("Batch #1", "Harvest lot", 500, "{}");

        vm.prank(producer);
        sc.transfer(factory, 1, 250);
        vm.prank(factory);
        sc.acceptTransfer(1);

        uint256 suggested = sc.getSuggestedParent(factory);
        assertEq(suggested, 1);
    }

    function testFactoryCannotCreateWithoutInboundTransfer() public {
        _registerAndApprove(factory, "Factory");

        vm.prank(factory);
        vm.expectRevert(SupplyChain.ParentNotAssigned.selector);
        sc.createToken("Derived", "", 100, "{}");
    }
}
