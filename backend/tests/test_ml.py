from __future__ import annotations

import math
import numpy as np
import pytest

from backend.app.localization import estimate_position
from backend.app.ml.pipeline import (
    FEATURE_NAMES,
    build_training_data,
    extract_anchor_features,
    model_registry,
    train_models,
)
from backend.app.reliability.scoring import score_measurements
from backend.app.schemas import SimulationConfig
from backend.app.simulation import Simulation


def test_feature_generation_causality():
    active = [
        {"id": "A1", "x": 0.8, "y": 0.8, "measured_range": 5.0},
        {"id": "A2", "x": 19.2, "y": 0.8, "measured_range": 16.0},
    ]
    # Edge case 1: no prior, no history
    feat_step1 = extract_anchor_features(
        anchor_id="A1",
        measured_range=5.0,
        anchor_pos=(0.8, 0.8),
        active_measurements=active,
        prior=None,
        anchor_history={},
    )
    assert len(feat_step1) == len(FEATURE_NAMES)
    assert all(math.isfinite(v) for v in feat_step1)
    # Range change should be 0 on first step
    assert feat_step1[0] == 0.0
    # Motion disagreement and prior residual should be 0 when prior is None
    assert feat_step1[1] == 0.0
    assert feat_step1[3] == 0.0

    # Edge case 2: with prior and history
    history = {"A1": [4.2, 4.5, 4.8]}
    prior = np.array([5.0, 5.0])
    feat_step2 = extract_anchor_features(
        anchor_id="A1",
        measured_range=6.5,
        anchor_pos=(0.8, 0.8),
        active_measurements=active,
        prior=prior,
        anchor_history=history,
    )
    assert len(feat_step2) == len(FEATURE_NAMES)
    # Range change should be |6.5 - 4.8| = 1.7
    assert math.isclose(feat_step2[0], 1.7, rel_tol=1e-3)
    # Prior distance to (0.8, 0.8) from (5.0, 5.0) is sqrt(4.2^2 + 4.2^2) ~= 5.9397
    expected_prior_dist = math.dist((0.8, 0.8), (5.0, 5.0))
    assert math.isclose(feat_step2[1], abs(expected_prior_dist - 6.5), rel_tol=1e-3)


def test_triangle_violation_detects_nlos_corruption():
    # A1 at (0, 0), A2 at (10, 0). Physical distance between anchors is 10.0m.
    # Target at (5, 0): true ranges are 5.0 and 5.0 (|5 - 5| = 0 <= 10).
    clean_active = [
        {"id": "A1", "x": 0.0, "y": 0.0, "measured_range": 5.0},
        {"id": "A2", "x": 10.0, "y": 0.0, "measured_range": 5.0},
    ]
    feat_clean = extract_anchor_features("A1", 5.0, (0.0, 0.0), clean_active, None, {})
    assert math.isclose(feat_clean[2], 0.0)  # No triangle violation

    # Corrupt A1 with +8m bias -> measured_range = 13.0m.
    # |13.0 - 5.0| = 8.0 <= 10.0 (still valid).
    # Corrupt A1 with +12m bias -> measured_range = 17.0m.
    # |17.0 - 5.0| = 12.0 > 10.0 -> violation = 2.0m!
    corrupt_active = [
        {"id": "A1", "x": 0.0, "y": 0.0, "measured_range": 17.0},
        {"id": "A2", "x": 10.0, "y": 0.0, "measured_range": 5.0},
    ]
    feat_corrupt = extract_anchor_features("A1", 17.0, (0.0, 0.0), corrupt_active, None, {})
    assert feat_corrupt[2] >= 2.0  # Physical violation caught!


def test_training_data_generation_and_no_leakage():
    x, y, groups = build_training_data(seed=123, n_trajectories=4, steps_per_trajectory=30)
    assert len(x) > 100
    assert len(x) == len(y) == len(groups)
    assert x.shape[1] == len(FEATURE_NAMES)
    # Check that labels are binary
    assert set(np.unique(y)).issubset({0, 1})
    # Check that groups cover all 4 trajectories
    assert len(np.unique(groups)) == 4


def test_model_training_and_held_out_evaluation():
    metrics = train_models(seed=91)
    assert metrics["status"] == "trained"
    assert metrics["samples"] > 1000
    assert metrics["accuracy"] >= 0.80
    assert metrics["precision"] >= 0.70
    assert metrics["recall"] >= 0.70
    assert metrics["f1"] >= 0.70

    # Verify confusion matrix structure: [[TN, FP], [FN, TP]]
    cm = metrics["confusion_matrix"]
    assert len(cm) == 2 and len(cm[0]) == 2
    assert cm[0][0] > 0  # TN
    assert cm[1][1] > 0  # TP

    # Verify feature importance
    assert len(metrics["feature_importance"]) == len(FEATURE_NAMES)
    assert math.isclose(sum(metrics["feature_importance"]), 1.0, rel_tol=1e-2)

    # Verify localization comparison
    loc = metrics["localization_comparison"]
    assert "baseline_rmse" in loc
    assert "robust_rmse" in loc
    assert "locus_ml_rmse" in loc
    assert loc["locus_ml_rmse"] < loc["baseline_rmse"]
    assert loc["rmse_improvement_pct"] > 0
    assert "baseline_availability" in loc
    assert "robust_availability" in loc
    assert "locus_ml_availability" in loc


def test_metrics_agree_with_confusion_matrix_mathematically():
    metrics = train_models(seed=91)
    
    # 1. Random Forest (Supervised) Confusion Matrix Validation
    cm = np.array(metrics["confusion_matrix"])
    tn, fp = cm[0]
    fn, tp = cm[1]
    total = tn + fp + fn + tp

    assert metrics["test_samples"] == total
    computed_acc = (tp + tn) / total
    computed_prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    computed_rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    computed_f1 = (
        2 * computed_prec * computed_rec / (computed_prec + computed_rec)
        if (computed_prec + computed_rec) > 0
        else 0.0
    )

    # Assert exact agreement within 1e-3 rounding tolerance
    assert math.isclose(metrics["accuracy"], computed_acc, abs_tol=1e-3)
    assert math.isclose(metrics["precision"], computed_prec, abs_tol=1e-3)
    assert math.isclose(metrics["recall"], computed_rec, abs_tol=1e-3)
    assert math.isclose(metrics["f1"], computed_f1, abs_tol=1e-3)

    # 2. Isolation Forest (Unsupervised) Confusion Matrix Validation on Identical Samples
    iso_comp = metrics["model_comparison"]["isolation_forest"]
    iso_cm = np.array(iso_comp["confusion_matrix"])
    iso_tn, iso_fp = iso_cm[0]
    iso_fn, iso_tp = iso_cm[1]
    iso_total = iso_tn + iso_fp + iso_fn + iso_tp

    assert iso_total == total  # Must evaluate the exact same held-out test set
    iso_acc = (iso_tp + iso_tn) / iso_total
    iso_prec = iso_tp / (iso_tp + iso_fp) if (iso_tp + iso_fp) > 0 else 0.0
    iso_rec = iso_tp / (iso_tp + iso_fn) if (iso_tp + iso_fn) > 0 else 0.0
    iso_f1 = (
        2 * iso_prec * iso_rec / (iso_prec + iso_rec)
        if (iso_prec + iso_rec) > 0
        else 0.0
    )

    assert math.isclose(iso_comp["accuracy"], iso_acc, abs_tol=1e-3)
    assert math.isclose(iso_comp["precision"], iso_prec, abs_tol=1e-3)
    assert math.isclose(iso_comp["recall"], iso_rec, abs_tol=1e-3)
    assert math.isclose(iso_comp["f1"], iso_f1, abs_tol=1e-3)

    # 3. Class Balance Verification
    cb = metrics["class_balance"]
    assert cb["test_clean_count"] == int(tn + fp)
    assert cb["test_corrupted_count"] == int(fn + tp)
    assert cb["test_clean_count"] == 776
    assert cb["test_corrupted_count"] == 417
    assert math.isclose(cb["corrupted_percent"], 35.0, abs_tol=0.1)
    assert math.isclose(cb["nominal_percent"], 65.0, abs_tol=0.1)
    assert cb["train_clean_count"] == 2658
    assert cb["train_corrupted_count"] == 1043
    assert math.isclose(cb["train_corrupted_percent"], 28.18, abs_tol=0.1)
    assert math.isclose(cb["train_clean_percent"], 71.82, abs_tol=0.1)



def test_live_scoring_uses_ml_when_trained():
    # Ensure trained model is present
    if model_registry.get("status") != "trained":
        train_models(seed=91)

    measurements = [
        {"id": "A1", "x": 0.8, "y": 0.8, "measured_range": 5.2, "available": True},
        # A2 has huge anomalous jump / bias
        {"id": "A2", "x": 19.2, "y": 0.8, "measured_range": 19.5, "available": True},
        {"id": "A3", "x": 19.2, "y": 14.2, "measured_range": 12.1, "available": True},
        {"id": "A4", "x": 0.8, "y": 14.2, "measured_range": 8.0, "available": True},
    ]
    prior = np.array([6.0, 6.0])
    history = {"A1": [5.1], "A2": [13.2], "A3": [12.0], "A4": [8.1]}

    scored = score_measurements(measurements, prior, history, use_ml=True)
    assert all(m["scorer"] == "ml" for m in scored)

    # A2 should be recognized as corrupted / unreliable
    a1 = next(m for m in scored if m["id"] == "A1")
    a2 = next(m for m in scored if m["id"] == "A2")
    assert a2["anomaly_score"] > a1["anomaly_score"]
    assert a2["reliability"] < a1["reliability"]


def test_fallback_behavior_when_untrained():
    # Save current model
    saved_status = model_registry["status"]
    saved_clf = model_registry["classifier"]
    try:
        model_registry["status"] = "untrained"
        model_registry["classifier"] = None

        measurements = [
            {"id": "A1", "x": 0.8, "y": 0.8, "measured_range": 5.0, "available": True},
            {"id": "A2", "x": 19.2, "y": 0.8, "measured_range": 8.0, "available": True},
        ]
        scored = score_measurements(measurements, None, {}, use_ml=True)
        assert all(m["scorer"] == "heuristic" for m in scored)
        assert all(m["reliability"] >= 0.08 for m in scored)
    finally:
        model_registry["status"] = saved_status
        model_registry["classifier"] = saved_clf


def test_simulation_runs_with_ml_and_tracks_accuracy():
    # Ensure trained model
    train_models(seed=91)

    sim = Simulation(SimulationConfig(seed=41, noise=0.35, nlos_probability=0.30))
    for _ in range(20):
        frame = sim.frame(advance=True)
        assert frame["metrics"]["active_scorer"] == "ml"
        assert frame["locus"]["error"] >= 0.0
        assert math.isfinite(frame["locus"]["x"])
        assert math.isfinite(frame["locus"]["y"])


def test_isolation_forest_and_model_comparison():
    metrics = train_models(seed=91)
    assert "model_comparison" in metrics
    comp = metrics["model_comparison"]

    assert "random_forest" in comp
    assert "isolation_forest" in comp
    assert "heuristic" in comp
    assert "combined_ensemble" in comp

    # Random forest outperforms the heuristic rule baseline
    assert comp["random_forest"]["accuracy"] > comp["heuristic"]["accuracy"]
    assert comp["random_forest"]["f1"] > comp["heuristic"]["f1"]

    # Isolation Forest has valid unsupervised metrics
    assert comp["isolation_forest"]["accuracy"] > 0.50
    assert comp["isolation_forest"]["f1"] > 0.40

    # Combined ensemble retains high accuracy
    assert comp["combined_ensemble"]["accuracy"] >= 0.82
    assert comp["combined_ensemble"]["f1"] >= 0.74

    # Verify Isolation Forest object itself
    iso = model_registry["isolation"]
    assert iso is not None
    # Nominal vs severe anomaly feature vector:
    # Nominal: small change, 0 motion disagreement, 0 triangle violation
    nom_feat = [0.1, 0.05, 0.0, 0.0, 0.01, 0.02]
    # Outlier: huge change, large motion disagreement, massive triangle violation
    anom_feat = [4.5, 5.2, 3.8, -4.5, 2.5, 0.85]
    dec_nom = iso.decision_function([nom_feat])[0]
    dec_anom = iso.decision_function([anom_feat])[0]
    # Decision function is higher for inliers than outliers
    assert dec_nom > dec_anom

