import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FolderOpen,
  FolderPlus,
  FolderClosed,
  FileText,
  Image,
  Film,
  Music,
  File,
  Upload,
  Trash2,
  Pencil,
  Search,
  Grid3X3,
  List,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Star,
  FolderInput,
  X,
  Check,
  AlertCircle,
  Info,
  Loader2,
  Download,
  Eye,
  FileType,
  Calendar,
  HardDriveIcon,
  RotateCcw,
} from 'lucide-react'

const API = '/api'

// ── Icon helpers ─────────────────────────────────────────────────────
function getCategoryIcon(cat) {
  const map = { folder: FolderClosed, document: FileText, image: Image, video: Film, audio: Music }
  return map[cat] || File
}
function getCategoryColor(cat) {
  const map = { folder: '#f0b429', document: '#4e9af5', image: '#2dd4bf', video: '#a78bfa', audio: '#f472b6' }
  return map[cat] || '#64748b'
}
function formatBytes(bytes) {
  if (!bytes) return '—'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Toast System ─────────────────────────────────────────────────────
let toastId = 0
function useToast() {
  const [toasts, setToasts] = useState([])
  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])
  return { toasts, addToast }
}

// ══════════════════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════════════════
export default function App() {
  const [disks, setDisks] = useState([])
  const [currentPath, setCurrentPath] = useState(null)
  const [contents, setContents] = useState([])
  const [parentPath, setParentPath] = useState(null)
  const [viewMode, setViewMode] = useState('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [organizing, setOrganizing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [expandedFolders, setExpandedFolders] = useState({})
  const [treeFolders, setTreeFolders] = useState({})
  const [newFolderModal, setNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameModal, setRenameModal] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [previewData, setPreviewData] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [detailsPanel, setDetailsPanel] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [conflictModal, setConflictModal] = useState(null) // {files: File[], conflicts: [], resolutions: {}}
  const [pendingUploadFiles, setPendingUploadFiles] = useState(null)
  const [conflictRenameInputs, setConflictRenameInputs] = useState({})
  const [undoStatus, setUndoStatus] = useState(null)
  const [undoConfirm, setUndoConfirm] = useState(false)

  const { toasts, addToast } = useToast()
  const fileInputRef = useRef(null)

  // ── Fetch disks ──────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/disks`).then(r => r.json()).then(data => {
      setDisks(data)
      if (data.length > 0 && !currentPath) setCurrentPath(data[0].label)
    }).catch(() => { })
  }, [])

  // ── Fetch directory contents ─────────────────────────────────────
  const fetchContents = useCallback(async (dirPath) => {
    if (!dirPath) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/files?path=${encodeURIComponent(dirPath)}`)
      const data = await res.json()
      if (data.error) { addToast(data.error, 'error'); setContents([]) }
      else { setContents(data.items || []); setParentPath(data.parentPath || null) }
    } catch { setContents([]); addToast('Failed to load directory', 'error') }
    finally { setLoading(false) }
  }, [addToast])

  useEffect(() => { if (currentPath) fetchContents(currentPath) }, [currentPath, fetchContents])

  // ── Fetch tree ───────────────────────────────────────────────────
  const fetchTree = useCallback(async (diskPath) => {
    try {
      const res = await fetch(`${API}/tree?path=${encodeURIComponent(diskPath)}`)
      const data = await res.json()
      setTreeFolders(prev => ({ ...prev, [diskPath]: data }))
    } catch { }
  }, [])

  useEffect(() => { disks.forEach(d => fetchTree(d.label)) }, [disks, fetchTree])

  // ── Navigate ─────────────────────────────────────────────────────
  const navigateTo = useCallback((p) => {
    setCurrentPath(p); setSearchQuery(''); setContextMenu(null)
    setSelectedItem(null); setDetailsPanel(null)
  }, [])

  // ── Undo status ─────────────────────────────────────────────────
  const fetchUndoStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/undo-status`)
      const data = await res.json()
      setUndoStatus(data.available ? data : null)
    } catch { setUndoStatus(null) }
  }, [])

  useEffect(() => { fetchUndoStatus() }, [fetchUndoStatus])

  // ── Organize folder ──────────────────────────────────────────────
  const organizeFolder = useCallback(async (targetPath) => {
    const p = targetPath || currentPath
    if (!p) return
    setOrganizing(true)
    try {
      const res = await fetch(`${API}/organize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: p }),
      })
      const data = await res.json()
      if (data.success) {
        addToast(`✅ ${data.message}`, 'success')
        await fetchContents(currentPath)
        fetchTree(currentPath.split('/')[0])
        fetchUndoStatus()
      } else addToast(data.error || 'Organization failed', 'error')
    } catch { addToast('Organization failed', 'error') }
    finally { setOrganizing(false) }
  }, [currentPath, fetchContents, fetchTree, addToast, fetchUndoStatus])

  // ── Undo last organization ──────────────────────────────────────
  const performUndo = useCallback(async () => {
    if (!undoStatus?.actionId) return
    setUndoConfirm(false)
    try {
      const res = await fetch(`${API}/undo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: undoStatus.actionId }),
      })
      const data = await res.json()
      if (data.success) {
        addToast(`↩️ Restored ${data.restored} file(s) to original location`, 'success')
        setUndoStatus(null)
        await fetchContents(currentPath)
        fetchTree(currentPath.split('/')[0])
      } else addToast(data.error || 'Undo failed', 'error')
    } catch { addToast('Undo failed', 'error') }
  }, [undoStatus, currentPath, fetchContents, fetchTree, addToast])

  // ── Upload files (with conflict detection) ───────────────────────
  const uploadFiles = useCallback(async (fileList) => {
    if (!currentPath || !fileList?.length) return
    const files = Array.from(fileList)
    const fileNames = files.map(f => f.name)

    // Step 1: Check for duplicates
    try {
      const checkRes = await fetch(`${API}/check-duplicates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath, fileNames }),
      })
      const checkData = await checkRes.json()

      if (checkData.conflicts && checkData.conflicts.length > 0) {
        // Show conflict modal
        const resolutions = {}
        checkData.conflicts.forEach(c => { resolutions[c.fileName] = 'replace' }) // default action
        setConflictModal({ conflicts: checkData.conflicts, resolutions })
        setPendingUploadFiles(files)
        setConflictRenameInputs({})
        return
      }
    } catch { /* proceed with upload if check fails */ }

    // No conflicts — upload directly
    await doUpload(files, {}, [], currentPath)
  }, [currentPath])

  // Perform the actual upload with conflict resolution
  const doUpload = useCallback(async (files, renameMap, skipList, targetPath) => {
    const fd = new FormData()
    fd.append('path', targetPath)
    files.forEach(f => fd.append('files', f))

    const hasOverwrites = files.some(f => !renameMap[f.name] && !skipList.includes(f.name))
    if (hasOverwrites && Object.keys(renameMap).length === 0 && skipList.length === 0) {
      // No conflicts at all — normal upload
    } else {
      fd.append('overwrite', 'true')
    }
    if (Object.keys(renameMap).length > 0) fd.append('renameTo', JSON.stringify(renameMap))
    if (skipList.length > 0) fd.append('skip', JSON.stringify(skipList))

    try {
      const res = await fetch(`${API}/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.success) {
        const msgs = []
        if (data.count > 0) msgs.push(`Uploaded ${data.count} file(s)`)
        if (data.skipped?.length > 0) msgs.push(`Skipped ${data.skipped.length}`)
        addToast(msgs.join(', ') || 'Upload complete', 'success')
        await fetchContents(currentPath)
      } else addToast(data.error || 'Upload failed', 'error')
    } catch { addToast('Upload failed', 'error') }
  }, [currentPath, fetchContents, addToast])

  // Resolve conflicts and proceed with upload
  const resolveConflictsAndUpload = useCallback(async () => {
    if (!conflictModal || !pendingUploadFiles) return
    const skipList = []
    const renameMap = {}

    for (const conflict of conflictModal.conflicts) {
      const action = conflictModal.resolutions[conflict.fileName] || 'skip'
      if (action === 'skip') {
        skipList.push(conflict.fileName)
      } else if (action === 'rename') {
        const customName = conflictRenameInputs[conflict.fileName]
        if (customName?.trim()) {
          renameMap[conflict.fileName] = customName.trim()
        } else {
          // Auto-generate rename
          const ext = conflict.fileName.includes('.') ? '.' + conflict.fileName.split('.').pop() : ''
          const base = conflict.fileName.replace(/\.[^.]+$/, '')
          renameMap[conflict.fileName] = `${base}(1)${ext}`
        }
      }
      // 'replace' → no entry needed, overwrite=true handles it
    }

    setConflictModal(null)
    setPendingUploadFiles(null)
    setConflictRenameInputs({})

    await doUpload(pendingUploadFiles, renameMap, skipList, currentPath)
  }, [conflictModal, pendingUploadFiles, conflictRenameInputs, currentPath, doUpload])

  // ── Create folder ────────────────────────────────────────────────
  const createFolder = useCallback(async () => {
    if (!currentPath || !newFolderName.trim()) return
    try {
      const res = await fetch(`${API}/mkdir`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath, name: newFolderName.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        addToast(`Created folder "${data.name}"`, 'success')
        setNewFolderModal(false); setNewFolderName('')
        await fetchContents(currentPath); fetchTree(currentPath.split('/')[0])
      } else addToast(data.error || 'Failed', 'error')
    } catch { addToast('Failed to create folder', 'error') }
  }, [currentPath, newFolderName, fetchContents, fetchTree, addToast])

  // ── Delete ───────────────────────────────────────────────────────
  const deleteItem = useCallback(async (itemPath) => {
    try {
      const res = await fetch(`${API}/delete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: itemPath }),
      })
      const data = await res.json()
      if (data.success) {
        addToast('Deleted successfully', 'success')
        await fetchContents(currentPath); fetchTree(currentPath.split('/')[0])
        setDetailsPanel(null); setSelectedItem(null); setDeleteConfirm(null)
      } else addToast(data.error || 'Delete failed', 'error')
    } catch { addToast('Delete failed', 'error') }
  }, [currentPath, fetchContents, fetchTree, addToast])

  // ── Rename ───────────────────────────────────────────────────────
  const renameItem = useCallback(async () => {
    if (!renameModal || !renameValue.trim()) return
    try {
      const res = await fetch(`${API}/rename`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: renameModal.path, newName: renameValue.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        addToast(`Renamed to "${data.name}"`, 'success')
        setRenameModal(null); setRenameValue('')
        await fetchContents(currentPath); fetchTree(currentPath.split('/')[0])
        setDetailsPanel(null)
      } else addToast(data.error || 'Rename failed', 'error')
    } catch { addToast('Rename failed', 'error') }
  }, [renameModal, renameValue, currentPath, fetchContents, fetchTree, addToast])

  // ── Preview file ─────────────────────────────────────────────────
  const previewFile = useCallback(async (item) => {
    if (item.isDirectory) return
    setPreviewLoading(true)
    try {
      const res = await fetch(`${API}/preview?path=${encodeURIComponent(item.path)}`)
      const data = await res.json()
      setPreviewData(data)
    } catch { addToast('Preview failed', 'error') }
    finally { setPreviewLoading(false) }
  }, [addToast])

  // ── Download file ────────────────────────────────────────────────
  const downloadFile = useCallback((item) => {
    if (item.isDirectory) return
    window.open(`${API}/download?path=${encodeURIComponent(item.path)}`, '_blank')
  }, [])

  // ── Show details ─────────────────────────────────────────────────
  const showDetails = useCallback((item) => {
    setDetailsPanel(item); setSelectedItem(item.path)
  }, [])

  // ── Drag & Drop ──────────────────────────────────────────────────
  const onDrop = (e) => { e.preventDefault(); setIsDragging(false); uploadFiles(e.dataTransfer?.files) }

  // ── Parallax ─────────────────────────────────────────────────────
  const sidebarRef = useRef(null)
  const mainRef = useRef(null)
  const isMobile = useRef(typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches)

  const onMouseMove = useCallback((e) => {
    if (isMobile.current) return
    const x = (e.clientX / window.innerWidth - 0.5) * 2 // -1 to 1
    const y = (e.clientY / window.innerHeight - 0.5) * 2
    if (sidebarRef.current) {
      sidebarRef.current.style.transform = `translateX(${x * -2}px) translateY(${y * -1}px)`
    }
    if (mainRef.current) {
      mainRef.current.style.transform = `translateX(${x * 1.5}px) translateY(${y * 0.8}px)`
    }
  }, [])

  // ── Close context menu on click ──────────────────────────────────
  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  // ── Breadcrumb ───────────────────────────────────────────────────
  const breadcrumbs = currentPath ? currentPath.split('/') : []

  // ── Filtered + sorted ────────────────────────────────────────────
  const filtered = contents.filter(item =>
    !searchQuery.trim() || item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  )
  const sorted = [...filtered].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    let cmp = 0
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortBy === 'size') cmp = (a.size || 0) - (b.size || 0)
    else if (sortBy === 'type') cmp = (a.extension || '').localeCompare(b.extension || '')
    else if (sortBy === 'modified') cmp = new Date(a.modified) - new Date(b.modified)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const fileCount = contents.filter(c => !c.isDirectory).length
  const folderCount = contents.filter(c => c.isDirectory).length

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  // ══════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="explorer" onMouseMove={onMouseMove}>
      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      <aside className="sidebar" ref={sidebarRef}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FolderInput size={14} color="#38bdf8" />
            FILE EXPLORER
          </div>
        </div>
        <div className="sidebar-section">
          <div className="sidebar-section-title">Quick Access</div>
          <div className={`tree-item ${currentPath === 'C:' ? 'active' : ''}`} style={{ paddingLeft: 16 }} onClick={() => navigateTo('C:')}>
            <Star size={14} color="#f0b429" />
            <span className="tree-label">Desktop</span>
          </div>
          <div className={`tree-item ${currentPath === 'C:/MyFiles' ? 'active' : ''}`} style={{ paddingLeft: 16 }} onClick={() => navigateTo('C:/MyFiles')}>
            <FolderClosed size={14} color="#f0b429" />
            <span className="tree-label">My Files</span>
          </div>
        </div>
        <div className="sidebar-section" style={{ borderBottom: 'none' }}>
          <div className="sidebar-section-title">Hard Disk Drives</div>
        </div>
        <div className="sidebar-scroll">
          {disks.map(disk => (
            <DiskTreeNode key={disk.label} disk={disk} currentPath={currentPath}
              expandedFolders={expandedFolders} setExpandedFolders={setExpandedFolders}
              treeFolders={treeFolders} navigateTo={navigateTo} />
          ))}
        </div>
      </aside>

      {/* ── MAIN PANEL ─────────────────────────────────────────────── */}
      <div className="main-panel" ref={mainRef}>
        {/* Toolbar */}
        <div className="toolbar">
          <button className="toolbar-btn primary" onClick={() => organizeFolder()} disabled={!currentPath || organizing}>
            {organizing ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <FolderInput size={14} />}
            {organizing ? 'Organizing...' : 'Organize This Folder'}
          </button>
          <button className="toolbar-btn" onClick={() => setUndoConfirm(true)} disabled={!undoStatus}
            title={undoStatus ? `Undo: ${undoStatus.fileCount} file(s) in ${undoStatus.virtualPath}` : 'No undo available'}>
            <RotateCcw size={14} /> Undo
          </button>
          <button className="toolbar-btn" onClick={() => { setNewFolderModal(true); setNewFolderName('') }} disabled={!currentPath}>
            <FolderPlus size={14} /> New Folder
          </button>
          <button className="toolbar-btn" onClick={() => fileInputRef.current?.click()} disabled={!currentPath}>
            <Upload size={14} /> Upload
          </button>
          <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
            onChange={e => { uploadFiles(e.target.files); e.target.value = '' }} />
          <div className="toolbar-separator" />
          <div className="view-toggle">
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid view">
              <Grid3X3 size={14} />
            </button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List view">
              <List size={14} />
            </button>
          </div>
          <div className="toolbar-search">
            <Search size={14} color="#5a6a7a" />
            <input type="text" placeholder="Search files..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="breadcrumb-bar">
          {breadcrumbs.map((part, i) => {
            const pathStr = breadcrumbs.slice(0, i + 1).join('/')
            return (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                {i > 0 && <span className="breadcrumb-separator">›</span>}
                <span className="breadcrumb-item" onClick={() => navigateTo(pathStr)}>
                  {i === 0 && <HardDrive size={12} style={{ marginRight: 3 }} />}
                  {part}
                </span>
              </span>
            )
          })}
        </div>

        {/* Content + Details split */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Content Area */}
          <div className="content-area" style={{ flex: 1 }}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)} onDrop={onDrop}
          >
            {isDragging && (
              <div className="drop-zone-active">
                <div style={{ textAlign: 'center', color: '#38bdf8' }}>
                  <Upload size={36} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Drop files to upload</div>
                </div>
              </div>
            )}
            {loading && (
              <div className="loading-overlay">
                <div className="spinner" style={{ width: 28, height: 28 }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading...</span>
              </div>
            )}
            {!loading && sorted.length === 0 && (
              <div className="empty-state">
                <FolderOpen size={56} />
                <p style={{ fontWeight: 500, fontSize: 14, marginTop: 12 }}>This folder is empty</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Upload files or create a new folder</p>
              </div>
            )}
            {!loading && sorted.length > 0 && viewMode === 'grid' && (
              <div className="file-grid">
                {sorted.map(item => (
                  <GridItem key={item.path} item={item} selected={selectedItem === item.path}
                    onClick={() => showDetails(item)}
                    onDoubleClick={() => item.isDirectory ? navigateTo(item.path) : previewFile(item)}
                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, item }) }}
                  />
                ))}
              </div>
            )}
            {!loading && sorted.length > 0 && viewMode === 'list' && (
              <div>
                <div className="file-list-header">
                  <div onClick={() => handleSort('name')}>Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}</div>
                  <div onClick={() => handleSort('type')}>Type {sortBy === 'type' && (sortDir === 'asc' ? '↑' : '↓')}</div>
                  <div onClick={() => handleSort('size')}>Size {sortBy === 'size' && (sortDir === 'asc' ? '↑' : '↓')}</div>
                  <div onClick={() => handleSort('modified')}>Date Modified {sortBy === 'modified' && (sortDir === 'asc' ? '↑' : '↓')}</div>
                </div>
                {sorted.map(item => (
                  <ListItem key={item.path} item={item} selected={selectedItem === item.path}
                    onClick={() => showDetails(item)}
                    onDoubleClick={() => item.isDirectory ? navigateTo(item.path) : previewFile(item)}
                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, item }) }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── DETAILS PANEL ────────────────────────────────────── */}
          {detailsPanel && (
            <div className="details-panel">
              <div className="details-panel-header">
                <span>Details</span>
                <button className="details-panel-close" onClick={() => { setDetailsPanel(null); setSelectedItem(null) }}>
                  <X size={16} />
                </button>
              </div>
              <div className="details-panel-body">
                {/* Icon */}
                <div style={{ textAlign: 'center', padding: '16px 0 12px' }}>
                  {(() => {
                    const Icon = detailsPanel.isDirectory ? FolderClosed : getCategoryIcon(detailsPanel.type)
                    const color = detailsPanel.isDirectory ? '#dcb438' : getCategoryColor(detailsPanel.type)
                    return <Icon size={56} color={color} strokeWidth={1.3} />
                  })()}
                </div>
                <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 14, marginBottom: 20, wordBreak: 'break-word' }}>
                  {detailsPanel.name}
                </div>
                {/* Metadata */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <DetailRow icon={<FileType size={14} color="var(--text-muted)" />} label="Type" value={detailsPanel.isDirectory ? 'File folder' : (detailsPanel.extension?.toUpperCase() + ' file' || 'File')} />
                  {!detailsPanel.isDirectory && <DetailRow icon={<HardDriveIcon size={14} color="var(--text-muted)" />} label="Size" value={formatBytes(detailsPanel.size)} />}
                  <DetailRow icon={<Calendar size={14} color="var(--text-muted)" />} label="Modified" value={formatDate(detailsPanel.modified)} />
                  <DetailRow icon={<FolderOpen size={14} color="var(--text-muted)" />} label="Location" value={detailsPanel.path} />
                  {detailsPanel.isDirectory && detailsPanel.childCount !== undefined && (
                    <DetailRow icon={<File size={14} color="var(--text-muted)" />} label="Items" value={`${detailsPanel.childCount} items`} />
                  )}
                </div>
                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 24 }}>
                  {!detailsPanel.isDirectory && (
                    <>
                      <button className="toolbar-btn" style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => previewFile(detailsPanel)}>
                        <Eye size={14} /> Preview
                      </button>
                      <button className="toolbar-btn" style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => downloadFile(detailsPanel)}>
                        <Download size={14} /> Download
                      </button>
                    </>
                  )}
                  {detailsPanel.isDirectory && (
                    <button className="toolbar-btn primary" style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => organizeFolder(detailsPanel.path)}>
                      <FolderInput size={14} /> Organize
                    </button>
                  )}
                  <button className="toolbar-btn" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => { setRenameModal(detailsPanel); setRenameValue(detailsPanel.name) }}>
                    <Pencil size={14} /> Rename
                  </button>
                  <button className="toolbar-btn danger" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => setDeleteConfirm(detailsPanel)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="status-bar">
          <span>{folderCount} folder(s), {fileCount} file(s)</span>
          {currentPath && <span>{currentPath}</span>}
        </div>
      </div>

      {/* ── CONTEXT MENU ───────────────────────────────────────────── */}
      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.item.isDirectory && (
            <>
              <div className="context-menu-item" onClick={() => { navigateTo(contextMenu.item.path); setContextMenu(null) }}>
                <FolderOpen size={14} /> Open
              </div>
              <div className="context-menu-item" onClick={() => { organizeFolder(contextMenu.item.path); setContextMenu(null) }}>
                <FolderInput size={14} /> Organize This Folder
              </div>
              <div className="context-menu-separator" />
            </>
          )}
          {!contextMenu.item.isDirectory && (
            <>
              <div className="context-menu-item" onClick={() => { previewFile(contextMenu.item); setContextMenu(null) }}>
                <Eye size={14} /> Preview
              </div>
              <div className="context-menu-item" onClick={() => { downloadFile(contextMenu.item); setContextMenu(null) }}>
                <Download size={14} /> Download
              </div>
              <div className="context-menu-separator" />
            </>
          )}
          <div className="context-menu-item" onClick={() => { showDetails(contextMenu.item); setContextMenu(null) }}>
            <Info size={14} /> Properties
          </div>
          <div className="context-menu-item" onClick={() => { setRenameModal(contextMenu.item); setRenameValue(contextMenu.item.name); setContextMenu(null) }}>
            <Pencil size={14} /> Rename
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item danger" onClick={() => { setDeleteConfirm(contextMenu.item); setContextMenu(null) }}>
            <Trash2 size={14} /> Delete
          </div>
        </div>
      )}

      {/* ── PREVIEW MODAL ──────────────────────────────────────────── */}
      {(previewData || previewLoading) && (
        <div className="modal-overlay" onClick={() => { setPreviewData(null); setPreviewLoading(false) }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 700, maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            {previewLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
                <div className="spinner" style={{ width: 28, height: 28 }} />
              </div>
            ) : previewData && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {(() => {
                      const Icon = getCategoryIcon(previewData.type)
                      const color = getCategoryColor(previewData.type)
                      return <Icon size={18} color={color} />
                    })()}
                    {previewData.name}
                  </h3>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="toolbar-btn" onClick={() => downloadFile(previewData)}>
                      <Download size={13} /> Download
                    </button>
                    <button onClick={() => setPreviewData(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }}>
                      <X size={18} />
                    </button>
                  </div>
                </div>
                {/* Meta info bar */}
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, flexWrap: 'wrap' }}>
                  <span>{previewData.extension?.toUpperCase()} file</span>
                  <span>{formatBytes(previewData.size)}</span>
                  <span>Modified: {formatDate(previewData.modified)}</span>
                </div>
                {/* Preview content */}
                <div className="preview-content">
                  {previewData.previewType === 'text' && (
                    <pre className="preview-text">
                      {previewData.content}
                    </pre>
                  )}
                  {previewData.previewType === 'image' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, minHeight: 200 }}>
                      <img src={previewData.previewUrl} alt={previewData.name}
                        style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 4 }} />
                    </div>
                  )}
                  {previewData.previewType === 'video' && (
                    <div style={{ padding: 20 }}>
                      <video controls style={{ width: '100%', maxHeight: '60vh', borderRadius: 4 }} src={previewData.previewUrl} />
                    </div>
                  )}
                  {previewData.previewType === 'audio' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 }}>
                      <Music size={48} color="#f472b6" strokeWidth={1.3} />
                      <audio controls src={previewData.previewUrl} style={{ width: '100%' }} />
                    </div>
                  )}
                  {previewData.previewType === 'pdf' && (
                    <iframe src={previewData.previewUrl} title="PDF Preview"
                      style={{ width: '100%', height: '60vh', border: 'none' }} />
                  )}
                  {previewData.previewType === 'none' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--text-muted)' }}>
                      <File size={48} strokeWidth={1.3} />
                      <p style={{ marginTop: 12, fontSize: 14 }}>Preview not available for this file type</p>
                      <button className="toolbar-btn" style={{ marginTop: 12 }} onClick={() => downloadFile(previewData)}>
                        <Download size={14} /> Download instead
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── NEW FOLDER MODAL ───────────────────────────────────────── */}
      {newFolderModal && (
        <div className="modal-overlay" onClick={() => setNewFolderModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>New Folder</h3>
            <input type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createFolder()} placeholder="Enter folder name" autoFocus />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setNewFolderModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={createFolder} disabled={!newFolderName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── RENAME MODAL ───────────────────────────────────────────── */}
      {renameModal && (
        <div className="modal-overlay" onClick={() => setRenameModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Rename</h3>
            <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && renameItem()} placeholder="Enter new name" autoFocus />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setRenameModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={renameItem} disabled={!renameValue.trim()}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFLICT RESOLUTION MODAL ──────────────────────────────── */}
      {conflictModal && (
        <div className="modal-overlay" onClick={() => { setConflictModal(null); setPendingUploadFiles(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: '95vw' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={18} color="#fbbf24" />
              File Already Exists
            </h3>
            <div style={{ maxHeight: 340, overflowY: 'auto', margin: '8px 0' }}>
              {conflictModal.conflicts.map(conflict => {
                const action = conflictModal.resolutions[conflict.fileName] || 'replace'
                return (
                  <div key={conflict.fileName} style={{
                    padding: '12px', marginBottom: 8, border: '1px solid var(--border-light)',
                    borderRadius: 8, background: 'var(--bg-surface)'
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{conflict.fileName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                      Existing: {formatBytes(conflict.existingSize)} · Modified: {formatDate(conflict.existingModified)}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['replace', 'rename', 'skip'].map(opt => (
                        <button key={opt} onClick={() => {
                          setConflictModal(prev => ({
                            ...prev,
                            resolutions: { ...prev.resolutions, [conflict.fileName]: opt }
                          }))
                        }}
                          style={{
                            padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                            cursor: 'pointer', border: '1px solid',
                            background: action === opt
                              ? (opt === 'replace' ? '#38bdf8' : opt === 'rename' ? '#34d399' : '#64748b')
                              : 'var(--bg-elevated)',
                            color: action === opt ? 'var(--bg-deepest)' : 'var(--text-secondary)',
                            borderColor: action === opt
                              ? (opt === 'replace' ? '#38bdf8' : opt === 'rename' ? '#34d399' : '#64748b')
                              : 'var(--border-light)',
                          }}>
                          {opt === 'replace' ? 'Replace' : opt === 'rename' ? 'Rename' : 'Skip'}
                        </button>
                      ))}
                    </div>
                    {action === 'rename' && (
                      <input
                        type="text"
                        value={conflictRenameInputs[conflict.fileName] || (() => {
                          const ext = conflict.fileName.includes('.') ? '.' + conflict.fileName.split('.').pop() : ''
                          const base = conflict.fileName.replace(/\.[^.]+$/, '')
                          return `${base}(1)${ext}`
                        })()}
                        onChange={e => setConflictRenameInputs(prev => ({ ...prev, [conflict.fileName]: e.target.value }))}
                        style={{ marginTop: 8, width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}
                        placeholder="Enter new file name"
                      />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => { setConflictModal(null); setPendingUploadFiles(null) }}>Cancel All</button>
              <button className="btn-primary" onClick={resolveConflictsAndUpload}>Proceed</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ───────────────────────────────────── */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Confirm Delete</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
              {deleteConfirm.isDirectory && ' This will delete the folder and all its contents.'}
            </p>
            <p style={{ fontSize: 12, color: '#f43f5e', margin: 0 }}>This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn-primary" style={{ background: '#f43f5e', borderColor: '#f43f5e' }}
                onClick={() => deleteItem(deleteConfirm.path)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── UNDO CONFIRM MODAL ──────────────────────────────────────── */}
      {undoConfirm && undoStatus && (
        <div className="modal-overlay" onClick={() => setUndoConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RotateCcw size={18} color="#fbbf24" />
              Undo Last Organization
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
              This will restore <strong>{undoStatus.fileCount} file(s)</strong> back to their original location in <strong>{undoStatus.virtualPath}</strong>.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 4px' }}>
              Organized on: {formatDate(undoStatus.timestamp)}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Empty category folders will be removed automatically.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setUndoConfirm(false)}>Cancel</button>
              <button className="btn-primary" onClick={performUndo}>Undo Organization</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOASTS ─────────────────────────────────────────────────── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' && <Check size={16} color="#34d399" />}
            {t.type === 'error' && <AlertCircle size={16} color="#f43f5e" />}
            {t.type === 'info' && <Info size={16} color="#38bdf8" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  COMPONENT: Detail Row
// ══════════════════════════════════════════════════════════════════════
function DetailRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 1 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 1 }}>{label}</div>
        <div style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{value}</div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  COMPONENT: Disk Tree Node
// ══════════════════════════════════════════════════════════════════════
function DiskTreeNode({ disk, currentPath, expandedFolders, setExpandedFolders, treeFolders, navigateTo }) {
  const isExpanded = expandedFolders[disk.label]
  const tree = treeFolders[disk.label] || []
  const toggle = () => setExpandedFolders(prev => ({ ...prev, [disk.label]: !prev[disk.label] }))

  return (
    <div>
      <div className={`tree-item ${currentPath === disk.label ? 'active' : ''}`} style={{ paddingLeft: 12 }}>
        <span className="tree-toggle" onClick={toggle}>
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className="tree-icon"><HardDrive size={14} color="#38bdf8" /></span>
        <span className="tree-label" onClick={() => navigateTo(disk.label)}>{disk.label}</span>
      </div>
      {isExpanded && (
        <div className="tree-children">
          {tree.map(folder => (
            <TreeFolder key={folder.path} folder={folder} currentPath={currentPath}
              expandedFolders={expandedFolders} setExpandedFolders={setExpandedFolders}
              navigateTo={navigateTo} depth={1} />
          ))}
          {tree.length === 0 && <div style={{ padding: '4px 16px', fontSize: 11, color: 'var(--text-muted)' }}>Empty</div>}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  COMPONENT: Tree Folder
// ══════════════════════════════════════════════════════════════════════
function TreeFolder({ folder, currentPath, expandedFolders, setExpandedFolders, navigateTo, depth }) {
  const isExpanded = expandedFolders[folder.path]
  const isActive = currentPath === folder.path
  const toggle = (e) => { e.stopPropagation(); setExpandedFolders(prev => ({ ...prev, [folder.path]: !prev[folder.path] })) }

  return (
    <div>
      <div className={`tree-item ${isActive ? 'active' : ''}`} style={{ paddingLeft: 8 + depth * 8 }}>
        <span className="tree-toggle" onClick={toggle}>
          {folder.children?.length > 0
            ? (isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />)
            : <span style={{ width: 10 }} />}
        </span>
        <span className="tree-icon">
          {isExpanded ? <FolderOpen size={14} color="#f0b429" /> : <FolderClosed size={14} color="#f0b429" />}
        </span>
        <span className="tree-label" onClick={() => navigateTo(folder.path)}>{folder.name}</span>
      </div>
      {isExpanded && folder.children?.length > 0 && (
        <div className="tree-children">
          {folder.children.map(child => (
            <TreeFolder key={child.path} folder={child} currentPath={currentPath}
              expandedFolders={expandedFolders} setExpandedFolders={setExpandedFolders}
              navigateTo={navigateTo} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  COMPONENT: Grid Item
// ══════════════════════════════════════════════════════════════════════
function GridItem({ item, selected, onClick, onDoubleClick, onContextMenu }) {
  const Icon = item.isDirectory ? FolderClosed : getCategoryIcon(item.type)
  const color = item.isDirectory ? '#dcb438' : getCategoryColor(item.type)

  return (
    <div className={`file-grid-item ${selected ? 'selected' : ''}`}
      onClick={onClick} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
      <div className="file-icon"><Icon size={42} color={color} strokeWidth={1.5} /></div>
      <span className="file-name">{item.name}</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
//  COMPONENT: List Item
// ══════════════════════════════════════════════════════════════════════
function ListItem({ item, selected, onClick, onDoubleClick, onContextMenu }) {
  const Icon = item.isDirectory ? FolderClosed : getCategoryIcon(item.type)
  const color = item.isDirectory ? '#dcb438' : getCategoryColor(item.type)

  return (
    <div className={`file-list-item ${selected ? 'selected' : ''}`}
      onClick={onClick} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu}>
      <div className="file-name-cell">
        <div className="file-icon-small"><Icon size={16} color={color} /></div>
        <span>{item.name}</span>
      </div>
      <span className="file-meta">{item.isDirectory ? 'File folder' : (item.extension?.toUpperCase() || '—')}</span>
      <span className="file-meta">{item.isDirectory ? '' : formatBytes(item.size)}</span>
      <span className="file-meta">{formatDate(item.modified)}</span>
    </div>
  )
}
