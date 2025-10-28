// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { SupplyChain } from "../src/SupplyChain.sol";

contract SupplyChainTokensTest is Test {
    SupplyChain internal sc;

    address internal admin = address(this);
    address internal producer = address(0xA1);
    address internal factory = address(0xA2);
    address internal retailer = address(0xA3);

    function setUp() public {
        sc = new SupplyChain();

        vm.prank(producer);
        sc.registerAndRequestRole("Producer Co", "Test", "User", "Producer");
        sc.changeStatusUser(producer, SupplyChain.UserStatus.Approved);

        vm.prank(factory);
        sc.registerAndRequestRole("Factory Inc", "Test", "User", "Factory");
        sc.changeStatusUser(factory, SupplyChain.UserStatus.Approved);

        vm.prank(retailer);
        sc.registerAndRequestRole("Retail Corp", "Test", "User", "Retailer");
        sc.changeStatusUser(retailer, SupplyChain.UserStatus.Approved);
    }

    function testProducerCreatesRootTokenWithDescription() public {
        vm.prank(producer);
        uint256[] memory empty = new uint256[](0);
        sc.createToken("Coffee Beans", "Washed arabica from Colombia", 1_200, '{"grade":"AA"}', empty, empty);

        (
            uint256 id,
            address creator,
            string memory name,
            string memory description,
            uint256 totalSupply,
            string memory features,
            uint256 parentId,
            uint256 dateCreated,
            uint256 availableSupply
        ) = sc.getTokenView(1);

        assertEq(id, 1);
        assertEq(creator, producer);
        assertEq(name, "Coffee Beans");
        assertEq(description, "Washed arabica from Colombia");
        assertEq(totalSupply, 1_200);
        assertEq(features, '{"grade":"AA"}');
        assertEq(parentId, 0);
        assertGt(dateCreated, 0);
        assertEq(availableSupply, 1_200);
    }

    function testFactoryCannotCreateWithoutSuggestedParent() public {
        vm.prank(factory);
        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;
        uint256[] memory amts = new uint256[](1);
        amts[0] = 100;
        vm.expectRevert(SupplyChain.ParentNotAssigned.selector);
        sc.createToken("Roasted Batch", "Requires inbound lot", 500, "{}", ids, amts);
    }

    function testFactoryUsesAcceptedTokenAsParent() public {
        // Producer mints a root token
        vm.prank(producer);
        uint256[] memory none = new uint256[](0);
        sc.createToken("Green Beans", "Lot ready for roasting", 600, "{}", none, none);

        // Transfer to factory and accept
        vm.prank(producer);
        sc.transfer(factory, 1, 300);
        vm.prank(factory);
        sc.acceptTransfer(1);

        // Factory token must inherit parent id = 1
        vm.prank(factory);
        uint256[] memory compIds = new uint256[](1);
        compIds[0] = 1;
        uint256[] memory compAmts = new uint256[](1);
        compAmts[0] = 150;
        sc.createToken("Roasted Lot", "Medium roast", 150, "{}", compIds, compAmts);

        (,,,,,, uint256 parentId,,) = sc.getTokenView(2);
        assertEq(parentId, 1);

        uint256 suggestedParent = sc.getSuggestedParent(factory);
        assertEq(suggestedParent, 2);

        (,,,,,,,, uint256 availableSupplyParent) = sc.getTokenView(1);
        assertEq(availableSupplyParent, 450);

        SupplyChain.Component[] memory inputs = sc.getTokenInputs(2);
        assertEq(inputs.length, 1);
        assertEq(inputs[0].tokenId, 1);
        assertEq(inputs[0].amount, 150);
  }

    function testFactoryConsumesMultipleComponents() public {
        // Producer mints two root tokens
        vm.prank(producer);
        uint256[] memory none = new uint256[](0);
        sc.createToken("Malbec", "Lote de uvas malbec", 400, "{}", none, none);
        vm.prank(producer);
        sc.createToken("Cabernet", "Lote de uvas cabernet", 300, "{}", none, none);

        // Transfer both lots to the factory
        vm.prank(producer);
        sc.transfer(factory, 1, 180);
        vm.prank(factory);
        sc.acceptTransfer(1);

        vm.prank(producer);
        sc.transfer(factory, 2, 160);
        vm.prank(factory);
        sc.acceptTransfer(2);

        // Factory combines both lots into a blend
        uint256[] memory compIds = new uint256[](2);
        compIds[0] = 2; // must match suggested parent (last accepted)
        compIds[1] = 1;
        uint256[] memory compAmts = new uint256[](2);
        compAmts[0] = 120;
        compAmts[1] = 80;

        vm.prank(factory);
        sc.createToken("Blend Especial", "Corte de malbec y cabernet", 150, "{}", compIds, compAmts);

        // Verify balances were reduced
        (,,,,,,,, uint256 availableMalbec) = sc.getTokenView(1);
        (,,,,,,,, uint256 availableCabernet) = sc.getTokenView(2);
        assertEq(availableMalbec, 400 - 80);
        assertEq(availableCabernet, 300 - 120);

        SupplyChain.Component[] memory inputs = sc.getTokenInputs(3);
        assertEq(inputs.length, 2);
        assertEq(inputs[0].tokenId, 2);
        assertEq(inputs[0].amount, 120);
        assertEq(inputs[1].tokenId, 1);
        assertEq(inputs[1].amount, 80);
    }
}
