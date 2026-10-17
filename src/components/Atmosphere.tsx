import { Component, type ReactNode } from 'react'
import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react'

class ShaderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="shader-fallback" /> : this.props.children }
}

export function Atmosphere({ compact = false, fullScreen = false }: { compact?: boolean; fullScreen?: boolean }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return <div className={`shader-atmosphere ${compact ? 'is-compact' : ''} ${fullScreen ? 'is-fullscreen' : ''}`} aria-hidden="true">
    <ShaderBoundary>
      <ShaderGradientCanvas pixelDensity={1.0} fov={45} style={{ position: 'absolute', inset: 0 }}>
        <ShaderGradient
          animate={reduced ? 'off' : 'on'}
          brightness={0.3}
          cAzimuthAngle={270}
          cDistance={0.52}
          cPolarAngle={180}
          cameraZoom={15.04}
          color1="#5f528b"
          color2="#4b72dc"
          color3="#90c9ce"
          envPreset="lobby"
          grain="off"
          lightType="env"
          positionX={-0.1}
          positionY={0}
          positionZ={0}
          range="disabled"
          rangeEnd={40}
          rangeStart={0}
          reflection={0.2}
          rotationX={0}
          rotationY={130}
          rotationZ={70}
          shader="defaults"
          type="sphere"
          uAmplitude={0.7}
          uDensity={2.0}
          uFrequency={5.5}
          uSpeed={reduced ? 0 : 0.15}
          uStrength={0.18}
          uTime={0}
          wireframe={false}
        />
      </ShaderGradientCanvas>
    </ShaderBoundary>
  </div>
}
