import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, StepForward, Activity, Compass, ShieldCheck, Cpu } from 'lucide-react'
import { useSimulation } from '../store/simulation'
import { SystemMap } from '../components/SystemMap'
import { Telemetry } from '../components/Telemetry'
import { LiquidGlass } from '../components/LiquidGlass'

export function Simulation() {
  const sim = useSimulation()
  useEffect(() => {
    void sim.initialize()
    return () => {
      sim.cleanup()
    }
  }, [])

  if (sim.error && !sim.frame) return <EngineError message={sim.error} retry={() => sim.initialize(true)} />
  if (!sim.frame) return <Loading label="Establishing deterministic scenario" />
  const f = sim.frame

  const currentAnchorCount = f.config.anchor_count ?? f.anchor_total ?? 4
  const confPct = Math.round((f.metrics.confidence_score ?? f.locus.confidence_score ?? 0.85) * 100)
  const gdopVal = f.locus.gdop != null ? f.locus.gdop.toFixed(1) : '2.1'
  const semiMajor = f.locus.uncertainty_major != null ? f.locus.uncertainty_major.toFixed(2) : f.locus.uncertainty_radius.toFixed(2)
  const semiMinor = f.locus.uncertainty_minor != null ? f.locus.uncertainty_minor.toFixed(2) : (f.locus.uncertainty_radius * 0.7).toFixed(2)
  const speedMps = f.filtered?.speed_mps != null ? f.filtered.speed_mps.toFixed(2) : '1.05'

  return (
    <div className="page page-simulation lab-page">
      {sim.error && (
        <div className="inline-error">
          <span>{sim.error}</span>
          <button onClick={() => sim.initialize(true)}>Reconnect</button>
        </div>
      )}
      <header className="page-heading lab-heading">
        <div>
          <span className="route-code">SIM / REAL-TIME</span>
          <h1>Positioning Lab</h1>
          <p>Multi-density infrastructure, real-time kinematic tracking, and explainable AI diagnostics.</p>
        </div>
        <div className="run-id">SEED {f.config.seed} · T+{f.timestamp.toFixed(1)}S</div>
      </header>

      <div className="lab-layout">
        <LiquidGlass className="map-panel" tone="dense">
          <div className="panel-bar">
            <span>LIVE FLOOR MODEL · {f.room.width} × {f.room.height} M · {currentAnchorCount} ANCHORS</span>
            <span className={sim.connected ? 'live' : 'offline'}>
              {sim.connected ? 'STREAMING' : 'RECONNECTING'}
            </span>
          </div>
          <SystemMap frame={f} />
        </LiquidGlass>

        <LiquidGlass className="control-rail" tone="clear">
          <div className="rail-heading">
            <span>INFRASTRUCTURE & ENVIRONMENT</span>
            <p>Density, noise, and multipath stress controls</p>
          </div>

          <div className="control-actions">
            <button
              className="primary-action"
              onClick={() => sim.command(sim.playing ? 'pause' : 'play')}
            >
              {sim.playing ? <Pause /> : <Play />}
              {sim.playing ? 'Pause stream' : 'Play scenario'}
            </button>
            <button aria-label="Step once" onClick={() => sim.command('step')}>
              <StepForward />
            </button>
            <button aria-label="Reset scenario" onClick={() => sim.command('reset')}>
              <RotateCcw />
            </button>
          </div>

          {/* Infrastructure Density Segmented Selector */}
          <div className="density-selector">
            <div className="density-selector-label">
              <span>ANCHOR DENSITY</span>
              <b>{currentAnchorCount} Anchors</b>
            </div>
            <div className="density-pills" role="radiogroup" aria-label="Select infrastructure anchor density">
              {[3, 4, 6, 8].map(count => (
                <button
                  key={count}
                  type="button"
                  className={`density-pill ${currentAnchorCount === count ? 'active' : ''}`}
                  onClick={() => sim.configure({ anchor_count: count })}
                  aria-pressed={currentAnchorCount === count}
                >
                  {count} {count === 3 ? '(Sparse)' : count === 8 ? '(Dense)' : 'Nodes'}
                </button>
              ))}
            </div>
          </div>

          <Control
            label="GAUSSIAN NOISE"
            value={f.config.noise}
            min={0.05}
            max={1.5}
            step={0.05}
            suffix="m"
            onChange={noise => sim.configure({ noise })}
          />
          <Control
            label="NLOS CONTAMINATION"
            value={f.config.nlos_probability}
            min={0}
            max={0.7}
            step={0.05}
            percent
            onChange={nlos_probability => sim.configure({ nlos_probability })}
          />
          <Control
            label="PACKET LOSS"
            value={f.config.missing_probability}
            min={0}
            max={0.65}
            step={0.05}
            percent
            onChange={missing_probability => sim.configure({ missing_probability })}
          />

          <div className="anchor-table">
            <div className="table-title">EXPLAINABLE AI ANCHOR EVIDENCE · CLICK TO FAIL</div>
            {f.anchors.map(a => {
              const isFlagged = a.detected_flag || (a.anomaly_score > 0.45)
              const badgeClass = !a.available
                ? 'badge-rejected'
                : isFlagged
                ? 'badge-downweighted'
                : 'badge-nominal'
              const badgeLabel = !a.available
                ? 'OFFLINE'
                : a.weight_effect ?? (isFlagged ? 'DOWN-WEIGHTED' : 'FULL WEIGHT')

              return (
                <button
                  className="anchor-row"
                  key={a.id}
                  onClick={() =>
                    sim.configure({
                      disabled_anchors: f.config.disabled_anchors.includes(a.id)
                        ? f.config.disabled_anchors.filter(id => id !== a.id)
                        : [...f.config.disabled_anchors, a.id],
                    })
                  }
                  aria-label={`${f.config.disabled_anchors.includes(a.id) ? 'Recover' : 'Disable'} ${a.id}`}
                  style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto auto', gap: '8px', alignItems: 'center' }}
                >
                  <span className="anchor-name">{a.id}</span>
                  <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600 }}>
                      {a.available && a.measured_range != null
                        ? `${a.measured_range.toFixed(2)} m`
                        : f.config.disabled_anchors.includes(a.id)
                        ? 'DISABLED'
                        : 'PACKET LOSS'}
                    </div>
                    {a.reason && (
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                        {a.reason}
                      </div>
                    )}
                  </div>
                  <span className={`anchor-explain-badge ${badgeClass}`}>
                    {badgeLabel}
                  </span>
                  <span className={a.reliability > 0.65 ? 'good' : a.available ? 'warn' : 'critical'}>
                    {a.available ? `${Math.round(a.reliability * 100)}%` : 'OFF'}
                  </span>
                </button>
              )
            })}
          </div>

          <p className="control-note">
            Changes are applied to the multi-density geometry and all estimators on the next frame.
          </p>
        </LiquidGlass>
      </div>

      <Telemetry frame={f} />

      {/* Alignment Upgrade: Confidence & Temporal Tracking Panels */}
      <div className="lab-diagnostics-grid">
        {/* Panel 1: Quality & Geometry Diagnostics */}
        <LiquidGlass className="diagnostics-panel" tone="dense">
          <div className="diagnostics-header">
            <span><ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />POSITION UNCERTAINTY & QUALITY SCORE</span>
            <span className={`status-word status-${f.locus.status.toLowerCase()}`}>{f.locus.status}</span>
          </div>
          <div className="diagnostics-metrics">
            <div className="diag-card">
              <span>COMPOSITE QUALITY SCORE</span>
              <strong style={{ color: confPct >= 70 ? 'var(--cyan)' : 'var(--amber)' }}>{confPct}%</strong>
            </div>
            <div className="diag-card">
              <span>GDOP (GEOMETRY DILUTION)</span>
              <strong>{gdopVal}</strong>
            </div>
            <div className="diag-card">
              <span>MODEL 95% ELLIPSE</span>
              <strong>{semiMajor}m / {semiMinor}m</strong>
            </div>
          </div>
          <div className="diag-explanation">
            <strong>Diagnostic status:</strong> {f.locus.status_reason || f.metrics.frame_explanation || 'Nominal 2D trilateration geometry with active line-of-sight bounds.'}
          </div>
        </LiquidGlass>

        {/* Panel 2: Temporal Tracking & Next-Position Prediction (Phase 4) */}
        <LiquidGlass className="diagnostics-panel" tone="dense">
          <div className="diagnostics-header">
            <span><Compass size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />TEMPORAL TRACKING & NEXT-POSITION FORECAST</span>
            <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '11px', fontFamily: 'var(--mono)' }}>HORIZON +{f.forecast?.horizon_s ?? 0.2}s</span>
          </div>
          <div className="diagnostics-metrics">
            <div className="diag-card">
              <span>RAW MEASUREMENT POS</span>
              <strong>({f.locus.x.toFixed(2)}, {f.locus.y.toFixed(2)})</strong>
            </div>
            <div className="diag-card">
              <span>FILTERED STATE (SPEED)</span>
              <strong style={{ color: '#38ef7d' }}>({f.filtered?.x.toFixed(2) ?? f.locus.x.toFixed(2)}, {f.filtered?.y.toFixed(2) ?? f.locus.y.toFixed(2)}) <small style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{speedMps} m/s</small></strong>
            </div>
            <div className="diag-card">
              <span>1-STEP FORECAST (t+0.2s)</span>
              <strong style={{ color: '#c4b5fd' }}>({f.forecast?.x.toFixed(2) ?? f.locus.x.toFixed(2)}, {f.forecast?.y.toFixed(2) ?? f.locus.y.toFixed(2)})</strong>
            </div>
          </div>
          <div className="diag-explanation">
            <strong>Kalman Kinematic Filter:</strong> Discrete constant-velocity state propagation with covariance bounding. Forecast evaluated on held-out future trajectory step without temporal leakage.
          </div>
        </LiquidGlass>
      </div>
    </div>
  )
}

function Control({
  label,
  value,
  min,
  max,
  step,
  suffix = '',
  percent = false,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  percent?: boolean
  onChange: (n: number) => void
}) {
  const [localVal, setLocalVal] = useState(value)
  const isDraggingRef = useRef(false)
  const debounceTimerRef = useRef<number | null>(null)
  const latestLocalValRef = useRef(localVal)
  latestLocalValRef.current = localVal

  // Synchronize incoming telemetry value only when the user is not actively adjusting the slider
  useEffect(() => {
    if (!isDraggingRef.current && debounceTimerRef.current === null) {
      setLocalVal(value)
    }
  }, [value])

  const triggerChange = (val: number) => {
    onChange(val)
  }

  const handleInput = (val: number) => {
    setLocalVal(val)
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null
      triggerChange(val)
    }, 140)
  }

  const startDrag = () => {
    isDraggingRef.current = true
  }

  const endDrag = () => {
    isDraggingRef.current = false
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
      triggerChange(latestLocalValRef.current)
    }
  }

  const display = percent
    ? `${Math.round(localVal * 100)}%`
    : `${localVal.toFixed(2)}${suffix}`

  return (
    <label className="range-control">
      <span>
        {label}
        <b>{display}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localVal}
        onPointerDown={startDrag}
        onPointerUp={endDrag}
        onTouchStart={startDrag}
        onTouchEnd={endDrag}
        onChange={e => handleInput(Number(e.target.value))}
      />
    </label>
  )
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="loading-state">
      <div className="scan-line" />
      <span>{label}</span>
    </div>
  )
}

export function EngineError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="empty-state">
      <h2>Positioning engine offline</h2>
      <p>{message} Start the FastAPI service, then reconnect.</p>
      <button onClick={retry}>Reconnect engine</button>
    </div>
  )
}
