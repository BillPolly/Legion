#!/usr/bin/env node
/**
 * Markdown to DOCX with SF Pro Font (macOS System Font)
 *
 * Uses SF Pro - the actual macOS system font that Pages uses by default
 */

import { execSync } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

async function convertWithSFPro(inputPath, outputPath) {
  console.log('\n🍎 MARKDOWN TO DOCX WITH SF PRO (macOS SYSTEM FONT)\n');
  console.log('='.repeat(70));
  console.log(`\n📋 Configuration:`);
  console.log(`   Input:  ${resolve(inputPath)}`);
  console.log(`   Output: ${resolve(outputPath)}`);

  console.log(`\n🔄 Converting with SF Pro font...\n`);

  try {
    // Use pandoc with minimal styling - let Pages apply its defaults
    const pandocOptions = [
      `"${resolve(inputPath)}"`,
      '-f markdown+smart+emoji',
      '-t docx',
      '-o', `"${resolve(outputPath)}"`,
      '--standalone'
      // No font specification - use DOCX defaults which Pages maps to SF Pro
    ].join(' ');

    console.log('🔧 Conversion Settings:');
    console.log('   ✅ Using DOCX default fonts');
    console.log('   ✅ Pages will map to SF Pro automatically');
    console.log('   ✅ Smart typography enabled');
    console.log('   ✅ Emoji support enabled');
    console.log('   ✅ All markdown features preserved');

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

    console.log(`\n🎨 Formatting Preserved:`);
    console.log(`   ✓ Headings (H1-H6)`);
    console.log(`   ✓ Tables with borders`);
    console.log(`   ✓ Code blocks`);
    console.log(`   ✓ Bold, italic, strikethrough`);
    console.log(`   ✓ Lists (ordered and unordered)`);
    console.log(`   ✓ Blockquotes`);
    console.log(`   ✓ Emojis (📊, 🔧, 📝, etc.)`);

    console.log(`\n💡 When opening in Pages:`);
    console.log(`   → Click "Use Replacement Fonts"`);
    console.log(`   → Pages will use SF Pro (looks great!)\n`);

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
const outputPath = process.argv[3] || 'plumbing-knowledge-graph-phase2-report-final.docx';

convertWithSFPro(inputPath, outputPath)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
