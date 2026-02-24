/**
 * File Organizer API — Windows Explorer-Style Filesystem Backend
 * 
 * Directly reads the filesystem (no JSON metadata store).
 * Supports directory-level organization, virtual disk simulation,
 * file upload, rename, delete, and folder creation.
 */

import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Virtual Disk Roots ──────────────────────────────────────────────
// Each virtual disk maps to a real directory on the filesystem.
const DATA_ROOT = path.join(__dirname, 'data')
const UNDO_LOG_PATH = path.join(__dirname, '.undo_log.json')
const VIRTUAL_DISKS = {
  'C:': path.join(DATA_ROOT, 'C'),
  'D:': path.join(DATA_ROOT, 'D'),
  'E:': path.join(DATA_ROOT, 'E'),
}

// ── Extension → Category Mapping ────────────────────────────────────
const EXT_TO_CATEGORY = {
  // Documents
  pdf: 'Documents', doc: 'Documents', docx: 'Documents', txt: 'Documents',
  rtf: 'Documents', odt: 'Documents', xls: 'Documents', xlsx: 'Documents',
  ppt: 'Documents', pptx: 'Documents', md: 'Documents', csv: 'Documents',
  // Images
  jpg: 'Images', jpeg: 'Images', png: 'Images', gif: 'Images',
  webp: 'Images', svg: 'Images', bmp: 'Images', ico: 'Images', heic: 'Images',
  // Videos
  mp4: 'Videos', mov: 'Videos', mkv: 'Videos', avi: 'Videos',
  webm: 'Videos', flv: 'Videos', wmv: 'Videos', m4v: 'Videos',
  // Audio
  mp3: 'Audio', wav: 'Audio', flac: 'Audio', aac: 'Audio',
  ogg: 'Audio', m4a: 'Audio', wma: 'Audio',
}

const CATEGORY_FOLDERS = ['Documents', 'Images', 'Videos', 'Audio', 'Others']

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Resolve a virtual path like "C:/folder/sub" to a real absolute path.
 * Validates the path is within the sandbox.
 */
function resolveVirtualPath(virtualPath) {
  if (!virtualPath) return null
  const normalized = virtualPath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  const diskLabel = parts[0] // e.g. "C:"
  const diskRoot = VIRTUAL_DISKS[diskLabel]
  if (!diskRoot) return null
  const subPath = parts.slice(1).join('/')
  const resolved = path.resolve(diskRoot, subPath)
  // Sandbox check — must be inside the disk root
  if (!resolved.startsWith(diskRoot)) return null
  return resolved
}

/**
 * Convert a real absolute path back to a virtual path.
 */
function toVirtualPath(realPath) {
  for (const [label, root] of Object.entries(VIRTUAL_DISKS)) {
    if (realPath.startsWith(root)) {
      const relative = path.relative(root, realPath)
      return relative ? `${label}/${relative.replace(/\\/g, '/')}` : label
    }
  }
  return null
}

function getCategory(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  return EXT_TO_CATEGORY[ext] || 'Others'
}

function getFileType(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (EXT_TO_CATEGORY[ext]) {
    return EXT_TO_CATEGORY[ext].toLowerCase().replace(/s$/, '')
  }
  return 'file'
}

/**
 * Find a unique filename if there's a conflict.
 * photo.png → photo (1).png → photo (2).png …
 */
async function uniqueFilename(dir, filename) {
  const ext = path.extname(filename)
  const base = path.basename(filename, ext)
  let candidate = filename
  let counter = 1
  while (true) {
    try {
      await fs.access(path.join(dir, candidate))
      // File exists, try next
      candidate = `${base} (${counter})${ext}`
      counter++
    } catch {
      // File doesn't exist — safe to use
      return candidate
    }
  }
}

// ── Initialize disk directories ──────────────────────────────────────
async function initDirs() {
  for (const root of Object.values(VIRTUAL_DISKS)) {
    await fs.mkdir(root, { recursive: true })
  }
  // Create a sample folder inside C: for demo purposes
  const sampleDir = path.join(VIRTUAL_DISKS['C:'], 'MyFiles')
  await fs.mkdir(sampleDir, { recursive: true })
}

// ── Express App ──────────────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json())

// ── GET /api/disks ──────────────────────────────────────────────────
// Returns the list of virtual disks
app.get('/api/disks', async (req, res) => {
  try {
    const disks = []
    for (const [label, root] of Object.entries(VIRTUAL_DISKS)) {
      let totalSize = 0
      let itemCount = 0
      try {
        const entries = await fs.readdir(root, { withFileTypes: true })
        itemCount = entries.filter(e => !e.name.startsWith('.')).length
      } catch { /* empty disk */ }
      disks.push({ label, path: label, itemCount })
    }
    res.json(disks)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/stats ──────────────────────────────────────────────────
// Returns aggregate statistics across all virtual disks for the dashboard
app.get('/api/stats', async (req, res) => {
  try {
    let totalFiles = 0
    let totalFolders = 0
    let totalSize = 0
    let largestFile = { name: '—', size: 0, path: '' }
    const typeDistribution = {}
    const diskUsage = []

    // Recursive scan helper
    async function scanDir(dirPath, virtualPrefix) {
      let dirSize = 0
      let entries
      try { entries = await fs.readdir(dirPath, { withFileTypes: true }) }
      catch { return 0 }

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = path.join(dirPath, entry.name)
        try {
          const stat = await fs.stat(fullPath)
          if (entry.isDirectory()) {
            totalFolders++
            dirSize += await scanDir(fullPath, `${virtualPrefix}/${entry.name}`)
          } else {
            totalFiles++
            totalSize += stat.size
            dirSize += stat.size
            if (stat.size > largestFile.size) {
              largestFile = { name: entry.name, size: stat.size, path: `${virtualPrefix}/${entry.name}` }
            }
            const cat = getCategory(entry.name)
            typeDistribution[cat] = (typeDistribution[cat] || 0) + 1
          }
        } catch { /* skip */ }
      }
      return dirSize
    }

    for (const [label, root] of Object.entries(VIRTUAL_DISKS)) {
      const used = await scanDir(root, label)
      diskUsage.push({ label, used })
    }

    // Check for recent undo action
    let recentAction = null
    try {
      const undoData = await fs.readFile(UNDO_LOG_PATH, 'utf-8')
      const log = JSON.parse(undoData)
      recentAction = {
        type: 'organize',
        timestamp: log.timestamp,
        path: log.virtualPath,
        fileCount: log.moves.length,
        undoAvailable: true,
      }
    } catch { /* no undo log */ }

    res.json({
      totalFiles,
      totalFolders,
      totalSize,
      largestFile,
      typeDistribution,
      diskUsage,
      recentAction,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/files?path=... ─────────────────────────────────────────
// List directory contents. Returns files and folders with metadata.
app.get('/api/files', async (req, res) => {
  try {
    const virtualPath = req.query.path
    if (!virtualPath) {
      return res.status(400).json({ error: 'path is required' })
    }

    const realPath = resolveVirtualPath(virtualPath)
    if (!realPath) {
      return res.status(400).json({ error: 'Invalid path' })
    }

    // Check if directory exists
    try {
      const stat = await fs.stat(realPath)
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' })
      }
    } catch {
      return res.status(404).json({ error: 'Directory not found' })
    }

    const entries = await fs.readdir(realPath, { withFileTypes: true })
    const items = []

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue // skip hidden files

      const entryPath = path.join(realPath, entry.name)
      try {
        const stat = await fs.stat(entryPath)
        const isDir = entry.isDirectory()
        const ext = isDir ? '' : (entry.name.split('.').pop() || '').toLowerCase()

        let childCount = 0
        if (isDir) {
          try {
            const children = await fs.readdir(entryPath)
            childCount = children.filter(c => !c.startsWith('.')).length
          } catch { /* permission error etc */ }
        }

        items.push({
          name: entry.name,
          isDirectory: isDir,
          size: isDir ? 0 : stat.size,
          modified: stat.mtime.toISOString(),
          created: stat.birthtime.toISOString(),
          extension: ext,
          type: isDir ? 'folder' : getFileType(entry.name),
          category: isDir ? 'folder' : getCategory(entry.name),
          path: `${virtualPath}/${entry.name}`,
          childCount: isDir ? childCount : undefined,
        })
      } catch {
        // skip entries we can't stat
      }
    }

    // Sort: folders first, then alphabetically
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })

    res.json({
      path: virtualPath,
      items,
      parentPath: virtualPath.includes('/') ? virtualPath.substring(0, virtualPath.lastIndexOf('/')) || virtualPath.split('/')[0] : null,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/organize ──────────────────────────────────────────────
// Organize files in target directory into subfolders by type.
app.post('/api/organize', async (req, res) => {
  try {
    const { path: virtualPath } = req.body
    if (!virtualPath) {
      return res.status(400).json({ error: 'path is required' })
    }

    const realPath = resolveVirtualPath(virtualPath)
    if (!realPath) {
      return res.status(400).json({ error: 'Invalid path' })
    }

    // Only read files in this directory (not subdirectories)
    const entries = await fs.readdir(realPath, { withFileTypes: true })
    const filesToOrganize = entries.filter(e => e.isFile() && !e.name.startsWith('.'))

    if (filesToOrganize.length === 0) {
      return res.json({
        success: true,
        message: 'No files to organize',
        moved: 0,
        details: [],
      })
    }

    // Only skip organizing if the current folder IS a category folder
    // (e.g., user is inside "Images" and all files are images — no nested Images)
    const folderName = path.basename(realPath)
    const isCategoryFolder = CATEGORY_FOLDERS.includes(folderName)
    if (isCategoryFolder) {
      const categories = new Set(filesToOrganize.map(e => getCategory(e.name)))
      if (categories.size === 1 && [...categories][0] === folderName) {
        return res.json({
          success: true,
          message: `Already inside ${folderName} folder — no reorganization needed`,
          moved: 0,
          details: [],
        })
      }
    }

    const details = []
    const moves = []
    let movedCount = 0

    for (const entry of filesToOrganize) {
      const category = getCategory(entry.name)
      const destDir = path.join(realPath, category)

      // Create category subfolder if it doesn't exist
      await fs.mkdir(destDir, { recursive: true })

      // Resolve conflicts
      const destFilename = await uniqueFilename(destDir, entry.name)
      const srcPath = path.join(realPath, entry.name)
      const destPath = path.join(destDir, destFilename)

      await fs.rename(srcPath, destPath)
      movedCount++
      moves.push({ from: srcPath, to: destPath, originalName: entry.name, category })
      details.push({
        file: entry.name,
        movedTo: `${category}/${destFilename}`,
        category,
      })
    }

    // Write undo log so the user can reverse this action
    const actionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const undoLog = {
      actionId,
      timestamp: new Date().toISOString(),
      virtualPath,
      moves,
    }
    await fs.writeFile(UNDO_LOG_PATH, JSON.stringify(undoLog, null, 2))

    res.json({
      success: true,
      message: `Organized ${movedCount} file(s) into subfolders`,
      moved: movedCount,
      actionId,
      details,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/undo-status ────────────────────────────────────────────
// Check if an undo action is available
app.get('/api/undo-status', async (req, res) => {
  try {
    const data = await fs.readFile(UNDO_LOG_PATH, 'utf-8')
    const log = JSON.parse(data)
    res.json({
      available: true,
      actionId: log.actionId,
      timestamp: log.timestamp,
      virtualPath: log.virtualPath,
      fileCount: log.moves.length,
    })
  } catch {
    res.json({ available: false })
  }
})

// ── POST /api/undo ──────────────────────────────────────────────────
// Undo the most recent organization action
app.post('/api/undo', async (req, res) => {
  try {
    const { actionId } = req.body
    if (!actionId) return res.status(400).json({ error: 'actionId is required' })

    let log
    try {
      const data = await fs.readFile(UNDO_LOG_PATH, 'utf-8')
      log = JSON.parse(data)
    } catch {
      return res.status(404).json({ error: 'No undo action available' })
    }

    if (log.actionId !== actionId) {
      return res.status(400).json({ error: 'Action ID mismatch — this is not the most recent action' })
    }

    // Move files back to their original locations
    let restored = 0
    const foldersToCheck = new Set()

    for (const move of log.moves) {
      try {
        await fs.rename(move.to, move.from)
        restored++
        // Track the category folder that might now be empty
        foldersToCheck.add(path.dirname(move.to))
      } catch (err) {
        // File may have been manually moved/deleted — skip it
      }
    }

    // Clean up empty category folders
    for (const folder of foldersToCheck) {
      try {
        const remaining = await fs.readdir(folder)
        if (remaining.length === 0) {
          await fs.rmdir(folder)
        }
      } catch { /* folder may not exist */ }
    }

    // Delete the undo log
    await fs.unlink(UNDO_LOG_PATH).catch(() => { })

    res.json({ success: true, restored })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/mkdir ─────────────────────────────────────────────────
// Create a new folder
app.post('/api/mkdir', async (req, res) => {
  try {
    const { path: parentVirtual, name } = req.body
    if (!parentVirtual || !name) {
      return res.status(400).json({ error: 'path and name are required' })
    }

    const safeName = name.trim().replace(/[<>:"/\\|?*]/g, '_').slice(0, 100)
    if (!safeName) {
      return res.status(400).json({ error: 'Invalid folder name' })
    }

    const parentReal = resolveVirtualPath(parentVirtual)
    if (!parentReal) {
      return res.status(400).json({ error: 'Invalid parent path' })
    }

    const newDir = path.join(parentReal, safeName)
    await fs.mkdir(newDir, { recursive: true })

    res.json({
      success: true,
      name: safeName,
      path: `${parentVirtual}/${safeName}`,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/check-duplicates ──────────────────────────────────────
// Check which files already exist in a target directory before uploading.
app.post('/api/check-duplicates', async (req, res) => {
  try {
    const { path: virtualPath, fileNames } = req.body
    if (!virtualPath || !Array.isArray(fileNames)) {
      return res.status(400).json({ error: 'path and fileNames[] are required' })
    }
    const realPath = resolveVirtualPath(virtualPath)
    if (!realPath) return res.status(400).json({ error: 'Invalid path' })

    const conflicts = []
    for (const name of fileNames) {
      const filePath = path.join(realPath, name)
      try {
        const stat = await fs.stat(filePath)
        if (stat.isFile()) {
          conflicts.push({
            fileName: name,
            existingSize: stat.size,
            existingModified: stat.mtime.toISOString(),
          })
        }
      } catch {
        // File doesn't exist — no conflict
      }
    }

    res.json({ conflicts })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/upload ────────────────────────────────────────────────
// Upload files with conflict resolution support.
// Fields: path, overwrite ("true"), renameTo (JSON {"old":"new"}), skip (JSON ["name"])
const TEMP_DIR = path.join(__dirname, '.tmp_uploads')
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(TEMP_DIR, { recursive: true })
      .then(() => cb(null, TEMP_DIR))
      .catch(cb)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e6)
    cb(null, `${uniqueSuffix}_${file.originalname}`)
  },
})

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
})

app.post('/api/upload', upload.array('files', 50), async (req, res) => {
  try {
    const virtualPath = req.body?.path
    if (!virtualPath) return res.status(400).json({ error: 'path is required' })
    const realPath = resolveVirtualPath(virtualPath)
    if (!realPath) return res.status(400).json({ error: 'Invalid path' })

    await fs.mkdir(realPath, { recursive: true })

    const overwrite = req.body?.overwrite === 'true'
    let renameMap = {}
    if (req.body?.renameTo) {
      try { renameMap = JSON.parse(req.body.renameTo) } catch { }
    }
    let skipList = []
    if (req.body?.skip) {
      try { skipList = JSON.parse(req.body.skip) } catch { }
    }

    const uploaded = []
    const skipped = []

    for (const file of (req.files || [])) {
      const originalName = file.originalname
      const tempPath = file.path

      if (skipList.includes(originalName)) {
        await fs.unlink(tempPath).catch(() => { })
        skipped.push(originalName)
        continue
      }

      let finalName = renameMap[originalName] || originalName
      const destPath = path.join(realPath, finalName)

      if (!overwrite && !renameMap[originalName]) {
        try {
          await fs.access(destPath)
          await fs.unlink(tempPath).catch(() => { })
          skipped.push(originalName)
          continue
        } catch { /* no conflict */ }
      }

      await fs.rename(tempPath, destPath).catch(async () => {
        await fs.copyFile(tempPath, destPath)
        await fs.unlink(tempPath).catch(() => { })
      })

      const stat = await fs.stat(destPath)
      uploaded.push({
        name: finalName,
        size: stat.size,
        path: `${virtualPath}/${finalName}`,
      })
    }

    res.json({ success: true, files: uploaded, count: uploaded.length, skipped })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/delete ────────────────────────────────────────────────
// Delete a file or empty folder
app.post('/api/delete', async (req, res) => {
  try {
    const { path: virtualPath } = req.body
    if (!virtualPath) {
      return res.status(400).json({ error: 'path is required' })
    }

    const realPath = resolveVirtualPath(virtualPath)
    if (!realPath) {
      return res.status(400).json({ error: 'Invalid path' })
    }

    const stat = await fs.stat(realPath)
    if (stat.isDirectory()) {
      await fs.rm(realPath, { recursive: true })
    } else {
      await fs.unlink(realPath)
    }

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/rename ────────────────────────────────────────────────
// Rename a file or folder
app.post('/api/rename', async (req, res) => {
  try {
    const { path: virtualPath, newName } = req.body
    if (!virtualPath || !newName) {
      return res.status(400).json({ error: 'path and newName are required' })
    }

    const safeName = newName.trim().replace(/[<>:"/\\|?*]/g, '_').slice(0, 200)
    if (!safeName) {
      return res.status(400).json({ error: 'Invalid name' })
    }

    const realPath = resolveVirtualPath(virtualPath)
    if (!realPath) {
      return res.status(400).json({ error: 'Invalid path' })
    }

    const dir = path.dirname(realPath)
    const newPath = path.join(dir, safeName)

    // Check if target already exists
    try {
      await fs.access(newPath)
      return res.status(409).json({ error: 'A file or folder with that name already exists' })
    } catch {
      // Good — target doesn't exist
    }

    await fs.rename(realPath, newPath)

    const parentVirtual = virtualPath.substring(0, virtualPath.lastIndexOf('/'))
    res.json({
      success: true,
      oldPath: virtualPath,
      newPath: `${parentVirtual}/${safeName}`,
      name: safeName,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/tree?path=... ──────────────────────────────────────────
// Returns folder tree (directories only) for the sidebar, up to 3 levels deep
app.get('/api/tree', async (req, res) => {
  try {
    const virtualPath = req.query.path
    if (!virtualPath) {
      return res.status(400).json({ error: 'path is required' })
    }

    const realPath = resolveVirtualPath(virtualPath)
    if (!realPath) {
      return res.status(400).json({ error: 'Invalid path' })
    }

    async function buildTree(dirPath, vPath, depth = 0) {
      if (depth > 2) return []
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        const folders = []
        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name.startsWith('.')) continue
          const childReal = path.join(dirPath, entry.name)
          const childVirtual = `${vPath}/${entry.name}`
          const children = depth < 2 ? await buildTree(childReal, childVirtual, depth + 1) : []
          folders.push({
            name: entry.name,
            path: childVirtual,
            children,
            hasChildren: children.length > 0,
          })
        }
        folders.sort((a, b) => a.name.localeCompare(b.name))
        return folders
      } catch {
        return []
      }
    }

    const tree = await buildTree(realPath, virtualPath)
    res.json(tree)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/download?path=... ───────────────────────────────────────
// Download a file
app.get('/api/download', async (req, res) => {
  try {
    const virtualPath = req.query.path
    if (!virtualPath) return res.status(400).json({ error: 'path is required' })
    const realPath = resolveVirtualPath(virtualPath)
    if (!realPath) return res.status(400).json({ error: 'Invalid path' })
    const stat = await fs.stat(realPath)
    if (stat.isDirectory()) return res.status(400).json({ error: 'Cannot download a directory' })
    res.download(realPath, path.basename(realPath))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── GET /api/preview?path=... ───────────────────────────────────────
// Preview file content (for text files) or return metadata
app.get('/api/preview', async (req, res) => {
  try {
    const virtualPath = req.query.path
    if (!virtualPath) return res.status(400).json({ error: 'path is required' })
    const realPath = resolveVirtualPath(virtualPath)
    if (!realPath) return res.status(400).json({ error: 'Invalid path' })

    const stat = await fs.stat(realPath)
    const filename = path.basename(realPath)
    const ext = (filename.split('.').pop() || '').toLowerCase()
    const category = getCategory(filename)

    const info = {
      name: filename,
      path: virtualPath,
      size: stat.size,
      modified: stat.mtime.toISOString(),
      created: stat.birthtime.toISOString(),
      extension: ext,
      category,
      type: getFileType(filename),
    }

    // For text-based files, include content preview
    const textExtensions = ['txt', 'md', 'csv', 'json', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'xml', 'yaml', 'yml', 'log', 'ini', 'cfg', 'env', 'sh', 'bat', 'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'rb', 'php']
    if (textExtensions.includes(ext)) {
      try {
        const content = await fs.readFile(realPath, 'utf8')
        info.content = content.slice(0, 50000) // limit preview to 50KB
        info.previewType = 'text'
      } catch {
        info.previewType = 'none'
      }
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) {
      // For images, provide the serve URL
      info.previewType = 'image'
      info.previewUrl = `/data/${virtualPath.replace(':', '')}`
    } else if (['mp4', 'webm', 'mov'].includes(ext)) {
      info.previewType = 'video'
      info.previewUrl = `/data/${virtualPath.replace(':', '')}`
    } else if (['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext)) {
      info.previewType = 'audio'
      info.previewUrl = `/data/${virtualPath.replace(':', '')}`
    } else if (ext === 'pdf') {
      info.previewType = 'pdf'
      info.previewUrl = `/data/${virtualPath.replace(':', '')}`
    } else {
      info.previewType = 'none'
    }

    res.json(info)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Serve uploaded files ─────────────────────────────────────────────
app.use('/data', express.static(DATA_ROOT))

// ── Start Server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3002
await initDirs()
const server = app.listen(PORT, () => {
  console.log(`File Organizer API running at http://localhost:${PORT}`)
  console.log(`Virtual disks:`)
  for (const [label, root] of Object.entries(VIRTUAL_DISKS)) {
    console.log(`  ${label} → ${root}`)
  }
})
