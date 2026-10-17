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


def test_all_frames_ideal_ranges_match_truth():
    sim = Simulation(SimulationConfig(seed=41, noise=0.45, nlos_probability=0.70, missing_probability=0.12))
    for _ in range(60):
        frame = sim.frame(advance=True)
        t = frame["truth"]
        for a in frame["anchors"]:
            expected = math.dist((t["x"], t["y"]), (a["x"], a["y"]))
            assert math.isclose(a["ideal_range"], expected, abs_tol=1e-5)


def test_stress_scenario_stability_and_bounds():
    sim = Simulation(SimulationConfig(seed=99, noise=0.45, nlos_probability=0.70, missing_probability=0.12))
    prev_pos = None
    for _ in range(80):
        frame = sim.frame(advance=True)
        l = frame["locus"]
        filt = frame["filtered"]
        # Must be finite
        assert not math.isnan(l["x"]) and not math.isnan(l["y"])
        assert not math.isinf(l["x"]) and not math.isinf(l["y"])
        assert not math.isnan(filt["x"]) and not math.isnan(filt["y"])
        # Must stay bounded within room boundaries
        assert 0.0 <= l["x"] <= 20.0
        assert 0.0 <= l["y"] <= 15.0
        assert 0.0 <= filt["x"] <= 20.0
        assert 0.0 <= filt["y"] <= 15.0
        if prev_pos is not None:
            disp = math.dist((filt["x"], filt["y"]), prev_pos)
            # Physical velocity bound: filtered displacement should not exceed 3.0m in a single 0.2s step
            assert disp <= 3.0
        prev_pos = (filt["x"], filt["y"])


def test_paused_frames_do_not_mutate_state_or_drift():
    sim = Simulation(SimulationConfig(seed=33))
    sim.frame(advance=True)  # step 1
    f1 = sim.frame(advance=False)
    vel_before = sim.velocity.copy()
    hist_lens_before = {k: len(v) for k, v in sim.anchor_history.items()}

    f2 = sim.frame(advance=False)
    f3 = sim.frame(advance=False)

    assert math.isclose(f1["locus"]["x"], f2["locus"]["x"], abs_tol=1e-6)
    assert math.isclose(f1["locus"]["y"], f2["locus"]["y"], abs_tol=1e-6)
    assert math.isclose(f2["locus"]["x"], f3["locus"]["x"], abs_tol=1e-6)
    assert np.allclose(sim.velocity, vel_before)
    assert {k: len(v) for k, v in sim.anchor_history.items()} == hist_lens_before


def test_simulation_reset_clears_history_and_velocity():
    sim = Simulation(SimulationConfig(seed=55))
    for _ in range(10):
        sim.frame(advance=True)
    assert sim.step_index == 10
    assert len(sim.history_truth) == 10
    assert np.any(sim.velocity != 0.0)

    sim.reset()
    assert sim.step_index == 0
    assert len(sim.history_truth) == 0
    assert len(sim.history_estimate) == 0
    assert np.all(sim.velocity == 0.0)
    assert sim.previous_estimate is None


def test_configuration_persistence_without_reset():
    sim = Simulation(SimulationConfig(seed=41, noise=0.15))
    for _ in range(15):
        sim.frame(advance=True)
    step_before = sim.step_index
    truth_hist_before = len(sim.history_truth)
    vel_before = sim.velocity.copy()

    # Changing slider values calls update_config
    sim.update_config({"noise": 0.45, "nlos_probability": 0.60})

    assert sim.config.noise == 0.45
    assert sim.config.nlos_probability == 0.60
    assert sim.step_index == step_before
    assert len(sim.history_truth) == truth_hist_before
    assert np.allclose(sim.velocity, vel_before)


def test_trajectory_bounds_low_and_high_noise():
    # Low noise
    sim_low = Simulation(SimulationConfig(seed=10, noise=0.08, nlos_probability=0.0, missing_probability=0.0))
    for _ in range(40):
        f = sim_low.frame(advance=True)
        assert 0.0 <= f["locus"]["x"] <= 20.0
        assert 0.0 <= f["locus"]["y"] <= 15.0

    # High noise & NLOS
    sim_high = Simulation(SimulationConfig(seed=10, noise=0.55, nlos_probability=0.70, missing_probability=0.15))
    for _ in range(40):
        f = sim_high.frame(advance=True)
        assert 0.0 <= f["locus"]["x"] <= 20.0
        assert 0.0 <= f["locus"]["y"] <= 15.0


def test_dataset_generation_endpoint_valid_and_preview():
    from fastapi.testclient import TestClient
    from backend.app.main import app

    client = TestClient(app)
    res = client.post("/api/datasets/generate", json={"rows": 80, "seed": 41})
    assert res.status_code == 200
    data = res.json()
    assert data["rows"] == 80
    assert len(data["preview"]) > 0
    # Assert preview rows have required fields and no NaN strings
    for row in data["preview"]:
        assert "trajectory_id" in row
        assert "measured_range_m" in row
        assert "is_available" in row


def test_dataset_generation_endpoint_validation_and_errors():
    from fastapi.testclient import TestClient
    from backend.app.main import app

    client = TestClient(app)
    # rows < 40 triggers pydantic validation error (422)
    res_under = client.post("/api/datasets/generate", json={"rows": 10, "seed": 41})
    assert res_under.status_code == 422

    # Invalid payload type triggers 422
    res_invalid = client.post("/api/datasets/generate", json={"rows": "not-a-number"})
    assert res_invalid.status_code == 422


def test_dataset_download_and_upload_cycle():
    import io
    from fastapi.testclient import TestClient
    from backend.app.main import app

    client = TestClient(app)
    # Generate
    gen_res = client.post("/api/datasets/generate", json={"rows": 80, "seed": 41})
    assert gen_res.status_code == 200
    download_url = gen_res.json()["download_url"]

    # Download
    dl_res = client.get(download_url)
    assert dl_res.status_code == 200
    csv_text = dl_res.text
    assert "trajectory_id" in csv_text
    assert "measured_range_m" in csv_text

    # Valid upload
    files = {"file": ("test_measurements.csv", io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
    up_res = client.post("/api/datasets/upload", files=files)
    assert up_res.status_code == 200
    assert up_res.json()["rows"] == 80

    # Invalid upload: missing required column
    bad_csv = "col_a,col_b\n1,2\n3,4\n"
    bad_files = {"file": ("bad.csv", io.BytesIO(bad_csv.encode("utf-8")), "text/csv")}
    bad_res = client.post("/api/datasets/upload", files=bad_files)
    assert bad_res.status_code == 422

    # Invalid upload: non-csv
    txt_files = {"file": ("bad.txt", io.BytesIO(b"hello world"), "text/plain")}
    txt_res = client.post("/api/datasets/upload", files=txt_files)
    assert txt_res.status_code == 400


def test_experiment_benchmark_returns_median_and_cdf():
    from fastapi.testclient import TestClient
    from backend.app.main import app

    client = TestClient(app)
    res = client.post("/api/experiments/run", json={"noise": 0.45, "nlos_probability": 0.25, "missing_probability": 0.1, "samples": 30, "seed": 73})
    assert res.status_code == 200
    data = res.json()
    assert "results" in data
    assert len(data["results"]) == 3
    for r in data["results"]:
        assert "rmse" in r
        assert "median" in r
        assert "p90" in r
        assert "cdf" in r
        assert len(r["cdf"]) > 0
        # CDF probabilities must be monotonically non-decreasing
        probs = [pt["probability"] for pt in r["cdf"]]
        assert probs == sorted(probs)


def test_localization_covariance_ellipse_parameters():
    measurements = [
        {"id": "A1", "x": 0.8, "y": 0.8, "measured_range": 5.2, "available": True},
        {"id": "A2", "x": 19.2, "y": 0.8, "measured_range": 14.8, "available": True},
        {"id": "A3", "x": 19.2, "y": 14.2, "measured_range": 12.1, "available": True},
        {"id": "A4", "x": 0.8, "y": 14.2, "measured_range": 8.0, "available": True},
    ]
    res = estimate_position(measurements, "locus")
    assert "covariance" in res
    assert "uncertainty_major" in res
    assert "uncertainty_minor" in res
    assert "uncertainty_angle_deg" in res
    # semi-major axis must be >= semi-minor axis
    assert res["uncertainty_major"] >= res["uncertainty_minor"]
    assert math.isfinite(res["uncertainty_angle_deg"])


def test_anchor_density_geometries():
    from backend.app.simulation.engine import get_anchors
    for count in [3, 4, 6, 8]:
        anchors = get_anchors(count)
        assert len(anchors) == count
        ids = [a["id"] for a in anchors]
        assert len(set(ids)) == count
        for a in anchors:
            assert 0.0 <= a["x"] <= 20.0
            assert 0.0 <= a["y"] <= 15.0


def test_insufficient_anchor_geometry_status():
    from backend.app.localization.engine import estimate_position
    # Only 2 available anchors in 2D space
    measurements = [
        {"id": "A1", "x": 0.8, "y": 0.8, "measured_range": 5.0, "available": True},
        {"id": "A2", "x": 19.2, "y": 0.8, "measured_range": 14.0, "available": True},
        {"id": "A3", "x": 19.2, "y": 14.2, "measured_range": None, "available": False},
    ]
    prior = np.array([5.0, 5.0])
    res = estimate_position(measurements, "locus", prior=prior)
    assert res["status"] == "INSUFFICIENT"
    assert "Insufficient" in res["status_reason"]
    # Falls back gracefully near motion prior (resolves 2-circle intersection using prior)
    assert math.dist((res["x"], res["y"]), (5.0, 5.0)) <= 2.0


def test_exact_95_chi_square_scale_and_confidence():
    from backend.app.localization.engine import estimate_position
    measurements = [
        {"id": "A1", "x": 0.8, "y": 0.8, "measured_range": 5.2, "available": True},
        {"id": "A2", "x": 19.2, "y": 0.8, "measured_range": 14.8, "available": True},
        {"id": "A3", "x": 19.2, "y": 14.2, "measured_range": 12.1, "available": True},
        {"id": "A4", "x": 0.8, "y": 14.2, "measured_range": 8.0, "available": True},
    ]
    res = estimate_position(measurements, "locus")
    # Verify exact 95% Chi-square scale factor 2.44774677
    assert "uncertainty_radius" in res
    assert res["uncertainty_radius"] > 0
    assert 0.0 <= res["confidence_score"] <= 1.0
    assert res["gdop"] is not None and res["gdop"] > 0
    # Symmetric covariance matrix
    cov = np.array(res["covariance"])
    assert math.isclose(cov[0, 1], cov[1, 0], abs_tol=1e-6)


def test_kalman_filter_and_forecasting_propagation():
    sim = Simulation(SimulationConfig(seed=42, anchor_count=4))
    f1 = sim.frame(advance=True)
    assert "filtered" in f1
    assert "forecast" in f1
    assert f1["forecast"]["horizon_s"] == 0.20
    assert len(f1["forecast"]["velocity"]) == 2
    assert f1["forecast"]["uncertainty_radius"] > 0

    # Advance several frames and verify smooth motion and finite velocity
    for _ in range(10):
        frame = sim.frame(advance=True)
        assert math.isfinite(frame["filtered"]["x"])
        assert math.isfinite(frame["filtered"]["y"])
        assert math.isfinite(frame["forecast"]["x"])
        assert math.isfinite(frame["forecast"]["y"])
        assert 0.0 <= frame["forecast"]["x"] <= 20.0
        assert 0.0 <= frame["forecast"]["y"] <= 15.0


def test_explainable_ai_measurement_diagnostics():
    from backend.app.reliability.scoring import score_measurements
    measurements = [
        {"id": "A1", "x": 0.8, "y": 0.8, "measured_range": 5.0, "available": True, "ideal_range": 5.0, "biased": False},
        {"id": "A2", "x": 19.2, "y": 0.8, "measured_range": 18.0, "available": True, "ideal_range": 12.0, "biased": True},
    ]
    history = {"A1": [5.0, 5.0, 5.0], "A2": [12.0, 12.0, 18.0]}
    scored = score_measurements(measurements, prior=np.array([5.0, 5.0]), anchor_history=history, use_ml=True)
    for m in scored:
        assert "corruption_prob" in m
        assert "anomaly_score" in m
        assert "detected_flag" in m
        assert "weight_effect" in m
        assert "reason" in m
        assert isinstance(m["reason"], str) and len(m["reason"]) > 0


def test_density_experiment_api_endpoint():
    from fastapi.testclient import TestClient
    from backend.app.main import app

    client = TestClient(app)
    req = {
        "condition": "moderate",
        "anchor_counts": [3, 4, 6],
        "samples": 25,
        "seed": 73,
    }
    res = client.post("/api/experiments/density", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["condition"] == "moderate"
    assert "results" in data
    assert len(data["results"]) == 9  # 3 methods x 3 anchor counts
    assert "density_comparison" in data
    assert len(data["density_comparison"]) == 3
    assert "interpretation" in data
    for item in data["density_comparison"]:
        assert item["anchors"] in [3, 4, 6]
        assert "locus_rmse" in item
        assert "baseline_rmse" in item
        assert "gain_vs_baseline_pct" in item


def test_forecasting_experiment_api_endpoint():
    from fastapi.testclient import TestClient
    from backend.app.main import app

    client = TestClient(app)
    req = {
        "samples": 30,
        "seed": 42,
        "noise": 0.35,
        "nlos_probability": 0.20,
        "missing_probability": 0.10,
        "anchor_count": 4,
    }
    res = client.post("/api/experiments/forecasting", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["horizon_s"] == 0.20
    assert "comparison" in data
    assert len(data["comparison"]) == 3
    assert "regime_breakdown" in data
    assert "clean_motion" in data["regime_breakdown"]
    assert "nlos_corruption" in data["regime_breakdown"]
    assert "missing_measurements" in data["regime_breakdown"]
    assert "interpretation" in data
    assert data["samples"] > 0



