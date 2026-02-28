import chalk from "chalk";
import Table from "cli-table3";
import { setRefresh } from "../cache.js";

const API_URL = "https://trustrouter-api-538154404155.us-central1.run.app";

interface FindOptions {
    task: string;
    type?: string;
    chain: string;
    limit: string;
    output: string;
    refresh?: boolean;
}

export async function findCommand(options: FindOptions): Promise<void> {
    const isJson = options.output === "json";
    if (options.refresh) setRefresh(true);

    try {
        const url = new URL(`${API_URL}/agents`);
        url.searchParams.set("chain", options.chain);
        url.searchParams.set("limit", options.limit);
        url.searchParams.set("task", options.task);
        if (options.type) url.searchParams.set("type", options.type);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        const { agents } = await res.json() as any;

        const results = agents.map((a: any) => ({
            agent: {
                agentId: a.agentId,
                owner: a.owner,
                registration: {
                    name: a.name,
                    description: a.description,
                    services: a.services || [],
                    x402Support: (a.services || []).some((s: any) => s.name?.toLowerCase() === "x402"),
                },
                feedbackCount: a.feedbackCount || 0,
                avgScore: a.avgScore || 0,
                validationCount: a.validationCount || 0,
                validationAvg: a.validationAvg || 0,
            },
            trustScore: a.trustScore || 0
        }));

        if (results.length === 0) {
            if (isJson) {
                console.log(JSON.stringify([]));
            } else {
                console.log(chalk.yellow("\n  No services found matching your criteria.\n"));
            }
            return;
        }

        if (isJson) {
            console.log(JSON.stringify(results.map(toJson), null, 2));
            return;
        }

        console.log(
            "\n" + chalk.bold.cyan("  🔍 Results for: ") + chalk.white(`"${options.task}"`)
        );
        if (options.type) console.log(chalk.dim(`  Filtered by type: ${options.type}`));
        console.log("");

        printTable(results);
        console.log(chalk.dim(`\n  ${results.length} result(s)\n`));
    } catch (err: any) {
        if (isJson) {
            console.log(JSON.stringify({ error: err.message }));
            process.exit(1);
        }
        console.error(chalk.red(`\n  ✗ Error: ${err.message}\n`));
        process.exit(1);
    }
}

function toJson(s: any) {
    return {
        agentId: s.agent.agentId,
        name: s.agent.registration.name,
        description: s.agent.registration.description,
        trustScore: s.trustScore,
        feedbackCount: s.agent.feedbackCount,
        avgScore: s.agent.avgScore,
        validationCount: s.agent.validationCount,
        validationAvg: s.agent.validationAvg,
        services: s.agent.registration.services || [],
        x402Support: s.agent.registration.x402Support || false,
        x402Endpoint: s.agent.registration.services?.find((svc: any) => svc.name.toLowerCase() === "x402")?.endpoint || null,
        owner: s.agent.owner,
    };
}

function printTable(results: any[]): void {
    const table = new Table({
        head: ["#", "ID", "Name", "Trust", "Reviews", "Services"].map((h) => chalk.bold(h)),
        colWidths: [5, 8, 30, 14, 9, 28],
        style: { head: [], border: ["dim"] },
    });

    results.forEach((r: any, i: number) => {
        const svcs = r.agent.registration.services?.map((s: any) => svcTag(s.name)).join(" ") || chalk.dim("-");
        table.push([
            chalk.dim(`${i + 1}`),
            chalk.white(`${r.agent.agentId}`),
            chalk.bold(trunc(r.agent.registration.name || "(unnamed)", 28)),
            scoreBar(r.trustScore),
            `${r.agent.feedbackCount}`,
            svcs,
        ]);
    });

    console.log(table.toString());
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
