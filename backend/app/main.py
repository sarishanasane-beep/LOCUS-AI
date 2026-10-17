from __future__ import annotations

import asyncio
import io
import json
import uuid
from pathlib import Path

import math
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.app.evaluation import run_density_benchmark, run_experiment, run_forecasting_benchmark
from backend.app.localization import estimate_position
from backend.app.ml import model_registry, train_models
from backend.app.schemas import (
    CreateSimulation,
    DatasetRequest,
    DensityExperimentRequest,
    EstimateRequest,
    ExperimentRequest,
    ForecastingExperimentRequest,
    SimulationConfig,
)
from backend.app.simulation import Simulation
from backend.app.simulation.engine import ANCHORS, get_anchors, trajectory

ROOT = Path(__file__).resolve().parents[2]
OUTPUTS = ROOT / "outputs"
OUTPUTS.mkdir(exist_ok=True)
app = FastAPI(title="LOCUS AI Positioning Engine", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
simulations: dict[str, Simulation] = {}
experiments: dict[str, dict] = {}
datasets: dict[str, Path] = {}
active_streams: dict[str, WebSocket] = {}


def get_sim(sim_id: str) -> Simulation:
    if sim_id not in simulations:
        raise HTTPException(404, "Simulation not found")
    return simulations[sim_id]


@app.get("/api/health")
def health():
    return {"status": "ok", "engine": "scipy-least-squares", "model_status": model_registry["status"]}


@app.get("/api/scenarios")
def scenarios():
    return [
        {"id": "default-challenge", "name": "Intermittent east-anchor bias", "room": {"width": 20, "height": 15}, "anchors": 4, "seed": 41},
        {"id": "sparse-triad", "name": "Minimal 3-anchor triangular coverage", "room": {"width": 20, "height": 15}, "anchors": 3, "seed": 41},
        {"id": "dense-octad", "name": "High-density 8-anchor perimeter array", "room": {"width": 20, "height": 15}, "anchors": 8, "seed": 41},
    ]


@app.post("/api/scenarios/generate")
def generate_scenario(config: SimulationConfig):
    return {"scenario": Simulation(config).frame()}


@app.post("/api/simulation/create")
def create_simulation(request: CreateSimulation):
    sim_id = uuid.uuid4().hex[:10]
    simulations[sim_id] = Simulation(request.config)
    return {"id": sim_id, "state": simulations[sim_id].frame()}


@app.post("/api/simulation/{sim_id}/play")
def play(sim_id: str):
    sim = get_sim(sim_id)
    sim.playing = True
    return {"playing": True}


@app.post("/api/simulation/{sim_id}/pause")
def pause(sim_id: str):
    sim = get_sim(sim_id)
    sim.playing = False
    return {"playing": False}


@app.post("/api/simulation/{sim_id}/reset")
def reset(sim_id: str):
    sim = get_sim(sim_id)
    sim.playing = False
    sim.reset()
    return sim.frame()


@app.post("/api/simulation/{sim_id}/step")
def step(sim_id: str):
    return get_sim(sim_id).frame(advance=True)


@app.post("/api/simulation/{sim_id}/configure")
def configure(sim_id: str, config: dict):
    sim = get_sim(sim_id)
    sim.update_config(config)
    return sim.frame()


@app.get("/api/simulation/{sim_id}/state")
def state(sim_id: str):
    return get_sim(sim_id).frame()


@app.websocket("/ws/simulation/{sim_id}")
async def simulation_stream(websocket: WebSocket, sim_id: str):
    await websocket.accept()
    old_ws = active_streams.get(sim_id)
    if old_ws is not None and old_ws != websocket:
        try:
            await old_ws.close()
        except Exception:
            pass
    active_streams[sim_id] = websocket
    try:
        sim = get_sim(sim_id)
        while True:
            if active_streams.get(sim_id) != websocket:
                break
            await websocket.send_text(json.dumps(sim.frame(advance=sim.playing)))
            interval = max(0.08, 0.2 / max(0.2, sim.config.speed)) if sim.playing else 0.25
            await asyncio.sleep(interval)
    except (WebSocketDisconnect, HTTPException):
        pass
    finally:
        if active_streams.get(sim_id) == websocket:
            active_streams.pop(sim_id, None)


@app.post("/api/localization/estimate")
def localize(request: EstimateRequest):
    prior = None if request.prior is None else [request.prior["x"], request.prior["y"]]
    return estimate_position(request.anchors, request.method, prior)


@app.post("/api/experiments/run")
def experiment(request: ExperimentRequest):
    exp_id = uuid.uuid4().hex[:10]
    results = run_experiment(request)
    payload = {
        "id": exp_id,
        "results": results,
        "scenario": request.model_dump(),
        "sample_count": request.samples,
    }
    experiments[exp_id] = payload
    return payload


@app.post("/api/experiments/density")
def density_experiment(request: DensityExperimentRequest):
    return run_density_benchmark(request)


@app.post("/api/experiments/forecasting")
def forecasting_experiment(request: ForecastingExperimentRequest):
    return run_forecasting_benchmark(request)


@app.get("/api/experiments/{exp_id}/results")
def experiment_results(exp_id: str):
    if exp_id not in experiments:
        raise HTTPException(404, "Experiment not found")
    return experiments[exp_id]


@app.post("/api/ml/train")
def train():
    return train_models()


@app.get("/api/ml/status")
def ml_status():
    return {k: v for k, v in model_registry.items() if k not in {"classifier", "isolation"}}


@app.post("/api/ml/predict")
def predict(payload: dict):
    if model_registry["classifier"] is None:
        raise HTTPException(409, "Model is untrained. Call /api/ml/train first.")
    features = payload.get("features", [])
    prob = model_registry["classifier"].predict_proba(features)[:, 1].tolist()
    anomaly = (-model_registry["isolation"].score_samples(features)).tolist()
    return {"unreliable_probability": prob, "anomaly_score": anomaly}


def make_dataset(request: DatasetRequest) -> tuple[pd.DataFrame, str]:
    rng = np.random.default_rng(request.seed)
    config = SimulationConfig(
        seed=request.seed,
        anchor_count=request.anchor_count,
        noise=request.noise,
        nlos_probability=request.nlos_probability,
        missing_probability=request.missing_probability,
    )
    anchors = get_anchors(request.anchor_count)
    path = trajectory()
    records = []
    step_idx = 0
    traj_num = 1
    total_steps = len(path)

    while len(records) < request.rows:
        truth = path[step_idx % total_steps]
        if step_idx > 0 and step_idx % total_steps == 0:
            traj_num += 1
        t_sec = round(step_idx * 0.2, 3)

        for idx, anchor in enumerate(anchors):
            ideal = math.dist((truth["x"], truth["y"]), (anchor["x"], anchor["y"]))
            available = bool(rng.random() >= config.missing_probability)
            is_nlos_candidate = bool(idx == 1 or rng.random() < 0.35)
            biased = bool(is_nlos_candidate and rng.random() < config.nlos_probability)
            bias = float(rng.uniform(1.3, 3.7)) if biased else 0.0
            measured = round(float(max(0.05, ideal + rng.normal(0, config.noise) + bias)), 4) if available else None

            records.append({
                "trajectory_id": f"synthetic-{traj_num:03d}",
                "timestamp": t_sec,
                "anchor_id": anchor["id"],
                "anchor_x_m": anchor["x"],
                "anchor_y_m": anchor["y"],
                "ideal_range_m": round(ideal, 4),
                "measured_range_m": measured,
                "is_available": available,
                "is_corrupted": biased,
                "target_x_m": round(truth["x"], 4),
                "target_y_m": round(truth["y"], 4),
            })
            if len(records) >= request.rows:
                break
        step_idx += 1

    df = pd.DataFrame(records)
    dataset_id = uuid.uuid4().hex[:10]
    return df, dataset_id


@app.post("/api/datasets/generate")
def generate_dataset(request: DatasetRequest):
    df, dataset_id = make_dataset(request)
    path = OUTPUTS / f"dataset-{dataset_id}.csv"
    df.to_csv(path, index=False)
    datasets[dataset_id] = path

    # Clean preview converting any NaN / None floats safely for JSON serialization
    raw_preview = df.head(100).to_dict("records")
    clean_preview = [
        {
            k: (None if (isinstance(v, float) and (math.isnan(v) or np.isnan(v))) or pd.isna(v) else v)
            for k, v in row.items()
        }
        for row in raw_preview
    ]
    return {
        "id": dataset_id,
        "rows": len(df),
        "columns": list(df.columns),
        "preview": clean_preview,
        "download_url": f"/api/reports/{dataset_id}/download",
    }


@app.post("/api/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Upload a CSV measurement file")
    data = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(data))
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")
    required = {"trajectory_id", "timestamp", "anchor_id", "anchor_x_m", "anchor_y_m", "measured_range_m", "is_available"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(422, f"Missing columns: {', '.join(sorted(missing))}")
    dataset_id = uuid.uuid4().hex[:10]
    path = OUTPUTS / f"upload-{dataset_id}.csv"
    df.to_csv(path, index=False)
    datasets[dataset_id] = path

    raw_preview = df.head(100).to_dict("records")
    clean_preview = [
        {
            k: (None if (isinstance(v, float) and (math.isnan(v) or np.isnan(v))) or pd.isna(v) else v)
            for k, v in row.items()
        }
        for row in raw_preview
    ]
    missing_dict = {str(k): int(v) for k, v in df.isna().sum().to_dict().items()}
    return {
        "id": dataset_id,
        "rows": len(df),
        "columns": list(df.columns),
        "missing_values": missing_dict,
        "preview": clean_preview,
        "download_url": f"/api/datasets/{dataset_id}/download",
    }


@app.post("/api/evaluation/run")
def evaluation(request: ExperimentRequest):
    return experiment(request)


@app.get("/api/evaluation/{exp_id}/results")
def evaluation_results(exp_id: str):
    return experiment_results(exp_id)


@app.get("/api/reports/{report_id}/download")
@app.get("/api/datasets/{report_id}/download")
def download(report_id: str):
    path = datasets.get(report_id)
    if not path or not path.exists():
        raise HTTPException(404, "Report not found")
    return FileResponse(path, media_type="text/csv", filename=path.name)
