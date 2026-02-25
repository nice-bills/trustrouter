import chalk from "chalk";
import Table from "cli-table3";
import { fetchAgents, getTotalAgents } from "../registry.js";
import { rankAgents, type ScoredAgent } from "../router/index.js";
import { setRefresh } from "../cache.js";

interface ListOptions {
    chain: string;
    sort: string;
    limit: string;
    type?: string;
    output: string;
    refresh?: boolean;
}

export async function listCommand(options: ListOptions): Promise<void> {
    const isJson = options.output === "json";
    if (options.refresh) setRefresh(true);

    try {
        if (!isJson) console.log(chalk.dim("\n  Querying ERC-8004 service registry via public RPC..."));

        const total = await getTotalAgents(options.chain);
        const agents = await fetchAgents({ chain: options.chain, first: Math.min(parseInt(options.limit) * 2, 100) });
        const results = rankAgents(agents, {
            type: options.type,
            sort: options.sort,
            limit: parseInt(options.limit),
        });

        if (results.length === 0) {
            if (isJson) {
                console.log(JSON.stringify([]));
            } else {
                console.log(chalk.yellow("\n  No services found.\n"));
            }
            return;
        }

        if (isJson) {
            console.log(JSON.stringify(
                results.map((r) => ({
                    agentId: r.agent.agentId,
                    name: r.agent.registration.name,
                    trustScore: r.trustScore,
                    feedbackCount: r.agent.feedbackCount,
                    services: r.agent.registration.services || [],
                    x402Support: r.agent.registration.x402Support || false,
                })),
                null, 2
            ));
            return;
        }

        console.log(
            "\n" + chalk.bold.cyan("  📋 ERC-8004 Registered Services") +
            chalk.dim(` (${total} total, showing ${results.length})`)
        );
        console.log("");

        const table = new Table({
            head: ["#", "ID", "Name", "Trust", "Reviews", "Services", "x402"].map((h) => chalk.bold(h)),
            colWidths: [5, 8, 26, 14, 9, 22, 6],
            style: { head: [], border: ["dim"] },
        });

        results.forEach((r, i) => {
            const svcs = r.agent.registration.services?.map((s) => svcTag(s.name)).join(" ") || chalk.dim("-");
            table.push([
                chalk.dim(`${i + 1}`),
                chalk.white(`${r.agent.agentId}`),
                chalk.bold(trunc(r.agent.registration.name || "(unnamed)", 24)),
                scoreBar(r.trustScore),
                `${r.agent.feedbackCount}`,
                svcs,
                r.agent.registration.x402Support ? chalk.green("✓") : chalk.dim("-"),
            ]);
        });

        console.log(table.toString());
        console.log(chalk.dim(`\n  Sorted by: ${options.sort}\n`));
    } catch (err: any) {
        if (isJson) {
            console.log(JSON.stringify({ error: err.message }));
            process.exit(1);
        }
        console.error(chalk.red(`\n  ✗ Error: ${err.message}\n`));
        process.exit(1);
    }
}

const SVC_ICONS: Record<string, string> = {
    a2a: "🤖", mcp: "🔧", web: "🌐", oasf: "📦", x402: "💰",
};

function svcTag(name: string): string {
    const icon = SVC_ICONS[name.toLowerCase()] || "🔗";
    return icon + chalk.dim(name.toUpperCase());
}

function trunc(s: string, n: number): string {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function scoreBar(score: number): string {
    const n = Math.min(100, Math.max(0, score));
    const filled = Math.round(n / 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);
    const color = n >= 70 ? chalk.green : n >= 40 ? chalk.yellow : chalk.red;
    return color(bar) + chalk.dim(` ${n.toFixed(1)}`);
}
