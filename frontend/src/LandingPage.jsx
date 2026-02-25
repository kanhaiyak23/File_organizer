import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import {
    FolderOpen, HardDrive, FileSearch, FileType, RotateCcw,
    AlertCircle, Server, Zap, Shield, BarChart3, Layout, ArrowRight,
    Cpu, Network, FolderTree, FileCheck,
} from 'lucide-react'

// ── Fade-in wrapper ──────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '' }) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: '-60px' })
    return (
        <motion.div
            ref={ref}
            className={className}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay, ease: 'easeOut' }}
        >
            {children}
        </motion.div>
    )
}

// ── Data ─────────────────────────────────────────────────────────────
const osConcepts = [
    { icon: HardDrive,  title: 'File System Management',   desc: 'Simulates virtual disk drives with real filesystem operations using the Node.js fs module.' },
    { icon: FolderTree, title: 'Directory Traversal',      desc: 'Recursive tree scanning to build folder hierarchies and navigate complex directory structures.' },
    { icon: FileSearch, title: 'Path Resolution',          desc: 'Virtual-to-real path mapping with sandboxed access control preventing directory traversal attacks.' },
    { icon: FileType,   title: 'File Metadata Handling',   desc: 'Extraction of file size, timestamps, extensions, and MIME types for intelligent categorization.' },
    { icon: RotateCcw,  title: 'Transactional Rollback',   desc: 'Undo mechanism logs every file move, enabling full reversal of the last organization action.' },
    { icon: AlertCircle,title: 'Conflict Detection',       desc: 'Pre-upload duplicate scanning with user-driven resolution: replace, rename, or skip.' },
    { icon: Server,     title: 'Disk Simulation',          desc: 'Multiple virtual drives (C:, D:, E:) mapped to isolated directories simulating OS-level partitions.' },
]

const features = [
    { icon: Zap,        title: 'Smart Folder Organization', desc: 'Auto-categorize files into Documents, Images, Videos, Audio, and Others.' },
    { icon: Shield,     title: 'Duplicate File Handling',   desc: 'Detect conflicts before upload with replace, rename, or skip options.' },
    { icon: RotateCcw,  title: 'Undo Last Action',          desc: 'One-click reversal of the most recent organization with empty folder cleanup.' },
    { icon: BarChart3,  title: 'Analytics Dashboard',       desc: 'Visualize storage usage, file distribution, and disk space at a glance.' },
    { icon: Layout,     title: 'Explorer-Style UI',         desc: 'Windows-inspired file browser with list/grid views, breadcrumbs, and context menus.' },
]

// ── Bar chart heights for Behavioral Analysis card ───────────────────
const barHeights = [30, 40, 50, 60, 75, 85, 95]

// ─────────────────────────────────────────────────────────────────────
// FileSystemVisual — animated file-explorer window for hero right side
// ─────────────────────────────────────────────────────────────────────
const fileTree = [
    { name: 'C:/', type: 'disk', expanded: true, depth: 0 },
    { name: 'Documents', type: 'folder', depth: 1, files: 14 },
    { name: 'report_2025.pdf', type: 'pdf', depth: 2, size: '2.4 MB', active: true },
    { name: 'notes.txt', type: 'txt', depth: 2, size: '18 KB' },
    { name: 'Images', type: 'folder', depth: 1, files: 38 },
    { name: 'wallpaper.png', type: 'img', depth: 2, size: '4.1 MB' },
    { name: 'Others', type: 'folder', depth: 1, files: 7 },
]

const diskUsage = [
    { label: 'Documents', pct: 42, color: '#38bdf8' },
    { label: 'Images',    pct: 71, color: '#a78bfa' },
    { label: 'Videos',    pct: 28, color: '#4ade80' },
    { label: 'Others',    pct: 15, color: '#fb923c' },
]

const typeIcon = {
    disk:   '💾',
    folder: '📁',
    pdf:    '📄',
    txt:    '📝',
    img:    '🖼️',
}

function FileSystemVisual() {
    const [activeRow, setActiveRow] = useState(2)
    const [scanPct, setScanPct] = useState(0)
    const [organising, setOrganising] = useState(false)
    const [done, setDone] = useState(false)

    // Cycle the active row
    useEffect(() => {
        const rows = [2, 3, 5]
        let idx = 0
        const interval = setInterval(() => {
            idx = (idx + 1) % rows.length
            setActiveRow(rows[idx])
        }, 1800)
        return () => clearInterval(interval)
    }, [])

    // Scan + organise loop
    useEffect(() => {
        let frame
        let pct = 0
        let dir = 1
        const tick = () => {
            pct += dir * 0.6
            if (pct >= 100) { pct = 100; dir = -1; setOrganising(true); setDone(false) }
            if (pct <= 0)   { pct = 0;   dir = 1;  setOrganising(false); setDone(true)
                setTimeout(() => setDone(false), 1200)
            }
            setScanPct(Math.round(pct))
            frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [])

    return (
        <div className="fsv-shell">
            {/* Glow rings behind the card */}
            <div className="fsv-glow-ring fsv-glow-1" />
            <div className="fsv-glow-ring fsv-glow-2" />

            {/* Window chrome */}
            <div className="fsv-window">
                {/* Title bar */}
                <div className="fsv-titlebar">
                    <div className="fsv-dots">
                        <span className="fsv-dot fsv-dot-red" />
                        <span className="fsv-dot fsv-dot-yellow" />
                        <span className="fsv-dot fsv-dot-green" />
                    </div>
                    <div className="fsv-title-label">
                        <HardDrive size={12} /> FileOS Explorer
                    </div>
                    <div className={`fsv-status-pill ${organising ? 'fsv-pill-organising' : done ? 'fsv-pill-done' : 'fsv-pill-scanning'}`}>
                        {organising ? '⚡ Organising…' : done ? '✓ Done' : `🔍 Scanning ${scanPct}%`}
                    </div>
                </div>

                {/* Body: tree + disk usage */}
                <div className="fsv-body">
                    {/* File tree pane */}
                    <div className="fsv-tree-pane">
                        <div className="fsv-pane-label">File Tree</div>
                        {fileTree.map((node, i) => (
                            <div
                                key={i}
                                className={`fsv-row ${i === activeRow ? 'fsv-row-active' : ''}`}
                                style={{ paddingLeft: `${node.depth * 16 + 10}px` }}
                            >
                                <span className="fsv-row-icon">{typeIcon[node.type]}</span>
                                <span className="fsv-row-name">{node.name}</span>
                                {node.files && <span className="fsv-row-count">{node.files}</span>}
                                {node.size  && <span className="fsv-row-size">{node.size}</span>}
                                {i === activeRow && <span className="fsv-row-beam" />}
                            </div>
                        ))}
                    </div>

                    {/* Disk usage pane */}
                    <div className="fsv-disk-pane">
                        <div className="fsv-pane-label">Disk C: Usage</div>
                        {diskUsage.map((d, i) => (
                            <div key={i} className="fsv-disk-row">
                                <span className="fsv-disk-label">{d.label}</span>
                                <div className="fsv-disk-track">
                                    <div
                                        className="fsv-disk-fill"
                                        style={{
                                            width: organising ? `${Math.min(d.pct + 10, 90)}%` : `${d.pct}%`,
                                            background: d.color,
                                            boxShadow: `0 0 8px ${d.color}66`,
                                        }}
                                    />
                                </div>
                                <span className="fsv-disk-pct" style={{ color: d.color }}>{d.pct}%</span>
                            </div>
                        ))}

                        {/* Scan progress bar */}
                        <div className="fsv-scan-bar-wrap">
                            <div className="fsv-scan-bar-label">
                                <span>Scan Progress</span>
                                <span>{scanPct}%</span>
                            </div>
                            <div className="fsv-scan-track">
                                <div className="fsv-scan-fill" style={{ width: `${scanPct}%` }} />
                            </div>
                        </div>

                        {/* Transfer activity */}
                        <div className="fsv-activity">
                            <div className="fsv-act-label">Transfer Activity</div>
                            <div className="fsv-act-bars">
                                {[60, 40, 80, 55, 75, 30, 90, 50].map((h, i) => (
                                    <div
                                        key={i}
                                        className="fsv-act-bar"
                                        style={{
                                            height: `${h}%`,
                                            animationDelay: `${i * 0.15}s`,
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom status bar */}
                <div className="fsv-statusbar">
                    <span className="fsv-sb-item">📁 3 Drives</span>
                    <span className="fsv-sb-item">📄 59 Files</span>
                    <span className="fsv-sb-item">🔒 Sandboxed</span>
                    <span className="fsv-sb-item fsv-sb-live">● Live</span>
                </div>
            </div>

            {/* Floating connecting lines / data beams */}
            <svg className="fsv-beams" viewBox="0 0 400 300" fill="none">
                <path className="fsv-beam-path" d="M380 20 Q420 80 380 140" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" />
                <path className="fsv-beam-path fsv-beam-delay" d="M380 160 Q430 200 380 240" stroke="#4ade80" strokeWidth="1" strokeDasharray="4 4" />
                <circle className="fsv-beam-dot" cx="380" cy="20" r="3" fill="#38bdf8" />
                <circle className="fsv-beam-dot fsv-beam-delay" cx="380" cy="160" r="3" fill="#4ade80" />
            </svg>
        </div>
    )
}


export default function LandingPage() {
    const navigate = useNavigate()
    const [isVisible, setIsVisible] = useState(false)
    const [stars, setStars] = useState([])
    const [particles, setParticles] = useState([])

    useEffect(() => {
        setIsVisible(true)

        setStars(Array.from({ length: 50 }, () => ({
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 2 + 1,
            delay: Math.random() * 3,
        })))

        setParticles(Array.from({ length: 20 }, () => ({
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 4 + 2,
            speed: Math.random() * 20 + 10,
        })))
    }, [])

    return (
        <main className="lp-root">

            {/* ── Animated Background ──────────────────────────────── */}
            <div className="lp-bg">
                {/* Floating gradient orbs */}
                <div className="lp-orb lp-orb-1" />
                <div className="lp-orb lp-orb-2" />
                <div className="lp-orb lp-orb-3" />

                {/* Twinkling stars */}
                {stars.map((s, i) => (
                    <div
                        key={`star-${i}`}
                        className="lp-star"
                        style={{
                            left: `${s.x}%`,
                            top: `${s.y}%`,
                            width: `${s.size}px`,
                            height: `${s.size}px`,
                            animationDelay: `${s.delay}s`,
                            boxShadow: `0 0 ${s.size * 2}px rgba(255,255,255,0.5)`,
                        }}
                    />
                ))}

                {/* Floating particles */}
                {particles.map((p, i) => (
                    <div
                        key={`particle-${i}`}
                        className="lp-particle"
                        style={{
                            left: `${p.x}%`,
                            top: `${p.y}%`,
                            width: `${p.size}px`,
                            height: `${p.size}px`,
                            animationDuration: `${p.speed}s`,
                            animationDelay: `${i * 0.5}s`,
                        }}
                    />
                ))}

                {/* Orbiting rings */}
                <div className="lp-rings-center">
                    {[1, 2, 3, 4].map((ring) => (
                        <div
                            key={`ring-${ring}`}
                            className="lp-ring"
                            style={{
                                width: `${ring * 200}px`,
                                height: `${ring * 200}px`,
                                animationDuration: `${ring * 15}s`,
                                animationDirection: ring % 2 === 0 ? 'reverse' : 'normal',
                            }}
                        >
                            {Array.from({ length: ring * 2 }).map((_, i) => (
                                <div
                                    key={`dot-${ring}-${i}`}
                                    className="lp-ring-dot"
                                    style={{
                                        transform: `rotate(${(360 / (ring * 2)) * i}deg) translateX(${ring * 100}px)`,
                                    }}
                                />
                            ))}
                        </div>
                    ))}
                </div>

                {/* Subtle grid */}
                <div className="lp-grid" />

                {/* Shooting stars */}
                {[1, 2, 3].map((i) => (
                    <div
                        key={`shoot-${i}`}
                        className="lp-shoot"
                        style={{ animationDelay: `${i * 5}s` }}
                    />
                ))}
            </div>

            {/* ── Hero Section ─────────────────────────────────────── */}
            <section className="lp-hero">
                {/* LEFT — Text */}
                <motion.div
                    className="lp-hero-left"
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                >
                    <div className="lp-badge">
                        <Cpu size={14} /> OS Concepts Project
                    </div>

                    <h1 className={`lp-hero-title ${isVisible ? 'lp-visible' : 'lp-hidden'}`}>
                        <span className="lp-hero-gradient">FileOS</span>
                    </h1>

                    <p className="lp-hero-tagline">Virtual disk management, built on real OS principles.</p>

                    <p className={`lp-hero-sub ${isVisible ? 'lp-visible' : 'lp-hidden'} lp-delay-300`}>
                        Upload, organize, and explore files across virtual drives — powered by
                        Node.js filesystem APIs, conflict detection, and transactional undo.
                    </p>

                    <div className={`lp-hero-stats ${isVisible ? 'lp-visible' : 'lp-hidden'} lp-delay-400`}>
                        <div className="lp-hero-stat">
                            <span className="lp-stat-num">3</span>
                            <span className="lp-stat-label">Virtual Disks</span>
                        </div>
                        <div className="lp-hero-stat-div" />
                        <div className="lp-hero-stat">
                            <span className="lp-stat-num">7+</span>
                            <span className="lp-stat-label">OS Concepts</span>
                        </div>
                        <div className="lp-hero-stat-div" />
                        <div className="lp-hero-stat">
                            <span className="lp-stat-num">∞</span>
                            <span className="lp-stat-label">Undo History</span>
                        </div>
                    </div>

                    <div className={`lp-hero-actions ${isVisible ? 'lp-visible' : 'lp-hidden'} lp-delay-500`}>
                        <button className="lp-btn-primary" onClick={() => navigate('/explorer')}>
                            Launch Explorer <ArrowRight size={16} />
                        </button>
                        <button className="lp-btn-secondary" onClick={() => navigate('/dashboard')}>
                            <BarChart3 size={16} /> View Dashboard
                        </button>
                    </div>
                </motion.div>

                {/* RIGHT — Animated File System Visual */}
                <motion.div
                    className="lp-hero-right"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
                >
                    <FileSystemVisual />
                </motion.div>

                <div className="lp-hero-glow" />
            </section>

            {/* ── Feature Cards Grid ───────────────────────────────── */}
            <section className="lp-section lp-cards-section">
                <div className="lp-grid-4">

                    {/* Card 1 — Smart Organization */}
                    <FadeIn delay={0.1}>
                        <div className="lp-card lp-card-blue">
                            <h3 className="lp-card-title">Smart Organization</h3>
                            <div className="lp-card-inner">
                                <div className="lp-card-header-row">
                                    <div className="lp-card-dots">
                                        <span /><span />
                                    </div>
                                    <div className="lp-badge-pulse">Active</div>
                                </div>
                                <div className="lp-stack">
                                    <div className="lp-stack-item">Pattern Scan</div>
                                    <div className="lp-stack-item lp-stack-accent">AI Categorization</div>
                                </div>
                            </div>
                            <p className="lp-card-desc">Auto-sorts files into Documents, Images, Videos, Audio & more</p>
                        </div>
                    </FadeIn>

                    {/* Card 2 — Disk Analytics */}
                    <FadeIn delay={0.2}>
                        <div className="lp-card lp-card-purple">
                            <h3 className="lp-card-title">Disk Analytics</h3>
                            <div className="lp-card-inner">
                                <div className="lp-chart-label">
                                    <span>Storage Usage</span>
                                    <span className="lp-chart-badge">↗ +12%</span>
                                </div>
                                <div className="lp-bar-chart">
                                    {barHeights.map((h, i) => (
                                        <div
                                            key={i}
                                            className="lp-bar"
                                            style={{
                                                height: `${h}%`,
                                                animationDelay: `${i * 100}ms`,
                                                opacity: 0.7 + i * 0.04,
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <p className="lp-card-desc">Visualize storage usage and file distribution across drives</p>
                        </div>
                    </FadeIn>

                    {/* Card 3 — Conflict Detection */}
                    <FadeIn delay={0.3}>
                        <div className="lp-card lp-card-green">
                            <h3 className="lp-card-title">Conflict Detection</h3>
                            <div className="lp-card-inner lp-donut-wrap">
                                <div className="lp-donut-item">
                                    <svg className="lp-donut" viewBox="0 0 64 64">
                                        <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                                        <circle
                                            cx="32" cy="32" r="28"
                                            stroke="#38bdf8" strokeWidth="4" fill="none"
                                            strokeDasharray="176" strokeDashoffset="18"
                                            strokeLinecap="round"
                                            className="lp-donut-ring"
                                        />
                                    </svg>
                                    <div>
                                        <p className="lp-donut-val">90%</p>
                                        <p className="lp-donut-sub">resolved</p>
                                    </div>
                                </div>
                                <div className="lp-donut-item">
                                    <svg className="lp-donut" viewBox="0 0 64 64">
                                        <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                                        <circle
                                            cx="32" cy="32" r="28"
                                            stroke="#a78bfa" strokeWidth="4" fill="none"
                                            strokeDasharray="176" strokeDashoffset="35"
                                            strokeLinecap="round"
                                            className="lp-donut-ring lp-donut-delay"
                                        />
                                    </svg>
                                    <div>
                                        <p className="lp-donut-val">85%</p>
                                        <p className="lp-donut-sub">auto-renamed</p>
                                    </div>
                                </div>
                            </div>
                            <p className="lp-card-desc">Duplicate detection with replace, rename, or skip options</p>
                        </div>
                    </FadeIn>

                    {/* Card 4 — Transactional Rollback */}
                    <FadeIn delay={0.4}>
                        <div className="lp-card lp-card-orange">
                            <h3 className="lp-card-title">Rollback Engine</h3>
                            <div className="lp-card-inner">
                                {[
                                    { label: 'Documents', pct: 80, positive: true },
                                    { label: 'Images',    pct: 65, positive: true },
                                    { label: 'Videos',    pct: 40, positive: false },
                                    { label: 'Audio',     pct: 55, positive: true },
                                    { label: 'Others',    pct: 25, positive: false },
                                ].map((item, i) => (
                                    <div key={i} className="lp-row-bar" style={{ animationDelay: `${i * 100}ms` }}>
                                        <span className="lp-row-label">{item.label}</span>
                                        <div className="lp-row-track">
                                            <div
                                                className={`lp-row-fill ${item.positive ? 'lp-fill-green' : 'lp-fill-orange'}`}
                                                style={{ width: `${item.pct}%` }}
                                            />
                                        </div>
                                        <span className={`lp-row-pct ${item.positive ? 'lp-text-green' : 'lp-text-orange'}`}>
                                            {item.pct}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <p className="lp-card-desc">Full undo with transaction log and empty-folder cleanup</p>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* ── OS Concepts ──────────────────────────────────────── */}
            <section className="lp-section">
                <FadeIn>
                    <div className="lp-section-header">
                        <h2 className="lp-section-title">OS Concepts Demonstrated</h2>
                        <p className="lp-section-sub">Core operating system principles implemented in this project</p>
                    </div>
                </FadeIn>
                <div className="lp-concepts-grid">
                    {osConcepts.map((c, i) => (
                        <FadeIn key={c.title} delay={i * 0.07}>
                            <div className="lp-concept-card">
                                <div className="lp-concept-icon">
                                    <c.icon size={20} />
                                </div>
                                <h3>{c.title}</h3>
                                <p>{c.desc}</p>
                            </div>
                        </FadeIn>
                    ))}
                </div>
            </section>

            {/* ── Key Features ─────────────────────────────────────── */}
            <section className="lp-section">
                <FadeIn>
                    <div className="lp-section-header">
                        <h2 className="lp-section-title">Key Features</h2>
                        <p className="lp-section-sub">Everything you need in a modern file management tool</p>
                    </div>
                </FadeIn>
                <div className="lp-features-grid">
                    {features.map((f, i) => (
                        <FadeIn key={f.title} delay={i * 0.08}>
                            <div className="lp-feature-card">
                                <div className="lp-feature-icon">
                                    <f.icon size={20} />
                                </div>
                                <div>
                                    <h3>{f.title}</h3>
                                    <p>{f.desc}</p>
                                </div>
                            </div>
                        </FadeIn>
                    ))}
                </div>
            </section>

            {/* ── Architecture ─────────────────────────────────────── */}
            <section className="lp-section">
                <FadeIn>
                    <div className="lp-section-header">
                        <h2 className="lp-section-title">System Architecture</h2>
                        <p className="lp-section-sub">How the components connect</p>
                    </div>
                </FadeIn>
                <FadeIn delay={0.15}>
                    <div className="lp-arch">
                        <div className="lp-arch-node">
                            <Layout size={28} />
                            <span>React Frontend</span>
                            <small>UI, State, Routing</small>
                        </div>
                        <div className="lp-arch-arrow">→</div>
                        <div className="lp-arch-node lp-arch-accent">
                            <Server size={28} />
                            <span>Express API</span>
                            <small>REST Endpoints</small>
                        </div>
                        <div className="lp-arch-arrow">→</div>
                        <div className="lp-arch-node">
                            <HardDrive size={28} />
                            <span>File System</span>
                            <small>fs Module, Disks</small>
                        </div>
                    </div>
                </FadeIn>
            </section>

            {/* ── CTA Banner ───────────────────────────────────────── */}
            <section className="lp-section">
                <FadeIn>
                    <div className="lp-cta-banner">
                        <h2>Ready to explore the File System?</h2>
                        <p>Launch the explorer and see OS concepts in action — live, with real files.</p>
                        <div className="lp-cta-actions">
                            <button className="lp-btn-primary" onClick={() => navigate('/explorer')}>
                                Open File Explorer <ArrowRight size={16} />
                            </button>
                            <button className="lp-btn-secondary" onClick={() => navigate('/dashboard')}>
                                <BarChart3 size={16} /> View Dashboard
                            </button>
                        </div>
                    </div>
                </FadeIn>
            </section>

            {/* ── Footer ───────────────────────────────────────────── */}
            <footer className="lp-footer">
                <p>© 2025 FileOS — Built with ❤️ for the OS Concepts course.</p>
            </footer>

        </main>
    )
}
