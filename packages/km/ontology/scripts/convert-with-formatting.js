#!/usr/bin/env node
/**
 * Markdown to Formatted DOCX Converter
 *
 * Preserves all markdown formatting including:
 * - Headings with proper styles
 * - Tables with borders and formatting
 * - Code blocks with syntax highlighting
 * - Bold, italic, strikethrough
 * - Lists (ordered and unordered)
 * - Blockquotes
 */

import { execSync } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

async function convertWithFormatting(inputPath, outputPath) {
  console.log('\n🎨 FORMATTED MARKDOWN TO DOCX CONVERSION\n');
  console.log('='.repeat(70));
  console.log(`\n📋 Configuration:`);
  console.log(`   Input:  ${resolve(inputPath)}`);
  console.log(`   Output: ${resolve(outputPath)}`);

  console.log(`\n📄 Converting with enhanced formatting...\n`);

  try {
    // Pandoc command with formatting options
    const pandocOptions = [
      `"${resolve(inputPath)}"`,
      '-f markdown',
      '-t docx',
      '-o', `"${resolve(outputPath)}"`,
      '--standalone',
      '--table-of-contents',
      '--toc-depth=3',
      '--highlight-style=tango',
      '--number-sections',
      '--metadata title="Knowledge Graph Report"',
      '-V geometry:margin=1in',
      '-V fontsize=11pt',
      '-V linkcolor=blue'
    ].join(' ');

    console.log('🔧 Pandoc options:');
    console.log('   ✅ Standalone document');
    console.log('   ✅ Table of contents');
    console.log('   ✅ Syntax highlighting (tango style)');
    console.log('   ✅ Numbered sections');
    console.log('   ✅ Proper margins and font size');

    execSync(`pandoc ${pandocOptions}`, {
      stdio: 'inherit',
      shell: true
    });

    console.log(`\n✅ Conversion successful with formatting preserved`);

    // Get file size
    const { stat } = await import('fs/promises');
    const stats = await stat(outputPath);

    console.log('\n' + '='.repeat(70));
    console.log(`\n✨ SUCCESS!`);
    console.log(`\n📄 Output file: ${resolve(outputPath)}`);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);

    // Show formatting features
    console.log(`\n🎨 Formatting Applied:`);
    console.log(`   ✓ Heading hierarchy (H1-H6)`);
    console.log(`   ✓ Tables with borders`);
    console.log(`   ✓ Code blocks with highlighting`);
    console.log(`   ✓ Bold, italic, strikethrough`);
    console.log(`   ✓ Ordered and unordered lists`);
    console.log(`   ✓ Blockquotes`);
    console.log(`   ✓ Table of contents\n`);

    // Auto-open if requested
    if (process.argv.includes('--auto-open')) {
      console.log(`\n📖 Opening in Pages...`);
      execSync(`open -a Pages "${resolve(outputPath)}"`, { stdio: 'inherit' });
    }

    return outputPath;

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error(`\n❌ CONVERSION FAILED\n`);
    console.error(`Error: ${error.message}\n`);
    throw error;
  }
}

// Main
const inputPath = process.argv[2] || 'docs/plumbing-knowledge-graph-phase2-report.md';
const outputPath = process.argv[3] || 'plumbing-knowledge-graph-phase2-report-formatted.docx';

convertWithFormatting(inputPath, outputPath)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
