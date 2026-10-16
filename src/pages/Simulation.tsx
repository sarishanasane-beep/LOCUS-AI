import { useEffect } from 'react'
import { Pause, Play, RotateCcw, StepForward } from 'lucide-react'
import { useSimulation } from '../store/simulation'
import { SystemMap } from '../components/SystemMap'
import { Telemetry } from '../components/Telemetry'
import { LiquidGlass } from '../components/LiquidGlass'

export function Simulation() {
  const sim = useSimulation()
  useEffect(() => { sim.initialize() }, [])
  if (sim.error && !sim.frame) return <EngineError message={sim.error} retry={sim.initialize} />
  if (!sim.frame) return <Loading label="Establishing deterministic scenario" />
  const f = sim.frame
  return <div className="page page-simulation lab-page">
    {sim.error && <div className="inline-error"><span>{sim.error}</span><button onClick={() => sim.initialize(true)}>Reconnect</button></div>}
    <header className="page-heading lab-heading"><div><span className="route-code">SIM / REAL-TIME</span><h1>Positioning Lab</h1><p>Stress the estimator. Read the evidence. Reproduce the result.</p></div><div className="run-id">SEED {f.config.seed} · T+{f.timestamp.toFixed(1)}S</div></header>
    <div className="lab-layout">
      <LiquidGlass className="map-panel" tone="dense"><div className="panel-bar"><span>LIVE FLOOR MODEL · {f.room.width} × {f.room.height} M</span><span className={sim.connected ? 'live' : 'offline'}>{sim.connected ? 'STREAMING' : 'RECONNECTING'}</span></div><SystemMap frame={f} /></LiquidGlass>
      <LiquidGlass className="control-rail" tone="clear">
        <div className="rail-heading"><span>MODEL CONTROLS</span><p>Measurement conditions</p></div>
        <div className="control-actions">
          <button className="primary-action" onClick={() => sim.command(sim.playing ? 'pause' : 'play')}>{sim.playing ? <Pause/> : <Play/>}{sim.playing ? 'Pause stream' : 'Play scenario'}</button>
          <button aria-label="Step once" onClick={() => sim.command('step')}><StepForward /></button>
          <button aria-label="Reset scenario" onClick={() => sim.command('reset')}><RotateCcw /></button>
        </div>
        <Control label="GAUSSIAN NOISE" value={f.config.noise} min={0.05} max={1.5} step={0.05} suffix="m" onChange={noise => sim.configure({ noise })} />
        <Control label="NLOS CONTAMINATION" value={f.config.nlos_probability} min={0} max={0.7} step={0.05} percent onChange={nlos_probability => sim.configure({ nlos_probability })} />
        <Control label="PACKET LOSS" value={f.config.missing_probability} min={0} max={0.65} step={0.05} percent onChange={missing_probability => sim.configure({ missing_probability })} />
        <div className="anchor-table"><div className="table-title">ANCHOR EVIDENCE · CLICK TO FAIL</div>{f.anchors.map(a => <button className="anchor-row" key={a.id} onClick={() => sim.configure({ disabled_anchors: f.config.disabled_anchors.includes(a.id) ? f.config.disabled_anchors.filter(id => id !== a.id) : [...f.config.disabled_anchors, a.id] })} aria-label={`${f.config.disabled_anchors.includes(a.id) ? 'Recover' : 'Disable'} ${a.id}`}>
          <span className="anchor-name">{a.id}</span><span>{a.available ? `${a.measured_range?.toFixed(2)} m` : f.config.disabled_anchors.includes(a.id) ? 'DISABLED' : 'NO PACKET'}</span><span className={a.reliability > .65 ? 'good' : a.available ? 'warn' : 'critical'}>{a.available ? `${Math.round(a.reliability*100)}%` : 'OFF'}</span>
        </button>)}</div>
        <p className="control-note">Changes are applied to the measurement generator and all estimators on the next frame.</p>
      </LiquidGlass>
    </div>
    <Telemetry frame={f} />
  </div>
}

function Control({ label, value, min, max, step, suffix, percent, onChange }: { label:string;value:number;min:number;max:number;step:number;suffix?:string;percent?:boolean;onChange:(n:number)=>void }) {
  return <label className="range-control"><span>{label}<b>{percent ? Math.round(value*100)+'%' : value.toFixed(2)+suffix}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /></label>
}
export function Loading({label}:{label:string}) { return <div className="loading-state"><div className="scan-line"/><span>{label}</span></div> }
export function EngineError({message,retry}:{message:string;retry:()=>void}) { return <div className="empty-state"><h2>Positioning engine offline</h2><p>{message} Start the FastAPI service, then reconnect.</p><button onClick={retry}>Reconnect engine</button></div> }
