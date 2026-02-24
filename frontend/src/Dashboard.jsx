import { useState, useEffect, useRef } from 'react'
import {
    FileText, Image, Film, Music, File, HardDrive, FolderOpen,
    TrendingUp, Database, BarChart3, RotateCcw, Clock,
} from 'lucide-react'

const API = '/api'

function formatBytes(bytes) {
    if (!bytes) return '0 B'
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// ── Animated Counter ─────────────────────────────────────────────────
function AnimatedNumber({ value, duration = 1200 }) {
    const [display, setDisplay] = useState(0)
    const ref = useRef(null)

    useEffect(() => {
        if (value === 0) { setDisplay(0); return }
        let start = 0
        const startTime = Date.now()
        function tick() {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3) // ease out cubic
            setDisplay(Math.floor(eased * value))
            if (progress < 1) ref.current = requestAnimationFrame(tick)
        }
        ref.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(ref.current)
    }, [value, duration])

    return <span>{display.toLocaleString()}</span>
}

// ── Pie Chart (SVG) ──────────────────────────────────────────────────
const TYPE_COLORS = {
    Documents: '#4e9af5',
    Images: '#2dd4bf',
    Videos: '#a78bfa',
    Audio: '#f472b6',
    Others: '#64748b',
}

function PieChart({ data }) {
    const total = Object.values(data).reduce((a, b) => a + b, 0)
    if (total === 0) return <div className="pie-empty">No files</div>

    const entries = Object.entries(data).filter(([, v]) => v > 0)
    let cumulative = 0
    const segments = entries.map(([label, count]) => {
        const pct = count / total
        const start = cumulative
        cumulative += pct
        return { label, count, pct, start }
    })

    // Build conic-gradient
    const stops = segments.map(s => {
        const color = TYPE_COLORS[s.label] || '#64748b'
        return `${color} ${(s.start * 360).toFixed(1)}deg ${((s.start + s.pct) * 360).toFixed(1)}deg`
    }).join(', ')

    return (
        <div className="pie-chart-container">
            <div className="pie-chart" style={{ background: `conic-gradient(${stops})` }}>
                <div className="pie-center">
                    <span className="pie-total">{total}</span>
                    <span className="pie-label">files</span>
                </div>
            </div>
            <div className="pie-legend">
                {segments.map(s => (
                    <div key={s.label} className="legend-item">
                        <span className="legend-dot" style={{ background: TYPE_COLORS[s.label] || '#64748b' }} />
                        <span className="legend-name">{s.label}</span>
                        <span className="legend-count">{s.count}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Category Icon ────────────────────────────────────────────────────
function getCatIcon(cat) {
    const map = { Documents: FileText, Images: Image, Videos: Film, Audio: Music }
    return map[cat] || File
}

export default function Dashboard() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`${API}/stats`)
            .then(r => r.json())
            .then(data => { setStats(data); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="dashboard-page">
                <div className="dash-loading">
                    <div className="spinner" style={{ width: 32, height: 32 }} />
                    <span>Loading statistics...</span>
                </div>
            </div>
        )
    }

    if (!stats) {
        return (
            <div className="dashboard-page">
                <div className="dash-loading">
                    <span>Failed to load statistics</span>
                </div>
            </div>
        )
    }

    return (
        <div className="dashboard-page">
            <div className="dash-header">
                <h1>Dashboard</h1>
                <p>File system overview across all virtual drives</p>
            </div>

            {/* ── Stat Cards ───────────────────────────────────────────── */}
            <div className="stat-cards">
                <div className="stat-card">
                    <div className="stat-icon-wrap blue">
                        <FileText size={22} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value"><AnimatedNumber value={stats.totalFiles} /></span>
                        <span className="stat-label">Total Files</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-wrap teal">
                        <FolderOpen size={22} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value"><AnimatedNumber value={stats.totalFolders} /></span>
                        <span className="stat-label">Total Folders</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-wrap purple">
                        <Database size={22} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{formatBytes(stats.totalSize)}</span>
                        <span className="stat-label">Total Storage</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-wrap pink">
                        <TrendingUp size={22} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{stats.largestFile.name}</span>
                        <span className="stat-label">Largest File · {formatBytes(stats.largestFile.size)}</span>
                    </div>
                </div>
            </div>

            {/* ── Charts Row ───────────────────────────────────────────── */}
            <div className="dash-row">
                <div className="dash-panel">
                    <h3><BarChart3 size={16} /> File Type Distribution</h3>
                    <PieChart data={stats.typeDistribution} />
                </div>
                <div className="dash-panel">
                    <h3><HardDrive size={16} /> Disk Usage</h3>
                    <div className="disk-bars">
                        {stats.diskUsage.map(d => (
                            <div key={d.label} className="disk-bar-item">
                                <div className="disk-bar-header">
                                    <span className="disk-bar-label"><HardDrive size={14} /> {d.label}</span>
                                    <span className="disk-bar-size">{formatBytes(d.used)}</span>
                                </div>
                                <div className="disk-bar-track">
                                    <div
                                        className="disk-bar-fill"
                                        style={{
                                            width: stats.totalSize > 0 ? `${Math.max((d.used / stats.totalSize) * 100, 2)}%` : '0%'
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    {stats.totalSize > 0 && (
                        <div className="disk-total">
                            Total across all drives: <strong>{formatBytes(stats.totalSize)}</strong>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Recent Action ────────────────────────────────────────── */}
            {stats.recentAction && (
                <div className="dash-panel recent-action">
                    <h3><Clock size={16} /> Recent Action</h3>
                    <div className="action-item">
                        <div className="action-icon">
                            <RotateCcw size={18} />
                        </div>
                        <div className="action-info">
                            <span className="action-title">Organized {stats.recentAction.fileCount} file(s)</span>
                            <span className="action-path">{stats.recentAction.path}</span>
                            <span className="action-time">
                                {new Date(stats.recentAction.timestamp).toLocaleString()}
                                {stats.recentAction.undoAvailable && <span className="undo-badge">Undo Available</span>}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
