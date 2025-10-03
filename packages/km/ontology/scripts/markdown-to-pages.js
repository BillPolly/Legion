#!/usr/bin/env node
/**
 * Markdown to Mac Pages Converter
 *
 * Converts markdown documents to Mac Pages format via DOCX intermediate format.
 *
 * Usage:
 *   node scripts/markdown-to-pages.js <input.md> [options]
 *
 * Options:
 *   --output, -o <file>    Output file path (default: input name with .docx extension)
 *   --auto-open            Automatically open in Pages after conversion
 *   --convert-to-pages     Convert DOCX to .pages format using AppleScript
 *   --keep-docx            Keep intermediate DOCX file (when converting to .pages)
 *   --help, -h             Show this help message
 *
 * Examples:
 *   # Convert to DOCX only
 *   node scripts/markdown-to-pages.js report.md
 *
 *   # Convert to DOCX and open in Pages
 *   node scripts/markdown-to-pages.js report.md --auto-open
 *
 *   # Convert to .pages format
 *   node scripts/markdown-to-pages.js report.md --convert-to-pages
 *
 *   # Custom output path
 *   node scripts/markdown-to-pages.js report.md -o output/my-report.docx
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDocx from 'remark-docx';
import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname, basename, extname, join } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse command-line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Markdown to Mac Pages Converter

Usage:
  node scripts/markdown-to-pages.js <input.md> [options]

Options:
  --output, -o <file>    Output file path (default: input name with .docx extension)
  --auto-open            Automatically open in Pages after conversion
  --convert-to-pages     Convert DOCX to .pages format using AppleScript
  --keep-docx            Keep intermediate DOCX file (when converting to .pages)
  --help, -h             Show this help message

Examples:
  # Convert to DOCX only
  node scripts/markdown-to-pages.js report.md

  # Convert to DOCX and open in Pages
  node scripts/markdown-to-pages.js report.md --auto-open

  # Convert to .pages format
  node scripts/markdown-to-pages.js report.md --convert-to-pages

  # Custom output path
  node scripts/markdown-to-pages.js report.md -o output/my-report.docx
`);
    process.exit(0);
  }

  const options = {
    input: null,
    output: null,
    autoOpen: false,
    convertToPages: false,
    keepDocx: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--auto-open') {
      options.autoOpen = true;
    } else if (arg === '--convert-to-pages') {
      options.convertToPages = true;
    } else if (arg === '--keep-docx') {
      options.keepDocx = true;
    } else if (!arg.startsWith('--')) {
      options.input = arg;
    }
  }

  if (!options.input) {
    console.error('❌ Error: Input markdown file is required');
    process.exit(1);
  }

  return options;
}

/**
 * Convert markdown to DOCX using remark-docx
 */
async function markdownToDocx(markdownPath, outputPath) {
  console.log(`\n📄 Reading markdown file: ${markdownPath}`);

  // Read markdown file
  const markdown = await readFile(markdownPath, 'utf-8');
  console.log(`✅ Read ${markdown.length} characters`);

  console.log(`\n🔄 Converting markdown to DOCX...`);

  // Process with unified/remark
  const processor = unified()
    .use(remarkParse)
    .use(remarkDocx, { output: 'buffer' });

  const result = await processor.process(markdown);
  const docxBuffer = result.result;

  console.log(`✅ Generated DOCX buffer (${docxBuffer.length} bytes)`);

  // Write DOCX file
  console.log(`\n💾 Writing DOCX file: ${outputPath}`);
  await writeFile(outputPath, docxBuffer);
  console.log(`✅ DOCX file created successfully`);

  return outputPath;
}

/**
 * Open file in Mac Pages
 */
function openInPages(filePath) {
  console.log(`\n📖 Opening in Pages: ${filePath}`);
  try {
    execSync(`open -a Pages "${filePath}"`, { stdio: 'inherit' });
    console.log(`✅ Opened in Pages`);
  } catch (error) {
    console.error(`❌ Failed to open in Pages: ${error.message}`);
    throw error;
  }
}

/**
 * Convert DOCX to Pages format using AppleScript
 */
async function convertDocxToPages(docxPath, pagesPath, keepDocx = false) {
  console.log(`\n🔄 Converting DOCX to Pages format...`);

  const appleScriptPath = join(__dirname, 'lib', 'convert-to-pages.applescript');

  try {
    // Run AppleScript to convert
    const script = `
tell application "Pages"
  activate
  set theDoc to open POSIX file "${resolve(docxPath)}"
  delay 2
  export theDoc to POSIX file "${resolve(pagesPath)}" as Pages
  close theDoc saving no
end tell
`;

    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { stdio: 'inherit' });

    console.log(`✅ Converted to Pages format: ${pagesPath}`);

    // Delete intermediate DOCX if requested
    if (!keepDocx) {
      const { unlink } = await import('fs/promises');
      await unlink(docxPath);
      console.log(`🗑️  Removed intermediate DOCX file`);
    }

    return pagesPath;
  } catch (error) {
    console.error(`❌ Failed to convert to Pages format: ${error.message}`);
    console.error(`   Make sure Pages is installed and you have permission to control it`);
    throw error;
  }
}

/**
 * Main conversion function
 */
async function convert() {
  const options = parseArgs();

  console.log('\n🚀 MARKDOWN TO PAGES CONVERTER\n');
  console.log('='.repeat(70));

  try {
    // Resolve input path
    const inputPath = resolve(options.input);

    // Determine output path
    let outputPath;
    if (options.output) {
      outputPath = resolve(options.output);
    } else {
      const inputBase = basename(inputPath, extname(inputPath));
      const inputDir = dirname(inputPath);
      outputPath = join(inputDir, `${inputBase}.docx`);
    }

    console.log(`\n📋 Configuration:`);
    console.log(`   Input:  ${inputPath}`);
    console.log(`   Output: ${outputPath}`);
    console.log(`   Auto-open: ${options.autoOpen}`);
    console.log(`   Convert to Pages: ${options.convertToPages}`);
    console.log(`   Keep DOCX: ${options.keepDocx}`);

    // Step 1: Convert markdown to DOCX
    const docxPath = await markdownToDocx(inputPath, outputPath);

    // Step 2: Convert to Pages format if requested
    if (options.convertToPages) {
      const pagesPath = docxPath.replace(/\.docx$/, '.pages');
      await convertDocxToPages(docxPath, pagesPath, options.keepDocx);
      outputPath = pagesPath;
    }

    // Step 3: Open in Pages if requested
    if (options.autoOpen) {
      openInPages(outputPath);
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n✨ SUCCESS!`);
    console.log(`\n📄 Output file: ${outputPath}\n`);

    // Show file size
    const { stat } = await import('fs/promises');
    const stats = await stat(outputPath);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB\n`);

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error(`\n❌ CONVERSION FAILED\n`);
    console.error(`Error: ${error.message}`);
    console.error(`\n${error.stack}\n`);
    process.exit(1);
  }
}

// Run converter
convert();
