import { type AgentData } from "../registry.js";

// ── Scored Agent ───────────────────────────────────────────────────

export interface ScoredAgent {
    agent: AgentData;
    trustScore: number;
}

// ── Trust Score ────────────────────────────────────────────────────
//
// Simple composite: 60% reputation + 40% activity
// Reputation = avg on-chain feedback score (0-100)
// Activity = log-scale of feedback count

export function computeTrustScore(agent: AgentData): number {
    const reputationScore = Math.min(100, Math.max(0, agent.avgScore));

    const activityScore = agent.feedbackCount > 0
        ? Math.min(100, 25 * Math.log10(agent.feedbackCount + 1))
        : 0;

    return Math.round((0.6 * reputationScore + 0.4 * activityScore) * 100) / 100;
}

// ── Matching & Ranking ────────────────────────────────────────────

export interface MatchOptions {
    task?: string;
    type?: string;
    sort?: string;
    limit?: number;
}

export function rankAgents(agents: AgentData[], options: MatchOptions): ScoredAgent[] {
    let scored: ScoredAgent[] = agents.map((agent) => ({
        agent,
        trustScore: computeTrustScore(agent),
    }));

    // Filter by service type
    if (options.type) {
        const typeFilter = options.type.toLowerCase();
        scored = scored.filter((s) => {
            if (typeFilter === "x402") return s.agent.registration.x402Support === true;
            if (!s.agent.registration.services) return false;
            return s.agent.registration.services.some(
                (svc) => svc.name.toLowerCase() === typeFilter
            );
        });
    }

    // Filter by task keywords
    if (options.task) {
        const keywords = options.task.toLowerCase().split(/\s+/);
        scored = scored.filter((s) => {
            const haystack = [
                s.agent.registration.name || "",
                s.agent.registration.description || "",
            ].join(" ").toLowerCase();
            return keywords.some((kw) => haystack.includes(kw));
        });

        // Boost by relevance
        scored = scored.map((s) => {
            const haystack = [
                s.agent.registration.name || "",
                s.agent.registration.description || "",
            ].join(" ").toLowerCase();
            const matchCount = keywords.filter((kw) => haystack.includes(kw)).length;
            const relevanceBonus = (matchCount / keywords.length) * 10;
            return { ...s, trustScore: s.trustScore + relevanceBonus };
        });
    }

    // Sort
    const sortField = options.sort || "reputation";
    scored.sort((a, b) => {
        switch (sortField) {
            case "name":
                return (a.agent.registration.name || "").localeCompare(b.agent.registration.name || "");
            case "recent":
                return b.agent.agentId - a.agent.agentId; // Higher ID = registered more recently
            case "reputation":
            default:
                return b.trustScore - a.trustScore;
        }
    });

    return scored.slice(0, options.limit ?? 20);
}
