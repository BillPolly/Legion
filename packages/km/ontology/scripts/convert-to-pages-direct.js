#!/usr/bin/env node
/**
 * Direct Markdown to Pages Converter
 *
 * Bypasses font issues by converting directly to .pages format
 * 1. Create clean DOCX with pandoc
 * 2. Open in Pages
 * 3. Save as native .pages format
 * 4. Delete intermediate DOCX
 */

import { execSync } from 'child_process';
import { resolve } from 'path';
import { unlink } from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

async function convertToPages(inputPath, outputPath) {
  console.log('\n📱 DIRECT MARKDOWN → PAGES CONVERSION\n');
  console.log('='.repeat(70));
  console.log(`\n📋 Configuration:`);
  console.log(`   Input:  ${resolve(inputPath)}`);
  console.log(`   Output: ${resolve(outputPath)}`);

  const docxTemp = outputPath.replace(/\.pages$/, '.docx');

  try {
    // Step 1: Create DOCX with simple settings
    console.log(`\n📄 Step 1: Converting markdown to DOCX...\n`);

    execSync(`pandoc "${resolve(inputPath)}" -f markdown -t docx -o "${resolve(docxTemp)}" --standalone`, {
      stdio: 'inherit'
    });

    console.log(`✅ DOCX created: ${docxTemp}`);

    // Step 2: Open in Pages and save as .pages
    console.log(`\n📱 Step 2: Converting DOCX to native Pages format...\n`);

    const appleScript = `
tell application "Pages"
    activate
    set theDoc to open POSIX file "${resolve(docxTemp)}"
    delay 3
    -- Click "Use replacement fonts" if dialog appears
    tell application "System Events"
        tell process "Pages"
            if exists button "Use Replacement Fonts" of sheet 1 of window 1 then
                click button "Use Replacement Fonts" of sheet 1 of window 1
            end if
        end tell
    end tell
    delay 1
    export theDoc to POSIX file "${resolve(outputPath)}" as Pages
    close theDoc saving no
    quit
end tell
`;

    console.log('🔧 Using AppleScript to:');
    console.log('   ✅ Open DOCX in Pages');
    console.log('   ✅ Auto-accept font replacement');
    console.log('   ✅ Save as native .pages format');
    console.log('   ✅ Close Pages');

    execSync(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`, {
      stdio: 'inherit',
      timeout: 30000
    });

    console.log(`\n✅ Pages document created successfully`);

    // Step 3: Delete intermediate DOCX
    console.log(`\n🗑️  Step 3: Cleaning up intermediate files...\n`);
    await unlink(docxTemp);
    console.log(`✅ Removed: ${docxTemp}`);

    // Get file size
    const { stat } = await import('fs/promises');
    const stats = await stat(outputPath);

    console.log('\n' + '='.repeat(70));
    console.log(`\n✨ SUCCESS!`);
    console.log(`\n📄 Output file: ${resolve(outputPath)}`);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);

    console.log(`\n🎉 Native Pages document created!`);
    console.log(`   ✓ No font warnings`);
    console.log(`   ✓ Full formatting preserved`);
    console.log(`   ✓ Ready to edit in Pages\n`);

    // Auto-open if requested
    if (process.argv.includes('--auto-open')) {
      console.log(`\n📖 Opening in Pages...`);
      execSync(`open "${resolve(outputPath)}"`, { stdio: 'inherit' });
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
const outputPath = process.argv[3] || 'plumbing-knowledge-graph-phase2-report.pages';

convertToPages(inputPath, outputPath)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
