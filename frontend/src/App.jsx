/**
 * File Organizer System - React Frontend
 * 
 * This is a VISUAL OBSERVER only.
 * The frontend does NOT touch the file system directly.
 * All OS interactions remain in the system layer.
 */

import { useState, useEffect } from 'react'

const API_BASE = '/api'

// Format bytes to human-readable
function formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

// Format timestamp to readable time
function formatTime(timestamp) {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleString()
}

// Status badge component
function StatusBadge({ status }) {
    const colors = {
        SUCCESS: 'var(--color-success)',
        SKIPPED: 'var(--color-neutral)',
        PERMISSION_DENIED: 'var(--color-warning)',
        ERROR: 'var(--color-error)',
        CONFLICT: 'var(--color-warning)'
    }

    return (
        <span className="status-badge" style={{ background: colors[status] || 'var(--color-neutral)' }}>
            {status}
        </span>
    )
}

// File icon based on extension
function FileIcon({ extension }) {
    const icons = {
        pdf: '📄', doc: '📝', docx: '📝', txt: '📃',
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️',
        mp4: '🎬', mkv: '🎬', avi: '🎬', mov: '🎬',
        mp3: '🎵', wav: '🎵', flac: '🎵',
        zip: '📦', rar: '📦', '7z': '📦',
        js: '⚡', ts: '⚡', py: '🐍', java: '☕',
        exe: '⚙️', dmg: '💿', app: '📱'
    }
    return <span className="file-icon">{icons[extension] || '📁'}</span>
}

// File tree component
function FileTree({ files, title }) {
    if (!files || files.length === 0) {
        return (
            <div className="file-tree empty">
                <h3>{title}</h3>
                <p className="empty-message">No files to display</p>
            </div>
        )
    }

    return (
        <div className="file-tree">
            <h3>{title}</h3>
            <div className="file-list">
                {files.map((file, index) => (
                    <div key={index} className="file-item">
                        <FileIcon extension={file.extension} />
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">{formatBytes(file.size)}</span>
                        <span className="file-age">{file.ageCategory}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// Statistics panel
function StatisticsPanel({ stats }) {
    if (!stats) return null

    return (
        <div className="stats-panel">
            <h3>📊 File System Statistics</h3>
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats.totalFiles}</div>
                    <div className="stat-label">Total Files</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{formatBytes(stats.totalSize)}</div>
                    <div className="stat-label">Total Size</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{Object.keys(stats.byExtension).length}</div>
                    <div className="stat-label">File Types</div>
                </div>
            </div>

            <div className="stats-breakdown">
                <div className="stat-section">
                    <h4>By Size</h4>
                    {Object.entries(stats.bySize).map(([category, count]) => (
                        <div key={category} className="stat-row">
                            <span>{category}</span>
                            <span className="stat-count">{count}</span>
                        </div>
                    ))}
                </div>

                <div className="stat-section">
                    <h4>Top Extensions</h4>
                    {Object.entries(stats.byExtension)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([ext, count]) => (
                            <div key={ext} className="stat-row">
                                <span>.{ext}</span>
                                <span className="stat-count">{count}</span>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    )
}

// Log viewer component
function LogViewer({ logs }) {
    if (!logs || !logs.entries || logs.entries.length === 0) {
        return (
            <div className="log-viewer empty">
                <h3>📋 System Logs</h3>
                <p className="empty-message">No logs available</p>
            </div>
        )
    }

    const levelColors = {
        DEBUG: '#6b7280',
        INFO: '#3b82f6',
        WARN: '#f59e0b',
        ERROR: '#ef4444'
    }

    return (
        <div className="log-viewer">
            <h3>📋 System Logs ({logs.entries.length} entries)</h3>
            <div className="log-entries">
                {logs.entries.slice(-50).reverse().map((entry, index) => (
                    <div key={index} className="log-entry">
                        <span className="log-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        <span className="log-level" style={{ color: levelColors[entry.level] }}>
                            [{entry.level}]
                        </span>
                        <span className="log-component">[{entry.component}]</span>
                        <span className="log-message">{entry.message}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// Organization summary component
function OrganizeSummary({ summary }) {
    if (!summary) return null

    return (
        <div className="org-summary">
            <h3>📁 Organization Results</h3>
            <div className="summary-stats">
                <div className="summary-item success">
                    <span className="summary-value">{summary.statistics.success}</span>
                    <span className="summary-label">Success</span>
                </div>
                <div className="summary-item skipped">
                    <span className="summary-value">{summary.statistics.skipped}</span>
                    <span className="summary-label">Skipped</span>
                </div>
                <div className="summary-item error">
                    <span className="summary-value">{summary.statistics.errors}</span>
                    <span className="summary-label">Errors</span>
                </div>
                <div className="summary-item warning">
                    <span className="summary-value">{summary.statistics.permissionDenied}</span>
                    <span className="summary-label">Permission Denied</span>
                </div>
            </div>
            <div className="summary-meta">
                <span>Mode: {summary.executionMode}</span>
                <span>Duration: {summary.durationMs}ms</span>
            </div>

            {summary.operations && summary.operations.length > 0 && (
                <div className="operations-list">
                    <h4>Operations</h4>
                    {summary.operations.slice(0, 20).map((op, index) => (
                        <div key={index} className="operation-item">
                            <StatusBadge status={op.status} />
                            <span className="op-file">{op.file}</span>
                            {op.target && <span className="op-target">→ {op.target.split('/').slice(-2).join('/')}</span>}
                        </div>
                    ))}
                    {summary.operations.length > 20 && (
                        <p className="more-ops">...and {summary.operations.length - 20} more</p>
                    )}
                </div>
            )}
        </div>
    )
}

// Main App component
function App() {
    const [targetPath, setTargetPath] = useState('')
    const [analysis, setAnalysis] = useState(null)
    const [summary, setSummary] = useState(null)
    const [logs, setLogs] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [dryRun, setDryRun] = useState(true)
    const [parallel, setParallel] = useState(false)

    // Fetch logs periodically
    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch(`${API_BASE}/logs`)
                if (res.ok) {
                    setLogs(await res.json())
                }
            } catch (e) {
                // Ignore errors
            }
        }
        fetchLogs()
        const interval = setInterval(fetchLogs, 5000)
        return () => clearInterval(interval)
    }, [])

    // Analyze directory
    const handleAnalyze = async () => {
        if (!targetPath) {
            setError('Please enter a directory path')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const res = await fetch(`${API_BASE}/analyze?path=${encodeURIComponent(targetPath)}`)
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Analysis failed')
            }
            setAnalysis(await res.json())
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    // Execute organization
    const handleOrganize = async () => {
        if (!targetPath) {
            setError('Please enter a directory path')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const res = await fetch(`${API_BASE}/organize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: targetPath, dryRun, parallel })
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Organization failed')
            }
            const data = await res.json()
            setSummary(data.summary)

            // Refresh analysis after organization
            if (!dryRun) {
                setTimeout(handleAnalyze, 1000)
            }
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="app">
            <header className="app-header">
                <h1>📂 File Organizer System</h1>
                <p className="subtitle">User-Space File System Manager • OS Project</p>
            </header>

            <main className="app-main">
                {/* Control Panel */}
                <section className="control-panel">
                    <div className="input-group">
                        <label htmlFor="path-input">Target Directory</label>
                        <input
                            id="path-input"
                            type="text"
                            value={targetPath}
                            onChange={(e) => setTargetPath(e.target.value)}
                            placeholder="/path/to/directory (e.g., ~/Downloads)"
                            className="path-input"
                        />
                    </div>

                    <div className="options">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={dryRun}
                                onChange={(e) => setDryRun(e.target.checked)}
                            />
                            Dry Run (preview only)
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={parallel}
                                onChange={(e) => setParallel(e.target.checked)}
                            />
                            Parallel Execution
                        </label>
                    </div>

                    <div className="actions">
                        <button
                            className="btn btn-secondary"
                            onClick={handleAnalyze}
                            disabled={loading}
                        >
                            🔍 Analyze
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleOrganize}
                            disabled={loading}
                        >
                            {dryRun ? '👁️ Preview' : '🚀 Organize'}
                        </button>
                    </div>

                    {loading && <div className="loading">Processing...</div>}
                    {error && <div className="error-message">{error}</div>}
                </section>

                {/* OS Concepts Banner */}
                <section className="os-concepts">
                    <h3>🎓 OS Concepts Demonstrated</h3>
                    <div className="concept-grid">
                        <div className="concept">
                            <strong>Inodes</strong>
                            <span>Files as references</span>
                        </div>
                        <div className="concept">
                            <strong>Metadata</strong>
                            <span>Size, mtime, permissions</span>
                        </div>
                        <div className="concept">
                            <strong>Synchronization</strong>
                            <span>Directory locking</span>
                        </div>
                        <div className="concept">
                            <strong>Processes</strong>
                            <span>Parallel execution</span>
                        </div>
                    </div>
                </section>

                {/* Analysis Results */}
                {analysis && (
                    <section className="analysis-results">
                        <StatisticsPanel stats={analysis.statistics} />
                        <FileTree files={analysis.files} title="📁 Current Files" />
                    </section>
                )}

                {/* Organization Summary */}
                {summary && (
                    <section className="summary-section">
                        <OrganizeSummary summary={summary} />
                    </section>
                )}

                {/* Logs */}
                <section className="logs-section">
                    <LogViewer logs={logs} />
                </section>
            </main>

            <footer className="app-footer">
                <p>
                    <strong>Important:</strong> This frontend is a visual observer only.
                    All file system operations are handled by the system layer via REST API.
                </p>
            </footer>
        </div>
    )
}

export default App
