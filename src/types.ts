export type Point = { x: number; y: number }
export type AnchorMeasurement = {
  id: string; x: number; y: number; measured_range: number | null; ideal_range: number;
  available: boolean; biased: boolean; reliability: number; anomaly_score: number; residual: number | null;
}
export type Estimate = {
  x: number; y: number; error: number; method: string; status: string; uncertainty_radius: number; active_measurements: number;
}
export type Frame = {
  timestamp: number; step: number; total_steps: number; truth: Point; baseline: Estimate; robust: Estimate; locus: Estimate;
  anchors: AnchorMeasurement[]; path: Point[]; history_truth: Point[]; history_estimate: Point[]; config: SimulationConfig;
  room: { width: number; height: number }; anchor_total: number; metrics: { relative_gain: number; mean_anomaly: number };
}
export type SimulationConfig = { noise: number; nlos_probability: number; missing_probability: number; speed: number; seed: number; disabled_anchors: string[] }
export type ExperimentResult = { method: string; rmse: number; p90: number; availability: number; runtime_ms: number }[]
