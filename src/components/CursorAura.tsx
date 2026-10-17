import { useEffect, useRef } from 'react'

export function CursorAura() {
  const aura = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarse = window.matchMedia('(pointer: coarse)')
    if (reduced.matches || coarse.matches) return

    let rafId: number | null = null

    const move = (event: PointerEvent) => {
      if (rafId !== null) return
      const x = (event.clientX / window.innerWidth) * 100
      const y = (event.clientY / window.innerHeight) * 100
      rafId = requestAnimationFrame(() => {
        aura.current?.style.setProperty('--cursor-x', `${x}%`)
        aura.current?.style.setProperty('--cursor-y', `${y}%`)
        rafId = null
      })
    }

    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      window.removeEventListener('pointermove', move)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [])

  return <div ref={aura} className="cursor-aura" aria-hidden="true" />
}
