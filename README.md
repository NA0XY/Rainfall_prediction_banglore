# Ward-level Flooding Hazard Prediction — Project Summary

## Executive summary
This project builds an end-to-end, geospatial machine learning pipeline to predict ward-level flooding hazard. It ingests multi-source spatial and temporal data, engineers risk features, trains and compares multiple ML models, explains predictions with SHAP, evaluates robustness against climate-change scenarios, analyzes seasonal and long-term rainfall patterns, forecasts near-term rainfall, and exports artifacts for a web application.

Key outcomes
- Data coverage: 243 wards, 5,517 columns (including 1,826 daily rainfall columns for 2010–2024)
- Core modeling features (9): elevation, slope, average_rainfall, max_daily_rainfall, rainfall_std, total_rainfall, land_cover, drainage_density, traffic_factor
- Models compared: RandomForest, GradientBoosting, LogisticRegression, SVM, Neural Network
- Deliverables: predictions GeoJSON, model comparison JSON, metrics JSON, trained model (pkl)


## Repository layout
- DataExtraction.ipynb — Extracts and assembles geospatial/time-series data into wards_extracted.geojson
- ModelTraining.ipynb — Feature engineering, forecasting, model training/evaluation, interpretability, scenarios, exports
- 5th cite.gpkg — Input GeoPackage with ward boundaries
- webapp/data/ (generated) — Deployment-ready artifacts (GeoJSON, JSON metrics, trained model)


## Phase 1 — Data extraction (DataExtraction.ipynb)
Inputs
- Ward polygons: 5th cite.gpkg
- Elevation & slope: SRTM (Earth Engine)
- Rainfall (2010–2024 daily): CHIRPS (Earth Engine)
- Land cover: ESA WorldCover 2020
- Hydrography & roads: OpenStreetMap
- Optional live weather: OpenWeatherMap API

Processing steps (zonal and network stats)
1. Ward geometry loading from GeoPackage
2. Elevation & slope: compute per-ward zonal statistics
3. Rainfall time series: daily CHIRPS per ward → aggregate statistics (avg, max, std, total)
4. Land cover: derive dominant class per ward
5. Drainage density: length of waterways per km² from OSM
6. Traffic factor (urbanization proxy): road density from OSM
7. Optional: current_rainfall, current_temperature, current_humidity

Outputs
- wards_extracted.geojson (primary), wards_extracted.pkl (optional)
- Shape: (243 rows, 5,517 columns). Includes 1,826 date columns (2010–2024 daily rainfall)
- Standardized column names used downstream: elevation, slope, average_rainfall, max_daily_rainfall, rainfall_std, total_rainfall, land_cover, drainage_density, traffic_factor

Why this approach
- Ward-level analysis requires reducing raster data to polygon stats (zonal stats) and vector networks to per-area densities
- Multi-source integration captures multiple risk drivers beyond rainfall (topography, drainage, urbanization)


## Phase 2 — Feature engineering and target (ModelTraining.ipynb)
Normalization & composite hazard score
- Normalize with MinMaxScaler: elevation_norm, slope_norm, rainfall_norm, drainage_norm, traffic_norm
- Hazard score (higher ⇒ riskier):
  hazard_score = (1 - elevation_norm) + (1 - slope_norm) + rainfall_norm + (1 - drainage_norm) + traffic_norm
- Reasoning: lower elevation, flatter slopes, weaker drainage, and higher urbanization raise risk; rainfall increases risk directly

Target classes
- hazard_class via pd.qcut(hazard_score, q=3) to create balanced classes: Low Risk, Medium Risk, High Risk
- Rationale: Quantile binning ensures stratified balance for small datasets


## Phase 3 — Time-series rainfall forecasting
- Model: SARIMA(1,1,1) × (1,1,1, 7) on average daily rainfall across wards
- Forecast horizon: 30 days, providing forward-looking rainfall inputs
- Why SARIMA: captures trend, seasonality, and weekly structure without requiring large datasets


## Phase 4 — Model training and comparison
Data prep
- Features: ['elevation','slope','average_rainfall','max_daily_rainfall','rainfall_std','total_rainfall','land_cover','drainage_density','traffic_factor']
- Numeric coercion with median imputation; land_cover mode imputation
- Train/test split: 80/20, stratified by hazard_class; seeds set for reproducibility

Models evaluated
- RandomForestClassifier (n_estimators=200)
- GradientBoostingClassifier
- LogisticRegression (multinomial) with StandardScaler in Pipeline
- SVC(probability=True) with StandardScaler in Pipeline
- Neural Network (Keras) wrapped for sklearn compatibility with StandardScaler:
  - Architecture: Dense(128) → Dropout(0.2) → Dense(64) → Dropout(0.2) → Dense(32) → Dense(3, softmax)
  - Epochs=50, batch_size=16

Notes on dataset size
- Only 243 samples (≈194 train / 49 test). Neural network trains very fast because the dataset is tiny; tree-based models are typically more reliable in this regime.

Selection & outputs
- Print classification reports; assemble accuracy leaderboard; pick best by accuracy
- Produce ward-level predictions and a categorized hazard order for prioritization


## Phase 5 — Evaluation diagnostics
- Confusion matrix and classification report for the selected model
- ROC-AUC (multi-class OVR) when probabilities available
- Visual hazard map via GeoPandas plotting

Why
- Fine-grained understanding of error modes and class confusions is critical for risk-sensitive applications


## Phase 6 — Model interpretability with SHAP
Approach by model type
- TreeExplainer for RandomForest/GradientBoosting
- DeepExplainer for Neural Network
- KernelExplainer for others (with background sample size n = min(50, |X_test|))

Outputs
- Summary plot: feature importance ranking and effect distribution
- Waterfall plot: single high-risk prediction explanation (tree-based models)

Why
- Stakeholder trust and model governance require transparent explanations of drivers


## Phase 7 — Climate change scenario analysis
Scenarios
- Baseline (0%), RCP 4.5 (+15%), RCP 8.5 (+35%), Extreme (+60%) rainfall multipliers

Method
- Create a climate-adjusted copy of wards; overwrite average_rainfall and max_daily_rainfall with multipliers
- Recompute hazard_score_climate via MinMax scaling
- Predict hazard with the trained model using the same feature names as in training
- Summarize: counts of High/Medium/Low risk, average hazard score; plot distributions and changes

Why overwrite (not new columns)
- Model was fit on original feature names; keeping names avoids feature-name mismatch errors at inference


## Phase 8 — Multi-temporal rainfall analysis
Monthly & seasonal patterns
- Transpose daily rainfall columns so dates become index, group by month, compute mean across wards
- Seasonal summary: monsoon (Jun–Sep) vs dry (Dec–Mar) and other seasons; visual comparisons

Long-term trends (2010–2024)
- Annual aggregation (sum/mean across wards), linear trend estimation (slope)
- Visualize trend line over annual rainfall

Why transpose
- Pandas Grouper operates on the index; transposing makes the DatetimeIndex usable for time-based grouping


## Phase 9 — Dynamic risk forecasting (30-day)
- Select current highest-risk ward (by hazard_score)
- Create 30-day feature frames by injecting SARIMA forecast into the ward’s features
- Predict daily hazard classes and visualize as a risk-level bar chart

Why
- Operational view for near-term preparedness and resource allocation


## Phase 10 — Deployment artifacts for web app
Output directory
- webapp/data/

Files produced
- wards_predictions.geojson — Ward polygons with predicted_hazard and key attributes (reprojected to WGS84 if needed)
- model_comparison.json — Model leaderboard (accuracy)
- metrics.json — Best model, accuracy, hazard counts, seasonal/climate/validation analytics, timestamp
- model.pkl — Trained best model serialized via joblib

Why
- GeoJSON + JSON metrics are web-friendly; easy to render maps and dashboards client-side


## Quality and fixes applied during development
- Column-name mismatch fixed: standardized on elevation and slope (not mean_elevation/mean_slope)
- SHAP KernelExplainer sampling error fixed: use min(50, |X_test|)
- Climate scenarios: overwrite rainfall columns to match training feature names
- Temporal grouping: transpose daily rainfall matrix for monthly/annual grouping

Observed execution state
- Notebooks run end-to-end after fixes; charts and artifacts generated as expected


## Limitations
- Small dataset (243 samples): deep learning is data-hungry; tree-based models often more robust here
- Historical validation used simulated events; real flooding records would strengthen evaluation
- Potential missing drivers: soil type, drainage capacity, groundwater, sub-daily (hourly) rainfall extremes
- Land cover is static (2020) and may not reflect recent urbanization


## Recommended next steps
- Replace simulated validation with authoritative flooding event data; optimize for recall of High Risk
- K-fold cross-validation to stabilize estimates in small-sample setting
- Add features: soil/geomorphology, antecedent soil moisture, watershed topology, distance-to-river
- Explore calibrated ensembles and uncertainty estimates (e.g., conformal prediction)
- Automate daily updates and alerting (cron or GitHub Actions + notebook execution)


## How to reproduce (Windows, PowerShell) — optional
Environment
```powershell
# Create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install core packages (adjust as needed)
pip install pandas geopandas shapely rtree scikit-learn statsmodels tensorflow shap joblib matplotlib
# If running DataExtraction with Earth Engine:
# pip install earthengine-api geemap
# earthengine authenticate
```

Run notebooks
- Open DataExtraction.ipynb and run all cells to generate wards_extracted.geojson (skip if already present)
- Open ModelTraining.ipynb and run all cells to train models, produce analyses and export artifacts to webapp/data/

Outputs to expect in webapp/data/
- wards_predictions.geojson, model_comparison.json, metrics.json, model.pkl


## Appendix — Key fields
- elevation, slope — topographic drivers (lower/flat → higher risk)
- average_rainfall, max_daily_rainfall, rainfall_std, total_rainfall — rainfall climatology and extremes
- drainage_density — hydrologic network capacity proxy
- land_cover — surface type (imperviousness/runoff proxy)
- traffic_factor — urbanization/impervious proxy via road density
- hazard_score — normalized composite risk indicator (see formula above)
- hazard_class — Low / Medium / High from hazard_score quantiles

---
This document summarizes the full pipeline from data extraction through model training, interpretability, climate and temporal analyses, dynamic forecasting, and deployment-ready exports. For any extension (new data sources, additional models, real validation), the current structure is designed to be modular and easy to iterate on.
