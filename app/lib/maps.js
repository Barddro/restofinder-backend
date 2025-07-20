require("dotenv").config();
const { Client } = require("@googlemaps/google-maps-services-js");
const { PlacesClient } = require('@googlemaps/places').v1;
// Create a maps client
const mapsClient = new Client({});



async function fetchMapsData(cuisineType, latitude, longitude, radius, priceLevel, numberOfRestos) {
  //
  const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  
  try {
    const response = await mapsClient.placesNearby({
      params: {
        location: `${latitude},${longitude}`,
        radius: radius,
        keyword: cuisineType,
        type: 'restaurant',
        minprice: (priceLevel - 1 >= 0) ? priceLevel - 1 : 0,
        maxprice: (priceLevel + 1 <= 4) ? priceLevel + 1 : 4,
        opennow: true,
        rankby: 'prominence',
        key: API_KEY
      }
    });
    
    if (response.data.status === 'OK') {
      //console.log(response.data.results);
      goodResults = [];
      for (let i = 0; i < Math.min(numberOfRestos, response.data.results.length); i++) {
        response.data.results[i].photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=4000&photoreference=${response.data.results[i].photos[0].photo_reference}&key=${API_KEY}`;
        response.data.results[i].id = i;
        goodResults.push(response.data.results[i]);
      }
      return goodResults;
    } else {
      console.error("Places API error:", response.data.status);
      return [];
    }
  } catch (error) {
    console.error("Error fetching places:", error.message);
    throw error;
  }
}

module.exports = {
  fetchMapsData,
};
