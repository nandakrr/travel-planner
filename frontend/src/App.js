import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

const preferencesOptions = [
  'Historical Sites',
  'Parks',
  'Museums',
  'Shopping',
  'Famous Attractions',
  'Cafes',
  'Hidden Gems',
  'Nature',
  'Famous Street Foods',
  'Famous Restaurants',
  'Heritage Sites',
  'Culture',
  'Adventure Activities',
  'Sports',
  'Entertainment',
  'Nightlife',
  'Yoga & Wellness'
];

function App() {
  const [city, setCity] = useState('');
  const [days, setDays] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [preferences, setPreferences] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous error
    setItinerary([]); // Clear previous itinerary

    try {
      console.log('Sending request to backend with:', { city, days, startTime, endTime, preferences });
      const response = await axios.post('http://54.80.245.143:5000/api/itinerary', { city, days, startTime, endTime, preferences });
      console.log('Received response from backend:', response.data);
      setItinerary(response.data);
    } catch (error) {
      console.error('Error fetching itinerary:', error);
      setError(error.response ? error.response.data.error : 'Error fetching itinerary. Please try again.');
    }
  };

  const handlePreferenceChange = (preference) => {
    setPreferences(
      preferences.includes(preference)
        ? preferences.filter(p => p !== preference)
        : [...preferences, preference]
    );
  };

  return (
    <div className="App">
      <div className="header">
        <img src={`${process.env.PUBLIC_URL}/logo.jpg`} alt="Trip Planner Logo" className="logo" />
        <h1>Trip Planner</h1>
      </div>
      <div className="form-container">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Enter city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
          <input
            type="number"
            placeholder="Enter number of days"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            required
          />
          <input
            type="time"
            placeholder="Start Time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <input
            type="time"
            placeholder="End Time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
          <div className="preferences">
            {preferencesOptions.map(option => (
              <button
                type="button"
                key={option}
                className={preferences.includes(option) ? 'selected' : ''}
                onClick={() => handlePreferenceChange(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <button type="submit">Generate Itinerary</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
      <ul className="itinerary">
        {itinerary.map((spot, index) => (
          <li key={index} className="spot">
            <h2>{spot.name}</h2>
            <p>{spot.formatted_address}</p>
            <p>Rating: {spot.rating}</p>
            <p>Day: {spot.day}, Time: {spot.time}</p>
            {spot.photo && <img src={spot.photo} alt={spot.name} className="spot-image" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
