from __future__ import annotations

import asyncio
import io
import json
import uuid
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.app.evaluation import run_experiment
from backend.app.localization import estimate_position
from backend.app.ml import model_registry, train_models
from backend.app.schemas import CreateSimulation, DatasetRequest, EstimateRequest, ExperimentRequest, SimulationConfig
from backend.app.simulation import Simulation

ROOT=Path(__file__).resolve().parents[2]
OUTPUTS=ROOT/"outputs";OUTPUTS.mkdir(exist_ok=True)
app=FastAPI(title="LOCUS AI Positioning Engine",version="1.0.0")
app.add_middleware(CORSMiddleware,allow_origins=["http://localhost:5173","http://127.0.0.1:5173"],allow_credentials=True,allow_methods=["*"],allow_headers=["*"])
simulations:dict[str,Simulation]={};experiments:dict[str,dict]={};datasets:dict[str,Path]={}


def get_sim(sim_id:str)->Simulation:
    if sim_id not in simulations: raise HTTPException(404,"Simulation not found")
    return simulations[sim_id]


@app.get("/api/health")
def health(): return {"status":"ok","engine":"scipy-least-squares","model_status":model_registry["status"]}


@app.get("/api/scenarios")
def scenarios(): return [{"id":"default-challenge","name":"Intermittent east-anchor bias","room":{"width":20,"height":15},"anchors":4,"seed":41}]


@app.post("/api/scenarios/generate")
def generate_scenario(config:SimulationConfig): return {"scenario":Simulation(config).frame()}


@app.post("/api/simulation/create")
def create_simulation(request:CreateSimulation):
    sim_id=uuid.uuid4().hex[:10];simulations[sim_id]=Simulation(request.config);return {"id":sim_id,"state":simulations[sim_id].frame()}


@app.post("/api/simulation/{sim_id}/play")
def play(sim_id:str): sim=get_sim(sim_id);sim.playing=True;return {"playing":True}


@app.post("/api/simulation/{sim_id}/pause")
def pause(sim_id:str): sim=get_sim(sim_id);sim.playing=False;return {"playing":False}


@app.post("/api/simulation/{sim_id}/reset")
def reset(sim_id:str): sim=get_sim(sim_id);sim.playing=False;sim.reset();return sim.frame()


@app.post("/api/simulation/{sim_id}/step")
def step(sim_id:str): return get_sim(sim_id).frame(advance=True)


@app.post("/api/simulation/{sim_id}/configure")
def configure(sim_id:str,config:dict): sim=get_sim(sim_id);sim.update_config(config);return sim.frame()


@app.get("/api/simulation/{sim_id}/state")
def state(sim_id:str): return get_sim(sim_id).frame()


@app.websocket("/ws/simulation/{sim_id}")
async def simulation_stream(websocket:WebSocket,sim_id:str):
    await websocket.accept()
    try:
        sim=get_sim(sim_id)
        while True:
            await websocket.send_text(json.dumps(sim.frame(advance=sim.playing)))
            await asyncio.sleep(max(.06,.2/sim.config.speed))
    except (WebSocketDisconnect,HTTPException): return


@app.post("/api/localization/estimate")
def localize(request:EstimateRequest):
    prior=None if request.prior is None else [request.prior["x"],request.prior["y"]]
    return estimate_position(request.anchors,request.method,prior)


@app.post("/api/experiments/run")
def experiment(request:ExperimentRequest):
    exp_id=uuid.uuid4().hex[:10];results=run_experiment(request);payload={"id":exp_id,"results":results,"scenario":request.model_dump(),"sample_count":request.samples};experiments[exp_id]=payload;return payload


@app.get("/api/experiments/{exp_id}/results")
def experiment_results(exp_id:str):
    if exp_id not in experiments: raise HTTPException(404,"Experiment not found")
    return experiments[exp_id]


@app.post("/api/ml/train")
def train(): return train_models()


@app.get("/api/ml/status")
def ml_status(): return {k:v for k,v in model_registry.items() if k not in {"classifier","isolation"}}


@app.post("/api/ml/predict")
def predict(payload:dict):
    if model_registry["classifier"] is None: raise HTTPException(409,"Model is untrained. Call /api/ml/train first.")
    features=payload.get("features",[]);prob=model_registry["classifier"].predict_proba(features)[:,1].tolist();anomaly=(-model_registry["isolation"].score_samples(features)).tolist();return {"unreliable_probability":prob,"anomaly_score":anomaly}


def make_dataset(request:DatasetRequest)->tuple[pd.DataFrame,str]:
    sim=Simulation(SimulationConfig(seed=request.seed));records=[]
    while len(records)<request.rows:
        frame=sim.frame(advance=True)
        for a in frame["anchors"]:
            records.append({"trajectory_id":"synthetic-001","timestamp":frame["timestamp"],"anchor_id":a["id"],"anchor_x_m":a["x"],"anchor_y_m":a["y"],"measured_range_m":a["measured_range"],"is_available":a["available"],"target_x_m":frame["truth"]["x"],"target_y_m":frame["truth"]["y"]})
            if len(records)>=request.rows: break
    dataset_id=uuid.uuid4().hex[:10];return pd.DataFrame(records),dataset_id


@app.post("/api/datasets/generate")
def generate_dataset(request:DatasetRequest):
    df,dataset_id=make_dataset(request);path=OUTPUTS/f"dataset-{dataset_id}.csv";df.to_csv(path,index=False);datasets[dataset_id]=path;return {"id":dataset_id,"rows":len(df),"preview":df.head(8).where(pd.notnull(df),None).to_dict("records"),"download_url":f"/api/reports/{dataset_id}/download"}


@app.post("/api/datasets/upload")
async def upload_dataset(file:UploadFile=File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"): raise HTTPException(400,"Upload a CSV measurement file")
    data=await file.read();df=pd.read_csv(io.BytesIO(data));required={"trajectory_id","timestamp","anchor_id","anchor_x_m","anchor_y_m","measured_range_m","is_available"};missing=required-set(df.columns)
    if missing: raise HTTPException(422,f"Missing columns: {', '.join(sorted(missing))}")
    return {"rows":len(df),"columns":list(df.columns),"missing_values":df.isna().sum().to_dict(),"preview":df.head(10).where(pd.notnull(df),None).to_dict("records")}


@app.post("/api/evaluation/run")
def evaluation(request:ExperimentRequest): return experiment(request)


@app.get("/api/evaluation/{exp_id}/results")
def evaluation_results(exp_id:str): return experiment_results(exp_id)


@app.get("/api/reports/{report_id}/download")
def download(report_id:str):
    path=datasets.get(report_id)
    if not path or not path.exists(): raise HTTPException(404,"Report not found")
    return FileResponse(path,media_type="text/csv",filename=path.name)
