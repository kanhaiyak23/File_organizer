/**
 * MetadataExtractor - Multi-layer file classification
 * 
 * OS Concepts:
 * - File metadata comes from inode, not filename
 * - Same extension can map to different categories based on metadata
 * - Permission bits determine file capabilities
 * 
 * Classification happens in LAYERS:
 * 1. Type Layer: regular, hidden, symlink, system
 * 2. Metadata Layer: size, mtime, permissions
 * 3. Extension Layer: maps to semantic categories
 */

export class MetadataExtractor {
    /**
     * Default extension mappings
     */
    static EXTENSION_CATEGORIES = {
        // Documents
        pdf: 'Documents',
        doc: 'Documents',
        docx: 'Documents',
        txt: 'Documents',
        rtf: 'Documents',
        odt: 'Documents',

        // Spreadsheets
        xls: 'Spreadsheets',
        xlsx: 'Spreadsheets',
        csv: 'Spreadsheets',
        ods: 'Spreadsheets',

        // Presentations
        ppt: 'Presentations',
        pptx: 'Presentations',
        odp: 'Presentations',

        // Images
        jpg: 'Images',
        jpeg: 'Images',
        png: 'Images',
        gif: 'Images',
        bmp: 'Images',
        svg: 'Images',
        webp: 'Images',
        ico: 'Images',

        // Videos
        mp4: 'Videos',
        mkv: 'Videos',
        avi: 'Videos',
        mov: 'Videos',
        wmv: 'Videos',
        flv: 'Videos',
        webm: 'Videos',

        // Audio
        mp3: 'Audio',
        wav: 'Audio',
        flac: 'Audio',
        aac: 'Audio',
        ogg: 'Audio',
        m4a: 'Audio',

        // Archives
        zip: 'Archives',
        rar: 'Archives',
        '7z': 'Archives',
        tar: 'Archives',
        gz: 'Archives',
        bz2: 'Archives',

        // Code
        js: 'Code',
        ts: 'Code',
        jsx: 'Code',
        tsx: 'Code',
        py: 'Code',
        java: 'Code',
        c: 'Code',
        cpp: 'Code',
        h: 'Code',
        cs: 'Code',
        go: 'Code',
        rs: 'Code',
        rb: 'Code',
        php: 'Code',
        swift: 'Code',
        kt: 'Code',

        // Web
        html: 'Web',
        css: 'Web',
        scss: 'Web',
        sass: 'Web',
        less: 'Web',

        // Data
        json: 'Data',
        xml: 'Data',
        yaml: 'Data',
        yml: 'Data',
        toml: 'Data',

        // Executables
        exe: 'Executables',
        msi: 'Executables',
        dmg: 'Executables',
        app: 'Executables',
        deb: 'Executables',
        rpm: 'Executables',

        // Disk Images
        iso: 'DiskImages',
        img: 'DiskImages',

        // Fonts
        ttf: 'Fonts',
        otf: 'Fonts',
        woff: 'Fonts',
        woff2: 'Fonts'
    };

    constructor(logger = null) {
        this.logger = logger;
    }

    /**
     * Extract classification metadata for a file entry
     * @param {FileEntry} entry - File entry to classify
     * @returns {Object} Classification result
     */
    extract(entry) {
        return {
            // Type Layer
            type: this._getTypeLayer(entry),

            // Metadata Layer
            metadata: this._getMetadataLayer(entry),

            // Extension Layer
            extensionCategory: this._getExtensionCategory(entry)
        };
    }

    /**
     * Type Layer: Classify by file type
     */
    _getTypeLayer(entry) {
        if (entry.isSymlink) return 'symlink';
        if (entry.isDirectory) return 'directory';
        if (entry.isHidden) return 'hidden';
        if (!entry.isWritable()) return 'system_restricted';
        return 'regular';
    }

    /**
     * Metadata Layer: Classify by file metadata
     */
    _getMetadataLayer(entry) {
        return {
            size: entry.getSizeCategory(),
            age: entry.getAgeCategory(),
            permissions: {
                readable: entry.isReadable(),
                writable: entry.isWritable(),
                executable: entry.isExecutable()
            }
        };
    }

    /**
     * Extension Layer: Map extension to category
     */
    _getExtensionCategory(entry) {
        if (!entry.extension) return 'Other';
        return MetadataExtractor.EXTENSION_CATEGORIES[entry.extension] || 'Other';
    }

    /**
     * Build a detailed classification for all entries
     */
    classifyAll(entries) {
        return entries.map(entry => ({
            entry,
            classification: this.extract(entry)
        }));
    }

    /**
     * Group entries by their extension category
     */
    groupByCategory(entries) {
        const groups = {};

        for (const entry of entries) {
            const category = this._getExtensionCategory(entry);
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(entry);
        }

        return groups;
    }

    log(level, message) {
        if (this.logger) {
            this.logger.log(level, 'Metadata', message);
        }
    }
}
