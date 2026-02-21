import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen,
  FileText,
  Image,
  Video,
  Music,
  FolderArchive,
  Grid3X3,
  List,
  Upload,
  Trash2,
  Download,
  Pencil,
  Info,
  X,
  ChevronDown,
  HardDrive,
  FileStack,
  Layers,
  Database,
  Search,
  ArrowUpDown,
  Moon,
  Sun,
  Eye,
} from 'lucide-react'

const API = '/api'
const WS_URL = (() => {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
})()

const SIDEBAR_ITEMS = [
  { id: 'all', label: 'All Files', icon: FolderOpen },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'images', label: 'Images', icon: Image },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'others', label: 'Others', icon: FolderArchive },
]

const SORT_OPTIONS = [
  { id: 'name', label: 'Name' },
  { id: 'size', label: 'Size' },
  { id: 'date', label: 'Date' },
]


function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getFileIcon(category) {
  const map = { documents: FileText, images: Image, videos: Video, audio: Music, others: FolderArchive }
  return map[category] || FileText
}

function sortFiles(files, sortBy) {
  const arr = [...files]
  if (sortBy === 'name') {
    arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  } else if (sortBy === 'size') {
    arr.sort((a, b) => (b.size || 0) - (a.size || 0))
  } else {
    arr.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))
  }
  return arr
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [files, setFiles] = useState([])
  const [stats, setStats] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [viewMode, setViewMode] = useState('grid')
  const [sortBy, setSortBy] = useState('name')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [detailFile, setDetailFile] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [renameFile, setRenameFile] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [showOsConcepts, setShowOsConcepts] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const wsRef = useRef(null)

  const isDark = theme === 'dark'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', theme)
  }, [theme, isDark])

  const fetchFiles = useCallback(async () => {
    try {
      const url = selectedCategory === 'all' ? `${API}/files` : `${API}/files?category=${selectedCategory}`
      const res = await fetch(url)
      const data = await res.json()
      setFiles(Array.isArray(data) ? data : [])
    } catch (e) {
      setFiles([])
    }
  }, [selectedCategory])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/stats`)
      setStats(await res.json())
    } catch {
      setStats(null)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchFiles().finally(() => setLoading(false))
  }, [fetchFiles])

  useEffect(() => {
    fetchStats()
  }, [fetchStats, files])

  // WebSocket for real-time updates
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'files-updated') {
            fetchFiles()
            fetchStats()
          }
        } catch {}
      }
      ws.onclose = () => setTimeout(connect, 2000)
      wsRef.current = ws
    }
    connect()
    return () => wsRef.current?.close()
  }, [fetchFiles, fetchStats])

  const handleUpload = useCallback(
    async (fileList) => {
      const list = Array.from(fileList || [])
      if (!list.length) return
      setUploading(true)
      try {
        const fd = new FormData()
        list.forEach((f) => fd.append('files', f))
        const res = await fetch(`${API}/upload`, { method: 'POST', body: fd })
        const data = await res.json()
        if (data.files?.length) {
          await fetchFiles()
          await fetchStats()
        }
      } catch (e) {
        console.error(e)
      } finally {
        setUploading(false)
      }
    },
    [fetchFiles, fetchStats]
  )

  const handleDelete = useCallback(
    async (id) => {
      try {
        await fetch(`${API}/files/${id}`, { method: 'DELETE' })
        await fetchFiles()
        await fetchStats()
        setDetailFile(null)
        setPreviewFile(null)
      } catch (e) {
        console.error(e)
      }
    },
    [fetchFiles, fetchStats]
  )

  const handleRename = useCallback(
    async (id, name) => {
      if (!name?.trim()) return
      try {
        await fetch(`${API}/files/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() }),
        })
        await fetchFiles()
        setRenameFile(null)
        setRenameValue('')
        setDetailFile((f) => (f?.id === id ? { ...f, name: name.trim() } : f))
        setPreviewFile((f) => (f?.id === id ? { ...f, name: name.trim() } : f))
      } catch (e) {
        console.error(e)
      }
    },
    [fetchFiles]
  )

  const handleDownload = (file) => {
    window.open(`${API}/files/${file.id}/download`, '_blank')
  }

  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleUpload(e.dataTransfer?.files)
  }

  const onDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = () => setIsDragging(false)

  const openContextMenu = (e, file, actions) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, file, actions })
  }

  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const filteredFiles = sortFiles(
    files.filter((f) => !searchQuery.trim() || (f.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase())),
    sortBy
  )

  const themeClasses = isDark
    ? 'bg-slate-950 text-slate-100'
    : 'bg-slate-50 text-slate-900'
  const sidebarClasses = isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-slate-200 shadow-sm'
  const cardClasses = isDark
    ? 'border-slate-800 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-800/60'
    : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md'

  return (
    <div className={`flex h-screen overflow-hidden ${themeClasses}`}>
      {/* Sidebar */}
      <aside className={`w-56 shrink-0 border-r flex flex-col ${sidebarClasses}`}>
        <div className="p-4 border-b border-slate-800/50">
          <h1 className="text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
            File Organizer
          </h1>
          <p className="text-xs text-slate-500 mt-1">OS File System Simulation</p>
        </div>
        <nav className="flex-1 p-2 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon
            const active = selectedCategory === item.id
            const count = item.id === 'all' ? stats?.totalFiles ?? 0 : stats?.byCategory?.[item.id]?.count ?? 0
            return (
              <motion.button
                key={item.id}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedCategory(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  active ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={20} className="shrink-0" />
                <span className="flex-1 truncate text-sm font-medium">{item.label}</span>
                <span className="text-xs text-slate-500">{count}</span>
              </motion.button>
            )
          })}
        </nav>
        <div className="p-3 border-t border-slate-800/50 space-y-1">
          <div className="text-xs text-slate-500 flex justify-between">
            <span>Total files</span>
            <span className="text-slate-600 dark:text-slate-400">{stats?.totalFiles ?? 0}</span>
          </div>
          <div className="text-xs text-slate-500 flex justify-between">
            <span>Storage</span>
            <span className="text-slate-600 dark:text-slate-400">{formatBytes(stats?.totalSize)}</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <header className={`h-14 flex items-center justify-between px-6 border-b ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white shadow-sm'}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="cursor-pointer">
              <input type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
              <motion.span
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/30 transition-colors text-sm font-medium shadow-sm"
              >
                <Upload size={18} />
                Upload
              </motion.span>
            </label>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className={`pl-9 pr-4 py-2 rounded-xl border text-sm w-52 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
            <div className="flex items-center gap-1 rounded-xl border overflow-hidden" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
              <span className="px-2 text-xs text-slate-500 flex items-center gap-1">
                <ArrowUpDown size={14} /> Sort
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`py-2 pr-3 pl-1 text-sm focus:outline-none ${
                  isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-50 text-slate-900'
                }`}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? (isDark ? 'bg-slate-700 text-cyan-400' : 'bg-slate-200 text-cyan-600') : 'text-slate-500'}`}
              >
                <Grid3X3 size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? (isDark ? 'bg-slate-700 text-cyan-400' : 'bg-slate-200 text-cyan-600') : 'text-slate-500'}`}
              >
                <List size={18} />
              </button>
            </div>
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
          <p className="text-sm text-slate-500">
            {stats?.totalFiles ?? 0} files · {formatBytes(stats?.totalSize)}
          </p>
        </header>

        {/* Content */}
        <div
          className="flex-1 overflow-auto relative"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-cyan-500/20 border-2 border-dashed border-cyan-400 rounded-2xl m-4 flex items-center justify-center"
            >
              <div className="text-center">
                <Upload size={48} className="mx-auto text-cyan-500 mb-2" />
                <p className="text-cyan-600 dark:text-cyan-300 font-medium">Drop files to upload</p>
              </div>
            </motion.div>
          )}

          <div className="p-6">
            {uploading && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-cyan-500 text-sm mb-4">
                Uploading...
              </motion.p>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20 text-slate-500">Loading...</div>
            ) : filteredFiles.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-24 text-slate-500"
              >
                <FolderOpen size={64} className="mb-4 opacity-50" />
                <p className="font-medium">No files found</p>
                <p className="text-sm mt-1">Upload files or drag and drop here</p>
                <label className="mt-4 cursor-pointer">
                  <input type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500/20 text-cyan-500 hover:bg-cyan-500/30 text-sm font-medium shadow-sm">
                    <Upload size={18} />
                    Choose files
                  </span>
                </label>
              </motion.div>
            ) : (
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
                    : 'flex flex-col gap-1'
                }
              >
                <AnimatePresence mode="popLayout">
                  {filteredFiles.map((file, i) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      viewMode={viewMode}
                      index={i}
                      isDark={isDark}
                      cardClasses={cardClasses}
                      onDelete={() => handleDelete(file.id)}
                      onRename={() => { setRenameFile(file); setRenameValue(file.name) }}
                      onDownload={() => handleDownload(file)}
                      onDetails={() => setDetailFile(file)}
                      onPreview={() => setPreviewFile(file)}
                      onContextMenu={(e) =>
                        openContextMenu(e, file, {
                          onDetails: () => setDetailFile(file),
                          onPreview: () => setPreviewFile(file),
                          onDownload: () => handleDownload(file),
                          onRename: () => { setRenameFile(file); setRenameValue(file.name) },
                          onDelete: () => handleDelete(file.id),
                        })
                      }
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* OS Concepts */}
            <motion.section
              initial={false}
              animate={{ height: showOsConcepts ? 'auto' : 56 }}
              className={`mt-12 overflow-hidden rounded-2xl border ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white shadow-sm'}`}
            >
              <button
                onClick={() => setShowOsConcepts(!showOsConcepts)}
                className={`w-full flex items-center justify-between px-6 py-4 text-left transition-colors ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
              >
                <span className="font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Layers size={20} className="text-cyan-500" />
                  OS File System Concepts
                </span>
                <ChevronDown size={20} className={`text-slate-500 transition-transform ${showOsConcepts ? 'rotate-180' : ''}`} />
              </button>
              {showOsConcepts && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="px-6 pb-6 pt-0 grid md:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  {[
                    { icon: HardDrive, title: 'File Storage Structure', desc: 'OS stores files in a hierarchical directory tree. Our app simulates /uploads with subdirectories for each category.' },
                    { icon: FileStack, title: 'Inodes (Simplified)', desc: 'Each file has metadata (name, size, type, path). In real OS, inodes hold this info. We use a JSON store to simulate metadata.' },
                    { icon: Layers, title: 'Directory Hierarchy', desc: '/uploads/documents, /images, /videos, etc. mimic how OS organizes files. Files are categorized by extension.' },
                    { icon: Database, title: 'Metadata & CRUD', desc: 'Create (upload), Read (list/view), Update (rename), Delete (unlink). Backend uses fs.unlink() and fs.rename().' },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}
                    >
                      <item.icon size={24} className="text-cyan-500 mb-2" />
                      <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-1">{item.title}</h4>
                      <p className="text-sm text-slate-500">{item.desc}</p>
                    </div>
                  ))}
                </motion.div>
              )}
            </motion.section>
          </div>
        </div>
      </main>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed z-50 rounded-xl border shadow-xl py-1 min-w-[180px] ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {[
              { icon: Eye, label: 'Preview', onClick: contextMenu.actions.onPreview },
              { icon: Info, label: 'Details', onClick: contextMenu.actions.onDetails },
              { icon: Download, label: 'Download', onClick: contextMenu.actions.onDownload },
              { icon: Pencil, label: 'Rename', onClick: contextMenu.actions.onRename },
              { icon: Trash2, label: 'Delete', onClick: contextMenu.actions.onDelete, danger: true },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => { item.onClick(); setContextMenu(null) }}
                className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                  item.danger ? 'text-red-500 hover:bg-red-500/10' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Preview Modal */}
      <AnimatePresence>
      {previewFile && (
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownload}
        onRename={() => { setRenameFile(previewFile); setRenameValue(previewFile?.name || ''); setPreviewFile(null) }}
        onDelete={() => previewFile && handleDelete(previewFile.id)}
        isDark={isDark}
      />
      )}
      </AnimatePresence>

      <AnimatePresence>
      {detailFile && (
      <FileDetailModal
        file={detailFile}
        onClose={() => setDetailFile(null)}
        onDownload={handleDownload}
        onRename={() => { setRenameFile(detailFile); setRenameValue(detailFile?.name || ''); setDetailFile(null) }}
        onDelete={() => detailFile && handleDelete(detailFile.id)}
        isDark={isDark}
      />
      )}
      </AnimatePresence>

      <AnimatePresence>
      {renameFile && (
      <RenameModal
        file={renameFile}
        value={renameValue}
        onChange={setRenameValue}
        onSave={(name) => renameFile && handleRename(renameFile.id, name)}
        onClose={() => { setRenameFile(null); setRenameValue('') }}
        isDark={isDark}
      />
      )}
      </AnimatePresence>
    </div>
  )
}

function FileCard({ file, viewMode, index, isDark, cardClasses, onDelete, onRename, onDownload, onDetails, onPreview, onContextMenu }) {
  const Icon = getFileIcon(file.category)

  const actions = (
    <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={(e) => { e.stopPropagation(); onPreview() }} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" title="Preview">
        <Eye size={14} />
      </button>
      <button onClick={(e) => { e.stopPropagation(); onDownload() }} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" title="Download">
        <Download size={14} />
      </button>
      <button onClick={(e) => { e.stopPropagation(); onRename() }} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" title="Rename">
        <Pencil size={14} />
      </button>
      <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-500" title="Delete">
        <Trash2 size={14} />
      </button>
    </div>
  )

  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: index * 0.02 }}
        onContextMenu={onContextMenu}
        onClick={onDetails}
        className={`group flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all hover:shadow-md ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
      >
        <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800">
          <Icon size={20} className="text-cyan-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{file.name}</p>
          <p className="text-xs text-slate-500">{formatBytes(file.size)} · {file.category} · {formatDate(file.uploadedAt)}</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button onClick={onPreview} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"><Eye size={16} /></button>
          <button onClick={onDownload} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"><Download size={16} /></button>
          <button onClick={onRename} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"><Pencil size={16} /></button>
          <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-500/20 text-red-500"><Trash2 size={16} /></button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.02 }}
      onContextMenu={onContextMenu}
      onClick={onDetails}
      className={`group p-4 rounded-2xl border cursor-pointer transition-all shadow-sm hover:shadow-md ${cardClasses}`}
    >
      <div className="flex items-center justify-center p-4 rounded-xl bg-slate-200/50 dark:bg-slate-800/50 mb-2">
        <Icon size={36} className="text-cyan-500" />
      </div>
      <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
      <p className="text-xs text-slate-500">{formatBytes(file.size)} · {formatDate(file.uploadedAt)}</p>
      {actions}
    </motion.div>
  )
}

function FilePreviewModal({ file, onClose, onDownload, onRename, onDelete, isDark }) {
  if (!file) return null

  const mt = (file.mimetype || '').toLowerCase()
  const isImage = mt.startsWith('image/')
  const isVideo = mt.startsWith('video/')
  const isAudio = mt.startsWith('audio/')
  const isPdf = mt === 'application/pdf'
  const previewUrl = file.path ? `${window.location.origin}${file.path}` : ''

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'}`}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold truncate flex-1 mr-4">{file.name}</h3>
          <div className="flex gap-2">
            <button onClick={() => onDownload(file)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <Download size={18} />
            </button>
            <button onClick={onRename} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <Pencil size={18} />
            </button>
            <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-500/20 text-red-500">
              <Trash2 size={18} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-4 overflow-auto max-h-[70vh] flex items-center justify-center bg-slate-100 dark:bg-slate-950">
          {isImage && <img src={previewUrl} alt={file.name} className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg" />}
          {isVideo && <video src={previewUrl} controls className="max-w-full max-h-[65vh] rounded-lg" />}
          {isAudio && <audio src={previewUrl} controls className="w-full max-w-md" />}
          {isPdf && <iframe src={previewUrl} title={file.name} className="w-full h-[65vh] rounded-lg border-0" />}
          {!isImage && !isVideo && !isAudio && !isPdf && (
            <div className="text-center text-slate-500 py-12">
              <FileText size={48} className="mx-auto mb-2 opacity-50" />
              <p>Preview not available for this file type</p>
              <button onClick={() => onDownload(file)} className="mt-4 text-cyan-500 hover:underline">Download instead</button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function FileDetailModal({ file, onClose, onDownload, onRename, onDelete, isDark }) {
  if (!file) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`rounded-2xl w-full max-w-md p-6 shadow-2xl ${isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'}`}
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">File Details</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>
        <dl className="space-y-3 text-sm">
          <div><dt className="text-slate-500">Name</dt><dd className="font-mono text-slate-700 dark:text-slate-200">{file.name}</dd></div>
          <div><dt className="text-slate-500">Type / Category</dt><dd className="text-slate-700 dark:text-slate-200">{file.mimetype} · {file.category}</dd></div>
          <div><dt className="text-slate-500">Size</dt><dd className="text-slate-700 dark:text-slate-200">{formatBytes(file.size)}</dd></div>
          <div><dt className="text-slate-500">Path</dt><dd className="font-mono text-slate-500 text-xs break-all">{file.path}</dd></div>
          <div><dt className="text-slate-500">Uploaded</dt><dd className="text-slate-700 dark:text-slate-200">{formatDate(file.uploadedAt)}</dd></div>
        </dl>
        <div className="flex gap-2 mt-6">
          <button onClick={() => { onDownload(file); onClose() }} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/30 font-medium">
            <Download size={16} /> Download
          </button>
          <button onClick={() => { onRename(); onClose() }} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
            <Pencil size={16} /> Rename
          </button>
          <button onClick={() => { onDelete(); onClose() }} className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-500/20 text-red-500 hover:bg-red-500/30">
            <Trash2 size={16} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function RenameModal({ file, value, onChange, onSave, onClose, isDark }) {
  if (!file) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`rounded-2xl w-full max-w-md p-6 shadow-2xl ${isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'}`}
      >
        <h3 className="text-lg font-semibold mb-4">Rename file</h3>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSave(value)}
          className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
            isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
          placeholder="New name"
          autoFocus
        />
        <div className="flex gap-2 mt-4">
          <button onClick={() => onSave(value)} className="flex-1 py-2.5 rounded-xl bg-cyan-500 text-white font-medium hover:bg-cyan-600">
            Save
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
