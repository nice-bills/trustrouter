import { ethers } from "ethers";

const ABI = [
    "function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory)",
    "function tokenURI(uint256 tokenId) view returns (string)",
];

async function testChain(name: string, rpc: string, id: number) {
    const provider = new ethers.JsonRpcProvider(rpc);
    const registry = new ethers.Contract("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", ABI, provider);

    console.log(`\nTesting ${name} Agent ${id}:`);
    try {
        const uri = await registry.tokenURI(id);
        console.log("  tokenURI:", uri);
    } catch {
        console.log("  tokenURI: REVERTED");
    }

    const keys = ["agentURI", "tokenURI", "metadata", "uri", "url", "agentWallet"];
    for (const key of keys) {
        try {
            const res = await registry.getMetadata(id, key);
            if (res !== "0x") {
                if (key === "agentWallet") {
                    console.log(`  getMetadata("${key}"):`, ethers.getAddress(ethers.dataSlice(res, 0, 20)));
                } else {
                    console.log(`  getMetadata("${key}"):`, ethers.toUtf8String(res));
                }
            }
        } catch { }
    }
}

async function main() {
    await testChain("Ethereum", "https://eth.llamarpc.com", 0);
    await testChain("Ethereum", "https://eth.llamarpc.com", 42);
    await testChain("Base", "https://mainnet.base.org", 0);
    await testChain("Base", "https://mainnet.base.org", 42);
}

main();
