from __future__ import annotations

import numpy as np
from backend.app.schemas import ExperimentRequest, SimulationConfig
from backend.app.simulation import Simulation


def run_experiment(request: ExperimentRequest) -> list[dict]:
    sim=Simulation(SimulationConfig(noise=request.noise,nlos_probability=request.nlos_probability,missing_probability=request.missing_probability,seed=request.seed))
    values={name:{"errors":[],"runtime":[],"available":[]} for name in ("baseline","robust","locus")}
    for _ in range(request.samples):
        frame=sim.frame(advance=True)
        for name in values:
            est=frame[name];values[name]["errors"].append(est["error"]);values[name]["runtime"].append(est["runtime_ms"]);values[name]["available"].append(est["status"]!="INSUFFICIENT")
    return [{"method":name.upper(),"rmse":float(np.sqrt(np.mean(np.square(v["errors"])))),"p90":float(np.percentile(v["errors"],90)),"availability":float(np.mean(v["available"])),"runtime_ms":float(np.mean(v["runtime"]))} for name,v in values.items()]
