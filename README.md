# TrustRouter

**ERC-8004 Reputation-Aware Service Router**

Discover, rank, and route to the best services on-chain — agents, MCP tools, oracles, APIs, DeFi bots, and anything registered on [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004). TrustRouter queries the Identity and Reputation registries using free public RPCs to find the highest-trust provider for any given task.

> *"Reputation-aware routing: Middleware that ingests ERC-8004 reputation data and dynamically routes requests to the best-performing service for a given task at a given moment."*
> — [Vitto Rivabella](https://x.com/VittoStack), ERC-8004 co-creator

## What It Does

- **Discovers** all registered services from the ERC-8004 Identity Registry — agents, MCP servers, oracles, APIs, and more
- **Scores** them using on-chain reputation feedback from the Reputation Registry
- **Ranks** by a composite trust score (reputation + activity)
- **Filters** by service type (A2A, MCP, OASF, x402) and keyword matching
- **Routes** you to the best available provider for your task

Works as a **CLI tool** for humans and an **OpenClaw skill** for agents. Zero config, no API keys needed.

## Quick Start

```bash
# Run directly with npx (no install needed)
npx trustrouter@latest list

# Or install globally
npm install -g trustrouter
```

TrustRouter works out of the box using free public RPCs — zero API keys required.

```bash
# Find the best service for a task
trustrouter find --task "price feed oracle" --chain base

# List all services ranked by reputation
trustrouter list --chain ethereum --sort reputation

# Inspect a specific service (by ID or name)
trustrouter inspect 42 --chain arbitrum
trustrouter inspect "PriceFeedOracle" --chain base
```

## Commands

| Command | Description |
|---------|-------------|
| `trustrouter find --task "..." [--type mcp\|a2a] [--chain ethereum]` | Find best service for a task |
| `trustrouter list [--chain ethereum] [--sort reputation] [--limit 20]` | List all registered services |
| `trustrouter inspect <id-or-name> [--chain ethereum]` | Full details of a service (by ID or name) |

**Local Caching:**
All RPC responses are automatically cached locally in `~/.trustrouter/cache.json` for 1 hour. This significantly speeds up subsequent commands (e.g. from 50s down to 0.7s) and prevents rate-limiting when using free public RPCs.

All commands support the global `-o json` flag for machine-readable output:

```bash
# JSON output (for scripts and agents)
trustrouter -o json list --limit 5
trustrouter -o json find --task "oracle" --chain base
trustrouter -o json inspect 42

# Pipe to jq
trustrouter -o json list --limit 100 | jq '.[].name'
```

Errors follow the same pattern — table mode prints `Error: ...` to stderr, JSON mode prints `{"error": "..."}` to stdout with a non-zero exit code.

## Supported Chains

Supports all EVM chains where the ERC-8004 registries are deployed (via CREATE2):

- **Mainnets**: Ethereum, Base, Arbitrum, Polygon, Avalanche, BNB, Gnosis, Linea, Celo
- **Testnets**: Sepolia, Base Sepolia

Specify the chain using the `-c` or `--chain` flag (e.g., `--chain base`).

## Trust Score Algorithm

```
trustScore = (0.6 × avg_reputation) + (0.4 × log(feedback_count))
```

- **Reputation** — Average on-chain feedback score from the Reputation Registry `getSummary()`
- **Activity** — Log-scale bonus based on the total number of feedback events

## What Can Be Discovered

ERC-8004 is not just for agents — it's a universal service registry. TrustRouter discovers anything registered:

| Type | Example |
|------|---------|
| AI Agents | A2A-compatible autonomous agents |
| MCP Servers | Tool providers, code sandboxes, database connectors |
| Oracles | Price feeds, data providers, block time trackers |
| DeFi Services | Liquidation bots, keeper networks, MEV searchers |
| APIs | Any HTTP service with an endpoint |

## Agent Integration

TrustRouter ships with a [SKILL.md](./SKILL.md) for OpenClaw agents. After installing, any agent can discover and route to ERC-8004 services autonomously:

```
"Find me the best MCP tool for price feeds on Ethereum"
→ trustrouter find --task "price feed" --type mcp --chain ethereum --json
```

## Architecture

```
┌─────────────┐     ┌──────────────────┐
│  CLI / Agent │ ──▸ │  Router (Scorer   │
│   Commands   │     │  + Matcher)       │
└──────┬──────┘     └────────┬─────────┘
       │                     │
       ▼                     ▼
┌──────────────────────────────────────┐
│  Registry Layer (Free Public RPCs)   │
│  Parallel Batched Contract Queries   │
└──────────────────┬───────────────────┘
                   │
          ┌────────▾─────────┐
          │  ERC-8004        │
          │  Identity +      │
          │  Reputation      │
          │  Registries      │
          └──────────────────┘
```

## Advanced Usage (Custom RPCs)

TrustRouter works out of the box, but for heavy usage you can set custom RPC endpoints:

```bash
export ETH_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
export BASE_RPC_URL="https://mainnet.base.org"
```

## Development

```bash
git clone https://github.com/YOUR_USERNAME/trustrouter
cd trustrouter
npm install
npm run build
node dist/cli.js list --chain ethereum
```

## License

MIT
