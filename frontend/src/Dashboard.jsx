import { useState, useEffect, useRef } from 'react'
import {
    FileText, Image, Film, Music, File, HardDrive, FolderOpen,
    TrendingUp, Database, RotateCcw, Clock, RefreshCw,
    Layers, BarChart2, Shield, PieChart, Activity,
} from 'lucide-react'

const API = '/api'

// ── Colour palette (100% used for real data only) ─────────────────────
const CAT_META = {
    Documents: { fill: '#4e9af5', icon: FileText },
    Images:    { fill: '#2dd4bf', icon: Image   },
    Videos:    { fill: '#a78bfa', icon: Film    },
    Audio:     { fill: '#f472b6', icon: Music   },
    Others:    { fill: '#94a3b8', icon: File    },
}
const DISK_COLORS = ['#4ade80', '#38bdf8', '#a78bfa']

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(iso) {
    return new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
}

// ── Animated Counter ──────────────────────────────────────────────────
function AnimatedNumber({ value, duration = 1200 }) {
    const [display, setDisplay] = useState(0)
    const raf = useRef(null)
    useEffect(() => {
        if (!value) { setDisplay(0); return }
        const start = Date.now()
        const tick = () => {
            const p = Math.min((Date.now() - start) / duration, 1)
            const eased = 1 - Math.pow(1 - p, 4)
            setDisplay(Math.floor(eased * value))
            if (p < 1) raf.current = requestAnimationFrame(tick)
        }
        raf.current = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf.current)
    }, [value, duration])
    return <span>{display.toLocaleString()}</span>
}

// ── Animated width bar ────────────────────────────────────────────────
function AnimatedBar({ pct, color, delay = 0 }) {
    const [width, setWidth] = useState(0)
    useEffect(() => {
        const t = setTimeout(() => setWidth(pct), 80 + delay)
        return () => clearTimeout(t)
    }, [pct, delay])
    return (
        <div className="db-bar-track">
            <div className="db-bar-fill" style={{
                width: `${width}%`,
                background: color,
                transition: `width 1.1s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
                boxShadow: `0 0 8px ${color}60`,
            }} />
        </div>
    )
}

// ── SVG Donut Chart — 100% real data ─────────────────────────────────
function DonutChart({ data }) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t) }, [])

    const total = Object.values(data).reduce((a, b) => a + b, 0)
    if (total === 0) return (
        <div className="db-empty-state">
            <File size={32} style={{ opacity: 0.18 }} />
            <span>No files indexed yet</span>
        </div>
    )

    const R = 72, STROKE = 18, C = 2 * Math.PI * R
    const entries = Object.entries(data).filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
    let cumulative = 0
    const segments = entries.map(([label, count]) => {
        const pct = count / total
        const offset = C * (1 - cumulative)
        const dash = C * pct
        cumulative += pct
        return { label, count, pct, offset, dash }
    })

    return (
        <div className="db-donut-wrap">
            <div className="db-donut-chart-col">
                <svg viewBox="0 0 200 200" className="db-donut-svg">
                    {/* Track ring */}
                    <circle cx="100" cy="100" r={R} fill="none"
                        strokeWidth={STROKE} stroke="rgba(255,255,255,0.04)" />
                    {segments.map(s => (
                        <circle key={s.label}
                            cx="100" cy="100" r={R}
                            fill="none"
                            strokeWidth={STROKE}
                            stroke={CAT_META[s.label]?.fill || '#64748b'}
                            strokeDasharray={`${mounted ? s.dash - 2 : 0} ${C}`}
                            strokeDashoffset={s.offset}
                            style={{
                                transform: 'rotate(-90deg)',
                                transformOrigin: '100px 100px',
                                transition: 'stroke-dasharray 1.3s cubic-bezier(0.4,0,0.2,1)',
                            }}
                        />
                    ))}
                    <text x="100" y="95" textAnchor="middle" fill="#fff"
                        fontSize="26" fontWeight="800" fontFamily="Inter,sans-serif">{total}</text>
                    <text x="100" y="113" textAnchor="middle" fill="rgba(255,255,255,0.3)"
                        fontSize="10" fontFamily="Inter,sans-serif" letterSpacing="1.5">FILES</text>
                </svg>
            </div>

            <div className="db-donut-legend">
                {segments.map((s, i) => {
                    const Icon = CAT_META[s.label]?.icon || File
                    const fill = CAT_META[s.label]?.fill || '#64748b'
                    return (
                        <div key={s.label} className="db-legend-row">
                            <div className="db-legend-icon" style={{ color: fill, background: `${fill}18` }}>
                                <Icon size={13} />
                            </div>
                            <span className="db-legend-name">{s.label}</span>
                            <AnimatedBar pct={s.pct * 100} color={fill} delay={i * 80} />
                            <span className="db-legend-count" style={{ color: fill }}>{s.count}</span>
                            <span className="db-legend-pct">{(s.pct * 100).toFixed(0)}%</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Per-disk detail table — 100% real data ────────────────────────────
function DiskTable({ diskUsage, totalSize }) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => { const t = setTimeout(() => setMounted(true), 150); return () => clearTimeout(t) }, [])

    return (
        <div className="db-disk-table">
            <div className="db-disk-table-head">
                <span>Drive</span>
                <span>Used</span>
                <span>Share</span>
                <span>Capacity</span>
            </div>
            {diskUsage.map((d, i) => {
                const pct = totalSize > 0
                    ? ((d.used / totalSize) * 100)
                    : 0
                const color = DISK_COLORS[i % DISK_COLORS.length]
                return (
                    <div key={d.label} className="db-disk-table-row">
                        <span className="db-disk-drive-label">
                            <HardDrive size={14} style={{ color }} />
                            {d.label}
                        </span>
                        <span className="db-disk-used-val">{formatBytes(d.used)}</span>
                        <span className="db-disk-pct-val" style={{ color }}>
                            {pct.toFixed(1)}%
                        </span>
                        <div className="db-disk-bar-track">
                            <div className="db-disk-bar-fill" style={{
                                width: mounted
                                    ? `${Math.max(pct, d.used > 0 ? 2 : 0)}%`
                                    : '0%',
                                background: color,
                                boxShadow: `0 0 8px ${color}70`,
                                transition: `width 1.3s cubic-bezier(0.4,0,0.2,1) ${150 + i * 100}ms`,
                            }} />
                        </div>
                    </div>
                )
            })}
            <div className="db-disk-table-footer">
                <span>Total across {diskUsage.length} drives</span>
                <span className="db-disk-total-val">{formatBytes(totalSize)}</span>
            </div>
        </div>
    )
}

// ── Storage by Category bar chart — 100% real data ──────────────────
function CategoryChart({ typeDistribution, totalFiles }) {
    const entries = Object.entries(typeDistribution)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)

    if (entries.length === 0) return (
        <div className="db-empty-state">
            <Activity size={32} style={{ opacity: 0.18 }} />
            <span>No files to analyse</span>
        </div>
    )

    const max = Math.max(...entries.map(([, v]) => v))

    return (
        <div className="db-cat-chart">
            {entries.map(([label, count], i) => {
                const fill = CAT_META[label]?.fill || '#64748b'
                const Icon = CAT_META[label]?.icon || File
                const pct = (count / max) * 100
                const sharePct = totalFiles > 0 ? ((count / totalFiles) * 100).toFixed(1) : 0
                return (
                    <div key={label} className="db-cat-row">
                        <div className="db-cat-label">
                            <span className="db-cat-icon" style={{ color: fill, background: `${fill}18` }}>
                                <Icon size={13} />
                            </span>
                            <span className="db-cat-name">{label}</span>
                        </div>
                        <AnimatedBar pct={pct} color={fill} delay={i * 70} />
                        <div className="db-cat-stats">
                            <span style={{ color: fill, fontWeight: 700 }}>{count}</span>
                            <span className="db-cat-share">{sharePct}%</span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ── Main Dashboard ────────────────────────────────────────────────────
export default function Dashboard() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [scannedAt, setScannedAt] = useState(null)
    const [refreshKey, setRefreshKey] = useState(0)

    const load = () => {
        setLoading(true)
        fetch(`${API}/stats`)
            .then(r => r.json())
            .then(data => {
                setStats(data)
                setScannedAt(new Date())
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }

    useEffect(load, [refreshKey])

    if (loading) return (
        <div className="db-page">
            <div className="db-loading">
                <div className="db-loading-orb" />
                <span>Scanning virtual drives…</span>
            </div>
        </div>
    )

    if (!stats) return (
        <div className="db-page">
            <div className="db-loading">
                <span style={{ color: '#f87171' }}>Failed to load — is the backend running?</span>
            </div>
        </div>
    )

    const totalFiles = stats.totalFiles || 0
    const totalFolders = stats.totalFolders || 0
    const totalSize = stats.totalSize || 0
    const typeCount = Object.keys(stats.typeDistribution || {}).length

    return (
        <div className="db-page">
            <div className="db-glow-1" />
            <div className="db-glow-2" />

            {/* ── Header ── */}
            <div className="db-header">
                <div>
                    <h1 className="db-title">
                        <BarChart2 size={24} className="db-title-icon" />
                        Analytics Dashboard
                    </h1>
                    <p className="db-subtitle">
                        Live filesystem statistics · {scannedAt ? `Last scanned ${scannedAt.toLocaleTimeString()}` : 'Scanning…'}
                    </p>
                </div>
                <button className="db-refresh-btn" onClick={() => setRefreshKey(k => k + 1)}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* ── KPI Strip ── */}
            <div className="db-kpi-row">
                <div className="db-kpi-card db-kpi-green">
                    <div className="db-kpi-icon"><FileText size={18} /></div>
                    <div className="db-kpi-num-wrap">
                        <span className="db-kpi-num"><AnimatedNumber value={totalFiles} /></span>
                    </div>
                    <span className="db-kpi-label">Total Files</span>
                    <div className="db-kpi-glow" />
                </div>
                <div className="db-kpi-card db-kpi-teal">
                    <div className="db-kpi-icon"><FolderOpen size={18} /></div>
                    <div className="db-kpi-num-wrap">
                        <span className="db-kpi-num"><AnimatedNumber value={totalFolders} /></span>
                    </div>
                    <span className="db-kpi-label">Folders</span>
                    <div className="db-kpi-glow" />
                </div>
                <div className="db-kpi-card db-kpi-purple">
                    <div className="db-kpi-icon"><Database size={18} /></div>
                    <div className="db-kpi-num-wrap">
                        <span className="db-kpi-num db-kpi-num-md">{formatBytes(totalSize)}</span>
                    </div>
                    <span className="db-kpi-label">Indexed Storage</span>
                    <div className="db-kpi-glow" />
                </div>
                <div className="db-kpi-card db-kpi-amber">
                    <div className="db-kpi-icon"><PieChart size={18} /></div>
                    <div className="db-kpi-num-wrap">
                        <span className="db-kpi-num"><AnimatedNumber value={typeCount} /></span>
                    </div>
                    <span className="db-kpi-label">File Categories</span>
                    <div className="db-kpi-glow" />
                </div>
                <div className="db-kpi-card db-kpi-rose">
                    <div className="db-kpi-icon"><TrendingUp size={18} /></div>
                    <div className="db-kpi-num-wrap">
                        <span className="db-kpi-num db-kpi-num-sm" title={stats.largestFile.name}>
                            {stats.largestFile.name !== '—'
                                ? stats.largestFile.name.length > 12
                                    ? stats.largestFile.name.slice(0, 12) + '…'
                                    : stats.largestFile.name
                                : '—'}
                        </span>
                    </div>
                    <span className="db-kpi-label">
                        Largest · {stats.largestFile.size > 0 ? formatBytes(stats.largestFile.size) : 'N/A'}
                    </span>
                    <div className="db-kpi-glow" />
                </div>
            </div>

            {/* ── Charts Row ── */}
            <div className="db-main-row">

                {/* Donut — real typeDistribution data */}
                <div className="db-panel">
                    <div className="db-panel-header">
                        <Layers size={15} />
                        <span>File Type Distribution</span>
                        <span className="db-panel-badge">{totalFiles} files</span>
                    </div>
                    <DonutChart data={stats.typeDistribution} />
                </div>

                {/* Disk table — real diskUsage data */}
                <div className="db-panel">
                    <div className="db-panel-header">
                        <HardDrive size={15} />
                        <span>Virtual Disk Usage</span>
                        <span className="db-panel-badge">{stats.diskUsage.length} drives</span>
                    </div>
                    <DiskTable diskUsage={stats.diskUsage} totalSize={totalSize} />
                </div>
            </div>

            {/* ── Second Row ── */}
            <div className="db-second-row">

                {/* Category breakdown bar chart — real data */}
                <div className="db-panel">
                    <div className="db-panel-header">
                        <BarChart2 size={15} />
                        <span>Files by Category</span>
                        <span className="db-panel-badge">{typeCount} types</span>
                    </div>
                    <CategoryChart
                        typeDistribution={stats.typeDistribution}
                        totalFiles={totalFiles} />
                </div>

                {/* Recent action + system info — real data */}
                <div className="db-panel">
                    <div className="db-panel-header">
                        <Clock size={15} />
                        <span>Last Organize Action</span>
                    </div>

                    {stats.recentAction ? (
                        <div className="db-recent-card">
                            <div className="db-recent-icon-wrap">
                                <RotateCcw size={18} />
                            </div>
                            <div className="db-recent-detail">
                                <div className="db-recent-row">
                                    <span className="db-recent-key">Files moved</span>
                                    <span className="db-recent-val db-green">{stats.recentAction.fileCount}</span>
                                </div>
                                <div className="db-recent-row">
                                    <span className="db-recent-key">Target path</span>
                                    <span className="db-recent-val db-mono">{stats.recentAction.path}</span>
                                </div>
                                <div className="db-recent-row">
                                    <span className="db-recent-key">Timestamp</span>
                                    <span className="db-recent-val">{formatDate(stats.recentAction.timestamp)}</span>
                                </div>
                                <div className="db-recent-row">
                                    <span className="db-recent-key">Undo</span>
                                    {stats.recentAction.undoAvailable
                                        ? <span className="db-badge-green">Available</span>
                                        : <span className="db-badge-muted">Not available</span>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="db-empty-state">
                            <RotateCcw size={28} style={{ opacity: 0.15 }} />
                            <span>No organize actions recorded</span>
                            <span className="db-empty-hint">Go to Explorer → Organize This Folder</span>
                        </div>
                    )}

                    {/* System info divider */}
                    <div className="db-sys-info-grid">
                        <div className="db-sys-item">
                            <HardDrive size={13} />
                            <span>{stats.diskUsage.length} Virtual Disks</span>
                        </div>
                        <div className="db-sys-item">
                            <Shield size={13} />
                            <span>Sandboxed</span>
                        </div>
                        <div className="db-sys-item">
                            <FileText size={13} />
                            <span>{typeCount} Types</span>
                        </div>
                        <div className="db-sys-item db-sys-online">
                            <span className="db-pulse-dot" />
                            <span>Online</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    )
}
