import { memo, useMemo } from 'react'
import type { Frame } from '../types'

export const SystemMap = memo(function SystemMap({ frame, compact = false }: { frame: Frame; compact?: boolean }) {
  // Proportional isotropic scale: 20x15m room mapped into 700x500 viewBox
  const roomW = 600
  const roomH = 450
  const X0 = 50
  const Y0 = 25
  const scale = roomW / frame.room.width // 30.0 px/m (isotropic: 450 / 15 = 30.0 px/m)

  const sx = (x: number) => X0 + x * scale
  const sy = (y: number) => Y0 + y * scale
  const pathD = (points: { x: number; y: number }[]) =>
    points.map((p, i) => `${i ? 'L' : 'M'} ${sx(p.x)} ${sy(p.y)}`).join(' ')

  const plannedPathD = useMemo(
    () => frame.path.map((p, i) => `${i ? 'L' : 'M'} ${X0 + p.x * scale} ${Y0 + p.y * scale}`).join(' '),
    [frame.path, scale, X0, Y0]
  )

  const uncertainty = Math.max(6, (frame.locus.uncertainty_radius || 0) * scale)
  const hasFiltered = frame.filtered && typeof frame.filtered.x === 'number'
  const hasForecast = frame.forecast && typeof frame.forecast.x === 'number'

  return (
    <div className={`map-shell ${compact ? 'map-compact' : ''}`} aria-label="Live indoor positioning map">
      <svg viewBox="0 0 700 500" role="img" aria-labelledby="map-title">
        <title id="map-title">
          Ground-truth and estimated target positions in a {frame.room.width} by {frame.room.height} metre room
        </title>
        <defs>
          <clipPath id="room-bounds">
            <rect x={X0} y={Y0} width={roomW} height={roomH} rx="2" />
          </clipPath>
          <pattern id="minor-grid" width={scale} height={scale} patternUnits="userSpaceOnUse">
            <path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke="#23303c" strokeWidth="0.7" />
          </pattern>
          <filter id="signal-blur">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        {/* Room boundary and 1m coordinate grid */}
        <rect x={X0} y={Y0} width={roomW} height={roomH} fill="#0b1117" stroke="rgba(142, 224, 246, 0.38)" strokeWidth="1.2" rx="2" />
        <rect x={X0} y={Y0} width={roomW} height={roomH} fill="url(#minor-grid)" opacity=".7" />

        {/* Clipped interior layers: trajectories, range circles, and uncertainty region */}
        <g clipPath="url(#room-bounds)">
          <path d={plannedPathD} fill="none" stroke="#51606e" strokeDasharray="4 8" strokeWidth="1.2" />
          <path d={pathD(frame.history_truth)} fill="none" stroke="#57dbf4" strokeWidth="2" opacity=".55" />
          <path d={pathD(frame.history_estimate)} fill="none" stroke="#c7fa65" strokeWidth="2.2" />

          {/* Range rings strictly clipped to the physical room interior */}
          {frame.anchors.map(a =>
            a.available && a.measured_range ? (
              <circle
                key={`range-${a.id}`}
                cx={sx(a.x)}
                cy={sy(a.y)}
                r={Math.max(4, a.measured_range * scale)}
                fill="none"
                stroke={a.reliability > 0.65 ? '#57dbf4' : '#f6bc5b'}
                strokeWidth="1"
                opacity="0.22"
              />
            ) : null
          )}

          {/* Model-derived 95% Chi-square Uncertainty Ellipse or Fallback Radius */}
          {frame.locus.uncertainty_major !== undefined && frame.locus.uncertainty_minor !== undefined ? (
            <ellipse
              cx={sx(frame.locus.x)}
              cy={sy(frame.locus.y)}
              rx={Math.max(6, frame.locus.uncertainty_major * scale)}
              ry={Math.max(4, frame.locus.uncertainty_minor * scale)}
              transform={`rotate(${-(frame.locus.uncertainty_angle_deg || 0)} ${sx(frame.locus.x)} ${sy(frame.locus.y)})`}
              fill="#c7fa65"
              opacity=".08"
              stroke="#c7fa65"
              strokeWidth="1.2"
              strokeDasharray="5 5"
            />
          ) : (
            <circle
              cx={sx(frame.locus.x)}
              cy={sy(frame.locus.y)}
              r={uncertainty}
              fill="#c7fa65"
              opacity=".08"
              stroke="#c7fa65"
              strokeDasharray="5 5"
            />
          )}

          {/* Forecast uncertainty region around predicted next position */}
          {hasForecast && frame.forecast.uncertainty_radius > 0 ? (
            <circle
              cx={sx(frame.forecast.x)}
              cy={sy(frame.forecast.y)}
              r={Math.max(5, frame.forecast.uncertainty_radius * scale)}
              fill="#a78bfa"
              opacity="0.09"
              stroke="#a78bfa"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          ) : null}

          {/* Forecast motion vector from filtered position to predicted next position */}
          {hasFiltered && hasForecast ? (
            <line
              x1={sx(frame.filtered.x)}
              y1={sy(frame.filtered.y)}
              x2={sx(frame.forecast.x)}
              y2={sy(frame.forecast.y)}
              stroke="#a78bfa"
              strokeWidth="1.8"
              strokeDasharray="4 3"
              opacity="0.85"
            />
          ) : null}
        </g>

        {/* Anchor nodes rendered at actual anchor coordinates */}
        {frame.anchors.map(a => (
          <g key={a.id} transform={`translate(${sx(a.x)} ${sy(a.y)})`}>
            <rect
              x="-11"
              y="-11"
              width="22"
              height="22"
              fill="#0e151c"
              stroke={a.available ? (a.reliability > 0.65 ? '#57dbf4' : '#f6bc5b') : '#fa7373'}
              rx="2"
            />
            <text x="0" y="3.5" textAnchor="middle" className="svg-label">
              {a.id.replace('A', '')}
            </text>
          </g>
        ))}

        {/* 1. Baseline estimator marker (amber circle) */}
        <circle cx={sx(frame.baseline.x)} cy={sy(frame.baseline.y)} r="6" fill="none" stroke="#f6bc5b" strokeWidth="2" />

        {/* 2. Ground-truth marker (cyan glow + dot) */}
        <circle cx={sx(frame.truth.x)} cy={sy(frame.truth.y)} r="9" fill="#57dbf4" opacity=".2" filter="url(#signal-blur)" />
        <circle cx={sx(frame.truth.x)} cy={sy(frame.truth.y)} r="4" fill="#57dbf4" />

        {/* 3. LOCUS Instantaneous measurement marker (lime diamond) */}
        <g transform={`translate(${sx(frame.locus.x)} ${sy(frame.locus.y)})`}>
          <path d="M 0 -9 L 9 0 L 0 9 L -9 0 Z" fill="#c7fa65" />
          <circle r="2.5" fill="#090c10" />
        </g>

        {/* 4. Filtered kinematic position marker (emerald ring + central dot) */}
        {hasFiltered && (
          <g transform={`translate(${sx(frame.filtered.x)} ${sy(frame.filtered.y)})`}>
            <circle r="6" fill="none" stroke="#38ef7d" strokeWidth="2" />
            <circle r="2" fill="#38ef7d" />
          </g>
        )}

        {/* 5. One-step-ahead predicted next position marker (purple filled dot + label) */}
        {hasForecast && (
          <g transform={`translate(${sx(frame.forecast.x)} ${sy(frame.forecast.y)})`}>
            <circle r="4.5" fill="#a78bfa" stroke="#ffffff" strokeWidth="1" />
            <text x="7" y="-5" fill="#c4b5fd" fontSize="9" fontFamily="monospace" fontWeight="700">
              +{frame.forecast.horizon_s}s
            </text>
          </g>
        )}

        {/* Axis scale markers */}
        <text x={X0 + 4} y={Y0 + roomH + 16} className="svg-axis">0 m</text>
        <text x={X0 + roomW - 28} y={Y0 + roomH + 16} className="svg-axis">{frame.room.width} m</text>
        <text x={X0 - 8} y={Y0 + 12} textAnchor="end" className="svg-axis">0 m</text>
        <text x={X0 - 8} y={Y0 + roomH - 2} textAnchor="end" className="svg-axis">{frame.room.height} m</text>
      </svg>
      <div className="map-legend">
        <span><i className="truth-dot" />TRUTH</span>
        <span><i className="locus-diamond" />LOCUS RAW</span>
        <span><i className="filtered-dot" />FILTERED</span>
        <span><i className="forecast-dot" />FORECAST (+0.2s)</span>
        <span><i className="base-ring" />BASELINE</span>
      </div>
    </div>
  )
})
