# 🎯 Guía de Implementación: Transaction Hashes con The Graph

## ✅ Lo que está listo

He configurado **The Graph** para indexar tu contrato y obtener transaction hashes de forma eficiente.

### Estructura creada:

```
subgraph/
├── package.json              # Dependencias de The Graph
├── schema.graphql            # Schema de datos (Token, Transfer, User)
├── subgraph.yaml            # Config para LOCAL
├── subgraph.sepolia.yaml    # Config para TESTNET (listo para usar)
├── docker-compose.yml       # Nodo local de The Graph
├── setup.sh                 # Script de instalación automática
├── src/
│   └── mapping.ts           # Lógica de indexación (captura txHash)
└── abis/
    └── SupplyChain.json     # ABI del contrato

web/src/
├── lib/
│   └── subgraph.ts          # Cliente para consultas GraphQL
└── components/
    └── TokenTxHash.tsx      # Componente UI para mostrar hash
```

## 🚀 Uso rápido

### Paso 1: Setup inicial (LOCAL)

```bash
cd subgraph

# Opción A: Script automático
./setup.sh local

# Opción B: Manual
npm install
docker-compose up -d
# Esperar 30 segundos
npm run codegen
npm run create-local
npm run deploy-local
```

### Paso 2: Actualizar dirección del contrato

En `subgraph/subgraph.yaml`, línea 10:

```yaml
source:
  address: "0x..." # <-- Poner tu dirección del contrato local
```

Luego re-desplegar:

```bash
npm run deploy-local
```

### Paso 3: Probar que funciona

```bash
# Query de prueba
curl -X POST http://localhost:8000/subgraphs/name/supply-chain-tracker \
  -H "Content-Type: application/json" \
  -d '{"query": "{ tokens(first: 5) { id tokenId name txHash } }"}'
```

## 📝 Uso en el Frontend

### Opción 1: Componente directo

```tsx
import { TokenTxHash } from '@/components/TokenTxHash';

// En cualquier componente
<TokenTxHash tokenId={123} chainId={31337} />
```

### Opción 2: Hook personalizado

```tsx
import { useTokenTxHash } from '@/lib/subgraph';

function MyComponent() {
  const { txHash, loading } = useTokenTxHash(tokenId);
  
  if (loading) return <span>Cargando...</span>;
  if (!txHash) return <span>#{tokenId}</span>;
  
  return <span>#{tokenId} · {txHash.slice(0, 10)}...</span>;
}
```

### Opción 3: Función directa

```tsx
import { getTokenTxHash } from '@/lib/subgraph';

const hash = await getTokenTxHash(123);
console.log(hash); // "0x1234abcd..."
```

## 🌐 Migrar a Testnet (Sepolia)

### Paso 1: Desplegar contrato a Sepolia

```bash
cd sc
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast
```

Anota:
- Dirección del contrato: `0x...`
- Número de bloque: `12345678`

### Paso 2: Actualizar configuración

En `subgraph/subgraph.sepolia.yaml`:

```yaml
source:
  address: "0x..."        # <-- Dirección en Sepolia
  startBlock: 12345678    # <-- Bloque del deploy
```

### Paso 3: Crear subgraph en The Graph Studio

1. Ve a https://thegraph.com/studio/
2. Conecta wallet
3. Click "Create a Subgraph"
4. Nombre: `supply-chain-tracker`
5. Copia el **Deploy Key**

### Paso 4: Desplegar

```bash
cd subgraph

# Usar config de testnet
cp subgraph.sepolia.yaml subgraph.yaml

# Autenticar
npm run auth
# Pegar el Deploy Key

# Desplegar
npm run deploy-testnet
```

### Paso 5: Actualizar frontend

En `web/.env.local`:

```bash
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/<ID>/supply-chain-tracker/version/latest
```

## 📊 Queries útiles

### Obtener token con hash

```graphql
{
  token(id: "1") {
    tokenId
    name
    txHash
    blockNumber
    creator
    dateCreated
  }
}
```

### Últimos tokens creados

```graphql
{
  tokens(first: 10, orderBy: dateCreated, orderDirection: desc) {
    tokenId
    name
    txHash
    creator
    creatorCompany
  }
}
```

### Tokens de un usuario

```graphql
{
  tokens(where: { creator: "0x..." }) {
    tokenId
    name
    txHash
  }
}
```

### Transfer con hash

```graphql
{
  transfer(id: "1") {
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

## 🔧 Integración en TokenDetailModal

```tsx
// En TokenDetailModal.tsx
import { TokenTxHash } from '@/components/TokenTxHash';

// En el header
<div className="flex items-center gap-3">
  <h2>Token #{detail.id}</h2>
  <TokenTxHash tokenId={detail.id} />
</div>
```

## 🐛 Troubleshooting

### "Subgraph not syncing"
```bash
# Ver logs
docker-compose logs -f graph-node

# Reiniciar
docker-compose restart
```

### "Connection refused"
```bash
# Verificar que Hardhat esté corriendo
# Puerto 8545 debe estar abierto
```

### "IPFS timeout"
```bash
docker-compose restart ipfs
```

### Limpiar y empezar de nuevo
```bash
docker-compose down -v
rm -rf data/
docker-compose up -d
# Esperar 30 segundos
npm run create-local
npm run deploy-local
```

## 💡 Ventajas de esta implementación

✅ **Transaction hash real** del blockchain
✅ **Cero gas adicional** - solo indexación
✅ **Funciona en local** para desarrollo
✅ **Listo para testnet** - solo cambiar config
✅ **Caché automático** en localStorage
✅ **Queries rápidas** con GraphQL
✅ **Histórico completo** de todos los tokens
✅ **Escalable** - soporta miles de tokens

## 📚 Referencias

- [The Graph Docs](https://thegraph.com/docs/)
- [GraphQL](https://graphql.org/learn/)
- [Subgraph Studio](https://thegraph.com/studio/)

## 🎯 Próximos pasos

1. ✅ Instalar y configurar nodo local
2. ✅ Desplegar subgraph localmente
3. ✅ Probar queries
4. 🔄 Integrar en UI (TokenDetailModal, listas de tokens)
5. 🔄 Desplegar a testnet cuando estés listo
6. 🔄 Publicar subgraph (opcional, para hacerlo público)
