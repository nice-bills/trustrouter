import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");
async function main() {
    const logs = await provider.getLogs({
        address: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
        fromBlock: -50000,
        toBlock: "latest"
    });
    console.log("Found", logs.length, "recent logs");
    if(logs.length) console.log(logs[logs.length-1]);
}
main();
