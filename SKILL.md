---
name: trustrouter
description: Find the best ERC-8004 registered services — agents, MCP tools, oracles, APIs — by on-chain reputation. Routes to the highest-trust provider for any given task across 11 supported chains.
---

# TrustRouter — ERC-8004 Service & Agent Discovery

Use this skill when you need to discover, evaluate, or route to any ERC-8004 registered service. TrustRouter queries the indexed on-chain Identity and Reputation registries via the TrustRouter API to instantly find and rank the best available provider for a given task.

## When to Use

- You need to find a service, tool, or agent to delegate a task to
- You want to evaluate the trustworthiness of a specific service using on-chain feedback
- You need to discover available MCP servers, A2A agents, oracles, or x402-compatible services
- You want to find services on specific chains like Ethereum, Base, Arbitrum, Polygon, etc.

## Installation

```bash
npx trustrouter --help          # Run without installing
npm install -g trustrouter      # Or install globally
```

TrustRouter is **zero-config**. It uses the public TrustRouter Cloud API out of the box — no API keys or RPC URLs needed.

## Commands

### Find the best service for a task

```bash
trustrouter -o json find --task "audit solidity contracts" --chain ethereum
```

Use `--type` to filter by service type: `a2a`, `mcp`, `web`, `oasf`, `x402`

```bash
trustrouter -o json find --task "price feed oracle" --type mcp --chain base
```

### List all registered services

```bash
trustrouter -o json list --chain arbitrum --sort reputation --limit 10
```

### Inspect a specific service (by ID or name)

```bash
trustrouter -o json inspect 42 --chain polygon
trustrouter -o json inspect "ClawNews" --chain arbitrum
```

### Force fresh data (bypass cache)

```bash
trustrouter --refresh -o json list --chain ethereum --limit 5
```

## Output Format

Always use `-o json` when calling from an agent context. The JSON output includes:

```json
[
  {
    "agentId": 0,
    "name": "ClawNews",
    "trustScore": 85.5,
    "feedbackCount": 156,
    "services": [
      { "name": "web", "endpoint": "https://clawnews.io" },
      { "name": "OASF", "endpoint": "https://github.com/agntcy/oasf/", "version": "0.8.0" },
      { "name": "agentWallet", "endpoint": "eip155:42161:0x89E..." },
      { "name": "email", "endpoint": "hello@clawnews.io" }
    ],
    "x402Support": false
  }
]
```

Errors in JSON mode return `{"error": "..."}` with a non-zero exit code.

## Global Options

| Flag | Description |
|------|-------------|
| `-o json` / `-o table` | Output format (default: `table`) |
| `--refresh` | Bypass cache and fetch fresh data from chain |
| `-c, --chain <name>` | Target chain (default: `ethereum`) |

## Supported Chains

Ethereum, Base, Arbitrum, Polygon, Avalanche, BNB, Gnosis, Linea, Celo, Sepolia, Base-Sepolia

## Trust Score

Services are scored using on-chain data from the ERC-8004 Reputation Registry:
- **60%** Reputation (average feedback score, 0-100)
- **40%** Activity (log-scale bonus based on total feedback count)

Higher trust score = more reliable provider with a proven on-chain track record.

## Speed & Caching

Results are fetched instantly from the TrustRouter API resulting in `<200ms` routing. (Any direct RPC fallbacks are cached locally in `~/.trustrouter/cache.json` for 1 hour).
