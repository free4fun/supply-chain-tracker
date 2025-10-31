#!/bin/bash

# Script de setup para The Graph Subgraph
# Uso: ./setup.sh [local|testnet]

set -e

MODE=${1:-local}

echo "🚀 Supply Chain Tracker - Subgraph Setup"
echo "Mode: $MODE"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ "$MODE" = "local" ]; then
    echo -e "${YELLOW}📋 Setup para desarrollo local${NC}"
    echo ""
    
    # 1. Instalar dependencias
    echo "1️⃣  Instalando dependencias..."
    npm install
    
    # 2. Verificar docker
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker no está instalado. Instálalo desde https://docker.com"
        exit 1
    fi
    
    # 3. Levantar servicios
    echo ""
    echo "2️⃣  Levantando servicios de The Graph..."
    docker-compose up -d
    
    echo ""
    echo "⏳ Esperando que los servicios estén listos (30 segundos)..."
    sleep 30
    
    # 4. Verificar dirección del contrato
    echo ""
    echo -e "${YELLOW}3️⃣  Verifica la dirección del contrato en subgraph.yaml${NC}"
    echo "   Edita el archivo y actualiza la dirección si es necesario"
    echo ""
    read -p "Presiona ENTER cuando hayas actualizado la dirección..."
    
    # 5. Codegen
    echo ""
    echo "4️⃣  Generando código TypeScript..."
    npm run codegen
    
    # 6. Crear subgraph
    echo ""
    echo "5️⃣  Creando subgraph en el nodo local..."
    npm run create-local || echo "⚠️  Subgraph ya existe, continuando..."
    
    # 7. Deploy
    echo ""
    echo "6️⃣  Desplegando subgraph..."
    npm run deploy-local
    
    echo ""
    echo -e "${GREEN}✅ Setup completado!${NC}"
    echo ""
    echo "📊 Endpoints disponibles:"
    echo "   GraphQL Playground: http://localhost:8000/subgraphs/name/supply-chain-tracker"
    echo "   Queries: http://localhost:8000/subgraphs/name/supply-chain-tracker"
    echo ""
    echo "🧪 Prueba una query:"
    echo '   curl -X POST http://localhost:8000/subgraphs/name/supply-chain-tracker \\'
    echo '     -H "Content-Type: application/json" \\'
    echo '     -d '"'"'{"query": "{ tokens(first: 5) { id tokenId name txHash } }"}'"'"
    echo ""
    
elif [ "$MODE" = "testnet" ]; then
    echo -e "${YELLOW}📋 Setup para Sepolia testnet${NC}"
    echo ""
    
    # 1. Verificar archivo de testnet
    if [ ! -f "subgraph.sepolia.yaml" ]; then
        echo "❌ Archivo subgraph.sepolia.yaml no encontrado"
        exit 1
    fi
    
    # 2. Actualizar configuración
    echo "1️⃣  Actualiza subgraph.sepolia.yaml con:"
    echo "   - Dirección del contrato en Sepolia"
    echo "   - StartBlock (número de bloque del deploy)"
    echo ""
    read -p "Presiona ENTER cuando hayas actualizado la configuración..."
    
    # 3. Copiar configuración
    cp subgraph.sepolia.yaml subgraph.yaml
    
    # 4. Codegen
    echo ""
    echo "2️⃣  Generando código..."
    npm run codegen
    
    # 5. Build
    echo ""
    echo "3️⃣  Compilando subgraph..."
    npm run build
    
    # 6. Instrucciones para deploy
    echo ""
    echo -e "${YELLOW}4️⃣  Para desplegar a testnet:${NC}"
    echo ""
    echo "   a) Ve a https://thegraph.com/studio/"
    echo "   b) Conecta tu wallet"
    echo "   c) Crea un nuevo subgraph"
    echo "   d) Copia el deploy key"
    echo "   e) Ejecuta: npm run auth"
    echo "   f) Pega el deploy key"
    echo "   g) Ejecuta: npm run deploy-testnet"
    echo ""
    
else
    echo "❌ Modo inválido. Usa: ./setup.sh [local|testnet]"
    exit 1
fi
