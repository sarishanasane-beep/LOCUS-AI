import type { HTMLAttributes, ReactNode } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & { children: ReactNode; tone?: 'clear' | 'dense' }

export function LiquidGlass({ children, className = '', tone = 'clear', ...props }: Props) {
  return <div className={`liquid-glass liquid-glass-${tone} ${className}`} {...props}>
    <span className="liquid-glass-highlight" aria-hidden="true" />
    <div className="liquid-glass-content">{children}</div>
  </div>
}
