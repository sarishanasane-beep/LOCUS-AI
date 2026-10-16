import type { Frame } from '../types'

export function Telemetry({ frame }: { frame: Frame }) {
  const gain = frame.metrics.relative_gain
  return <div className="telemetry-grid">
    <div><span>LOCUS ERROR</span><strong>{frame.locus.error.toFixed(2)}<small> m</small></strong></div>
    <div><span>BASELINE</span><strong>{frame.baseline.error.toFixed(2)}<small> m</small></strong></div>
    <div><span>RELATIVE GAIN</span><strong className={gain >= 0 ? 'good' : 'warn'}>{gain >= 0 ? '+' : ''}{gain.toFixed(0)}<small>%</small></strong></div>
    <div><span>90% REGION</span><strong>{frame.locus.uncertainty_radius.toFixed(2)}<small> m</small></strong></div>
    <div><span>GEOMETRY</span><strong className={`status-word status-${frame.locus.status.toLowerCase()}`}>{frame.locus.status}</strong></div>
    <div><span>ACTIVE</span><strong>{frame.locus.active_measurements}<small> / {frame.anchor_total}</small></strong></div>
  </div>
}
