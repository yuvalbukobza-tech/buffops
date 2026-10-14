import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RECEIPT_ACCEPT, RECEIPT_MAX_BYTES, fetchReceipt, uploadReceipt } from '../../lib/api'
import { useStore } from '../../lib/store'
import type { Receipt, Transaction } from '../../lib/types'
import { C, Icon } from '../../ui/kit'

const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
const isImage = (m: string) => m.startsWith('image/')

/** Phone photos are often 4–8 MB. Big JPEG/PNG/WebP images are scaled to 2200px — still sharp enough to read a receipt. */
async function shrink(file: File): Promise<{ blob: Blob; name: string }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * 1048576) return { blob: file, name: file.name }
  try {
    const img = await createImageBitmap(file)
    const k = Math.min(1, 2200 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.86))
    if (!blob || blob.size >= file.size) return { blob: file, name: file.name }
    return { blob, name: file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg' }
  } catch {
    return { blob: file, name: file.name }
  }
}

function Viewer({ r, onClose }: { r: Receipt; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    let u = '', alive = true
    fetchReceipt(r.id).then((b) => { if (!alive) return; u = URL.createObjectURL(b); setUrl(u) }).catch((e: Error) => alive && setErr(e.message))
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current() }
    window.addEventListener('keydown', k)
    return () => { alive = false; window.removeEventListener('keydown', k); if (u) URL.revokeObjectURL(u) }
  }, [r.id])
  // Portal: an animated (transformed) ancestor would otherwise trap position:fixed inside the row.
  return createPortal(
    <div className="viewer a-up" role="dialog" aria-modal="true" aria-label={r.name} style={{ animationDuration: '.25s' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="row" style={{ gap: 12 }}>
        <span style={{ color: C.lime }}>{Icon.file}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
          <div className="caption">{fmtSize(r.size)} · added {new Date(r.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{r.uploadedBy ? ` by ${r.uploadedBy}` : ''}</div>
        </div>
        <a className={`btn primary${url ? '' : ' disabled'}`} href={url || undefined} download={r.name} aria-disabled={!url} style={{ pointerEvents: url ? 'auto' : 'none', opacity: url ? 1 : 0.45 }}>{Icon.download}Download</a>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>{Icon.close}</button>
      </div>
      <div className="viewer-body" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
        {err ? <span style={{ color: C.bad, fontSize: 13 }}>{err}</span>
          : !url ? <span className="row" style={{ gap: 10, color: C.muted, fontSize: 13 }}><span className="spin" />Loading receipt…</span>
          : isImage(r.mime) ? <img src={url} alt={r.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          : r.mime === 'application/pdf' ? <iframe src={url} title={r.name} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 14, background: '#fff' }} />
          : <span style={{ color: C.muted, fontSize: 13 }}>No preview for this file type — use Download.</span>}
      </div>
    </div>,
    document.body,
  )
}

export function ReceiptCount({ tx }: { tx: Transaction }) {
  const n = tx.receipts?.length || 0
  if (!n) return null
  return <span title={`${n} receipt${n === 1 ? '' : 's'} attached`} className="row" style={{ display: 'inline-flex', gap: 3, color: C.lime, fontSize: 11, fontWeight: 600, verticalAlign: 'middle', marginLeft: 6 }}>{Icon.clip}{n > 1 ? n : ''}</span>
}

export function Receipts({ tx, by, canEdit, canRemove, onToast }: { tx: Transaction; by: string; canEdit: boolean; canRemove: boolean; onToast: (t: string) => void }) {
  const { update } = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string[]>([])
  const [over, setOver] = useState(false)
  const [viewing, setViewing] = useState<Receipt | null>(null)
  const list = tx.receipts || []

  const add = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      if (!RECEIPT_ACCEPT.split(',').includes(f.type)) { onToast(`${f.name}: only images and PDF files`); continue }
      setBusy((b) => [...b, f.name])
      try {
        const { blob, name } = await shrink(f)
        if (blob.size > RECEIPT_MAX_BYTES) throw new Error('larger than 10 MB')
        const ref = await uploadReceipt(blob, name, tx.id, by)
        const rec: Receipt = { ...ref, uploadedAt: new Date().toISOString(), uploadedBy: by }
        update((s) => ({ ...s, transactions: s.transactions.map((x) => (x.id === tx.id ? { ...x, receipts: [...(x.receipts || []), rec], lastUpdate: rec.uploadedAt } : x)) }))
        onToast(`Receipt attached to #${tx.id}`)
      } catch (e) {
        onToast(`${f.name}: ${(e as Error).message}`)
      } finally {
        setBusy((b) => b.filter((n) => n !== f.name))
      }
    }
  }
  const detach = (r: Receipt) => {
    if (!window.confirm(`Remove "${r.name}" from request #${tx.id}?\n(The file stays in the "BuffOps Receipts" Drive folder.)`)) return
    update((s) => ({ ...s, transactions: s.transactions.map((x) => (x.id === tx.id ? { ...x, receipts: (x.receipts || []).filter((y) => y.id !== r.id), lastUpdate: new Date().toISOString() } : x)) }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
      <span className="caption">Receipts{list.length ? ` · ${list.length}` : ''}</span>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
        {list.map((r) => (
          <div key={r.id} className="receipt-chip" role="button" tabIndex={0} onClick={() => setViewing(r)} onKeyDown={(e) => { if (e.key === 'Enter') setViewing(r) }} title={`Open ${r.name}`}>
            <span style={{ color: isImage(r.mime) ? C.sky : C.orange, display: 'flex' }}>{Icon.file}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
              <span style={{ fontSize: 11, color: C.faint }}>{fmtSize(r.size)}{r.uploadedBy ? ` · ${r.uploadedBy}` : ''}</span>
            </span>
            {canRemove && <button className="icon-btn" aria-label={`Remove ${r.name}`} title="Remove from this request" onClick={(e) => { e.stopPropagation(); detach(r) }} style={{ width: 28, height: 28 }}>{Icon.close}</button>}
          </div>
        ))}
        {busy.map((n) => <div key={n} className="receipt-chip" style={{ cursor: 'default', color: C.muted }}><span className="spin" style={{ color: C.lime }} /><span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Uploading {n}…</span></div>)}
        {canEdit && (
          <button className={`receipt-drop${over ? ' over' : ''}`} onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) add(e.dataTransfer.files) }}>
            {Icon.clip}{list.length ? 'Add another' : 'Attach receipt'}<span style={{ fontSize: 11, color: C.faint }}>· image or PDF</span>
          </button>
        )}
        {!canEdit && !list.length && <span style={{ fontSize: 12, color: C.faint }}>No receipts attached.</span>}
      </div>
      <input ref={input} type="file" accept={RECEIPT_ACCEPT} multiple hidden onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = '' }} />
      {viewing && <Viewer r={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
