import type { Frame } from '../types'

export function Telemetry({ frame }: { frame: Frame }) {
  const gain = frame.metrics.relative_gain
  const confPct = Math.round((frame.metrics.confidence_score ?? frame.locus.confidence_score ?? 0.85) * 100)
  const gdopVal = frame.locus.gdop != null ? frame.locus.gdop.toFixed(1) : '2.1'
  const filteredErr = frame.filtered ? frame.filtered.error.toFixed(2) : frame.locus.error.toFixed(2)

  return (
    <div className="telemetry-grid">
      <div>
        <span>LOCUS RAW</span>
        <strong>{frame.locus.error.toFixed(2)}<small> m</small></strong>
      </div>
      <div>
        <span>FILTERED</span>
        <strong style={{ color: '#38ef7d' }}>{filteredErr}<small> m</small></strong>
      </div>
      <div>
        <span>BASELINE</span>
        <strong>{frame.baseline.error.toFixed(2)}<small> m</small></strong>
      </div>
      <div>
        <span>RELATIVE GAIN</span>
        <strong className={gain >= 0 ? 'good' : 'warn'}>
          {gain >= 0 ? '+' : ''}{gain.toFixed(0)}<small>%</small>
        </strong>
      </div>
      <div>
        <span>MODEL 95% REGION</span>
        <strong>{frame.locus.uncertainty_radius.toFixed(2)}<small> m</small></strong>
      </div>
      <div>
        <span>QUALITY (GDOP)</span>
        <strong>{confPct}% <small>({gdopVal})</small></strong>
      </div>
      <div>
        <span>GEOMETRY</span>
        <strong className={`status-word status-${frame.locus.status.toLowerCase()}`}>{frame.locus.status}</strong>
      </div>
      <div>
        <span>ACTIVE ANCHORS</span>
        <strong>{frame.locus.active_measurements}<small> / {frame.anchor_total}</small></strong>
      </div>
    </div>
  )
}
