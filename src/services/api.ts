import type { ExperimentResult, Frame, SimulationConfig } from '../types'

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
  train: () => json<{ status: string; accuracy: number; samples: number }>('/api/ml/train', { method: 'POST' }),
  mlStatus: () => json<{ status: string; accuracy: number | null; samples: number }>('/api/ml/status'),
  generateDataset: (rows = 800) => json<{ rows: number; preview: Record<string, unknown>[]; download_url: string }>('/api/datasets/generate', { method: 'POST', body: JSON.stringify({ rows, seed: 41 }) })
}
