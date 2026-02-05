#!/usr/bin/env node

/**
 * CLI Entry Point for File Organizer System
 * 
 * Usage:
 *   node src/cli/index.js --target ~/Downloads
 *   node src/cli/index.js --target ~/Downloads --dry-run
 *   node src/cli/index.js --target ~/Downloads --parallel --verbose
 */

import { Command } from 'commander';
import path from 'path';
import { fileURLToPath } from 'url';
import { FileOrganizer } from '../core/organizer.js';
import { SystemLogger } from '../core/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
    .name('file-organizer')
    .description('User-space file system manager - organizes files based on metadata and rules')
    .version('1.0.0');

program
    .requiredOption('-t, --target <directory>', 'Target directory to organize')
    .option('-d, --dry-run', 'Preview operations without making changes', false)
    .option('-p, --parallel', 'Use parallel execution (multiple workers)', false)
    .option('-v, --verbose', 'Enable verbose logging', false)
    .option('-s, --silent', 'Suppress all console output', false)
    .option('-c, --config <path>', 'Path to custom rules configuration')
    .option('-l, --log-file <path>', 'Save logs to specified file')
    .option('--no-color', 'Disable colored output')
    .option('--rollback', 'Rollback the last organization operation')
    .option('--analyze-only', 'Only analyze directory without organizing');

program.parse();

const options = program.opts();

async function main() {
    // Initialize logger
    const logger = new SystemLogger({
        verbose: options.verbose,
        silent: options.silent,
        logFile: options.logFile
    });

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         FILE ORGANIZER SYSTEM - User-Space Manager            ║
║                                                               ║
║  OS Concepts: inodes, metadata, processes, synchronization    ║
╚═══════════════════════════════════════════════════════════════╝
`);

    try {
        // Resolve target directory
        const targetDir = path.resolve(options.target);

        logger.info('CLI', `Target directory: ${targetDir}`);
        logger.info('CLI', `Mode: ${options.dryRun ? 'DRY RUN' : 'EXECUTE'}`);
        logger.info('CLI', `Execution: ${options.parallel ? 'PARALLEL' : 'SEQUENTIAL'}`);

        // Determine config path
        const configPath = options.config || path.join(__dirname, '../../config/rules.json');

        // Initialize organizer
        const organizer = new FileOrganizer({
            logger,
            dryRun: options.dryRun,
            parallel: options.parallel,
            configPath
        });

        await organizer.initialize();

        // Handle analyze-only mode
        if (options.analyzeOnly) {
            logger.info('CLI', 'Analyze-only mode - scanning directory...');
            const entries = await organizer.observer.scan(targetDir);
            const stats = organizer.observer.getStatistics(entries);

            console.log('\n📊 Directory Analysis:');
            console.log(`   Total files: ${stats.totalFiles}`);
            console.log(`   Total size: ${formatBytes(stats.totalSize)}`);
            console.log('\n   By Extension:');
            for (const [ext, count] of Object.entries(stats.byExtension).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
                console.log(`     .${ext}: ${count} files`);
            }
            console.log('\n   By Size:');
            for (const [category, count] of Object.entries(stats.bySize)) {
                console.log(`     ${category}: ${count} files`);
            }
            console.log('\n   By Age:');
            for (const [category, count] of Object.entries(stats.byAge)) {
                if (count > 0) console.log(`     ${category}: ${count} files`);
            }

            return;
        }

        // Run organization
        const summary = await organizer.organize(targetDir);

        // Output summary
        console.log('\n📁 Organization Summary:');
        console.log(`   Execution Mode: ${summary.executionMode}`);
        console.log(`   Duration: ${summary.duration}ms`);
        console.log(`   Total Files: ${summary.totalFiles}`);
        console.log(`   ✓ Success: ${summary.success}`);
        console.log(`   ⊘ Skipped: ${summary.skipped}`);
        console.log(`   ✗ Errors: ${summary.errors}`);
        console.log(`   🔒 Permission Denied: ${summary.permissionDenied}`);

        // Save logs if requested
        if (options.logFile) {
            await logger.saveToFile(options.logFile);
        }

        // Output structured JSON for machine processing
        if (options.silent) {
            console.log(JSON.stringify(summary.toJSON(), null, 2));
        }

    } catch (error) {
        logger.error('CLI', `Fatal error: ${error.message}`);
        if (options.verbose) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

main();
