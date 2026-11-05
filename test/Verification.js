// SPDX-License-Identifier: Apache-2.0
const { expect } = require("chai");
const hre = require("hardhat");
const { Etherscan } = require("@nomicfoundation/hardhat-verify/internal/etherscan");
const { verifyContract } = require("../scripts/verify");

describe("Base Etherscan V2 verification configuration (offline)", function () {
    const address = "0x1111111111111111111111111111111111111111";
    const initialOwner = "0x2222222222222222222222222222222222222222";
    const env = {
        ETHERSCAN_API_KEY: "offline-test-key",
        CONTRACT_ADDRESS: address,
        INITIAL_OWNER: initialOwner,
        PILGRIMAGE_NAME: "Offline fixture"
    };

    function fixture(networkName = "base", chainId = 8453n) {
        const calls = [];
        return {
            calls,
            runtime: {
                network: { name: networkName },
                config: {
                    etherscan: {
                        ...hre.config.etherscan,
                        apiKey: env.ETHERSCAN_API_KEY
                    }
                },
                ethers: {
                    isAddress: hre.ethers.isAddress,
                    ZeroAddress: hre.ethers.ZeroAddress,
                    provider: { getNetwork: async () => { calls.push("rpc"); return { chainId }; } }
                },
                artifacts: {
                    readArtifact: async (name) => {
                        calls.push(name);
                        return hre.artifacts.readArtifact(name);
                    }
                },
                run: async (task, args) => calls.push({ task, args })
            }
        };
    }

    it("resolves both Base chains to the current plugin's V2 endpoint with a unified key", function () {
        for (const [network, chainId] of [["base", 8453], ["baseSepolia", 84532]]) {
            const chain = hre.config.etherscan.customChains.find((entry) => entry.network === network);
            expect(chain.chainId).to.equal(chainId);
            expect(chain.urls.apiURL).to.equal("https://api.etherscan.io/v2/api");
            const client = Etherscan.fromChainConfig(env.ETHERSCAN_API_KEY, chain);
            expect(client.apiUrl).to.equal("https://api.etherscan.io/v2/api");
            expect(client.chainId).to.equal(chainId);
        }
    });

    it("rejects missing key or constructor inputs before RPC or artifact access", async function () {
        for (const field of ["ETHERSCAN_API_KEY", "CONTRACT_ADDRESS", "INITIAL_OWNER", "PILGRIMAGE_NAME"]) {
            const { runtime, calls } = fixture();
            let error;
            try { await verifyContract(runtime, { ...env, [field]: "" }); } catch (caught) { error = caught; }
            expect(error).to.be.instanceOf(Error);
            expect(calls).to.deep.equal([]);
        }
    });

    it("rejects legacy key maps and V1 endpoints without submitting source", async function () {
        for (const legacy of ["keyMap", "endpoint"]) {
            const { runtime, calls } = fixture();
            if (legacy === "keyMap") runtime.config.etherscan.apiKey = { base: "offline-test-key" };
            else runtime.config.etherscan.customChains = [
                { network: "base", chainId: 8453, urls: { apiURL: "https://api.basescan.org/api" } }
            ];
            let error;
            try { await verifyContract(runtime, env); } catch (caught) { error = caught; }
            expect(error.message).to.include("Etherscan V2");
            expect(calls).to.deep.equal([]);
        }
    });

    it("rejects unsupported networks and invalid or zero addresses without network access", async function () {
        for (const invalid of [
            { network: "hardhat", env },
            { network: "base", env: { ...env, CONTRACT_ADDRESS: "invalid" } },
            { network: "base", env: { ...env, CONTRACT_ADDRESS: hre.ethers.ZeroAddress } },
            { network: "base", env: { ...env, INITIAL_OWNER: hre.ethers.ZeroAddress } }
        ]) {
            const { runtime, calls } = fixture(invalid.network);
            let error;
            try { await verifyContract(runtime, invalid.env); } catch (caught) { error = caught; }
            expect(error).to.be.instanceOf(Error);
            expect(calls).to.deep.equal([]);
        }
    });

    it("rejects a mismatched chain before invoking the verification task", async function () {
        const { runtime, calls } = fixture("base", 84532n);
        let error;
        try { await verifyContract(runtime, env); } catch (caught) { error = caught; }
        expect(error.message).to.include("chain ID mismatch");
        expect(calls.some((entry) => entry.task)).to.equal(false);
    });

    it("passes the exact compiled artifact name and constructor arguments for both chains (mock submission)", async function () {
        for (const [network, chainId] of [["base", 8453n], ["baseSepolia", 84532n]]) {
            const { runtime, calls } = fixture(network, chainId);
            await verifyContract(runtime, env);
            expect(calls.at(-1)).to.deep.equal({
                task: "verify:verify",
                args: {
                    address,
                    contract: "contracts/DecentPilgrimageBaseV1.sol:DecentPilgrimageBaseV1",
                    constructorArguments: [env.PILGRIMAGE_NAME, initialOwner]
                }
            });
        }
    });
});
