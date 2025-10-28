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
        sc.createToken("Coffee Beans", "Washed arabica from Colombia", 1_200, '{"grade":"AA"}');

        (
            uint256 id,
            address creator,
            string memory name,
            string memory description,
            uint256 totalSupply,
            string memory features,
            uint256 parentId,
            uint256 dateCreated
        ) = sc.getTokenView(1);

        assertEq(id, 1);
        assertEq(creator, producer);
        assertEq(name, "Coffee Beans");
        assertEq(description, "Washed arabica from Colombia");
        assertEq(totalSupply, 1_200);
        assertEq(features, '{"grade":"AA"}');
        assertEq(parentId, 0);
        assertGt(dateCreated, 0);
    }

    function testFactoryCannotCreateWithoutSuggestedParent() public {
        vm.prank(factory);
        vm.expectRevert(SupplyChain.ParentNotAssigned.selector);
        sc.createToken("Roasted Batch", "Requires inbound lot", 500, "{}");
    }

    function testFactoryUsesAcceptedTokenAsParent() public {
        // Producer mints a root token
        vm.prank(producer);
        sc.createToken("Green Beans", "Lot ready for roasting", 600, "{}");

        // Transfer to factory and accept
        vm.prank(producer);
        sc.transfer(factory, 1, 300);
        vm.prank(factory);
        sc.acceptTransfer(1);

        // Factory token must inherit parent id = 1
        vm.prank(factory);
        sc.createToken("Roasted Lot", "Medium roast", 150, "{}");

        (,,,,,, uint256 parentId,) = sc.getTokenView(2);
        assertEq(parentId, 1);

        uint256 suggestedParent = sc.getSuggestedParent(factory);
        assertEq(suggestedParent, 1);
    }
}
