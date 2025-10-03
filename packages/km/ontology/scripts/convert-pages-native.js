#!/usr/bin/env node
/**
 * Markdown to Pages-Native DOCX Converter
 *
 * Uses the most basic, guaranteed-to-work fonts on macOS
 * Removes problematic TOC formatting
 */

import { execSync } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

async function convertForPages(inputPath, outputPath) {
  console.log('\n📄 PAGES-OPTIMIZED CONVERSION\n');
  console.log('='.repeat(70));
  console.log(`\n📋 Configuration:`);
  console.log(`   Input:  ${resolve(inputPath)}`);
  console.log(`   Output: ${resolve(outputPath)}`);

  console.log(`\n🔄 Converting with Pages-optimized settings...\n`);

  try {
    // Simplest possible pandoc command - let Pages handle styling
    const pandocOptions = [
      `"${resolve(inputPath)}"`,
      '-f markdown',
      '-t docx',
      '-o', `"${resolve(outputPath)}"`,
      '--standalone',
      // Remove TOC - it's causing issues
      // '--table-of-contents',
      // Use default fonts - Pages will map them
      '-V fontfamily=sans',
      '-V geometry:margin=1in'
    ].join(' ');

    console.log('🔧 Conversion Settings:');
    console.log('   ✅ No custom fonts (using defaults)');
    console.log('   ✅ No TOC (cleaner output)');
    console.log('   ✅ Let Pages handle font mapping');
    console.log('   ✅ Preserve all markdown structure');

    console.log('\n🔄 Converting...\n');

    execSync(`pandoc ${pandocOptions}`, {
      stdio: 'inherit',
      shell: true
    });

    console.log(`\n✅ Conversion complete`);

    // Get file size
    const { stat } = await import('fs/promises');
    const stats = await stat(outputPath);

    console.log('\n' + '='.repeat(70));
    console.log(`\n✨ SUCCESS!`);
    console.log(`\n📄 Output file: ${resolve(outputPath)}`);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);

    console.log(`\n💡 Pages should auto-select compatible fonts`);
    console.log(`   If prompted, select: "Use replacement fonts"\n`);

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
const outputPath = process.argv[3] || 'plumbing-knowledge-graph-phase2-report-pages.docx';

convertForPages(inputPath, outputPath)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
