// Spend over time, one line per reward kind (+ all rewards and the budget), for the chosen range and grain.
// Click a name to hide it: the scale follows what is shown, so small lines (Buff Pass, raffles) can be read
// without the marketplace. Hover or arrow keys: one readout with every line at that point.
import { useRef, useState } from 'react'
import type { Bucket, Grain, Kind } from '../../lib/utilization'
import { C, money } from '../../ui/kit'

/** One color per reward kind, everywhere on the screen (checked for color-blind separation on the dark surface). */
export const KIND_COLOR: Record<Kind, string> = { mp: C.lime, buffpass: C.sky, raffle: C.pink, other: C.orange }

type SeriesId = 'total' | 'budget' | Kind
interface Series { id: SeriesId; label: string; color: string; dash?: string; get: (b: Bucket) => number | null }
const SERIES: Series[] = [
  { id: 'total', label: 'All rewards', color: C.text, get: (b) => b.spent },
  { id: 'budget', label: 'Budget', color: C.muted, dash: '6 5', get: (b) => b.budget },
  { id: 'mp', label: 'Marketplace', color: KIND_COLOR.mp, get: (b) => b.kinds.mp },
  { id: 'buffpass', label: 'Buff Pass', color: KIND_COLOR.buffpass, get: (b) => b.kinds.buffpass },
  { id: 'raffle', label: 'Raffles', color: KIND_COLOR.raffle, get: (b) => b.kinds.raffle },
  { id: 'other', label: 'Other prizes', color: KIND_COLOR.other, get: (b) => b.kinds.other },
]

const short = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`)
function niceTop(max: number): { top: number; step: number } {
  const raw = Math.max(max, 1) / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag
  return { top: step * Math.ceil(Math.max(max, 1) / step), step }
}

export default function SpendLines({ data, grain, stale, hasPrizes }: { data: Bucket[]; grain: Grain; stale: boolean; hasPrizes: boolean }) {
  const [hidden, setHidden] = useState<Set<SeriesId>>(() => new Set())
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const series = SERIES.filter((s) => hasPrizes || (s.id !== 'buffpass' && s.id !== 'raffle' && s.id !== 'other'))
  const shown = series.filter((s) => !hidden.has(s.id))
  const toggle = (id: SeriesId) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const n = data.length
  const W = 820, H = 280, L = 52, R = 104, T = 16, B = 30
  const max = Math.max(0, ...shown.flatMap((s) => data.map((b) => s.get(b) ?? 0)))
  const { top, step } = niceTop(max * 1.05)
  const x = (i: number) => (n <= 1 ? (L + W - R) / 2 : L + (i / (n - 1)) * (W - L - R))
  const y = (v: number) => T + (1 - v / top) * (H - T - B)
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v)
  const every = Math.max(1, Math.ceil(n / 7))
  const xLabel = (b: Bucket) => (grain === 'month' ? b.label.replace(/ (\d{4})$/, (_, yr) => (b.key.endsWith('-01') ? ` ${yr}` : ''))
    : grain === 'week' ? b.label.split(' – ')[0] : b.label)

  // A finished stretch is solid; the last point when it is still running (to date) joins with a dashed segment.
  const paths = (s: Series) => {
    const solid: string[][] = [[]]
    let tail: string | null = null
    data.forEach((b, i) => {
      const v = s.get(b)
      if (v === null) { if (solid.at(-1)!.length) solid.push([]); return }
      const pt = `${x(i).toFixed(1)},${y(v).toFixed(1)}`
      const lastRunning = i === n - 1 && b.partial && !b.cutStart && s.id !== 'budget'
      if (lastRunning && solid.at(-1)!.length) tail = `${solid.at(-1)!.at(-1)} ${pt}`
      else solid.at(-1)!.push(pt)
    })
    return { solid: solid.filter((p) => p.length), tail }
  }

  // End labels: at each line's last value, pushed apart so they never overlap.
  const GAP = 16
  const ends = shown.map((s) => {
    let i = n - 1
    while (i >= 0 && s.get(data[i]) === null) i--
    return { s, i, y: i >= 0 ? y(s.get(data[i]) as number) : null }
  }).filter((e) => e.y !== null).sort((a, b) => (a.y as number) - (b.y as number))
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y as number, (ends[k - 1].y as number) + GAP)
  // …and back up from the bottom edge if the stack ran past it (small lines bunch up near $0).
  if (ends.length) ends[ends.length - 1].y = Math.min(ends[ends.length - 1].y as number, H - B - 2)
  for (let k = ends.length - 2; k >= 0; k--) ends[k].y = Math.min(ends[k].y as number, (ends[k + 1].y as number) - GAP)

  const pick = (clientX: number) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r || !n) return
    const px = ((clientX - r.left) / r.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : ((px - L) / (W - L - R)) * (n - 1)))))
  }
  const hb = hover !== null ? data[hover] : null

  return (
    <div>
      <div className="row" role="group" aria-label="Lines shown" style={{ gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
        {series.map((s) => {
          const on = !hidden.has(s.id)
          return (
            <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle(s.id)} title={on ? 'Hide this line' : 'Show this line'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 28, padding: '0 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                border: `1px solid ${on ? C.line2 : C.line}`, background: on ? '#1A1C20' : 'transparent', color: on ? C.text : C.faint }}>
              <svg width="16" height="4" aria-hidden><line x1="0" x2="16" y1="2" y2="2" stroke={on ? s.color : C.ghost} strokeWidth="2.5" strokeDasharray={s.dash ? '4 3' : undefined} strokeLinecap="round" /></svg>
              {s.label}
            </button>
          )
        })}
        <span className="caption" style={{ marginLeft: 6 }}>Click a name to hide it — the scale follows what's shown</span>
      </div>

      <div style={{ position: 'relative', marginTop: 10, opacity: stale ? 0.45 : 1, transition: 'opacity .2s' }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', outline: 'none' }} role="img" tabIndex={0}
          aria-label={`Spend per ${grain} by reward type — the table below has every value`}
          onPointerMove={(e) => pick(e.clientX)} onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setHover((h) => Math.max(0, Math.min(n - 1, (h ?? n - 1) + (e.key === 'ArrowLeft' ? -1 : 1)))) }
            if (e.key === 'Escape') setHover(null)
          }}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={C.line} />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={C.faint}>{short(v)}</text>
            </g>
          ))}
          {data.map((b, i) => (i % every === 0 || i === n - 1) && (n - 1 - i >= every / 2 || i === n - 1) && (
            <text key={b.key} x={x(i)} y={H - 9} textAnchor="middle" fontSize="11" fill={C.faint}>{xLabel(b)}</text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke={C.ghost} />}
          {shown.map((s) => {
            const p = paths(s)
            const w = s.id === 'total' ? 2.5 : 2
            return (
              <g key={s.id}>
                {p.solid.map((pts, k) => pts.length === 1
                  ? <circle key={k} cx={pts[0].split(',')[0]} cy={pts[0].split(',')[1]} r="3" fill={s.color} />
                  : <polyline key={k} points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth={w} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />)}
                {p.tail && <polyline points={p.tail} fill="none" stroke={s.color} strokeWidth={w} strokeDasharray="2 4" strokeLinecap="round" />}
              </g>
            )
          })}
          {hover !== null && shown.map((s) => {
            const v = s.get(data[hover])
            return v === null ? null : <circle key={s.id} cx={x(hover)} cy={y(v)} r="4" fill={s.color} stroke="#111214" strokeWidth="2" />
          })}
          {ends.map((e) => (
            <g key={e.s.id}>
              <line x1={W - R + 8} x2={W - R + 18} y1={e.y as number} y2={e.y as number} stroke={e.s.color} strokeWidth="2" strokeDasharray={e.s.dash ? '3 2' : undefined} />
              <text x={W - R + 22} y={(e.y as number) + 4} fontSize="11" fill={C.muted}>{e.s.label}</text>
            </g>
          ))}
          {!shown.length && <text x={(L + W - R) / 2} y={H / 2} textAnchor="middle" fontSize="13" fill={C.faint}>Pick a line above</text>}
        </svg>

        {hb && hover !== null && (
          <div role="status" style={{
            position: 'absolute', top: 4, pointerEvents: 'none', minWidth: 180, padding: '10px 12px', borderRadius: 10,
            background: '#16181BF2', border: `1px solid ${C.line2}`, boxShadow: '0 8px 24px #0008', fontSize: 12,
            ...(x(hover) / W > 0.55 ? { right: `${(1 - x(hover) / W) * 100 + 2}%` } : { left: `${(x(hover) / W) * 100 + 2}%` }),
          }}>
            <div style={{ color: C.muted, marginBottom: 6 }}>{hb.label}{hb.partial ? (hb.cutStart ? ' · part' : ' · to date') : ''}</div>
            {shown.map((s) => {
              const v = s.get(hb)
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 20 }}>
                  <svg width="12" height="4" aria-hidden><line x1="0" x2="12" y1="2" y2="2" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash ? '3 2' : undefined} /></svg>
                  <span className="mono" style={{ color: C.text, fontWeight: 600, minWidth: 64 }}>{v === null ? 'none' : money(v)}</span>
                  <span style={{ color: C.muted }}>{s.label}</span>
                </div>
              )
            })}
            {hb.budget ? <div style={{ color: C.muted, marginTop: 6, borderTop: `1px solid ${C.line2}`, paddingTop: 6 }}>{Math.round((hb.spent / hb.budget) * 100)}% of the budget</div> : null}
          </div>
        )}
      </div>
    </div>
  )
}
