import { useMutation, useQuery } from '@tanstack/react-query'
import { BrainCircuit } from 'lucide-react'
import { api } from '../services/api'
import { LiquidGlass } from '../components/LiquidGlass'

export function Intelligence() {
  const status = useQuery({ queryKey:['ml-status'], queryFn: api.mlStatus })
  const train = useMutation({ mutationFn: api.train, onSuccess:()=>status.refetch() })
  const s = train.data || status.data
  return <div className="page intelligence-page lab-page"><header className="page-heading lab-heading"><div><span className="route-code">AI / RELIABILITY</span><h1>Signal Intelligence</h1><p>Deployment-safe features. No hidden simulator truth.</p></div><div className="run-id">MODEL {s?.status?.toUpperCase() || 'CHECKING'}</div></header>
    {(status.isError || train.isError) && <div className="inline-error"><span>{train.error instanceof Error ? train.error.message : status.error instanceof Error ? status.error.message : 'Model service unavailable.'}</span><button onClick={()=>train.isError ? train.mutate() : status.refetch()}>{train.isError ? 'Retry training' : 'Retry status'}</button></div>}
    <section className="ai-lab-layout">
      <LiquidGlass className="ai-visual" tone="dense"><div className="panel-bar"><span>FEATURE RESPONSE</span><span className="live">CAUSAL ONLY</span></div><div className="ai-orbit"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="ai-core"><BrainCircuit/><span>RELIABILITY</span></div>{['RANGE Δ','MOTION Δ','VARIANCE','PACKET LOSS'].map((v,i)=><span className={`feature-node node-${i+1}`} key={v}>{v}</span>)}</div></LiquidGlass>
      <LiquidGlass className="ai-controls" tone="clear"><div className="rail-heading"><span>MODEL CONTROLS</span><p>Training & validation</p></div><div className="model-readout"><span>STATE</span><strong>{s?.status?.toUpperCase() || 'CHECKING'}</strong></div><div className="model-readout"><span>VALIDATION</span><strong>{s?.accuracy ? `${(s.accuracy*100).toFixed(1)}%` : '—'}</strong></div><div className="model-readout"><span>SAMPLES</span><strong>{s?.samples || 0}</strong></div><button className="primary-action full-action" onClick={()=>train.mutate()} disabled={train.isPending}><BrainCircuit/>{train.isPending?'Training model suite':'Train model suite'}</button></LiquidGlass>
    </section>
    <section className="ai-evidence-grid"><LiquidGlass><span>ANOMALY MODEL</span><h2>Isolation Forest</h2><p>Flags unusual measurement behavior without using obstruction labels at inference time.</p></LiquidGlass><LiquidGlass><span>CLASSIFICATION</span><h2>Random Forest</h2><p>Returns a bounded probability of unreliable evidence—not a physical verdict.</p></LiquidGlass><LiquidGlass><span>EXPLANATION</span><h2>Feature attribution</h2><p>A2 is down-weighted when range change and motion disagreement dominate.</p></LiquidGlass></section>
  </div>
}
