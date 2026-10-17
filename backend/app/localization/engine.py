from __future__ import annotations

import math
import time
import numpy as np
from scipy.optimize import least_squares

# Critical value for 2-DOF Chi-square distribution at 95% confidence level
# F_chi2_2(c) = 1 - exp(-c/2) = 0.95 => c = 2 * ln(20) ~ 5.99146 => sqrt(c) ~ 2.4477
CHI2_2D_95_SCALE = float(np.sqrt(2.0 * np.log(20.0)))


def _geometry_status(points: np.ndarray) -> tuple[str, float]:
    """Assess spatial anchor geometry condition via Singular Value Decomposition."""
    if len(points) < 3:
        return "INSUFFICIENT", 99.0
    centered = points - points.mean(axis=0)
    singular = np.linalg.svd(centered, compute_uv=False)
    if len(singular) < 2 or singular[-1] < 1e-4:
        return "INSUFFICIENT", 99.0
    cond = float(singular[0] / singular[-1])
    if singular[-1] < 0.75 or cond > 15.0:
        return "DEGRADED", cond
    return "NOMINAL", cond


def estimate_position(measurements: list[dict], method: str = "baseline", prior: np.ndarray | None = None) -> dict:
    started = time.perf_counter()
    active = [m for m in measurements if m.get("available") and m.get("measured_range") is not None]
    if not active:
        p = prior if prior is not None else np.array([10.0, 7.5])
        return {
            "x": float(p[0]),
            "y": float(p[1]),
            "method": method,
            "status": "INSUFFICIENT",
            "status_reason": "Zero usable anchor measurements available.",
            "confidence_score": 0.0,
            "gdop": 99.0,
            "uncertainty_radius": 12.0,
            "uncertainty_major": 12.0,
            "uncertainty_minor": 12.0,
            "uncertainty_angle_deg": 0.0,
            "active_measurements": 0,
            "runtime_ms": 0.0,
            "covariance": [[144.0, 0.0], [0.0, 144.0]],
            "residuals": {},
        }

    anchors = np.array([[m["x"], m["y"]] for m in active], dtype=float)
    ranges = np.array([m["measured_range"] for m in active], dtype=float)
    guess = np.asarray(prior, dtype=float) if prior is not None else anchors.mean(axis=0)
    guess = np.clip(guess, [-0.49, -0.49], [20.49, 15.49])
    trust = np.array([max(0.08, min(1.0, m.get("reliability", 1.0))) for m in active])

    if method == "baseline":
        weights, loss = np.ones(len(active)), "linear"
    elif method == "robust":
        weights, loss = np.ones(len(active)), "soft_l1"
    else:
        weights, loss = np.sqrt(trust), "soft_l1"

    def residual(p: np.ndarray) -> np.ndarray:
        meas_res = weights * (np.linalg.norm(anchors - p, axis=1) - ranges)
        if method == "locus" and prior is not None and len(active) < 3:
            prior_penalty = 0.5 * (p - np.asarray(prior, dtype=float))
            return np.concatenate([meas_res, prior_penalty])
        return meas_res

    result = least_squares(residual, guess, loss=loss, f_scale=0.55, bounds=([-0.5, -0.5], [20.5, 15.5]), max_nfev=80)
    p = result.x
    raw_residual = np.linalg.norm(anchors - p, axis=1) - ranges
    geom_status, cond = _geometry_status(anchors)

    # Compute Geometric Dilution of Precision (GDOP)
    diffs = p - anchors
    dists = np.linalg.norm(diffs, axis=1, keepdims=True) + 1e-6
    G = diffs / dists  # unit direction vectors
    try:
        gtg = G.T @ G
        inv_gtg = np.linalg.pinv(gtg)
        gdop = float(np.sqrt(max(0.1, np.trace(inv_gtg))))
    except Exception:
        gdop = 99.0

    # Covariance derivation from Jacobian
    try:
        jtj = result.jac.T @ result.jac
        variance = max(0.02, float(np.sum(result.fun**2) / max(1, len(active) - 2)))
        covariance = np.linalg.pinv(jtj) * variance
        # Enforce exact mathematical symmetry
        covariance = 0.5 * (covariance + covariance.T)
        eigvals, eigvecs = np.linalg.eigh(covariance)
        order = eigvals.argsort()[::-1]
        eigvals = np.maximum(eigvals[order], 1e-4)
        eigvecs = eigvecs[:, order]
        if not (np.all(np.isfinite(covariance)) and np.all(np.isfinite(eigvals))):
            raise ValueError("Non-finite covariance or eigenvalues encountered")
        angle_deg = float(np.degrees(np.arctan2(eigvecs[1, 0], eigvecs[0, 0])))
        # Derived scale factor from chi-square distribution with 2 DOF at 95% confidence
        semi_major = float(np.sqrt(eigvals[0]) * CHI2_2D_95_SCALE)
        semi_minor = float(np.sqrt(eigvals[1]) * CHI2_2D_95_SCALE)
        uncertainty = semi_major
    except (ValueError, np.linalg.LinAlgError):
        covariance = np.eye(2) * 16.0
        uncertainty = 8.0
        semi_major = 8.0
        semi_minor = 8.0
        angle_deg = 0.0
        geom_status = "DEGRADED"

    mean_res = float(np.mean(np.abs(raw_residual)))
    # Composite calibrated confidence score [0.0 - 1.0]
    s_geom = max(0.0, min(1.0, 2.5 / max(1.0, gdop)))
    s_res = float(np.exp(-mean_res / 1.5))
    s_density = min(1.0, len(active) / 4.0)
    s_trust = float(np.mean(trust))
    confidence = float(np.clip(0.35 * s_geom + 0.30 * s_res + 0.20 * s_density + 0.15 * s_trust, 0.0, 1.0))

    if len(active) < 3:
        uncertainty = max(uncertainty, 6.0)
        semi_major = max(semi_major, 6.0)
        semi_minor = max(semi_minor, 4.0)
        status = "INSUFFICIENT"
        status_reason = f"Insufficient infrastructure: only {len(active)} anchor(s) available (<3 required for 2D trilateration)."
        confidence = min(confidence, 0.25)
    elif geom_status == "DEGRADED" or cond > 10.0 or gdop > 6.0:
        uncertainty = max(uncertainty, 3.5)
        semi_major = max(semi_major, 3.5)
        status = "DEGRADED"
        status_reason = f"Degraded geometry/evidence: GDOP {gdop:.1f}, condition {cond:.1f}, mean residual {mean_res:.2f} m."
        confidence = min(confidence, 0.60)
    elif confidence >= 0.65:
        status = "NOMINAL"
        status_reason = f"Reliable fix: {len(active)} anchors active, GDOP {gdop:.1f}, mean residual {mean_res:.2f} m."
    else:
        status = "DEGRADED"
        status_reason = f"Elevated residual error ({mean_res:.2f} m) from severe measurement corruption."

    return {
        "x": float(p[0]),
        "y": float(p[1]),
        "method": method,
        "status": status,
        "status_reason": status_reason,
        "confidence_score": round(confidence, 3),
        "gdop": round(gdop, 2),
        "uncertainty_radius": float(min(12.0, max(0.12, uncertainty))),
        "uncertainty_major": float(min(12.0, max(0.12, semi_major))),
        "uncertainty_minor": float(min(12.0, max(0.12, semi_minor))),
        "uncertainty_angle_deg": float(angle_deg),
        "active_measurements": len(active),
        "runtime_ms": (time.perf_counter() - started) * 1000,
        "covariance": np.asarray(covariance).round(6).tolist(),
        "residuals": {m["id"]: float(r) for m, r in zip(active, raw_residual)},
    }
