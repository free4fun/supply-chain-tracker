# 🚀 Guía de Deployment a Sepolia Testnet

Esta guía te llevará paso a paso para desplegar tu Supply Chain Tracker en la testnet de Sepolia con subgraph activo.

## 📋 Pre-requisitos

### 1. Obtener Sepolia ETH (para gas)

Necesitas ETH en Sepolia para pagar el gas del deployment:

- **Alchemy Faucet**: https://sepoliafaucet.com/
- **Infura Faucet**: https://www.infura.io/faucet/sepolia
- **Chainlink Faucet**: https://faucets.chain.link/sepolia

Necesitarás aproximadamente **0.1 ETH** en Sepolia.

### 2. Obtener API Key de RPC Provider

Escoge uno:

**Opción A - Alchemy (Recomendado)**
1. Ve a https://www.alchemy.com/
2. Crea cuenta gratis
3. Crea una nueva App → Red: Ethereum Sepolia
4. Copia tu API Key

Tu URL será: `https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY`

**Opción B - Infura**
1. Ve a https://www.infura.io/
2. Crea cuenta gratis
3. Crea un nuevo proyecto → Red: Sepolia
4. Copia tu Project ID

Tu URL será: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`

### 3. Preparar tu Private Key

Exporta la private key de tu wallet (Metamask):
1. Abre Metamask
2. Click en los 3 puntos → Account details
3. Click en "Show private key"
4. Ingresa tu password
5. Copia la key (empieza con `0x...`)

⚠️ **NUNCA compartas tu private key ni la subas a Git**

---

## 🔧 Paso 1: Configurar Variables de Entorno

### 1.1 Configurar el Smart Contract

Crea el archivo `sc/.env`:

```bash
cd sc
cp .env.example .env
nano .env
```

Agrega **SOLO** estas variables (NO incluyas PRIVATE_KEY):

```bash
# Sepolia RPC URL (Alchemy o Infura)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Admin address (tu wallet address)
ADMIN_ADDRESS=0xYOUR_WALLET_ADDRESS

# Etherscan API Key (opcional, para verificar el contrato)
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

### 1.2 🔐 Configurar Private Key de Forma Segura

Tienes **3 opciones** (de más segura a menos segura):

#### **Opción A: Foundry Keystore (MÁS SEGURA) ⭐ Recomendado**

Tu private key se guarda **cifrada** con una contraseña:

```bash
# Ejecutar el setup una sola vez
./scripts/setup_keystore.sh

# Seguir las instrucciones:
# 1. Nombrar tu wallet (ej: "sepolia-deployer")
# 2. Ingresar tu private key (una sola vez)
# 3. Elegir contraseña para cifrarla
```

**Beneficios:**
- ✅ Private key **nunca** en texto plano
- ✅ Cifrada con contraseña AES-256
- ✅ Estándar de la industria (Foundry)
- ✅ Soporte multi-wallet (dev, testnet, mainnet)
- ✅ No necesitas archivos .env con keys

**Desplegar usando keystore:**
```bash
# Si el script fue auto-generado
./scripts/deploy_sepolia_keystore.sh

# O manualmente
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --account sepolia-deployer \
  --sender 0xYOUR_ADDRESS \
  --broadcast
```

#### **Opción B: Input Seguro en Terminal (SEGURA)**

El script te pedirá tu private key de forma segura (no se muestra en pantalla):

```bash
./scripts/deploy_sepolia.sh

# Te pedirá:
# 🔐 Ingresa tu private key (no se mostrará en pantalla):
# [ingresar key sin que se vea]
```

**Beneficios:**
- ✅ No se guarda en archivos
- ✅ No queda en historial de bash (input oculto)
- ✅ Se solicita solo cuando despliegas

#### **Opción C: Variable de Entorno Temporal (MENOS SEGURA)**

Solo para testing rápido en entorno local seguro:

```bash
# Exportar solo por esta sesión (no se guarda)
export PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# Desplegar
cd sc
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

⚠️ **NO RECOMENDADO** porque queda en historial de bash.

### 1.3 Obtener Etherscan API Key (opcional pero recomendado)
1. Ve a https://etherscan.io/
2. Crea cuenta
3. My Account → API Keys → Add
4. Copia la key

### 1.2 Verificar que el archivo está en .gitignore

```bash
# Verificar
cat ../.gitignore | grep .env

# Si no está, agrégalo
echo "sc/.env" >> ../.gitignore
```

---

## 🚀 Paso 2: Desplegar el Contrato

### 2.1 Ejecutar el script de deployment

```bash
# Desde la raíz del proyecto
chmod +x scripts/deploy_sepolia.sh
./scripts/deploy_sepolia.sh
```

El script hará automáticamente:
- ✅ Compilar el contrato
- ✅ Desplegar a Sepolia
- ✅ Verificar en Etherscan
- ✅ Actualizar configuración del subgraph
- ✅ Actualizar configuración del frontend

**Guarda la información que te muestra:**
- Dirección del contrato
- Bloque de inicio
- Link de Etherscan

### 2.2 Si el script falla, deployment manual:

```bash
cd sc

# Compilar
forge build

# Desplegar y verificar
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  -vvvv
```

**Importante:** Anota la dirección del contrato del output.

---

## 📊 Paso 3: Configurar y Desplegar el Subgraph

### 3.1 Instalar dependencias

```bash
cd subgraph
npm install
```

### 3.2 Crear subgraph en The Graph Studio

1. Ve a **https://thegraph.com/studio/**
2. Conecta tu wallet (Metamask)
3. Click en **"Create a Subgraph"**
4. Configuración:
   - **Nombre**: `supply-chain-tracker`
   - **Subtitle**: Supply Chain Tracker
   - **Network**: Sepolia
5. Click **"Create Subgraph"**
6. **Copia el Deploy Key** que aparece (lo necesitarás en el siguiente paso)

### 3.3 Autenticar con The Graph

```bash
npm run auth
```

Pega el **Deploy Key** cuando te lo pida.

### 3.4 Verificar configuración

```bash
# Ver que la dirección del contrato esté correcta
cat subgraph.yaml | grep address

# Ver el bloque de inicio
cat subgraph.yaml | grep startBlock
```

Si necesitas actualizar manualmente:

```bash
nano subgraph.yaml
```

Edita:
```yaml
source:
  address: "0xTU_CONTRATO_AQUI"
  startBlock: 12345678  # Bloque del deployment
```

### 3.5 Generar código y desplegar

```bash
# Generar tipos TypeScript
npm run codegen

# Compilar subgraph
npm run build

# Desplegar a The Graph Studio
npm run deploy-testnet
```

**Importante:** La primera vez que despliegues puede tardar 2-5 minutos en sincronizar.

### 3.6 Verificar que esté sincronizando

1. Ve a The Graph Studio: https://thegraph.com/studio/
2. Click en tu subgraph `supply-chain-tracker`
3. Verás el progreso de sincronización
4. Cuando diga **"Synced"** está listo!

---

## 🌐 Paso 4: Configurar el Frontend

### 4.1 Actualizar .env.local

Edita `web/.env.local`:

```bash
cd web
nano .env.local
```

Agrega/actualiza:

```bash
# Dirección del contrato en Sepolia
NEXT_PUBLIC_CONTRACT_ADDRESS=0xTU_CONTRATO_DESPLEGADO

# Chain ID de Sepolia
NEXT_PUBLIC_CHAIN_ID=11155111

# RPC URL de Sepolia
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Admin address
NEXT_PUBLIC_ADMIN_ADDRESS=0xTU_WALLET_ADDRESS

# URL del subgraph (obtenerla de The Graph Studio)
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/[YOUR_ID]/supply-chain-tracker/version/latest
```

**Para obtener la URL del subgraph:**
1. Ve a The Graph Studio
2. Click en tu subgraph
3. Tab **"Details"**
4. Copia la **"Query URL"**

### 4.2 Instalar dependencias y ejecutar

```bash
# Si no lo hiciste antes
npm install

# Ejecutar en modo desarrollo
npm run dev
```

Abre http://localhost:3000

### 4.3 Conectar con Metamask

1. Asegúrate de estar en la red **Sepolia** en Metamask
2. Click en "Conectar wallet" en la aplicación
3. Acepta la conexión

---

## ✅ Paso 5: Probar la Aplicación

### 5.1 Verificar que el contrato esté accesible

```bash
# Desde sc/
cast call $CONTRACT_ADDRESS "admin()(address)" --rpc-url $SEPOLIA_RPC_URL
```

Debería retornar tu wallet address.

### 5.2 Probar el subgraph

```bash
# Query de prueba
curl -X POST https://api.studio.thegraph.com/query/[YOUR_ID]/supply-chain-tracker/version/latest \
  -H "Content-Type: application/json" \
  -d '{"query": "{ tokens(first: 5) { id tokenId name txHash } }"}'
```

### 5.3 Crear un token de prueba

1. En la app, ve a **"Perfil"**
2. Solicita rol de **Producer**
3. Como eres admin, apruébate en **Admin → Users**
4. Ve a **"Crear activos"**
5. Crea un token de prueba
6. Verifica que el hash de transacción aparezca correctamente

### 5.4 Verificar en Etherscan

Copia el hash de transacción y pégalo en:
https://sepolia.etherscan.io/tx/[TU_TX_HASH]

---

## 🔄 Actualizaciones y Mantenimiento

### Re-desplegar el contrato (si haces cambios)

```bash
./scripts/deploy_sepolia.sh
```

Luego actualiza el subgraph:

```bash
cd subgraph
nano subgraph.yaml  # Actualizar address y startBlock
npm run codegen
npm run build
npm run deploy-testnet
```

### Ver logs del subgraph

En The Graph Studio → Tu subgraph → Tab "Logs"

### Limpiar caché del subgraph

```bash
cd subgraph
rm -rf build/ generated/
npm run codegen
npm run build
npm run deploy-testnet
```

---

## 🐛 Troubleshooting

### Error: "insufficient funds"
- Necesitas más ETH en Sepolia. Usa los faucets mencionados arriba.

### Error: "nonce too low"
- Espera un momento y vuelve a intentar
- O resetea el nonce de tu wallet en Metamask: Settings → Advanced → Reset Account

### Subgraph no sincroniza
- Verifica que el `startBlock` sea correcto
- Verifica que la `address` del contrato sea correcta
- Revisa los logs en The Graph Studio

### Frontend no conecta con el contrato
- Verifica que `NEXT_PUBLIC_CONTRACT_ADDRESS` esté correcto en `.env.local`
- Verifica que estés en la red Sepolia en Metamask
- Verifica que el RPC URL funcione

### "Hash unavailable" en tokens creados
- Espera 1-2 minutos para que el subgraph indexe
- Verifica que `NEXT_PUBLIC_SUBGRAPH_URL` esté correcta
- Revisa que el subgraph esté "Synced" en The Graph Studio

---

## 📚 Enlaces Útiles

- **Sepolia Etherscan**: https://sepolia.etherscan.io/
- **The Graph Studio**: https://thegraph.com/studio/
- **Alchemy Dashboard**: https://dashboard.alchemy.com/
- **Sepolia Faucets**: https://sepoliafaucet.com/
- **Foundry Book**: https://book.getfoundry.sh/

---

## 🎉 ¡Listo!

Tu aplicación ahora está corriendo en Sepolia testnet con:
- ✅ Smart contract verificado en Etherscan
- ✅ Subgraph indexando eventos en tiempo real
- ✅ Frontend conectado y funcional
- ✅ Transaction hashes visibles para todos los tokens

Para producción (mainnet), el proceso es similar pero necesitarás:
- ETH real para gas (más caro)
- Publicar el subgraph (no solo en Studio)
- Configurar dominio y hosting

¡Buena suerte! 🚀
