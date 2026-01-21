// Initialize the map
const map = L.map('map').setView([12.9716, 77.5946], 10); // Centered on Bangalore approx

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Load wards data
fetch('wards_extracted.geojson')
    .then(response => response.json())
    .then(data => {
        // Add GeoJSON layer
        L.geoJSON(data, {
            style: function(feature) {
                return {
                    color: 'blue',
                    weight: 2,
                    opacity: 0.7,
                    fillOpacity: 0.3
                };
            },
            onEachFeature: function(feature, layer) {
                // Create popup content
                let popupContent = `<h3>Ward: ${feature.properties.Name || 'Unknown'}</h3>`;
                popupContent += `<p>Elevation: ${feature.properties.elevation ? feature.properties.elevation.toFixed(2) : 'N/A'} m</p>`;
                popupContent += `<p>Slope: ${feature.properties.slope ? feature.properties.slope.toFixed(2) : 'N/A'} °</p>`;
                popupContent += `<p>Land Cover: ${feature.properties.land_cover || 'N/A'}</p>`;
                popupContent += `<p>Drainage Density: ${feature.properties.drainage_density ? feature.properties.drainage_density.toFixed(4) : 'N/A'}</p>`;
                popupContent += `<p>Average Rainfall: ${feature.properties.average_rainfall ? feature.properties.average_rainfall.toFixed(2) : 'N/A'} mm</p>`;
                popupContent += `<p>Traffic Factor: ${feature.properties.traffic_factor ? feature.properties.traffic_factor.toFixed(2) : 'N/A'}</p>`;
                popupContent += `<p>Current Rainfall: ${feature.properties.current_rainfall ? feature.properties.current_rainfall.toFixed(2) : 'N/A'} mm</p>`;
                popupContent += `<p>Current Temperature: ${feature.properties.current_temperature ? feature.properties.current_temperature.toFixed(2) : 'N/A'} °C</p>`;
                popupContent += `<p>Current Humidity: ${feature.properties.current_humidity ? feature.properties.current_humidity.toFixed(2) : 'N/A'} %</p>`;

                layer.bindPopup(popupContent);
            }
        }).addTo(map);

        // Fit map to bounds
        map.fitBounds(L.geoJSON(data).getBounds());
    })
    .catch(error => {
        console.error('Error loading GeoJSON:', error);
        alert('Failed to load wards data. Make sure wards_extracted.geojson is in the same directory.');
    });