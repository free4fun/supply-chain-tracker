# Supply Chain Tracker

Supply Chain Tracker is a full-stack reference platform for following goods across every stage of a supply chain. The repository bundles the smart contracts, a The Graph subgraph, and a Next.js dashboard so that each layer can be iterated together.
## Presentacion Video
[https://drive.google.com/file/d/1xzv5htO7bDXrXigp_b0uRBEV5LJjJ4q9/view?usp=sharing](https://drive.google.com/file/d/1xzv5htO7bDXrXigp_b0uRBEV5LJjJ4q9/view?usp=sharing)


## Contract address deployed in Sepolia
[https://sepolia.etherscan.io/address/0xc9f05d6d9752c858c59e31c7d96799261d8841fe](https://sepolia.etherscan.io/address/0xc9f05d6d9752c858c59e31c7d96799261d8841fe)

## Repository layout

| Path | Description |
| --- | --- |
| [`web/`](web/) | Next.js 16 application that provides the role-based dashboard, landing page, and wallet integrations. |
| [`sc/`](sc/) | Foundry project with the smart contracts that mint ERC-1155 tokens for each batch and enforce transfer permissions. |
| [`subgraph/`](subgraph/) | The Graph manifest that indexes on-chain activity for analytics and timeline views. |
| [`scripts/`](scripts/) | Helper scripts for seeding local networks and syncing environments. |

## Prerequisites

* Node.js 18 or newer (the web app uses Next.js 16).
* npm 9+ (or a compatible package manager).
* [Foundry](https://book.getfoundry.sh/getting-started/installation) for the smart-contract workspace.
* Docker (optional) if you want to run a local graph-node stack.

Copy the example environment file before running any component:

```bash
cp .env.example .env.local # edit and copy the relevant sections into sc/.env.local and web/.env.local
```

## Quick start

### Web application (`web/`)

```bash
cd web
npm install
npm run dev
```

The app starts on <http://localhost:3000>. All user-facing text is driven by `src/i18n/dictionary.ts`; add new keys in both English and Spanish when you ship UI changes.

### Smart contracts (`sc/`)

```bash
cd sc
forge install        # only on the first run
forge build
forge test
```

The smart contracts expect the mnemonic and RPC configuration defined in `sc/.env.local`. Use `anvil` for a local chain and the deploy scripts in `script/` to seed roles and tokens.

### Subgraph (`subgraph/`)

The subgraph is ready to be deployed to a local graph-node. Point the endpoints defined in `.env.example` to your node and run the usual `graph codegen`/`graph deploy` flow from the `subgraph/` directory.

## Testing and linting

* Frontend unit tests: `npm run test` from the `web/` folder (Vitest).
* Frontend linting: `npm run lint` from the `web/` folder (ESLint).
* Smart-contract tests: `forge test` from the `sc/` folder.

## Localization

The landing page, dashboard, and navigation are fully localized. All strings live in [`web/src/i18n/dictionary.ts`](web/src/i18n/dictionary.ts). When you add new UI copy, make sure that:

1. The English and Spanish objects contain the same keys.
2. Components use the `useI18n` hook instead of hard-coded strings.

## Security

Sensitive secrets must never be committed. Use the `.env.example` file as a reference and keep real credentials in `.env.local` files that stay out of git.

