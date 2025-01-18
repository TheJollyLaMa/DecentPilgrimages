let walletProvider, userAddress;

export async function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        alert("MetaMask is not installed! Please install MetaMask to use this application.");
        return null;
    }

    try {
        walletProvider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await walletProvider.send("eth_requestAccounts", []);
        userAddress = accounts[0];
        console.log("Wallet connected:", userAddress);

        // Update UI
        const walletButton = document.getElementById("wallet-connect-button");
        walletButton.classList.remove("disconnected");
        walletButton.classList.add("connected");

        return userAddress;
    } catch (error) {
        console.error("Error connecting wallet:", error.message);
        alert(error.message);
        return null;
    }
}

export function getConnectedWallet() {
    return userAddress || null;
}