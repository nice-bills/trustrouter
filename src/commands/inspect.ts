import chalk from "chalk";
import Table from "cli-table3";
import { fetchAgentById, fetchAgents } from "../registry.js";
import { computeTrustScore } from "../router/index.js";
import type { AgentData } from "../registry.js";
import { setRefresh } from "../cache.js";

// Service type icons
const SERVICE_ICONS: Record<string, string> = {
    a2a: "🤖",
    mcp: "🔧",
    web: "🌐",
    oasf: "📦",
    x402: "💰",
};

function serviceIcon(name: string): string {
    return SERVICE_ICONS[name.toLowerCase()] || "🔗";
}

interface InspectOptions {
    chain: string;
    output: string;
    refresh?: boolean;
}

export async function inspectCommand(idOrName: string, options: InspectOptions): Promise<void> {
    const isJson = options.output === "json";
    if (options.refresh) setRefresh(true);

    try {
        if (!isJson) console.log(chalk.dim("\n  Querying ERC-8004 service registry via public RPC..."));

        let agent: AgentData | null = null;

        // Try numeric ID first
        const numericId = parseInt(idOrName);
        if (!isNaN(numericId) && String(numericId) === idOrName.trim()) {
            agent = await fetchAgentById(numericId, options.chain);
        } else {
            // Name-based search: fetch a batch and find by name
            if (!isJson) console.log(chalk.dim(`  Searching by name: "${idOrName}"...`));
            const agents = await fetchAgents({ chain: options.chain, first: 200 });
            const needle = idOrName.toLowerCase();
            agent = agents.find((a) => {
                const name = a.registration.name?.toLowerCase() || "";
                return name === needle || name.includes(needle);
            }) ?? null;
        }

        if (!agent) {
            if (isJson) {
                console.log(JSON.stringify({ error: `Service "${idOrName}" not found` }));
                process.exit(1);
            }
            console.log(chalk.yellow(`\n  ⚠  Service "${idOrName}" not found.\n`));
            return;
        }

        const trustScore = computeTrustScore(agent);

        if (isJson) {
            console.log(JSON.stringify({
                agentId: agent.agentId,
                name: agent.registration.name,
                description: agent.registration.description,
                owner: agent.owner,
                services: agent.registration.services || [],
                x402Support: agent.registration.x402Support || false,
                supportedTrust: agent.registration.supportedTrust || [],
                trustScore,
                feedbackCount: agent.feedbackCount,
                avgScore: agent.avgScore,
            }, null, 2));
            return;
        }

        // ── Pretty output ──────────────────────────────────────────
        const name = agent.registration.name || "(unnamed)";
        const desc = agent.registration.description || "(no description)";

        console.log("");
        console.log(chalk.bold.cyan(`  🔍 Service #${agent.agentId}`));
        console.log(chalk.dim("  " + "─".repeat(58)));

        // Info table
        const infoTable = new Table({
            chars: { mid: "", "left-mid": "", "mid-mid": "", "right-mid": "" },
            colWidths: [16, 46],
            style: { head: [], border: ["dim"], "padding-left": 2, "padding-right": 1 },
        });

        infoTable.push(
            [chalk.bold("Name"), chalk.white.bold(name)],
            [chalk.bold("Description"), chalk.white(trunc(desc, 42))],
            [chalk.bold("Owner"), chalk.dim(trunc(agent.owner, 42))],
            [chalk.bold("Chain"), chalk.cyan(options.chain)],
        );
        console.log(infoTable.toString());

        // Services table
        console.log(chalk.bold("\n  📡 Endpoints"));
        if (agent.registration.services?.length) {
            const svcTable = new Table({
                head: ["Type", "Endpoint", "Version"].map(h => chalk.bold(h)),
                colWidths: [12, 40, 10],
                style: { head: [], border: ["dim"], "padding-left": 2, "padding-right": 1 },
            });
            agent.registration.services.forEach((svc) => {
                svcTable.push([
                    serviceIcon(svc.name) + " " + chalk.green(svc.name.toUpperCase()),
                    chalk.dim(trunc(svc.endpoint, 38)),
                    svc.version ? chalk.dim(`v${svc.version}`) : chalk.dim("-"),
                ]);
            });
            console.log(svcTable.toString());
        } else {
            console.log(chalk.dim("  (none registered)"));
        }

        // Trust & Reputation table
        console.log(chalk.bold("\n  ⭐ Trust & Reputation"));
        const trustTable = new Table({
            chars: { mid: "", "left-mid": "", "mid-mid": "", "right-mid": "" },
            colWidths: [16, 46],
            style: { head: [], border: ["dim"], "padding-left": 2, "padding-right": 1 },
        });

        const scoreColor = trustScore >= 70 ? chalk.bold.green : trustScore >= 40 ? chalk.bold.yellow : chalk.bold.red;
        trustTable.push(
            [chalk.bold("Trust Score"), scoreColor(`${trustScore.toFixed(1)}/100`) + "  " + scoreBar(trustScore)],
            [chalk.bold("Feedback"), `${agent.feedbackCount} review${agent.feedbackCount !== 1 ? "s" : ""}`],
            [chalk.bold("Avg Score"), agent.avgScore > 0 ? `${agent.avgScore.toFixed(2)}/100` : chalk.dim("n/a")],
            [chalk.bold("Validation"), agent.validationCount > 0 ? `${agent.validationCount} proof(s), avg ${agent.validationAvg}%` : chalk.dim("No proofs")],
            [chalk.bold("x402 Pay"), agent.registration.x402Support ? chalk.green.bold("✓ Supported") : chalk.dim("✗ Not supported")],
        );
        console.log(trustTable.toString());

        // Supported trust types
        if (agent.registration.supportedTrust?.length) {
            console.log(chalk.bold("\n  🛡️  Trust Types"));
            agent.registration.supportedTrust.forEach((t) => {
                console.log(chalk.green(`    ▸ ${t}`));
            });
        }

        console.log("");
    } catch (err: any) {
        if (isJson) {
            console.log(JSON.stringify({ error: err.message }));
            process.exit(1);
        }
        console.error(chalk.red(`\n  ✗ Error: ${err.message}\n`));
        process.exit(1);
    }
}

function scoreBar(score: number): string {
    const n = Math.min(100, Math.max(0, score));
    const filled = Math.round(n / 10);
    const bar = "█".repeat(filled) + "░".repeat(10 - filled);
    const color = n >= 70 ? chalk.green : n >= 40 ? chalk.yellow : chalk.red;
    return color(bar);
}

function trunc(s: string, n: number): string {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
