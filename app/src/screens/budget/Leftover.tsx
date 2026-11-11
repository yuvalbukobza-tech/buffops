// "Use the leftover": in the last days of a period, what to add so the budget is used —
// repeat the raffles users join most, and open more of the products that sold out all period.
import { useMemo } from 'react'
import { LAST_DAYS, RAFFLE_SHARE, planLeftover, type RaffleStat } from '../../lib/recommend'
import { addDays, dayLabel, type PeriodSummary, type ProductLine } from '../../lib/utilization'
import { C, Card, money } from '../../ui/kit'

const WHY: Record<string, string> = {
  soldout: 'sold out now',
  over: 'bought above plan',
  capped: 'sells everything opened',
}

export default function Leftover({ sum, today, lines, raffles, rafflesNote }: {
  sum: PeriodSummary; today: string; lines: ProductLine[]; raffles: RaffleStat[] | null; rafflesNote: string
}) {
  const daysLeft = sum.days - sum.completeDays // today included
  const actNow = daysLeft <= LAST_DAYS
  const from = addDays(sum.end, -(LAST_DAYS - 1))
  const leftover = sum.projectedUnused ?? 0
  const plan = useMemo(() => planLeftover(leftover, daysLeft, lines, raffles || []), [leftover, daysLeft, lines, raffles])
  const used = plan.leftover - plan.unallocated
  const RGRID = '2.2fr 1.3fr 0.8fr 0.8fr 0.8fr'

  return (
    <Card delay={340} style={actNow ? { boxShadow: 'inset 0 0 0 1px rgba(200,255,0,0.25)' } : undefined}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="h2">Use the leftover</h2>
          <div className="caption" style={{ marginTop: 4 }}>What to add so the budget is used, based on this period's demand and past raffles</div>
        </div>
        <span className="chip" style={actNow ? { color: C.lime, background: C.lime + '1A' } : { color: C.muted, background: '#23262B' }}>
          {actNow ? `Last ${daysLeft} day${daysLeft === 1 ? '' : 's'} — act now` : `Preview · final from ${dayLabel(from)}`}
        </span>
      </div>

      {sum.budget === null ? <p className="caption" style={{ marginTop: 14 }}>Set a budget to get recommendations.</p>
        : sum.forecast === null ? <p className="caption" style={{ marginTop: 14 }}>Needs at least one full day of data.</p>
        : leftover <= 0 ? (
          <p style={{ marginTop: 14, fontSize: 13, color: leftover < -(sum.budget * 0.05) ? C.bad : C.good }}>
            {leftover < 0 ? `The forecast is ${money(-leftover)} over the budget — nothing to add; consider slowing down.` : 'The forecast uses the whole budget — nothing to add.'}
          </p>
        ) : (
          <>
            <p style={{ marginTop: 14, fontSize: 13 }}>
              At the current pace <b className="mono" style={{ color: C.lime }}>{money(leftover)}</b> will be left on {dayLabel(sum.end)}.
              {' '}Suggested for the {daysLeft} day{daysLeft === 1 ? '' : 's'} left ({dayLabel(today)} – {dayLabel(sum.end)}):
            </p>

            <div className="label" style={{ marginTop: 16 }}>Raffles · up to {Math.round(RAFFLE_SHARE * 100)}%</div>
            {plan.raffles.length ? plan.raffles.map((r) => (
              <div key={r.stat.key} className="row" style={{ justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${C.line}`, fontSize: 13, flexWrap: 'wrap' }}>
                <span>Run again: <b>{r.stat.title}</b> <span className="caption">({r.stat.countries}) for {r.days} day{r.days === 1 ? '' : 's'}</span></span>
                <span className="caption">~{Math.round(r.stat.entriesPerDay).toLocaleString('en-US')} entries/day in the last {r.stat.runs} run{r.stat.runs === 1 ? '' : 's'} · {Math.round(r.stat.perDollar || 0)} per $</span>
                <span className="mono">{money(r.cost)}</span>
              </div>
            )) : <div className="caption" style={{ padding: '8px 0' }}>{raffles === null ? rafflesNote : 'No raffle fits — the popular ones are running already or cost more than the leftover share.'}</div>}

            <div className="label" style={{ marginTop: 18 }}>Open more in the marketplace</div>
            {plan.products.length ? (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 560 }}>
                  <div className="thead" style={{ gridTemplateColumns: RGRID, padding: '9px 0' }}><span>Product</span><span>Why</span><span>Extra units</span><span>Per day</span><span>Cost</span></div>
                  {plan.products.map((p) => (
                    <div key={p.line.name} className="trow" style={{ gridTemplateColumns: RGRID, height: 40, padding: 0 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.line.name}>{p.line.name}</span>
                      <span className="caption">{WHY[p.line.flag]} · {p.line.perDay.toFixed(1)}/day{p.line.plannedPerDay ? ` vs plan ${p.line.plannedPerDay}` : ''}</span>
                      <span className="mono">+{p.units}</span>
                      <span className="mono" style={{ color: C.muted }}>+{p.perDay.toFixed(1)}</span>
                      <span className="mono">{money(p.cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="caption" style={{ padding: '8px 0' }}>No product sold out or sold above plan this period.</div>}

            <div className="row" style={{ justifyContent: 'space-between', marginTop: 14, fontSize: 13, flexWrap: 'wrap' }}>
              <span>Suggested: <b className="mono">{money(used)}</b> of {money(plan.leftover)}</span>
              {plan.unallocated >= 1 && <span className="caption" style={{ color: C.warn }}>{money(plan.unallocated)} left — products can't absorb more in {daysLeft} day{daysLeft === 1 ? '' : 's'}; consider another raffle or Buff Pass prize.</span>}
            </div>
            <div className="caption" style={{ marginTop: 10 }}>
              Extra units are split by each product's daily spend × how far demand beats the plan, and capped at one extra day's sales per day left.
              Raffles are ranked by entries per day per prize dollar over the last 60 days (code prizes only; ones running now are skipped).
            </div>
          </>
        )}
    </Card>
  )
}
