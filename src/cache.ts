import { AgentData } from "./registry.js";
import fs from "fs";
import path from "path";
import os from "os";

const CACHE_DIR = path.join(os.homedir(), ".trustrouter");
const CACHE_FILE = path.join(CACHE_DIR, "cache.json");
const TTL_MS = 60 * 60 * 1000; // 1 hour

let forceRefresh = false;

/** Call this to bypass cache reads for the current run */
export function setRefresh(enabled: boolean) {
    forceRefresh = enabled;
}

export interface CacheStore {
    [chain: string]: {
        timestamp: number;
        totalAgents: number;
        agents: Record<number, AgentData>;
    }
}

export function loadCache(): CacheStore {
    try {
        if (!fs.existsSync(CACHE_FILE)) return {};
        const data = fs.readFileSync(CACHE_FILE, "utf-8");
        return JSON.parse(data);
    } catch {
        return {};
    }
}

export function saveCache(cache: CacheStore) {
    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
    } catch {
        // Silently ignore — cache is best-effort
    }
}

/** Returns cached data for a chain, or null if expired/missing/refresh forced */
export function getCachedChain(chain: string) {
    if (forceRefresh) return null;
    const cache = loadCache();
    const data = cache[chain];
    if (data && Date.now() - data.timestamp < TTL_MS) {
        return data;
    }
    return null;
}
