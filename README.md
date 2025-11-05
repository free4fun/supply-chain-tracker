# 🍷 Supply Chain Tracker

**Full-stack blockchain solution for wine traceability from vineyard to consumer.**

Supply Chain Tracker is a production-ready platform for tracking goods across every stage of a supply chain. Built with Solidity smart contracts, The Graph indexing, and a Next.js dashboard with complete internationalization (English/Spanish).

## 🎥 Demo Video

[Watch the presentation](https://drive.google.com/file/d/1xzv5htO7bDXrXigp_b0uRBEV5LJjJ4q9/view?usp=sharing)

## 🌐 Live Deployment (Sepolia Testnet)

**Smart Contract**: [0xc9f05d6d9752c858c59e31c7d96799261d8841fe](https://sepolia.etherscan.io/address/0xc9f05d6d9752c858c59e31c7d96799261d8841fe)
**Frontend**: https://wineproof.vercel.app/

**Features**:
- ✅ Role-based access control (Admin, Producer, Distributor, Retailer)
- ✅ ERC-1155 batch tokenization
- ✅ Transfer approval workflow
- ✅ Complete transaction history with hashes
- ✅ Real-time subgraph indexing
- ✅ Bilingual UI (EN/ES)

## Repository layout

| Path | Description |
| --- | --- |
| [`web/`](web/) | Next.js 16 application that provides the role-based dashboard, landing page, and wallet integrations. |
| [`sc/`](sc/) | Foundry project with the smart contracts that mint ERC-1155 tokens for each batch and enforce transfer permissions. |
| [`subgraph/`](subgraph/) | The Graph manifest that indexes on-chain activity for analytics and timeline views. |
| [`scripts/`](scripts/) | Helper scripts for seeding local networks and syncing environments. |

## ⚡ Prerequisites

- Node.js 18+ (for Next.js 14 web app)
- npm 9+ or compatible package manager
- [Foundry](https://book.getfoundry.sh/getting-started/installation) for smart contract development
- Docker (optional, for local Graph node)
- Metamask or compatible Web3 wallet

## 📁 Environment Setup

Create environment files for each component:

```bash
# Web application
cp web/.env.example web/.env.local

# Smart contracts
cp sc/.env.example sc/.env.local
```

**Important**: Never commit `.env.local` files. See [SECURITY_KEYS.md](SECURITY_KEYS.md) for best practices.

## 🚀 Quick Start

### 1. Web Application

```bash
cd web
npm install
npm run dev
```

Visit <http://localhost:3000>

**Key Features**:

- Bilingual UI (English/Spanish) via `src/i18n/dictionary.ts`
- Role-based dashboards (Admin, Producer, Distributor, Retailer)
- Real-time transaction hash display
- Token creation and transfer management

### 2. Smart Contracts (Local Development)

```bash
cd sc
forge install   # first time only
forge build
forge test
```

**Run local blockchain**:

```bash
anvil
```

In another terminal:

```bash
cd sc
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
forge script script/Seed.s.sol --rpc-url http://localhost:8545 --broadcast
```

### 3. Subgraph (Local Indexing)

```bash
cd subgraph
npm install
npm run codegen
npm run build
npm run deploy-local  # requires local graph-node
```

For detailed local setup, see [`subgraph/README.md`](subgraph/README.md).

---

## 🌐 Deploy to Testnet (Sepolia)

### Option 1: Secure Keystore (Recommended) 🔐

```bash
# One-time setup: create encrypted keystore
./scripts/setup_keystore.sh

# Deploy using keystore (prompts for password)
./scripts/deploy_sepolia_keystore.sh
```

### Option 2: Secure Input (No Files)

```bash
# Prompts for private key (hidden input)
./scripts/deploy_sepolia.sh
```

### Option 3: Manual Deployment

```bash
cd sc
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

**⚠️ Security Warning**: Never commit private keys. See [SECURITY_KEYS.md](SECURITY_KEYS.md) for complete guide.

For complete testnet guide, see [DEPLOYMENT_TESTNET.md](DEPLOYMENT_TESTNET.md).

---

## 📊 Deploy Subgraph to The Graph Studio

```bash
cd subgraph

# 1. Update contract address and start block
nano subgraph.sepolia.yaml

# 2. Copy to main config
cp subgraph.sepolia.yaml subgraph.yaml

# 3. Generate types
npm run codegen

# 4. Build
npm run build

# 5. Authenticate (get key from thegraph.com/studio)
graph auth --studio <YOUR_DEPLOY_KEY>

# 6. Deploy
graph deploy --studio supply-chain-tracker
```

For complete subgraph guide, see [`subgraph/DEPLOY_GUIDE.md`](subgraph/DEPLOY_GUIDE.md).

---

## 🧪 Testing and Linting

### Frontend

```bash
cd web

# Run unit tests (Vitest)
npm run test

# Run linting (ESLint)
npm run lint

# Type checking
npm run type-check
```

### Smart Contracts

```bash
cd sc

# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test file
forge test --match-path test/SupplyChain.t.sol

# Gas report
forge test --gas-report
```

---

## 🌍 Localization (i18n)

All UI text is fully localized in **English** and **Spanish**.

**Dictionary location**: [`web/src/i18n/dictionary.ts`](web/src/i18n/dictionary.ts)

### Adding New Translations

When adding new UI copy:

1. Add the key to both `en` and `es` objects in `dictionary.ts`
2. Use the `useI18n()` hook in your component:

```typescript
import { useI18n } from '@/contexts/I18nContext'

export default function MyComponent() {
  const { t } = useI18n()
  
  return <h1>{t('myNewKey')}</h1>
}
```

3. Update nested keys using dot notation:

```typescript
// In dictionary.ts
export const dictionary = {
  en: {
    profile: {
      title: 'My Profile',
      edit: 'Edit Profile'
    }
  },
  es: {
    profile: {
      title: 'Mi Perfil',
      edit: 'Editar Perfil'
    }
  }
}

// In component
t('profile.title') // "My Profile" or "Mi Perfil"
```

**Important**: Always keep both languages in sync!

---

## 🔒 Security Best Practices

### Private Key Management

**❌ NEVER DO THIS:**

```bash
# .env file committed to git
PRIVATE_KEY=0x1234567890abcdef...
```

**✅ RECOMMENDED OPTIONS:**

1. **Encrypted Keystore** (Most Secure):

   ```bash
   ./scripts/setup_keystore.sh
   ```

   Creates AES-256 encrypted wallet in `~/.foundry/keystores/`

2. **Secure Input** (No File Storage):

   ```bash
   ./scripts/deploy_sepolia.sh
   ```

   Prompts for key with hidden input, clears after use

3. **Environment Variable** (Development Only):
   - Use `.env.local` (already in `.gitignore`)
   - Never commit to repository
   - Clear after session

### Complete Security Guide

See [SECURITY_KEYS.md](SECURITY_KEYS.md) for:

- Attack vectors and prevention
- Keystore management
- Hardware wallet integration
- Production deployment checklist

---

## 📚 Documentation

| Document | Description |
| --- | --- |
| [SECURITY_KEYS.md](SECURITY_KEYS.md) | Complete guide for secure key management |
| [DEPLOYMENT_TESTNET.md](DEPLOYMENT_TESTNET.md) | Step-by-step Sepolia deployment guide |
| [subgraph/DEPLOY_GUIDE.md](subgraph/DEPLOY_GUIDE.md) | The Graph Studio deployment walkthrough |
| [THEGRAPH_GUIDE.md](THEGRAPH_GUIDE.md) | Subgraph development and querying |
| [web/README.md](web/README.md) | Frontend architecture and components |
| [sc/README.md](sc/README.md) | Smart contract documentation |

---

## 🛠️ Helper Scripts

| Script | Purpose |
| --- | --- |
| `scripts/setup_keystore.sh` | Create encrypted Foundry keystore |
| `scripts/deploy_sepolia.sh` | Deploy to Sepolia with secure input |
| `scripts/deploy_sepolia_keystore.sh` | Auto-generated keystore deployment |
| `scripts/deploy_local.sh` | Deploy to local Anvil chain |
| `subgraph/deploy.sh` | Deploy subgraph to local graph-node |
| `subgraph/setup.sh` | Start local graph-node with Docker |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Web Application                       │
│              (Next.js 14 + TypeScript)                   │
│   - Role-based dashboards                                │
│   - i18n (EN/ES)                                         │
│   - Transaction hash tracking                            │
└───────────────────┬─────────────────────────────────────┘
                    │
                    │ Web3 Provider (Ethers.js)
                    │
┌───────────────────▼─────────────────────────────────────┐
│               Smart Contracts                            │
│            (Solidity + Foundry)                          │
│   - ERC-1155 batch tokens                                │
│   - Role-based access control                            │
│   - Transfer approval workflow                           │
└───────────────────┬─────────────────────────────────────┘
                    │
                    │ Events
                    │
┌───────────────────▼─────────────────────────────────────┐
│               The Graph Subgraph                         │
│            (GraphQL Indexing)                            │
│   - Token creation events                                │
│   - Transfer history                                     │
│   - User role changes                                    │
│   - Transaction hashes                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### Web app won't connect to wallet

- Check Metamask is installed and unlocked
- Verify you're on the correct network (Sepolia for testnet)
- Check `NEXT_PUBLIC_CONTRACT_ADDRESS` in `web/.env.local`

### Smart contract deployment fails

- Ensure you have Sepolia ETH (get from [faucet](https://sepoliafaucet.com/))
- Verify `SEPOLIA_RPC_URL` is valid (Alchemy/Infura)
- Check `ETHERSCAN_API_KEY` for verification

### Subgraph not syncing

- Verify contract address in `subgraph.yaml` matches deployed contract
- Check `startBlock` is not before contract deployment
- Ensure The Graph Studio shows "Synced" status

### Transaction hashes not showing

- Confirm subgraph is fully synced
- Check `NEXT_PUBLIC_SUBGRAPH_URL` in `web/.env.local`
- Transaction hashes display immediately after creation (cached locally)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

**Note**: All new UI strings must include both English and Spanish translations.

---

## 📞 Support

- **Documentation**: See guides in `/docs` and component READMEs
- **Issues**: Open a GitHub issue
- **Security**: See [SECURITY.md](SECURITY.md) for responsible disclosure

---

Made with ❤️ for transparent supply chains

