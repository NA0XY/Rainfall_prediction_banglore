// Initialize map
const map = L.map('leaflet-map').setView([12.9716, 77.5946], 10);

// Add tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// Store the GeoJSON layer globally
let geoJsonLayer;
let wardsData;

// Color scale function
function getColor(hazardScore) {
    return hazardScore > 2.5 ? '#d73027' :  // High Risk - Red (above 2.5)
           hazardScore > 2 ? '#fee090' :     // Medium Risk - Yellow
           hazardScore > 1.5 ? '#91bfdb' :   // Low Risk - Light Blue
                               '#4575b4';    // Very Low Risk - Blue
}

// Style function
function style(feature) {
    return {
        fillColor: getColor(feature.properties.hazard_score),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

// Highlight feature
function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
        weight: 5,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.9
    });
    layer.bringToFront();
}

// Reset highlight
function resetHighlight(e) {
    geoJsonLayer.resetStyle(e.target);
}

// Zoom to feature
function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

// Create popup content
function createPopupContent(properties) {
    const riskClass = properties.hazard_class || 'Unknown';
    const riskBadgeClass = riskClass.toLowerCase().replace(' ', '-');
    
    return `
        <div class="popup-content">
            <h3>${properties.Name || 'Unknown Ward'}</h3>
            <div class="risk-badge ${riskBadgeClass}">${riskClass}</div>
            <div class="info-row">
                <span class="info-label">Hazard Score:</span>
                <span class="info-value">${(properties.hazard_score || 0).toFixed(2)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Elevation:</span>
                <span class="info-value">${(properties.elevation || 0).toFixed(2)} m</span>
            </div>
            <div class="info-row">
                <span class="info-label">Slope:</span>
                <span class="info-value">${(properties.slope || 0).toFixed(2)}°</span>
            </div>
            <div class="info-row">
                <span class="info-label">Avg Rainfall:</span>
                <span class="info-value">${(properties.average_rainfall || 0).toFixed(2)} mm</span>
            </div>
            <div class="info-row">
                <span class="info-label">Max Daily Rainfall:</span>
                <span class="info-value">${(properties.max_daily_rainfall || 0).toFixed(2)} mm</span>
            </div>
            <div class="info-row">
                <span class="info-label">Drainage Density:</span>
                <span class="info-value">${(properties.drainage_density || 0).toFixed(4)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Current Rainfall:</span>
                <span class="info-value">${(properties.current_rainfall || 0).toFixed(2)} mm</span>
            </div>
            <div class="info-row">
                <span class="info-label">Temperature:</span>
                <span class="info-value">${(properties.current_temperature || 0).toFixed(1)}°C</span>
            </div>
            <div class="info-row">
                <span class="info-label">Humidity:</span>
                <span class="info-value">${(properties.current_humidity || 0).toFixed(0)}%</span>
            </div>
        </div>
    `;
}

// On each feature
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
    
    layer.bindPopup(createPopupContent(feature.properties));
}

// Load GeoJSON data
fetch('wards_extracted.geojson')
    .then(response => response.json())
    .then(data => {
        wardsData = data;
        
        // Add GeoJSON layer
        geoJsonLayer = L.geoJSON(data, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);
        
        // Fit map to bounds
        map.fitBounds(geoJsonLayer.getBounds());
        
        // Update statistics
        updateStatistics(data);
        
        // Setup filters
        setupFilters(data);
    })
    .catch(error => {
        console.error('Error loading GeoJSON:', error);
        alert('Failed to load wards data. Please ensure the file exists.');
    });

// Update statistics
function updateStatistics(data) {
    const features = data.features;
    document.getElementById('ward-count').textContent = features.length;
    
    const highRiskCount = features.filter(f => 
        f.properties.hazard_class === 'High Risk'
    ).length;
    document.getElementById('high-risk-count').textContent = highRiskCount;
}

// Setup filters
function setupFilters(data) {
    const riskFilter = document.getElementById('risk-filter');
    const searchWard = document.getElementById('search-ward');
    
    riskFilter.addEventListener('change', filterByRisk);
    searchWard.addEventListener('input', searchWardByName);
}

// Filter by risk level
function filterByRisk(e) {
    const selectedRisk = e.target.value;
    
    map.removeLayer(geoJsonLayer);
    
    const filteredData = {
        type: 'FeatureCollection',
        features: selectedRisk === 'all' 
            ? wardsData.features 
            : wardsData.features.filter(f => f.properties.hazard_class === selectedRisk)
    };
    
    geoJsonLayer = L.geoJSON(filteredData, {
        style: style,
        onEachFeature: onEachFeature
    }).addTo(map);
    
    if (filteredData.features.length > 0) {
        map.fitBounds(geoJsonLayer.getBounds());
    }
}

// Search ward by name
function searchWardByName(e) {
    const searchTerm = e.target.value.toLowerCase();
    
    if (searchTerm.length < 2) {
        map.removeLayer(geoJsonLayer);
        geoJsonLayer = L.geoJSON(wardsData, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);
        return;
    }
    
    const filteredData = {
        type: 'FeatureCollection',
        features: wardsData.features.filter(f => 
            (f.properties.Name || '').toLowerCase().includes(searchTerm)
        )
    };
    
    map.removeLayer(geoJsonLayer);
    geoJsonLayer = L.geoJSON(filteredData, {
        style: style,
        onEachFeature: onEachFeature
    }).addTo(map);
    
    if (filteredData.features.length > 0) {
        map.fitBounds(geoJsonLayer.getBounds());
    }
}

// Add legend
const legend = L.control({position: 'bottomright'});

legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');
    const grades = [0, 1.5, 2, 2.5];
    const labels = ['<strong>Hazard Score</strong>'];
    
    for (let i = 0; i < grades.length; i++) {
        labels.push(
            '<i style="background:' + getColor(grades[i] + 0.1) + '"></i> ' +
            grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] : '+')
        );
    }
    
    div.innerHTML = labels.join('<br>');
    return div;
};

legend.addTo(map);