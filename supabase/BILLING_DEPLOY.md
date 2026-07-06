# MakeX billing schema deployment

1. Open the Supabase SQL editor for the project shared by MakeX APIs and [mvx-websocket-dapp](https://github.com/Shamsham01/mvx-websocket-dapp).
2. Run [`migrations/20260704120000_makex_billing_schema.sql`](./migrations/20260704120000_makex_billing_schema.sql).
3. Redeploy all MakeX API services with `MAKEX_APP_ID` set per app (see plan).
4. Redeploy mvx-websocket-dapp backend + frontend so `/api/billing-prefs` and the dashboard card are live.

## Per-service `MAKEX_APP_ID`

| Render service | `MAKEX_APP_ID` |
|----------------|----------------|
| WARPS | `makex-warps` |
| Transfers | `makex-transfers` |
| Swap | `makex-swap` |
| Assets Manager | `makex-assets` |
| NFT Snapshot | `makex-nft-snapshot` |
| Twitter/X | `makex-twitter-x` |

## Smoke test matrix

- Standard app, no prefs row → USDC ~$0.03 charged
- Dashboard saves REWARD → next standard call charges REWARD ~$0.02
- Valid free trial → standard apps skip fee
- Valid free trial + Twitter/X → USDC $0.05 still charged
- Twitter/X ignores REWARD preference
