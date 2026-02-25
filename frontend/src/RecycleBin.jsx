import { useState, useEffect, useCallback } from 'react'
import {
    Trash2, RotateCcw, X, HardDrive, File, Folder,
    AlertTriangle, Flame, RefreshCw, Clock,
} from 'lucide-react'
import { useActivity } from './ActivityContext.jsx'

const API = '/api'

function formatBytes(bytes) {
    if (!bytes) return '—'
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDeletedAt(iso) {
    const d = new Date(iso)
    const diff = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diff < 60)   return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ── RecycleBin context values (exported for Navbar badge) ─────────────
export let recycleBinCount = 0
export const recycleBinListeners = new Set()
function notifyCount(n) {
    recycleBinCount = n
    recycleBinListeners.forEach(fn => fn(n))
}

// ── Drawer Component ──────────────────────────────────────────────────
export default function RecycleBin({ open, onClose, onRestored }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [confirm, setConfirm] = useState(null) // 'empty' | { id, name }
    const [restoring, setRestoring] = useState(null)
    const { addActivity } = useActivity()

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const r = await fetch(`${API}/trash`)
            const data = await r.json()
            setItems(data.items || [])
            notifyCount(data.count || 0)
        } catch {
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (open) load()
    }, [open, load])

    // ── Restore ──────────────────────────────────────────────────────
    const restore = useCallback(async (item) => {
        setRestoring(item.id)
        try {
            const r = await fetch(`${API}/trash/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id }),
            })
            const data = await r.json()
            if (data.success) {
                addActivity(
                    `Restored: ${item.originalName}`,
                    'success',
                    `→ ${data.restoredTo}`,
                )
                await load()
                if (onRestored) onRestored(data.restoredTo)
            } else {
                addActivity(data.error || 'Restore failed', 'error')
            }
        } catch {
            addActivity('Restore failed — network error', 'error')
        } finally {
            setRestoring(null)
        }
    }, [load, addActivity, onRestored])

    // ── Permanent delete single ───────────────────────────────────────
    const permanentDelete = useCallback(async (item) => {
        setConfirm(null)
        try {
            const r = await fetch(`${API}/trash/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id }),
            })
            const data = await r.json()
            if (data.success) {
                addActivity(`Permanently deleted: ${item.originalName}`, 'warning')
                await load()
            } else {
                addActivity(data.error || 'Delete failed', 'error')
            }
        } catch {
            addActivity('Permanent delete failed', 'error')
        }
    }, [load, addActivity])

    // ── Empty bin ────────────────────────────────────────────────────
    const emptyBin = useCallback(async () => {
        setConfirm(null)
        try {
            const r = await fetch(`${API}/trash/empty`, { method: 'POST' })
            const data = await r.json()
            if (data.success) {
                addActivity(
                    `Recycle Bin emptied — ${items.length} item(s) permanently deleted`,
                    'warning',
                )
                setItems([])
                notifyCount(0)
            }
        } catch {
            addActivity('Failed to empty bin', 'error')
        }
    }, [items.length, addActivity])

    const totalSize = items.reduce((s, i) => s + (i.size || 0), 0)

    return (
        <>
            {/* Backdrop */}
            {open && (
                <div className="rb-backdrop" onClick={onClose} role="presentation" />
            )}

            {/* Drawer */}
            <div className={`rb-drawer ${open ? 'rb-drawer-open' : ''}`}
                role="complementary" aria-label="Recycle Bin">

                {/* Header */}
                <div className="rb-header">
                    <div className="rb-header-left">
                        <div className="rb-header-icon-wrap">
                            <Trash2 size={16} />
                        </div>
                        <div>
                            <div className="rb-header-title">Recycle Bin</div>
                            <div className="rb-header-sub">
                                {items.length} item{items.length !== 1 ? 's' : ''}
                                {totalSize > 0 && ` · ${formatBytes(totalSize)}`}
                            </div>
                        </div>
                    </div>
                    <div className="rb-header-actions">
                        <button className="rb-icon-btn" onClick={load} title="Refresh" disabled={loading}>
                            <RefreshCw size={14} className={loading ? 'rb-spin' : ''} />
                        </button>
                        {items.length > 0 && (
                            <button
                                className="rb-empty-btn"
                                onClick={() => setConfirm('empty')}
                                title="Empty Recycle Bin"
                            >
                                <Flame size={13} /> Empty
                            </button>
                        )}
                        <button className="rb-icon-btn rb-close" onClick={onClose}>
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Item list */}
                <div className="rb-list">
                    {loading ? (
                        <div className="rb-loading">
                            <div className="rb-spin-lg" />
                            <span>Loading…</span>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="rb-empty">
                            <Trash2 size={40} style={{ opacity: 0.1 }} />
                            <span>Recycle Bin is empty</span>
                            <span className="rb-empty-hint">Deleted files will appear here</span>
                        </div>
                    ) : (
                        items.map((item, i) => (
                            <div key={item.id} className="rb-item"
                                style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                                <div className="rb-item-icon">
                                    {item.isDirectory
                                        ? <Folder size={18} color="#f0b429" />
                                        : <File size={18} color="#94a3b8" />}
                                </div>
                                <div className="rb-item-info">
                                    <span className="rb-item-name" title={item.originalName}>
                                        {item.originalName}
                                    </span>
                                    <span className="rb-item-path" title={item.originalVirtualPath}>
                                        <HardDrive size={10} />
                                        {item.originalVirtualPath}
                                    </span>
                                    <div className="rb-item-meta">
                                        <span className="rb-item-time">
                                            <Clock size={10} /> {formatDeletedAt(item.deletedAt)}
                                        </span>
                                        {item.size != null && (
                                            <span className="rb-item-size">{formatBytes(item.size)}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="rb-item-actions">
                                    <button
                                        className="rb-restore-btn"
                                        onClick={() => restore(item)}
                                        disabled={restoring === item.id}
                                        title="Restore to original location"
                                    >
                                        {restoring === item.id
                                            ? <RefreshCw size={13} className="rb-spin" />
                                            : <RotateCcw size={13} />}
                                    </button>
                                    <button
                                        className="rb-del-btn"
                                        onClick={() => setConfirm(item)}
                                        title="Delete permanently"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* OS concept footer */}
                <div className="rb-footer">
                    <span className="rb-footer-dot" />
                    Soft-delete · metadata sidecar · atomic restore
                </div>
            </div>

            {/* Confirm dialogs */}
            {confirm && (
                <div className="rb-confirm-overlay" onClick={() => setConfirm(null)}>
                    <div className="rb-confirm-box" onClick={e => e.stopPropagation()}>
                        <div className="rb-confirm-icon">
                            <AlertTriangle size={22} />
                        </div>
                        <div className="rb-confirm-title">
                            {confirm === 'empty'
                                ? `Empty Recycle Bin?`
                                : `Permanently Delete?`}
                        </div>
                        <div className="rb-confirm-body">
                            {confirm === 'empty'
                                ? `This will permanently erase all ${items.length} item(s). This cannot be undone.`
                                : `"${confirm.originalName}" will be permanently erased. This cannot be undone.`}
                        </div>
                        <div className="rb-confirm-actions">
                            <button className="rb-confirm-cancel" onClick={() => setConfirm(null)}>
                                Cancel
                            </button>
                            <button
                                className="rb-confirm-delete"
                                onClick={() => confirm === 'empty' ? emptyBin() : permanentDelete(confirm)}
                            >
                                <Flame size={14} />
                                {confirm === 'empty' ? 'Empty Bin' : 'Delete Forever'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
