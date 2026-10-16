import { useMutation } from '@tanstack/react-query'
import { Download, FlaskConical } from 'lucide-react'
import { api } from '../services/api'
import { LiquidGlass } from '../components/LiquidGlass'

export function Analytics() {
  const run = useMutation({ mutationFn: () => api.experiment({ noise: .55, nlos_probability: .25, missing_probability: .1, seed: 73 }) })
  const results = run.data?.results
  const max = Math.max(...(results?.map(r => r.rmse) || [1]))
  const exportCsv = () => { if(!results)return; const blob=new Blob(['method,rmse,p90,availability,runtime_ms\n'+results.map(r=>`${r.method},${r.rmse},${r.p90},${r.availability},${r.runtime_ms}`).join('\n')],{type:'text/csv'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='locus-experiment.csv';a.click() }
  return <div className="page"><header className="page-heading"><div><h1>Accuracy & Validation</h1><p>Held-out trajectories. Same measurements. Honest comparisons.</p></div><button className="primary-action" onClick={()=>run.mutate()} disabled={run.isPending}><FlaskConical/>{run.isPending?'Running 120 frames':'Run benchmark'}</button></header>
    {run.isError && <div className="inline-error"><span>{run.error instanceof Error ? run.error.message : 'Benchmark failed.'}</span><button onClick={()=>run.mutate()}>Retry benchmark</button></div>}
    {!results ? <section className="experiment-empty"><div className="experiment-matrix"><span>4 ANCHORS</span><span>0.55 M NOISE</span><span>25% NLOS</span><span>10% LOSS</span></div><h2>One scenario. Three estimators.</h2><p>{run.isPending ? 'Computing all estimators across the held-out trajectory…' : 'Run the benchmark to calculate RMSE, tail error, availability, and runtime from a deterministic unseen trajectory.'}</p></section> : <>
      <LiquidGlass className="chart-section"><div className="section-label">RMSE · LOWER IS BETTER</div>{results.map(r=><div className="bar-row" key={r.method}><span>{r.method}</span><div><i style={{width:`${(r.rmse/max)*100}%`}} /></div><strong>{r.rmse.toFixed(3)} m</strong></div>)}</LiquidGlass>
      <LiquidGlass className="result-table"><div className="table-head"><span>METHOD</span><span>RMSE</span><span>P90</span><span>AVAILABILITY</span><span>RUNTIME</span></div>{results.map(r=><div key={r.method}><strong>{r.method}</strong><span>{r.rmse.toFixed(3)} m</span><span>{r.p90.toFixed(3)} m</span><span>{(r.availability*100).toFixed(1)}%</span><span>{r.runtime_ms.toFixed(2)} ms</span></div>)}</LiquidGlass>
      <button onClick={exportCsv}><Download/> Export computed CSV</button>
    </>}
  </div>
}
