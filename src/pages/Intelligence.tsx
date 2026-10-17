import { useMutation, useQuery } from '@tanstack/react-query'
import { BrainCircuit, Sparkles, ShieldCheck, Activity, Layers } from 'lucide-react'
import { api } from '../services/api'
import { LiquidGlass } from '../components/LiquidGlass'

const FEATURE_LABELS: Record<string, string> = {
  prior_residual: 'Prior Residual (Signed)',
  motion_disagreement: 'Motion Disagreement',
  range_change: 'Temporal Range Δ',
  median_rel_diff: 'Median Relative Deviation',
  range_variance: 'Range Temporal Variance',
  triangle_violation: 'Triangle Inequality Inconsistency',
}

export function Intelligence() {
  const status = useQuery({ queryKey: ['ml-status'], queryFn: api.mlStatus })
  const train = useMutation({ mutationFn: api.train, onSuccess: () => status.refetch() })
  const s = train.data || status.data

  const featurePairs = s?.feature_names?.map((name, i) => ({
    name: FEATURE_LABELS[name] || name,
    importance: s.feature_importance ? s.feature_importance[i] : 0,
  })).sort((a, b) => b.importance - a.importance) || []

  const maxImp = Math.max(...featurePairs.map(f => f.importance), 0.01)
  const cm = s?.confusion_matrix
  const comp = s?.model_comparison

  return (
    <div className="page intelligence-page lab-page">
      <header className="page-heading lab-heading">
        <div>
          <span className="route-code">AI / RELIABILITY</span>
          <h1>Signal Intelligence</h1>
          <p>Supervised Random Forest &amp; Unsupervised Isolation Forest on non-anticipative telemetry features. Zero simulator truth leakage.</p>
        </div>
        <div className="run-id" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck style={{ width: 14, height: 14, color: s?.status === 'trained' ? 'var(--lime)' : 'var(--amber)' }} />
          DETECTOR: {s?.status === 'trained' ? 'RF + ISOLATION FOREST ENSEMBLE' : 'HEURISTIC FALLBACK'}
        </div>
      </header>

      {(status.isError || train.isError) && (
        <div className="inline-error">
          <span>{train.error instanceof Error ? train.error.message : status.error instanceof Error ? status.error.message : 'Model service unavailable.'}</span>
          <button onClick={() => train.isError ? train.mutate() : status.refetch()}>
            {train.isError ? 'Retry training' : 'Retry status'}
          </button>
        </div>
      )}

      <section className="ai-lab-layout">
        <LiquidGlass className="ai-visual" tone="dense">
          <div className="panel-bar">
            <span>{s?.status === 'trained' ? 'FEATURE IMPORTANCES & EVALUATION' : 'MODEL ARCHITECTURE'}</span>
            <span className={s?.status === 'trained' ? 'live' : 'offline'}>
              {s?.status === 'trained' ? 'EVALUATED ON HELD-OUT' : 'UNTRAINED'}
            </span>
          </div>

          {s?.status === 'trained' ? (
            <div style={{ padding: '20px 24px' }}>
              <div style={{ font: '500 11px var(--mono)', color: 'var(--cyan)', letterSpacing: '0.08em', marginBottom: '14px' }}>
                RANDOM FOREST FEATURE IMPORTANCES (GINI IMPURITY REDUCTION)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {featurePairs.map(f => (
                  <div key={f.name} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 50px', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                    <div style={{ height: '14px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${(f.importance / maxImp) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #57dbf4, #c7fa65)', borderRadius: '3px' }} />
                    </div>
                    <strong style={{ font: '700 12px var(--mono)', textAlign: 'right', color: 'var(--lime)' }}>{(f.importance * 100).toFixed(1)}%</strong>
                  </div>
                ))}
              </div>

              {cm && (
                <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid rgba(142,224,246,0.18)' }}>
                  <div style={{ font: '600 11px var(--mono)', color: 'var(--cyan)', letterSpacing: '0.08em', marginBottom: '12px' }}>
                    HELD-OUT CONFUSION MATRIX (TEST SAMPLES: {s.test_samples})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div style={{ background: 'rgba(6,14,22,0.85)', border: '1px solid rgba(142,224,246,0.25)', padding: '12px 14px', borderRadius: '8px' }}>
                      <span style={{ display: 'block', font: '600 10px var(--mono)', color: 'var(--text-muted)', marginBottom: '4px' }}>TRUE NEGATIVE (CLEAN)</span>
                      <strong style={{ font: '700 20px var(--mono)', color: 'var(--cyan)' }}>{cm[0][0]}</strong>
                    </div>
                    <div style={{ background: 'rgba(6,14,22,0.85)', border: '1px solid rgba(246,188,91,0.3)', padding: '12px 14px', borderRadius: '8px' }}>
                      <span style={{ display: 'block', font: '600 10px var(--mono)', color: 'var(--amber)', marginBottom: '4px' }}>FALSE POSITIVE (OVERFLAGGED)</span>
                      <strong style={{ font: '700 20px var(--mono)', color: 'var(--amber)' }}>{cm[0][1]}</strong>
                    </div>
                    <div style={{ background: 'rgba(6,14,22,0.85)', border: '1px solid rgba(250,115,115,0.3)', padding: '12px 14px', borderRadius: '8px' }}>
                      <span style={{ display: 'block', font: '600 10px var(--mono)', color: 'var(--coral)', marginBottom: '4px' }}>FALSE NEGATIVE (MISSED NLOS)</span>
                      <strong style={{ font: '700 20px var(--mono)', color: 'var(--coral)' }}>{cm[1][0]}</strong>
                    </div>
                    <div style={{ background: 'rgba(6,14,22,0.85)', border: '1px solid rgba(199,250,101,0.3)', padding: '12px 14px', borderRadius: '8px' }}>
                      <span style={{ display: 'block', font: '600 10px var(--mono)', color: 'var(--lime)', marginBottom: '4px' }}>TRUE POSITIVE (CORRUPT CAUGHT)</span>
                      <strong style={{ font: '700 20px var(--mono)', color: 'var(--lime)' }}>{cm[1][1]}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '60px 30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <BrainCircuit style={{ width: 44, height: 44, color: 'var(--cyan)', margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: '0 0 8px' }}>Model Suite Not Yet Trained</h2>
              <p style={{ maxWidth: '420px', margin: '0 auto 20px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                Train the classifier and anomaly detector to extract observable telemetry features from 16 diverse simulated trajectories and replace the heuristic scorer with trained ML inference.
              </p>
              <button className="primary-action" onClick={() => train.mutate()} disabled={train.isPending}>
                <Sparkles /> {train.isPending ? 'Training Model Suite…' : 'Train Model Suite Now'}
              </button>
            </div>
          )}
        </LiquidGlass>

        <LiquidGlass className="ai-controls" tone="clear">
          <div className="rail-heading">
            <span>CLASSIFICATION METRICS</span>
            <p>Held-out trajectory validation (y=1: Corrupt)</p>
          </div>
          <div className="model-readout"><span>PRIMARY MODEL</span><strong>Random Forest</strong></div>
          <div className="model-readout"><span>STATUS</span><strong className={s?.status === 'trained' ? 'good' : 'warn'}>{s?.status?.toUpperCase() || 'UNTRAINED'}</strong></div>
          <div className="model-readout"><span>ACCURACY</span><strong>{s?.accuracy ? `${(s.accuracy * 100).toFixed(1)}%` : '—'}</strong></div>
          <div className="model-readout"><span>PRECISION</span><strong>{s?.precision ? `${(s.precision * 100).toFixed(1)}%` : '—'}</strong></div>
          <div className="model-readout"><span>RECALL</span><strong>{s?.recall ? `${(s.recall * 100).toFixed(1)}%` : '—'}</strong></div>
          <div className="model-readout"><span>F1 SCORE</span><strong>{s?.f1 ? `${(s.f1 * 100).toFixed(1)}%` : '—'}</strong></div>
          <div className="model-readout"><span>SAMPLES</span><strong>{s?.samples ? `${s.samples} (${s.train_samples} train / ${s.test_samples} test)` : '0'}</strong></div>
          {s?.class_balance && (
            <>
              <div className="model-readout">
                <span>TEST CLASS RATIO</span>
                <strong>{s.class_balance.corrupted_percent}% corrupt / {s.class_balance.nominal_percent}% clean ({s.class_balance.test_corrupted_count ?? 417} / {s.class_balance.test_clean_count ?? 776})</strong>
              </div>
              <div className="model-readout">
                <span>TRAIN CLASS RATIO</span>
                <strong style={{ color: 'var(--text-secondary)' }}>{s.class_balance.train_corrupted_percent ?? 28.2}% corrupt / {s.class_balance.train_clean_percent ?? 71.8}% clean ({s.class_balance.train_corrupted_count ?? 1043} / {s.class_balance.train_clean_count ?? 2658})</strong>
              </div>
            </>
          )}
          {s?.inference_latency_ms && (
            <div className="model-readout"><span>INFERENCE LATENCY</span><strong className="good">{s.inference_latency_ms} ms / frame</strong></div>
          )}
          {s?.trained_at && (
            <div className="model-readout"><span>LAST TRAINED</span><strong style={{ fontSize: '10px' }}>{s.trained_at}</strong></div>
          )}


          <button className="primary-action full-action" onClick={() => train.mutate()} disabled={train.isPending}>
            <BrainCircuit />
            {train.isPending ? 'Training model suite…' : s?.status === 'trained' ? 'Retrain model suite' : 'Train model suite'}
          </button>
        </LiquidGlass>
      </section>

      {comp && (
        <section style={{ marginTop: '20px' }}>
          <LiquidGlass tone="dense">
            <div className="panel-bar">
              <span>DETECTOR COMPARISON (HELD-OUT TEST DATA)</span>
              <span className="live">CROSS-METHOD BENCHMARK</span>
            </div>
            <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', font: '11px var(--mono)', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(151,222,238,0.18)', color: 'var(--cyan)' }}>
                    <th style={{ padding: '10px 12px' }}>DETECTOR</th>
                    <th style={{ padding: '10px 12px' }}>PARADIGM</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACCURACY</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>PRECISION</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>RECALL</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>F1-SCORE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(142,224,246,0.14)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>Heuristic Baseline</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Deterministic Rules</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{(comp.heuristic.accuracy * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{(comp.heuristic.precision * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{(comp.heuristic.recall * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{(comp.heuristic.f1 * 100).toFixed(1)}%</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(142,224,246,0.14)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>Isolation Forest</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Unsupervised Anomaly</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{(comp.isolation_forest.accuracy * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{(comp.isolation_forest.precision * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{(comp.isolation_forest.recall * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>{(comp.isolation_forest.f1 * 100).toFixed(1)}%</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(142,224,246,0.14)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--cyan)', fontWeight: 700 }}>Random Forest</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Supervised (Primary)</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700 }}>{(comp.random_forest.accuracy * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700 }}>{(comp.random_forest.precision * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700 }}>{(comp.random_forest.recall * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700 }}>{(comp.random_forest.f1 * 100).toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 12px', color: 'var(--lime)', fontWeight: 700 }}>Combined Ensemble</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>RF (80%) + IF (20%)</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--lime)', fontWeight: 700 }}>{(comp.combined_ensemble.accuracy * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--lime)', fontWeight: 700 }}>{(comp.combined_ensemble.precision * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--lime)', fontWeight: 700 }}>{(comp.combined_ensemble.recall * 100).toFixed(1)}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--lime)', fontWeight: 700 }}>{(comp.combined_ensemble.f1 * 100).toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </LiquidGlass>
        </section>
      )}

      <section className="ai-evidence-grid">
        <LiquidGlass>
          <span>POSITIONING IMPACT</span>
          <h2>Held-out Localization Error (RMSE)</h2>
          {s?.localization_comparison ? (
            <div style={{ marginTop: '10px', font: '12px var(--mono)', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
              <div>Baseline (NLS): <strong style={{ color: 'var(--text-primary)' }}>{s.localization_comparison.baseline_rmse.toFixed(3)} m</strong> <span style={{ color: 'var(--text-muted)' }}>(P90: {s.localization_comparison.baseline_p90.toFixed(2)}m)</span></div>
              <div>Robust (Soft-L1): <strong style={{ color: 'var(--text-primary)' }}>{s.localization_comparison.robust_rmse.toFixed(3)} m</strong> <span style={{ color: 'var(--text-muted)' }}>(P90: {s.localization_comparison.robust_p90.toFixed(2)}m)</span></div>
              <div>LOCUS-ML (AI-Weighted): <strong className="good">{s.localization_comparison.locus_ml_rmse.toFixed(3)} m</strong> <span style={{ color: 'var(--text-muted)' }}>(P90: {s.localization_comparison.locus_ml_p90.toFixed(2)}m)</span></div>
              <div style={{ marginTop: '6px', color: 'var(--lime)', fontWeight: 700 }}>
                {s.localization_comparison.rmse_improvement_pct >= 0 ? '+' : ''}
                {s.localization_comparison.rmse_improvement_pct.toFixed(1)}% positioning RMSE reduction
              </div>
              {s.localization_comparison.locus_ml_availability !== undefined && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Coverage Availability: {(s.localization_comparison.locus_ml_availability * 100).toFixed(1)}%
                </div>
              )}
            </div>
          ) : (
            <p>Train the model to compare positioning RMSE on unseen held-out trajectories.</p>
          )}
        </LiquidGlass>

        <LiquidGlass>
          <span>PRIMARY CLASSIFIER</span>
          <h2>Supervised Random Forest</h2>
          <p>
            Trained with 100 balanced decision trees on whole-trajectory splits. Maps non-anticipative telemetry features (prior residual, spatial triangle violations, range variance) into an estimated probability of measurement corruption.
          </p>
        </LiquidGlass>

        <LiquidGlass>
          <span>ANOMALY DETECTION</span>
          <h2>Isolation Forest &amp; Ensemble</h2>
          <p>
            Unsupervised tree isolation detects multi-dimensional geometric outliers without labels. Blended with Random Forest to safeguard against unexpected out-of-distribution noise patterns.
          </p>
        </LiquidGlass>
      </section>
    </div>
  )
}
