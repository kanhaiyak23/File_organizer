/**
 * FileOrganizer - Execution engine for file organization
 * 
 * OS Concepts:
 * - Files are moved by changing inode references, not copying
 * - fs.rename() performs atomic move within same filesystem
 * - Sequential vs Parallel execution trade-offs
 * - Process creation overhead vs throughput
 */

import fs from 'fs/promises';
import path from 'path';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { fileURLToPath } from 'url';

import { FileSystemObserver } from './observer.js';
import { MetadataExtractor } from './metadata.js';
import { RuleEngine } from './rules.js';
import { SafetyManager } from './safety.js';
import { OperationResult, OrganizeSummary } from './models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FileOrganizer {
    /**
     * Creates a new FileOrganizer instance
     * Initializes all core modules: observer, metadata extractor, rule engine, and safety manager
     * 
     * @param {Object} options - Configuration options
     * @param {Object} options.logger - Logger instance for structured logging
     * @param {boolean} options.dryRun - If true, simulates operations without making changes
     * @param {boolean} options.parallel - If true, executes operations in parallel using worker threads
     * @param {string} options.configPath - Path to custom rules configuration file
     */
    constructor(options = {}) {
        this.logger = options.logger || null;
        this.dryRun = options.dryRun || false;
        this.parallel = options.parallel || false;
        this.configPath = options.configPath || null;

        this.observer = new FileSystemObserver(this.logger);
        this.metadata = new MetadataExtractor(this.logger);
        this.rules = new RuleEngine(this.logger);
        this.safety = new SafetyManager(this.logger);

        this.summary = null;
    }

    /**
     * Initialize the organizer (load rules, etc.)
     */
    async initialize() {
        if (this.configPath) {
            await this.rules.loadRules(this.configPath);
        } else {
            this.rules.loadDefaultRules();
        }

        // Check for rule conflicts
        const conflicts = this.rules.detectConflicts();
        if (conflicts.length > 0) {
            this.log('warn', `Detected ${conflicts.length} rule conflicts`);
            for (const conflict of conflicts) {
                this.log('warn', `  Conflict: ${conflict.rules.join(' vs ')} on extensions: ${conflict.extensions.join(', ')}`);
            }
        }
    }

    /**
     * Main organization entry point
     * @param {string} targetDir - Directory to organize
     * @returns {Promise<OrganizeSummary>} Organization summary
     */
    async organize(targetDir) {
        const absolutePath = path.resolve(targetDir);
        this.summary = new OrganizeSummary();
        this.summary.executionMode = this.parallel ? 'parallel' : 'sequential';

        this.log('info', `Starting organization of: ${absolutePath}`);
        this.log('info', `Mode: ${this.dryRun ? 'DRY RUN' : 'EXECUTE'} | Execution: ${this.summary.executionMode}`);

        // Phase 1: Acquire lock
        if (!this.dryRun) {
            const locked = await this.safety.acquireLock(absolutePath);
            if (!locked) {
                throw new Error('Could not acquire directory lock. Another organizer may be running.');
            }
        }

        try {
            // Phase 2: Observe file system
            this.log('info', 'Phase 1: Scanning file system...');
            const entries = await this.observer.scan(absolutePath, {
                recursive: false, // Only organize top-level files
                includeHidden: false,
                includeDirectories: false
            });
            this.summary.totalFiles = entries.length;

            // Log statistics
            const stats = this.observer.getStatistics(entries);
            this.log('info', `Found ${entries.length} files (${this._formatBytes(stats.totalSize)})`);

            // Phase 3: Classify and plan
            this.log('info', 'Phase 2: Classifying files...');
            const plan = this._createOrganizationPlan(entries, absolutePath);

            this.log('info', `Planned ${plan.length} operations`);
            for (const [category, files] of Object.entries(this._groupByCategory(plan))) {
                this.log('info', `  ${category}: ${files.length} files`);
            }

            // Phase 4: Execute
            this.log('info', 'Phase 3: Executing operations...');
            if (this.parallel) {
                await this._executeParallel(plan);
            } else {
                await this._executeSequential(plan);
            }

            this.summary.complete();

            // Phase 5: Report
            this.log('info', '='.repeat(50));
            this.log('info', `Organization complete in ${this.summary.duration}ms`);
            this.log('info', `  Success: ${this.summary.success}`);
            this.log('info', `  Skipped: ${this.summary.skipped}`);
            this.log('info', `  Errors: ${this.summary.errors}`);
            this.log('info', `  Permission Denied: ${this.summary.permissionDenied}`);

            if (!this.dryRun) {
                this.safety.clearTransactionLog();
            }

            return this.summary;
        } finally {
            // Always release lock
            if (!this.dryRun) {
                await this.safety.releaseLock(absolutePath);
            }
        }
    }

    /**
     * Creates an organization plan by evaluating each file against rules
     * Determines source/target paths and actions (move or skip) for each file
     * Does NOT execute any file operations - only creates the execution plan
     * 
     * @param {FileEntry[]} entries - Array of file entries to process
     * @param {string} baseDir - Base directory for relative path calculations
     * @returns {Object[]} Array of operation objects with action, paths, and rules
     * @private
     */
    _createOrganizationPlan(entries, baseDir) {
        const plan = [];

        for (const entry of entries) {
            const classification = this.metadata.extract(entry);
            const rule = this.rules.evaluate(entry, classification);

            if (!rule) {
                plan.push({
                    entry,
                    classification,
                    rule: null,
                    sourcePath: entry.path,
                    targetPath: null,
                    action: 'skip',
                    reason: 'No matching rule'
                });
                continue;
            }

            // Calculate target path
            const categoryDir = path.join(baseDir, rule.category);
            const targetPath = path.join(categoryDir, entry.name);

            // Skip if already in correct location
            if (path.dirname(entry.path) === categoryDir) {
                plan.push({
                    entry,
                    classification,
                    rule,
                    sourcePath: entry.path,
                    targetPath,
                    action: 'skip',
                    reason: 'Already in correct location'
                });
                continue;
            }

            plan.push({
                entry,
                classification,
                rule,
                sourcePath: entry.path,
                targetPath,
                targetDir: categoryDir,
                action: 'move'
            });
        }

        return plan;
    }

    /**
     * Executes file operations one at a time in sequence
     * Lower throughput but safer - prevents race conditions and reduces I/O contention
     * Each operation completes before the next begins
     * 
     * @param {Object[]} plan - Array of operation objects to execute
     * @returns {Promise<void>}
     * @private
     */
    async _executeSequential(plan) {
        for (const operation of plan) {
            const result = await this._executeOperation(operation);
            this.summary.addOperation(result);
            if (this.logger) {
                this.logger.logOperation(result);
            }
        }
    }

    /**
     * Executes file operations in parallel for improved throughput
     * Groups operations by target category to reduce filesystem contention
     * Each category group runs concurrently using Promise.all
     * Trades off safety for speed - use when organizing large directories
     * 
     * @param {Object[]} plan - Array of operation objects to execute
     * @returns {Promise<void>}
     * @private
     */
    async _executeParallel(plan) {
        const groups = this._groupByCategory(plan);
        const categoryNames = Object.keys(groups);

        this.log('info', `Executing ${categoryNames.length} categories in parallel`);

        // Execute each category group in parallel
        const promises = categoryNames.map(async (category) => {
            const operations = groups[category];
            const results = [];

            for (const operation of operations) {
                const result = await this._executeOperation(operation);
                results.push(result);
                if (this.logger) {
                    this.logger.logOperation(result);
                }
            }

            return results;
        });

        const allResults = await Promise.all(promises);

        // Flatten and add to summary
        for (const results of allResults) {
            for (const result of results) {
                this.summary.addOperation(result);
            }
        }
    }

    /**
     * Executes a single file move operation with safety checks
     * Performs atomic rename (inode reference change) within the same filesystem
     * Handles dry-run mode, safety validation, directory creation, and error cases
     * Records operations for potential rollback
     * 
     * @param {Object} operation - Operation object containing file, paths, and action
     * @returns {Promise<OperationResult>} Result with status, paths, and any errors
     * @private
     */
    async _executeOperation(operation) {
        const { entry, rule, sourcePath, targetPath, targetDir, action, reason } = operation;

        if (action === 'skip') {
            return new OperationResult({
                file: entry,
                status: OperationResult.Status.SKIPPED,
                sourcePath,
                targetPath: null,
                rule,
                error: null
            });
        }

        // Dry run - just report what would happen
        if (this.dryRun) {
            this.log('info', `[DRY RUN] Would move: ${entry.name} -> ${rule.category}/`);
            return new OperationResult({
                file: entry,
                status: OperationResult.Status.SUCCESS,
                sourcePath,
                targetPath,
                rule
            });
        }

        // Safety checks
        const safety = await this.safety.prepareSafeMove(sourcePath, targetPath, entry.ino);

        if (!safety.canProceed) {
            const status = safety.reason.includes('Permission')
                ? OperationResult.Status.PERMISSION_DENIED
                : safety.checks.targetConflict
                    ? OperationResult.Status.CONFLICT
                    : OperationResult.Status.FILE_NOT_FOUND;

            return new OperationResult({
                file: entry,
                status,
                sourcePath,
                targetPath,
                rule,
                error: new Error(safety.reason)
            });
        }

        // Create target directory if needed
        let createdDir = null;
        try {
            await fs.access(targetDir);
        } catch {
            await fs.mkdir(targetDir, { recursive: true });
            createdDir = targetDir;
        }

        // Execute move (atomic within same filesystem)
        try {
            await fs.rename(sourcePath, targetPath);

            // Record for potential rollback
            this.safety.recordOperation({
                type: 'move',
                sourcePath,
                targetPath,
                createdDir
            });

            return new OperationResult({
                file: entry,
                status: OperationResult.Status.SUCCESS,
                sourcePath,
                targetPath,
                rule
            });
        } catch (error) {
            const status = error.code === 'EACCES' || error.code === 'EPERM'
                ? OperationResult.Status.PERMISSION_DENIED
                : OperationResult.Status.ERROR;

            return new OperationResult({
                file: entry,
                status,
                sourcePath,
                targetPath,
                rule,
                error
            });
        }
    }

    /**
     * Groups operations by their target category for batch processing
     * Enables parallel execution of category groups with reduced contention
     * 
     * @param {Object[]} plan - Array of operation objects
     * @returns {Object} Object with category names as keys and operation arrays as values
     * @private
     */
    _groupByCategory(plan) {
        const groups = {};
        for (const op of plan) {
            const category = op.rule?.category || 'Other';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(op);
        }
        return groups;
    }

    /**
     * Converts bytes to human-readable string (KB, MB, GB, etc.)
     * 
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted string like "1.5 MB"
     * @private
     */
    _formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    /**
     * Logs a message using the configured logger
     * Prefixes messages with 'Organizer' component name
     * 
     * @param {string} level - Log level (info, warn, error, debug)
     * @param {string} message - Message to log
     */
    log(level, message) {
        if (this.logger) {
            this.logger.log(level, 'Organizer', message);
        }
    }

    /**
     * Reverts the last organization operation
     * Restores files to their original locations using the transaction log
     * Removes any directories created during organization
     * 
     * @returns {Promise<Object>} Rollback result with success status and details
     */
    async rollback() {
        return await this.safety.rollback();
    }
}
