import { ethers } from "ethers";
import { loadCache, saveCache, getCachedChain } from "./cache.js";

// ── Data Source ────────────────────────────────────────────────────
// Uses free public RPCs to query ERC-8004 contracts directly.
// Zero API keys needed. Works out of the box with `npx trustrouter`.
//
// The Identity Registry is ERC-721 — we enumerate agents via
// binary-search on ownerOf(). Reputation uses getClients() + getSummary().

// Same CREATE2 address across all mainnets
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
// Validation Registry — deployed via CREATE2 (same pattern as above)
// NOTE: Not yet deployed by the ERC-8004 team (spec under active discussion).
// Once deployed, update this address. Queries fail gracefully (return 0).
const VALIDATION_REGISTRY = "0x8004000000000000000000000000000000000000"; // placeholder

// Free public RPCs — no API key needed
// ERC-8004 contracts are deployed via CREATE2 (same address on all chains)
// Multiple providers per chain for fallback reliability
const FREE_RPCS: Record<string, string[]> = {
    ethereum: [
        "https://eth.drpc.org",
        "https://eth.llamarpc.com",
        "https://rpc.ankr.com/eth",
        "https://ethereum-rpc.publicnode.com",
        "https://endpoints.omniatech.io/v1/eth/mainnet/public",
    ],
    base: [
        "https://mainnet.base.org",
        "https://base.drpc.org",
        "https://base.llamarpc.com",
        "https://rpc.ankr.com/base",
        "https://base-rpc.publicnode.com",
        "https://endpoints.omniatech.io/v1/base/mainnet/public",
    ],
    arbitrum: [
        "https://arb1.arbitrum.io/rpc",
        "https://arbitrum.drpc.org",
        "https://rpc.ankr.com/arbitrum",
        "https://arbitrum-one-rpc.publicnode.com",
        "https://endpoints.omniatech.io/v1/arbitrum/one/public",
    ],
    polygon: [
        "https://polygon-rpc.com",
        "https://polygon.drpc.org",
        "https://polygon.llamarpc.com",
        "https://rpc.ankr.com/polygon",
        "https://polygon-bor-rpc.publicnode.com",
        "https://endpoints.omniatech.io/v1/matic/mainnet/public",
    ],
    avalanche: [
        "https://api.avax.network/ext/bc/C/rpc",
        "https://avalanche.drpc.org",
        "https://rpc.ankr.com/avalanche",
        "https://avalanche-c-chain-rpc.publicnode.com",
    ],
    bnb: [
        "https://bsc-dataseed.binance.org",
        "https://bsc.drpc.org",
        "https://rpc.ankr.com/bsc",
        "https://bsc-rpc.publicnode.com",
    ],
    gnosis: [
        "https://rpc.gnosischain.com",
        "https://gnosis.drpc.org",
        "https://rpc.ankr.com/gnosis",
        "https://gnosis-rpc.publicnode.com",
    ],
    linea: [
        "https://rpc.linea.build",
        "https://linea.drpc.org",
        "https://linea-rpc.publicnode.com",
    ],
    celo: [
        "https://forno.celo.org",
        "https://celo.drpc.org",
        "https://rpc.ankr.com/celo",
    ],
    // Testnets
    sepolia: [
        "https://sepolia.drpc.org",
        "https://rpc.ankr.com/eth_sepolia",
        "https://ethereum-sepolia-rpc.publicnode.com",
    ],
    "base-sepolia": [
        "https://sepolia.base.org",
        "https://base-sepolia.drpc.org",
        "https://rpc.ankr.com/base_sepolia",
    ],
};

// Minimal read-only ABIs
const IDENTITY_ABI = [
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function ownerOf(uint256 tokenId) view returns (address)",
];

const REPUTATION_ABI = [
    "function getClients(uint256 agentId) view returns (address[])",
    "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
];

const VALIDATION_ABI = [
    "function getAgentValidations(uint256 agentId) view returns (bytes32[])",
    "function getSummary(uint256 agentId, address[] validatorAddresses, string tag) view returns (uint64 count, uint8 avgResponse)",
];

// ── Types ──────────────────────────────────────────────────────────

export interface ServiceEntry {
    name: string;
    endpoint: string;
    version?: string;
    skills?: string[];
    domains?: string[];
}

export interface RegistrationFile {
    type?: string;
    name?: string;
    description?: string;
    image?: string;
    services?: ServiceEntry[];
    x402Support?: boolean;
    active?: boolean;
    supportedTrust?: string[];
}

export interface AgentData {
    agentId: number;
    owner: string;
    registration: RegistrationFile;
    feedbackCount: number;
    avgScore: number;
    validationCount: number;
    validationAvg: number;
}

// Chain IDs for staticNetwork (skips ethers auto-detect retry loop)
const CHAIN_IDS: Record<string, number> = {
    ethereum: 1,
    base: 8453,
    arbitrum: 42161,
    polygon: 137,
    avalanche: 43114,
    bnb: 56,
    gnosis: 100,
    linea: 59144,
    celo: 42220,
    sepolia: 11155111,
    "base-sepolia": 84532,
};

// Testnet contract addresses (different from mainnet)
const TESTNET_IDENTITY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const TESTNET_REPUTATION = "0x8004B663056A597Dffe9eCcC1965A193B7388713";
const TESTNET_VALIDATION = "0x8004000000000000000000000000000000000000"; // placeholder
const TESTNET_CHAINS = new Set(["sepolia", "base-sepolia"]);

/** Get the correct contract addresses for a chain */
function getContractAddresses(chain: string) {
    if (TESTNET_CHAINS.has(chain)) {
        return { identity: TESTNET_IDENTITY, reputation: TESTNET_REPUTATION, validation: TESTNET_VALIDATION };
    }
    return { identity: IDENTITY_REGISTRY, reputation: REPUTATION_REGISTRY, validation: VALIDATION_REGISTRY };
}

/** Get all supported chain names */
export function getSupportedChains(): string[] {
    return Object.keys(FREE_RPCS);
}

// ── Provider ───────────────────────────────────────────────────────

async function getWorkingProvider(chain: string = "ethereum"): Promise<ethers.JsonRpcProvider> {
    const rpcs = FREE_RPCS[chain];
    if (!rpcs) throw new Error(`Unsupported chain: ${chain}. Supported: ${Object.keys(FREE_RPCS).join(", ")}`);
    const chainId = CHAIN_IDS[chain] ?? 1;

    // Env var: ETHEREUM_RPC_URL, BASE_RPC_URL, ARBITRUM_RPC_URL, etc.
    const envKey = `${chain.toUpperCase().replace("-", "_")}_RPC_URL`;
    // Also check legacy ETH_RPC_URL for ethereum
    const envRpc = process.env[envKey] || (chain === "ethereum" ? process.env.ETH_RPC_URL : undefined);
    if (envRpc) {
        const provider = makeProvider(envRpc, chainId);
        if (await testProvider(provider)) return provider;
    }

    // Try free RPCs in order
    for (const rpc of rpcs) {
        const provider = makeProvider(rpc, chainId);
        if (await testProvider(provider)) return provider;
    }

    throw new Error(`All RPCs failed for ${chain}. Try setting ${envKey} in .env`);
}

function makeProvider(rpc: string, chainId: number): ethers.JsonRpcProvider {
    const fetchReq = new ethers.FetchRequest(rpc);
    fetchReq.timeout = 10_000;
    return new ethers.JsonRpcProvider(fetchReq, chainId, { staticNetwork: true });
}

async function testProvider(provider: ethers.JsonRpcProvider): Promise<boolean> {
    try {
        const result = await Promise.race([
            provider.getBlockNumber(),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), 10_000)
            ),
        ]);
        return typeof result === "number" && result > 0;
    } catch {
        return false;
    }
}

// ── Agent Discovery ────────────────────────────────────────────────
// The Identity Registry doesn't have totalSupply() (no ERC721Enumerable).
// Agent IDs are sequential starting from 0. We probe with ownerOf() to find them.

/** Discover how many agents exist by binary-searching for the max valid ID */
async function findMaxAgentId(
    contract: ethers.Contract,
    hint: number = 200
): Promise<number> {
    // Quick check: does the hint exist?
    const hintExists = await agentExists(contract, hint);

    if (hintExists) {
        // There might be more — probe upward
        let high = hint * 2;
        while (await agentExists(contract, high)) {
            high *= 2;
            if (high > 100_000) break; // safety cap
        }
        // Binary search between hint and high
        let lo = hint, hi = high;
        while (lo < hi) {
            const mid = Math.floor((lo + hi + 1) / 2);
            if (await agentExists(contract, mid)) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        return lo;
    } else {
        // Fewer than hint — binary search 0 to hint
        let lo = 0, hi = hint;
        while (lo < hi) {
            const mid = Math.floor((lo + hi + 1) / 2);
            if (await agentExists(contract, mid)) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        return lo;
    }
}

async function agentExists(contract: ethers.Contract, id: number): Promise<boolean> {
    try {
        await contract.ownerOf(id);
        return true;
    } catch {
        return false;
    }
}

// ── Core Queries ───────────────────────────────────────────────────

/** How many agents are registered (approximate) */
export async function getTotalAgents(chain: string = "ethereum"): Promise<number> {
    const cached = getCachedChain(chain);
    if (cached && cached.totalAgents > 0) return cached.totalAgents;

    const provider = await getWorkingProvider(chain);
    const { identity } = getContractAddresses(chain);
    const contract = new ethers.Contract(identity, IDENTITY_ABI, provider);
    const maxId = await findMaxAgentId(contract);
    const total = maxId + 1; // IDs are 0-indexed

    const cache = loadCache();
    cache[chain] = cache[chain] || { timestamp: Date.now(), totalAgents: 0, agents: {} };
    cache[chain].totalAgents = total;
    cache[chain].timestamp = Date.now();
    saveCache(cache);

    return total;
}

/** Fetch a batch of agents with their registration data */
export async function fetchAgents(options: {
    chain?: string;
    first?: number;
    skip?: number;
} = {}): Promise<AgentData[]> {
    const { chain = "ethereum", first = 50, skip = 0 } = options;
    const start = skip;
    const end = start + first;

    const cached = getCachedChain(chain);
    let hasAll = false;
    if (cached) {
        hasAll = true;
        for (let i = start; i < end; i++) {
            if (i < cached.totalAgents && !cached.agents[i]) {
                hasAll = false;
                break;
            }
        }
    }

    if (hasAll && cached) {
        const results: AgentData[] = [];
        for (let i = start; i < end; i++) {
            if (i < cached.totalAgents && cached.agents[i]) {
                results.push(cached.agents[i]);
            }
        }
        return results;
    }

    const provider = await getWorkingProvider(chain);
    const addrs = getContractAddresses(chain);
    const identity = new ethers.Contract(addrs.identity, IDENTITY_ABI, provider);
    const reputation = new ethers.Contract(addrs.reputation, REPUTATION_ABI, provider);
    const validation = new ethers.Contract(addrs.validation, VALIDATION_ABI, provider);

    let maxId = cached && cached.totalAgents > 0 ? cached.totalAgents - 1 : -1;
    if (maxId === -1) {
        maxId = await findMaxAgentId(identity);
    }
    const limitEnd = Math.min(start + first, maxId + 1);

    const agents: AgentData[] = [];

    // Batch fetch in parallel (groups of 10 to avoid rate limits)
    const BATCH = 10;
    for (let i = start; i < limitEnd; i += BATCH) {
        const batchEnd = Math.min(i + BATCH, limitEnd);
        const batchIds = Array.from({ length: batchEnd - i }, (_, idx) => i + idx);

        const batchResults = await Promise.allSettled(
            batchIds.map(async (agentId) => {
                if (cached && cached.agents[agentId]) return cached.agents[agentId];

                // Fetch owner + registration file
                const [owner, tokenURI] = await Promise.all([
                    identity.ownerOf(agentId).catch(() => "unknown"),
                    identity.tokenURI(agentId).catch(() => null),
                ]);

                const registration = await resolveRegistrationFile(tokenURI);

                // Fetch reputation summary
                let feedbackCount = 0;
                let avgScore = 0;
                try {
                    const clients: string[] = await reputation.getClients(agentId);
                    if (clients.length > 0) {
                        const [count, summaryValue, summaryValueDecimals] =
                            await reputation.getSummary(agentId, clients, "", "");
                        feedbackCount = Number(count);
                        const raw = Number(summaryValue) / Math.pow(10, Number(summaryValueDecimals));
                        avgScore = Math.min(100, Math.max(0, raw));
                    }
                } catch { /* no reputation data */ }

                // Fetch validation summary
                let validationCount = 0;
                let validationAvg = 0;
                try {
                    // Empty array = all validators, empty string = all tags
                    const [vCount, vAvg] = await validation.getSummary(agentId, [], "");
                    validationCount = Number(vCount);
                    validationAvg = Number(vAvg);
                } catch { /* Validation Registry maybe not deployed or no proofs */ }

                return {
                    agentId,
                    owner,
                    registration,
                    feedbackCount,
                    avgScore,
                    validationCount,
                    validationAvg,
                };
            })
        );

        for (const result of batchResults) {
            if (result.status === "fulfilled") {
                agents.push(result.value);
            }
        }
    }

    // Save to cache
    const newCache = loadCache();
    newCache[chain] = newCache[chain] || { timestamp: Date.now(), totalAgents: maxId + 1, agents: {} };
    newCache[chain].totalAgents = Math.max(newCache[chain].totalAgents, maxId + 1);
    newCache[chain].timestamp = Date.now();
    for (const a of agents) {
        newCache[chain].agents[a.agentId] = a;
    }
    saveCache(newCache);

    return agents;
}

/** Fetch a single agent by ID */
export async function fetchAgentById(
    agentId: number,
    chain: string = "ethereum"
): Promise<AgentData | null> {
    const cached = getCachedChain(chain);
    if (cached && cached.agents[agentId]) {
        return cached.agents[agentId];
    }

    const provider = await getWorkingProvider(chain);
    const addrs = getContractAddresses(chain);
    const identity = new ethers.Contract(addrs.identity, IDENTITY_ABI, provider);
    const reputation = new ethers.Contract(addrs.reputation, REPUTATION_ABI, provider);
    const validation = new ethers.Contract(addrs.validation, VALIDATION_ABI, provider);

    try {
        const [owner, tokenURI] = await Promise.all([
            identity.ownerOf(agentId).catch(() => "unknown"),
            identity.tokenURI(agentId).catch(() => null),
        ]);

        const registration = await resolveRegistrationFile(tokenURI);

        let feedbackCount = 0;
        let avgScore = 0;
        try {
            const clients: string[] = await reputation.getClients(agentId);
            if (clients.length > 0) {
                const [count, summaryValue, summaryValueDecimals] =
                    await reputation.getSummary(agentId, clients, "", "");
                feedbackCount = Number(count);
                const raw = Number(summaryValue) / Math.pow(10, Number(summaryValueDecimals));
                avgScore = Math.min(100, Math.max(0, raw));
            }
        } catch { /* no reputation data */ }

        let validationCount = 0;
        let validationAvg = 0;
        try {
            const [vCount, vAvg] = await validation.getSummary(agentId, [], "");
            validationCount = Number(vCount);
            validationAvg = Number(vAvg);
        } catch { /* Validation Registry maybe not deployed or no proofs */ }

        const data = { agentId, owner, registration, feedbackCount, avgScore, validationCount, validationAvg };

        // Save to cache
        const newCache = loadCache();
        newCache[chain] = newCache[chain] || { timestamp: Date.now(), totalAgents: 0, agents: {} };
        newCache[chain].agents[agentId] = data;
        newCache[chain].timestamp = Date.now();
        saveCache(newCache);

        return data;
    } catch {
        return null;
    }
}

// ── Registration File Resolver ─────────────────────────────────────

export async function resolveRegistrationFile(uri: string | null): Promise<RegistrationFile> {
    if (!uri) return {};

    // Handle base64 data URI
    if (uri.startsWith("data:")) {
        const match = uri.match(/^data:[^;]+;base64,(.+)$/);
        if (match) {
            try {
                const json = Buffer.from(match[1], "base64").toString("utf-8");
                return JSON.parse(json);
            } catch {
                return {};
            }
        }
        return {};
    }

    // Handle IPFS
    let fetchUrl = uri;
    if (uri.startsWith("ipfs://")) {
        const cid = uri.replace("ipfs://", "");
        fetchUrl = `https://ipfs.io/ipfs/${cid}`;
    }

    // Fetch
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8_000);
        const response = await fetch(fetchUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) return {};
        const text = await response.text();
        try { return JSON.parse(text); } catch { return {}; }
    } catch {
        return {};
    }
}
