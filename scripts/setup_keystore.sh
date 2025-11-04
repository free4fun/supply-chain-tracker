#!/bin/bash

# Script para configurar Foundry Keystore (wallet cifrada)
# Esto es la forma MÁS SEGURA de manejar private keys con Foundry

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Foundry Keystore Setup${NC}"
echo "================================"
echo ""
echo "Este script te ayudará a crear una wallet cifrada con Foundry."
echo "Es la forma MÁS SEGURA de manejar tu private key."
echo ""

# Verificar que cast esté instalado
if ! command -v cast &> /dev/null; then
    echo -e "${RED}❌ Error: 'cast' no está instalado${NC}"
    echo "Instala Foundry desde: https://book.getfoundry.sh/getting-started/installation"
    exit 1
fi

echo -e "${YELLOW}📝 Instrucciones:${NC}"
echo "1. Te pediremos tu private key (una sola vez)"
echo "2. Elegirás una contraseña fuerte para cifrarla"
echo "3. La key se guardará cifrada en ~/.foundry/keystores/"
echo "4. Nunca más tendrás que ingresar tu private key"
echo ""
read -p "¿Continuar? (yes/no): " -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Setup cancelado${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🔑 Nombre de tu wallet:${NC}"
echo "   (Ej: sepolia-deployer, mainnet-admin, etc.)"
read -r ACCOUNT_NAME

if [ -z "$ACCOUNT_NAME" ]; then
    echo -e "${RED}❌ Nombre requerido${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔐 Ingresa tu private key (no se mostrará):${NC}"
echo "   ⚠️  Debe comenzar con 0x"
read -s -r PRIVATE_KEY
echo ""

# Validar formato
if [[ ! "$PRIVATE_KEY" =~ ^0x[a-fA-F0-9]{64}$ ]]; then
    echo -e "${RED}❌ Private key inválida${NC}"
    exit 1
fi

echo -e "${YELLOW}🔒 Ahora elige una contraseña para CIFRAR tu key:${NC}"
echo "   (Esta contraseña la necesitarás cada vez que despliegues)"

# Usar cast wallet import para cifrar la key
echo "$PRIVATE_KEY" | cast wallet import "$ACCOUNT_NAME" --interactive

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Wallet cifrada exitosamente!${NC}"
    echo ""
    echo -e "${BLUE}📍 Ubicación: ~/.foundry/keystores/$ACCOUNT_NAME${NC}"
    echo ""
    
    # Obtener la dirección pública
    ADDRESS=$(cast wallet address --account "$ACCOUNT_NAME" --password "")
    
    echo -e "${GREEN}📬 Dirección pública:${NC}"
    echo "   $ADDRESS"
    echo ""
    
    echo -e "${YELLOW}🚀 Cómo usar:${NC}"
    echo ""
    echo "Para desplegar usando esta wallet:"
    echo ""
    echo -e "${BLUE}./scripts/deploy_sepolia_keystore.sh $ACCOUNT_NAME${NC}"
    echo ""
    echo "O manualmente con Foundry:"
    echo ""
    echo -e "${BLUE}forge script script/Deploy.s.sol \\${NC}"
    echo -e "${BLUE}  --rpc-url \$SEPOLIA_RPC_URL \\${NC}"
    echo -e "${BLUE}  --account $ACCOUNT_NAME \\${NC}"
    echo -e "${BLUE}  --sender $ADDRESS \\${NC}"
    echo -e "${BLUE}  --broadcast${NC}"
    echo ""
    echo -e "${GREEN}💡 Beneficios:${NC}"
    echo "   • Tu private key NUNCA está en texto plano"
    echo "   • Cifrada con tu contraseña"
    echo "   • No necesitas archivos .env con keys"
    echo "   • Estándar de la industria (Foundry)"
    echo ""
    
    # Crear script de deployment usando keystore
    echo -e "${YELLOW}¿Crear script de deployment usando esta wallet? (yes/no):${NC}"
    read -r CREATE_SCRIPT
    
    if [ "$CREATE_SCRIPT" = "yes" ]; then
        cat > "$SCRIPT_DIR/deploy_sepolia_keystore.sh" << EOF
#!/bin/bash
# Auto-generated deployment script using Foundry Keystore
# Account: $ACCOUNT_NAME
# Address: $ADDRESS

set -e

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="\$(dirname "\$SCRIPT_DIR")"
SC_DIR="\$PROJECT_ROOT/sc"

cd "\$SC_DIR"

# Cargar RPC URL
if [ -f .env ]; then
    export \$(grep SEPOLIA_RPC_URL .env | xargs)
fi

if [ -z "\$SEPOLIA_RPC_URL" ]; then
    echo "Error: SEPOLIA_RPC_URL no configurado en sc/.env"
    exit 1
fi

echo "🚀 Deploying to Sepolia..."
echo "Account: $ACCOUNT_NAME"
echo "Address: $ADDRESS"
echo ""

forge script script/Deploy.s.sol \\
  --rpc-url "\$SEPOLIA_RPC_URL" \\
  --account "$ACCOUNT_NAME" \\
  --sender "$ADDRESS" \\
  --broadcast \\
  --verify \\
  -vvvv

echo ""
echo "✅ Deployment complete!"
EOF
        chmod +x "$SCRIPT_DIR/deploy_sepolia_keystore.sh"
        echo -e "${GREEN}✅ Script creado: scripts/deploy_sepolia_keystore.sh${NC}"
    fi
    
else
    echo -e "${RED}❌ Error al importar la wallet${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "   • NO pierdas tu contraseña"
echo "   • Haz backup de ~/.foundry/keystores/$ACCOUNT_NAME"
echo "   • Puedes crear múltiples wallets (dev, testnet, mainnet)"
echo ""
