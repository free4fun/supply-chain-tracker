// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.24;

// Suppress state mutability warnings for vm cheatcodes (not actually view-compatible)
// solhint-disable func-visibility, state-visibility
pragma solidity >=0.8.0;

import {Script, console2} from "forge-std/Script.sol";
import {SupplyChain} from "../src/SupplyChain.sol";

/// @notice Seeds the local chain with demo users, tokens, and transfers
/// Usage:
///   forge script script/Seed.s.sol \
///     --rpc-url http://127.0.0.1:8545 \
///     --broadcast \
///     --sig "run(address)" <SUPPLY_CHAIN_ADDRESS>
contract Seed is Script {
    // Default derivation path; mnemonic MUST come from environment (sc/.env.local)
    string constant DEFAULT_DERIVATION_PATH = "m/44'/60'/0'/0/"; // base; indexes 0..N

    // -------------- utils --------------
    /// @dev Cannot be view because vm.envString is not view in forge-std
    // solhint-disable-next-line func-visibility
    function _parseUint(string memory s, uint256 def) internal pure returns (uint256) {
        bytes memory b = bytes(s);
        if (b.length == 0) return def;
        uint256 res = 0;
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c < 48 || c > 57) return def; // non-digit
            res = res * 10 + (c - 48);
        }
        return res;
    }

    /// @dev Cannot be view because vm.envString is not view in forge-std
    function _envUintOr(string memory key, uint256 def) internal returns (uint256) {
        try vm.envString(key) returns (string memory v) {
            if (bytes(v).length == 0) return def;
            return _parseUint(v, def);
        } catch {
            return def;
        }
    }

    function _shipments(uint256 total, uint256 n) internal pure returns (uint256[] memory a) {
        if (n == 0) {
            a = new uint256[](0);
            return a;
        }
        a = new uint256[](n);
        uint256 chunk = total / n;
        for (uint256 i = 0; i < n; i++) {
            a[i] = chunk;
        }
        // add remainder to last
        a[n - 1] += total - chunk * n;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _letter(uint256 idx) internal pure returns (string memory) {
        bytes memory alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        bytes1 ch = alphabet[idx % 26];
        return string(abi.encodePacked(ch));
    }

    /// @dev Cannot be view because vm.envString/deriveKey are not view in forge-std
    function _derive(uint32 index) internal returns (uint256 pk, address addr) {
        // Read secrets from environment; MNEMONIC is required
        string memory m = vm.envString("MNEMONIC");
        string memory path = DEFAULT_DERIVATION_PATH;
        try vm.envString("DERIVATION_PATH") returns (string memory p) {
            if (bytes(p).length > 0) path = p;
        } catch {}
        pk = vm.deriveKey(m, path, index);
        addr = vm.addr(pk);
    }

    function _approve(SupplyChain sc, address user) internal {
        // Admin is index 0
        (uint256 pkAdmin, ) = _derive(0);
        vm.startBroadcast(pkAdmin);
        sc.changeStatusUser(user, SupplyChain.UserStatus.Approved);
        vm.stopBroadcast();
    }

    function _register(SupplyChain sc, uint32 idx, string memory role, string memory company, string memory first, string memory last) internal returns (address user) {
        (uint256 pk, address addr) = _derive(idx);
        vm.startBroadcast(pk);
        sc.registerAndRequestRole(company, first, last, role);
        vm.stopBroadcast();
        _approve(sc, addr);
        return addr;
    }

    function run(address supplyChainAddr) external {
        SupplyChain sc = SupplyChain(supplyChainAddr);

        console2.log("[seed] Using SupplyChain:", supplyChainAddr);

        // ---- Configurable parameters via env ----
        uint256 CHAINS = _envUintOr("SEED_CHAINS", 2);                 // number of actor sets
        uint256 LOTS_PER_CHAIN = _envUintOr("SEED_LOTS_PER_CHAIN", 1);  // root lots per producer
        uint256 TRANSFERS_PER_STAGE = _envUintOr("SEED_TRANSFERS_PER_STAGE", 1); // shipments per stage

        uint256 ROOT_SUPPLY = _envUintOr("SEED_ROOT_SUPPLY", 1000);
        uint256 PF_TOTAL = _envUintOr("SEED_PROD_TO_FACTORY_TOTAL", 300);
        uint256 FACTORY_CONSUME = _envUintOr("SEED_FACTORY_CONSUME", 200);
        uint256 FR_TOTAL = _envUintOr("SEED_FACTORY_TO_RETAIL_TOTAL", 120);
        uint256 RETAIL_CONSUME = _envUintOr("SEED_RETAIL_CONSUME", 50);
        uint256 RC_TOTAL = _envUintOr("SEED_RETAIL_TO_CONSUMER_TOTAL", 5);

        // Admin info
        (, address admin) = _derive(0);
        console2.log("[seed] Admin:", admin);

        for (uint256 i = 0; i < CHAINS; i++) {
            uint32 base = uint32(1 + i * 4);
            ( , address producer) = _derive(base);
            ( , address factory)  = _derive(base + 1);
            ( , address retailer) = _derive(base + 2);
            ( , address consumer) = _derive(base + 3);

            console2.log("[seed] Chain", i + 1);
            console2.log("  Producer:", producer);
            console2.log("  Factory:", factory);
            console2.log("  Retailer:", retailer);
            console2.log("  Consumer:", consumer);

            // Register + approve with varied realistic data
            string[8] memory producerNames = ["Valle Verde S.A.", "Finca Los Andes", "Agropecuaria del Sur", "Vinas Patagonicas", "Cosecha Natural", "Campo Dorado", "Tierras Altas", "Granja Organica"];
            string[8] memory producerFirstNames = ["Maria", "Carlos", "Sofia", "Diego", "Ana", "Roberto", "Laura", "Fernando"];
            string[8] memory producerLastNames = ["Rodriguez", "Fernandez", "Lopez", "Garcia", "Martinez", "Sanchez", "Diaz", "Torres"];
            
            string[8] memory factoryNames = ["Bodega Los Andes", "Vinos del Valle", "Bodega Austral", "Vinificadora Patagonica", "Cava Artesanal", "Bodega Organica", "Vinos Selectos", "Bodega Regional"];
            string[8] memory factoryFirstNames = ["Juan", "Patricia", "Miguel", "Valeria", "Ricardo", "Gabriela", "Alejandro", "Claudia"];
            
            string[8] memory retailerNames = ["Vinoteca Ciudad", "Comercio de Vinos", "Tienda Gourmet", "Distribuidor Premium", "Almacen de Vinos", "Bodega Retail", "Vinos y Licores", "Comercial Selecta"];
            string[8] memory retailerFirstNames = ["Pedro", "Carolina", "Luis", "Monica", "Sergio", "Andrea", "Daniel", "Beatriz"];
            
            string[8] memory consumerFirstNames = ["Jorge", "Silvia", "Pablo", "Marcela", "Martin", "Veronica", "Gustavo", "Adriana"];
            string[8] memory consumerLastNames = ["Alvarez", "Ramirez", "Castro", "Morales", "Herrera", "Nunez", "Silva", "Vargas"];
            
            producer = _register(sc, base,     "Producer", producerNames[i % 8], producerFirstNames[i % 8], producerLastNames[i % 8]);
            factory  = _register(sc, base + 1, "Factory",  factoryNames[i % 8], factoryFirstNames[i % 8], producerLastNames[(i+1) % 8]);
            retailer = _register(sc, base + 2, "Retailer", retailerNames[i % 8], retailerFirstNames[i % 8], producerLastNames[(i+2) % 8]);
            consumer = _register(sc, base + 3, "Consumer", "Consumidor Final", consumerFirstNames[i % 8], consumerLastNames[i % 8]);

            // Shipment distributions
            uint256[] memory pfShip = _shipments(PF_TOTAL, TRANSFERS_PER_STAGE);
            uint256[] memory frShip = _shipments(FR_TOTAL, TRANSFERS_PER_STAGE);
            uint256[] memory rcShip = _shipments(RC_TOTAL, TRANSFERS_PER_STAGE);

            // Product variety data
            string[6] memory varieties = ["Malbec", "Cabernet", "Merlot", "Chardonnay", "Torrontes", "Syrah"];
            string[6] memory origins = ["Mendoza", "Patagonia", "San Juan", "Salta", "La Rioja", "Neuquen"];
            string[4] memory months = ["08", "09", "10", "11"];
            bool[2] memory organic = [true, false];
            
            for (uint256 j = 0; j < LOTS_PER_CHAIN; j++) {
                // Producer creates root token with varied realistic attributes
                (uint256 pkProd, ) = _derive(base);
                uint256 varietyIdx = (i * LOTS_PER_CHAIN + j) % 6;
                uint256 monthIdx = (i + j) % 4;
                bool isOrganic = organic[(i + j) % 2];
                
                string memory lotCode = string.concat(
                    _letter(varietyIdx), 
                    "-2025-",
                    months[monthIdx],
                    "-",
                    _letter(j)
                );
                
                vm.startBroadcast(pkProd);
                sc.createToken(
                    string.concat("Uvas ", varieties[varietyIdx], " Lote ", lotCode),
                    string.concat(
                        isOrganic ? "Uvas organicas certificadas" : "Uvas de cultivo convencional",
                        ", cosecha 2025-",
                        months[monthIdx],
                        ", region ",
                        origins[varietyIdx % 6]
                    ),
                    ROOT_SUPPLY,
                    string.concat(
                        "{\"variety\":\"", varieties[varietyIdx], 
                        "\",\"origin\":\"", origins[varietyIdx % 6],
                        "\",\"harvest\":\"2025-", months[monthIdx],
                        "\",\"organic\":", isOrganic ? "true" : "false",
                        ",\"lot\":\"", lotCode,
                        "\",\"certification\":\"", isOrganic ? "SENASA-ORG-2025" : "SENASA-STD-2025",
                        "\"}"
                    ),
                    new uint256[](0),
                    new uint256[](0)
                );
                vm.stopBroadcast();
                uint256 tokenRoot = sc.nextTokenId() - 1;

                // Producer -> Factory transfers
                uint256 acceptedToFactory = 0;
                for (uint256 t = 0; t < pfShip.length; t++) {
                    vm.startBroadcast(pkProd);
                    sc.transfer(factory, tokenRoot, pfShip[t]);
                    vm.stopBroadcast();
                    uint256 trId = sc.nextTransferId() - 1;

                    // Odd chains: first shipment rejected to simulate incident
                    if ((i % 2 == 1) && t == 0) {
                        (uint256 pkFac,) = _derive(base + 1);
                        vm.startBroadcast(pkFac);
                        sc.rejectTransfer(trId);
                        vm.stopBroadcast();
                    } else {
                        (uint256 pkFac,) = _derive(base + 1);
                        vm.startBroadcast(pkFac);
                        sc.acceptTransfer(trId);
                        vm.stopBroadcast();
                        acceptedToFactory += pfShip[t];
                    }
                }

                // Factory creates derived token from accepted components
                string[4] memory processes = ["fermentacion-barrica", "fermentacion-tanque", "macerado-frio", "crianza-roble"];
                string[4] memory batchPrefixes = ["VI", "RE", "CR", "GR"];
                
                uint256 consumeFactory = _min(FACTORY_CONSUME, acceptedToFactory);
                if (consumeFactory > 0) {
                    (uint256 pkFac2,) = _derive(base + 1);
                    uint256 processIdx = (i + j) % 4;
                    string memory batchCode = string.concat(
                        batchPrefixes[processIdx],
                        "-",
                        _letter(varietyIdx),
                        "-",
                        months[monthIdx]
                    );
                    
                    vm.startBroadcast(pkFac2);
                    uint256[] memory ids = new uint256[](1);
                    uint256[] memory amts = new uint256[](1);
                    ids[0] = tokenRoot; amts[0] = consumeFactory;
                    sc.createToken(
                        string.concat("Vino ", varieties[varietyIdx], " ", batchCode),
                        string.concat(
                            "Vino elaborado por ",
                            processes[processIdx],
                            ", lote ",
                            batchCode,
                            ", cosecha 2025"
                        ),
                        consumeFactory,
                        string.concat(
                            "{\"type\":\"wine\",\"process\":\"", processes[processIdx],
                            "\",\"batch\":\"", batchCode,
                            "\",\"alcohol\":\"13.5\",\"vintage\":\"2025\",\"aging\":\"6-months\"}"
                        ),
                        ids, amts
                    );
                    vm.stopBroadcast();
                }
                uint256 tokenFactory = sc.nextTokenId() - 1;

                // Factory -> Retailer transfers
                uint256 acceptedToRetail = 0;
                if (consumeFactory > 0) {
                    (uint256 pkFac3,) = _derive(base + 1);
                    for (uint256 t2 = 0; t2 < frShip.length; t2++) {
                        vm.startBroadcast(pkFac3);
                        sc.transfer(retailer, tokenFactory, frShip[t2]);
                        vm.stopBroadcast();
                        uint256 trId2 = sc.nextTransferId() - 1;
                        (uint256 pkRet,) = _derive(base + 2);
                        vm.startBroadcast(pkRet);
                        sc.acceptTransfer(trId2);
                        vm.stopBroadcast();
                        acceptedToRetail += frShip[t2];
                    }
                }

                // Retailer creates packaged product from received
                string[4] memory packages = ["6x750ml", "12x750ml", "3x1.5L", "1x3L"];
                string[4] memory labels = ["Reserva", "Gran Reserva", "Premium", "Seleccion Especial"];
                uint256 consumeRetail = _min(RETAIL_CONSUME, acceptedToRetail);
                if (consumeRetail > 0) {
                    (uint256 pkRet2,) = _derive(base + 2);
                    uint256 pkgIdx = (i + j) % 4;
                    
                    vm.startBroadcast(pkRet2);
                    uint256[] memory ids2 = new uint256[](1);
                    uint256[] memory amts2 = new uint256[](1);
                    ids2[0] = tokenFactory; amts2[0] = consumeRetail;
                    sc.createToken(
                        string.concat(
                            "Vino ", varieties[varietyIdx], " Embotellado ",
                            labels[pkgIdx]
                        ),
                        string.concat(
                            "Pack ", packages[pkgIdx], " etiqueta ",
                            labels[pkgIdx], ", listo para distribucion, cosecha 2025"
                        ),
                        consumeRetail,
                        string.concat(
                            "{\"package\":\"", packages[pkgIdx],
                            "\",\"label\":\"", labels[pkgIdx],
                            "\",\"barcode\":\"779", _letter(varietyIdx), _letter(pkgIdx),
                            "\",\"vintage\":\"2025\",\"appellation\":\"D.O.C.\"}"
                        ),
                        ids2, amts2
                    );
                    vm.stopBroadcast();
                }
                uint256 tokenRetail = sc.nextTokenId() - 1;

                // Retailer -> Consumer transfers (accept all, optionally cancel one on odd chains)
                if (consumeRetail > 0) {
                    (uint256 pkRet3,) = _derive(base + 2);
                    for (uint256 t3 = 0; t3 < rcShip.length; t3++) {
                        vm.startBroadcast(pkRet3);
                        sc.transfer(consumer, tokenRetail, rcShip[t3]);
                        vm.stopBroadcast();
                        uint256 trId3 = sc.nextTransferId() - 1;

                        if ((i % 2 == 1) && rcShip.length >= 2 && t3 == rcShip.length - 1) {
                            // simulate cancellation of the last transfer on odd chains
                            vm.startBroadcast(pkRet3);
                            sc.cancelTransfer(trId3);
                            vm.stopBroadcast();
                        } else {
                            (uint256 pkCon,) = _derive(base + 3);
                            vm.startBroadcast(pkCon);
                            sc.acceptTransfer(trId3);
                            vm.stopBroadcast();
                        }
                    }
                }
            }
        }

        console2.log("[seed] Done.");
    }
}
