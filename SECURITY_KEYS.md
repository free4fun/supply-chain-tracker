# 🔐 Guía de Seguridad: Manejo de Private Keys

Esta guía explica las mejores prácticas para manejar private keys de forma segura en este proyecto.

## 🎯 Resumen Ejecutivo

**NUNCA guardes tu private key en archivos de texto plano.**

Este proyecto ofrece **3 métodos** para manejar private keys, del más seguro al menos seguro:

| Método | Seguridad | Uso Recomendado |
|--------|-----------|-----------------|
| **Foundry Keystore** | ⭐⭐⭐⭐⭐ | Producción, Testnet |
| **Input en Terminal** | ⭐⭐⭐⭐ | Testing, Deployments ocasionales |
| **Variable de Entorno** | ⭐⭐ | Solo desarrollo local |

---

## 🏆 Método 1: Foundry Keystore (MÁS SEGURO)

### ¿Qué es?

Foundry Keystore es un sistema de gestión de wallets cifradas que viene incluido con Foundry. Funciona similar a cómo Metamask guarda tus keys:

- Tu private key se **cifra** con una contraseña usando AES-256
- Se guarda en `~/.foundry/keystores/`
- Solo tú puedes descifrarla con tu contraseña

### Ventajas

✅ **Cifrado fuerte**: AES-256, estándar de la industria  
✅ **Sin archivos .env**: No hay riesgo de subirla a Git  
✅ **Multi-wallet**: Puedes tener varias (dev, testnet, mainnet)  
✅ **Auditable**: Foundry es open source y ampliamente usado  
✅ **Compatible**: Funciona con todos los comandos de Foundry  

### Cómo configurar

```bash
# 1. Ejecutar el script de setup
./scripts/setup_keystore.sh

# 2. Seguir las instrucciones interactivas
# - Nombrar tu wallet (ej: "sepolia-deployer")
# - Ingresar private key (una sola vez, input oculto)
# - Elegir contraseña fuerte para cifrarla

# 3. Tu wallet queda guardada cifrada en:
# ~/.foundry/keystores/sepolia-deployer
```

### Cómo usar

```bash
# Opción A: Usar el script auto-generado
./scripts/deploy_sepolia_keystore.sh
# Te pedirá la contraseña del keystore

# Opción B: Comando manual de Foundry
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --account sepolia-deployer \
  --sender 0xYOUR_ADDRESS \
  --broadcast
# Te pedirá la contraseña del keystore
```

### Backup y recuperación

```bash
# Hacer backup del keystore
cp ~/.foundry/keystores/sepolia-deployer ~/backup/

# Restaurar desde backup
cp ~/backup/sepolia-deployer ~/.foundry/keystores/

# Listar todas tus wallets
ls ~/.foundry/keystores/
```

### ¿Qué pasa si pierdo mi contraseña?

❌ **No hay forma de recuperar la private key sin la contraseña.**

Por eso es importante:
1. Usar una contraseña que RECUERDES
2. Guardar la contraseña en un gestor de contraseñas (1Password, Bitwarden, etc.)
3. Hacer backup del archivo del keystore

---

## 🔒 Método 2: Input Seguro en Terminal

### ¿Qué es?

El script `deploy_sepolia.sh` te pide tu private key de forma segura usando `read -s`, que:
- No muestra la key en pantalla mientras la escribes
- No la guarda en ningún archivo
- No queda en el historial de bash

### Ventajas

✅ **Simple**: No requiere configuración previa  
✅ **Sin archivos**: No se guarda en .env ni en ningún lado  
✅ **Input oculto**: No se ve en pantalla  
✅ **Validación**: Verifica formato antes de usarla  

### Cómo usar

```bash
./scripts/deploy_sepolia.sh

# El script te pedirá:
# 🔐 Ingresa tu private key (no se mostrará en pantalla):
# [escribir aquí sin que se vea]
```

### Limitaciones

⚠️ Tienes que ingresar tu private key cada vez que despliegas  
⚠️ Si te equivocas al escribirla, el deployment fallará  
⚠️ Menos conveniente para deployments frecuentes  

### ¿Es seguro?

**Sí**, mientras:
- Nadie esté mirando tu pantalla
- No uses un keylogger (malware)
- Confíes en tu terminal (no terminal remota insegura)

---

## ⚠️ Método 3: Variable de Entorno Temporal

### ¿Qué es?

Exportar la private key como variable de entorno de la sesión actual.

### Ventajas

✅ **Rápido**: Para testing local muy rápido  
✅ **Temporal**: Solo existe durante la sesión  

### Cómo usar

```bash
# Exportar (solo esta sesión de terminal)
export PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# Desplegar
cd sc
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast

# Al cerrar la terminal, la variable desaparece
```

### Limitaciones y Riesgos

❌ **Queda en historial de bash** (`.bash_history`)  
❌ **Visible con `env`** mientras está exportada  
❌ **Puede loggearse** en sistemas de monitoreo  
❌ **Riesgo de copy-paste** accidental en chat/logs  

### Mitigación de riesgos

Si vas a usar este método:

```bash
# 1. Desactivar historial temporalmente
set +o history

# 2. Exportar la variable
export PRIVATE_KEY=0xYOUR_KEY

# 3. Usar inmediatamente
forge script ...

# 4. Limpiar
unset PRIVATE_KEY

# 5. Reactivar historial
set -o history

# 6. Cerrar terminal cuando termines
exit
```

---

## 🚫 Lo que NUNCA debes hacer

### ❌ Guardar en .env (texto plano)

```bash
# ❌ MAL - NUNCA HAGAS ESTO
echo "PRIVATE_KEY=0xYOUR_KEY" >> .env
```

**Riesgos:**
- Se puede subir a Git por accidente
- Otros procesos pueden leerlo
- Visible en backups automáticos
- Puede quedar en caché de editores

### ❌ Hardcodear en scripts

```bash
# ❌ MAL - NUNCA HAGAS ESTO
PRIVATE_KEY="0xYOUR_KEY"
forge script ... --private-key $PRIVATE_KEY
```

**Riesgos:**
- Se sube a Git directamente
- Visible en el historial de commits
- Imposible de borrar completamente de Git

### ❌ Compartir por chat/email

```
# ❌ MAL - NUNCA HAGAS ESTO
"Oye, usa mi private key: 0x..."
```

**Riesgos:**
- Queda en logs de Slack/Discord/Email
- Puede ser interceptado
- Otros pueden verlo

### ❌ Usar la misma key para todo

**Riesgos:**
- Si se compromete una, se comprometen todas
- No hay separación de responsabilidades
- Difícil de auditar

---

## ✅ Mejores Prácticas Generales

### 1. Separación de Keys

Usa diferentes wallets para diferentes propósitos:

```bash
# Desarrollo local (puede ser pública)
cast wallet import local-dev --private-key 0xac09...

# Testnet (semi-sensible)
cast wallet import sepolia-deployer --private-key 0x...

# Mainnet (MUY SENSIBLE)
cast wallet import mainnet-deployer --private-key 0x...

# Admin (CRÍTICA)
cast wallet import mainnet-admin --private-key 0x...
```

### 2. Permisos de Archivos

Si por alguna razón TIENES que guardar algo sensible:

```bash
# Solo tú puedes leerlo
chmod 600 sensitive-file

# Verificar
ls -l sensitive-file
# -rw------- (solo owner puede leer/escribir)
```

### 3. Verificar antes de Commitear

```bash
# Antes de hacer commit
git status
git diff

# Verificar que no haya keys
grep -r "PRIVATE_KEY\|0x[a-f0-9]{64}" .

# Listar archivos que Git va a incluir
git ls-files

# Si encontraste algo sensible
git reset HEAD archivo.env
git checkout -- archivo.env
```

### 4. Usar .gitignore Correctamente

```bash
# Ya incluido en este proyecto
cat .gitignore | grep -E "\.env|\.key|\.pem"

# Resultado esperado:
.env
.env.local
*.key
*.pem
**/keystores/
```

### 5. Auditar Historial de Git

```bash
# Buscar si alguna vez se subió una key
git log -p --all -S "PRIVATE_KEY"

# Si encuentras algo, tienes que limpiar el historial
# (proceso complejo, mejor prevenir)
```

### 6. Rotación de Keys

Si sospechas que tu key fue comprometida:

1. **Inmediatamente:** Mueve fondos a una wallet nueva
2. **Actualizar:** Cambia ownership de contratos si es posible
3. **Crear nueva:** Genera una nueva key para futuro
4. **Documentar:** Anota qué pasó para aprender

---

## 🎓 Conceptos de Seguridad

### ¿Qué es una Private Key?

```
Private Key (64 hex chars):
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Derivada →

Public Key (130 hex chars):
0x04... (comprimida a 66 chars: 0x02... o 0x03...)

Derivada →

Address (40 hex chars):
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

**Regla de Oro:**
- ✅ Puedes compartir: Address
- ⚠️ Compartir con cuidado: Public Key (no es crítico pero mejor no)
- ❌ NUNCA compartir: Private Key

### ¿Por qué es tan importante?

Tu private key:
- Controla TODO el dinero en esa address
- Firma transacciones en tu nombre
- No se puede cambiar (la address va ligada a la key)
- Si alguien más la tiene, puede vaciar tu wallet

### Mnemonic vs Private Key

```
Mnemonic (12 o 24 palabras):
witch collapse practice feed shame open despair creek road again ice least

Deriva múltiples private keys:
  m/44'/60'/0'/0/0 → 0xac09... (Account 1)
  m/44'/60'/0'/0/1 → 0xf523... (Account 2)
  m/44'/60'/0'/0/2 → 0x8bd2... (Account 3)
  ...
```

**Implicación:**
- Si pierdes tu MNEMONIC, pierdes TODAS las cuentas
- El mnemonic es AÚN MÁS sensible que una private key individual

---

## 📚 Recursos Adicionales

- [Foundry Book - Wallet Management](https://book.getfoundry.sh/reference/cast/cast-wallet)
- [Ethereum Foundation - Key Management](https://ethereum.org/en/developers/docs/accounts/)
- [OWASP - Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

---

## 🆘 ¿Qué hacer si comprometí mi key?

Si accidentalmente:
- Subiste tu key a Git
- La compartiste por chat
- La guardaste en texto plano

**Acción inmediata:**

1. **Mover fondos YA** (si hay alguno)
   ```bash
   cast send 0xNUEVA_WALLET --value 1ether --private-key $OLD_KEY
   ```

2. **Cambiar ownership de contratos** (si eres owner)
   ```bash
   cast send $CONTRACT "transferOwnership(address)" 0xNUEVA_WALLET
   ```

3. **Generar nueva key**
   ```bash
   cast wallet new
   ```

4. **Si estaba en Git, limpiar historial** (complejo)
   - Considera usar herramientas como `git-filter-repo`
   - O hacer fork limpio del repo

5. **Documentar incidente**
   - Qué pasó
   - Cuándo
   - Qué se hizo
   - Lecciones aprendidas

---

## ✨ Conclusión

**Usa Foundry Keystore para cualquier deployment serio.**

Es el método más seguro, conveniente y profesional. Configurar toma 2 minutos y te ahorra dolores de cabeza en el futuro.

```bash
# Setup (una vez)
./scripts/setup_keystore.sh

# Deploy (siempre)
./scripts/deploy_sepolia_keystore.sh
```

¡Tu yo del futuro te lo agradecerá! 🔐✨
