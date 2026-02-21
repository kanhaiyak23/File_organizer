/**
 * Data Models for File Organizer System
 * Represents files as inode references with metadata - core OS concept
 */

/**
 * Represents a file entry with full metadata
 * Stores inode reference and all stat information from the filesystem
 * Core data structure representing a file or directory
 */
export class FileEntry {
    /**
     * Creates a new FileEntry with all metadata properties
     * 
     * @param {Object} props - File properties
     * @param {string} props.path - Absolute path to the file
     * @param {string} props.name - File name with extension
     * @param {boolean} props.isDirectory - True if this is a directory
     * @param {boolean} props.isHidden - True if file name starts with dot
     * @param {boolean} props.isSymlink - True if this is a symbolic link
     * @param {number} props.size - File size in bytes
     * @param {number} props.mode - Unix permission mode bits
     * @param {Date} props.mtime - Last modification time
     * @param {Date} props.atime - Last access time
     * @param {Date} props.ctime - Creation/change time
     * @param {number} props.uid - Owner user ID
     * @param {number} props.gid - Owner group ID
     * @param {string} props.extension - File extension without dot
     * @param {number} props.ino - Inode number (direct OS reference)
     */
    constructor({
        path,
        name,
        isDirectory = false,
        isHidden = false,
        isSymlink = false,
        size = 0,
        mode = 0,
        mtime = null,
        atime = null,
        ctime = null,
        uid = 0,
        gid = 0,
        extension = '',
        ino = 0 // inode number - direct OS reference
    }) {
        this.path = path;
        this.name = name;
        this.isDirectory = isDirectory;
        this.isHidden = isHidden;
        this.isSymlink = isSymlink;
        this.size = size;
        this.mode = mode;
        this.mtime = mtime;
        this.atime = atime;
        this.ctime = ctime;
        this.uid = uid;
        this.gid = gid;
        this.extension = extension;
        this.ino = ino;
    }

    /**
     * Checks if file has any read permission bits set
     * Uses bitwise AND with octal 444 (r--r--r--)
     * 
     * @returns {boolean} True if file is readable by owner, group, or others
     */
    isReadable() {
        return (this.mode & 0o444) !== 0;
    }

    /**
     * Checks if file has any write permission bits set
     * Uses bitwise AND with octal 222 (-w--w--w-)
     * 
     * @returns {boolean} True if file is writable by owner, group, or others
     */
    isWritable() {
        return (this.mode & 0o222) !== 0;
    }

    /**
     * Checks if file has any execute permission bits set
     * Uses bitwise AND with octal 111 (--x--x--x)
     * 
     * @returns {boolean} True if file is executable by owner, group, or others
     */
    isExecutable() {
        return (this.mode & 0o111) !== 0;
    }

    /**
     * Categorizes file by size into small/medium/large/huge buckets
     * Used for statistics and rule matching
     * 
     * @returns {string} Size category: 'small' (<100KB), 'medium' (<10MB), 'large' (<100MB), 'huge' (>=100MB)
     */
    getSizeCategory() {
        if (this.size < 1024 * 100) return 'small';        // < 100KB
        if (this.size < 1024 * 1024 * 10) return 'medium'; // < 10MB
        if (this.size < 1024 * 1024 * 100) return 'large'; // < 100MB
        return 'huge';                                      // >= 100MB
    }

    /**
     * Categorizes file by age based on last modification time
     * Calculates days since last modification
     * 
     * @returns {string} Age category: 'today', 'recent' (<7 days), 'this_month' (<30 days), 'this_year' (<365 days), 'old', or 'unknown'
     */
    getAgeCategory() {
        if (!this.mtime) return 'unknown';
        const now = Date.now();
        const age = now - this.mtime.getTime();
        const days = age / (1000 * 60 * 60 * 24);

        if (days < 1) return 'today';
        if (days < 7) return 'recent';
        if (days < 30) return 'this_month';
        if (days < 365) return 'this_year';
        return 'old';
    }
}

/**
 * Rule definition for file organization
 * Defines conditions for matching files and target category for organization
 */
export class RuleDefinition {
    /**
     * Creates a new organization rule
     * 
     * @param {Object} props - Rule properties
     * @param {string} props.name - Unique rule identifier
     * @param {number} props.priority - Higher priority rules are evaluated first (default: 0)
     * @param {Object} props.conditions - Matching conditions (extensions, patterns, size, etc.)
     * @param {string} props.category - Target folder/category for matching files
     * @param {boolean} props.enabled - Whether rule is active (default: true)
     */
    constructor({
        name,
        priority = 0,
        conditions = {},
        category,
        enabled = true
    }) {
        this.name = name;
        this.priority = priority;
        this.conditions = conditions;
        this.category = category;
        this.enabled = enabled;
    }

    /**
     * Validates that rule has required properties and correct types
     * Checks for name, category, and conditions object
     * 
     * @returns {boolean} True if rule structure is valid
     */
    isValid() {
        if (!this.name || typeof this.name !== 'string') return false;
        if (!this.category || typeof this.category !== 'string') return false;
        if (typeof this.conditions !== 'object') return false;
        return true;
    }
}

/**
 * Result of a single file organization operation
 * Captures outcome (success/failure), paths, and any errors
 */
export class OperationResult {
    /**
     * Possible operation status values
     * Used for aggregating statistics and error handling
     */
    static Status = {
        SUCCESS: 'SUCCESS',           // File moved successfully
        SKIPPED: 'SKIPPED',           // File already in correct location or no matching rule
        PERMISSION_DENIED: 'PERMISSION_DENIED', // Insufficient permissions
        FILE_NOT_FOUND: 'FILE_NOT_FOUND',       // Source file no longer exists
        CONFLICT: 'CONFLICT',         // Target file already exists
        ERROR: 'ERROR'                // Other error occurred
    };

    /**
     * Creates a new operation result
     * 
     * @param {Object} props - Result properties
     * @param {FileEntry} props.file - The file that was operated on
     * @param {string} props.status - Operation outcome (see Status enum)
     * @param {string} props.sourcePath - Original file location
     * @param {string} props.targetPath - Destination path (null if skipped)
     * @param {RuleDefinition} props.rule - Rule that matched this file
     * @param {Error} props.error - Error object if operation failed
     * @param {Date} props.timestamp - When operation was executed
     */
    constructor({
        file,
        status,
        sourcePath,
        targetPath = null,
        rule = null,
        error = null,
        timestamp = new Date()
    }) {
        this.file = file;
        this.status = status;
        this.sourcePath = sourcePath;
        this.targetPath = targetPath;
        this.rule = rule;
        this.error = error;
        this.timestamp = timestamp;
    }
}

/**
 * Summary of a complete organization run
 * Aggregates statistics across all operations for reporting
 */
export class OrganizeSummary {
    /**
     * Creates a new summary, initializing counters and starting the timer
     * Tracks success/failure counts and stores all operation results
     */
    constructor() {
        this.startTime = new Date();
        this.endTime = null;
        this.totalFiles = 0;
        this.processed = 0;
        this.success = 0;
        this.skipped = 0;
        this.errors = 0;
        this.permissionDenied = 0;
        this.operations = [];
        this.executionMode = 'sequential';
    }

    /**
     * Marks the organization run as complete
     * Records end time for duration calculation
     */
    complete() {
        this.endTime = new Date();
    }

    /**
     * Calculates total duration of the organization run in milliseconds
     * Returns null if organization is still in progress
     * 
     * @returns {number|null} Duration in milliseconds
     */
    get duration() {
        if (!this.endTime) return null;
        return this.endTime.getTime() - this.startTime.getTime();
    }

    /**
     * Adds an operation result and updates the appropriate counter
     * Categorizes result by status and increments the matching count
     * 
     * @param {OperationResult} operation - Result to add to summary
     */
    addOperation(operation) {
        this.operations.push(operation);
        this.processed++;

        switch (operation.status) {
            case OperationResult.Status.SUCCESS:
                this.success++;
                break;
            case OperationResult.Status.SKIPPED:
                this.skipped++;
                break;
            case OperationResult.Status.PERMISSION_DENIED:
                this.permissionDenied++;
                break;
            case OperationResult.Status.ERROR:
            case OperationResult.Status.FILE_NOT_FOUND:
            case OperationResult.Status.CONFLICT:
                this.errors++;
                break;
        }
    }

    /**
     * Converts summary to JSON format for API responses and logging
     * Includes timing, statistics, and all operation details
     * 
     * @returns {Object} JSON-serializable summary object
     */
    toJSON() {
        return {
            startTime: this.startTime.toISOString(),
            endTime: this.endTime?.toISOString(),
            durationMs: this.duration,
            executionMode: this.executionMode,
            statistics: {
                totalFiles: this.totalFiles,
                processed: this.processed,
                success: this.success,
                skipped: this.skipped,
                errors: this.errors,
                permissionDenied: this.permissionDenied
            },
            operations: this.operations.map(op => ({
                file: op.file?.name,
                status: op.status,
                source: op.sourcePath,
                target: op.targetPath,
                rule: op.rule?.name,
                error: op.error?.message,
                timestamp: op.timestamp.toISOString()
            }))
        };
    }
}
