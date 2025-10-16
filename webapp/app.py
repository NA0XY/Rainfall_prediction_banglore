from pathlib import Path
import os
import json
from flask import Flask, jsonify, render_template

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static"),
)


def _load_json(path: Path, default):
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return default


@app.route("/")
def index():
    metrics = _load_json(DATA_DIR / "metrics.json", {})
    return render_template("index.html", metrics=metrics)


@app.route("/api/wards")
def wards_api():
    geojson = _load_json(
        DATA_DIR / "wards_predictions.geojson",
        {"type": "FeatureCollection", "features": []},
    )
    return jsonify(geojson)


@app.route("/api/performance")
def performance_api():
    metrics = _load_json(DATA_DIR / "metrics.json", {})
    comparison = _load_json(DATA_DIR / "model_comparison.json", [])
    return jsonify({"metrics": metrics, "comparison": comparison})


if __name__ == "__main__":
    host = os.environ.get("FLASK_RUN_HOST", "0.0.0.0")
    port = int(os.environ.get("FLASK_RUN_PORT", os.environ.get("PORT", 5000)))
    debug_mode = os.environ.get("FLASK_DEBUG", "1") != "0"
    app.run(host=host, port=port, debug=debug_mode)
