import { useMutation } from '@tanstack/react-query'
import { Database, Download } from 'lucide-react'
import { api } from '../services/api'
import { LiquidGlass } from '../components/LiquidGlass'

export function Datasets() {
 const gen=useMutation({mutationFn:()=>api.generateDataset(800)})
 return <div className="page"><header className="page-heading"><div><h1>Dataset Workspace</h1><p>Generate reproducible measurement tables or validate your own.</p></div><button className="primary-action" onClick={()=>gen.mutate()} disabled={gen.isPending}><Database/>{gen.isPending?'Generating':'Generate 800 rows'}</button></header>
 {gen.isError && <div className="inline-error"><span>{gen.error instanceof Error ? gen.error.message : 'Dataset generation failed.'}</span><button onClick={()=>gen.mutate()}>Retry generation</button></div>}
 <LiquidGlass className="schema-line"><span>trajectory_id</span><span>timestamp</span><span>anchor_id</span><span>anchor_x_m</span><span>anchor_y_m</span><span>measured_range_m</span><span>is_available</span></LiquidGlass>
 {gen.data ? <><LiquidGlass className="dataset-summary"><strong>{gen.data.rows}</strong><span>measurement rows generated with seed 41</span><a href={gen.data.download_url}><Download/> Download CSV</a></LiquidGlass><LiquidGlass className="data-preview">{gen.data.preview.map((row,i)=><div key={i}>{Object.values(row).map((v,j)=><span key={j}>{String(v)}</span>)}</div>)}</LiquidGlass></> : <LiquidGlass className="drop-zone"><Database/><h2>No dataset in session</h2><p>Generate a labelled synthetic set from the simulator. Real inference files may omit ground truth; accuracy metrics will then be withheld.</p></LiquidGlass>}
 </div>
}
