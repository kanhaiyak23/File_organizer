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
    /**
     * Log level constants for categorizing messages
     * Used for filtering and formatting output
     */
    static Level = {
        DEBUG: 'DEBUG',  // Detailed debugging information
        INFO: 'INFO',    // General operational information
        WARN: 'WARN',    // Warning conditions
        ERROR: 'ERROR'   // Error conditions
    };

    /**
     * Creates a new SystemLogger instance
     * Configures output behavior and initializes entry storage
     * 
     * @param {Object} options - Logger configuration
     * @param {string} options.logFile - Path to save logs (optional)
     * @param {boolean} options.verbose - Show DEBUG level messages (default: false)
     * @param {boolean} options.silent - Suppress all console output (default: false)
     */
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

    /**
     * Formats the log prefix with level and component
     * Applies ANSI color codes when running in TTY mode
     * 
     * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
     * @param {string} component - Component name (Observer, RuleEngine, etc.)
     * @returns {string} Formatted prefix string
     * @private
     */
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

    // ==========================================
    // Convenience methods for each log level
    // ==========================================

    /**
     * Logs a DEBUG level message (only shown in verbose mode)
     */
    debug(component, message, data = null) {
        this.log(SystemLogger.Level.DEBUG, component, message, data);
    }

    /**
     * Logs an INFO level message for general operational information
     */
    info(component, message, data = null) {
        this.log(SystemLogger.Level.INFO, component, message, data);
    }

    /**
     * Logs a WARN level message for potential issues
     */
    warn(component, message, data = null) {
        this.log(SystemLogger.Level.WARN, component, message, data);
    }

    /**
     * Logs an ERROR level message for failure conditions
     */
    error(component, message, data = null) {
        this.log(SystemLogger.Level.ERROR, component, message, data);
    }

    /**
     * Logs a file operation result with appropriate level
     * SUCCESS → INFO, SKIPPED → DEBUG, others → WARN
     * Includes source/target paths and rule information
     * 
     * @param {OperationResult} result - Operation result to log
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
     * Persists all log entries to a JSON file
     * Creates parent directories if they don't exist
     * Includes session metadata (start/end time, entry count)
     * 
     * @param {string} filePath - Path to save logs (uses this.logFile if null)
     * @returns {Promise<void>}
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
     * Generates a summary of all logged events
     * Groups entries by log level and component name
     * 
     * @returns {Object} Summary with total count and breakdowns by level/component
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
     * Exports all log data as JSON for API responses
     * Includes timing, summary statistics, and all entries
     * 
     * @returns {Object} Complete log data in JSON format
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
     * Filters log entries by level
     * 
     * @param {string} level - Log level to filter by (DEBUG, INFO, WARN, ERROR)
     * @returns {Object[]} Array of entries matching the specified level
     */
    getByLevel(level) {
        return this.entries.filter(e => e.level === level);
    }

    /**
     * Returns all ERROR level entries
     * Useful for quickly checking if any errors occurred
     * 
     * @returns {Object[]} Array of error entries
     */
    getErrors() {
        return this.getByLevel(SystemLogger.Level.ERROR);
    }

    /**
     * Returns all WARN level entries
     * Useful for reviewing potential issues
     * 
     * @returns {Object[]} Array of warning entries
     */
    getWarnings() {
        return this.getByLevel(SystemLogger.Level.WARN);
    }
}
