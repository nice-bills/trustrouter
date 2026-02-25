#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { findCommand } from "./commands/find.js";
import { listCommand } from "./commands/list.js";
import { inspectCommand } from "./commands/inspect.js";
import { getSupportedChains } from "./registry.js";
import dotenv from "dotenv";

dotenv.config();

const chains = getSupportedChains().join(", ");
const program = new Command();

program
    .name("trustrouter")
    .description(
        chalk.bold("ERC-8004 Reputation-Aware Service Router") +
        "\n  Discover, rank, and route to the best services & agents on-chain." +
        "\n  Zero config — works out of the box with free public RPCs." +
        "\n  Results are cached locally for 1 hour (~/.trustrouter/cache.json)." +
        chalk.dim(`\n\n  Supported chains: ${chains}`)
    )
    .version("0.1.0")
    .option("-o, --output <format>", "Output format: table or json", "table")
    .option("--refresh", "Bypass cache and fetch fresh data from chain");

// trustrouter find --task "audit solidity" --type mcp --chain base
program
    .command("find")
    .description("Find the best service or agent for a given task")
    .requiredOption("-t, --task <description>", "Task description to match against")
    .option("--type <type>", "Filter by service type (a2a, mcp, web, oasf, x402)")
    .option("-c, --chain <chain>", "Target chain", "ethereum")
    .option("-n, --limit <number>", "Max results to return", "5")
    .action((opts) => {
        const { output, refresh } = program.opts();
        findCommand({ ...opts, output, refresh });
    });

// trustrouter list --chain base --sort reputation --limit 20
program
    .command("list")
    .description("List all registered services ranked by trust")
    .option("-c, --chain <chain>", "Target chain", "ethereum")
    .option("-s, --sort <field>", "Sort by: reputation, name, recent", "reputation")
    .option("-n, --limit <number>", "Max results", "20")
    .option("--type <type>", "Filter by service type (a2a, mcp, web, oasf, x402)")
    .action((opts) => {
        const { output, refresh } = program.opts();
        listCommand({ ...opts, output, refresh });
    });

// trustrouter inspect 42 --chain base
// trustrouter inspect "OracleName" --chain base
program
    .command("inspect")
    .description("Show full details of a registered service (by ID or name)")
    .argument("<id-or-name>", "The service's on-chain token ID or name")
    .option("-c, --chain <chain>", "Target chain", "ethereum")
    .action((idOrName, opts) => {
        const { output, refresh } = program.opts();
        inspectCommand(idOrName, { ...opts, output, refresh });
    });

program.parse();
