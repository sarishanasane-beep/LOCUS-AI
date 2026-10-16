# LOCUS AI

LOCUS AI is a reliability-aware indoor positioning workbench. It generates deterministic noisy anchor ranges, estimates a moving tag with baseline, robust, and trust-weighted methods, reports geometry-aware uncertainty, streams live frames, trains anomaly/classification models, and runs reproducible comparisons.

## Run locally

Requirements: Node.js 20+ and Python 3.11+.

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8000
```

In a second terminal:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. The default scenario is ready immediately.

## Test and build

```powershell
python -m pytest backend/tests
npm run build
```

## Implemented

- Deterministic 20 × 15 m simulator with waypoint motion, Gaussian noise, intermittent positive range bias, and packet loss.
- Ordinary nonlinear least squares, robust soft-L1, bounded reliability-aware weighting, causal motion smoothing, covariance-derived uncertainty, and sparse-geometry status.
- FastAPI controls, typed schemas, WebSocket frame streaming, experiment execution, dataset generation/upload validation, CSV export, and report download.
- Reproducible Random Forest and Isolation Forest training split by whole trajectory groups to reduce leakage.
- Responsive React workbench with live map, anchor evidence, break-it controls, analytics, dataset tools, methodology, and guided judge mode.

## Honest limitations

- The uncertainty region is covariance-derived but has not yet been calibrated on physical hardware.
- The live reliability path currently uses the same causal feature family as the ML pipeline but a deterministic bounded scorer until a trained artifact is persisted.
- RSSI/CSI, floor-plan wall inference, ESP32 ingestion, and anchor placement optimization remain future extensions.
