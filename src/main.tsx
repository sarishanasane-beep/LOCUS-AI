import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { Overview } from './pages/Overview'
import { Simulation } from './pages/Simulation'
import { Intelligence } from './pages/Intelligence'
import { Analytics } from './pages/Analytics'
import { Datasets } from './pages/Datasets'
import { Methodology } from './pages/Methodology'
import { Demo } from './pages/Demo'
import './styles.css'
import './overrides.css'

const router=createBrowserRouter([{path:'/',element:<App/>,children:[{index:true,element:<Overview/>},{path:'simulation',element:<Simulation/>},{path:'intelligence',element:<Intelligence/>},{path:'analytics',element:<Analytics/>},{path:'datasets',element:<Datasets/>},{path:'methodology',element:<Methodology/>}]},{path:'/demo',element:<Demo/>}])
const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:5000}}})
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router}/></QueryClientProvider></React.StrictMode>)
