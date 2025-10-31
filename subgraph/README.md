# The Graph Subgraph - Supply Chain Tracker

Subgraph para indexar eventos del contrato SupplyChain y obtener transaction hashes.

## 🚀 Setup Local

Por defecto, el script `scripts/deploy_local.sh` despliega los contratos en Anvil y pre-popula la blockchain con datos de demo (usuarios, tokens y transfers) para que el subgraph tenga eventos que indexar. Puedes desactivar el seed con `SEED=0`.

### 1. Instalar dependencias

```bash
cd subgraph
npm install
```

### 2. Levantar nodo local de The Graph

```bash
docker-compose up -d
```

Espera ~30 segundos para que los servicios estén listos.

### 3. Actualizar dirección del contrato

En `subgraph.yaml`, actualiza la dirección del contrato con la de tu deploy local:

```yaml
source:
  address: "0x5FbDB2315678afecb367f032d93F642f64180aa3" # <-- ACTUALIZAR
```

### 4. Generar código

```bash
npm run build # opcional, compila el subgraph
npm run codegen
```

### 5. Crear subgraph en el nodo local

```bash
npm run create-local
```

### 6. Desplegar

```bash
npm run deploy-local
```

Sugerido: antes de compilar/desplegar el subgraph, genera datos ficticios en la chain local ejecutando en la raíz del repo:

```bash
./scripts/deploy_local.sh           # crea usuarios/tokens/transfers de demo (usa SEED=0 para omitir)
```

## 📝 Queries de ejemplo

El subgraph estará disponible en: `http://localhost:8000/subgraphs/name/supply-chain-tracker`

### Obtener token con tx hash

```graphql
{
  token(id: "1") {
    id
    tokenId
    name
    txHash
    blockNumber
    creator
    dateCreated
  }
}
```

### Obtener todos los tokens

```graphql
{
  tokens(first: 10, orderBy: dateCreated, orderDirection: desc) {
    id
    tokenId
    name
    txHash
    creator
    dateCreated
  }
}
```

### Obtener transfers con tx hash

```graphql
{
  transfers(first: 10, orderBy: dateCreated, orderDirection: desc) {
    id
    transferId
    txHash
    from
    to
    tokenId
    amount
    status
  }
}
```

## 🌐 Migrar a Testnet (Sepolia)

### 1. Actualizar subgraph.yaml

```yaml
dataSources:
  - kind: ethereum
    name: SupplyChain
    network: sepolia # <-- Cambiar de 'localhost' a 'sepolia'
    source:
      address: "0x..." # <-- Dirección en Sepolia
      abi: SupplyChain
      startBlock: 12345678 # <-- Bloque donde se desplegó
```

### 2. Crear cuenta en The Graph Studio

1. Ve a <https://thegraph.com/studio/>
2. Conecta tu wallet
3. Crea un nuevo subgraph

### 3. Autenticar

```bash
npm run auth
# Pega el deploy key del Studio
```

### 4. Desplegar a testnet

```bash
npm run deploy-testnet
```

## 🔧 Comandos útiles

```bash
# Regenerar código después de cambios en schema
npm run codegen

# Compilar
npm run build

# Ver logs del graph-node
docker-compose logs -f graph-node

# Detener nodo local
docker-compose down

# Limpiar todo (incluyendo datos)
docker-compose down -v
rm -rf data/
```

## 📊 Endpoints

- **GraphQL Playground**: <http://localhost:8000/subgraphs/name/supply-chain-tracker>
- **HTTP Queries**: <http://localhost:8000/subgraphs/name/supply-chain-tracker>
- **WebSocket**: <ws://localhost:8001/subgraphs/name/supply-chain-tracker>

## 🎯 Integración con Frontend

```typescript
// web/src/lib/subgraph.ts
const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || 
  'http://localhost:8000/subgraphs/name/supply-chain-tracker'

export async function getTokenTxHash(tokenId: number): Promise<string | null> {
  const query = `{
    token(id: "${tokenId}") {
      txHash
    }
  }`
  
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  })
  
  const data = await response.json()
  return data.data?.token?.txHash || null
}
```

## 🐛 Troubleshooting

### "Error connecting to Ethereum"

- Asegúrate de que Hardhat/Foundry esté corriendo en puerto 8545
- Verifica que docker-compose pueda acceder a `host.docker.internal`

### "Subgraph not found"

- Ejecuta `npm run create-local` antes de deploy

### "IPFS timeout"

- Espera más tiempo o reinicia: `docker-compose restart ipfs`
