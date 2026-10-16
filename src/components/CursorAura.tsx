import { useEffect, useRef } from 'react'

export function CursorAura() {
  const aura = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarse = window.matchMedia('(pointer: coarse)')
    if (reduced.matches || coarse.matches) return

    const move = (event: PointerEvent) => {
      aura.current?.style.setProperty('--cursor-x', `${(event.clientX / window.innerWidth) * 100}%`)
      aura.current?.style.setProperty('--cursor-y', `${(event.clientY / window.innerHeight) * 100}%`)
    }

    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])

  return <div ref={aura} className="cursor-aura" aria-hidden="true" />
}
