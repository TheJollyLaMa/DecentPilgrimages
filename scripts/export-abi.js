const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

async function main() {
    for (const name of ["DecentPilgrimageBaseV1", "DecentPilgrimageGateV2"]) {
        const artifact = await hre.artifacts.readArtifact(name);
        const output = path.join(__dirname, "..", "contracts", "abi", `${name}.json`);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, `${JSON.stringify(artifact.abi, null, 2)}\n`);
        console.log(`Exported ${artifact.abi.length} ABI entries to contracts/abi/${name}.json`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
