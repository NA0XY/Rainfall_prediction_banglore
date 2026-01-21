// Risk Distribution Chart
fetch('wards_extracted.geojson')
    .then(response => response.json())
    .then(data => {
        createRiskDistributionChart(data);
    })
    .catch(error => {
        console.error('Error loading data for charts:', error);
    });

function createRiskDistributionChart(data) {
    const features = data.features;
    
    // Count risk levels
    const riskCounts = {
        'Low Risk': 0,
        'Medium Risk': 0,
        'High Risk': 0
    };
    
    features.forEach(feature => {
        const riskClass = feature.properties.hazard_class || 'Unknown';
        if (riskCounts.hasOwnProperty(riskClass)) {
            riskCounts[riskClass]++;
        }
    });
    
    // Create chart
    const ctx = document.getElementById('risk-distribution-chart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Low Risk', 'Medium Risk', 'High Risk'],
            datasets: [{
                data: [
                    riskCounts['Low Risk'],
                    riskCounts['Medium Risk'],
                    riskCounts['High Risk']
                ],
                backgroundColor: [
                    '#4575b4',
                    '#fee090',
                    '#d73027'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: {
                            size: 14
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Ward Risk Level Distribution',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} wards (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}