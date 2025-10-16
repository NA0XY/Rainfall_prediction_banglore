(function () {
    const hazardPalette = {
        "Very High Risk": "#b91c1c",
        "High Risk": "#dc2626",
        "Medium Risk": "#f97316",
        "Low Risk": "#1d9a6c",
        "Very Low Risk": "#2563eb"
    };

    const defaultHazardOrder = [
        "Very High Risk",
        "High Risk",
        "Medium Risk",
        "Low Risk",
        "Very Low Risk"
    ];

    const bodyDataset = document.body.dataset || {};
    let metrics = {};

    try {
        metrics = bodyDataset.metrics ? JSON.parse(bodyDataset.metrics) : {};
    } catch (_err) {
        metrics = {};
    }

    let hazardCounts = metrics.hazard_counts || {};
    let hazardOrder = metrics.hazard_order || defaultHazardOrder.filter(
        (label) => Object.prototype.hasOwnProperty.call(hazardCounts, label)
    );

    if (!hazardOrder.length && Object.keys(hazardCounts).length) {
        hazardOrder = Object.keys(hazardCounts);
    }

    const map = L.map("map", { zoomSnap: 0.25, zoomDelta: 0.5 });
    const baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    });
    baseLayer.addTo(map);

    let geoJsonLayer = null;
    let activeFeatureLayer = null;

    const legendContainer = document.getElementById("legend");
    const hazardCountsContainer = document.getElementById("hazard-counts");
    const wardTitle = document.getElementById("ward-title");
    const wardDetails = document.getElementById("ward-details");

    function getHazardColor(hazardLabel) {
        return hazardPalette[hazardLabel] || "#64748b";
    }

    function formatNumber(value, options = {}) {
        if (value === null || value === undefined || Number.isNaN(value)) {
            return "N/A";
        }
        const formatter = new Intl.NumberFormat(undefined, options);
        return formatter.format(value);
    }

    function renderHazardCounts() {
        if (!hazardCountsContainer) {
            return;
        }

        const labels = hazardOrder.length ? hazardOrder : Object.keys(hazardCounts);
        if (!labels.length) {
            hazardCountsContainer.innerHTML = "<p>No hazard counts available.</p>";
            return;
        }

        hazardCountsContainer.innerHTML = "";
        const list = document.createElement("ul");
        list.className = "metrics-list";

        labels.forEach((label) => {
            const count = Object.prototype.hasOwnProperty.call(hazardCounts, label)
                ? hazardCounts[label]
                : 0;
            const li = document.createElement("li");
            li.className = "metric-item";
            li.innerHTML = `
                <strong>${label}</strong>
                <span>${formatNumber(count)}</span>
            `;
            list.appendChild(li);
        });

        hazardCountsContainer.appendChild(list);
    }

    function renderLegend() {
        if (!legendContainer) {
            return;
        }

        legendContainer.innerHTML = "";
        const labels = hazardOrder.length
            ? hazardOrder
            : Object.keys(hazardPalette);

        labels.forEach((label) => {
            const li = document.createElement("li");
            li.innerHTML = `
                <span style="background:${getHazardColor(label)}"></span>
                ${label}
            `;
            legendContainer.appendChild(li);
        });
    }

    function populatePerformanceTable(rows = []) {
        const tbody = document.querySelector("#performance-table tbody");
        if (!tbody) {
            return;
        }

        tbody.innerHTML = "";
        if (!rows.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 2;
            td.textContent = "Model performance data not available.";
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        rows
            .slice()
            .sort((a, b) => {
                const aAccuracy = typeof a.accuracy === "number" ? a.accuracy : 0;
                const bAccuracy = typeof b.accuracy === "number" ? b.accuracy : 0;
                return bAccuracy - aAccuracy;
            })
            .forEach((row) => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${row.model}</td>
                    <td>${row.accuracy !== undefined ? formatNumber(row.accuracy, {
                        style: "percent",
                        minimumFractionDigits: 1
                    }) : "N/A"}</td>
                `;
                tbody.appendChild(tr);
            });
    }

    function updateWardDetails(properties) {
        if (!properties) {
            wardTitle.textContent = "Select a ward";
            wardDetails.innerHTML = "<p>Click a ward on the map to view its flood hazard profile.</p>";
            return;
        }

        wardTitle.textContent = properties.Name || "Unnamed ward";
        const rainfallStats = `
            <li><strong>Hazard class:</strong> ${(properties && properties.predicted_hazard) || "N/A"}</li>
            <li><strong>Hazard score:</strong> ${formatNumber(properties && properties.hazard_score, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}</li>
            <li><strong>Average rainfall:</strong> ${formatNumber(properties && properties.average_rainfall, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })} mm/day</li>
            <li><strong>Max daily rainfall:</strong> ${formatNumber(properties && properties.max_daily_rainfall, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })} mm</li>
            <li><strong>Rainfall variability:</strong> ${formatNumber(properties && properties.rainfall_std, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}</li>
            <li><strong>Total rainfall (period):</strong> ${formatNumber(properties && properties.total_rainfall, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            })} mm</li>
            <li><strong>Mean elevation:</strong> ${formatNumber(properties && properties.mean_elevation, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            })} m</li>
            <li><strong>Mean slope:</strong> ${formatNumber(properties && properties.mean_slope, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })} &deg;</li>
            <li><strong>Drainage density:</strong> ${formatNumber(properties && properties.drainage_density, {
                minimumFractionDigits: 4,
                maximumFractionDigits: 4
            })}</li>
            <li><strong>Land cover index:</strong> ${
                properties && Object.prototype.hasOwnProperty.call(properties, "land_cover")
                    ? properties.land_cover
                    : "N/A"
            }</li>
        `;

        wardDetails.innerHTML = `<ul class="metrics-list">${rainfallStats}</ul>`;
    }

    function deriveCounts(features) {
        const counts = {};
        features.forEach((feature) => {
            const label = feature && feature.properties
                ? feature.properties.predicted_hazard
                : undefined;
            if (!label) {
                return;
            }
            counts[label] = (counts[label] || 0) + 1;
        });
        return counts;
    }

    function applyFeatureInteractions(layer, feature) {
        layer.on({
            mouseover: (event) => {
                const target = event.target;
                target.setStyle({
                    weight: 2,
                    color: "#0f172a",
                    fillOpacity: 0.75
                });
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                    target.bringToFront();
                }
            },
            mouseout: (event) => {
                const target = event.target;
                if (activeFeatureLayer && target._leaflet_id === activeFeatureLayer._leaflet_id) {
                    return;
                }
                geoJsonLayer.resetStyle(target);
            },
            click: (event) => {
                if (activeFeatureLayer) {
                    geoJsonLayer.resetStyle(activeFeatureLayer);
                }
                activeFeatureLayer = event.target;
                activeFeatureLayer.setStyle({
                    weight: 3,
                    color: "#0f172a",
                    fillOpacity: 0.8
                });
                updateWardDetails(feature.properties);
            }
        });
    }

    function initializeGeoJson(data) {
        geoJsonLayer = L.geoJSON(data, {
            style: (feature) => ({
                color: "#ffffff",
                weight: 1,
                opacity: 0.9,
                fillOpacity: 0.6,
                fillColor: getHazardColor(
                    feature && feature.properties
                        ? feature.properties.predicted_hazard
                        : undefined
                )
            }),
            onEachFeature: (feature, layer) => applyFeatureInteractions(layer, feature)
        }).addTo(map);

        try {
            map.fitBounds(geoJsonLayer.getBounds(), { padding: [12, 12] });
        } catch (_err) {
            map.setView([12.97, 77.59], 11);
        }

        if (!Object.keys(hazardCounts).length) {
            hazardCounts = deriveCounts((data && data.features) || []);
            hazardOrder = hazardOrder.length
                ? hazardOrder
                : defaultHazardOrder.filter((label) => hazardCounts[label]);
        }

        renderHazardCounts();
        renderLegend();
    }

    async function loadGeoJson() {
        try {
            const response = await fetch("/api/wards");
            if (!response.ok) {
                throw new Error(`Failed to fetch wards GeoJSON: ${response.status}`);
            }
            const data = await response.json();
            initializeGeoJson(data);
        } catch (error) {
            console.error(error);
            wardDetails.innerHTML = `<p>Unable to load ward boundaries. Please try again later.</p>`;
        }
    }

    async function loadPerformance() {
        try {
            const response = await fetch("/api/performance");
            if (!response.ok) {
                throw new Error(`Failed to fetch performance: ${response.status}`);
            }
            const payload = await response.json();
            if (payload.metrics) {
                metrics = payload.metrics;
                hazardCounts = metrics.hazard_counts || hazardCounts;
                hazardOrder = metrics.hazard_order || hazardOrder;
                renderHazardCounts();
                renderLegend();
            }
            populatePerformanceTable((payload && payload.comparison) || []);
        } catch (error) {
            console.error(error);
            populatePerformanceTable();
        }
    }

    renderHazardCounts();
    renderLegend();
    loadGeoJson();
    loadPerformance();

    updateWardDetails(null);
})();
