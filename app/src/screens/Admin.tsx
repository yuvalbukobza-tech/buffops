import { useEffect, useState, type ReactNode } from 'react'
import { WRITE_ENABLED, listBackups, type BackupEntry } from '../lib/api'
import { accessOf, type Access } from '../lib/auth'
import { orphanRows } from '../lib/calc'
import { useSession } from '../lib/session'
import { useData, useStore } from '../lib/store'
import { STATE_KEYS, type AppUser } from '../lib/types'
import { C, Card, Drawer, Icon, Toast, useEntrance } from '../ui/kit'

const LV: Record<Access, string> = { Admin: C.lime, Editor: C.sky, Viewer: C.muted }
const LV_TEXT: Record<Access, string> = { Admin: 'Everything, incl. Admin and Fulfillment', Editor: 'Can view and change budgets, products, requests', Viewer: 'Can look, cannot change anything' }

function Field({ name, children, hint }: { name: string; children: ReactNode; hint?: string }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span className="caption" style={{ color: C.muted }}>{name}</span>{children}{hint && <span style={{ fontSize: 11, color: C.faint }}>{hint}</span>}</label>
}

function UserDrawer({ user, onClose, me }: { user: AppUser | null; onClose: () => void; me: string }) {
  const data = useData()
  const { update } = useStore()
  const isNew = !user
  const [f, setF] = useState<AppUser>(user || { id: Date.now(), firstName: '', lastName: '', email: '', role: '', username: '', password: '', defaultRecipient: false, access: 'Editor' })
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const builtInAdmin = accessOf({ username: f.username, access: undefined }) === 'Admin'
  const taken = data.appUsers.some((u) => u.id !== f.id && u.username.toLowerCase() === f.username.trim().toLowerCase())
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())
  const valid = f.firstName.trim() && f.username.trim() && !taken && emailOk && (!isNew || pw.length >= 6)
  const save = () => {
    const next: AppUser = { ...f, username: f.username.trim(), email: f.email.trim(), password: pw ? pw : user?.password }
    update((s) => ({ ...s, appUsers: isNew ? [...s.appUsers, next] : s.appUsers.map((u) => (u.id === next.id ? next : u)) }))
    onClose()
  }
  const remove = () => {
    if (!user || !window.confirm(`Delete ${user.firstName} ${user.lastName} (@${user.username})? They will no longer be able to sign in.`)) return
    update((s) => ({ ...s, appUsers: s.appUsers.filter((u) => u.id !== user.id) }))
    onClose()
  }
  return (
    <Drawer open onClose={onClose} title={isNew ? 'Invite teammate' : `Edit ${user!.firstName}`}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div><div className="caption">{isNew ? 'New teammate' : 'Edit teammate'}</div><div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{`${f.firstName} ${f.lastName}`.trim() || 'New user'}</div></div>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>{Icon.close}</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field name="First name"><input className="input" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
        <Field name="Last name"><input className="input" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
      </div>
      <Field name="Email" hint={f.email && !emailOk ? 'Not a valid email address' : undefined}><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field name="Role / title"><input className="input" value={f.role} placeholder="e.g. Marketing manager" onChange={(e) => setF({ ...f, role: e.target.value })} /></Field>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field name="Username" hint={taken ? 'Already used by someone else' : undefined}><input className="input mono" autoComplete="off" value={f.username} disabled={!isNew && builtInAdmin} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
        <Field name={isNew ? 'Password' : 'New password'} hint={isNew ? 'At least 6 characters' : 'Leave empty to keep the current one'}>
          <div className="row" style={{ gap: 6 }}><input className="input mono" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /><button className="btn small" type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div>
        </Field>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="caption" style={{ color: C.muted }}>Access</span>
        {(['Admin', 'Editor', 'Viewer'] as Access[]).map((a) => {
          const cur = builtInAdmin ? 'Admin' : f.access || 'Editor'
          const on = cur === a
          return (
            <button key={a} type="button" aria-pressed={on} disabled={builtInAdmin} onClick={() => setF({ ...f, access: a })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, textAlign: 'left', cursor: builtInAdmin ? 'default' : 'pointer', border: `1px solid ${on ? LV[a] : '#23262B'}`, background: on ? LV[a] + '14' : '#0B0C0E', color: C.text }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: on ? LV[a] : '#2A2D33' }} /><span style={{ flex: 1 }}><b style={{ fontWeight: 600, color: on ? LV[a] : C.text }}>{a}</b><span style={{ display: 'block', fontSize: 12, color: C.faint }}>{LV_TEXT[a]}</span></span>
            </button>
          )
        })}
        {builtInAdmin && <span className="caption">This is the built-in administrator.</span>}
      </div>
      <label className="row" style={{ gap: 10, cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={!!f.defaultRecipient} onChange={(e) => setF({ ...f, defaultRecipient: e.target.checked })} />Gets finance request emails by default</label>
      <div className="row" style={{ marginTop: 'auto' }}>
        {!isNew && user!.username !== me && !builtInAdmin && <button className="btn" onClick={remove} style={{ color: C.bad, borderColor: '#4A1D1D' }}>Delete</button>}
        <button className="btn primary" disabled={!valid} onClick={save} style={{ flex: 1, justifyContent: 'center', height: 44 }}>{isNew ? 'Add teammate' : 'Save'}</button>
      </div>
    </Drawer>
  )
}

export default function Admin() {
  const data = useData()
  const { update } = useStore()
  const session = useSession()
  const t = useEntrance(1300, 300)
  const [edit, setEdit] = useState<AppUser | null | 'new'>(null)
  const [backups, setBackups] = useState<{ Backups: BackupEntry[]; DailyBackups: BackupEntry[] } | null>(null)
  const [bErr, setBErr] = useState('')
  const [toast, setToast] = useState('')
  useEffect(() => { listBackups().then(setBackups).catch((e: Error) => setBErr(e.message)) }, [])

  const recipients = data.appUsers.filter((u) => u.defaultRecipient && u.email)
  const withPw = data.appUsers.filter((u) => u.password).length
  const orphans = orphanRows(data.allocs, data.products).reduce((a, o) => a + o.count, 0)
  const lastBackup = backups?.Backups[0]
  const daily = backups?.DailyBackups.length || 0

  const H: { lvl: 'ok' | 'warn' | 'bad'; title: string; text: string }[] = [
    backups && lastBackup ? { lvl: 'ok', title: 'Backups on every save', text: `Last server snapshot ${new Date(lastBackup.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${backups.Backups.length} kept + ${daily} daily.` }
      : { lvl: bErr ? 'warn' : 'ok', title: 'Backups on every save', text: bErr ? `Couldn't read the backup list: ${bErr}` : backups ? 'No snapshots listed yet — the next save creates one.' : 'Checking the server…' },
    { lvl: 'ok', title: 'Wipe protection', text: 'The app and the server both refuse a save that would erase data.' },
    { lvl: WRITE_ENABLED ? 'ok' : 'warn', title: WRITE_ENABLED ? 'Saving is on' : 'Preview mode — saving is off', text: WRITE_ENABLED ? 'Changes in this app are saved to Google Sheets.' : 'v1 is still the system of record. v2 turns saving on at cutover.' },
    { lvl: 'bad', title: 'Passwords stored as plain text', text: `${withPw} accounts. Anyone with the sheet can read them — move to Google sign-in.` },
    { lvl: 'warn', title: 'Admin is checked only in the browser', text: 'Fine for a trusted team; a server-side check comes with Google sign-in.' },
    { lvl: 'bad', title: 'Redash key in the v1 code', text: 'Still public on GitHub. Rotate it in Redash, then remove it from v1.' },
    ...(orphans ? [{ lvl: 'warn' as const, title: `${orphans} allocations point to deleted products`, text: 'They count as $0. Clean them up in Products → Needs attention.' }] : []),
  ]
  const okN = H.filter((h) => h.lvl === 'ok').length
  const L = 2 * Math.PI * 34
  const IC = { ok: ['✓', C.good, '#0F2418'], warn: ['!', C.warn, '#2A1F08'], bad: ['!', C.bad, '#2A1212'] } as const

  const download = () => {
    const body: Record<string, unknown> = {}
    for (const k of STATE_KEYS) body[k] = data[k]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }))
    a.download = `buffops-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setToast('Backup downloaded')
  }
  const toggleRecipient = (u: AppUser) => update((s) => ({ ...s, appUsers: s.appUsers.map((x) => (x.id === u.id ? { ...x, defaultRecipient: !x.defaultRecipient } : x)) }))

  return (
    <div className="page">
      <div className="between a-up">
        <div><h1 className="h1">Admin</h1><div className="sub">Team, access and system health</div></div>
        <button className="btn primary" onClick={() => setEdit('new')}>{Icon.plus}Invite teammate</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 16, alignItems: 'start' }}>
        <Card pad={false} delay={140} style={{ overflowX: 'auto' }}>
          <div className="between" style={{ alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${C.line}` }}>
            <h2 className="h2">Team <span style={{ fontWeight: 400, color: C.faint, fontSize: 13 }}>· {data.appUsers.length} people</span></h2>
            <span className="caption">{recipients.length} get finance emails</span>
          </div>
          <div style={{ minWidth: 640 }}>
            <div className="thead" style={{ gridTemplateColumns: '1.6fr 1.2fr 0.9fr 0.9fr 44px', borderBottom: 'none' }}><span>Person</span><span>Role</span><span>Access</span><span>Finance emails</span><span /></div>
            {data.appUsers.map((u, i) => {
              const a = accessOf(u)
              return (
                <div key={u.id} className="trow a-up" style={{ gridTemplateColumns: '1.6fr 1.2fr 0.9fr 0.9fr 44px', height: 64, animationDelay: `${300 + i * 70}ms` }}>
                  <span className="row" style={{ gap: 12 }}>
                    <span style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, background: LV[a] + '22', color: LV[a] }}>{(u.firstName[0] || '') + (u.lastName[0] || '')}</span>
                    <span><b style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{u.firstName} {u.lastName}{u.username === session.username && <span className="caption"> · you</span>}</b><span className="mono" style={{ fontSize: 12, color: C.faint }}>@{u.username}</span></span>
                  </span>
                  <span style={{ fontSize: 13, color: '#B4B8BF' }}>{u.role || '—'}</span>
                  <span><span className="chip" style={{ color: LV[a], background: LV[a] + '1A' }}>{a}</span></span>
                  <button role="switch" aria-checked={!!u.defaultRecipient} aria-label={`Finance emails for ${u.firstName}`} className="toggle" onClick={() => toggleRecipient(u)} disabled={!u.email} />
                  <button className="icon-btn" aria-label={`Edit ${u.firstName}`} onClick={() => setEdit(u)}>{Icon.edit}</button>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.faint, lineHeight: 1.5 }}>Access levels apply in v2. v1 ignores them: there, only the built-in admin sees Admin and Fulfillment and everyone else can edit.</div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card delay={260} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="row" style={{ gap: 16 }}>
              <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
                <svg width="84" height="84" viewBox="0 0 84 84" style={{ transform: 'rotate(-90deg)' }}><circle cx="42" cy="42" r="34" fill="none" stroke="#1F2226" strokeWidth="9" /><circle cx="42" cy="42" r="34" fill="none" stroke={okN / H.length >= 0.7 ? C.good : C.warn} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(okN / H.length) * L * t} ${L}`} /></svg>
                <div className="mono" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600 }}>{okN}/{H.length}</div>
              </div>
              <div><h2 className="h2">System health</h2><div className="caption" style={{ marginTop: 4, lineHeight: 1.45 }}>Data is protected. Access and secrets still need work.</div></div>
            </div>
            {H.map((h, i) => (
              <div key={h.title} className="row a-up" style={{ gap: 12, alignItems: 'flex-start', animationDelay: `${460 + i * 80}ms` }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, color: IC[h.lvl][1], background: IC[h.lvl][2] }}>{IC[h.lvl][0]}</span>
                <span style={{ flex: 1 }}><b style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{h.title}</b><span style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{h.text}</span></span>
              </div>
            ))}
          </Card>
          <Card delay={380} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 className="h2">Backups</h2>
            <div className="between" style={{ fontSize: 13 }}><span style={{ color: C.muted }}>Server snapshots</span><span className="mono">{backups ? backups.Backups.length : '…'}</span></div>
            <div className="between" style={{ fontSize: 13 }}><span style={{ color: C.muted }}>Daily snapshots</span><span className="mono">{backups ? daily : '…'}</span></div>
            <div className="between" style={{ fontSize: 13 }}><span style={{ color: C.muted }}>Latest</span><span className="mono" style={{ fontSize: 12 }}>{lastBackup ? lastBackup.counts.replace(/ /g, ' · ') : '—'}</span></div>
            <button className="btn" onClick={download} style={{ justifyContent: 'center', marginTop: 4 }}>Download backup now</button>
          </Card>
        </div>
      </div>
      {edit && <UserDrawer user={edit === 'new' ? null : edit} me={session.username} onClose={() => setEdit(null)} />}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </div>
  )
}
