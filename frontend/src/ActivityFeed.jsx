import { useActivity, SEVERITY } from './ActivityContext.jsx'
import {
    X, Trash2, Activity, CheckCircle2, XCircle,
    AlertTriangle, Info, AlertOctagon, Clock,
} from 'lucide-react'

const TYPE_ICONS = {
    success:  CheckCircle2,
    error:    XCircle,
    warning:  AlertTriangle,
    info:     Info,
    conflict: AlertOctagon,
}

function formatTime(date) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function formatRelative(date) {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000)
    if (diff < 5)   return 'just now'
    if (diff < 60)  return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return formatTime(date)
}

export default function ActivityFeed() {
    const { activities, feedOpen, closeFeed, clearActivities } = useActivity()

    return (
        <>
            {/* Backdrop */}
            {feedOpen && (
                <div
                    className="af-backdrop"
                    onClick={closeFeed}
                    role="presentation"
                />
            )}

            {/* Drawer */}
            <div className={`af-drawer ${feedOpen ? 'af-drawer-open' : ''}`} role="complementary" aria-label="Activity Feed">

                {/* Header */}
                <div className="af-header">
                    <div className="af-header-left">
                        <Activity size={16} className="af-header-icon" />
                        <span className="af-header-title">Activity Feed</span>
                        <span className="af-header-count">{activities.length}</span>
                    </div>
                    <div className="af-header-actions">
                        {activities.length > 0 && (
                            <button className="af-clear-btn" onClick={clearActivities} title="Clear all">
                                <Trash2 size={13} />
                            </button>
                        )}
                        <button className="af-close-btn" onClick={closeFeed} title="Close">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* OS-concept label */}
                <div className="af-concept-bar">
                    <span className="af-pulse" />
                    Observer pattern · filesystem event bus · real-time IPC
                </div>

                {/* Events List */}
                <div className="af-list">
                    {activities.length === 0 ? (
                        <div className="af-empty">
                            <Clock size={32} style={{ opacity: 0.15 }} />
                            <span>No events yet</span>
                            <span className="af-empty-hint">Events appear when you organize, upload, or modify files</span>
                        </div>
                    ) : (
                        activities.map((ev, i) => {
                            const sev = SEVERITY[ev.type] || SEVERITY.info
                            const Icon = TYPE_ICONS[ev.type] || Info
                            return (
                                <div
                                    key={ev.id}
                                    className="af-event"
                                    style={{
                                        '--ev-color': sev.color,
                                        '--ev-border': sev.border,
                                        '--ev-bg': sev.bg,
                                        animationDelay: `${Math.min(i, 5) * 30}ms`,
                                    }}
                                >
                                    <div className="af-event-icon" style={{ background: sev.bg, color: sev.color }}>
                                        <Icon size={14} />
                                    </div>
                                    <div className="af-event-body">
                                        <span className="af-event-msg">{ev.message}</span>
                                        {ev.detail && <span className="af-event-detail">{ev.detail}</span>}
                                        <div className="af-event-meta">
                                            <span className="af-event-badge" style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}>
                                                {sev.label}
                                            </span>
                                            <span className="af-event-time" title={formatTime(ev.timestamp)}>
                                                {formatRelative(ev.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="af-event-line" style={{ background: sev.color }} />
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </>
    )
}
