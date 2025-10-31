# Seguridad y Gestión de Datos Sensibles

## 🔒 Archivos Protegidos

Este proyecto está configurado con múltiples capas de `.gitignore` para proteger datos sensibles:

### ✅ Lo que NUNCA se sube a git:

1. **Variables de entorno**:
   - `.env`, `.env.local`, `.env.*.local`
   - Cualquier archivo que contenga `MNEMONIC`, claves privadas, o secretos

2. **Logs**:
   - `*.log` (todos los archivos de log)
   - `.anvil.log`, `.web.log`
   - Logs de npm, yarn, pnpm

3. **Claves y certificados**:
   - `*.key`, `*.pem`, `*.p12`, `*.pfx`
   - Archivos en directorios `secrets/` o `secret/`

4. **Builds y caché**:
   - `node_modules/`, `out/`, `build/`, `.next/`
   - Archivos de caché de Foundry, subgraph, etc.

5. **Datos locales**:
   - `subgraph/data/` (datos de IPFS y Postgres)
   - Archivos temporales y backups

## 📋 Configuración Inicial

### 1. Configurar Smart Contracts (sc/)

```bash
cd sc
cp .env.example .env.local
# Editar .env.local con tus valores
```

Variables requeridas en `sc/.env.local`:
```bash
MNEMONIC="tu mnemonic de 12 palabras solo para desarrollo local"
DERIVATION_PATH="m/44'/60'/0'/0/"
SEED=1
SEED_CHAINS=2
SEED_LOTS_PER_CHAIN=2
SEED_TRANSFERS_PER_STAGE=2
USE_MNEMONIC=1
```

### 2. Configurar Frontend (web/)

```bash
cd web
# El archivo .env.local se crea automáticamente durante el deployment
# con el script deploy_local.sh
```

## ⚠️ Advertencias de Seguridad

### Para Desarrollo Local:

✅ **Permitido**:
- Usar mnemonics de prueba para cuentas locales
- Almacenar configuraciones en `.env.local`
- Compartir `.env.example` con el equipo

❌ **NUNCA HACER**:
- Subir archivos `.env.local` a git
- Usar mnemonics reales o con fondos reales
- Commitear claves privadas
- Compartir archivos de log que puedan contener datos sensibles

### Para Producción:

🚨 **CRÍTICO**:
- **NUNCA uses el mismo mnemonic** que en desarrollo
- Usa hardware wallets (Ledger, Trezor)
- Implementa gestión de secretos (AWS Secrets Manager, HashiCorp Vault)
- Rota las claves regularmente
- Habilita autenticación de 2 factores
- Audita los contratos antes del deployment

## 🔍 Verificar Seguridad

### Comprobar que no hay archivos sensibles trackeados:

```bash
# Ver archivos .env trackeados
git ls-files | grep -E "\\.env"

# Debería mostrar solo:
# sc/.env.example
# Y el .env.example de la raíz

# Ver logs trackeados
git ls-files | grep "\\.log"

# No debería mostrar ningún .log
```

### Verificar que .gitignore funciona:

```bash
# Los siguientes archivos deben ser ignorados:
git check-ignore .anvil.log .web.log sc/.env.local web/.env.local

# Todos deberían aparecer en la salida
```

## 📝 Archivos de Log

Los archivos de log locales son ignorados automáticamente:
- `.anvil.log` - Logs del nodo local Anvil
- `.web.log` - Logs del servidor Next.js
- Logs en `subgraph/data/`
- Logs de npm/yarn/pnpm

## 🔄 Si Accidentalmente Commiteaste Datos Sensibles

Si commiteaste un archivo sensible por error:

```bash
# 1. Remover del tracking (mantiene local)
git rm --cached path/to/sensitive/file

# 2. Agregar al .gitignore
echo "path/to/sensitive/file" >> .gitignore

# 3. Commit el cambio
git add .gitignore
git commit -m "Remove sensitive file from tracking"

# 4. Si ya pusheaste a remote, considera:
# - Rotar todas las claves/secretos expuestos INMEDIATAMENTE
# - Usar git filter-branch o BFG Repo-Cleaner para limpiar el historial
# - Notificar al equipo
```

## 📚 Recursos

- [GitHub - Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [OWASP - Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [12-Factor App - Config](https://12factor.net/config)

## ✅ Checklist de Seguridad

Antes de cada commit:

- [ ] No hay archivos `.env` o `.env.local` en staging
- [ ] No hay claves privadas o mnemonics en el código
- [ ] Los logs no contienen información sensible
- [ ] `.gitignore` está actualizado
- [ ] Solo se commitean archivos `.env.example` como plantillas

Antes de deployment a producción:

- [ ] Claves únicas para producción
- [ ] Gestión segura de secretos implementada
- [ ] Auditoría de contratos completada
- [ ] Monitoreo y alertas configurados
- [ ] Plan de respuesta a incidentes documentado
