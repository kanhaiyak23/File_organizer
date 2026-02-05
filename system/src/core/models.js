/**
 * Data Models for File Organizer System
 * Represents files as inode references with metadata - core OS concept
 */

/**
 * Represents a file entry with full metadata
 * @typedef {Object} FileEntry
 */
export class FileEntry {
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
     * Check if file is readable based on mode
     */
    isReadable() {
        return (this.mode & 0o444) !== 0;
    }

    /**
     * Check if file is writable based on mode
     */
    isWritable() {
        return (this.mode & 0o222) !== 0;
    }

    /**
     * Check if file is executable
     */
    isExecutable() {
        return (this.mode & 0o111) !== 0;
    }

    /**
     * Get size category
     */
    getSizeCategory() {
        if (this.size < 1024 * 100) return 'small';        // < 100KB
        if (this.size < 1024 * 1024 * 10) return 'medium'; // < 10MB
        if (this.size < 1024 * 1024 * 100) return 'large'; // < 100MB
        return 'huge';                                      // >= 100MB
    }

    /**
     * Get age category based on mtime
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
 */
export class RuleDefinition {
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
     * Validate rule structure
     */
    isValid() {
        if (!this.name || typeof this.name !== 'string') return false;
        if (!this.category || typeof this.category !== 'string') return false;
        if (typeof this.conditions !== 'object') return false;
        return true;
    }
}

/**
 * Result of a single organization operation
 */
export class OperationResult {
    static Status = {
        SUCCESS: 'SUCCESS',
        SKIPPED: 'SKIPPED',
        PERMISSION_DENIED: 'PERMISSION_DENIED',
        FILE_NOT_FOUND: 'FILE_NOT_FOUND',
        CONFLICT: 'CONFLICT',
        ERROR: 'ERROR'
    };

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
 * Summary of an organization run
 */
export class OrganizeSummary {
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

    complete() {
        this.endTime = new Date();
    }

    get duration() {
        if (!this.endTime) return null;
        return this.endTime.getTime() - this.startTime.getTime();
    }

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
