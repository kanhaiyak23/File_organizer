/**
 * REST API Server for File Organizer System
 * 
 * Provides a bridge between the React frontend and system layer.
 * Frontend does NOT touch the file system directly.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { FileOrganizer } from '../core/organizer.js';
import { FileSystemObserver } from '../core/observer.js';
import { SystemLogger } from '../core/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

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
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/analyze
 * Analyze a directory without organizing
 */
app.get('/api/analyze', async (req, res) => {
    try {
        const { path: targetPath } = req.query;

        if (!targetPath) {
            return res.status(400).json({ error: 'Path parameter required' });
        }

        const absolutePath = path.resolve(targetPath);
        logger.info('API', `Analyzing: ${absolutePath}`);

        const entries = await observer.scan(absolutePath, {
            recursive: false,
            includeHidden: false
        });

        const stats = observer.getStatistics(entries);

        // Build file tree for frontend
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
 * Execute file organization
 */
app.post('/api/organize', async (req, res) => {
    try {
        const { path: targetPath, dryRun = false, parallel = false } = req.body;

        if (!targetPath) {
            return res.status(400).json({ error: 'Path parameter required' });
        }

        if (currentOperation) {
            return res.status(409).json({ error: 'Operation already in progress' });
        }

        const absolutePath = path.resolve(targetPath);
        const configPath = path.join(__dirname, '../../config/rules.json');

        logger.info('API', `Organizing: ${absolutePath} (dryRun: ${dryRun}, parallel: ${parallel})`);

        currentOperation = 'organizing';

        const organizer = new FileOrganizer({
            logger,
            dryRun,
            parallel,
            configPath
        });

        await organizer.initialize();
        const summary = await organizer.organize(absolutePath);

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
 * Get current operation status
 */
app.get('/api/status', (req, res) => {
    res.json({
        currentOperation,
        lastSummary: lastSummary?.toJSON() || null
    });
});

/**
 * GET /api/logs
 * Get logged entries
 */
app.get('/api/logs', (req, res) => {
    res.json(logger.toJSON());
});

/**
 * GET /api/rules
 * Get current rules configuration
 */
app.get('/api/rules', async (req, res) => {
    try {
        const configPath = path.join(__dirname, '../../config/rules.json');
        const { default: fs } = await import('fs/promises');
        const content = await fs.readFile(configPath, 'utf8');
        res.json(JSON.parse(content));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/preview
 * Preview organization plan without executing
 */
app.post('/api/preview', async (req, res) => {
    try {
        const { path: targetPath } = req.body;

        if (!targetPath) {
            return res.status(400).json({ error: 'Path parameter required' });
        }

        const absolutePath = path.resolve(targetPath);
        const configPath = path.join(__dirname, '../../config/rules.json');

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
║    GET  /api/status   - Operation status                      ║
║    GET  /api/logs     - View logs                             ║
║    GET  /api/rules    - Get rules config                      ║
║                                                               ║
║  Server running on: http://localhost:${PORT}                    ║
╚═══════════════════════════════════════════════════════════════╝
`);
});
