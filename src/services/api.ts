import type { DensityExperimentResponse, ExperimentResult, ForecastingExperimentResponse, Frame, MLStatus, SimulationConfig } from '../types'

const json = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Request failed: ${response.status}`)
  return response.json()
}

export const api = {
  health: () => json<{ status: string; engine: string; model_status: string }>('/api/health'),
  createSimulation: (config?: Partial<SimulationConfig>) => json<{ id: string; state: Frame }>('/api/simulation/create', { method: 'POST', body: JSON.stringify({ config }) }),
  action: (id: string, action: 'play' | 'pause' | 'reset' | 'step') => json(`/api/simulation/${id}/${action}`, { method: 'POST' }),
  configure: (id: string, config: Partial<SimulationConfig>) => json(`/api/simulation/${id}/configure`, { method: 'POST', body: JSON.stringify(config) }),
  experiment: (config: Partial<SimulationConfig>) => json<{ id: string; results: ExperimentResult; scenario: object }>('/api/experiments/run', { method: 'POST', body: JSON.stringify(config) }),
  densityExperiment: (req: { condition: string; anchor_counts?: number[]; samples?: number; seed?: number }) =>
    json<DensityExperimentResponse>('/api/experiments/density', { method: 'POST', body: JSON.stringify(req) }),
  forecastingExperiment: (req: { samples?: number; seed?: number; noise?: number; nlos_probability?: number; missing_probability?: number; anchor_count?: number }) =>
    json<ForecastingExperimentResponse>('/api/experiments/forecasting', { method: 'POST', body: JSON.stringify(req) }),
  train: () => json<MLStatus>('/api/ml/train', { method: 'POST' }),
  mlStatus: () => json<MLStatus>('/api/ml/status'),
  generateDataset: (params?: { rows?: number; seed?: number; anchor_count?: number; noise?: number; nlos_probability?: number; missing_probability?: number }) =>
    json<{ rows: number; preview: Record<string, unknown>[]; download_url: string }>('/api/datasets/generate', {
      method: 'POST',
      body: JSON.stringify({
        rows: params?.rows ?? 800,
        seed: params?.seed ?? 41,
        anchor_count: params?.anchor_count ?? 4,
        noise: params?.noise ?? 0.30,
        nlos_probability: params?.nlos_probability ?? 0.18,
        missing_probability: params?.missing_probability ?? 0.08,
      }),
    }),
  uploadDataset: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch('/api/datasets/upload', {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail || `Upload failed: ${response.status}`)
    }
    return response.json() as Promise<{
      id: string
      rows: number
      columns: string[]
      missing_values: Record<string, number>
      preview: Record<string, unknown>[]
      download_url: string
    }>
  },
}
