from __future__ import annotations

import math
import numpy as np
from backend.app.ml.pipeline import extract_anchor_features, model_registry


def score_measurements(
    measurements: list[dict],
    prior: np.ndarray | None,
    anchor_history: dict | None = None,
    use_ml: bool = True,
) -> list[dict]:
    """Score measurement reliability using Random Forest predictions when trained, falling back to heuristic scoring.
    
    Provides Explainable AI diagnostics for every participating anchor.
    """
    if anchor_history is None:
        anchor_history = {}

    available = [m for m in measurements if m.get("available") and m.get("measured_range") is not None]
    median_range = float(np.median([m["measured_range"] for m in available])) if available else 0.0

    # Determine whether ML is available and active
    clf = model_registry.get("classifier")
    is_trained = model_registry.get("status") == "trained" and clf is not None
    ml_active = bool(use_ml and is_trained)

    # Normalize history to dict of lists for feature extraction
    history_lists: dict[str, list[float]] = {}
    for m in measurements:
        mid = m["id"]
        val = anchor_history.get(mid)
        if isinstance(val, list):
            history_lists[mid] = val
        elif isinstance(val, (int, float)):
            history_lists[mid] = [float(val)]
        else:
            history_lists[mid] = []

    # Pre-extract features and batch ML predictions across all active anchors
    active_features = []
    active_map: list[dict] = []
    if ml_active and available:
        for m in available:
            try:
                feat = extract_anchor_features(
                    anchor_id=m["id"],
                    measured_range=float(m["measured_range"]),
                    anchor_pos=(m["x"], m["y"]),
                    active_measurements=available,
                    prior=prior,
                    anchor_history=history_lists,
                )
                active_features.append(feat)
                active_map.append(m)
            except Exception:
                pass

    rf_probs = None
    iso_scores = None
    if ml_active and active_features:
        try:
            feats_arr = np.asarray(active_features, dtype=float)
            rf_probs = clf.predict_proba(feats_arr)[:, 1]
            iso = model_registry.get("isolation")
            if iso is not None:
                iso_dec = iso.decision_function(feats_arr)
                iso_scores = np.clip(0.5 - iso_dec, 0.0, 1.0)
        except Exception:
            rf_probs = None
            iso_scores = None

    ml_lookup: dict[str, dict] = {}
    if rf_probs is not None:
        for i, anchor_m in enumerate(active_map):
            p_rf = float(rf_probs[i])
            if iso_scores is not None and i < len(iso_scores):
                p_iso = float(iso_scores[i])
                p_unrel = float(np.clip(0.80 * p_rf + 0.20 * p_iso, 0.0, 1.0))
            else:
                p_iso = 0.5
                p_unrel = p_rf
            ml_lookup[anchor_m["id"]] = {"p_rf": p_rf, "p_iso": p_iso, "p_unrel": p_unrel}

    for m in measurements:
        if not m.get("available") or m.get("measured_range") is None:
            m.update(
                reliability=0.0,
                anomaly_score=1.0,
                corruption_prob=0.0,
                detected_flag=True,
                weight_effect="Excluded (0% weight)",
                reason="Packet dropped / anchor unavailable",
                scorer="none",
            )
            continue

        r = float(m["measured_range"])
        hist = history_lists.get(m["id"], [])
        prev_r = hist[-1] if hist else r

        # Calculate causal heuristic values (used directly or as explanation evidence)
        change = abs(r - prev_r)
        motion_disagreement = 0.0 if prior is None else abs(float(np.linalg.norm(prior - np.array([m["x"], m["y"]]))) - r)
        cross_anchor = abs(r - median_range) / 12.0
        heuristic_anomaly = min(1.0, 0.38 * min(1.0, change / 1.8) + 0.52 * min(1.0, motion_disagreement / 2.8) + 0.10 * min(1.0, cross_anchor))
        heuristic_rel = max(0.08, min(1.0, 1.0 - heuristic_anomaly))

        if ml_active and m["id"] in ml_lookup:
            detail = ml_lookup[m["id"]]
            p_unreliable = detail["p_unrel"]
            p_rf = detail["p_rf"]
            rel = float(np.clip(1.0 - p_unreliable, 0.08, 1.0))
            scorer = "ml"
            corruption_prob = round(p_rf, 3)
            anomaly_score = round(p_unreliable, 3)
        else:
            p_unreliable = heuristic_anomaly
            rel = float(heuristic_rel)
            scorer = "heuristic"
            corruption_prob = round(heuristic_anomaly, 3)
            anomaly_score = round(heuristic_anomaly, 3)

        detected_flag = bool(p_unreliable > 0.50)
        weight_down_pct = int(round((1.0 - rel) * 100))
        weight_effect = f"Down-weighted by {weight_down_pct}%" if weight_down_pct > 10 else "Full weight (100%)"

        # Strongest data-driven explanation
        if p_unreliable > 0.65:
            reason = f"High NLOS corruption probability ({int(corruption_prob * 100)}%)"
        elif motion_disagreement > 1.8:
            reason = f"Spatial residual against motion prior (+{motion_disagreement:.2f} m)"
        elif change > 1.4:
            reason = f"Abnormal range innovation rate (Δ {change:.2f} m)"
        elif cross_anchor > 0.50:
            reason = f"Geometric cross-anchor inconsistency"
        elif p_unreliable > 0.35:
            reason = f"Moderate multipath delay suspected ({int(corruption_prob * 100)}%)"
        else:
            reason = "Nominal line-of-sight measurement"

        m.update(
            reliability=round(rel, 4),
            anomaly_score=anomaly_score,
            corruption_prob=corruption_prob,
            detected_flag=detected_flag,
            weight_effect=weight_effect,
            reason=reason,
            scorer=scorer,
        )

        # Update callers' history representation
        if isinstance(anchor_history.get(m["id"]), list):
            anchor_history[m["id"]].append(r)
        else:
            anchor_history[m["id"]] = r

    return measurements
