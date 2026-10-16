import math
import numpy as np
from backend.app.localization import estimate_position
from backend.app.main import create_simulation, state, step
from backend.app.schemas import CreateSimulation, SimulationConfig
from backend.app.simulation import Simulation


def test_simulator_is_reproducible():
    a=Simulation(SimulationConfig(seed=12)).frame(advance=True)
    b=Simulation(SimulationConfig(seed=12)).frame(advance=True)
    assert a["anchors"]==b["anchors"]


def test_ideal_ranges_are_euclidean():
    frame=Simulation(SimulationConfig(seed=2,noise=0,nlos_probability=0,missing_probability=0)).frame()
    for anchor in frame["anchors"]:
        assert math.isclose(anchor["ideal_range"],math.dist((frame["truth"]["x"],frame["truth"]["y"]),(anchor["x"],anchor["y"])))


def test_baseline_recovers_clean_position():
    point=np.array([7.3,8.1]);anchors=[]
    for i,(x,y) in enumerate([(0,0),(20,0),(20,15),(0,15)]): anchors.append({"id":f"A{i}","x":x,"y":y,"available":True,"measured_range":float(np.linalg.norm(point-[x,y]))})
    result=estimate_position(anchors,"baseline")
    assert np.linalg.norm(np.array([result["x"],result["y"]])-point)<1e-4


def test_sparse_geometry_reports_insufficient():
    result=estimate_position([{"id":"A1","x":0,"y":0,"available":True,"measured_range":4}],"locus")
    assert result["status"]=="INSUFFICIENT" and result["uncertainty_radius"]>=6


def test_missing_measurements_are_excluded():
    frame=Simulation(SimulationConfig(missing_probability=1)).frame()
    assert frame["locus"]["active_measurements"]==0 and frame["locus"]["status"]=="INSUFFICIENT"


def test_anchor_dropout_changes_backend_state():
    sim=Simulation(SimulationConfig(seed=8,disabled_anchors=["A2"]))
    frame=sim.frame()
    assert next(a for a in frame["anchors"] if a["id"]=="A2")["available"] is False
    assert frame["locus"]["active_measurements"]<=3


def test_api_schema_and_state_change():
    created=create_simulation(CreateSimulation());sim_id=created["id"]
    before=state(sim_id)["step"]
    after=step(sim_id)["step"]
    assert after==before+1
