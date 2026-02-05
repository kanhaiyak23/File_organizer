/**
 * SystemLogger - Structured audit trail logging
 * 
 * OS Concepts:
 * - Logs are NOT print statements - they are system artifacts
 * - Structured format enables machine processing
 * - Audit trail for debugging and observability
 * - Separation of concerns: logic vs output
 */

import fs from 'fs/promises';
import path from 'path';

export class SystemLogger {
    static Level = {
        DEBUG: 'DEBUG',
        INFO: 'INFO',
        WARN: 'WARN',
        ERROR: 'ERROR'
    };

    constructor(options = {}) {
        this.logFile = options.logFile || null;
        this.verbose = options.verbose || false;
        this.silent = options.silent || false;
        this.entries = [];
        this.startTime = new Date();
    }

    /**
     * Log a message with structured format
     * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
     * @param {string} component - Component name (e.g., Observer, RuleEngine)
     * @param {string} message - Log message
     * @param {Object} data - Optional additional data
     */
    log(level, component, message, data = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            component,
            message,
            data
        };

        this.entries.push(entry);

        // Console output (if not silent)
        if (!this.silent) {
            if (level === SystemLogger.Level.DEBUG && !this.verbose) {
                return; // Skip debug logs in non-verbose mode
            }

            const prefix = this._formatPrefix(level, component);
            const output = `${prefix} ${message}`;

            switch (level) {
                case SystemLogger.Level.ERROR:
                    console.error(output);
                    break;
                case SystemLogger.Level.WARN:
                    console.warn(output);
                    break;
                default:
                    console.log(output);
            }
        }
    }

    _formatPrefix(level, component) {
        const colors = {
            DEBUG: '\x1b[90m',   // Gray
            INFO: '\x1b[36m',    // Cyan
            WARN: '\x1b[33m',    // Yellow
            ERROR: '\x1b[31m',   // Red
            RESET: '\x1b[0m'
        };

        const levelPad = level.padEnd(5);
        const componentPad = component.padEnd(12);

        if (process.stdout.isTTY) {
            return `${colors[level]}[${levelPad}]${colors.RESET} [${componentPad}]`;
        }
        return `[${levelPad}] [${componentPad}]`;
    }

    // Convenience methods
    debug(component, message, data = null) {
        this.log(SystemLogger.Level.DEBUG, component, message, data);
    }

    info(component, message, data = null) {
        this.log(SystemLogger.Level.INFO, component, message, data);
    }

    warn(component, message, data = null) {
        this.log(SystemLogger.Level.WARN, component, message, data);
    }

    error(component, message, data = null) {
        this.log(SystemLogger.Level.ERROR, component, message, data);
    }

    /**
     * Log an operation result
     */
    logOperation(result) {
        const level = result.status === 'SUCCESS'
            ? SystemLogger.Level.INFO
            : result.status === 'SKIPPED'
                ? SystemLogger.Level.DEBUG
                : SystemLogger.Level.WARN;

        this.log(level, 'Operation', `${result.status}: ${result.file?.name || 'unknown'}`, {
            source: result.sourcePath,
            target: result.targetPath,
            rule: result.rule?.name,
            error: result.error?.message
        });
    }

    /**
     * Save logs to file
     */
    async saveToFile(filePath = null) {
        const targetPath = filePath || this.logFile;
        if (!targetPath) return;

        const logContent = {
            session: {
                startTime: this.startTime.toISOString(),
                endTime: new Date().toISOString(),
                totalEntries: this.entries.length
            },
            entries: this.entries
        };

        try {
            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            await fs.writeFile(targetPath, JSON.stringify(logContent, null, 2));
            console.log(`\nLogs saved to: ${targetPath}`);
        } catch (error) {
            console.error(`Failed to save logs: ${error.message}`);
        }
    }

    /**
     * Get summary of logged events
     */
    getSummary() {
        const summary = {
            total: this.entries.length,
            byLevel: {},
            byComponent: {}
        };

        for (const entry of this.entries) {
            summary.byLevel[entry.level] = (summary.byLevel[entry.level] || 0) + 1;
            summary.byComponent[entry.component] = (summary.byComponent[entry.component] || 0) + 1;
        }

        return summary;
    }

    /**
     * Get all entries as JSON
     */
    toJSON() {
        return {
            startTime: this.startTime.toISOString(),
            endTime: new Date().toISOString(),
            summary: this.getSummary(),
            entries: this.entries
        };
    }

    /**
     * Filter entries by level
     */
    getByLevel(level) {
        return this.entries.filter(e => e.level === level);
    }

    /**
     * Get error entries
     */
    getErrors() {
        return this.getByLevel(SystemLogger.Level.ERROR);
    }

    /**
     * Get warning entries
     */
    getWarnings() {
        return this.getByLevel(SystemLogger.Level.WARN);
    }
}
