const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const GOOGLE_API_KEY = 'AIzaSyCaCPqJZn8WnvZe3IK26ZwfZ6sdGIryahY';
const MAX_ELEMENTS = 100;

const preferencesOptions = {
  'Historical Sites': ['historical_place', 'museum'],
  'Parks': ['park', 'zoo'],
  'Museums': ['museum'],
  'Shopping': ['shopping_mall', 'store'],
  'Famous Attractions': ['tourist_attraction'],
  'Cafes': ['cafe'],
  'Hidden Gems': ['point_of_interest'],
  'Nature': ['natural_feature'],
  'Famous Street Foods': ['restaurant', 'food'],
  'Famous Restaurants': ['restaurant'],
  'Heritage Sites': ['historical_place'],
  'Culture': ['cultural_center'],
  'Adventure Activities': ['amusement_park'],
  'Sports': ['cricket_stadium', 'swimming_pool', 'outdoor_swimming_pool', 'sports_complex', 'tennis_court', 'soccer_field', 'futsal_court'],
  'Entertainment': ['amusement_park', 'movie_theater', 'shopping_mall', 'video_game_store'],
  'Nightlife': ['pub', 'bar', 'night_club'],
  'Yoga & Wellness': ['spa', 'gym', 'massage']
};

const recommendSpots = (spots, preferences) => {
  if (preferences && preferences.length > 0) {
    console.log(`Received preferences: ${preferences.join(', ')}`);

    const filteredSpots = spots.filter(spot => {
      const types = spot.types.map(type => type.toLowerCase());
      return preferences.some(preference => {
        const preferenceTypes = preferencesOptions[preference] || [];
        return preferenceTypes.some(pt => types.includes(pt));
      });
    });

    console.log(`Filtered spots based on preferences: ${filteredSpots.map(s => s.name).join(', ')}`);

    if (filteredSpots.length === 0) {
      console.log("No spots match preferences, falling back to sorting by rating.");
      return spots.sort((a, b) => b.rating - a.rating);
    }

    return filteredSpots.sort((a, b) => b.rating - a.rating);
  }

  console.log("No preferences provided, sorting by rating.");
  return spots.sort((a, b) => b.rating - a.rating);
};

const getDistanceMatrix = async (origins, destinations) => {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        origins: origins.join('|'),
        destinations: destinations.join('|'),
        key: GOOGLE_API_KEY,
      },
    });

    if (response.data.status !== 'OK') {
      console.error('Distance Matrix API error:', response.data);
      return null;
    }

    return response.data;
  } catch (error) {
    console.error('Error calling Distance Matrix API:', error);
    return null;
  }
};

const getPlacePhotoUrl = (photoReference) => {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${GOOGLE_API_KEY}`;
};

const splitArray = (arr, size) => {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

app.post('/api/itinerary', async (req, res) => {
  const { city, days, startTime, endTime, preferences } = req.body;

  try {
    const placesResponse = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query: `top tourist spots in ${city}`,
        key: GOOGLE_API_KEY,
      },
    });

    if (placesResponse.data.status !== 'OK') {
      console.error('Error fetching places:', placesResponse.data.error_message);
      return res.status(400).json({ error: 'Error fetching places' });
    }

    const spots = placesResponse.data.results.filter(spot => spot.name.toLowerCase() !== city.toLowerCase());

    if (spots.length === 0) {
      console.error('No spots found for the specified city.');
      return res.status(400).json({ error: 'No spots found' });
    }

    console.log('Fetched tourist spots:', spots.map(s => s.name));

    const recommendedSpots = recommendSpots(spots, preferences);

    if (recommendedSpots.length < days) {
      console.error('Not enough spots to generate itinerary.');
      return res.status(400).json({ error: 'Not enough spots to generate itinerary.' });
    }

    const placeIds = recommendedSpots.map(spot => `place_id:${spot.place_id}`);
    const chunkSize = Math.min(Math.floor(MAX_ELEMENTS / placeIds.length), placeIds.length);
    const chunkedPlaceIds = splitArray(placeIds, chunkSize);
    console.log('Prepared chunks for distance matrix:', chunkedPlaceIds);

    let allDistances = [];
    for (let i = 0; i < chunkedPlaceIds.length; i++) {
      for (let j = 0; j < chunkedPlaceIds.length; j++) {
        const origins = chunkedPlaceIds[i];
        const destinations = chunkedPlaceIds[j];
        console.log(`Requesting Distance Matrix API with origins: ${origins} and destinations: ${destinations}`);
        const distanceResponse = await getDistanceMatrix(origins, destinations);
        if (distanceResponse && distanceResponse.rows) {
          for (let k = 0; k < distanceResponse.rows.length; k++) {
            allDistances.push({
              origin: origins[k],
              elements: distanceResponse.rows[k].elements,
            });
          }
        } else {
          console.error('No distances found for chunk:', origins, destinations);
        }
      }
    }

    console.log('Aggregated distance matrix:', JSON.stringify(allDistances, null, 2));

    if (allDistances.length === 0) {
      console.error('No distances found between the spots.');
      return res.status(400).json({ error: 'No distances found' });
    }

    const itinerary = generateItinerary(recommendedSpots, allDistances, days, startTime, endTime);
    res.json(itinerary);
  } catch (error) {
    console.error('Error generating itinerary:', error.response ? error.response.data : error.message);
    res.status(500).send('Internal Server Error');
  }
});

const generateItinerary = (spots, distances, days, startTime, endTime) => {
  const sortedSpots = spots.sort((a, b) => b.rating - a.rating);
  let itinerary = [];
  let spotsPerDay = Math.ceil(sortedSpots.length / days);
  let usedSpots = new Set();

  for (let i = 0; i < days; i++) {
    let dayItinerary = [];
    let remainingSpots = sortedSpots.filter(spot => !usedSpots.has(spot.place_id));

    let currentSpot = remainingSpots.shift();
    if (currentSpot) {
      dayItinerary.push(currentSpot);
      usedSpots.add(currentSpot.place_id);
    }

    while (dayItinerary.length < spotsPerDay && remainingSpots.length > 0) {
      currentSpot = findNearestSpot(currentSpot, remainingSpots, distances);
      if (currentSpot) {
        dayItinerary.push(currentSpot);
        usedSpots.add(currentSpot.place_id);
        remainingSpots = remainingSpots.filter(spot => spot.place_id !== currentSpot.place_id);
      } else {
        break;
      }
    }

    dayItinerary.forEach((spot, index) => {
      let timeSlot = calculateTimeSlot(startTime, endTime, index, dayItinerary.length);
      const photoUrl = spot.photos && spot.photos.length > 0 ? getPlacePhotoUrl(spot.photos[0].photo_reference) : null;
      itinerary.push({ ...spot, day: i + 1, time: timeSlot, photo: photoUrl });
    });
  }

  console.log('Generated itinerary:', JSON.stringify(itinerary, null, 2));
  return itinerary;
};

const findNearestSpot = (currentSpot, spots, distances) => {
  if (!currentSpot) return null;

  let minDistance = Infinity;
  let nearestSpot = null;

  spots.forEach(spot => {
    let distance = getDistance(currentSpot.place_id, spot.place_id, distances);
    if (distance < minDistance) {
      minDistance = distance;
      nearestSpot = spot;
    }
  });

  return nearestSpot;
};

const getDistance = (originId, destinationId, distances) => {
  const originDistance = distances.find(distance => distance.origin === `place_id:${originId}`);
  if (!originDistance) return Infinity;

  const destinationElement = originDistance.elements.find(element => element.status === "OK");
  if (!destinationElement) return Infinity;

  return destinationElement.distance.value;
};

const calculateTimeSlot = (startTime, endTime, index, spotsPerDay) => {
  const start = new Date(`1970-01-01T${startTime}:00`);
  const end = new Date(`1970-01-01T${endTime}:00`);
  const totalMinutes = (end - start) / 60000;
  const slotDuration = totalMinutes / spotsPerDay;
  const slotStart = new Date(start.getTime() + index * slotDuration * 60000);
  const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);
  return `${slotStart.toTimeString().slice(0, 5)} - ${slotEnd.toTimeString().slice(0, 5)}`;
};

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
