/**
 * FileSystemObserver - Read-only file system analysis
 * 
 * OS Concepts:
 * - Files are inode references, not just names
 * - Directories are data structures containing entries
 * - stat() system calls to retrieve metadata
 * 
 * This module performs OBSERVATION ONLY - no modifications
 */

import fs from 'fs/promises';
import path from 'path';
import { FileEntry } from './models.js';

export class FileSystemObserver {
    /**
     * Creates a new FileSystemObserver instance
     * Performs read-only file system analysis without modifying any files
     * 
     * @param {Object|null} logger - Optional logger instance for structured logging
     */
    constructor(logger = null) {
        this.logger = logger;
    }

    /**
     * Scan a directory and return all file entries with metadata
     * @param {string} targetPath - Directory to scan
     * @param {Object} options - Scan options
     * @returns {Promise<FileEntry[]>} Array of file entries
     */
    async scan(targetPath, options = {}) {
        const {
            recursive = true,
            includeHidden = true,
            includeDirectories = false
        } = options;

        const absolutePath = path.resolve(targetPath);

        // Verify target exists and is a directory
        try {
            const stat = await fs.stat(absolutePath);
            if (!stat.isDirectory()) {
                throw new Error(`Target path is not a directory: ${absolutePath}`);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Directory does not exist: ${absolutePath}`);
            }
            throw error;
        }

        this.log('info', `Starting scan of: ${absolutePath}`);
        const entries = await this._scanDirectory(absolutePath, {
            recursive,
            includeHidden,
            includeDirectories
        });

        this.log('info', `Scan complete. Found ${entries.length} entries`);
        return entries;
    }

    /**
     * Internal recursive directory scanner
     * Traverses directory tree, extracts metadata using lstat, and builds FileEntry objects
     * Handles symlinks properly and gracefully manages permission errors
     * 
     * @param {string} dirPath - Directory path to scan
     * @param {Object} options - Scan options (recursive, includeHidden, includeDirectories)
     * @returns {Promise<FileEntry[]>} Array of file entries with full metadata
     * @private
     */
    async _scanDirectory(dirPath, options) {
        const entries = [];

        try {
            const items = await fs.readdir(dirPath, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);
                const isHidden = item.name.startsWith('.');

                // Skip hidden files if not included
                if (isHidden && !options.includeHidden) {
                    continue;
                }

                try {
                    // Use lstat to handle symlinks properly
                    const stat = await fs.lstat(fullPath);

                    const entry = new FileEntry({
                        path: fullPath,
                        name: item.name,
                        isDirectory: stat.isDirectory(),
                        isHidden,
                        isSymlink: stat.isSymbolicLink(),
                        size: stat.size,
                        mode: stat.mode,
                        mtime: stat.mtime,
                        atime: stat.atime,
                        ctime: stat.ctime,
                        uid: stat.uid,
                        gid: stat.gid,
                        extension: path.extname(item.name).toLowerCase().slice(1),
                        ino: stat.ino // Store inode number
                    });

                    // Add files (and directories if requested)
                    if (!entry.isDirectory) {
                        entries.push(entry);
                    } else if (options.includeDirectories) {
                        entries.push(entry);
                    }

                    // Recurse into directories
                    if (entry.isDirectory && options.recursive && !entry.isSymlink) {
                        const subEntries = await this._scanDirectory(fullPath, options);
                        entries.push(...subEntries);
                    }
                } catch (error) {
                    // Handle permission denied gracefully
                    if (error.code === 'EACCES') {
                        this.log('warn', `Permission denied: ${fullPath}`);
                    } else {
                        this.log('error', `Error reading ${fullPath}: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            if (error.code === 'EACCES') {
                this.log('warn', `Permission denied for directory: ${dirPath}`);
            } else {
                throw error;
            }
        }

        return entries;
    }

    /**
     * Computes aggregate statistics about the observed files
     * Groups files by extension, type, size category, age, and permissions
     * 
     * @param {FileEntry[]} entries - Array of file entries to analyze
     * @returns {Object} Statistics object with counts by various categories
     */
    getStatistics(entries) {
        const stats = {
            totalFiles: entries.length,
            totalSize: 0,
            byExtension: {},
            byType: {
                regular: 0,
                hidden: 0,
                symlink: 0
            },
            bySize: {
                small: 0,
                medium: 0,
                large: 0,
                huge: 0
            },
            byAge: {
                today: 0,
                recent: 0,
                this_month: 0,
                this_year: 0,
                old: 0,
                unknown: 0
            },
            byPermission: {
                readOnly: 0,
                executable: 0,
                normal: 0
            }
        };

        for (const entry of entries) {
            stats.totalSize += entry.size;

            // By extension
            const ext = entry.extension || 'no_extension';
            stats.byExtension[ext] = (stats.byExtension[ext] || 0) + 1;

            // By type
            if (entry.isSymlink) stats.byType.symlink++;
            else if (entry.isHidden) stats.byType.hidden++;
            else stats.byType.regular++;

            // By size
            stats.bySize[entry.getSizeCategory()]++;

            // By age
            stats.byAge[entry.getAgeCategory()]++;

            // By permission
            if (!entry.isWritable()) stats.byPermission.readOnly++;
            else if (entry.isExecutable()) stats.byPermission.executable++;
            else stats.byPermission.normal++;
        }

        return stats;
    }

    /**
     * Logs a message using the configured logger
     * Prefixes messages with 'Observer' component name
     * 
     * @param {string} level - Log level (info, warn, error, debug)
     * @param {string} message - Message to log
     */
    log(level, message) {
        if (this.logger) {
            this.logger.log(level, 'Observer', message);
        }
    }
}
