from __future__ import annotations

import math
import numpy as np
from backend.app.localization import estimate_position
from backend.app.reliability import score_measurements
from backend.app.schemas import SimulationConfig

ANCHORS = [
    {"id": "A1", "x": 0.8, "y": 0.8}, {"id": "A2", "x": 19.2, "y": 0.8},
    {"id": "A3", "x": 19.2, "y": 14.2}, {"id": "A4", "x": 0.8, "y": 14.2},
]


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
        self.previous_ranges: dict[str, float] = {}
        self.previous_estimate: np.ndarray | None = None
        self.velocity = np.zeros(2)

    def reset(self):
        self.step_index = 0; self.history_truth = []; self.history_estimate = []; self.previous_ranges = {}; self.previous_estimate = None; self.velocity = np.zeros(2)

    def update_config(self, values: dict):
        self.config = self.config.model_copy(update={k: v for k, v in values.items() if v is not None})

    def frame(self, advance: bool = False) -> dict:
        if advance: self.step_index = (self.step_index + 1) % len(self.path)
        truth = self.path[self.step_index]
        rng = np.random.default_rng(self.config.seed * 100_003 + self.step_index)
        measurements = []
        for idx, anchor in enumerate(ANCHORS):
            ideal = math.dist((truth["x"], truth["y"]), (anchor["x"], anchor["y"]))
            available = bool(anchor["id"] not in self.config.disabled_anchors and rng.random() >= self.config.missing_probability)
            biased = bool(idx == 1 and rng.random() < self.config.nlos_probability)
            bias = float(rng.uniform(1.3, 3.7)) if biased else 0.0
            measured = max(0.05, ideal + rng.normal(0, self.config.noise) + bias) if available else None
            measurements.append({**anchor, "ideal_range": ideal, "measured_range": measured, "available": available, "biased": biased})
        predicted = None if self.previous_estimate is None else self.previous_estimate + self.velocity
        measurements = score_measurements(measurements, predicted, self.previous_ranges)
        baseline = estimate_position(measurements, "baseline", predicted)
        robust = estimate_position(measurements, "robust", predicted)
        locus = estimate_position(measurements, "locus", predicted)
        measured_position = np.array([locus["x"], locus["y"]])
        if self.previous_estimate is not None:
            filtered = 0.72 * measured_position + 0.28 * predicted
            self.velocity = 0.7 * self.velocity + 0.3 * (filtered - self.previous_estimate)
            locus["x"], locus["y"] = map(float, filtered)
        self.previous_estimate = np.array([locus["x"], locus["y"]])
        for estimate in (baseline, robust, locus):
            estimate["error"] = math.dist((estimate["x"], estimate["y"]), (truth["x"], truth["y"]))
        relative_gain = ((baseline["error"] - locus["error"]) / baseline["error"] * 100) if baseline["error"] else 0.0
        residuals = locus.pop("residuals", {})
        baseline.pop("residuals", None); robust.pop("residuals", None)
        for m in measurements: m["residual"] = residuals.get(m["id"])
        point = {"x": locus["x"], "y": locus["y"]}
        if advance or not self.history_truth:
            self.history_truth.append(truth.copy()); self.history_estimate.append(point)
            self.history_truth = self.history_truth[-100:]; self.history_estimate = self.history_estimate[-100:]
        return {
            "timestamp": round(self.step_index * 0.2, 3), "step": self.step_index, "total_steps": len(self.path),
            "truth": truth, "baseline": baseline, "robust": robust, "locus": locus, "anchors": measurements,
            "path": self.path, "history_truth": self.history_truth, "history_estimate": self.history_estimate,
            "config": self.config.model_dump(), "room": {"width": 20, "height": 15}, "anchor_total": len(ANCHORS),
            "metrics": {"relative_gain": float(relative_gain), "mean_anomaly": float(np.mean([m["anomaly_score"] for m in measurements]))},
        }
