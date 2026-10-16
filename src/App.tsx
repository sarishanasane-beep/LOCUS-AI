import { NavLink, Outlet } from 'react-router-dom'
import { Activity, BarChart3, BrainCircuit, Database, FlaskConical, Map, Presentation, RadioTower } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from './services/api'
import { LiquidGlass } from './components/LiquidGlass'
import { Atmosphere } from './components/Atmosphere'
import { CursorAura } from './components/CursorAura'

const nav=[['/','Overview',Activity],['/simulation','Simulation Lab',Map],['/intelligence','Intelligence',BrainCircuit],['/analytics','Analytics',BarChart3],['/datasets','Datasets',Database],['/methodology','Methodology',FlaskConical],['/demo','Judge Demo',Presentation]] as const
export function App(){const health=useQuery({queryKey:['health'],queryFn:api.health,retry:1,refetchInterval:10000});return <div className="app-shell">
  <Atmosphere fullScreen />
  <CursorAura />
  <header className="site-header">
    <NavLink className="brand" to="/"><span className="brand-mark"><RadioTower/></span><span>LOCUS AI</span></NavLink>
    <LiquidGlass className="nav-glass" tone="dense"><nav aria-label="Primary navigation">{nav.map(([to,label,Icon])=><NavLink key={to} to={to} end={to==='/' } aria-label={label}><Icon/><span>{label}</span></NavLink>)}</nav></LiquidGlass>
    <div className="system-state"><i className={health.isSuccess?'ok':'bad'}/><span>{health.isPending?'CHECKING':health.isSuccess?'ENGINE LIVE':'ENGINE OFFLINE'}</span></div>
  </header>
  <div className="main-shell"><main><Outlet/></main></div>
</div>}
