document.addEventListener('DOMContentLoaded', () => {
    const apiKey = '1d4a267d127c0e79263fd2d904d08da5';
    const locationStatus = document.getElementById('location-status');
    const locationDisplay = document.getElementById('location-display');
    const weatherStatus = document.getElementById('weather-status');
    const currentConditionsDisplay = document.getElementById('current-conditions-display');
    const hourlyForecastDisplay = document.getElementById('hourly-forecast-display');
    const lastUpdatedSpan = document.getElementById('last-updated');
    const refreshButton = document.getElementById('refresh-button');
    const goNogoIndicator = document.getElementById('go-nogo-indicator');
    const windThresholdInput = document.getElementById('wind-threshold');
    const gustThresholdInput = document.getElementById('gust-threshold');
    const saveSettingsButton = document.getElementById('save-settings');

    let currentCoords = null;
    let windThreshold = 10; // Default mph
    let gustThreshold = 15; // Default mph

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    }

    // --- Threshold Settings ---
    function loadSettings() {
        const savedWind = localStorage.getItem('windThreshold');
        const savedGust = localStorage.getItem('gustThreshold');
        if (savedWind) {
            windThreshold = parseFloat(savedWind);
            windThresholdInput.value = windThreshold;
        }
        if (savedGust) {
            gustThreshold = parseFloat(savedGust);
            gustThresholdInput.value = gustThreshold;
        }
         console.log(`Settings loaded: Wind <= ${windThreshold}mph, Gust <= ${gustThreshold}mph`);
    }

    function saveSettings() {
        windThreshold = parseFloat(windThresholdInput.value) || 10;
        gustThreshold = parseFloat(gustThresholdInput.value) || 15;
        localStorage.setItem('windThreshold', windThreshold);
        localStorage.setItem('gustThreshold', gustThreshold);
        console.log(`Settings saved: Wind <= ${windThreshold}mph, Gust <= ${gustThreshold}mph`);
        alert('Settings saved!');
        // Re-evaluate Go/No-Go status if weather data is present
        if (currentCoords) {
            // Ideally, re-fetch or re-process existing data
            // For simplicity, let's just ask user to refresh
             weatherStatus.textContent = "Settings saved. Refresh weather to update status.";
        }
    }

    saveSettingsButton.addEventListener('click', saveSettings);

    // --- Location ---
    function getLocation() {
        locationStatus.textContent = 'Detecting location...';
        locationDisplay.textContent = '';
        weatherStatus.textContent = '';
        currentConditionsDisplay.textContent = 'Loading...';
        hourlyForecastDisplay.textContent = 'Loading...';
        goNogoIndicator.textContent = 'STATUS';
        goNogoIndicator.className = ''; // Reset class

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(showPosition, showError, {
                enableHighAccuracy: false, // Faster, less battery
                timeout: 10000, // 10 seconds
                maximumAge: 600000 // Allow cached location up to 10 mins old
            });
        } else {
            locationStatus.textContent = "Geolocation is not supported by this browser.";
            weatherStatus.textContent = "Cannot fetch weather without location.";
        }
    }

    function showPosition(position) {
        currentCoords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
        };
        locationStatus.textContent = 'Location found!';
        locationDisplay.textContent = `Lat: ${currentCoords.lat.toFixed(3)}, Lon: ${currentCoords.lon.toFixed(3)}`;
        getWeather(currentCoords.lat, currentCoords.lon);
        reverseGeocode(currentCoords.lat, currentCoords.lon); // Try to get city name
    }

    function showError(error) {
        currentCoords = null; // Reset coords on error
        switch (error.code) {
            case error.PERMISSION_DENIED:
                locationStatus.textContent = "Location access denied.";
                break;
            case error.POSITION_UNAVAILABLE:
                locationStatus.textContent = "Location information is unavailable.";
                break;
            case error.TIMEOUT:
                locationStatus.textContent = "Location request timed out.";
                break;
            case error.UNKNOWN_ERROR:
                locationStatus.textContent = "An unknown error occurred accessing location.";
                break;
        }
         weatherStatus.textContent = "Cannot fetch weather without location. Try enabling location services or refreshing.";
         // Fallback to default location (Cumming, GA) as requested
         locationStatus.textContent += " Falling back to default: Cumming, GA.";
         const defaultCoords = { lat: 34.2070, lon: -84.1402 };
         currentCoords = defaultCoords;
         locationDisplay.textContent = `Default: Lat: ${defaultCoords.lat.toFixed(3)}, Lon: ${defaultCoords.lon.toFixed(3)} (Cumming, GA)`;
         getWeather(defaultCoords.lat, defaultCoords.lon);
    }

    // --- Reverse Geocoding (Optional but nice) ---
    function reverseGeocode(lat, lon) {
        // Use OpenWeatherMap's geocoding API (requires the same API key)
         const geocodeUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`;

         fetch(geocodeUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Geocoding HTTP error! Status: ${response.status}`);
                }
                return response.json();
             })
            .then(data => {
                if (data && data.length > 0) {
                     const locationName = data[0].name || 'Unknown Area';
                     const state = data[0].state || '';
                     const country = data[0].country || '';
                     locationDisplay.textContent = `Near ${locationName}${state ? ', ' + state : ''} (${country})`;
                     console.log("Reverse geocoded location:", data[0]);
                } else {
                    console.log("No reverse geocoding results.");
                 }
             })
             .catch(error => {
                 console.error('Error fetching reverse geocoding:', error);
                 // Keep the Lat/Lon display if geocoding fails
             });
    }


    // --- Weather ---
    function getWeather(lat, lon) {
        if (!apiKey || apiKey === 'YOUR_OPENWEATHERMAP_API_KEY') {
             weatherStatus.textContent = 'Error: API key not set in script.js!';
             console.error('API key missing!');
             return;
         }

        weatherStatus.textContent = 'Fetching weather data...';
        const units = 'imperial'; // Use 'metric' for Celsius/kph
        const apiUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,daily,alerts&appid=${apiKey}&units=${units}`;

        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("Weather data received:", data);
                displayWeather(data, units);
                weatherStatus.textContent = 'Weather updated.';
                lastUpdatedSpan.textContent = new Date().toLocaleTimeString();
            })
            .catch(error => {
                console.error('Error fetching weather:', error);
                weatherStatus.textContent = `Error fetching weather: ${error.message}. Please try refreshing.`;
                currentConditionsDisplay.textContent = 'Failed to load.';
                hourlyForecastDisplay.textContent = 'Failed to load.';
                goNogoIndicator.textContent = 'ERROR';
                goNogoIndicator.className = 'status-nogo';
            });
    }

    function displayWeather(data, units) {
        // --- Display Current Conditions ---
        const current = data.current;
        const tempUnit = units === 'imperial' ? '°F' : '°C';
        const speedUnit = units === 'imperial' ? 'mph' : 'm/s'; // OWM uses m/s for metric default

        const windSpeed = current.wind_speed;
        const windGust = current.wind_gust || 0; // Use 0 if gust data is missing

        let conditionDescription = current.weather[0] ? current.weather[0].description : 'N/A';
        conditionDescription = conditionDescription.charAt(0).toUpperCase() + conditionDescription.slice(1); // Capitalize

        const iconCode = current.weather[0] ? current.weather[0].icon : '01d'; // Default icon
        const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

        currentConditionsDisplay.innerHTML = `
            <div><strong>Temperature:</strong> ${current.temp.toFixed(1)}${tempUnit} (Feels like: ${current.feels_like.toFixed(1)}${tempUnit})</div>
            <div><strong>Wind:</strong> ${windSpeed.toFixed(1)} ${speedUnit} ${getWindDirection(current.wind_deg)}</div>
            ${current.wind_gust ? `<div><strong>Gusts:</strong> ${current.wind_gust.toFixed(1)} ${speedUnit}</div>` : '<div><strong>Gusts:</strong> N/A</div>'}
            <div><strong>Conditions:</strong> ${conditionDescription} <img src="${iconUrl}" alt="${conditionDescription}" style="width: 25px; height: 25px; vertical-align: middle;"></div>
            <div><strong>Humidity:</strong> ${current.humidity}%</div>
            <div><strong>Visibility:</strong> ${(current.visibility / (units === 'imperial' ? 1609 : 1000)).toFixed(1)} ${units === 'imperial' ? 'mi' : 'km'}</div>
            <div><strong>Cloud Cover:</strong> ${current.clouds}%</div>
            <div><strong>Pressure:</strong> ${current.pressure} hPa</div>
        `;

        // --- Update Go/No-Go Status ---
        updateGoNoGo(windSpeed, windGust, units);


        // --- Display Hourly Forecast (Next 24 hours) ---
        hourlyForecastDisplay.innerHTML = ''; // Clear previous
        const hourlyData = data.hourly.slice(0, 24); // Get next 24 hours

        hourlyData.forEach(hour => {
            const date = new Date(hour.dt * 1000);
            const hourTime = date.toLocaleTimeString([], { hour: 'numeric', hour12: true }); // e.g., 5 PM

            const hourIconCode = hour.weather[0] ? hour.weather[0].icon : '01d';
            const hourIconUrl = `https://openweathermap.org/img/wn/${hourIconCode}.png`; // Smaller icon for forecast
            const hourCondition = hour.weather[0] ? hour.weather[0].description : 'N/A';


            const hourlyItem = document.createElement('div');
            hourlyItem.classList.add('hourly-item');
            hourlyItem.innerHTML = `
                <strong>${hourTime}</strong>
                <img src="${hourIconUrl}" alt="${hourCondition}" title="${hourCondition}">
                <div>Temp: ${hour.temp.toFixed(0)}${tempUnit}</div>
                <div>Wind: ${hour.wind_speed.toFixed(1)} ${speedUnit}</div>
                ${hour.wind_gust ? `<div>Gust: ${hour.wind_gust.toFixed(1)} ${speedUnit}</div>` : '<div>Gust: N/A</div>'}
                <div>Rain: ${hour.pop ? (hour.pop * 100).toFixed(0) : '0'}%</div>
            `;
            hourlyForecastDisplay.appendChild(hourlyItem);
        });
    }

    // --- Go/No-Go Logic ---
    function updateGoNoGo(windSpeedMph, windGustMph, units) {
         // Convert to MPH if necessary (OWM provides m/s for metric, mph for imperial)
         let windCheck = windSpeedMph;
         let gustCheck = windGustMph || 0;

         if (units === 'metric') {
             // Convert m/s to mph for comparison with thresholds (which are in mph)
             windCheck = windSpeedMph * 2.23694;
             gustCheck = (windGustMph || 0) * 2.23694;
         }

         console.log(`Checking conditions: Wind ${windCheck.toFixed(1)}mph, Gust ${gustCheck.toFixed(1)}mph against Thresholds W:${windThreshold}, G:${gustThreshold}`);


        if (windCheck > gustThreshold || gustCheck > gustThreshold) { // If wind OR gust exceeds GUST threshold -> NO GO
            goNogoIndicator.textContent = 'NO-GO (High Gusts)';
            goNogoIndicator.className = 'status-nogo';
        } else if (windCheck > windThreshold) { // If wind exceeds WIND threshold (but not gust threshold) -> CAUTION
            goNogoIndicator.textContent = 'CAUTION (Windy)';
             goNogoIndicator.className = 'status-caution';
        } else { // Otherwise -> GO
             goNogoIndicator.textContent = 'GO';
             goNogoIndicator.className = 'status-go';
         }
    }


    // --- Helper: Wind Direction ---
    function getWindDirection(deg) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round((deg % 360) / 22.5);
        return directions[index % 16]; // Use modulo 16 to wrap around
    }


    // --- Event Listeners ---
    refreshButton.addEventListener('click', () => {
        if (currentCoords) {
            getWeather(currentCoords.lat, currentCoords.lon);
        } else {
            getLocation(); // If no coords yet, try getting location first
        }
    });

    // --- Initial Load ---
    loadSettings(); // Load thresholds first
    getLocation(); // Start the process

});
