/**
 * RuleEngine - Config-driven policy evaluation
 * 
 * OS Concepts:
 * - Separation of POLICY (what to do) from MECHANISM (how to do it)
 * - Rules are external configuration, not hardcoded logic
 * - Sequential evaluation with first-match-wins semantics
 * - Validation and conflict detection
 */

import fs from 'fs/promises';
import { RuleDefinition } from './models.js';

export class RuleEngine {
    constructor(logger = null) {
        this.rules = [];
        this.logger = logger;
    }

    /**
     * Load rules from a JSON configuration file
     * @param {string} configPath - Path to rules.json
     */
    async loadRules(configPath) {
        try {
            const content = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(content);

            if (!Array.isArray(config.rules)) {
                throw new Error('Invalid config: rules must be an array');
            }

            this.rules = [];
            let validCount = 0;
            let invalidCount = 0;

            for (const ruleConfig of config.rules) {
                const rule = new RuleDefinition(ruleConfig);

                if (rule.isValid() && rule.enabled) {
                    this.rules.push(rule);
                    validCount++;
                } else {
                    this.log('warn', `Invalid or disabled rule: ${ruleConfig.name || 'unnamed'}`);
                    invalidCount++;
                }
            }

            // Sort by priority (higher priority first)
            this.rules.sort((a, b) => b.priority - a.priority);

            this.log('info', `Loaded ${validCount} valid rules, ${invalidCount} skipped`);
            return this.rules;
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.log('warn', `Config file not found: ${configPath}, using defaults`);
                this.loadDefaultRules();
            } else {
                throw error;
            }
        }
    }

    /**
     * Load default rules if no config file exists
     */
    loadDefaultRules() {
        const defaults = [
            // Large files get special treatment
            { name: 'Large Videos', priority: 100, conditions: { extensions: ['mp4', 'mkv', 'avi', 'mov'], minSize: 100 * 1024 * 1024 }, category: 'Videos/Large' },
            { name: 'Large Archives', priority: 100, conditions: { extensions: ['zip', 'rar', '7z'], minSize: 100 * 1024 * 1024 }, category: 'Archives/Large' },

            // Standard categories
            { name: 'Documents', priority: 50, conditions: { extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'] }, category: 'Documents' },
            { name: 'Spreadsheets', priority: 50, conditions: { extensions: ['xls', 'xlsx', 'csv', 'ods'] }, category: 'Spreadsheets' },
            { name: 'Presentations', priority: 50, conditions: { extensions: ['ppt', 'pptx', 'odp'] }, category: 'Presentations' },
            { name: 'Images', priority: 50, conditions: { extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'] }, category: 'Images' },
            { name: 'Videos', priority: 40, conditions: { extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'] }, category: 'Videos' },
            { name: 'Audio', priority: 50, conditions: { extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'] }, category: 'Audio' },
            { name: 'Archives', priority: 40, conditions: { extensions: ['zip', 'rar', '7z', 'tar', 'gz'] }, category: 'Archives' },
            { name: 'Code', priority: 50, conditions: { extensions: ['js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'rb', 'php'] }, category: 'Code' },
            { name: 'Executables', priority: 60, conditions: { extensions: ['exe', 'msi', 'dmg', 'app', 'deb', 'rpm'] }, category: 'Executables' },

            // Catch-all for remaining files
            { name: 'Other', priority: 0, conditions: {}, category: 'Other' }
        ];

        this.rules = defaults.map(r => new RuleDefinition(r));
        this.log('info', `Loaded ${this.rules.length} default rules`);
    }

    /**
     * Evaluate rules against a file entry
     * Returns the first matching rule (first-match-wins)
     * 
     * @param {FileEntry} entry - File to evaluate
     * @param {Object} classification - Classification from MetadataExtractor
     * @returns {RuleDefinition|null} Matching rule or null
     */
    evaluate(entry, classification) {
        for (const rule of this.rules) {
            if (this._matchesRule(entry, classification, rule)) {
                this.log('debug', `File ${entry.name} matched rule: ${rule.name}`);
                return rule;
            }
        }
        return null;
    }

    /**
     * Check if a file matches a rule's conditions
     */
    _matchesRule(entry, classification, rule) {
        const conditions = rule.conditions;

        // Extension match
        if (conditions.extensions && conditions.extensions.length > 0) {
            if (!conditions.extensions.includes(entry.extension)) {
                return false;
            }
        }

        // Single extension match (legacy support)
        if (conditions.extension && Array.isArray(conditions.extension)) {
            if (!conditions.extension.includes(entry.extension)) {
                return false;
            }
        }

        // Size conditions
        if (conditions.minSize !== undefined && entry.size < conditions.minSize) {
            return false;
        }
        if (conditions.maxSize !== undefined && entry.size > conditions.maxSize) {
            return false;
        }

        // Size category
        if (conditions.sizeCategory && classification.metadata.size !== conditions.sizeCategory) {
            return false;
        }

        // Age category
        if (conditions.ageCategory && classification.metadata.age !== conditions.ageCategory) {
            return false;
        }

        // Type match
        if (conditions.type && classification.type !== conditions.type) {
            return false;
        }

        // Permission conditions
        if (conditions.executable !== undefined) {
            if (conditions.executable !== entry.isExecutable()) {
                return false;
            }
        }
        if (conditions.readOnly !== undefined) {
            if (conditions.readOnly !== !entry.isWritable()) {
                return false;
            }
        }

        // Hidden file condition
        if (conditions.hidden !== undefined && entry.isHidden !== conditions.hidden) {
            return false;
        }

        // Name pattern (regex)
        if (conditions.namePattern) {
            try {
                const regex = new RegExp(conditions.namePattern, 'i');
                if (!regex.test(entry.name)) {
                    return false;
                }
            } catch (e) {
                this.log('warn', `Invalid regex in rule ${rule.name}: ${conditions.namePattern}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Get the target category for a file
     */
    getCategoryFor(entry, classification) {
        const rule = this.evaluate(entry, classification);
        return rule ? rule.category : 'Other';
    }

    /**
     * Detect potential conflicts in rules
     */
    detectConflicts() {
        const conflicts = [];

        for (let i = 0; i < this.rules.length; i++) {
            for (let j = i + 1; j < this.rules.length; j++) {
                const rule1 = this.rules[i];
                const rule2 = this.rules[j];

                // Check for overlapping extensions at same priority
                if (rule1.priority === rule2.priority) {
                    const ext1 = rule1.conditions.extensions || [];
                    const ext2 = rule2.conditions.extensions || [];
                    const overlap = ext1.filter(e => ext2.includes(e));

                    if (overlap.length > 0) {
                        conflicts.push({
                            rules: [rule1.name, rule2.name],
                            type: 'extension_overlap',
                            extensions: overlap
                        });
                    }
                }
            }
        }

        return conflicts;
    }

    log(level, message) {
        if (this.logger) {
            this.logger.log(level, 'RuleEngine', message);
        }
    }
}
