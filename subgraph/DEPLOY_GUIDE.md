# 🚀 Guía de Deploy del Subgraph a The Graph Studio

Esta guía te llevará paso a paso para desplegar tu subgraph en The Graph Studio (Sepolia testnet).

## 📋 Pre-requisitos

✅ Ya desplegaste tu contrato en Sepolia  
✅ Tienes la dirección del contrato  
✅ Tienes el número de bloque donde se desplegó  

---

## 🎯 Paso 1: Crear Subgraph en The Graph Studio

### 1.1 Ir a The Graph Studio

Abre tu navegador:
```
https://thegraph.com/studio/
```

### 1.2 Conectar tu Wallet

1. Click en **"Connect Wallet"**
2. Selecciona Metamask (u otra wallet)
3. Autoriza la conexión

### 1.3 Crear un Nuevo Subgraph

1. Click en **"Create a Subgraph"**
2. Completa:
   - **Subgraph Name**: `supply-chain-tracker`
   - **Subtitle** (opcional): "Wine supply chain tracking"
   - **Description** (opcional): "Track wine from vineyard to consumer"
3. Click en **"Create Subgraph"**

### 1.4 Obtener el Deploy Key

Una vez creado, verás una página con:
- Tu **Subgraph Slug**: `supply-chain-tracker`
- Un **Deploy Key**: una cadena larga como `1234567890abcdef...`

**⚠️ IMPORTANTE: Copia este Deploy Key, lo necesitarás en el siguiente paso**

---

## 🔧 Paso 2: Configurar el Subgraph Localmente

### 2.1 Actualizar la Configuración

Edita el archivo `subgraph/subgraph.sepolia.yaml`:

```bash
cd subgraph
nano subgraph.sepolia.yaml
```

Actualiza estas líneas:

```yaml
dataSources:
  - kind: ethereum
    name: SupplyChain
    network: sepolia
    source:
      address: "0xTU_CONTRATO_AQUI"  # ← Dirección de tu contrato desplegado
      abi: SupplyChain
      startBlock: 12345678  # ← Bloque donde se desplegó tu contrato
```

**💡 Tip:** Puedes obtener el bloque de deployment desde Etherscan:
```
https://sepolia.etherscan.io/address/0xTU_CONTRATO
```
Mira el campo "Contract Creation" → "Block"

### 2.2 Copiar Configuración de Sepolia

```bash
cp subgraph.sepolia.yaml subgraph.yaml
```

### 2.3 Actualizar el ABI (si es necesario)

Si hiciste cambios al contrato:

```bash
cp ../sc/out/SupplyChain.sol/SupplyChain.json abis/SupplyChain.json
```

---

## 🔐 Paso 3: Autenticar con The Graph

Ejecuta el comando de autenticación y pega tu Deploy Key:

```bash
npm run auth
```

Te pedirá el Deploy Key:
```
✔ Product for which to initialize · subgraph-studio
✔ Deploy key · ********************************
```

Pega el Deploy Key que copiaste del paso 1.4 y presiona Enter.

Si fue exitoso, verás:
```
Deploy key set for https://api.studio.thegraph.com/deploy/
```

---

## 📦 Paso 4: Generar Código y Compilar

### 4.1 Generar tipos TypeScript

```bash
npm run codegen
```

Esto generará:
- `generated/schema.ts`
- `generated/SupplyChain/SupplyChain.ts`

### 4.2 Compilar el subgraph

```bash
npm run build
```

Esto creará la carpeta `build/` con todos los archivos necesarios.

**✅ Si todo compiló bien, verás:**
```
✔ Compile subgraph
✔ Write compiled subgraph to build/
```

---

## 🚀 Paso 5: Desplegar a The Graph Studio

### 5.1 Deploy

```bash
npm run deploy-testnet
```

Te pedirá confirmación:
```
✔ Version Label (e.g. v0.0.1) · v0.0.1
```

Presiona Enter para usar `v0.0.1` o escribe otra versión.

### 5.2 Esperar a que se despliegue

Verás output como:
```
✔ Upload subgraph to IPFS

Build completed: QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

Deployed to https://thegraph.com/studio/subgraph/supply-chain-tracker

Subgraph endpoints:
Queries (HTTP):     https://api.studio.thegraph.com/query/12345/supply-chain-tracker/v0.0.1
```

**🎉 ¡Tu subgraph está desplegado!**

---

## ⏱️ Paso 6: Esperar Sincronización

### 6.1 Ver el progreso

1. Ve a The Graph Studio: https://thegraph.com/studio/
2. Click en tu subgraph `supply-chain-tracker`
3. Verás el estado:
   - 🟡 **Syncing** - Está indexando eventos
   - 🟢 **Synced** - ¡Listo para usar!

La sincronización puede tomar **2-5 minutos** dependiendo de:
- Cantidad de bloques desde el `startBlock`
- Cantidad de eventos emitidos

### 6.2 Ver métricas

En The Graph Studio verás:
- **Sync Progress**: % completado
- **Current Block**: Bloque actual indexado
- **Entity Count**: Número de entidades (tokens, transfers, etc.)

---

## 🧪 Paso 7: Probar el Subgraph

### 7.1 Obtener la Query URL

En The Graph Studio, copia la **Query URL**:
```
https://api.studio.thegraph.com/query/12345/supply-chain-tracker/v0.0.1
```

### 7.2 Probar con curl

```bash
# Query básico para obtener tokens
curl -X POST \
  https://api.studio.thegraph.com/query/12345/supply-chain-tracker/v0.0.1 \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ tokens(first: 5) { id tokenId name txHash creator } }"
  }'
```

### 7.3 Probar en el Playground

The Graph Studio tiene un playground integrado:

1. Ve a tu subgraph en Studio
2. Click en **"Playground"**
3. Escribe queries GraphQL y ejecuta

Ejemplo de query:
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

---

## 🌐 Paso 8: Configurar el Frontend

Actualiza `web/.env.local`:

```bash
cd ../web
nano .env.local
```

Agrega la Query URL:

```bash
# The Graph Subgraph URL
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/12345/supply-chain-tracker/v0.0.1
```

Reemplaza `12345` con tu ID real.

### Reiniciar el frontend

```bash
# Si está corriendo, detenerlo (Ctrl+C) y reiniciar
npm run dev
```

---

## 🔄 Re-deployar (si haces cambios)

Si modificas el mapping o schema:

```bash
cd subgraph

# 1. Generar código
npm run codegen

# 2. Compilar
npm run build

# 3. Desplegar nueva versión
npm run deploy-testnet
# Cuando pida version: v0.0.2 (incrementar)
```

---

## 🐛 Troubleshooting

### Error: "Failed to deploy"

**Causa:** Configuración incorrecta o ABI desactualizado

**Solución:**
```bash
# Verificar configuración
cat subgraph.yaml | grep -A 3 "address:"

# Actualizar ABI
cp ../sc/out/SupplyChain.sol/SupplyChain.json abis/

# Limpiar y recompilar
rm -rf build/ generated/
npm run codegen
npm run build
npm run deploy-testnet
```

### Error: "Authentication failed"

**Causa:** Deploy Key incorrecto o expirado

**Solución:**
```bash
# Volver a autenticar
npm run auth
# Pegar nuevamente el Deploy Key desde The Graph Studio
```

### Subgraph no sincroniza

**Causa:** `startBlock` muy bajo o `address` incorrecta

**Solución:**
```bash
# Verificar dirección del contrato
nano subgraph.yaml

# Verificar en Etherscan que la dirección sea correcta
# Ajustar startBlock al bloque de deployment (no antes)

# Re-desplegar
npm run deploy-testnet
```

### "Block not found" o "Revert"

**Causa:** El RPC no tiene histórico completo

**Solución:** Aumentar el `startBlock` al bloque de deployment exacto

---

## 📊 Queries Útiles

### Obtener todos los tokens

```graphql
{
  tokens(first: 100) {
    id
    tokenId
    name
    txHash
    creator
    totalSupply
    availableSupply
  }
}
```

### Buscar tokens por creador

```graphql
{
  tokens(where: { creator: "0xTU_ADDRESS" }) {
    id
    tokenId
    name
    txHash
  }
}
```

### Obtener transfers de un token

```graphql
{
  transfers(where: { tokenId: "1" }) {
    id
    transferId
    from
    to
    amount
    status
    txHash
  }
}
```

### Últimas transferencias

```graphql
{
  transfers(first: 10, orderBy: dateCreated, orderDirection: desc) {
    id
    transferId
    tokenId
    from
    to
    status
    txHash
  }
}
```

---

## 🎯 Checklist Final

Antes de considerar el deployment completo:

- [ ] Subgraph desplegado en The Graph Studio
- [ ] Estado: **Synced** (verde)
- [ ] Queries funcionan en el Playground
- [ ] Frontend configurado con NEXT_PUBLIC_SUBGRAPH_URL
- [ ] Frontend muestra transaction hashes correctamente
- [ ] Probado crear token y ver el hash

---

## 📚 Referencias

- **The Graph Studio**: https://thegraph.com/studio/
- **The Graph Docs**: https://thegraph.com/docs/
- **GraphQL Docs**: https://graphql.org/learn/
- **Sepolia Etherscan**: https://sepolia.etherscan.io/

---

## 🎉 ¡Listo!

Tu subgraph ahora está indexando tu contrato en tiempo real. Cada vez que:
- Creas un token
- Haces una transferencia
- Cambias un estado

El subgraph capturará el evento y lo indexará automáticamente, incluyendo el **transaction hash**.

¡Disfruta de tu aplicación full-stack en Sepolia! 🚀
