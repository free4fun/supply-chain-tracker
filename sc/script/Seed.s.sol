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

    /// @dev Simple uint to string conversion to avoid vm.toString() ambiguity
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
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
            string[8] memory producerNames = [
                "Vinedo Valle de Uco S.A.",
                "Finca Los Aromos",
                "Bodega Familiar Zunino",
                "Vinedos Patagonicos",
                "Finca La Consulta",
                "Vinedo Alto Agrelo",
                "Vinedos del Valle de Pedernal",
                "Finca Altamira"
            ];
            string[8] memory producerFirstNames = ["Maria Soledad", "Carlos Alberto", "Sofia Elena", "Diego Martin", "Ana Victoria", "Roberto Javier", "Laura Beatriz", "Fernando Gabriel"];
            string[8] memory producerLastNames = ["Rodriguez Paz", "Fernandez Silva", "Lopez Martinez", "Garcia Ruiz", "Martinez Soto", "Sanchez Diaz", "Diaz Moreno", "Torres Castro"];
            
            string[8] memory factoryNames = [
                "Bodega Catena Zapata",
                "Bodega Norton",
                "Bodega Trapiche",
                "Bodega Luigi Bosca",
                "Bodega Zuccardi",
                "Bodega Ruca Malen",
                "Bodega Altos Las Hormigas",
                "Bodega Salentein"
            ];
            string[8] memory factoryFirstNames = ["Juan Pablo", "Patricia Soledad", "Miguel Angel", "Valeria Fernanda", "Ricardo Jose", "Gabriela Ines", "Alejandro Luis", "Claudia Marcela"];
            
            string[8] memory retailerNames = [
                "Vinoteca El Buen Vino",
                "Wines & More Argentina",
                "La Casa del Vino",
                "Premium Wine Selection",
                "Vinoteca del Centro",
                "Distribuidor Vinos Selectos",
                "Comercial Vitivinicola Sur",
                "Grand Cru Importaciones"
            ];
            string[8] memory retailerFirstNames = ["Pedro Ignacio", "Carolina Andrea", "Luis Fernando", "Monica Alejandra", "Sergio Daniel", "Andrea Susana", "Daniel Eduardo", "Beatriz Cristina"];
            
            string[8] memory consumerFirstNames = ["Jorge Luis", "Silvia Beatriz", "Pablo Andres", "Marcela Viviana", "Martin Ezequiel", "Veronica Paola", "Gustavo Raul", "Adriana Isabel"];
            string[8] memory consumerLastNames = ["Alvarez Perez", "Ramirez Gomez", "Castro Herrera", "Morales Nunez", "Herrera Vargas", "Nunez Acosta", "Silva Mendez", "Vargas Flores"];
            
            producer = _register(sc, base,     "Producer", producerNames[i % 8], producerFirstNames[i % 8], producerLastNames[i % 8]);
            factory  = _register(sc, base + 1, "Factory",  factoryNames[i % 8], factoryFirstNames[i % 8], producerLastNames[(i+1) % 8]);
            retailer = _register(sc, base + 2, "Retailer", retailerNames[i % 8], retailerFirstNames[i % 8], producerLastNames[(i+2) % 8]);
            consumer = _register(sc, base + 3, "Consumer", "Consumidor Final", consumerFirstNames[i % 8], consumerLastNames[i % 8]);

            // Shipment distributions
            uint256[] memory pfShip = _shipments(PF_TOTAL, TRANSFERS_PER_STAGE);
            uint256[] memory frShip = _shipments(FR_TOTAL, TRANSFERS_PER_STAGE);
            uint256[] memory rcShip = _shipments(RC_TOTAL, TRANSFERS_PER_STAGE);

            // Product variety data - Cepas y regiones argentinas
            string[8] memory varieties = ["Malbec", "Cabernet Sauvignon", "Merlot", "Chardonnay", "Torrontes", "Syrah", "Bonarda", "Pinot Noir"];
            string[8] memory regions = ["VUC", "LUC", "MAP", "CAF", "PAT", "PED", "TUP", "NEU"];  // Codigos de region
            string[8] memory origins = ["Valle de Uco, Mendoza", "Lujan de Cuyo, Mendoza", "Maipu, Mendoza", "Cafayate, Salta", "Patagonia, Rio Negro", "Valle de Pedernal, San Juan", "Tupungato, Mendoza", "Neuquen"];
            string[8] memory parcels = ["Cuadro 5 Norte", "Parcela A-12", "Lote 7 Sur", "Seccion B-8", "Cuadro 3 Este", "Parcela C-15", "Lote 9 Oeste", "Seccion D-4"];
            string[8] memory soilTypes = ["Franco arenoso aluvial", "Arcillo-limoso", "Pedregoso calcareo", "Franco arcilloso", "Arenoso con grava", "Limoso profundo", "Arcilloso ferrico", "Franco limoso"];
            string[4] memory months = ["02", "03", "04", "05"];  // Vendimia Argentina: Feb-Mayo
            uint16[4] memory altitudes = [950, 1100, 1250, 1400];  // Metros sobre el nivel del mar
            bool[2] memory organic = [true, false];
            
            for (uint256 j = 0; j < LOTS_PER_CHAIN; j++) {
                // Producer creates root token with varied realistic attributes
                (uint256 pkProd, ) = _derive(base);
                uint256 varietyIdx = (i * LOTS_PER_CHAIN + j) % 8;
                uint256 regionIdx = varietyIdx;
                uint256 monthIdx = (i + j) % 4;
                uint256 altIdx = (i + j) % 4;
                bool isOrganic = organic[(i + j) % 2];
                
                string memory lotCode = string.concat(
                    "UVA-",
                    regions[regionIdx],
                    "-",
                    _letter(varietyIdx),
                    _uint2str(altitudes[altIdx]),
                    "-",
                    _letter(i),
                    _letter(j)
                );
                
                vm.startBroadcast(pkProd);
                sc.createToken(
                    string.concat("Lote Uvas ", varieties[varietyIdx], " ", lotCode),
                    string.concat(
                        isOrganic ? "Uvas organicas certificadas SENASA " : "Uvas de vina tradicional ",
                        "cosechadas manualmente en vendimia 2025-",
                        months[monthIdx],
                        ". Origen: ",
                        origins[varietyIdx],
                        ". Parcela: ",
                        parcels[varietyIdx],
                        "."
                    ),
                    ROOT_SUPPLY,
                    string.concat(
                        "{\"grapeVariety\":\"", varieties[varietyIdx],
                        "\",\"harvestDate\":\"2025-03-", (j < 5) ? "15" : "28",
                        "\",\"parcel\":\"", parcels[varietyIdx],
                        "\",\"weightKg\":", _uint2str(ROOT_SUPPLY),
                        ",\"vineyardAltitude\":", _uint2str(altitudes[altIdx]),
                        ",\"soil\":\"", soilTypes[altIdx],
                        "\",\"organic\":", isOrganic ? "true" : "false",
                        ",\"certification\":\"", isOrganic ? "SENASA-ORG-2025-" : "SENASA-STD-2025-", _uint2str(i*100+j),
                        "\",\"brixGrades\":\"23.5\",\"phLevel\":\"3.4\",\"region\":\"", origins[varietyIdx],
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
                string[8] memory wineNames = [
                    "Reserva de Altura",
                    "Gran Reserva",
                    "Single Vineyard",
                    "Estate Reserve",
                    "Clasico",
                    "Premium Selection",
                    "Terroir",
                    "Limited Edition"
                ];
                string[8] memory processes = [
                    "Fermentacion en barrica francesa",
                    "Fermentacion en tanque de acero inoxidable",
                    "Macerado en frio pre-fermentativo",
                    "Crianza 12 meses en roble americano",
                    "Fermentacion con levaduras autoctonas",
                    "Crianza 18 meses en roble frances",
                    "Fermentacion malolactica en barrica",
                    "Crianza sur lies 6 meses"
                ];
                string[8] memory alcoholGrades = ["13.5", "14.0", "13.8", "14.5", "13.2", "14.2", "13.7", "14.8"];
                string[8] memory tastingNotes = [
                    "Notas a frutos rojos maduros, taninos sedosos, final largo y persistente",
                    "Aromas a ciruela y especias, cuerpo medio, taninos firmes",
                    "Frutas negras, vainilla, chocolate, estructura compleja",
                    "Cerezas, violetas, taninos suaves, muy equilibrado",
                    "Fresco y frutal, notas florales, taninos jovenes",
                    "Concentrado, frutos negros, roble tostado, elegante",
                    "Mineral, frutas oscuras, taninos integrados",
                    "Intenso, mermelada de frutos del bosque, especiado"
                ];
                
                uint256 consumeFactory = _min(FACTORY_CONSUME, acceptedToFactory);
                if (consumeFactory > 0) {
                    (uint256 pkFac2,) = _derive(base + 1);
                    uint256 processIdx = (i + j) % 8;
                    string memory batchCode = string.concat(
                        "VN-",
                        _uint2str(2025),
                        "-",
                        _letter(varietyIdx),
                        "-",
                        _uint2str((i*1000 + j*10 + processIdx))
                    );
                    
                    vm.startBroadcast(pkFac2);
                    uint256[] memory ids = new uint256[](1);
                    uint256[] memory amts = new uint256[](1);
                    ids[0] = tokenRoot; amts[0] = consumeFactory;
                    sc.createToken(
                        string.concat("Vino ", varieties[varietyIdx], " ", wineNames[processIdx], " ", batchCode),
                        string.concat(
                            "Vino elaborado mediante ",
                            processes[processIdx],
                            ". Batch: ",
                            batchCode,
                            ". Cosecha 2025. Alcohol: ",
                            alcoholGrades[processIdx],
                            "%vol"
                        ),
                        consumeFactory,
                        string.concat(
                            "{\"wineName\":\"", varieties[varietyIdx], " ", wineNames[processIdx],
                            "\",\"vintage\":\"2025",
                            "\",\"alcohol\":\"", alcoholGrades[processIdx],
                            "\",\"fermentation\":\"", processes[processIdx],
                            "\",\"agingMonths\":\"", processIdx < 4 ? "6" : "12",
                            "\",\"tastingNotes\":\"", tastingNotes[processIdx],
                            "\",\"batch\":\"", batchCode,
                            "\",\"bottlingDate\":\"2025-", months[(monthIdx+6)%4], "-01",
                            "\",\"sulphites\":\"Contains sulphites\",\"temperature\":\"16-18C\"}"
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
                string[8] memory packages = ["Caja 6x750ml", "Caja 12x750ml", "Pack 3x1.5L Magnum", "Caja 1x3L Doble Magnum", "Estuche Premium 2x750ml", "Caja 6x375ml", "Gift Box 1x750ml", "Pack 4x187ml"];
                string[8] memory labels = [
                    "Reserva Especial",
                    "Gran Reserva",
                    "Linea Premium",
                    "Seleccion del Enologo",
                    "Edicion Limitada",
                    "Terroir Selection",
                    "Estate Collection",
                    "Icon Series"
                ];
                string[8] memory markets = [
                    "Exportacion - Estados Unidos",
                    "Mercado interno - Premium",
                    "Exportacion - Europa",
                    "Gastronomia - Alta gama",
                    "Eventos corporativos",
                    "Exportacion - Asia",
                    "Mercado interno - Delicatessen",
                    "Wine clubs exclusivos"
                ];
                string[8] memory pairings = [
                    "Carnes rojas a la parrilla, cordero patagonico",
                    "Pastas con salsas intensas, risottos",
                    "Quesos maduros, embutidos artesanales",
                    "Caza mayor, estofados",
                    "Pescados grasos, mariscos",
                    "Aves de corral, cerdo",
                    "Platos especiados, curry",
                    "Postres con chocolate, frutos secos"
                ];
                
                uint256 consumeRetail = _min(RETAIL_CONSUME, acceptedToRetail);
                if (consumeRetail > 0) {
                    (uint256 pkRet2,) = _derive(base + 2);
                    uint256 pkgIdx = (i + j) % 8;
                    string memory ean = string.concat("779", _uint2str(1000000 + (i*10000 + j*100 + pkgIdx)));
                    
                    vm.startBroadcast(pkRet2);
                    uint256[] memory ids2 = new uint256[](1);
                    uint256[] memory amts2 = new uint256[](1);
                    ids2[0] = tokenFactory; amts2[0] = consumeRetail;
                    sc.createToken(
                        string.concat(
                            varieties[varietyIdx], " ",
                            labels[pkgIdx], " ",
                            packages[pkgIdx]
                        ),
                        string.concat(
                            "Vino embotellado y etiquetado. ",
                            packages[pkgIdx], " - ",
                            labels[pkgIdx],
                            ". Listo para distribucion. Cosecha 2025. Destino: ",
                            markets[pkgIdx]
                        ),
                        consumeRetail,
                        string.concat(
                            "{\"packName\":\"", labels[pkgIdx],
                            "\",\"packagingDate\":\"2025-", months[(monthIdx+8)%4], "-15",
                            "\",\"bottleCount\":\"", pkgIdx < 2 ? (pkgIdx == 0 ? "6" : "12") : (pkgIdx == 2 ? "3" : "1"),
                            "\",\"pairing\":\"", pairings[pkgIdx],
                            "\",\"market\":\"", markets[pkgIdx],
                            "\",\"shelfLifeMonths\":\"36",
                            "\",\"barcode\":\"", ean,
                            "\",\"appellation\":\"D.O.C. Mendoza\",\"importer\":\"", pkgIdx % 2 == 0 ? "Wine Importers LLC" : "N/A",
                            "\"}"
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
