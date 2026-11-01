require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");

const networks = {};
const networkFlag = process.argv.indexOf("--network");
const selectedNetwork = networkFlag >= 0 ? process.argv[networkFlag + 1] : undefined;
const isDeployment = process.argv.some((argument) => argument.endsWith("scripts/deploy.js"));
const isVerification = process.argv.some((argument) => argument.endsWith("scripts/verify.js"));

if (selectedNetwork === "base" && process.env.BASE_RPC_URL) {
    networks.base = {
        url: process.env.BASE_RPC_URL,
        chainId: 8453
    };
    if (isDeployment && process.env.DEPLOYER_PRIVATE_KEY) {
        networks.base.accounts = [process.env.DEPLOYER_PRIVATE_KEY];
    }
}

if (selectedNetwork === "baseSepolia" && process.env.BASE_SEPOLIA_RPC_URL) {
    networks.baseSepolia = {
        url: process.env.BASE_SEPOLIA_RPC_URL,
        chainId: 84532
    };
    if (isDeployment && process.env.DEPLOYER_PRIVATE_KEY) {
        networks.baseSepolia.accounts = [process.env.DEPLOYER_PRIVATE_KEY];
    }
}

module.exports = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: { enabled: true, runs: 200 }
        }
    },
    networks,
    etherscan: {
        apiKey: isVerification ? process.env.ETHERSCAN_API_KEY || "" : "",
        customChains: [
            {
                network: "base",
                chainId: 8453,
                urls: {
                    apiURL: "https://api.etherscan.io/v2/api",
                    browserURL: "https://basescan.org"
                }
            },
            {
                network: "baseSepolia",
                chainId: 84532,
                urls: {
                    apiURL: "https://api.etherscan.io/v2/api",
                    browserURL: "https://sepolia.basescan.org"
                }
            }
        ]
    }
};
