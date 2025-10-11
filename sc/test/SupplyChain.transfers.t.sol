// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { SupplyChain } from "../src/SupplyChain.sol";

contract SupplyChainTransfersTest is Test {
    SupplyChain internal sc;

    // Test actors
    address internal admin = address(this);
    address internal producer = address(0xB1);
    address internal factory = address(0xB2);
    address internal retailer = address(0xB3);
    address internal consumer = address(0xB4);
    address internal rando = address(0xB5);

    uint256 internal tokenId;

    function setUp() public {
        sc = new SupplyChain();

        // Register and approve roles
        vm.prank(producer);
        sc.requestUserRole("Producer");
        sc.changeStatusUser(producer, SupplyChain.UserStatus.Approved);

        vm.prank(factory);
        sc.requestUserRole("Factory");
        sc.changeStatusUser(factory, SupplyChain.UserStatus.Approved);

        vm.prank(retailer);
        sc.requestUserRole("Retailer");
        sc.changeStatusUser(retailer, SupplyChain.UserStatus.Approved);

        vm.prank(consumer);
        sc.requestUserRole("Consumer");
        sc.changeStatusUser(consumer, SupplyChain.UserStatus.Approved);

        // Producer mints root token with full balance
        vm.prank(producer);
        sc.createToken("Lote A", 1000, "{}", 0);
        tokenId = 1;
    }

    // --- Helpers ---

    function _transfer(address from, address to, uint256 amount) internal returns (uint256 tId) {
        vm.prank(from);
        sc.transfer(to, tokenId, amount);
        // First transfer ID should be 1 and then increment
        tId = 1;
    }

    // --- Tests ---

    function test_transfer_ProducerToFactory_createsPending_withoutImmediateBalanceChange()
        public
    {
        uint256 balBeforeFrom = sc.getTokenBalance(tokenId, producer);
        uint256 balBeforeTo = sc.getTokenBalance(tokenId, factory);

        uint256 transferId = _transfer(producer, factory, 300);

        // Balances must not change until accept
        assertEq(sc.getTokenBalance(tokenId, producer), balBeforeFrom);
        assertEq(sc.getTokenBalance(tokenId, factory), balBeforeTo);

        // Inspect transfer
        (
            uint256 id,
            address from,
            address to,
            uint256 tTokenId,
            uint256 dateCreated,
            uint256 amount,
            SupplyChain.TransferStatus status
        ) = sc.getTransfer(transferId);

        assertEq(id, transferId);
        assertEq(from, producer);
        assertEq(to, factory);
        assertEq(tTokenId, tokenId);
        assertGt(dateCreated, 0);
        assertEq(amount, 300);
        assertEq(uint256(status), uint256(SupplyChain.TransferStatus.Pending));
    }

    function test_acceptTransfer_byRecipient_movesBalances() public {
        uint256 transferId = _transfer(producer, factory, 250);

        // Only recipient can accept
        vm.prank(rando);
        vm.expectRevert();
        sc.acceptTransfer(transferId);

        // Accept as recipient
        uint256 fromBefore = sc.getTokenBalance(tokenId, producer);
        uint256 toBefore = sc.getTokenBalance(tokenId, factory);

        vm.prank(factory);
        sc.acceptTransfer(transferId);

        assertEq(sc.getTokenBalance(tokenId, producer), fromBefore - 250);
        assertEq(sc.getTokenBalance(tokenId, factory), toBefore + 250);

        // Status updated
        (,,,,,, SupplyChain.TransferStatus status) = sc.getTransfer(transferId);
        assertEq(uint256(status), uint256(SupplyChain.TransferStatus.Accepted));
    }

    function test_rejectTransfer_byRecipient_releasesReservation_noBalanceChange() public {
        uint256 transferId = _transfer(producer, factory, 150);

        uint256 fromBefore = sc.getTokenBalance(tokenId, producer);
        uint256 toBefore = sc.getTokenBalance(tokenId, factory);

        vm.prank(factory);
        sc.rejectTransfer(transferId);

        assertEq(sc.getTokenBalance(tokenId, producer), fromBefore);
        assertEq(sc.getTokenBalance(tokenId, factory), toBefore);

        (,,,,,, SupplyChain.TransferStatus status) = sc.getTransfer(transferId);
        assertEq(uint256(status), uint256(SupplyChain.TransferStatus.Rejected));
    }

    function test_reservation_blocks_oversell_across_multiple_pending_transfers() public {
        // Producer balance is 1000. Two pending totaling >1000 should revert.
        vm.prank(producer);
        sc.transfer(factory, tokenId, 800); // ok, pending

        vm.prank(producer);
        sc.transfer(factory, tokenId, 200); // ok, pending (now 1000 reserved)

        vm.prank(producer);
        vm.expectRevert(); // reservation must prevent exceeding available
        sc.transfer(factory, tokenId, 1); // would exceed if not reserved
    }

    function test_cannot_transfer_to_self_or_zero() public {
        vm.prank(producer);
        vm.expectRevert();
        sc.transfer(producer, tokenId, 10);

        vm.prank(producer);
        vm.expectRevert();
        sc.transfer(address(0), tokenId, 10);
    }

    function test_cannot_transfer_more_than_available() public {
        // Single transfer over full balance should revert
        vm.prank(producer);
        vm.expectRevert();
        sc.transfer(factory, tokenId, 1001);
    }

    function test_onlyApprovedSender_canTransfer() public {
        // Put producer back to Pending
        vm.prank(producer);
        sc.requestUserRole("Producer"); // status -> Pending

        vm.prank(producer);
        vm.expectRevert();
        sc.transfer(factory, tokenId, 10);
    }

    function test_route_enforcement_ProducerToFactory_FactoryToRetailer_RetailerToConsumer()
        public
    {
        // Producer -> Factory
        vm.prank(producer);
        sc.transfer(factory, tokenId, 100);
        vm.prank(factory);
        sc.acceptTransfer(1);

        // Factory -> Retailer
        vm.prank(factory);
        sc.transfer(retailer, tokenId, 60);
        vm.prank(retailer);
        sc.acceptTransfer(2);

        // Retailer -> Consumer
        vm.prank(retailer);
        sc.transfer(consumer, tokenId, 30);
        vm.prank(consumer);
        sc.acceptTransfer(3);

        // Invalid hops should revert
        vm.prank(producer);
        vm.expectRevert();
        sc.transfer(retailer, tokenId, 10); // skip Factory

        vm.prank(factory);
        vm.expectRevert();
        sc.transfer(consumer, tokenId, 10); // skip Retailer
    }
}
