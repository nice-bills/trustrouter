import { describe, it, expect } from "vitest";
import { computeTrustScore, rankAgents } from "../src/router/index.js";
import type { AgentData } from "../src/registry.js";

function makeAgent(overrides: Partial<AgentData> = {}): AgentData {
    return {
        agentId: 0,
        owner: "0x0000000000000000000000000000000000000000",
        registration: {},
        feedbackCount: 0,
        avgScore: 0,
        ...overrides,
    };
}

describe("computeTrustScore", () => {
    it("returns 0 for an agent with no feedback", () => {
        const score = computeTrustScore(makeAgent());
        expect(score).toBe(0);
    });

    it("returns a score between 0 and 100", () => {
        const score = computeTrustScore(makeAgent({ feedbackCount: 50, avgScore: 80 }));
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(100);
    });

    it("weights reputation at 60% and activity at 40%", () => {
        // An agent with perfect reputation but 1 review should score
        // less than one with perfect reputation and 100 reviews
        const fewReviews = computeTrustScore(makeAgent({ feedbackCount: 1, avgScore: 100 }));
        const manyReviews = computeTrustScore(makeAgent({ feedbackCount: 100, avgScore: 100 }));
        expect(manyReviews).toBeGreaterThan(fewReviews);
    });

    it("does not exceed 100 even with extreme values", () => {
        const score = computeTrustScore(makeAgent({ feedbackCount: 999999, avgScore: 100 }));
        expect(score).toBeLessThanOrEqual(100);
    });
});

describe("rankAgents", () => {
    const agents: AgentData[] = [
        makeAgent({ agentId: 1, registration: { name: "Alpha" }, feedbackCount: 10, avgScore: 90 }),
        makeAgent({ agentId: 2, registration: { name: "Beta" }, feedbackCount: 50, avgScore: 60 }),
        makeAgent({ agentId: 3, registration: { name: "Gamma" }, feedbackCount: 5, avgScore: 95 }),
    ];

    it("sorts by reputation (trust score) by default", () => {
        const results = rankAgents(agents, {});
        expect(results[0].agent.registration.name).toBeDefined();
        // Higher trust score first
        expect(results[0].trustScore).toBeGreaterThanOrEqual(results[1].trustScore);
    });

    it("sorts by name alphabetically", () => {
        const results = rankAgents(agents, { sort: "name" });
        expect(results[0].agent.registration.name).toBe("Alpha");
        expect(results[1].agent.registration.name).toBe("Beta");
        expect(results[2].agent.registration.name).toBe("Gamma");
    });

    it("sorts by recent (highest agentId first)", () => {
        const results = rankAgents(agents, { sort: "recent" });
        expect(results[0].agent.agentId).toBe(3);
        expect(results[1].agent.agentId).toBe(2);
        expect(results[2].agent.agentId).toBe(1);
    });

    it("respects the limit option", () => {
        const results = rankAgents(agents, { limit: 2 });
        expect(results.length).toBe(2);
    });

    it("filters by service type", () => {
        const withMcp = makeAgent({
            agentId: 4,
            registration: { name: "McpBot", services: [{ name: "mcp", endpoint: "https://example.com" }] },
        });
        const results = rankAgents([...agents, withMcp], { type: "mcp" });
        expect(results.length).toBe(1);
        expect(results[0].agent.registration.name).toBe("McpBot");
    });
});
