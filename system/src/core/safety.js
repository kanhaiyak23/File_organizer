/**
 * SafetyManager - Synchronization and rollback support
 * 
 * OS Concepts:
 * - File systems are SHARED RESOURCES
 * - Concurrent access requires synchronization
 * - Operations must be atomic or rollback-capable
 * - Pre-verification before destructive operations
 */

import fs from 'fs/promises';
import path from 'path';

export class SafetyManager {
    constructor(logger = null) {
        this.logger = logger;
        this.locks = new Map();         // Active directory locks
        this.transactionLog = [];       // Operations for rollback
        this.isLocked = false;
    }

    /**
     * Acquire a lock on a directory
     * Uses a lock file approach (similar to package-lock.json concept)
     * 
     * @param {string} dirPath - Directory to lock
     * @returns {Promise<boolean>} Whether lock was acquired
     */
    async acquireLock(dirPath) {
        const lockFile = path.join(dirPath, '.organizer.lock');

        try {
            // Check if lock file exists
            try {
                const stat = await fs.stat(lockFile);
                const lockAge = Date.now() - stat.mtime.getTime();

                // Stale lock detection (> 5 minutes old)
                if (lockAge > 5 * 60 * 1000) {
                    this.log('warn', `Removing stale lock file: ${lockFile}`);
                    await fs.unlink(lockFile);
                } else {
                    this.log('error', `Directory is locked by another process: ${dirPath}`);
                    return false;
                }
            } catch (e) {
                // Lock file doesn't exist - good
            }

            // Create lock file with our PID
            const lockInfo = {
                pid: process.pid,
                timestamp: new Date().toISOString(),
                hostname: process.env.HOSTNAME || 'unknown'
            };

            await fs.writeFile(lockFile, JSON.stringify(lockInfo, null, 2));
            this.locks.set(dirPath, lockFile);
            this.isLocked = true;

            this.log('info', `Acquired lock on: ${dirPath}`);
            return true;
        } catch (error) {
            this.log('error', `Failed to acquire lock: ${error.message}`);
            return false;
        }
    }

    /**
     * Release a directory lock
     */
    async releaseLock(dirPath) {
        const lockFile = this.locks.get(dirPath);

        if (lockFile) {
            try {
                await fs.unlink(lockFile);
                this.locks.delete(dirPath);
                this.log('info', `Released lock on: ${dirPath}`);
            } catch (error) {
                this.log('warn', `Failed to release lock: ${error.message}`);
            }
        }

        if (this.locks.size === 0) {
            this.isLocked = false;
        }
    }

    /**
     * Release all locks (cleanup)
     */
    async releaseAllLocks() {
        for (const dirPath of this.locks.keys()) {
            await this.releaseLock(dirPath);
        }
    }

    /**
     * Verify a file still exists before operating on it
     * Critical for handling concurrent modifications
     */
    async verifyFileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Verify file hasn't changed since we scanned it
     * Compares inode number to detect if file was replaced
     */
    async verifyFileUnchanged(filePath, originalIno) {
        try {
            const stat = await fs.stat(filePath);
            return stat.ino === originalIno;
        } catch {
            return false;
        }
    }

    /**
     * Record an operation for potential rollback
     */
    recordOperation(operation) {
        this.transactionLog.push({
            ...operation,
            timestamp: new Date().toISOString(),
            rolled_back: false
        });
    }

    /**
     * Rollback all recorded operations
     * Moves files back to their original locations
     */
    async rollback() {
        this.log('warn', 'Starting rollback of operations...');
        const errors = [];

        // Process in reverse order
        const operations = [...this.transactionLog].reverse();

        for (const op of operations) {
            if (op.rolled_back || op.type !== 'move') {
                continue;
            }

            try {
                // Check if source still exists at target location
                if (await this.verifyFileExists(op.targetPath)) {
                    await fs.rename(op.targetPath, op.sourcePath);
                    op.rolled_back = true;
                    this.log('info', `Rolled back: ${op.targetPath} -> ${op.sourcePath}`);
                }
            } catch (error) {
                errors.push({
                    operation: op,
                    error: error.message
                });
                this.log('error', `Rollback failed for ${op.targetPath}: ${error.message}`);
            }
        }

        // Clean up empty directories created during organization
        for (const op of operations) {
            if (op.createdDir) {
                try {
                    const files = await fs.readdir(op.createdDir);
                    if (files.length === 0) {
                        await fs.rmdir(op.createdDir);
                        this.log('info', `Removed empty directory: ${op.createdDir}`);
                    }
                } catch (e) {
                    // Directory not empty or already removed
                }
            }
        }

        return { success: errors.length === 0, errors };
    }

    /**
     * Clear the transaction log (call after successful completion)
     */
    clearTransactionLog() {
        this.transactionLog = [];
    }

    /**
     * Get a safe move operation with pre-checks
     */
    async prepareSafeMove(sourcePath, targetPath, originalIno) {
        const checks = {
            sourceExists: await this.verifyFileExists(sourcePath),
            sourceUnchanged: await this.verifyFileUnchanged(sourcePath, originalIno),
            targetConflict: await this.verifyFileExists(targetPath),
            targetDir: path.dirname(targetPath)
        };

        return {
            canProceed: checks.sourceExists && checks.sourceUnchanged && !checks.targetConflict,
            checks,
            reason: !checks.sourceExists ? 'Source file no longer exists' :
                !checks.sourceUnchanged ? 'Source file was modified' :
                    checks.targetConflict ? 'Target file already exists' : null
        };
    }

    log(level, message) {
        if (this.logger) {
            this.logger.log(level, 'Safety', message);
        }
    }
}
