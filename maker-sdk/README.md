# HyperDEX Maker SDK

Connect to HyperDEX and earn spread by providing USDC/EURC liquidity on Stellar.

## Requirements

- Node.js 18 or higher
- Git
- An API key from the HyperDEX admin (apply at https://hyperdex-psi.vercel.app/maker)

## Setup (one time)

```bash
git clone https://github.com/anindhabiswas25/hyperdex.git
cd hyperdex/maker-sdk
npm install
npm run setup
```

When prompted, enter your API key. The wizard connects to the live HyperDEX backend automatically — no manual configuration needed.

## Start

```bash
npm run dev <yourname>
```

You will be prompted to set your ghost price — the EURC amount you offer per 1 USDC. The SDK then connects and auto-bids on every RFQ.

## What happens

1. SDK connects to `wss://hyperdex.onrender.com/ws/maker`
2. Authenticates with your API key
3. Reads your pool balance from Stellar
4. Streams price levels to the backend
5. Auto-bids your ghost price on every RFQ
6. You earn spread on every trade you win

## Check your status

- Backend health: https://hyperdex.onrender.com/health
- Your dashboard: https://hyperdex-psi.vercel.app/maker

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | One-time wizard: verify API key, generate signing keypair, save credentials |
| `npm run dev <name>` | Start the maker server with named credential file |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled server |

## Keyboard shortcuts (while running)

- `Ctrl+R` — update your ghost price live
- `Ctrl+C` — gracefully disconnect and exit

## Customizing Pricing

Edit `src/example-pricer.ts` to implement your own pricing strategy.
