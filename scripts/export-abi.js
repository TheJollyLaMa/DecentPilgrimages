const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

async function main() {
    const artifact = await hre.artifacts.readArtifact("DecentPilgrimageBaseV1");
    const output = path.join(__dirname, "..", "contracts", "abi", "DecentPilgrimageBaseV1.json");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(artifact.abi, null, 2)}\n`);
    console.log(`Exported ${artifact.abi.length} ABI entries to contracts/abi/DecentPilgrimageBaseV1.json`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
