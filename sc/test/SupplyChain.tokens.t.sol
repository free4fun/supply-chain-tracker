// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { SupplyChain } from "../src/SupplyChain.sol";

contract SupplyChainTokensTest is Test {
    SupplyChain internal sc;

    // Test actors
    address internal admin = address(this);
    address internal producer = address(0xA1);
    address internal factory = address(0xA2);
    address internal retailer = address(0xA3);
    address internal consumer = address(0xA4);

    function setUp() public {
        sc = new SupplyChain();

        // Prepare roles
        vm.startPrank(producer);
        sc.requestUserRole("Producer");
        vm.stopPrank();
        sc.changeStatusUser(producer, SupplyChain.UserStatus.Approved);

        vm.startPrank(factory);
        sc.requestUserRole("Factory");
        vm.stopPrank();
        sc.changeStatusUser(factory, SupplyChain.UserStatus.Approved);

        vm.startPrank(retailer);
        sc.requestUserRole("Retailer");
        vm.stopPrank();
        sc.changeStatusUser(retailer, SupplyChain.UserStatus.Approved);

        vm.startPrank(consumer);
        sc.requestUserRole("Consumer");
        vm.stopPrank();
        sc.changeStatusUser(consumer, SupplyChain.UserStatus.Approved);
    }

    // --- Helpers ---

    function _createTokenAsProducer(
        string memory name,
        uint256 totalSupply,
        string memory features,
        uint256 parentId
    ) internal returns (uint256 tokenId) {
        vm.prank(producer);
        sc.createToken(name, totalSupply, features, parentId);
        // nextTokenId is incremented inside the contract.
        // We expect the created token to be id == 1 on first call.
        tokenId = 1;
    }

    // --- Tests ---

    function test_createToken_byApprovedProducer_noParent_setsCreatorBalance() public {
        uint256 tokenId = _createTokenAsProducer("Cacao Lote #1", 1_000, '{"origin":"UY"}', 0);

        // View fields
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
        assertEq(name, "Cacao Lote #1");
        assertEq(totalSupply, 1000);
        assertEq(features, '{"origin":"UY"}');
        assertEq(parentId, 0);
        assertGt(dateCreated, 0);

        // Balance must be assigned to creator
        uint256 bal = sc.getTokenBalance(tokenId, producer);
        assertEq(bal, 1000);
    }

    function test_createToken_reverts_ifCallerNotApproved() public {
        // Producer changes role to Pending again to simulate not approved
        vm.prank(producer);
        sc.requestUserRole("Producer"); // status -> Pending

        vm.prank(producer);
        vm.expectRevert(); // should revert for not approved user
        sc.createToken("X", 10, "{}", 0);
    }

    function test_createToken_reverts_forConsumer() public {
        vm.prank(consumer);
        vm.expectRevert(); // Consumers cannot create tokens
        sc.createToken("Y", 5, "{}", 0);
    }

    function test_getTokenBalance_zeroForNonHolder() public {
        uint256 tokenId = _createTokenAsProducer("Harina Lote #7", 500, "{}", 0);
        uint256 bal = sc.getTokenBalance(tokenId, factory);
        assertEq(bal, 0);
    }

    function test_getTokenView_reverts_ifTokenDoesNotExist() public {
        vm.expectRevert();
        sc.getTokenView(999);
    }
}
