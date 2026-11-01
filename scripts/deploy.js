const hre = require("hardhat");

async function main() {
    const expectedChainIds = { base: 8453, baseSepolia: 84532 };
    const expectedChainId = expectedChainIds[hre.network.name];
    if (!expectedChainId) {
        throw new Error("Deployments are restricted to the configured Base networks.");
    }
    if (!process.env.DEPLOYER_PRIVATE_KEY) {
        throw new Error("Set DEPLOYER_PRIVATE_KEY through an approved secret manager.");
    }
    const network = await hre.ethers.provider.getNetwork();
    if (network.chainId !== BigInt(expectedChainId)) {
        throw new Error(`Network chain ID mismatch: expected ${expectedChainId}, got ${network.chainId}.`);
    }

    const pilgrimageName = process.env.PILGRIMAGE_NAME;
    if (!pilgrimageName) {
        throw new Error("Set PILGRIMAGE_NAME to the intended pilgrimage name.");
    }

    const [deployer] = await hre.ethers.getSigners();
    const initialOwner = process.env.INITIAL_OWNER || deployer.address;
    const factory = await hre.ethers.getContractFactory("DecentPilgrimageBaseV1");
    const contract = await factory.deploy(pilgrimageName, initialOwner);
    await contract.waitForDeployment();

    console.log("Deployment confirmed.");
    console.log(`Chain ID: ${network.chainId}`);
    console.log(`Contract: ${await contract.getAddress()}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Initial owner: ${initialOwner}`);
    console.log(`Pilgrimage name: ${pilgrimageName}`);
    console.log(`Transaction: ${contract.deploymentTransaction().hash}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
