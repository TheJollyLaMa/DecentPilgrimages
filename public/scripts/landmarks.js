export async function fetchLocations() {
    try {
      // Ensure the pilgrimageContract is initialized
      if (!window.pilgrimageContract) {
        throw new Error("Pilgrimage contract not initialized.");
      }
  
      const locationCount = await window.pilgrimageContract.locationCount();
      const locations = [];
  
      for (let i = 0; i < locationCount; i++) {
        const location = await window.pilgrimageContract.locations(i);
  
        // Decode location tokens
        const tokens = [];
        for (let j = 0; j < location.tokens.length; j++) {
          tokens.push({
            tokenAddress: location.tokens[j].tokenAddress,
            amount: location.tokens[j].amount.toString(),
          });
        }
  
        locations.push({
          id: i,
          name: location.name,
          lat: parseFloat(location.lat) / 1e6, // Convert microdegrees to degrees
          lng: parseFloat(location.lng) / 1e6,
          radius: location.radius,
          tokens,
          mission: location.mission,
          active: location.active,
        });
      }
  
      console.log("Fetched locations:", locations);
      return locations;
    } catch (error) {
      console.error("Error fetching locations:", error);
      return [];
    }
  }