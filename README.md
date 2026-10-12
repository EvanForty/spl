# SPL

The Pump.fun of Solana programs. Anyone can build on Solana.

Landing site for SPL, a one-click Solana program launchpad. Plain static site: HTML, CSS and JavaScript, no build step, no folders, nothing to install.

## Files

```
.
├── index.html             page markup
├── styles.css             all styles
├── app.js                 wallet connect, HQ visual + live slots, right-column tools, Launch form, panels, marketplace
├── spl.png                SPL server logo (transparent)
├── spl-nav.png            small logo for the sidebar
├── favicon.png
├── apple-touch-icon.png
├── logo-original.png      original artwork
├── vercel.json            Vercel config (clean URLs, security headers)
├── .gitignore
└── README.md
```

## Run locally

Wallet extensions don't inject into `file://` pages, so serve the folder over HTTP:

```bash
npx serve .
# or
python3 -m http.server 3000
```

Then open http://localhost:3000.

## Deploy to Vercel

1. Push all of these files to the root of the `main` branch of a GitHub repo.
2. On vercel.com, choose **Add New → Project** and import the repo.
3. Framework preset: **Other**. Leave build command, output directory and root directory empty.
4. Click **Deploy**.

If the project shows "No Production Deployment", open **Deployments → Create Deployment**, enter `main`, and deploy.

## Wallet connect

`app.js` connects to Phantom, Solflare and Backpack through their injected providers and uses
[`@solana/web3.js`](https://github.com/solana-labs/solana-web3.js) 1.95.3 (loaded from jsDelivr) to handle public keys.
The site only reads the wallet's public address. It never requests a signature or sends a transaction.

## Live data

The epoch counter reads `getEpochInfo` from `https://api.mainnet-beta.solana.com`.
The public endpoint is rate-limited, so set `RPC_URL` in `app.js` to your own provider before you get traffic.

## What's wired up today

- **Layout:** left sidebar (nav, promo card, wallet), scrolling ticker with an X link to @SPLdotfun, the HQ visual in the center, right column with the selected template, a tools card (Deploy, Programs, Publish) and template chips. Under 1180px wide it stacks into one column with a top bar.
- **HQ visual:** a 3D program module for the selected template (drag to turn it, click it to open Launch, arrows to switch templates) above a row of Solana blocks. The highlighted block and the slot number come from mainnet `getSlot`, re-synced every 20 seconds and advanced at ~400ms per slot in between; upcoming slots show as outlines. Without RPC access the blocks still move but show no numbers.
- **Launch:** six templates (`TEMPLATES` in `app.js`) each with their own fields. It checks every Solana address, number and multisig threshold, then generates a program account keypair in the browser (it's discarded) and ends with "configuration ready". Nothing is deployed on-chain.
- **Panels:** Launch, how it works, dashboard, marketplace, buyback ledger and flywheel open over the floor and have their own links (`/#launch`, `/#market`, ...).
- **Dashboard, marketplace, programs list, buyback ledger, counters:** start at "—", empty or 0 until a backend supplies real data. Add marketplace listings to the `PROGRAMS` array in `app.js`.

## Disclaimer

Buybacks depend on actual fee revenue and aren't guaranteed. Nothing on this site is financial advice.
