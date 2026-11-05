async function verifyContract(hre, env) {
    const expectedChainIds = { base: 8453, baseSepolia: 84532 };
    const expectedChainId = expectedChainIds[hre.network.name];
    if (!expectedChainId) {
        throw new Error("Source verification is restricted to the configured Base networks.");
    }

    const address = env.CONTRACT_ADDRESS;
    const pilgrimageName = env.PILGRIMAGE_NAME;
    const initialOwner = env.INITIAL_OWNER;

    if (!env.ETHERSCAN_API_KEY || !env.ETHERSCAN_API_KEY.trim()) {
        throw new Error("Set ETHERSCAN_API_KEY to an Etherscan V2 API key.");
    }
    if (!address || !pilgrimageName || !initialOwner) {
        throw new Error(
            "Set CONTRACT_ADDRESS, PILGRIMAGE_NAME, and INITIAL_OWNER to the confirmed deployment values."
        );
    }
    if (
        !hre.ethers.isAddress(address) || !hre.ethers.isAddress(initialOwner)
        || address === hre.ethers.ZeroAddress || initialOwner === hre.ethers.ZeroAddress
    ) {
        throw new Error("CONTRACT_ADDRESS and INITIAL_OWNER must be valid nonzero addresses.");
    }
    const chainConfig = hre.config.etherscan.customChains.find(
        (chain) => chain.network === hre.network.name && chain.chainId === expectedChainId
    );
    if (
        typeof hre.config.etherscan.apiKey !== "string"
        || hre.config.etherscan.apiKey !== env.ETHERSCAN_API_KEY
        || chainConfig?.urls.apiURL !== "https://api.etherscan.io/v2/api"
    ) {
        throw new Error("Configure one Etherscan V2 API key and the selected Base chain endpoint.");
    }

    const artifact = await hre.artifacts.readArtifact("DecentPilgrimageBaseV1");
    const network = await hre.ethers.provider.getNetwork();
    if (network.chainId !== BigInt(expectedChainId)) {
        throw new Error(`Network chain ID mismatch: expected ${expectedChainId}, got ${network.chainId}.`);
    }
    console.log(
        `Verifying ${artifact.sourceName}:${artifact.contractName} on chain ${network.chainId} using the compiled Hardhat artifact.`
    );

    await hre.run("verify:verify", {
        address,
        contract: `${artifact.sourceName}:${artifact.contractName}`,
        constructorArguments: [pilgrimageName, initialOwner]
    });
}

module.exports = { verifyContract };

if (require.main === module) {
    verifyContract(require("hardhat"), process.env).catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
