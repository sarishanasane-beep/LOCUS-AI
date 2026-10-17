from __future__ import annotations

import math
import numpy as np
from backend.app.localization import estimate_position
from backend.app.reliability import score_measurements
from backend.app.schemas import SimulationConfig


def get_anchors(count: int = 4) -> list[dict]:
    """Return fixed, known anchor coordinates for a 20 x 15 metre indoor room.
    
    Layouts:
      3: Geometric non-collinear triangle covering room interior
      4: Standard 4 perimeter corners
      6: 4 perimeter corners + 2 horizontal edge midpoints
      8: 4 perimeter corners + 4 edge midpoints
    """
    if count == 3:
        return [
            {"id": "A1", "x": 1.5, "y": 1.5},
            {"id": "A2", "x": 18.5, "y": 1.5},
            {"id": "A3", "x": 10.0, "y": 13.5},
        ]
    elif count == 6:
        return [
            {"id": "A1", "x": 0.8, "y": 0.8},
            {"id": "A2", "x": 19.2, "y": 0.8},
            {"id": "A3", "x": 19.2, "y": 14.2},
            {"id": "A4", "x": 0.8, "y": 14.2},
            {"id": "A5", "x": 10.0, "y": 0.8},
            {"id": "A6", "x": 10.0, "y": 14.2},
        ]
    elif count >= 8:
        return [
            {"id": "A1", "x": 0.8, "y": 0.8},
            {"id": "A2", "x": 19.2, "y": 0.8},
            {"id": "A3", "x": 19.2, "y": 14.2},
            {"id": "A4", "x": 0.8, "y": 14.2},
            {"id": "A5", "x": 10.0, "y": 0.8},
            {"id": "A6", "x": 19.2, "y": 7.5},
            {"id": "A7", "x": 10.0, "y": 14.2},
            {"id": "A8", "x": 0.8, "y": 7.5},
        ]
    # Default: 4 corners
    return [
        {"id": "A1", "x": 0.8, "y": 0.8},
        {"id": "A2", "x": 19.2, "y": 0.8},
        {"id": "A3", "x": 19.2, "y": 14.2},
        {"id": "A4", "x": 0.8, "y": 14.2},
    ]


# Export default ANCHORS constant for backwards compatibility
ANCHORS = get_anchors(4)


def trajectory(steps: int = 240) -> list[dict]:
    points = []
    waypoints = np.array([[2, 2], [17, 3], [15, 12], [7, 9], [3, 13], [2, 2]], dtype=float)
    per = steps // (len(waypoints) - 1)
    for i in range(len(waypoints) - 1):
        for t in range(per):
            u = t / per
            p = waypoints[i] * (1 - u) + waypoints[i + 1] * u
            p += np.array([0.22 * math.sin((i * per + t) / 7), 0.18 * math.sin((i * per + t) / 11)])
            points.append({"x": float(p[0]), "y": float(p[1])})
    return points


class Simulation:
    def __init__(self, config: SimulationConfig | None = None):
        self.config = config or SimulationConfig()
        self.path = trajectory()
        self.playing = False
        self.step_index = 0
        self.history_truth: list[dict] = []
        self.history_estimate: list[dict] = []
        self.anchors = get_anchors(self.config.anchor_count)
        self.anchor_history: dict[str, list[float]] = {a["id"]: [] for a in self.anchors}
        self.previous_ranges: dict[str, float] = {}
        self.previous_estimate: np.ndarray | None = None
        self.velocity = np.zeros(2)

        # Constant-Velocity Kalman Filter State: [x, y, vx, vy]
        self.kf_state: np.ndarray | None = None
        self.kf_cov: np.ndarray = np.diag([2.0, 2.0, 1.0, 1.0])

    def reset(self):
        self.step_index = 0
        self.history_truth = []
        self.history_estimate = []
        self.anchors = get_anchors(self.config.anchor_count)
        self.anchor_history = {a["id"]: [] for a in self.anchors}
        self.previous_ranges = {}
        self.previous_estimate = None
        self.velocity = np.zeros(2)
        self.kf_state = None
        self.kf_cov = np.diag([2.0, 2.0, 1.0, 1.0])

    def update_config(self, values: dict):
        old_count = self.config.anchor_count
        self.config = self.config.model_copy(update={k: v for k, v in values.items() if v is not None})
        if self.config.anchor_count != old_count:
            self.anchors = get_anchors(self.config.anchor_count)
            for a in self.anchors:
                if a["id"] not in self.anchor_history:
                    self.anchor_history[a["id"]] = []

    def frame(self, advance: bool = False) -> dict:
        if advance:
            self.step_index = (self.step_index + 1) % len(self.path)
        truth = self.path[self.step_index]
        rng = np.random.default_rng(self.config.seed * 100_003 + self.step_index)
        measurements = []

        # Generate range measurements across all configured anchors
        for idx, anchor in enumerate(self.anchors):
            ideal = math.dist((truth["x"], truth["y"]), (anchor["x"], anchor["y"]))
            available = bool(anchor["id"] not in self.config.disabled_anchors and rng.random() >= self.config.missing_probability)
            # Second anchor A2 has elevated NLOS bias probability; other anchors experience general contamination
            is_nlos_candidate = bool(idx == 1 or rng.random() < 0.35)
            biased = bool(is_nlos_candidate and rng.random() < self.config.nlos_probability)
            bias = float(rng.uniform(1.3, 3.7)) if biased else 0.0
            measured = max(0.05, ideal + rng.normal(0, self.config.noise) + bias) if available else None
            measurements.append({
                **anchor,
                "ideal_range": ideal,
                "measured_range": measured,
                "available": available,
                "biased": biased,
            })

        predicted = None if self.previous_estimate is None else self.previous_estimate + self.velocity
        history_to_use = self.anchor_history if advance else {k: list(v) for k, v in self.anchor_history.items()}
        measurements = score_measurements(measurements, predicted, history_to_use, use_ml=True)
        self.previous_ranges = {k: (v[-1] if v else 0.0) for k, v in self.anchor_history.items()}

        # 1. Measurement-based point position estimates
        baseline = estimate_position(measurements, "baseline", predicted)
        robust = estimate_position(measurements, "robust", predicted)
        locus = estimate_position(measurements, "locus", predicted)

        for estimate in (baseline, robust, locus):
            estimate["x"] = float(np.clip(estimate["x"], 0.0, 20.0))
            estimate["y"] = float(np.clip(estimate["y"], 0.0, 15.0))
            estimate["error"] = math.dist((estimate["x"], estimate["y"]), (truth["x"], truth["y"]))

        relative_gain = ((baseline["error"] - locus["error"]) / baseline["error"] * 100) if baseline["error"] else 0.0
        residuals = locus.pop("residuals", {})
        baseline.pop("residuals", None)
        robust.pop("residuals", None)
        for m in measurements:
            m["residual"] = residuals.get(m["id"])

        # 2. Kinematic State Estimation (Kalman Filter) & One-Step Next-Position Forecast
        dt = 0.2  # 200 ms simulation time-step
        F = np.array([
            [1.0, 0.0, dt, 0.0],
            [0.0, 1.0, 0.0, dt],
            [0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
        ])
        q_accel = 0.20  # acceleration noise spectral density
        dt2 = dt * dt / 2.0
        dt3 = dt * dt * dt / 3.0
        Q = q_accel * np.array([
            [dt3, 0.0, dt2, 0.0],
            [0.0, dt3, 0.0, dt2],
            [dt2, 0.0, dt, 0.0],
            [0.0, dt2, 0.0, dt],
        ])
        H = np.array([
            [1.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0],
        ])

        # Current working state
        if self.kf_state is None:
            cur_state = np.array([locus["x"], locus["y"], 0.0, 0.0])
            cur_cov = np.diag([2.0, 2.0, 1.0, 1.0])
        else:
            cur_state = self.kf_state.copy()
            cur_cov = self.kf_cov.copy()

        # Measurement covariance R from locus covariance
        try:
            cov_mat = np.array(locus.get("covariance", [[1.0, 0.0], [0.0, 1.0]]))[:2, :2]
            R = np.clip(cov_mat, 0.04, 16.0)
        except Exception:
            R = np.eye(2) * 2.0

        # Predict step
        pred_state = F @ cur_state
        pred_cov = F @ cur_cov @ F.T + Q

        # Update step (if usable measurement evidence)
        if locus["status"] != "INSUFFICIENT" and locus["active_measurements"] >= 2:
            z = np.array([locus["x"], locus["y"]])
            y = z - H @ pred_state
            # Gated innovation: bounds maximum measurement-induced pull under severe multi-anchor NLOS
            y_norm = float(np.linalg.norm(y))
            if y_norm > 2.0:
                y = y * (2.0 / y_norm)
            S = H @ pred_cov @ H.T + R
            K = pred_cov @ H.T @ np.linalg.pinv(S)
            filt_state = pred_state + K @ y
            filt_cov = (np.eye(4) - K @ H) @ pred_cov
        else:
            filt_state = pred_state
            filt_cov = pred_cov

        # Physical velocity bound (+/- 5.0 m/s) and position bounds
        filt_state[0] = float(np.clip(filt_state[0], 0.0, 20.0))
        filt_state[1] = float(np.clip(filt_state[1], 0.0, 15.0))
        filt_state[2] = float(np.clip(filt_state[2], -5.0, 5.0))
        filt_state[3] = float(np.clip(filt_state[3], -5.0, 5.0))

        # Next-position prediction (one step ahead at t + dt)
        fc_state = F @ filt_state
        fc_cov = F @ filt_cov @ F.T + Q
        fc_x = float(np.clip(fc_state[0], 0.0, 20.0))
        fc_y = float(np.clip(fc_state[1], 0.0, 15.0))
        fc_uncert = float(np.sqrt(max(0.01, fc_cov[0, 0] + fc_cov[1, 1])) * 2.4477 / np.sqrt(2.0))

        if advance:
            self.kf_state = filt_state
            self.kf_cov = filt_cov
            self.previous_estimate = np.array([filt_state[0], filt_state[1]])
            self.velocity = np.array([filt_state[2], filt_state[3]]) * dt

        filt_pos = {"x": float(filt_state[0]), "y": float(filt_state[1])}
        filt_error = math.dist((filt_pos["x"], filt_pos["y"]), (truth["x"], truth["y"]))

        point = {"x": filt_pos["x"], "y": filt_pos["y"]}
        if advance or not self.history_truth:
            self.history_truth.append(truth.copy())
            self.history_estimate.append(point)
            self.history_truth = self.history_truth[-100:]
            self.history_estimate = self.history_estimate[-100:]

        active_scorer = "ml" if any(m.get("scorer") == "ml" for m in measurements) else "heuristic"
        active_cnt = locus["active_measurements"]
        corrupted_cnt = sum(1 for m in measurements if m.get("detected_flag") and m.get("available"))
        
        # Explainable AI frame-level summary
        if locus["status"] == "INSUFFICIENT":
            frame_explanation = f"Insufficient infrastructure: {active_cnt} active anchor(s) (<3 required for 2D trilateration)."
        elif corrupted_cnt > 0:
            frame_explanation = f"{active_cnt} anchors active. {corrupted_cnt} anchor(s) flagged NLOS/multipath and reliability down-weighted."
        else:
            frame_explanation = f"Nominal trilateration: {active_cnt} of {len(self.anchors)} anchors active with clean line-of-sight."

        return {
            "timestamp": round(self.step_index * 0.2, 3),
            "step": self.step_index,
            "total_steps": len(self.path),
            "truth": truth,
            "baseline": baseline,
            "robust": robust,
            "locus": locus,
            "filtered": {
                "x": filt_pos["x"],
                "y": filt_pos["y"],
                "error": float(filt_error),
                "velocity": [round(float(filt_state[2]), 2), round(float(filt_state[3]), 2)],
                "speed_mps": round(float(np.hypot(filt_state[2], filt_state[3])), 2),
                "status": locus["status"],
            },
            "forecast": {
                "x": fc_x,
                "y": fc_y,
                "horizon_s": round(dt, 2),
                "velocity": [round(float(filt_state[2]), 2), round(float(filt_state[3]), 2)],
                "uncertainty_radius": round(min(12.0, max(0.15, fc_uncert)), 2),
                "status": "NOMINAL" if locus["status"] != "INSUFFICIENT" else "DEGRADED",
            },
            "anchors": measurements,
            "path": self.path,
            "history_truth": self.history_truth,
            "history_estimate": self.history_estimate,
            "config": self.config.model_dump(),
            "room": {"width": 20, "height": 15},
            "anchor_total": len(self.anchors),
            "metrics": {
                "relative_gain": float(relative_gain),
                "mean_anomaly": float(np.mean([m["anomaly_score"] for m in measurements])),
                "active_scorer": active_scorer,
                "confidence_score": locus.get("confidence_score", 0.8),
                "frame_explanation": frame_explanation,
            },
        }
