import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Radio, ShieldCheck, Waypoints } from 'lucide-react'
import { useSimulation } from '../store/simulation'

export function Overview() {
  const sim = useSimulation(); useEffect(() => { sim.initialize() }, [])
  return <div className="page overview">
    <section className="landing-hero">
      <div className="landing-copy"><h1>Position belongs<br/>to evidence.</h1><p>LOCUS AI turns noisy indoor radio measurements into a transparent, reliability-aware location estimate.</p><div className="hero-actions"><Link className="primary-action" to="/simulation">Open simulation <ArrowUpRight /></Link><Link to="/methodology">How it works</Link></div></div>
    </section>
    <section className="landing-method"><div><Radio/><h2>Measure the room.</h2><p>Range packets come from the current geometry.</p></div><div><ShieldCheck/><h2>Interrogate the signal.</h2><p>Every anchor carries anomaly evidence.</p></div><div><Waypoints/><h2>Expose uncertainty.</h2><p>The estimate includes its confidence boundary.</p></div></section>
  </div>
}
