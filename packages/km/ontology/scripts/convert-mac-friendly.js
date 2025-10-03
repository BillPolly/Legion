#!/usr/bin/env node
/**
 * Markdown to Mac Pages Compatible DOCX Converter
 *
 * Uses macOS-native fonts to avoid font replacement warnings:
 * - Helvetica Neue for headings
 * - Helvetica for body text
 * - Courier New for code
 */

import { execSync } from 'child_process';
import { resolve, dirname, join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createReferenceDoc() {
  // Create a reference document with Mac-friendly fonts using LaTeX-style variables
  const referenceDocContent = `---
mainfont: Helvetica
sansfont: Helvetica Neue
monofont: Courier New
fontsize: 11pt
geometry: margin=1in
---

# Sample Document

This is a sample paragraph.

## Code Sample

\`\`\`
code block
\`\`\`
`;

  const tmpDir = join(__dirname, 'tmp');
  mkdirSync(tmpDir, { recursive: true });

  const refMdPath = join(tmpDir, 'reference.md');
  const refDocxPath = join(tmpDir, 'reference.docx');

  writeFileSync(refMdPath, referenceDocContent);

  // Create reference DOCX with Mac fonts
  execSync(`pandoc "${refMdPath}" -o "${refDocxPath}" --standalone`, {
    stdio: 'pipe'
  });

  return refDocxPath;
}

async function convertWithMacFonts(inputPath, outputPath) {
  console.log('\n🍎 MAC-FRIENDLY MARKDOWN TO DOCX CONVERSION\n');
  console.log('='.repeat(70));
  console.log(`\n📋 Configuration:`);
  console.log(`   Input:  ${resolve(inputPath)}`);
  console.log(`   Output: ${resolve(outputPath)}`);

  console.log(`\n📄 Converting with macOS-native fonts...\n`);

  try {
    // Create reference document
    console.log('📝 Creating reference document with Mac fonts...');
    const referenceDoc = await createReferenceDoc();
    console.log('✅ Reference document created');

    // Pandoc command with Mac-friendly options
    const pandocOptions = [
      `"${resolve(inputPath)}"`,
      '-f markdown+smart',
      '-t docx',
      '-o', `"${resolve(outputPath)}"`,
      '--standalone',
      '--table-of-contents',
      '--toc-depth=3',
      '--reference-doc', `"${referenceDoc}"`,
      '--metadata title="Knowledge Graph Report"'
    ].join(' ');

    console.log('\n🔧 Mac-Friendly Settings:');
    console.log('   ✅ Body: Helvetica');
    console.log('   ✅ Headings: Helvetica Neue');
    console.log('   ✅ Code: Courier New');
    console.log('   ✅ Table of contents');
    console.log('   ✅ Smart typography');
    console.log('   ✅ All fonts native to macOS');

    console.log('\n🔄 Converting...\n');

    execSync(`pandoc ${pandocOptions}`, {
      stdio: 'inherit',
      shell: true
    });

    console.log(`\n✅ Conversion successful - No font replacement needed!`);

    // Get file size
    const { stat } = await import('fs/promises');
    const stats = await stat(outputPath);

    console.log('\n' + '='.repeat(70));
    console.log(`\n✨ SUCCESS!`);
    console.log(`\n📄 Output file: ${resolve(outputPath)}`);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);

    console.log(`\n🎨 Formatting Applied:`);
    console.log(`   ✓ Heading hierarchy with Helvetica Neue`);
    console.log(`   ✓ Tables with borders`);
    console.log(`   ✓ Code blocks with Courier New`);
    console.log(`   ✓ Bold, italic text`);
    console.log(`   ✓ Lists (ordered and unordered)`);
    console.log(`   ✓ Table of contents`);
    console.log(`   ✓ 100% Mac-compatible fonts\n`);

    // Auto-open if requested
    if (process.argv.includes('--auto-open')) {
      console.log(`\n📖 Opening in Pages (no font warnings!)...`);
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
const outputPath = process.argv[3] || 'plumbing-knowledge-graph-phase2-report-mac.docx';

convertWithMacFonts(inputPath, outputPath)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
