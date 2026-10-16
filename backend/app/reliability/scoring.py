import numpy as np


def score_measurements(measurements: list[dict], prior: np.ndarray | None, previous_ranges: dict[str, float]) -> list[dict]:
    available = [m for m in measurements if m["available"]]
    median_range = float(np.median([m["measured_range"] for m in available])) if available else 0.0
    for m in measurements:
        if not m["available"]:
            m.update(reliability=0.0, anomaly_score=1.0)
            continue
        change = abs(m["measured_range"] - previous_ranges.get(m["id"], m["measured_range"]))
        motion_disagreement = 0.0 if prior is None else abs(np.linalg.norm(prior - np.array([m["x"], m["y"]])) - m["measured_range"])
        cross_anchor = abs(m["measured_range"] - median_range) / 12.0
        anomaly = min(1.0, 0.38 * min(1, change / 1.8) + 0.52 * min(1, motion_disagreement / 2.8) + 0.10 * min(1, cross_anchor))
        reliability = max(0.08, min(1.0, 1.0 - anomaly))
        m.update(reliability=float(reliability), anomaly_score=float(anomaly))
        previous_ranges[m["id"]] = m["measured_range"]
    return measurements
