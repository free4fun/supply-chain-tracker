// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { SupplyChain } from "../src/SupplyChain.sol";

contract SupplyChainTest is Test {
    SupplyChain internal sc;

    // Test actors
    address internal admin = address(this);
    address internal producer = address(0xA1);
    address internal factory = address(0xA2);
    address internal retailer = address(0xA3);
    address internal consumer = address(0xA4);
    address internal rando = address(0xA5);

    // ---------- Helpers ----------

    function _addr(address a) internal pure returns (address) {
        return a;
    }

    function _register(address who, string memory role) internal {
        vm.prank(who);
        sc.requestUserRole(role);
    }

    function _approve(address who) internal {
        sc.changeStatusUser(who, SupplyChain.UserStatus.Approved);
    }

    function _registerAndApprove(address who, string memory role) internal {
        _register(who, role);
        _approve(who);
    }

    function _createToken(
        address who,
        string memory name,
        uint256 supply,
        string memory features,
        uint256 parentId
    ) internal returns (uint256 tokenId) {
        vm.prank(who);
        sc.createToken(name, supply, features, parentId);
        // With sequential IDs, first created in a fresh test context is 1 or next.
        // We read nextTokenId indirectly via views; simplest is to return known 1 in fresh cases.
        // Callers that create multiple tokens can track known IDs.
        tokenId = 1;
    }

    function _transfer(address from, address to, uint256 tokenId, uint256 amount)
        internal
        returns (uint256 transferId)
    {
        vm.prank(from);
        sc.transfer(to, tokenId, amount);
        transferId = 1; // same note as tokens; in fresh tests first transfer is id=1
    }

    // ---------- setUp ----------

    function setUp() public {
        sc = new SupplyChain();
    }

    // ============================================================
    // User management tests
    // ============================================================

    function testUserRegistration() public {
        _register(producer, "Producer");
        SupplyChain.User memory u = sc.getUserInfo(producer);
        assertEq(u.userAddress, producer);
        assertEq(u.role, "Producer");
        assertEq(uint256(u.status), uint256(SupplyChain.UserStatus.Pending));
    }

    function testAdminApproveUser() public {
        _register(factory, "Factory");
        _approve(factory);
        SupplyChain.User memory u = sc.getUserInfo(factory);
        assertEq(uint256(u.status), uint256(SupplyChain.UserStatus.Approved));
    }

    function testAdminRejectUser() public {
        _register(retailer, "Retailer");
        sc.changeStatusUser(retailer, SupplyChain.UserStatus.Rejected);
        SupplyChain.User memory u = sc.getUserInfo(retailer);
        assertEq(uint256(u.status), uint256(SupplyChain.UserStatus.Rejected));
    }

    function testUserStatusChanges() public {
        _register(consumer, "Consumer");
        sc.changeStatusUser(consumer, SupplyChain.UserStatus.Approved);
        sc.changeStatusUser(consumer, SupplyChain.UserStatus.Canceled);
        SupplyChain.User memory u = sc.getUserInfo(consumer);
        assertEq(uint256(u.status), uint256(SupplyChain.UserStatus.Canceled));
    }

    function testOnlyApprovedUsersCanOperate() public {
        // Pending user tries to create token
        _register(producer, "Producer");
        vm.prank(producer);
        vm.expectRevert();
        sc.createToken("X", 10, "{}", 0);
    }

    function testGetUserInfo() public {
        _registerAndApprove(factory, "Factory");
        SupplyChain.User memory u = sc.getUserInfo(factory);
        assertEq(u.userAddress, factory);
        assertEq(u.role, "Factory");
        assertEq(uint256(u.status), uint256(SupplyChain.UserStatus.Approved));
    }

    function testIsAdmin() public view {
        assertTrue(sc.isAdmin(admin));
        assertFalse(sc.isAdmin(producer));
    }

    // ============================================================
    // Token creation tests
    // ============================================================

    function testCreateTokenByProducer() public {
        _registerAndApprove(producer, "Producer");
        uint256 tokenId = _createToken(producer, "Lote A", 1000, '{"k":"v"}', 0);

        (
            uint256 id,
            address creator,
            string memory name,
            uint256 totalSupply,
            string memory features,
            uint256 parentId,
            uint256 dateCreated
        ) = sc.getTokenView(tokenId);
        assertEq(id, tokenId);
        assertEq(creator, producer);
        assertEq(name, "Lote A");
        assertEq(totalSupply, 1000);
        assertEq(features, '{"k":"v"}');
        assertEq(parentId, 0);
        assertGt(dateCreated, 0);

        uint256 bal = sc.getTokenBalance(tokenId, producer);
        assertEq(bal, 1000);
    }

    function testCreateTokenByFactory() public {
        _registerAndApprove(factory, "Factory");
        vm.prank(factory);
        sc.createToken("Pack Lote", 50, "{}", 0);
        (,, string memory name, uint256 totalSupply,,,) = sc.getTokenView(1);
        assertEq(name, "Pack Lote");
        assertEq(totalSupply, 50);
    }

    function testCreateTokenByRetailer() public {
        _registerAndApprove(retailer, "Retailer");
        vm.prank(retailer);
        sc.createToken("SKU", 5, "{}", 0);
        (,, string memory name, uint256 totalSupply,,,) = sc.getTokenView(1);
        assertEq(name, "SKU");
        assertEq(totalSupply, 5);
    }

    function testTokenWithParentId() public {
        _registerAndApprove(producer, "Producer");
        vm.prank(producer);
        sc.createToken("Base", 100, "{}", 0); // id=1
        vm.prank(producer);
        sc.createToken("Derivado", 20, "{}", 1); // id=2 with parent=1
        (,,,,, uint256 parentId,) = sc.getTokenView(2);
        assertEq(parentId, 1);
    }

    function testTokenMetadata() public {
        _registerAndApprove(producer, "Producer");
        vm.prank(producer);
        sc.createToken("Meta", 10, '{"origin":"UY","lot":"X1"}', 0);
        (,,,, string memory features,,) = sc.getTokenView(1);
        assertEq(features, '{"origin":"UY","lot":"X1"}');
    }

    function testTokenBalance() public {
        _registerAndApprove(producer, "Producer");
        vm.prank(producer);
        sc.createToken("B", 77, "{}", 0);
        uint256 bal = sc.getTokenBalance(1, producer);
        assertEq(bal, 77);
    }

    function testGetToken() public {
        _registerAndApprove(producer, "Producer");
        vm.prank(producer);
        sc.createToken("T", 1, "{}", 0);
        (uint256 id,, string memory name, uint256 totalSupply,,,) = sc.getTokenView(1);
        assertEq(id, 1);
        assertEq(name, "T");
        assertEq(totalSupply, 1);
    }

    function testGetUserTokens() public {
        _registerAndApprove(producer, "Producer");
        vm.prank(producer);
        sc.createToken("A", 100, "{}", 0); // id=1
        vm.prank(producer);
        sc.createToken("B", 200, "{}", 0); // id=2
        uint256[] memory arr = sc.getUserTokens(producer);
        assertEq(arr.length, 2);
        assertEq(arr[0], 1);
        assertEq(arr[1], 2);
    }

    // ============================================================
    // Transfer tests
    // ============================================================

    function _bootstrapPTC() internal returns (uint256 tokenId) {
        _registerAndApprove(producer, "Producer");
        _registerAndApprove(factory, "Factory");
        _registerAndApprove(retailer, "Retailer");
        _registerAndApprove(consumer, "Consumer");
        vm.prank(producer);
        sc.createToken("Lote A", 1000, "{}", 0);
        tokenId = 1;
    }

    function testTransferFromProducerToFactory() public {
        uint256 tokenId = _bootstrapPTC();
        uint256 fromBefore = sc.getTokenBalance(tokenId, producer);
        uint256 toBefore = sc.getTokenBalance(tokenId, factory);
        vm.prank(producer);
        sc.transfer(factory, tokenId, 300);

        // Pending: balances unchanged
        assertEq(sc.getTokenBalance(tokenId, producer), fromBefore);
        assertEq(sc.getTokenBalance(tokenId, factory), toBefore);

        (
            uint256 id,
            address from,
            address to,
            uint256 tId,
            ,
            uint256 amount,
            SupplyChain.TransferStatus status
        ) = sc.getTransfer(1);
        assertEq(id, 1);
        assertEq(from, producer);
        assertEq(to, factory);
        assertEq(tId, tokenId);
        assertEq(amount, 300);
        assertEq(uint256(status), uint256(SupplyChain.TransferStatus.Pending));
    }

    function testTransferFromFactoryToRetailer() public {
        uint256 tokenId = _bootstrapPTC();
        vm.prank(producer);
        sc.transfer(factory, tokenId, 400);
        vm.prank(factory);
        sc.acceptTransfer(1);

        vm.prank(factory);
        sc.transfer(retailer, tokenId, 150);
        (,,,,, uint256 amount, SupplyChain.TransferStatus status) = sc.getTransfer(2);
        assertEq(amount, 150);
        assertEq(uint256(status), uint256(SupplyChain.TransferStatus.Pending));
    }

    function testTransferFromRetailerToConsumer() public {
        uint256 tokenId = _bootstrapPTC();
        vm.prank(producer);
        sc.transfer(factory, tokenId, 500);
        vm.prank(factory);
        sc.acceptTransfer(1);
        vm.prank(factory);
        sc.transfer(retailer, tokenId, 200);
        vm.prank(retailer);
        sc.acceptTransfer(2);

        vm.prank(retailer);
        sc.transfer(consumer, tokenId, 50);
        (,,,,, uint256 amount, SupplyChain.TransferStatus status) = sc.getTransfer(3);
        assertEq(amount, 50);
        assertEq(uint256(status), uint256(SupplyChain.TransferStatus.Pending));
    }

    function testAcceptTransfer() public {
        uint256 tokenId = _bootstrapPTC();
        vm.prank(producer);
        sc.transfer(factory, tokenId, 250);
        uint256 fromBefore = sc.getTokenBalance(tokenId, producer);
        uint256 toBefore = sc.getTokenBalance(tokenId, factory);

        vm.prank(factory);
        sc.acceptTransfer(1);
        assertEq(sc.getTokenBalance(tokenId, producer), fromBefore - 250);
        assertEq(sc.getTokenBalance(tokenId, factory), toBefore + 250);

        (,,,,,, SupplyChain.TransferStatus status) = sc.getTransfer(1);
        assertEq(uint256(status), uint256(SupplyChain.TransferStatus.Accepted));
    }

    function testRejectTransfer() public {
        uint256 tokenId = _bootstrapPTC();
        vm.prank(producer);
        sc.transfer(factory, tokenId, 120);
        uint256 fromBefore = sc.getTokenBalance(tokenId, producer);
        uint256 toBefore = sc.getTokenBalance(tokenId, factory);

        vm.prank(factory);
        sc.rejectTransfer(1);
        assertEq(sc.getTokenBalance(tokenId, producer), fromBefore);
        assertEq(sc.getTokenBalance(tokenId, factory), toBefore);
        (,,,,,, SupplyChain.TransferStatus status) = sc.getTransfer(1);
        assertEq(uint256(status), uint256(SupplyChain.TransferStatus.Rejected));
    }

    function testTransferInsufficientBalance() public {
        uint256 tokenId = _bootstrapPTC();
        vm.prank(producer);
        vm.expectRevert();
        sc.transfer(factory, tokenId, 1001);
    }

    function testGetTransfer() public {
        uint256 tokenId = _bootstrapPTC();
        vm.prank(producer);
        sc.transfer(factory, tokenId, 10);
        (
            uint256 id,
            address from,
            address to,
            uint256 tId,
            ,
            uint256 amount,
            SupplyChain.TransferStatus status
        ) = sc.getTransfer(1);
        assertEq(id, 1);
        assertEq(from, producer);
        assertEq(to, factory);
        assertEq(tId, tokenId);
        assertEq(amount, 10);
        assertEq(uint256(status), uint256(SupplyChain.TransferStatus.Pending));
    }

    function testGetUserTransfers() public {
        uint256 tokenId = _bootstrapPTC();
        vm.prank(producer);
        sc.transfer(factory, tokenId, 10);
        uint256[] memory tp = sc.getUserTransfers(producer);
        uint256[] memory tf = sc.getUserTransfers(factory);
        assertEq(tp.length, 1);
        assertEq(tf.length, 1);
        assertEq(tp[0], 1);
        assertEq(tf[0], 1);
    }

    // ============================================================
    // Validations & permissions
    // ============================================================

    function testInvalidRoleTransfer() public {
        uint256 tokenId = _bootstrapPTC();
        // Producer -> Retailer (skip Factory) must revert
        vm.prank(producer);
        vm.expectRevert();
        sc.transfer(retailer, tokenId, 1);
        // Factory -> Consumer (skip Retailer) must revert
        vm.prank(producer);
        sc.transfer(factory, tokenId, 5);
        vm.prank(factory);
        sc.acceptTransfer(1);
        vm.prank(factory);
        vm.expectRevert();
        sc.transfer(consumer, tokenId, 1);
    }

    function testUnapprovedUserCannotCreateToken() public {
        _register(producer, "Producer"); // still Pending
        vm.prank(producer);
        vm.expectRevert();
        sc.createToken("X", 1, "{}", 0);
    }

    function testUnapprovedUserCannotTransfer() public {
        uint256 tokenId = _bootstrapPTC();
        // Make producer Pending again
        vm.prank(producer);
        sc.requestUserRole("Producer");
        vm.prank(producer);
        vm.expectRevert();
        sc.transfer(factory, tokenId, 1);
    }

    function testOnlyAdminCanChangeStatus() public {
        _register(producer, "Producer");
        vm.prank(producer);
        vm.expectRevert();
        sc.changeStatusUser(producer, SupplyChain.UserStatus.Approved);

        sc.changeStatusUser(producer, SupplyChain.UserStatus.Approved);
        SupplyChain.User memory u = sc.getUserInfo(producer);
        assertEq(uint256(u.status), uint256(SupplyChain.UserStatus.Approved));
    }

    function testConsumerCannotTransfer() public {
        uint256 tokenId = _bootstrapPTC();
        // Give some balance to consumer through the chain
        vm.prank(producer);
        sc.transfer(factory, tokenId, 100);
        vm.prank(factory);
        sc.acceptTransfer(1);
        vm.prank(factory);
        sc.transfer(retailer, tokenId, 60);
        vm.prank(retailer);
        sc.acceptTransfer(2);
        vm.prank(retailer);
        sc.transfer(consumer, tokenId, 30);
        vm.prank(consumer);
        sc.acceptTransfer(3);

        // Consumer cannot send further
        vm.prank(consumer);
        vm.expectRevert();
        sc.transfer(retailer, tokenId, 1);
    }

    function testTransferToSameAddress() public {
        uint256 tokenId = _bootstrapPTC();
        vm.prank(producer);
        vm.expectRevert();
        sc.transfer(producer, tokenId, 1);
        vm.prank(producer);
        vm.expectRevert();
        sc.transfer(address(0), tokenId, 1);
    }

    // ============================================================
    // Edge cases
    // ============================================================

    function testTransferZeroAmount() public {
        uint256 tokenId = _bootstrapPTC();
        vm.prank(producer);
        vm.expectRevert();
        sc.transfer(factory, tokenId, 0);
    }

    function testTransferNonExistentToken() public {
        _registerAndApprove(producer, "Producer");
        _registerAndApprove(factory, "Factory");
        vm.prank(producer);
        vm.expectRevert();
        sc.transfer(factory, 999, 1);
    }

    function testAcceptNonExistentTransfer() public {
        _registerAndApprove(factory, "Factory");
        vm.prank(factory);
        vm.expectRevert();
        sc.acceptTransfer(999);
    }

    function testDoubleAcceptTransfer() public {
        uint256 tokenId = _bootstrapPTC();
        vm.prank(producer);
        sc.transfer(factory, tokenId, 10);
        vm.prank(factory);
        sc.acceptTransfer(1);
        vm.prank(factory);
        vm.expectRevert();
        sc.acceptTransfer(1);
    }

    function testTransferAfterRejection() public {
        uint256 tokenId = _bootstrapPTC();
        vm.prank(producer);
        sc.transfer(factory, tokenId, 10);
        vm.prank(factory);
        sc.rejectTransfer(1);
        // New transfer after rejection should work
        vm.prank(producer);
        sc.transfer(factory, tokenId, 5);
        (,,,,, uint256 amount, SupplyChain.TransferStatus status) = sc.getTransfer(2);
        assertEq(amount, 5);
        assertEq(uint256(status), uint256(SupplyChain.TransferStatus.Pending));
    }

    // ============================================================
    // Events
    // ============================================================

    function testUserRegisteredEvent() public {
        vm.expectEmit(true, false, false, true);
        emit SupplyChain.UserRoleRequested(producer, "Producer");
        _register(producer, "Producer");
    }

    function testUserStatusChangedEvent() public {
        _register(factory, "Factory");
        vm.expectEmit(true, false, false, true);
        emit SupplyChain.UserStatusChanged(factory, SupplyChain.UserStatus.Approved);
        _approve(factory);
    }

    function testTokenCreatedEvent() public {
        _registerAndApprove(producer, "Producer");
        vm.expectEmit(true, true, false, true);
        emit SupplyChain.TokenCreated(1, producer, "L", 10, "{}", 0);
        vm.prank(producer);
        sc.createToken("L", 10, "{}", 0);
    }

    function testTransferInitiatedEvent() public {
        uint256 tokenId = _bootstrapPTC();
        vm.expectEmit(true, true, true, true);
        emit SupplyChain.TransferRequested(1, producer, factory, tokenId, 7);
        vm.prank(producer);
        sc.transfer(factory, tokenId, 7);
    }

    function testTransferAcceptedEvent() public {
        uint256 tokenId = _bootstrapPTC();
        vm.prank(producer);
        sc.transfer(factory, tokenId, 7);
        vm.expectEmit(true, false, false, true);
        emit SupplyChain.TransferAccepted(1);
        vm.prank(factory);
        sc.acceptTransfer(1);
    }

    function testTransferRejectedEvent() public {
        uint256 tokenId = _bootstrapPTC();
        vm.prank(producer);
        sc.transfer(factory, tokenId, 7);
        vm.expectEmit(true, false, false, true);
        emit SupplyChain.TransferRejected(1);
        vm.prank(factory);
        sc.rejectTransfer(1);
    }

    // ============================================================
    // Full flows
    // ============================================================

    function testCompleteSupplyChainFlow() public {
        uint256 tokenId = _bootstrapPTC();

        // Producer -> Factory (100), accept
        vm.prank(producer);
        sc.transfer(factory, tokenId, 100);
        vm.prank(factory);
        sc.acceptTransfer(1);

        // Factory -> Retailer (60), accept
        vm.prank(factory);
        sc.transfer(retailer, tokenId, 60);
        vm.prank(retailer);
        sc.acceptTransfer(2);

        // Retailer -> Consumer (30), accept
        vm.prank(retailer);
        sc.transfer(consumer, tokenId, 30);
        vm.prank(consumer);
        sc.acceptTransfer(3);

        // Check balances
        assertEq(sc.getTokenBalance(tokenId, producer), 900);
        assertEq(sc.getTokenBalance(tokenId, factory), 40);
        assertEq(sc.getTokenBalance(tokenId, retailer), 30);
        assertEq(sc.getTokenBalance(tokenId, consumer), 30);
    }

    function testMultipleTokensFlow() public {
        _registerAndApprove(producer, "Producer");
        _registerAndApprove(factory, "Factory");

        // Two tokens
        vm.prank(producer);
        sc.createToken("A", 100, "{}", 0); // id=1
        vm.prank(producer);
        sc.createToken("B", 200, "{}", 0); // id=2

        // Move some of A only
        vm.prank(producer);
        sc.transfer(factory, 1, 40);
        vm.prank(factory);
        sc.acceptTransfer(1);

        assertEq(sc.getTokenBalance(1, producer), 60);
        assertEq(sc.getTokenBalance(1, factory), 40);
        assertEq(sc.getTokenBalance(2, producer), 200);
        assertEq(sc.getTokenBalance(2, factory), 0);

        // User tokens lists
        uint256[] memory p = sc.getUserTokens(producer);
        uint256[] memory f = sc.getUserTokens(factory);
        assertEq(p.length, 2);
        assertEq(p[0], 1);
        assertEq(p[1], 2);
        assertEq(f.length, 1);
        assertEq(f[0], 1);
    }

    function testTraceabilityFlow() public {
        uint256 tokenId = _bootstrapPTC();

        // 3 hops with accepts
        vm.prank(producer);
        sc.transfer(factory, tokenId, 90);
        vm.prank(factory);
        sc.acceptTransfer(1);
        vm.prank(factory);
        sc.transfer(retailer, tokenId, 50);
        vm.prank(retailer);
        sc.acceptTransfer(2);
        vm.prank(retailer);
        sc.transfer(consumer, tokenId, 20);
        vm.prank(consumer);
        sc.acceptTransfer(3);

        // Every participant should list the corresponding transfer IDs
        uint256[] memory tp = sc.getUserTransfers(producer);
        uint256[] memory tf = sc.getUserTransfers(factory);
        uint256[] memory tr = sc.getUserTransfers(retailer);
        uint256[] memory tc = sc.getUserTransfers(consumer);

        assertEq(tp.length, 1);
        assertEq(tf.length, 2);
        assertEq(tr.length, 2);
        assertEq(tc.length, 1);

        assertEq(tp[0], 1);
        assertEq(tf[0], 1);
        assertEq(tf[1], 2);
        assertEq(tr[0], 2);
        assertEq(tr[1], 3);
        assertEq(tc[0], 3);
    }
}
