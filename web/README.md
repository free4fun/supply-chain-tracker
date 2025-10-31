# Supply Chain Tracker – Web app

This is the Next.js 16 front-end for Supply Chain Tracker. It renders the landing page, the role-based dashboard, and all wallet interactions for moving assets along the supply chain.

## Getting started

```bash
cd web
npm install
npm run dev
```

The development server runs at <http://localhost:3000>. When you connect a wallet on the landing page you will be redirected to the dashboard.

### Environment variables

Create `web/.env.local` using the template provided in the repository root:

```bash
cp ../.env.example .env.local
```

Fill in at least the following values:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Address of the deployed SupplyChainTracker contract. |
| `NEXT_PUBLIC_RPC_URL` | RPC endpoint for the chain you want to interact with (defaults to Anvil). |
| `NEXT_PUBLIC_CHAIN_ID` | Numeric chain id (31337 for local development). |

Restart the dev server after changing these values.

### Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server with hot reloading. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint over the project. |
| `npm run test` | Execute Vitest unit tests in watch mode. |
| `npm run test:run` | Execute the Vitest suite once (CI friendly). |

## Internationalization

All copy is localized in English and Spanish through [`src/i18n/dictionary.ts`](src/i18n/dictionary.ts). Follow these rules when changing UI text:

1. Always add the key to both the English and Spanish objects.
2. Use the `useI18n()` hook inside client components instead of hard-coded strings.
3. Prefer translation keys in configuration arrays (e.g. feature lists) so the UI adapts to the selected language.
4. If you need to interpolate values, use the `t(key, { param: value })` signature.

## Styling

Styling is handled with Tailwind CSS (v4) utility classes. Global tokens such as surfaces and gradients are defined in `src/app/globals.css`. Role-driven theme helpers live in `src/hooks/useRoleTheme.ts`.

## Testing

The project uses Vitest with the React Testing Library. Add tests under `src/` with the `.test.tsx` suffix. Run `npm run test:run` before opening a pull request.

