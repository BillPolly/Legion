#!/usr/bin/env node
/**
 * Create a Beautiful Reference DOCX
 *
 * This creates a styled reference document that pandoc will use
 * to apply professional formatting to all converted documents
 */

import { execSync } from 'child_process';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createReferenceDoc() {
  console.log('\n🎨 CREATING REFERENCE DOCX WITH PROFESSIONAL STYLING\n');
  console.log('='.repeat(70));

  const outputPath = resolve('scripts/reference.docx');

  try {
    // First, get pandoc's default reference document
    console.log('\n📄 Step 1: Getting pandoc default reference...\n');

    execSync(`pandoc --print-default-data-file reference.docx > "${outputPath}"`, {
      shell: true,
      stdio: 'inherit'
    });

    console.log(`✅ Reference document created: ${outputPath}`);

    console.log('\n📝 Step 2: Instructions to customize:\n');
    console.log('1. Open reference.docx in Pages (or Word)');
    console.log('2. Modify the styles:');
    console.log('   • Heading 1: Large, bold, blue underline');
    console.log('   • Heading 2: Medium, bold, light blue underline');
    console.log('   • Heading 3: Slightly larger, bold');
    console.log('   • Body Text: Regular, readable font');
    console.log('   • Table: Professional borders, alternating rows');
    console.log('   • Code: Monospace font, gray background');
    console.log('3. Save the file as reference.docx');
    console.log('4. Use it with: node convert-final.js\n');

    console.log('📖 Opening reference document for you to style...\n');
    execSync(`open -a Pages "${outputPath}"`, { stdio: 'inherit' });

    console.log('💡 TIP: Make it look exactly how you want your reports to look!');
    console.log('     All future conversions will use these styles.\n');

    console.log('✅ When done styling, just save and close Pages.\n');

    return outputPath;

  } catch (error) {
    console.error('\n❌ Failed to create reference document\n');
    console.error(`Error: ${error.message}\n`);
    throw error;
  }
}

createReferenceDoc()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
