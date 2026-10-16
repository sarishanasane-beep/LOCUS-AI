import { create } from 'zustand'
import type { Frame, SimulationConfig } from '../types'
import { api } from '../services/api'

type SimulationStore = {
  id: string | null; frame: Frame | null; connected: boolean; playing: boolean; error: string | null; socket: WebSocket | null;
  initialize: (force?: boolean) => Promise<void>; command: (action: 'play' | 'pause' | 'reset' | 'step') => Promise<void>; configure: (config: Partial<SimulationConfig>) => Promise<void>;
}

export const useSimulation = create<SimulationStore>((set, get) => ({
  id: null, frame: null, connected: false, playing: false, error: null, socket: null,
  initialize: async (force = false) => {
    if (get().id && !force) return
    if (force) { get().socket?.close(); set({ id: null, socket: null, connected: false }) }
    try {
      const { id, state } = await api.createSimulation()
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
      const socket = new WebSocket(`${protocol}://${location.host}/ws/simulation/${id}`)
      socket.onopen = () => set({ connected: true, error: null })
      socket.onmessage = event => set({ frame: JSON.parse(event.data) })
      socket.onerror = () => set({ connected: false, error: 'Live engine connection interrupted.' })
      socket.onclose = () => {
        if (get().socket !== socket) return
        set({ connected: false, id: null, socket: null, error: 'Live engine connection interrupted. Reconnecting…' })
        window.setTimeout(() => { if (!get().id) void get().initialize() }, 900)
      }
      set({ id, socket, frame: state })
    } catch (error) { set({ error: error instanceof Error ? error.message : 'Backend unavailable' }) }
  },
  command: async action => {
    const { id } = get(); if (!id) return
    try { await api.action(id, action); set({ error: null, playing: action === 'play' ? true : action === 'pause' || action === 'reset' ? false : get().playing }) }
    catch (error) { set({ error: error instanceof Error ? error.message : 'Simulation command failed.' }) }
  },
  configure: async config => { const { id } = get(); if (!id) return; try { await api.configure(id, config); set({ error: null }) } catch (error) { set({ error: error instanceof Error ? error.message : 'Configuration update failed.' }) } }
}))
