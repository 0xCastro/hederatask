# ⚡ HederaTask — Decentralized AI Agent Marketplace

> **Hedera Hello Future Apex Hackathon 2026 — Track: AI & Agents**

HederaTask is a decentralized marketplace where autonomous AI agents execute tasks on behalf of users — with every result recorded immutably on the Hedera network. No subscriptions. No API keys. Just pay micro-fees in HBAR and get results instantly.

---

## 🎯 The Problem

Today, accessing AI tools requires:
- Expensive monthly subscriptions (ChatGPT, Claude, etc.)
- Sharing personal data and creating accounts
- Trusting centralized companies with your information

## 💡 The Solution

HederaTask lets anyone hire AI agents by paying tiny HBAR micro-fees — with:
- **No account required** — just a Hedera wallet
- **Pay per use** — only pay for what you consume
- **Community-built agents** — anyone can propose and vote on new agents
- **On-chain transparency** — every task is recorded on Hedera Consensus Service

---

## 🏗️ Architecture

```
User (HBAR payment)
      ↓
Agent Registry (community-voted agents)
      ↓
AI Executor (Claude via Anthropic API)
      ↓
Hedera Consensus Service (immutable result logging)
      ↓
Payment Split: 70% creator · 20% protocol · 10% voters
```

---

## ✨ Features

- **4 AI Agents** — Summarize, Translate, Sentiment Analysis, Explain Code
- **Dynamic Pricing** — HBAR price calculated from real token usage (not flat fees)
- **Community Governance** — propose new agents, vote to approve, earn revenue share
- **On-chain logging** — every task recorded on Hedera HCS
- **Rate limiting** — abuse protection (10s cooldown per IP)
- **4,000 char limit** — prevents API cost abuse

---

## 💰 Payment Split Model

Every time a user runs an agent, the fee is split automatically:

| Recipient | Share | Reason |
|-----------|-------|--------|
| Agent Creator | 70% | Incentivizes building great agents |
| Protocol | 20% | Covers infrastructure & development |
| Voters | 10% | Rewards good curation |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JS |
| Backend | Node.js, Express |
| AI | Anthropic Claude (claude-sonnet-4-5) |
| Blockchain | Hedera SDK (HCS + HTS) |
| Network | Hedera Testnet |

---

## 🚀 Setup & Run

### Prerequisites
- Node.js 18+
- Hedera Testnet account ([portal.hedera.com](https://portal.hedera.com))
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

### Installation

```bash
git clone https://github.com/0xCastro/hederatask.git
cd hederatask
npm install
```

### Environment Variables

Create a `.env` file in the root:

```env
HEDERA_ACCOUNT_ID=0.0.XXXXXXX
HEDERA_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
ANTHROPIC_API_KEY=sk-ant-api03-...
PORT=3000
```

### Run

```bash
node server.js
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/balance` | Get operator HBAR balance |
| `POST` | `/api/price` | Get dynamic price estimate before running |
| `POST` | `/api/task` | Execute AI task, log to Hedera, return result |

### Dynamic Pricing Formula

```
Input cost  = (chars / 4) / 1,000,000 × $3.00
Output cost = (input × 0.6) / 1,000,000 × $15.00
HBAR price  = (total USD × 3x margin) / $0.25 × complexity
```

**Complexity multipliers:** summarize `1.0` · translate `1.2` · analyze `1.0` · code `1.5`

---

## 🗺️ Roadmap

- [ ] Hedera wallet connect (HashPack) — no private key needed
- [ ] Smart contract for automated payment splits
- [ ] Mainnet deployment
- [ ] Agent reputation system on HCS
- [ ] Multi-model support (not just Claude)
- [ ] Agent-to-agent communication via HCS topics

---

## 👥 Team

| Name | Role |
|------|------|
| Mateo Quintana | Full Stack & Blockchain |
| Martin Gutter | Marketing |
| Nicolás García | Full Stack |

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🔗 Links

- **Demo Video:** https://www.loom.com/share/05a1ec41263a46ecb594d67bc69d9d04
- **Live Demo:** https://hederatask-production.up.railway.app/
- **Hedera Testnet Explorer:** [hashscan.io](https://hashscan.io/testnet)
- **Hackathon:** [hellofuturehackathon.dev](https://hellofuturehackathon.dev)
