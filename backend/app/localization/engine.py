from __future__ import annotations

import time
import numpy as np
from scipy.optimize import least_squares


def _geometry_status(points: np.ndarray) -> str:
    if len(points) < 3:
        return "INSUFFICIENT"
    centered = points - points.mean(axis=0)
    singular = np.linalg.svd(centered, compute_uv=False)
    return "DEGRADED" if len(singular) < 2 or singular[-1] < 0.7 else "NOMINAL"


def estimate_position(measurements: list[dict], method: str = "baseline", prior: np.ndarray | None = None) -> dict:
    started = time.perf_counter()
    active = [m for m in measurements if m.get("available") and m.get("measured_range") is not None]
    if not active:
        p = prior if prior is not None else np.array([10.0, 7.5])
        return {"x": float(p[0]), "y": float(p[1]), "method": method, "status": "INSUFFICIENT", "uncertainty_radius": 12.0, "active_measurements": 0, "runtime_ms": 0.0, "residuals": {}}
    anchors = np.array([[m["x"], m["y"]] for m in active], dtype=float)
    ranges = np.array([m["measured_range"] for m in active], dtype=float)
    guess = np.asarray(prior, dtype=float) if prior is not None else anchors.mean(axis=0)
    trust = np.array([max(0.08, min(1.0, m.get("reliability", 1.0))) for m in active])
    if method == "baseline":
        weights, loss = np.ones(len(active)), "linear"
    elif method == "robust":
        weights, loss = np.ones(len(active)), "soft_l1"
    else:
        weights, loss = np.sqrt(trust), "soft_l1"

    def residual(p: np.ndarray) -> np.ndarray:
        return weights * (np.linalg.norm(anchors - p, axis=1) - ranges)

    result = least_squares(residual, guess, loss=loss, f_scale=0.55, bounds=([-4, -4], [24, 19]), max_nfev=80)
    p = result.x
    raw_residual = np.linalg.norm(anchors - p, axis=1) - ranges
    status = _geometry_status(anchors)
    try:
        jtj = result.jac.T @ result.jac
        variance = max(0.02, float(np.sum(result.fun**2) / max(1, len(active) - 2)))
        covariance = np.linalg.pinv(jtj) * variance
        uncertainty = float(np.sqrt(max(np.linalg.eigvalsh(covariance))) * 2.146)
    except (ValueError, np.linalg.LinAlgError):
        covariance, uncertainty, status = np.eye(2) * 16, 8.0, "DEGRADED"
    if len(active) < 3:
        uncertainty, status = max(uncertainty, 6.0), "INSUFFICIENT"
    elif status == "DEGRADED":
        uncertainty = max(uncertainty, 3.5)
    return {
        "x": float(p[0]), "y": float(p[1]), "method": method, "status": status,
        "uncertainty_radius": float(min(12, max(0.12, uncertainty))), "active_measurements": len(active),
        "runtime_ms": (time.perf_counter() - started) * 1000,
        "covariance": np.asarray(covariance).round(6).tolist(),
        "residuals": {m["id"]: float(r) for m, r in zip(active, raw_residual)},
    }
