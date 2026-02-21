/**
 * File Organizer API - Simulates OS File System Management
 * 
 * Directory structure:
 *   /uploads/documents
 *   /uploads/images
 *   /uploads/videos
 *   /uploads/audio
 *   /uploads/others
 */

import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.join(__dirname, 'uploads')
const DATA_FILE = path.join(__dirname, 'data', 'files.json')

// Extension → category mapping
const EXT_TO_CATEGORY = {
  pdf: 'documents', doc: 'documents', docx: 'documents', txt: 'documents',
  rtf: 'documents', odt: 'documents', xls: 'documents', xlsx: 'documents',
  ppt: 'documents', pptx: 'documents', md: 'documents', csv: 'documents',
  jpg: 'images', jpeg: 'images', png: 'images', gif: 'images',
  webp: 'images', svg: 'images', bmp: 'images', ico: 'images', heic: 'images',
  mp4: 'videos', mov: 'videos', mkv: 'videos', avi: 'videos',
  webm: 'videos', flv: 'videos', wmv: 'videos', m4v: 'videos',
  mp3: 'audio', wav: 'audio', flac: 'audio', aac: 'audio',
  ogg: 'audio', m4a: 'audio', wma: 'audio',
}

const CATEGORIES = ['documents', 'images', 'videos', 'audio', 'others']

// Ensure dirs exist
async function initDirs() {
  for (const cat of CATEGORIES) {
    await fs.mkdir(path.join(UPLOADS_DIR, cat), { recursive: true })
  }
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  try {
    await fs.access(DATA_FILE)
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([]), 'utf8')
  }
}

// Load/save metadata
async function loadFiles() {
  const data = await fs.readFile(DATA_FILE, 'utf8')
  return JSON.parse(data || '[]')
}

async function saveFiles(files) {
  await fs.writeFile(DATA_FILE, JSON.stringify(files, null, 2), 'utf8')
}

function getCategory(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  return EXT_TO_CATEGORY[ext] || 'others'
}

// Multer: store by category
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = getCategory(file.originalname)
    cb(null, path.join(UPLOADS_DIR, category))
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ''
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_')
    cb(null, `${base}_${uuidv4().slice(0, 8)}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
})

const app = express()
app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(UPLOADS_DIR))

// GET /api/stats - File counts, total size, folder sizes
app.get('/api/stats', async (req, res) => {
  try {
    const files = await loadFiles()
    const totalSize = files.reduce((s, f) => s + (f.size || 0), 0)
    const byCategory = {}
    CATEGORIES.forEach(c => { byCategory[c] = { count: 0, size: 0 } })
    files.forEach(f => {
      if (byCategory[f.category]) {
        byCategory[f.category].count++
        byCategory[f.category].size += f.size || 0
      }
    })
    res.json({
      totalFiles: files.length,
      totalSize,
      byCategory,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/files - List all files (optional ?category=documents)
app.get('/api/files', async (req, res) => {
  try {
    let files = await loadFiles()
    const { category } = req.query
    if (category && CATEGORIES.includes(category)) {
      files = files.filter(f => f.category === category)
    }
    res.json(files)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/upload - Upload files
app.post('/api/upload', upload.array('files', 50), async (req, res) => {
  try {
    const uploaded = (req.files || []).map(f => ({
      id: uuidv4(),
      name: f.originalname,
      filename: f.filename,
      path: `/uploads/${getCategory(f.originalname)}/${f.filename}`,
      category: getCategory(f.originalname),
      size: f.size,
      mimetype: f.mimetype,
      uploadedAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    }))
    const files = await loadFiles()
    files.push(...uploaded)
    await saveFiles(files)
    broadcast({ type: 'files-updated' })
    res.json({ success: true, files: uploaded })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/files/:id - Rename or update metadata
app.patch('/api/files/:id', async (req, res) => {
  try {
    const { name, ...meta } = req.body
    const files = await loadFiles()
    const idx = files.findIndex(f => f.id === req.params.id)
    if (idx < 0) return res.status(404).json({ error: 'File not found' })

    const file = files[idx]
    const oldPath = path.join(UPLOADS_DIR, file.category, file.filename)

    if (name && name.trim() && name !== file.name) {
      const ext = path.extname(file.filename) || path.extname(file.name) || ''
      const base = path.basename(String(name), path.extname(String(name)) || ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) || 'file'
      const uid = file.filename.match(/_([a-f0-9]{8})$/)?.[1] || uuidv4().slice(0, 8)
      const newFilename = base + '_' + uid + ext
      const newPath = path.join(UPLOADS_DIR, file.category, newFilename)
      await fs.rename(oldPath, newPath)
      file.name = path.basename(String(name), path.extname(String(name))) + ext
      file.filename = newFilename
      file.path = `/uploads/${file.category}/${newFilename}`
    }

    Object.assign(file, meta, { modifiedAt: new Date().toISOString() })
    await saveFiles(files)
    broadcast({ type: 'files-updated' })
    res.json(file)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/files/:id - Delete file (fs.unlink + metadata)
app.delete('/api/files/:id', async (req, res) => {
  try {
    const files = await loadFiles()
    const idx = files.findIndex(f => f.id === req.params.id)
    if (idx < 0) return res.status(404).json({ error: 'File not found' })

    const file = files[idx]
    const filePath = path.join(UPLOADS_DIR, file.category, file.filename)
    await fs.unlink(filePath).catch(() => {})

    files.splice(idx, 1)
    await saveFiles(files)
    broadcast({ type: 'files-updated' })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/files/:id/download - Download file
app.get('/api/files/:id/download', async (req, res) => {
  try {
    const files = await loadFiles()
    const file = files.find(f => f.id === req.params.id)
    if (!file) return res.status(404).json({ error: 'File not found' })

    const filePath = path.join(UPLOADS_DIR, file.category, file.filename)
    res.download(filePath, file.name)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Broadcast to all WebSocket clients
const wssClients = new Set()
function broadcast(msg) {
  const data = JSON.stringify(msg)
  wssClients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(data)
  })
}

const PORT = process.env.PORT || 3002
await initDirs()
const server = app.listen(PORT, () => {
  console.log(`File Organizer API running at http://localhost:${PORT}`)
})

// WebSocket for real-time updates
const wss = new WebSocketServer({ path: '/ws', noServer: true })
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  }
})
wss.on('connection', (ws) => {
  wssClients.add(ws)
  ws.on('close', () => wssClients.delete(ws))
})
