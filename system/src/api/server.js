/**
 * REST API Server for File Organizer System
 * 
 * Provides a bridge between the React frontend and system layer.
 * Frontend does NOT touch the file system directly.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { FileOrganizer } from '../core/organizer.js';
import { FileSystemObserver } from '../core/observer.js';
import { SystemLogger } from '../core/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = path.join(os.tmpdir(), 'file-organizer-uploads');

// Ensure upload dir exists
await fs.mkdir(UPLOAD_DIR, { recursive: true });

// Multer: save uploads to temp dir (unique session per request)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (req.uploadSessionDir) return cb(null, req.uploadSessionDir);
        const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const sessionDir = path.join(UPLOAD_DIR, id);
        fs.mkdir(sessionDir, { recursive: true }).then(() => {
            req.uploadSessionDir = sessionDir;
            cb(null, sessionDir);
        }).catch(cb);
    },
    filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json());

// State
let currentOperation = null;
let lastSummary = null;
let logger = new SystemLogger({ verbose: true });
let observer = new FileSystemObserver(logger);

/**
 * GET /api/health
 * Health check endpoint - verifies server is running
 * Used by monitoring tools and frontend to check API availability
 * 
 * @returns {Object} JSON with status 'ok' and current timestamp
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/analyze
 * Scans a directory and returns file metadata without making changes
 * Provides statistics grouped by extension, size, age, and permissions
 * 
 * @query {string} path - Directory path to analyze
 * @returns {Object} JSON with path, statistics, and array of file entries
 * @throws {400} If path parameter is missing
 * @throws {500} If directory doesn't exist or is inaccessible
 */
app.get('/api/analyze', async (req, res) => {
    try {
        const { path: targetPath } = req.query;

        if (!targetPath) {
            return res.status(400).json({ error: 'Path parameter required' });
        }

        const absolutePath = path.resolve(targetPath);
        logger.info('API', `Analyzing: ${absolutePath}`);

        // Scan directory for files (non-recursive, excluding hidden files)
        const entries = await observer.scan(absolutePath, {
            recursive: false,
            includeHidden: false
        });

        // Calculate aggregate statistics
        const stats = observer.getStatistics(entries);

        // Transform file entries for frontend consumption
        const files = entries.map(entry => ({
            name: entry.name,
            path: entry.path,
            size: entry.size,
            extension: entry.extension,
            isHidden: entry.isHidden,
            mtime: entry.mtime?.toISOString(),
            sizeCategory: entry.getSizeCategory(),
            ageCategory: entry.getAgeCategory(),
            isReadable: entry.isReadable(),
            isWritable: entry.isWritable(),
            isExecutable: entry.isExecutable()
        }));

        res.json({
            path: absolutePath,
            totalFiles: stats.totalFiles,
            totalSize: stats.totalSize,
            statistics: stats,
            files
        });
    } catch (error) {
        logger.error('API', `Analyze error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/organize
 * Executes file organization based on configured rules
 * Moves files into categorized subdirectories (Documents, Images, etc.)
 * Only one organization operation can run at a time
 * 
 * @body {string} path - Directory path to organize
 * @body {boolean} dryRun - If true, simulates without moving files (default: false)
 * @body {boolean} parallel - If true, uses parallel execution (default: false)
 * @returns {Object} JSON with success status and organization summary
 * @throws {400} If path parameter is missing
 * @throws {409} If another operation is already in progress
 * @throws {500} If organization fails
 */
app.post('/api/organize', async (req, res) => {
    try {
        const { path: targetPath, dryRun = false, parallel = false } = req.body;

        if (!targetPath) {
            return res.status(400).json({ error: 'Path parameter required' });
        }

        // Prevent concurrent operations (mutex-like behavior)
        if (currentOperation) {
            return res.status(409).json({ error: 'Operation already in progress' });
        }

        const absolutePath = path.resolve(targetPath);
        const configPath = path.join(__dirname, '../../config/rules.json');

        logger.info('API', `Organizing: ${absolutePath} (dryRun: ${dryRun}, parallel: ${parallel})`);

        // Mark operation as in-progress
        currentOperation = 'organizing';

        // Initialize organizer with configuration
        const organizer = new FileOrganizer({
            logger,
            dryRun,
            parallel,
            configPath
        });

        await organizer.initialize();
        const summary = await organizer.organize(absolutePath);

        // Store result and clear operation state
        lastSummary = summary;
        currentOperation = null;

        res.json({
            success: true,
            summary: summary.toJSON()
        });
    } catch (error) {
        currentOperation = null;
        logger.error('API', `Organize error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/status
 * Returns current operation status and last result
 * Used by frontend to poll for operation completion
 * 
 * @returns {Object} JSON with currentOperation (string|null) and lastSummary (Object|null)
 */
app.get('/api/status', (req, res) => {
    res.json({
        currentOperation,
        lastSummary: lastSummary?.toJSON() || null
    });
});

/**
 * GET /api/logs
 * Returns all log entries from the current session
 * Includes summary statistics and full entry details
 * 
 * @returns {Object} JSON with startTime, endTime, summary, and entries array
 */
app.get('/api/logs', (req, res) => {
    res.json(logger.toJSON());
});

/**
 * GET /api/rules
 * Returns the current file organization rules configuration
 * Rules define how files are categorized based on extension, size, etc.
 * 
 * @returns {Object} JSON rules configuration from config/rules.json
 * @throws {500} If rules file cannot be read or parsed
 */
app.get('/api/rules', async (req, res) => {
    try {
        const configPath = path.join(__dirname, '../../config/rules.json');
        // Dynamic import for fs/promises
        const { default: fs } = await import('fs/promises');
        const content = await fs.readFile(configPath, 'utf8');
        res.json(JSON.parse(content));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/preview
 * Generates a preview of what organization would do without making changes
 * Runs organizer in dry-run mode to show planned moves
 * 
 * @body {string} path - Directory path to preview
 * @returns {Object} JSON with success status and preview summary (same format as organize)
 * @throws {400} If path parameter is missing
 * @throws {500} If preview generation fails
 */
app.post('/api/preview', async (req, res) => {
    try {
        const { path: targetPath } = req.body;

        if (!targetPath) {
            return res.status(400).json({ error: 'Path parameter required' });
        }

        const absolutePath = path.resolve(targetPath);
        const configPath = path.join(__dirname, '../../config/rules.json');

        // Initialize organizer in dry-run mode (no actual file changes)
        const organizer = new FileOrganizer({
            logger,
            dryRun: true,
            configPath
        });

        await organizer.initialize();
        const summary = await organizer.organize(absolutePath);

        res.json({
            success: true,
            preview: summary.toJSON()
        });
    } catch (error) {
        logger.error('API', `Preview error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/upload
 * Accepts file uploads, saves to temp dir, runs organize & categorize, returns summary
 * Uses backend rules for categorization (Documents, Images, Videos, etc.)
 *
 * @body multipart/form-data files - Files to upload and organize
 * @returns {Object} JSON with success, summary, and analysis
 */
app.post('/api/upload', upload.array('files', 100), async (req, res) => {
    const sessionDir = req.uploadSessionDir;
    if (!sessionDir || !req.files?.length) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    if (currentOperation) {
        return res.status(409).json({ error: 'Operation already in progress' });
    }

    currentOperation = 'upload-organize';

    try {
        logger.info('API', `Organizing ${req.files.length} uploaded files in ${sessionDir}`);

        const configPath = path.join(__dirname, '../../config/rules.json');
        const organizer = new FileOrganizer({ logger, dryRun: false, parallel: true, configPath });
        await organizer.initialize();
        const summary = await organizer.organize(sessionDir);

        // Analyze resulting structure
        const entries = await observer.scan(sessionDir, { recursive: true, includeHidden: false });
        const stats = observer.getStatistics(entries);
        const files = entries.filter(e => !e.isDirectory).map(e => ({
            name: e.name,
            path: e.path.replace(sessionDir, '').replace(/^\//, ''),
            size: e.size,
            extension: e.extension,
            sizeCategory: e.getSizeCategory?.() || 'unknown',
            ageCategory: e.getAgeCategory?.() || 'unknown',
        }));

        lastSummary = summary.toJSON();

        res.json({
            success: true,
            summary: lastSummary,
            analysis: {
                path: sessionDir,
                totalFiles: stats.totalFiles,
                totalSize: stats.totalSize,
                statistics: stats,
                files,
            },
        });
    } catch (error) {
        logger.error('API', `Upload/organize error: ${error.message}`);
        res.status(500).json({ error: error.message });
    } finally {
        currentOperation = null;
        // Clean up temp dir after a short delay
        if (sessionDir) {
            setTimeout(async () => {
                try {
                    await fs.rm(sessionDir, { recursive: true, force: true });
                } catch (e) {
                    logger.info('API', `Could not remove temp dir: ${e.message}`);
                }
            }, 5000);
        }
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         FILE ORGANIZER API SERVER                             ║
║                                                               ║
║  Endpoints:                                                   ║
║    GET  /api/health   - Health check                          ║
║    GET  /api/analyze  - Analyze directory                     ║
║    POST /api/organize - Execute organization                  ║
║    POST /api/preview  - Preview plan                          ║
║    POST /api/upload   - Upload files & organize               ║
║    GET  /api/status   - Operation status                      ║
║    GET  /api/logs     - View logs                             ║
║    GET  /api/rules    - Get rules config                      ║
║                                                               ║
║  Server running on: http://localhost:${PORT}                    ║
╚═══════════════════════════════════════════════════════════════╝
`);
});
