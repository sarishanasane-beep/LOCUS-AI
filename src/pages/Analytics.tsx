import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download, FlaskConical, Layers, Compass, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { api } from '../services/api'
import { LiquidGlass } from '../components/LiquidGlass'
import type { DensityExperimentResponse, ExperimentResultItem, ForecastingExperimentResponse } from '../types'

export function Analytics() {
  const [activeTab, setActiveTab] = useState<'density' | 'forecasting' | 'scenario'>('density')
  const [densityCondition, setDensityCondition] = useState<'clean' | 'moderate' | 'heavy_nlos' | 'severe'>('moderate')

  // Scenario Benchmark Mutation
  const scenarioRun = useMutation({
    mutationFn: () => api.experiment({ noise: 0.55, nlos_probability: 0.25, missing_probability: 0.1, seed: 73 }),
  })
  const results: ExperimentResultItem[] | undefined = scenarioRun.data?.results as ExperimentResultItem[] | undefined
  const maxRmse = Math.max(...(results?.map(r => r.rmse) || [1]))

  // Density Benchmark Mutation
  const densityRun = useMutation({
    mutationFn: (cond: string) => api.densityExperiment({ condition: cond, anchor_counts: [3, 4, 6, 8], samples: 60, seed: 73 }),
  })
  const densityData: DensityExperimentResponse | undefined = densityRun.data

  // Forecasting Benchmark Mutation
  const forecastRun = useMutation({
    mutationFn: () => api.forecastingExperiment({ samples: 80, seed: 42, noise: 0.40, nlos_probability: 0.25, missing_probability: 0.10, anchor_count: 4 }),
  })
  const forecastData: ForecastingExperimentResponse | undefined = forecastRun.data

  const methodColors: Record<string, string> = {
    BASELINE: '#f6bc5b',
    ROBUST: '#57dbf4',
    LOCUS: '#c7fa65',
  }

  const exportScenarioCsv = () => {
    if (!results) return
    const rows = [
      'method,rmse,median,p90,availability,runtime_ms',
      ...results.map(r => `${r.method},${r.rmse},${r.median ?? ''},${r.p90},${r.availability},${r.runtime_ms}`),
    ]
    downloadBlob(rows.join('\n'), 'locus-scenario-benchmark.csv')
  }

  const exportDensityCsv = () => {
    if (!densityData) return
    const rows = [
      'anchors,method,rmse,median,p90,availability,runtime_ms,samples',
      ...densityData.results.map(r => `${r.anchors},${r.method},${r.rmse},${r.median},${r.p90},${r.availability},${r.runtime_ms},${r.samples}`),
    ]
    downloadBlob(rows.join('\n'), `locus-density-${densityData.condition}-benchmark.csv`)
  }

  const exportForecastingCsv = () => {
    if (!forecastData) return
    const rows = [
      'method,rmse,median,p90,samples',
      ...forecastData.comparison.map(r => `${r.method},${r.rmse},${r.median},${r.p90},${r.samples}`),
    ]
    downloadBlob(rows.join('\n'), 'locus-forecasting-benchmark.csv')
  }

  const downloadBlob = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
  }

  return (
    <div className="page analytics-page">
      <header className="page-heading">
        <div>
          <span className="route-code">BENCHMARK / EVALUATION</span>
          <h1>Accuracy &amp; Validation Suite</h1>
          <p>Multi-density infrastructure evaluation, tracking vs. forecasting rigor, and verified empirical metrics.</p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`density-pill ${activeTab === 'density' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('density')
              if (!densityData && !densityRun.isPending) densityRun.mutate(densityCondition)
            }}
          >
            <Layers size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
            Density Benchmark
          </button>
          <button
            className={`density-pill ${activeTab === 'forecasting' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('forecasting')
              if (!forecastData && !forecastRun.isPending) forecastRun.mutate()
            }}
          >
            <Compass size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
            Forecasting vs Tracking
          </button>
          <button
            className={`density-pill ${activeTab === 'scenario' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('scenario')
              if (!results && !scenarioRun.isPending) scenarioRun.mutate()
            }}
          >
            <FlaskConical size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
            CDF &amp; Tail Error
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* TAB 1: INFRASTRUCTURE DENSITY BENCHMARK (PHASE 2) */}
      {/* ========================================================================= */}
      {activeTab === 'density' && (
        <section>
          {/* Condition Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ font: '600 11px var(--mono)', color: 'var(--text-secondary)', marginRight: '4px' }}>CONDITION:</span>
              {(['clean', 'moderate', 'heavy_nlos', 'severe'] as const).map(c => (
                <button
                  key={c}
                  className={`density-pill ${densityCondition === c ? 'active' : ''}`}
                  onClick={() => {
                    setDensityCondition(c)
                    densityRun.mutate(c)
                  }}
                  disabled={densityRun.isPending}
                >
                  {c === 'clean' ? 'Clean LOS' : c === 'moderate' ? 'Moderate NLOS' : c === 'heavy_nlos' ? 'Heavy NLOS' : 'Severe Stress'}
                </button>
              ))}
            </div>

            <button
              className="primary-action"
              onClick={() => densityRun.mutate(densityCondition)}
              disabled={densityRun.isPending}
            >
              <FlaskConical size={14} />
              {densityRun.isPending ? 'Benchmarking 3, 4, 6, 8 Anchors…' : 'Run Density Benchmark'}
            </button>
          </div>

          {!densityData ? (
            <LiquidGlass className="experiment-empty">
              <div className="experiment-matrix">
                <span>3 ANCHORS (SPARSE)</span>
                <span>4 ANCHORS (STANDARD)</span>
                <span>6 ANCHORS (DENSE)</span>
                <span>8 ANCHORS (HIGH-DENSITY)</span>
                <span>FAIR HELD-OUT TRAJECTORIES</span>
              </div>
              <h2>Infrastructure-Density Scaling Analysis</h2>
              <p>
                {densityRun.isPending
                  ? 'Executing controlled benchmark across 3, 4, 6, and 8 anchors under identical motion trajectories…'
                  : 'Compare Baseline, Robust, and LOCUS AI across varying anchor densities (nested perimeter/midpoints for 4/6/8 anchors, optimal non-collinear triangle for 3 anchors). Discover how LOCUS reliability weighting handles the critical 3-anchor edge case.'}
              </p>
            </LiquidGlass>
          ) : (
            <>
              {/* Evidence-Based Interpretation Banner */}
              <LiquidGlass style={{ padding: '18px 24px', marginBottom: '18px', borderLeft: '3px solid var(--lime)' }}>
                <div style={{ font: '700 11px var(--mono)', color: 'var(--lime)', letterSpacing: '0.08em', marginBottom: '6px' }}>
                  AUTOMATED DATA-DERIVED INTERPRETATION
                </div>
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {densityData.interpretation}
                </p>
              </LiquidGlass>

              {/* Density Comparison Grid Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '18px' }}>
                {densityData.density_comparison.map(item => (
                  <LiquidGlass key={item.anchors} style={{ padding: '16px 18px' }}>
                    <div style={{ font: '700 11px var(--mono)', color: 'var(--cyan)', marginBottom: '8px' }}>
                      {item.anchors} ANCHORS {item.anchors === 3 ? '(SPARSE)' : item.anchors === 8 ? '(DENSE)' : ''}
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--lime)', marginBottom: '4px' }}>
                      {item.locus_rmse.toFixed(3)}m
                      <small style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>RMSE</small>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Baseline: {item.baseline_rmse.toFixed(3)}m</span>
                      <strong style={{ color: item.gain_vs_baseline_pct >= 0 ? 'var(--lime)' : 'var(--coral)' }}>
                        {item.gain_vs_baseline_pct >= 0 ? '+' : ''}{item.gain_vs_baseline_pct}%
                      </strong>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Availability: {(item.locus_availability * 100).toFixed(0)}%
                    </div>
                  </LiquidGlass>
                ))}
              </div>

              {/* Detailed Multi-Density Benchmark Table */}
              <LiquidGlass className="result-table" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="panel-bar" style={{ padding: '12px 18px' }}>
                  <span>FULL DENSITY BENCHMARK RESULTS · {densityData.condition_name.toUpperCase()}</span>
                  <span className="live">N={densityData.sample_count} EVALUATION FRAMES PER DENSITY</span>
                </div>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(9,24,34,0.92)', borderBottom: '1px solid var(--line)', color: 'var(--cyan)', font: '600 11px var(--mono)' }}>
                        <th style={{ padding: '12px 18px' }}>ANCHORS</th>
                        <th style={{ padding: '12px 18px' }}>METHOD</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>RMSE</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>MEDIAN</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>P90 TAIL</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>AVAILABILITY</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>LATENCY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {densityData.results.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--line)', font: '12px var(--mono)', background: r.method === 'LOCUS' ? 'rgba(199,250,101,0.03)' : undefined }}>
                          <td style={{ padding: '10px 18px', color: 'var(--text-muted)' }}>{r.anchors} Nodes</td>
                          <td style={{ padding: '10px 18px' }}>
                            <strong style={{ color: methodColors[r.method] || 'var(--text-primary)' }}>{r.method}</strong>
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: r.method === 'LOCUS' ? 'var(--lime)' : 'var(--text-secondary)' }}>
                            {r.rmse.toFixed(3)} m
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.median.toFixed(3)} m</td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.p90.toFixed(3)} m</td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', color: r.availability >= 0.9 ? 'var(--lime)' : 'var(--amber)' }}>
                            {(r.availability * 100).toFixed(1)}%
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', color: 'var(--text-muted)' }}>{r.runtime_ms.toFixed(2)} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </LiquidGlass>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="primary-action" onClick={exportDensityCsv} style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.2)', color: 'var(--text-primary)' }}>
                  <Download size={14} /> Export Multi-Density CSV
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FORECASTING VS TRACKING BENCHMARK (PHASE 4.4) */}
      {/* ========================================================================= */}
      {activeTab === 'forecasting' && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ font: '600 12px var(--mono)', color: 'var(--text-secondary)' }}>
              EVALUATION PROTOCOL: FUTURE GROUND-TRUTH ALIGNMENT (t + 0.2s) · ZERO TEMPORAL LEAKAGE
            </div>
            <button
              className="primary-action"
              onClick={() => forecastRun.mutate()}
              disabled={forecastRun.isPending}
            >
              <Compass size={14} />
              {forecastRun.isPending ? 'Evaluating Forecasts…' : 'Run Forecasting Benchmark'}
            </button>
          </div>

          {!forecastData ? (
            <LiquidGlass className="experiment-empty">
              <div className="experiment-matrix">
                <span>0.2s FORECAST HORIZON</span>
                <span>CONSTANT-VELOCITY KALMAN FILTER</span>
                <span>CLEAN MOTION REGIME</span>
                <span>NLOS CORRUPTION REGIME</span>
                <span>PACKET LOSS REGIME</span>
              </div>
              <h2>Quantitative Tracking &amp; Forecasting Benchmark</h2>
              <p>
                {forecastRun.isPending
                  ? 'Evaluating raw instantaneous measurement vs. Kalman filtered state vs. one-step-ahead forecast against future trajectory ground truth…'
                  : 'Evaluate the temporal model on complete held-out trajectories. Quantifies error reduction from temporal stabilization and evaluates predictive positioning error at future timestamps.'}
              </p>
            </LiquidGlass>
          ) : (
            <>
              {/* Automated Interpretation */}
              <LiquidGlass style={{ padding: '18px 24px', marginBottom: '18px', borderLeft: '3px solid #a78bfa' }}>
                <div style={{ font: '700 11px var(--mono)', color: '#a78bfa', letterSpacing: '0.08em', marginBottom: '6px' }}>
                  TEMPORAL EVALUATION FINDINGS
                </div>
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {forecastData.interpretation}
                </p>
              </LiquidGlass>

              {/* Comparison Table */}
              <LiquidGlass className="result-table" style={{ padding: 0, overflow: 'hidden', marginBottom: '18px' }}>
                <div className="panel-bar" style={{ padding: '12px 18px' }}>
                  <span>MEASUREMENT VS. FILTERING VS. FORECASTING</span>
                  <span className="live">HORIZON = +{forecastData.horizon_s}s (EVALUATED AT TRUTH t+{forecastData.horizon_s}s)</span>
                </div>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(9,24,34,0.92)', borderBottom: '1px solid var(--line)', color: 'var(--cyan)', font: '600 11px var(--mono)' }}>
                        <th style={{ padding: '12px 18px' }}>OUTPUT TYPE</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>RMSE</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>MEDIAN</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>P90 TAIL</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>SAMPLES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecastData.comparison.map((item, idx) => {
                        const isFilt = item.method.includes('FILTERED')
                        const isFc = item.method.includes('FORECAST')
                        const color = isFilt ? '#38ef7d' : isFc ? '#a78bfa' : '#c7fa65'
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--line)', font: '12px var(--mono)' }}>
                            <td style={{ padding: '12px 18px', fontWeight: 700, color }}>{item.method}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {item.rmse.toFixed(3)} m
                            </td>
                            <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {item.median.toFixed(3)} m
                            </td>
                            <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {item.p90.toFixed(3)} m
                            </td>
                            <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--text-muted)' }}>
                              {item.samples} frames
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </LiquidGlass>

              {/* Regime Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
                <LiquidGlass style={{ padding: '16px 20px' }}>
                  <div style={{ font: '700 11px var(--mono)', color: 'var(--cyan)', marginBottom: '8px' }}>CLEAN MOTION REGIME</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>
                    {forecastData.regime_breakdown.clean_motion.rmse.toFixed(3)}m
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Median: {forecastData.regime_breakdown.clean_motion.median.toFixed(3)}m · P90: {forecastData.regime_breakdown.clean_motion.p90.toFixed(3)}m
                  </div>
                </LiquidGlass>

                <LiquidGlass style={{ padding: '16px 20px' }}>
                  <div style={{ font: '700 11px var(--mono)', color: 'var(--amber)', marginBottom: '8px' }}>NLOS CORRUPTION REGIME</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>
                    {forecastData.regime_breakdown.nlos_corruption.rmse.toFixed(3)}m
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Median: {forecastData.regime_breakdown.nlos_corruption.median.toFixed(3)}m · P90: {forecastData.regime_breakdown.nlos_corruption.p90.toFixed(3)}m
                  </div>
                </LiquidGlass>

                <LiquidGlass style={{ padding: '16px 20px' }}>
                  <div style={{ font: '700 11px var(--mono)', color: 'var(--coral)', marginBottom: '8px' }}>PACKET LOSS REGIME</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>
                    {forecastData.regime_breakdown.missing_measurements.rmse.toFixed(3)}m
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Median: {forecastData.regime_breakdown.missing_measurements.median.toFixed(3)}m · P90: {forecastData.regime_breakdown.missing_measurements.p90.toFixed(3)}m
                  </div>
                </LiquidGlass>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="primary-action" onClick={exportForecastingCsv} style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.2)', color: 'var(--text-primary)' }}>
                  <Download size={14} /> Export Forecasting CSV
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SCENARIO BENCHMARK & CDF CURVE */}
      {/* ========================================================================= */}
      {activeTab === 'scenario' && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div className="experiment-matrix" style={{ margin: 0 }}>
              <span>4 ANCHORS</span>
              <span>0.55 M NOISE</span>
              <span>25% NLOS</span>
              <span>10% LOSS</span>
              <span>SEED 73</span>
            </div>
            <button className="primary-action" onClick={() => scenarioRun.mutate()} disabled={scenarioRun.isPending}>
              <FlaskConical size={14} />
              {scenarioRun.isPending ? 'Running 120 Frames…' : 'Run Scenario Benchmark'}
            </button>
          </div>

          {!results ? (
            <LiquidGlass className="experiment-empty">
              <h2>One Standardized Scenario. Three Estimators.</h2>
              <p>
                {scenarioRun.isPending
                  ? 'Evaluating Baseline, Robust, and LOCUS-ML across 120 deterministic unseen frames…'
                  : 'Run the scenario benchmark to calculate positioning RMSE, tail P90 error, and empirical Cumulative Distribution Function (CDF).'}
              </p>
            </LiquidGlass>
          ) : (
            <>
              <LiquidGlass className="chart-section">
                <div className="panel-bar" style={{ marginBottom: '14px' }}>
                  <span>POSITIONING RMSE (ROOT MEAN SQUARE ERROR)</span>
                  <span className="live">LOWER IS BETTER</span>
                </div>
                {results.map(r => (
                  <div className="bar-row" key={r.method}>
                    <span style={{ fontWeight: 600, color: methodColors[r.method] || 'var(--text-primary)' }}>{r.method}</span>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <i
                        style={{
                          width: `${(r.rmse / maxRmse) * 100}%`,
                          background: methodColors[r.method] || 'var(--cyan)',
                          display: 'block',
                          height: '100%',
                          borderRadius: '4px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                    <strong>{r.rmse.toFixed(3)} m</strong>
                  </div>
                ))}
              </LiquidGlass>

              <LiquidGlass className="result-table" style={{ marginTop: '18px', padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(9,24,34,0.92)', borderBottom: '1px solid var(--line)', color: 'var(--cyan)', font: '600 11px var(--mono)' }}>
                        <th style={{ padding: '12px 18px' }}>METHOD</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>RMSE</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>MEDIAN</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>P90 TAIL</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>AVAILABILITY</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>RUNTIME</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map(r => (
                        <tr key={r.method} style={{ borderBottom: '1px solid var(--line)', font: '12px var(--mono)' }}>
                          <td style={{ padding: '12px 18px' }}>
                            <strong style={{ color: methodColors[r.method] || 'var(--text-primary)' }}>{r.method}</strong>
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>{r.rmse.toFixed(3)} m</td>
                          <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.median !== undefined ? `${r.median.toFixed(3)} m` : '—'}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--text-secondary)' }}>{r.p90.toFixed(3)} m</td>
                          <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--lime)', fontWeight: 600 }}>{(r.availability * 100).toFixed(1)}%</td>
                          <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--text-muted)' }}>{r.runtime_ms.toFixed(2)} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </LiquidGlass>

              {/* CDF Graph */}
              <LiquidGlass style={{ marginTop: '18px', padding: '22px 24px' }}>
                <div className="panel-bar" style={{ marginBottom: '16px' }}>
                  <span>EMPIRICAL ERROR CDF (CUMULATIVE DISTRIBUTION FUNCTION)</span>
                  <span className="live">CURVE SHIFTING LEFT = SUPERIOR PRECISION</span>
                </div>
                <div style={{ position: 'relative', width: '100%', height: '220px' }}>
                  <svg viewBox="0 0 600 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {[0, 0.25, 0.5, 0.75, 1.0].map(p => {
                      const y = 180 - p * 160
                      return (
                        <g key={p}>
                          <line x1="45" y1={y} x2="580" y2={y} stroke="rgba(151,222,238,0.14)" strokeDasharray="3 3" />
                          <text x="38" y={y + 3.5} textAnchor="end" fill="var(--text-muted)" style={{ font: '10px var(--mono)', fontWeight: 500 }}>
                            {Math.round(p * 100)}%
                          </text>
                        </g>
                      )
                    })}
                    <line x1="45" y1="20" x2="45" y2="180" stroke="rgba(151,222,238,0.4)" strokeWidth="1.2" />
                    <line x1="45" y1="180" x2="580" y2="180" stroke="rgba(151,222,238,0.4)" strokeWidth="1.2" />
                    {results.map(r => {
                      if (!r.cdf || r.cdf.length === 0) return null
                      const cdfMax = 3.0
                      const points = r.cdf.map(pt => {
                        const x = 45 + Math.min(1.0, pt.error / cdfMax) * 535
                        const y = 180 - pt.probability * 160
                        return `${x.toFixed(1)},${y.toFixed(1)}`
                      }).join(' ')
                      return (
                        <polyline
                          key={`cdf-${r.method}`}
                          fill="none"
                          stroke={methodColors[r.method] || 'var(--cyan)'}
                          strokeWidth={r.method === 'LOCUS' ? '2.5' : '1.8'}
                          points={points}
                        />
                      )
                    })}
                  </svg>
                </div>
                <div style={{ display: 'flex', gap: '16px 24px', marginTop: '16px', justifyContent: 'center', font: '11px var(--mono)', flexWrap: 'wrap' }}>
                  {results.map(r => (
                    <div key={r.method} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '12px', height: '3px', background: methodColors[r.method] || 'var(--cyan)', borderRadius: '2px' }} />
                      <span style={{ color: methodColors[r.method] || 'var(--text-primary)', fontWeight: 600 }}>{r.method}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>P50: {r.median?.toFixed(2)}m · P90: {r.p90?.toFixed(2)}m</span>
                    </div>
                  ))}
                </div>
              </LiquidGlass>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="primary-action" onClick={exportScenarioCsv} style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.2)', color: 'var(--text-primary)' }}>
                  <Download size={14} /> Export Scenario CSV
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
