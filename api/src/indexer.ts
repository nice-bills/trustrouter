import { ethers } from "ethers";
import { agentsCollection } from "./db";

const DEFAULT_RPC = "https://mainnet.base.org";
const REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_ADDRESS = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
const VALIDATION_ADDRESS = "0x8004123Fa0A164746A1489e25d2B0Bdb1d563ED6";

const ABI = [
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory)"
];

async function getAgentURI(identity: ethers.Contract, agentId: number) {
    try { const uri = await identity.tokenURI(agentId); if (uri) return uri; } catch { }
    try {
        const keys = ["agentURI", "tokenURI", "metadata", "url"];
        for (const k of keys) {
            try {
                const res = await identity.getMetadata(agentId, k);
                if (res && res !== "0x") return ethers.toUtf8String(res);
            } catch { }
        }
    } catch { }
    return null;
}

async function indexChain(chain: string, rpc: string, maxId: number = 100) {
    console.log(`Starting index for ${chain} up to ID ${maxId}`);
    const provider = new ethers.JsonRpcProvider(rpc);
    const identity = new ethers.Contract(REGISTRY_ADDRESS, ABI, provider);

    for (let id = 0; id <= maxId; id++) {
        try {
            console.log(`[${chain}] Syncing Agent ${id}...`);
            const owner = await identity.ownerOf(id).catch(() => "unknown");
            const uri = await getAgentURI(identity, id);

            let metadata: any = { name: "(unnamed)", description: "(no description)", services: [] };
            if (uri && uri.startsWith("data:application/json")) {
                try {
                    const b64 = uri.split(",")[1];
                    metadata = JSON.parse(Buffer.from(b64, "base64").toString());
                } catch { }
            }

            // Trust score logic mockup (we would fetch full rep here)
            // For now just randomizing a valid mock or fetching actual rep
            const trustScore = 50 + Math.random() * 40;

            const docData = {
                agentId: id,
                chain,
                owner,
                name: metadata.name,
                description: metadata.description,
                services: metadata.services || [],
                trustScore,
                lastSynced: Date.now()
            };

            await agentsCollection.doc(`${chain}_${id}`).set(docData, { merge: true });
        } catch (e) {
            console.error(`Error syncing Agent ${id}:`, e);
            // Agent probably doesn't exist
            break;
        }
    }
    console.log(`Finished index for ${chain}`);
}

async function main() {
    await indexChain("base", "https://mainnet.base.org", 50);
    await indexChain("ethereum", "https://eth.llamarpc.com", 50);
}

main().catch(console.error);
