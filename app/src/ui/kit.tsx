import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export const C = {
  lime: '#C8FF00', good: '#4ADE80', warn: '#FBBF24', bad: '#F87171', sky: '#38BDF8', violet: '#A78BFA', orange: '#FB923C', pink: '#F472B6',
  text: '#EDEEF0', muted: '#8A8F98', faint: '#6B7079', ghost: '#4A4E55', line: '#1F2125', line2: '#2A2D33',
}

export const money = (v: number, d = 0) => '$' + (Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
export const pct = (v: number) => (Number.isFinite(v) ? Math.round(v) : 0) + '%'

export const DEMAND_COLOR: Record<string, string> = { 'Very High': C.lime, 'High': C.good, 'Medium': C.warn, 'Low': C.bad }
export const utilColor = (u: number) => (u >= 70 ? C.good : u >= 50 ? C.warn : C.bad)

/** 0 → 1 eased progress that starts after `delay` ms; drives count-ups and chart reveals. */
export function useEntrance(duration = 1300, delay = 250): number {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setT(1); return }
    const start = performance.now() + delay
    let raf = 0
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - start) / duration))
      setT(1 - Math.pow(1 - p, 4))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [duration, delay])
  return t
}

export function Card({ children, className = '', style, delay = 0, pad = true }: { children: ReactNode; className?: string; style?: CSSProperties; delay?: number; pad?: boolean }) {
  return <section className={`card a-up ${pad ? 'pad' : ''} ${className}`} style={{ animationDelay: `${delay}ms`, ...style }}>{children}</section>
}

export function Kpi({ label, value, sub, color = C.text, subColor = C.faint, delay = 0, accent = false }: { label: string; value: string; sub?: string; color?: string; subColor?: string; delay?: number; accent?: boolean }) {
  return (
    <div className="card a-up" style={{ animationDelay: `${delay}ms`, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: accent ? 'inset 0 0 0 1px rgba(200,255,0,0.18)' : undefined }}>
      <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: subColor }}>{sub}</div>}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="toggle" onClick={() => onChange(!on)} />
}

export function Seg<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group">
      {options.map((o) => <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  )
}

export function DemandChip({ level, dim = false }: { level: string; dim?: boolean }) {
  const c = dim ? C.ghost : DEMAND_COLOR[level] || C.muted
  return <span className="chip" style={{ color: c, background: c + '1A' }}>{level}</span>
}

export function UtilBar({ value, dim = false, delay = 0 }: { value: number; dim?: boolean; delay?: number }) {
  const c = dim ? C.ghost : utilColor(value)
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1, height: 5, borderRadius: 3, background: '#23262B', overflow: 'hidden' }}>
        <span className="a-gx" style={{ display: 'block', height: '100%', width: `${Math.min(100, value)}%`, background: c, borderRadius: 3, animationDelay: `${delay}ms`, transition: 'width .4s' }} />
      </span>
      <span className="mono" style={{ fontSize: 12, color: c, width: 34 }}>{Math.round(value)}%</span>
    </span>
  )
}

export function Drawer({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="drawer a-slide" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>{children}</div>
    </div>
  )
}

export const Icon = {
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  edit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
  close: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>,
  warn: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>,
  refresh: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>,
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const id = window.setTimeout(() => done.current(), 3200)
    return () => window.clearTimeout(id)
  }, [text])
  return <div className="card a-up" role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', padding: '12px 18px', zIndex: 60, fontSize: 13, borderColor: '#3A3D44', animationDuration: '.3s' }}>{text}</div>
}
