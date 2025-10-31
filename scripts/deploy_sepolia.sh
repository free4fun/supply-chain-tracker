#!/bin/bash

# Script para desplegar Supply Chain a Sepolia testnet
# Uso: ./scripts/deploy_sepolia.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SC_DIR="$PROJECT_ROOT/sc"
SUBGRAPH_DIR="$PROJECT_ROOT/subgraph"
WEB_DIR="$PROJECT_ROOT/web"

echo "🚀 Supply Chain Deployment to Sepolia Testnet"
echo "=============================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Verificar que tenemos los requisitos
echo -e "${YELLOW}📋 Verificando requisitos...${NC}"

if [ ! -f "$SC_DIR/.env" ]; then
    echo -e "${RED}❌ No se encontró sc/.env${NC}"
    echo "Crea el archivo con:"
    echo "  SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
    echo "  PRIVATE_KEY=your_private_key"
    exit 1
fi

# Cargar variables de entorno
source "$SC_DIR/.env"

if [ -z "$SEPOLIA_RPC_URL" ]; then
    echo -e "${RED}❌ SEPOLIA_RPC_URL no está configurado en sc/.env${NC}"
    exit 1
fi

if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}❌ PRIVATE_KEY no está configurado en sc/.env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Requisitos OK${NC}"
echo ""

# Step 2: Compilar contrato
echo -e "${YELLOW}🔨 Compilando contrato...${NC}"
cd "$SC_DIR"
forge build
echo -e "${GREEN}✅ Contrato compilado${NC}"
echo ""

# Step 3: Desplegar contrato a Sepolia
echo -e "${YELLOW}📤 Desplegando contrato a Sepolia...${NC}"
echo "Esto puede tardar un minuto..."
echo ""

DEPLOY_OUTPUT=$(forge script script/Deploy.s.sol --rpc-url "$SEPOLIA_RPC_URL" --private-key "$PRIVATE_KEY" --broadcast --verify -vvvv 2>&1)
echo "$DEPLOY_OUTPUT"

# Extraer dirección del contrato del output
CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP "SupplyChain deployed at: \K0x[a-fA-F0-9]{40}" | head -1)
if [ -z "$CONTRACT_ADDRESS" ]; then
    # Intentar otra forma de extraer
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP "Contract Address: \K0x[a-fA-F0-9]{40}" | head -1)
fi

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo -e "${RED}❌ No se pudo extraer la dirección del contrato${NC}"
    echo "Revisa el output arriba y obtén la dirección manualmente"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Contrato desplegado en: $CONTRACT_ADDRESS${NC}"

# Extraer bloque de deployment (aproximado)
START_BLOCK=$(cast block-number --rpc-url "$SEPOLIA_RPC_URL")
echo -e "${GREEN}✅ Bloque de inicio: $START_BLOCK${NC}"
echo ""

# Step 4: Actualizar configuración del subgraph
echo -e "${YELLOW}📝 Actualizando configuración del subgraph...${NC}"
cd "$SUBGRAPH_DIR"

# Backup del archivo original
cp subgraph.sepolia.yaml subgraph.sepolia.yaml.bak

# Actualizar address y startBlock
sed -i "s/address: \"0x[a-fA-F0-9]*\"/address: \"$CONTRACT_ADDRESS\"/" subgraph.sepolia.yaml
sed -i "s/startBlock: [0-9]*/startBlock: $START_BLOCK/" subgraph.sepolia.yaml

echo -e "${GREEN}✅ Configuración actualizada${NC}"
echo ""

# Step 5: Actualizar ABI
echo -e "${YELLOW}📋 Actualizando ABI del contrato...${NC}"
cp "$SC_DIR/out/SupplyChain.sol/SupplyChain.json" "$SUBGRAPH_DIR/abis/SupplyChain.json"
echo -e "${GREEN}✅ ABI actualizado${NC}"
echo ""

# Step 6: Copiar config de sepolia como principal
cp subgraph.sepolia.yaml subgraph.yaml
echo -e "${GREEN}✅ Configuración de Sepolia activada${NC}"
echo ""

# Step 7: Actualizar .env del frontend
echo -e "${YELLOW}🌐 Actualizando configuración del frontend...${NC}"

if [ ! -f "$WEB_DIR/.env.local" ]; then
    touch "$WEB_DIR/.env.local"
fi

# Backup
cp "$WEB_DIR/.env.local" "$WEB_DIR/.env.local.bak"

# Actualizar o agregar variables
grep -q "NEXT_PUBLIC_CONTRACT_ADDRESS=" "$WEB_DIR/.env.local" && \
    sed -i "s|NEXT_PUBLIC_CONTRACT_ADDRESS=.*|NEXT_PUBLIC_CONTRACT_ADDRESS=$CONTRACT_ADDRESS|" "$WEB_DIR/.env.local" || \
    echo "NEXT_PUBLIC_CONTRACT_ADDRESS=$CONTRACT_ADDRESS" >> "$WEB_DIR/.env.local"

grep -q "NEXT_PUBLIC_CHAIN_ID=" "$WEB_DIR/.env.local" && \
    sed -i "s|NEXT_PUBLIC_CHAIN_ID=.*|NEXT_PUBLIC_CHAIN_ID=11155111|" "$WEB_DIR/.env.local" || \
    echo "NEXT_PUBLIC_CHAIN_ID=11155111" >> "$WEB_DIR/.env.local"

grep -q "NEXT_PUBLIC_RPC_URL=" "$WEB_DIR/.env.local" && \
    sed -i "s|NEXT_PUBLIC_RPC_URL=.*|NEXT_PUBLIC_RPC_URL=$SEPOLIA_RPC_URL|" "$WEB_DIR/.env.local" || \
    echo "NEXT_PUBLIC_RPC_URL=$SEPOLIA_RPC_URL" >> "$WEB_DIR/.env.local"

echo -e "${GREEN}✅ Frontend configurado para Sepolia${NC}"
echo ""

# Step 8: Instrucciones para el subgraph
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 ¡Deployment del contrato completado!${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📊 Información del deployment:${NC}"
echo "  • Contrato: $CONTRACT_ADDRESS"
echo "  • Red: Sepolia (Chain ID: 11155111)"
echo "  • Bloque inicio: $START_BLOCK"
echo "  • Explorador: https://sepolia.etherscan.io/address/$CONTRACT_ADDRESS"
echo ""
echo -e "${YELLOW}🔗 Próximos pasos para activar el subgraph:${NC}"
echo ""
echo "1️⃣  Instalar dependencias del subgraph (si no lo hiciste):"
echo "    cd subgraph"
echo "    npm install"
echo ""
echo "2️⃣  Ir a The Graph Studio y crear un subgraph:"
echo "    https://thegraph.com/studio/"
echo "    - Conecta tu wallet"
echo "    - Click 'Create a Subgraph'"
echo "    - Nombre: supply-chain-tracker"
echo "    - Red: Sepolia"
echo ""
echo "3️⃣  Copiar el Deploy Key de The Graph Studio"
echo ""
echo "4️⃣  Autenticar con The Graph:"
echo "    cd subgraph"
echo "    npm run auth"
echo "    # Pegar el Deploy Key cuando te lo pida"
echo ""
echo "5️⃣  Generar código y desplegar:"
echo "    npm run codegen"
echo "    npm run build"
echo "    npm run deploy-testnet"
echo ""
echo "6️⃣  Esperar a que el subgraph sincronice (2-5 minutos)"
echo "    Ver progreso en The Graph Studio"
echo ""
echo "7️⃣  Actualizar URL del subgraph en el frontend:"
echo "    Editar web/.env.local y agregar:"
echo "    NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/[YOUR_ID]/supply-chain-tracker/version/latest"
echo ""
echo -e "${GREEN}✨ Una vez hecho esto, tu app estará corriendo en Sepolia!${NC}"
echo ""
echo "💡 Tip: Guarda estos datos en un lugar seguro:"
echo "   - Dirección del contrato: $CONTRACT_ADDRESS"
echo "   - Bloque de inicio: $START_BLOCK"
echo ""
