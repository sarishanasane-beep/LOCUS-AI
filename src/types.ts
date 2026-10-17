export type Point = { x: number; y: number }

export type AnchorMeasurement = {
  id: string
  x: number
  y: number
  measured_range: number | null
  ideal_range: number
  available: boolean
  biased: boolean
  reliability: number
  anomaly_score: number
  residual: number | null
  corruption_prob?: number
  detected_flag?: boolean
  weight_effect?: string
  reason?: string
}

export type Estimate = {
  x: number
  y: number
  error: number
  method: string
  status: string
  status_reason?: string
  uncertainty_radius: number
  uncertainty_major?: number
  uncertainty_minor?: number
  uncertainty_angle_deg?: number
  confidence_score?: number
  gdop?: number | null
  active_measurements: number
  covariance?: number[][]
}

export type FilteredState = {
  x: number
  y: number
  error: number
  velocity: [number, number]
  speed_mps: number
  status: string
}

export type ForecastState = {
  x: number
  y: number
  horizon_s: number
  velocity: [number, number]
  uncertainty_radius: number
  status: string
}

export type Frame = {
  timestamp: number
  step: number
  total_steps: number
  truth: Point
  baseline: Estimate
  robust: Estimate
  locus: Estimate
  filtered: FilteredState
  forecast: ForecastState
  anchors: AnchorMeasurement[]
  path: Point[]
  history_truth: Point[]
  history_estimate: Point[]
  config: SimulationConfig
  room: { width: number; height: number }
  anchor_total: number
  metrics: {
    relative_gain: number
    mean_anomaly: number
    active_scorer?: string
    confidence_score?: number
    frame_explanation?: string
  }
}

export type SimulationConfig = {
  noise: number
  nlos_probability: number
  missing_probability: number
  speed: number
  seed: number
  anchor_count?: number
  disabled_anchors: string[]
}

export type ExperimentResultItem = {
  method: string
  rmse: number
  median: number
  p90: number
  availability: number
  runtime_ms: number
  cdf?: { error: number; probability: number }[]
}

export type ExperimentResult = ExperimentResultItem[]

export type DensityComparisonItem = {
  anchors: number
  baseline_rmse: number
  robust_rmse: number
  locus_rmse: number
  locus_availability: number
  gain_vs_baseline_pct: number
}

export type DensityTableRow = {
  anchors: number
  method: string
  rmse: number
  median: number
  p90: number
  availability: number
  runtime_ms: number
  samples: number
}

export type DensityExperimentResponse = {
  condition: string
  condition_name: string
  parameters: {
    name: string
    noise: number
    nlos_probability: number
    missing_probability: number
  }
  seed: number
  sample_count: number
  density_comparison: DensityComparisonItem[]
  results: DensityTableRow[]
  interpretation: string
}

export type ForecastingComparisonItem = {
  method: string
  rmse: number
  median: number
  p90: number
  samples: number
}

export type ForecastingExperimentResponse = {
  horizon_s: number
  samples: number
  seed: number
  parameters: {
    noise: number
    nlos_probability: number
    missing_probability: number
    anchor_count: number
  }
  comparison: ForecastingComparisonItem[]
  regime_breakdown: {
    clean_motion: ForecastingComparisonItem
    nlos_corruption: ForecastingComparisonItem
    missing_measurements: ForecastingComparisonItem
  }
  interpretation: string
}

export type ModelMetricSet = {
  name: string
  accuracy: number
  precision: number
  recall: number
  f1: number
  confusion_matrix?: number[][]
}

export type MLStatus = {
  status: string
  trained_at?: string
  split_method?: string
  class_balance?: {
    corrupted_percent: number
    nominal_percent: number
    test_clean_count?: number
    test_corrupted_count?: number
    test_clean_percent?: number
    test_corrupted_percent?: number
    train_clean_count?: number
    train_corrupted_count?: number
    train_clean_percent?: number
    train_corrupted_percent?: number
  }
  inference_latency_ms?: number
  accuracy: number | null
  precision: number | null
  recall: number | null
  f1: number | null
  samples: number
  train_samples: number
  test_samples: number
  confusion_matrix: number[][] | null
  feature_names: string[]
  feature_importance: number[] | null
  localization_comparison: {
    baseline_rmse: number
    baseline_p90: number
    baseline_availability?: number
    robust_rmse: number
    robust_p90: number
    robust_availability?: number
    locus_ml_rmse: number
    locus_ml_p90: number
    locus_ml_availability?: number
    rmse_improvement_pct: number
  } | null
  model_comparison?: {
    random_forest: ModelMetricSet
    isolation_forest: ModelMetricSet
    heuristic: ModelMetricSet
    combined_ensemble: ModelMetricSet
  } | null
}
