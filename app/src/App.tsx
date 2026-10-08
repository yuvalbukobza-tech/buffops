import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { login, logout, restoreSession, type Session } from './lib/auth'
import { SessionCtx } from './lib/session'
import { StoreProvider, useStore } from './lib/store'
import { C } from './ui/kit'
import Countries from './screens/Countries'
import Dashboard from './screens/Dashboard'
import Products from './screens/Products'
import Budget from './screens/Budget'
import Allocate from './screens/Allocate'
import Fulfillment from './screens/Fulfillment'

type Route = 'dashboard' | 'products' | 'countries' | 'budget' | 'allocate' | 'fulfillment' | 'admin'
const TABS: { id: Route; name: string; admin?: boolean; ready: boolean }[] = [
  { id: 'dashboard', name: 'Dashboard', ready: true },
  { id: 'products', name: 'Products', ready: true },
  { id: 'countries', name: 'Countries', ready: true },
  { id: 'budget', name: 'Budget', ready: true },
  { id: 'allocate', name: 'Allocate', ready: true },
  { id: 'fulfillment', name: 'Fulfillment', admin: true, ready: true },
  { id: 'admin', name: 'Admin', admin: true, ready: false },
]

function useRoute(): [Route, (r: Route) => void] {
  // '#/allocate/raffle' → route 'allocate' (the rest is read by the screen)
  const read = () => (location.hash.replace('#/', '').split('/')[0] || 'dashboard') as Route
  const [r, setR] = useState<Route>(read)
  useEffect(() => {
    const f = () => setR(read())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return [r, (x) => { location.hash = '/' + x }]
}

function Center({ children }: { children: ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20, textAlign: 'center' }}>{children}</div>
}

const Logo = ({ size = 20 }: { size?: number }) => <div style={{ fontSize: size, fontWeight: 700, letterSpacing: '-0.03em' }}><span style={{ color: C.lime }}>Buff</span>Ops</div>

function Login({ onDone }: { onDone: (s: Session) => void }) {
  const { state } = useStore()
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const s = login(u, p, state?.appUsers || [])
    if (s) onDone(s)
    else { setErr(true); setP('') }
  }
  return (
    <Center>
      <form onSubmit={submit} className="card a-up" style={{ width: 360, padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
        <Logo size={28} />
        <div className="caption" style={{ marginBottom: 8 }}>Planning platform · v2 preview</div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Username</span><input className="input" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} autoFocus /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption">Password</span><input className="input" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} /></label>
        {err && <div style={{ fontSize: 12, color: C.bad }}>Incorrect username or password.</div>}
        <button className="btn primary" type="submit" style={{ justifyContent: 'center', height: 44, marginTop: 6 }}>Sign in</button>
      </form>
    </Center>
  )
}

function SaveIndicator() {
  const { saveStatus } = useStore()
  const map: Record<string, [string, string]> = {
    idle: ['', C.faint], preview: ['Preview · not saved', C.warn], saving: ['Saving…', C.warn], saved: ['Saved', C.good], blocked: ['Save blocked', C.bad], error: ['Save failed', C.bad],
  }
  const [text, color] = map[saveStatus] || map.idle
  return <div className="row hide-sm" style={{ gap: 8, fontSize: 12, color: C.muted }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />{text}</div>
}

function PreviewBanner() {
  const { readOnly, dirty, discard } = useStore()
  if (!readOnly) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 16px', background: '#1A1408', borderBottom: '1px solid #3D2A0A', fontSize: 12, color: C.warn, flexWrap: 'wrap' }}>
      <span>v2 preview with live data — try anything, nothing is saved. Keep using the current BuffOps for real work.</span>
      {dirty && <button className="btn small" onClick={discard}>Reset my changes</button>}
      <a href="/buffops/" style={{ color: C.warn }}>Open current BuffOps</a>
    </div>
  )
}

function Soon({ name }: { name: string }) {
  return (
    <Center>
      <div className="h2" style={{ fontSize: 20 }}>{name} is being rebuilt</div>
      <div className="caption">It will appear here soon. Until then, use it in the current BuffOps.</div>
      <a className="btn" href="/buffops/">Open current BuffOps</a>
    </Center>
  )
}

function Shell() {
  const { status, error, reload, state } = useStore()
  const [session, setSession] = useState<Session | null>(null)
  const [route, go] = useRoute()
  const [menu, setMenu] = useState(false)

  useEffect(() => { if (state && !session) setSession(restoreSession(state.appUsers)) }, [state, session])

  if (status === 'loading' && !state) return <Center><Logo size={28} /><div className="caption">Loading data from Google Sheets…</div><div style={{ width: 22, height: 22, border: `2px solid ${C.line2}`, borderTopColor: C.lime, borderRadius: '50%', animation: 'bo-spin .8s linear infinite' }} /></Center>
  if (status === 'error') return <Center><div className="h2" style={{ fontSize: 18 }}>Couldn't load data from Google Sheets</div><div className="caption" style={{ maxWidth: 420 }}>Nothing was changed or saved. {error}</div><button className="btn primary" onClick={reload}>Retry</button></Center>
  if (!session) return <Login onDone={setSession} />

  const tabs = TABS.filter((t) => !t.admin || session.isAdmin)
  const current = tabs.find((t) => t.id === route) || tabs[0]
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PreviewBanner />
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(11,12,14,0.85)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', gap: 28, padding: '0 28px' }}>
          <Logo />
          <nav className="navscroll" style={{ display: 'flex', gap: 4, flex: 1, overflowX: 'auto' }}>
            {tabs.map((t) => (
              <a key={t.id} href={`#/${t.id}`} aria-current={t.id === current.id ? 'page' : undefined}
                style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none', whiteSpace: 'nowrap', background: t.id === current.id ? '#1A1C20' : 'transparent', color: t.id === current.id ? C.text : C.muted, transition: 'background .2s, color .2s' }}>
                {t.name}{!t.ready && <span style={{ marginLeft: 6, fontSize: 9, color: C.ghost }}>soon</span>}
              </a>
            ))}
          </nav>
          <SaveIndicator />
          <div style={{ position: 'relative' }}>
            <button aria-label="Account menu" onClick={() => setMenu(!menu)} style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${C.line2}`, background: '#16181B', color: C.text, fontWeight: 600, cursor: 'pointer' }}>{session.display[0]}</button>
            {menu && (
              <div className="card a-up" style={{ position: 'absolute', right: 0, top: 42, width: 220, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, animationDuration: '.3s' }}>
                <div><div style={{ fontWeight: 600 }}>{session.display}</div><div className="caption">{session.isAdmin ? 'Administrator' : 'Member'}</div></div>
                <button className="btn small" onClick={() => { logout(); setSession(null); setMenu(false) }}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <SessionCtx.Provider value={session}>
      <main key={current.id} style={{ flex: 1 }}>
        {current.id === 'dashboard' && <Dashboard go={go} />}
        {current.id === 'countries' && <Countries />}
        {current.id === 'products' && <Products />}
        {current.id === 'budget' && <Budget />}
        {current.id === 'allocate' && <Allocate />}
        {current.id === 'fulfillment' && session.isAdmin && <Fulfillment />}
        {!current.ready && <Soon name={current.name} />}
      </main>
      </SessionCtx.Provider>
    </div>
  )
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>
}
