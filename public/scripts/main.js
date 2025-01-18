import { connectWallet, getConnectedWallet } from "./wallet.js";
import { fetchLocations } from "./landmarks.js";
import { connectContracts, whitelistParticipant, whitelistSponsor, addSponsorTokens, addLocation, withdrawTokens, claimTokens, fetchSponsors, fetchCollectedTokens } from "./contract.js";

// Toggle the visibility of the info panel
function toggleInfoPanel(show) {
  const infoPanel = document.getElementById("info-panel");
  if (infoPanel) {
    if (show) {
      infoPanel.classList.remove("hidden");
    } else {
      infoPanel.classList.add("hidden");
    }
  } else {
    console.error("Info panel not found in the DOM.");
  }
}

// Toggle visibility of Admin Panel
function toggleAdminPanel(show) {
    const adminPanel = document.getElementById("admin-panel");
    if (adminPanel) {
      if (show) {
        adminPanel.classList.remove("hidden");
      } else {
        adminPanel.classList.add("hidden");
      }
    }
  }
  
  // Setup Admin Panel
  async function setupAdminPanel() {
    const connectedWallet = getConnectedWallet();
    if (!connectedWallet) {
      alert("Please connect your wallet to access admin features.");
      return;
    }
  
    const contractOwner = await pilgrimageContract.owner();
    if (connectedWallet.toLowerCase() === contractOwner.toLowerCase()) {
      toggleAdminPanel(true);
    } else {
      toggleAdminPanel(false);
    }
  }
  
  // Add event listeners for admin buttons
  function setupAdminControls() {
    document.getElementById("whitelist-participant-button").addEventListener("click", async () => {
      const address = document.getElementById("whitelist-participant").value;
      if (address) await whitelistParticipant(address);
    });
  
    document.getElementById("whitelist-sponsor-button").addEventListener("click", async () => {
      const address = document.getElementById("whitelist-sponsor").value;
      if (address) await whitelistSponsor(address);
    });
  
    document.getElementById("add-sponsor-tokens-button").addEventListener("click", async () => {
      const tokenAddress = document.getElementById("sponsor-token-address").value;
      const amount = parseInt(document.getElementById("sponsor-token-amount").value, 10);
      if (tokenAddress && amount) await addSponsorTokens(tokenAddress, amount);
    });
  
    document.getElementById("add-location-button").addEventListener("click", async () => {
      const name = document.getElementById("location-name").value;
      const lat = parseInt(document.getElementById("location-lat").value, 10);
      const lng = parseInt(document.getElementById("location-lng").value, 10);
      const radius = parseInt(document.getElementById("location-radius").value, 10);
      const mission = document.getElementById("location-mission").value;
      const tokenAddress = document.getElementById("location-token-address").value;
      const tokenAmount = parseInt(document.getElementById("location-token-amount").value, 10);
  
      if (name && lat && lng && radius && mission && tokenAddress && tokenAmount) {
        await addLocation(name, lat, lng, radius, [{ tokenAddress, amount: tokenAmount }], mission);
      }
    });
  
    document.getElementById("withdraw-tokens-button").addEventListener("click", async () => {
      const tokenAddress = document.getElementById("withdraw-token-address").value;
      const amount = parseInt(document.getElementById("withdraw-token-amount").value, 10);
      if (tokenAddress && amount) await withdrawTokens(tokenAddress, amount);
    });
  }
  

// Add plots to the map with tokens spread around the primary marker
async function addLandmarkMarkers(map) {
  const radius = 0.001; // Spread radius for tokens (in degrees)
  const angleStep = (2 * Math.PI) / 6; // Angle between tokens (6 tokens max around the marker)

  const landmarks = await fetchLocations();

  landmarks.forEach((landmark) => {
    if (!landmark.active) return; // Skip inactive locations

    // Add primary marker at landmark location
    const primaryMarker = L.marker([landmark.lat, landmark.lng]).addTo(map);

    // List available tokens in popup
    const tokenList = landmark.tokens
      .map(
        (token) =>
          `<li>${token.amount} of ${token.tokenAddress.slice(0, 6)}...${token.tokenAddress.slice(-4)}</li>`
      )
      .join("");
    primaryMarker.bindPopup(`
      <h3>${landmark.name}</h3>
      <p>${landmark.mission}</p>
      <h4>Available Tokens:</h4>
      <ul>${tokenList}</ul>
    `);

    // Spread tokens around the primary marker
    landmark.tokens.forEach((token, index) => {
      const angle = angleStep * index; // Angle for this token
      const latOffset = radius * Math.cos(angle);
      const lngOffset = radius * Math.sin(angle);

      const tokenLat = landmark.lat + latOffset;
      const tokenLng = landmark.lng + lngOffset;

      const tokenMarker = L.marker([tokenLat, tokenLng], {
        icon: L.icon({
          iconUrl: "./assets/token-placeholder.png", // Replace with relevant icon
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -15],
        }),
      }).addTo(map);

      // Add popup to each token marker
      tokenMarker.bindPopup(`
        <h4>Collect Token</h4>
        <p>${token.amount} of ${token.tokenAddress.slice(0, 6)}...${token.tokenAddress.slice(-4)}</p>
        <button class="collect-button" data-token="${token.tokenAddress}" data-location="${landmark.id}">
          Collect
        </button>
      `);

      // Add click event for token collection
      tokenMarker.on("popupopen", () => {
        const collectButton = document.querySelector(".collect-button");
        if (collectButton) {
          collectButton.addEventListener("click", async () => {
            await collectToken(landmark.id, tokenMarker, map);
          });
        }
      });
    });
  });
}

// Update the info panel
async function updateInfoPanel() {
    const infoContent = document.getElementById("info-content");
    const connectedWallet = getConnectedWallet();

    // Fetch sponsors and their balances
    const sponsors = await fetchSponsors();

    // Fetch collected tokens for the connected wallet
    const collectedTokens = connectedWallet
        ? await fetchCollectedTokens(connectedWallet)
        : [];

    // Generate HTML for sponsors
    const sponsorsHTML = sponsors
        .map(
            (sponsor) => `
        <div class="sponsor">
          <span>${sponsor.sponsorAddress.slice(0, 6)}...${sponsor.sponsorAddress.slice(-4)}</span>
          <span>${sponsor.balance} tokens</span>
        </div>`
        )
        .join("");

    // Generate HTML for collected tokens
    const collectedTokensHTML = collectedTokens
        .map(
            (token) => `
        <div class="collected-token">
          <span>${token.tokenAddress.slice(0, 6)}...${token.tokenAddress.slice(-4)}</span>
          <span>${token.amount} tokens</span>
        </div>`
        )
        .join("");

    // Update the Info Panel content
    infoContent.innerHTML = `
        <h3>Sponsors & Balances</h3>
        <div id="sponsors">${sponsorsHTML}</div>
        <h3>Your Collected Tokens</h3>
        <div id="collected-tokens">${collectedTokensHTML}</div>
    `;
}

// Add collection event to the timeline
function addCollectionEvent(token, walletAddress) {
  const timeline = document.getElementById("collection-timeline");

  // Format timestamp
  const timestamp = new Date().toLocaleString();

  // Create event element
  const eventElement = document.createElement("div");
  eventElement.className = "collection-event";
  eventElement.innerHTML = `
    <b>${token} Collected</b>
    <span>By: ${walletAddress}</span>
    <span>At: ${timestamp}</span>
  `;

  // Append to timeline
  timeline.prepend(eventElement);
}

// Collect token function
async function collectToken(locationId, marker, map) {
  const walletAddress = getConnectedWallet();

  if (!walletAddress) {
    alert("Please connect your wallet before collecting tokens.");
    return;
  }

  try {
    await claimTokens(locationId);
    console.log(`Tokens claimed for location ${locationId}`);

    // Remove token marker from the map
    map.removeLayer(marker);

    // Add to timeline
    addCollectionEvent(`Location ${locationId}`, walletAddress);

    alert("Tokens successfully collected!");
  } catch (error) {
    console.error("Error collecting tokens:", error);
    alert("Failed to collect tokens. Please try again.");
  }
}

// Initialize Map
function initMap() {
  try {
    const map = L.map("map").setView([32.7765, -79.9311], 6); // Default center and zoom level

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Add dynamically fetched landmarks
    addLandmarkMarkers(map);

    console.log("Map initialized successfully!");
  } catch (error) {
    console.error("Error initializing map:", error);
  }
}

// Main Script
document.addEventListener("DOMContentLoaded", async () => {
    await connectContracts(); // Initialize contracts

    // Initialize Map
    initMap();

    const loader = document.getElementById("loader");
    if (loader) {
        loader.classList.add("hidden");
    }

    const requestAccessButton = document.getElementById("request-access-button");
    const walletConnectButton = document.getElementById("wallet-connect-button");

    let connectedWalletAddress = null;

    // Wallet Connect Button Functionality
    walletConnectButton.addEventListener("click", async () => {
        connectedWalletAddress = await connectWallet();

        if (connectedWalletAddress) {
        alert(`Wallet connected: ${connectedWalletAddress}`);
        walletConnectButton.textContent = "Wallet Connected";
        walletConnectButton.style.backgroundColor = "rgba(93, 193, 185, 0.4)";

        const isWhitelisted = true; // Simulating whitelist check for now
        if (isWhitelisted) {
            toggleInfoPanel(true);
                // Populate info-panel
            updateInfoPanel();    
            await setupAdminPanel();
            setupAdminControls();
        
        } else {
        
            alert("Your wallet is not whitelisted. Request access to proceed.");
            toggleInfoPanel(false);
        
        }
    }
});

  requestAccessButton.addEventListener("click", () => {
    if (!connectedWalletAddress) {
      alert("Please connect your wallet before requesting access.");
      return;
    }

    const email = "DecentPilgrimages@gmail.com";
    const subject = "Request Access to DecentPilgrimages";
    const body = `Hello DecentPilgrimages Team,\n\nI would like to request access to the app. My wallet address is:\n\n${connectedWalletAddress}\n\nThank you!`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  });

  
});