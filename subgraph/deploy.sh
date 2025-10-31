#!/bin/bash
set -euo pipefail

# ============================================
# Script de deploy completo para The Graph
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 [subgraph] Iniciando deploy completo..."

# 1. Verificar que Docker esté corriendo
echo "📦 [subgraph] Verificando servicios Docker..."
if ! docker compose ps | grep -q "Up"; then
    echo "⚠️  [subgraph] Servicios no están corriendo. Iniciando..."
    docker compose up -d
    echo "⏳ [subgraph] Esperando que los servicios estén listos (30s)..."
    sleep 30
else
    echo "✅ [subgraph] Servicios Docker ya están corriendo"
fi

# 2. Verificar que la blockchain esté disponible
echo "🔗 [subgraph] Verificando blockchain en localhost:8545..."
MAX_RETRIES=10
RETRY_COUNT=0
while ! curl -sSf -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    >/dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ [subgraph] ERROR: Blockchain no está disponible en localhost:8545"
        echo "   Ejecuta primero: cd ../scripts && ./deploy_local.sh"
        exit 1
    fi
    echo "   Esperando blockchain... (intento $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done
echo "✅ [subgraph] Blockchain disponible"

# 3. Generar tipos de TypeScript
echo "🔧 [subgraph] Generando tipos TypeScript..."
npm run codegen

# 4. Compilar subgraph
echo "🏗️  [subgraph] Compilando subgraph..."
npm run build

# 5. Verificar que graph-node esté listo
echo "⏳ [subgraph] Verificando que graph-node esté listo..."
MAX_RETRIES=20
RETRY_COUNT=0
while ! curl -sSf http://localhost:8020 >/dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ [subgraph] ERROR: graph-node no está disponible"
        echo "   Verifica los logs: docker compose logs graph-node"
        exit 1
    fi
    echo "   Esperando graph-node... (intento $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done
echo "✅ [subgraph] graph-node listo"

# 6. Crear subgraph (si no existe, ignorar error si ya existe)
echo "📝 [subgraph] Creando subgraph (si no existe)..."
npm run create-local 2>&1 | grep -v "already exists" || true

# 7. Desplegar subgraph
echo "🚀 [subgraph] Desplegando subgraph..."
npm run deploy-local

# 8. Verificar deployment
echo "🔍 [subgraph] Verificando deployment..."
sleep 3
RESPONSE=$(curl -sSf -X POST http://localhost:8000/subgraphs/name/supply-chain-tracker \
    -H "Content-Type: application/json" \
    -d '{"query": "{ _meta { block { number } hasIndexingErrors } }"}' || echo "error")

if echo "$RESPONSE" | grep -q '"hasIndexingErrors":false'; then
    echo "✅ [subgraph] Deploy exitoso!"
    echo "📊 [subgraph] Endpoint GraphQL: http://localhost:8000/subgraphs/name/supply-chain-tracker"
    echo ""
    echo "🧪 Prueba con:"
    echo "   curl -X POST http://localhost:8000/subgraphs/name/supply-chain-tracker \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"query\": \"{ tokens(first: 5) { id tokenId name txHash } }\"}'"
else
    echo "⚠️  [subgraph] Deploy completado pero hay posibles errores"
    echo "   Verifica los logs: docker compose logs -f graph-node"
fi

echo ""
echo "✨ [subgraph] Proceso completo!"
