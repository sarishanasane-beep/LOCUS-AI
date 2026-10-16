import type { Frame } from '../types'

export function SystemMap({ frame, compact = false }: { frame: Frame; compact?: boolean }) {
  const sx = (x: number) => 28 + (x / frame.room.width) * 644
  const sy = (y: number) => 28 + (y / frame.room.height) * 441
  const pathD = (points: {x:number;y:number}[]) => points.map((p, i) => `${i ? 'L' : 'M'} ${sx(p.x)} ${sy(p.y)}`).join(' ')
  const uncertainty = Math.max(9, frame.locus.uncertainty_radius * 18)
  return <div className={`map-shell ${compact ? 'map-compact' : ''}`} aria-label="Live indoor positioning map">
    <svg viewBox="0 0 700 500" role="img" aria-labelledby="map-title">
      <title id="map-title">Ground-truth and estimated target positions in a {frame.room.width} by {frame.room.height} metre room</title>
      <defs>
        <pattern id="minor-grid" width="32.2" height="29.4" patternUnits="userSpaceOnUse"><path d="M 32.2 0 L 0 0 0 29.4" fill="none" stroke="#23303c" strokeWidth="0.7" /></pattern>
        <filter id="signal-blur"><feGaussianBlur stdDeviation="8" /></filter>
      </defs>
      <rect x="28" y="28" width="644" height="441" fill="#0b1117" stroke="#42505d" />
      <rect x="28" y="28" width="644" height="441" fill="url(#minor-grid)" opacity=".7" />
      <path d={pathD(frame.path)} fill="none" stroke="#51606e" strokeDasharray="4 8" strokeWidth="1.2" />
      <path d={pathD(frame.history_truth)} fill="none" stroke="#57dbf4" strokeWidth="2" opacity=".55" />
      <path d={pathD(frame.history_estimate)} fill="none" stroke="#c7fa65" strokeWidth="2.2" />
      {frame.anchors.map(a => <g key={a.id} transform={`translate(${sx(a.x)} ${sy(a.y)})`}>
        {a.available && <circle r={Math.max(12, (a.measured_range || 0) * 10)} fill="none" stroke={a.reliability > .65 ? '#57dbf4' : '#f6bc5b'} strokeWidth=".7" opacity=".14" />}
        <rect x="-11" y="-11" width="22" height="22" fill="#0e151c" stroke={a.available ? (a.reliability > .65 ? '#57dbf4' : '#f6bc5b') : '#fa7373'} />
        <text x="0" y="3.5" textAnchor="middle" className="svg-label">{a.id.replace('A','')}</text>
      </g>)}
      <ellipse cx={sx(frame.locus.x)} cy={sy(frame.locus.y)} rx={uncertainty} ry={uncertainty * .68} fill="#c7fa65" opacity=".06" stroke="#c7fa65" strokeDasharray="5 5" />
      <circle cx={sx(frame.baseline.x)} cy={sy(frame.baseline.y)} r="6" fill="none" stroke="#f6bc5b" strokeWidth="2" />
      <circle cx={sx(frame.truth.x)} cy={sy(frame.truth.y)} r="9" fill="#57dbf4" opacity=".2" filter="url(#signal-blur)" />
      <circle cx={sx(frame.truth.x)} cy={sy(frame.truth.y)} r="4" fill="#57dbf4" />
      <g transform={`translate(${sx(frame.locus.x)} ${sy(frame.locus.y)})`}><path d="M 0 -9 L 9 0 L 0 9 L -9 0 Z" fill="#c7fa65" /><circle r="2.5" fill="#090c10" /></g>
      <text x="38" y="454" className="svg-axis">0 m</text><text x="634" y="454" className="svg-axis">{frame.room.width} m</text>
    </svg>
    <div className="map-legend"><span><i className="truth-dot" />TRUTH</span><span><i className="locus-diamond" />LOCUS</span><span><i className="base-ring" />BASELINE</span></div>
  </div>
}
