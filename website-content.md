# MakeX: The "Zapier" of MultiversX
## Build, Automate, and Scale on Blockchain—Without Writing Code.

**MakeX** connects the **MultiversX** blockchain to over 2,500 Web2 applications (Google Sheets, Discord, OpenAI, Slack) inside **Make.com**. Turn complex smart contract interactions into simple drag-and-drop workflows.

[**Start Building Free**](#Login) | [**Read the Litepaper**](#Coming Soon)

---

## The Toolkit
**Stop coding infrastructure. Start automating value.**
We offer a comprehensive suite of custom apps designed to handle every aspect of on-chain operations.

### 💸 MultiversX Transfers
**The Engine of Value.** Automate payments and distributions with ease.
*   **Bulk Airdrops:** Send tokens to thousands of addresses in one click.
*   **Payroll:** Automate team salaries in EGLD, ESDT, or Stablecoins.
*   **Asset Support:** Full support for and ESDTs, NFTs and SFTs.

### 📸 Snapshot & Draw
**Community Management, Solved.** Perfect for DAOs and NFT Founders.
*   **Deep Analytics:** Take instant snapshots of wallet holdings (including staked tokens).
*   **Verifiable Raffles:** Run transparent, on-chain draws for your community based on their holdings.

### 🛠️ Assets Manager
**Total Token Control.** Manage the lifecycle of your digital assets without a command line.
*   **Mint & Burn:** Manage supply elasticity instantly.
*   **Issue Tokens:** Deploy new ESDT tokens directly from the visual builder.
*   **Role Management:** Assign minting/burning roles to specific wallets automatically.

### 🔄 xExchange Swap
**DeFi Automation.** Connect directly to the liquidity of the MultiversX DEX.
*   **Auto-Swaps:** Trigger token swaps based on external market data.
*   **Treasury Management:** Automate portfolio rebalancing rules.

### ⚡ Warps
**The Smart Contract Bridge.** The most powerful tool in the box.
*   **No-Code Interaction:** Query and execute smart contract functions visually.
*   **Universal Connection:** Turn any smart contract endpoint into a Make.com module.

---

## ⚡ Real-Time Data: MultiversX WebSocket Subscriptions
**Don't poll the blockchain. Let the blockchain notify you.**

MakeX now supports **Custom Filtered Transactions** via WebSocket. This allows you to feed live, real-time on-chain data directly into Make.com or third-party applications.

### Step 1: Create Your Webhook
To start receiving data, you must first have a destination.
1.  Go to **Make.com** and create a "Custom Webhook" trigger.
2.  Copy the generated Webhook URL.
3.  Use this URL when configuring your MakeX Subscription.

### Step 2: Configure `subscribeCustomTransfers`
We support the `subscribeCustomTransfers` event, which tracks the **complete stream of actions**—including standard transactions, Smart Contract Results (SCRs), and Rewards.

**Available Filters (Payload DTO):**
You can configure your subscription to filter noise and only trigger your scenario for specific events.

| Filter Field | Description | Use Case |
| :--- | :--- | :--- |
| **address** | **Universal Filter.** Matches if the address is the Sender OR Receiver OR Relayer. | The preferred mode for tracking the full real-time activity of a specific user or wallet. |
| **token** | Filter by Token Identifier (e.g., `USDC-c76f1f` or `EGLD`). | Perfect for tracking volume or trades of a specific project token. |
| **function** | Filter by smart contract function name (e.g., `stake`, `claimRewards`). | Trigger automations only when a user interacts with a specific contract method. |
| **sender** | Filter by sender address (bech32). | Monitor specific wallets for outgoing payments. |
| **receiver** | Filter by receiver address (bech32). | Monitor a deposit address or treasury for incoming funds. |

[**🔌 Login with MultiversX Wallet to Create Subscription**](#)
*(Supported: xPortal, Ledger, Web Wallet)*

---

## 🧠 Build No-Code AI Agents
**The era of "DeFAI" (Decentralized Finance AI) is here.**

By combining the new **Make AI Agents** with **MakeX**, you can build autonomous, wallet-equipped assistants that think, decide, and act on-chain—no coding required.

*   **Manage Portfolios:** Build agents that monitor market sentiment and asset prices in real-time to execute swaps on xExchange, optimizing your holdings 24/7 without human intervention.
*   **Balance Treasuries:** Create a "Treasury Manager" agent instructed to "maintain 50% in stablecoins and stake the rest." The agent will autonomously calculate ratios and execute the necessary rebalancing transactions.
*   **Manage Communities:** Deploy "Swarm Agents" that analyze Discord engagement or X (Twitter) sentiment, automatically identifying key contributors and rewarding them with NFT airdrops or token tips.
*   **Perform On-Chain Tasks:** From sweeping NFT floors based on trait rarity to executing complex smart contract "Warps," your agents can handle sophisticated blockchain operations using natural language logic.

---

## Install the MakeX Apps
Ready to build? Click below to install the custom modules directly into your Make.com organization.

> **Note:** These apps are powered by the **$REWARD** token. Each automated action requires a micro-fee (~$0.03), driving the HODL Token Club ecosystem.

| App Name | Description | Installation Link |
| :--- | :--- | :--- |
| **MultiversX Transfers** | Send EGLD, ESDT, & NFTs | [**Install Module ⬇️**](#https://eu2.make.com/app/invite/db68efb5e85d04d711a632a3b2017b7d) |
| **Snapshot & Draw** | Holder Snapshots & Raffles | [**Install Module ⬇️**](#https://eu2.make.com/app/invite/682839e9c23f1ba1aeb9925e16551466) |
| **Assets Manager** | Issue, Mint, & Burn Tokens | [**Install Module ⬇️**](#https://www.make.com/en/hq/app-invitation/4663d084cfa02a4cfc8824724f4bfa6a) |
| **xExchange Swap** | DEX Swaps & Liquidity | [**Install Module ⬇️**](#Coming Soon) |
| **Warps** | Smart Contract Interactions | [**Install Module ⬇️**](#https://eu2.make.com/app/invite/113f288efa442e5a2529b09e3dbe4339) |

---

**MakeX** is a product of the **HODL Token Club**.
*A movement for long-term value, built by the community, for the community.*

[Documentation](#) | [HODL Token Club](#) | [Support](#)
