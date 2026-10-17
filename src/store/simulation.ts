import { create } from 'zustand'
import type { Frame, SimulationConfig } from '../types'
import { api } from '../services/api'

type SimulationStore = {
  id: string | null
  frame: Frame | null
  connected: boolean
  playing: boolean
  error: string | null
  socket: WebSocket | null
  initializing: boolean
  initialize: (force?: boolean) => Promise<void>
  command: (action: 'play' | 'pause' | 'reset' | 'step') => Promise<void>
  configure: (config: Partial<SimulationConfig>) => Promise<void>
  cleanup: () => void
}

export const useSimulation = create<SimulationStore>((set, get) => ({
  id: null,
  frame: null,
  connected: false,
  playing: false,
  error: null,
  socket: null,
  initializing: false,

  initialize: async (force = false) => {
    const state = get()
    if (state.initializing) return

    const isSocketAlive =
      state.socket &&
      (state.socket.readyState === WebSocket.OPEN || state.socket.readyState === WebSocket.CONNECTING)

    if (state.id && isSocketAlive && !force) return

    set({ initializing: true })

    if (force || state.socket) {
      const prevSocket = state.socket
      if (prevSocket) {
        prevSocket.onopen = null
        prevSocket.onmessage = null
        prevSocket.onerror = null
        prevSocket.onclose = null
        try {
          prevSocket.close()
        } catch {
          // Ignore
        }
      }
      set({ socket: null, connected: false })
    }

    try {
      let simId = get().id
      let initialFrame = get().frame

      // If no simulation exists or forced, create a new simulation on backend
      if (!simId || force) {
        const created = await api.createSimulation()
        simId = created.id
        initialFrame = created.state
      }

      const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
      const socket = new WebSocket(`${protocol}://${location.host}/ws/simulation/${simId}`)

      socket.onopen = () => {
        if (get().socket === socket) {
          set({ connected: true, error: null })
        }
      }
      socket.onmessage = event => {
        if (get().socket === socket) {
          try {
            const nextFrame = JSON.parse(event.data) as Frame
            set({ frame: nextFrame })
          } catch {
            // Ignore malformed transient frames
          }
        }
      }
      socket.onerror = () => {
        if (get().socket === socket) {
          set({ connected: false, error: 'Live engine connection interrupted.' })
        }
      }
      socket.onclose = () => {
        if (get().socket !== socket) return
        set({ connected: false, socket: null, error: 'Live engine connection interrupted. Reconnecting…' })
        window.setTimeout(() => {
          if (!get().initializing) void get().initialize()
        }, 900)
      }

      set({ id: simId, socket, frame: initialFrame, initializing: false })
    } catch (error) {
      set({
        initializing: false,
        error: error instanceof Error ? error.message : 'Backend unavailable',
      })
    }
  },

  command: async action => {
    const { id } = get()
    if (!id) return
    try {
      const res = await api.action(id, action)
      if (action === 'reset' && res && typeof res === 'object') {
        set({ frame: res as Frame, error: null, playing: false })
      } else if (action === 'step' && res && typeof res === 'object') {
        set({ frame: res as Frame, error: null })
      } else {
        set({
          error: null,
          playing: action === 'play' ? true : action === 'pause' ? false : get().playing,
        })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Simulation command failed.' })
    }
  },

  configure: async config => {
    const { id } = get()
    if (!id) return
    try {
      const updated = await api.configure(id, config)
      if (updated && typeof updated === 'object') {
        set({ frame: updated as Frame, error: null })
      } else {
        set({ error: null })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Configuration update failed.' })
    }
  },

  cleanup: () => {
    const s = get().socket
    if (s) {
      s.onopen = null
      s.onmessage = null
      s.onerror = null
      s.onclose = null
      try {
        s.close()
      } catch {
        // Ignore
      }
    }
    set({ socket: null, connected: false, initializing: false })
  },
}))
