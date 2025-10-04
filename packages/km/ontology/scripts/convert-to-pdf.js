#!/usr/bin/env node
/**
 * Markdown → Beautifully Formatted PDF Converter
 *
 * Creates a PDF with perfect visual formatting:
 * - Styled headings with colors and underlines
 * - Tables with borders and colored headers
 * - Code blocks with gray backgrounds
 * - Professional typography and spacing
 */

import { execSync } from 'child_process';
import { resolve, dirname, join } from 'path';
import { writeFileSync, mkdirSync, unlinkSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Professional CSS styling for the PDF
const CSS_STYLING = `
<style>
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  line-height: 1.6;
  max-width: 900px;
  margin: 40px auto;
  padding: 20px;
  color: #333;
  font-size: 16px;
}

h1 {
  font-size: 2.5em;
  font-weight: 600;
  margin-top: 0;
  margin-bottom: 0.5em;
  color: #1a1a1a;
  border-bottom: 3px solid #0066cc;
  padding-bottom: 10px;
}

h2 {
  font-size: 2em;
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  color: #1a1a1a;
  border-bottom: 2px solid #0099ff;
  padding-bottom: 8px;
}

h3 {
  font-size: 1.5em;
  font-weight: 600;
  margin-top: 1.2em;
  margin-bottom: 0.5em;
  color: #2a2a2a;
}

h4 {
  font-size: 1.25em;
  font-weight: 600;
  margin-top: 1em;
  margin-bottom: 0.5em;
  color: #2a2a2a;
}

p {
  margin-bottom: 1em;
}

code {
  background-color: #f6f8fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  color: #d73a49;
}

pre {
  background-color: #f6f8fa;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  border: 1px solid #e1e4e8;
}

pre code {
  background-color: transparent;
  padding: 0;
  color: #24292e;
  font-size: 0.85em;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 20px 0;
  font-size: 0.95em;
}

th, td {
  border: 1px solid #ddd;
  padding: 12px 15px;
  text-align: left;
}

th {
  background-color: #0066cc;
  color: white;
  font-weight: 600;
}

tr:nth-child(even) {
  background-color: #f8f9fa;
}

ul, ol {
  margin: 1em 0;
  padding-left: 2em;
}

li {
  margin: 0.5em 0;
}

blockquote {
  border-left: 4px solid #0066cc;
  padding-left: 20px;
  margin: 1em 0;
  color: #666;
  font-style: italic;
}

strong {
  font-weight: 600;
  color: #1a1a1a;
}

em {
  font-style: italic;
  color: #2a2a2a;
}

hr {
  border: none;
  border-top: 2px solid #e1e4e8;
  margin: 2em 0;
}
</style>
`;

async function convertToPDF(inputPath, outputPath) {
  console.log('\n📄 MARKDOWN → BEAUTIFULLY FORMATTED PDF\n');
  console.log('='.repeat(70));
  console.log(`\n📋 Configuration:`);
  console.log(`   Input:  ${resolve(inputPath)}`);
  console.log(`   Output: ${resolve(outputPath)}`);

  const tmpDir = join(__dirname, 'tmp');
  mkdirSync(tmpDir, { recursive: true });

  const htmlPath = join(tmpDir, 'styled-report.html');

  try {
    // Step 1: Convert Markdown to HTML
    console.log(`\n📄 Step 1: Converting markdown to styled HTML...\n`);

    execSync(
      `pandoc "${resolve(inputPath)}" -f markdown -t html --standalone --self-contained -o "${htmlPath}"`,
      { stdio: 'pipe' }
    );

    // Inject beautiful CSS
    let html = readFileSync(htmlPath, 'utf-8');
    html = html.replace('</head>', `${CSS_STYLING}</head>`);
    writeFileSync(htmlPath, html);

    console.log(`✅ Styled HTML created`);

    // Step 2: Convert HTML to PDF using pandoc with PDF engine
    console.log(`\n📱 Step 2: Converting to PDF...\n`);

    console.log('🎨 Applying professional formatting:');
    console.log('   ✅ Color-coded headings with underlines');
    console.log('   ✅ Tables with borders and headers');
    console.log('   ✅ Code blocks with backgrounds');
    console.log('   ✅ Professional typography');
    console.log('   ✅ Proper spacing and layout');

    // Use Chrome headless to convert HTML to PDF (preserves all CSS styling!)
    console.log('   ℹ️  Using Chrome headless for PDF conversion...');

    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

    execSync(
      `"${chromePath}" --headless --disable-gpu --print-to-pdf="${resolve(outputPath)}" "${htmlPath}"`,
      { stdio: 'pipe' }
    );

    console.log(`\n✅ PDF created with beautiful formatting!`);

    // Clean up
    console.log(`\n🗑️  Cleaning up temporary files...`);
    unlinkSync(htmlPath);

    // Get file size
    const { stat } = await import('fs/promises');
    const stats = await stat(outputPath);

    console.log('\n' + '='.repeat(70));
    console.log(`\n🎉 SUCCESS!`);
    console.log(`\n📄 Output file: ${resolve(outputPath)}`);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);

    console.log(`\n✨ Beautiful Formatting Applied:`);
    console.log(`   ✓ Large bold headings with colored underlines`);
    console.log(`   ✓ Tables with blue headers and alternating rows`);
    console.log(`   ✓ Code blocks with gray backgrounds`);
    console.log(`   ✓ Professional fonts and spacing`);
    console.log(`   ✓ All emojis preserved 📊🔧✅\n`);

    // Auto-open in Preview
    console.log(`📖 Opening in Preview...\n`);
    execSync(`open "${resolve(outputPath)}"`, { stdio: 'inherit' });

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
const outputPath = process.argv[3] || 'plumbing-knowledge-graph-phase2-report.pdf';

convertToPDF(inputPath, outputPath)
  .then(() => {
    console.log(`✅ All done!\n`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`❌ Failed: ${error.message}\n`);
    process.exit(1);
  });
