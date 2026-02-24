import { useRef, useEffect } from 'react'
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

// ── OS Concept Cards Data ────────────────────────────────────────────
const osConcepts = [
    { icon: HardDrive, title: 'File System Management', desc: 'Simulates virtual disk drives with real filesystem operations using Node.js fs module.' },
    { icon: FolderTree, title: 'Directory Traversal', desc: 'Recursive tree scanning to build folder hierarchies and navigate complex directory structures.' },
    { icon: FileSearch, title: 'Path Resolution', desc: 'Virtual-to-real path mapping with sandboxed access control preventing directory traversal attacks.' },
    { icon: FileType, title: 'File Metadata Handling', desc: 'Extraction of file size, timestamps, extensions, and MIME types for intelligent categorization.' },
    { icon: RotateCcw, title: 'Transactional Rollback', desc: 'Undo mechanism logs every file move, enabling full reversal of the last organization action.' },
    { icon: AlertCircle, title: 'Conflict Detection', desc: 'Pre-upload duplicate scanning with user-driven resolution: replace, rename, or skip.' },
    { icon: Server, title: 'Disk Simulation', desc: 'Multiple virtual drives (C:, D:, E:) mapped to isolated directories simulating OS-level partitions.' },
]

const features = [
    { icon: Zap, title: 'Smart Folder Organization', desc: 'Auto-categorize files into Documents, Images, Videos, Audio, and Others.' },
    { icon: Shield, title: 'Duplicate File Handling', desc: 'Detect conflicts before upload with replace, rename, or skip options.' },
    { icon: RotateCcw, title: 'Undo Last Action', desc: 'One-click reversal of the most recent organization with empty folder cleanup.' },
    { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Visualize storage usage, file distribution, and disk space at a glance.' },
    { icon: Layout, title: 'Explorer-Style UI', desc: 'Windows-inspired file browser with list/grid views, breadcrumbs, and context menus.' },
]

export default function LandingPage() {
    const navigate = useNavigate()

    return (
        <div className="landing-page">
            {/* ── HERO ─────────────────────────────────────────────────── */}
            <section className="landing-hero">
                <motion.div
                    className="hero-content"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                >
                    <div className="hero-badge">
                        <Cpu size={14} /> OS Concepts Project
                    </div>
                    <h1 className="hero-title">
                        OS-Inspired<br />
                        <span className="hero-gradient-text">File Management System</span>
                    </h1>
                    <p className="hero-subtitle">
                        A full-stack file organizer demonstrating core operating system concepts —
                        file system management, directory traversal, metadata handling,
                        conflict resolution, and transactional rollback — built with React and Node.js.
                    </p>
                    <div className="hero-actions">
                        <button className="hero-btn primary" onClick={() => navigate('/explorer')}>
                            Launch Explorer <ArrowRight size={16} />
                        </button>
                        <button className="hero-btn secondary" onClick={() => navigate('/dashboard')}>
                            <BarChart3 size={16} /> View Dashboard
                        </button>
                    </div>
                </motion.div>
                <div className="hero-glow" />
            </section>

            {/* ── ABOUT ────────────────────────────────────────────────── */}
            <section className="landing-section">
                <FadeIn>
                    <div className="section-header">
                        <h2 className="section-title">About the Project</h2>
                        <p className="section-subtitle">
                            Understanding how operating systems manage files, from the ground up
                        </p>
                    </div>
                </FadeIn>
                <div className="about-grid">
                    <FadeIn delay={0.1}>
                        <div className="about-card">
                            <FolderOpen size={28} className="about-icon" />
                            <h3>Directory-Level Organization</h3>
                            <p>Files are automatically categorized into subfolders based on their extensions — mimicking how an OS file manager would sort data into logical groups.</p>
                        </div>
                    </FadeIn>
                    <FadeIn delay={0.2}>
                        <div className="about-card">
                            <RotateCcw size={28} className="about-icon" />
                            <h3>Undo Mechanism</h3>
                            <p>Every organization action creates a transaction log. The undo system reads this log, reverses all file moves, and cleans up empty directories — a transactional rollback pattern.</p>
                        </div>
                    </FadeIn>
                    <FadeIn delay={0.3}>
                        <div className="about-card">
                            <Network size={28} className="about-icon" />
                            <h3>Real Filesystem Interaction</h3>
                            <p>Unlike mock simulations, this project reads and writes real files using Node.js <code>fs</code> module with path sandboxing for security.</p>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* ── OS CONCEPTS ──────────────────────────────────────────── */}
            <section className="landing-section">
                <FadeIn>
                    <div className="section-header">
                        <h2 className="section-title">OS Concepts Demonstrated</h2>
                        <p className="section-subtitle">
                            Core operating system principles implemented in this project
                        </p>
                    </div>
                </FadeIn>
                <div className="concepts-grid">
                    {osConcepts.map((concept, i) => (
                        <FadeIn key={concept.title} delay={i * 0.08}>
                            <div className="concept-card">
                                <div className="concept-icon-wrap">
                                    <concept.icon size={22} />
                                </div>
                                <h3>{concept.title}</h3>
                                <p>{concept.desc}</p>
                            </div>
                        </FadeIn>
                    ))}
                </div>
            </section>

            {/* ── FEATURES ─────────────────────────────────────────────── */}
            <section className="landing-section">
                <FadeIn>
                    <div className="section-header">
                        <h2 className="section-title">Key Features</h2>
                        <p className="section-subtitle">
                            Everything you need in a modern file management tool
                        </p>
                    </div>
                </FadeIn>
                <div className="features-grid">
                    {features.map((feature, i) => (
                        <FadeIn key={feature.title} delay={i * 0.08}>
                            <div className="feature-card">
                                <div className="feature-icon-wrap">
                                    <feature.icon size={20} />
                                </div>
                                <div>
                                    <h3>{feature.title}</h3>
                                    <p>{feature.desc}</p>
                                </div>
                            </div>
                        </FadeIn>
                    ))}
                </div>
            </section>

            {/* ── ARCHITECTURE ─────────────────────────────────────────── */}
            <section className="landing-section">
                <FadeIn>
                    <div className="section-header">
                        <h2 className="section-title">System Architecture</h2>
                        <p className="section-subtitle">How the components connect</p>
                    </div>
                </FadeIn>
                <FadeIn delay={0.15}>
                    <div className="arch-diagram">
                        <div className="arch-node">
                            <Layout size={28} />
                            <span>React Frontend</span>
                            <small>UI, State, Routing</small>
                        </div>
                        <div className="arch-arrow">→</div>
                        <div className="arch-node accent">
                            <Server size={28} />
                            <span>Express API</span>
                            <small>REST Endpoints</small>
                        </div>
                        <div className="arch-arrow">→</div>
                        <div className="arch-node">
                            <HardDrive size={28} />
                            <span>File System</span>
                            <small>fs Module, Disks</small>
                        </div>
                    </div>
                </FadeIn>
            </section>

            {/* ── FOOTER CTA ───────────────────────────────────────────── */}
            <section className="landing-cta">
                <FadeIn>
                    <h2>Ready to explore?</h2>
                    <p>Launch the file explorer and see OS concepts in action.</p>
                    <button className="hero-btn primary" onClick={() => navigate('/explorer')}>
                        Open File Explorer <ArrowRight size={16} />
                    </button>
                </FadeIn>
            </section>
        </div>
    )
}
