---
name: multiversx-blockchain
description: Provides MultiversX (Elrond) blockchain expertise for smart contracts, dApps, and ESDT. Use when building or auditing MultiversX projects, writing Rust contracts, integrating sdk-dapp, working with EGLD/ESDT tokens, or when the user mentions MultiversX, MVX, Elrond, xPortal, or mx-chain.
---

# MultiversX Blockchain

Specialized knowledge for building and auditing on the MultiversX blockchain. Integrates with mx-ai-skills for granular expertise.

## Installation (One-Time)

Install the official MultiversX AI skills into this project:

```bash
npx openskills install multiversx/mx-ai-skills
```

For global access across all projects:

```bash
npx openskills install multiversx/mx-ai-skills -g
```

Run `npx openskills sync` after install to update AGENTS.md for skill discovery.

---

## When to Use

Apply this skill when working on:

- MultiversX smart contracts (Rust, multiversx-sc)
- dApp frontends (React, sdk-dapp, xPortal)
- ESDT/EGLD token handling, transfers, and balances
- WebSocket or API subscriptions to MultiversX
- Security audits or spec compliance
- Gas optimization and WASM size

---

## Skill Selection Guide

The mx-ai-skills package provides 23+ granular skills. Choose by task:

| Task | Skill(s) to Apply |
|------|-------------------|
| Smart contract dev | multiversx-smart-contracts, multiversx-payment-handling |
| dApp frontend | multiversx-dapp-frontend |
| Security audit | multiversx-security-audit, multiversx-dapp-audit |
| DeFi / math | multiversx-defi-math, multiversx-vault-pattern |
| Cross-contract calls | multiversx-cross-contract-calls |
| Spec compliance | multiversx-spec-compliance |
| Common pitfalls | multiversx-sharp-edges |
| Protocol details | multiversx-protocol-experts, multiversx-blockchain-data |
| Testing | multiversx-property-testing |

---

## Core Principles

1. **Checked arithmetic only**: Use `CheckedAdd`, `CheckedSub`, etc. Never raw `+`/`-` in contracts.
2. **Checks-Effects-Interactions**: Validate → update state → external calls.
3. **No floating point**: Use `BigUint` and fixed-point for all financial logic.
4. **Gas awareness**: Minimize storage writes; optimize WASM size.
5. **Never hallucinate**: If unsure, ask for specs or docs rather than guessing.

---

## Quick Reference

### ESDT Types

- **Fungible (ESDT)**: quantity > 1, decimals
- **Non-Fungible (NFT)**: nonce 0, quantity 1
- **Semi-Fungible (SFT)**: nonce 0, quantity ≥ 1

### Common sdk-dapp Patterns

```typescript
import { useGetAccountInfo } from "@multiversx/sdk-dapp/hooks/account/useGetAccountInfo";
import { sendTransactions } from "@multiversx/sdk-dapp/services/transactions";
// Use TransactionsBuilder for typed EGLD/ESDT transfers
```

### API / WebSocket

- Gateway API: `https://api.multiversx.com` (mainnet) or `https://testnet-api.multiversx.com`
- WebSocket: `w3://socket.multiversx.com` (mainnet)

---

## Additional Resources

- [mx-ai-skills GitHub](https://github.com/multiversx/mx-ai-skills) – full skill list and source
- [MultiversX Docs](https://docs.multiversx.com)
