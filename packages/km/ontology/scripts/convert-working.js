#!/usr/bin/env node
/**
 * Working Markdown to DOCX Converter
 *
 * Based on proven @md2docx/remark-docx library
 * Handles all markdown features including tables, code blocks, emojis
 */

import { readFile, writeFile } from 'fs/promises';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import { remarkDocx } from '@md2docx/remark-docx';
import { resolve } from 'path';
import { execSync } from 'child_process';

async function convertMarkdownToDocx(inputPath, outputPath) {
  console.log('\n✨ WORKING MARKDOWN → DOCX CONVERTER\n');
  console.log('='.repeat(70));
  console.log(`\n📋 Configuration:`);
  console.log(`   Input:  ${resolve(inputPath)}`);
  console.log(`   Output: ${resolve(outputPath)}`);

  try {
    // Read markdown
    console.log(`\n📄 Reading markdown file...`);
    const markdown = await readFile(inputPath, 'utf-8');
    console.log(`✅ Read ${markdown.length} characters`);

    // Create processor with all the bells and whistles
    console.log(`\n🔧 Setting up processor with:`);
    console.log(`   ✅ GitHub Flavored Markdown (tables, task lists)`);
    console.log(`   ✅ Frontmatter support`);
    console.log(`   ✅ Full formatting preservation`);

    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)          // Tables, strikethrough, task lists
      .use(remarkFrontmatter)   // YAML frontmatter
      .use(remarkDocx, 'buffer'); // Output as buffer

    console.log(`\n🔄 Converting...`);

    // Process
    const { result } = processor.processSync(markdown);

    // Wait for result (it's a promise)
    const buffer = await result;

    console.log(`✅ Generated DOCX buffer (${buffer.length} bytes)`);

    // Write file
    console.log(`\n💾 Writing file...`);
    await writeFile(outputPath, buffer);
    console.log(`✅ File written successfully`);

    // Get stats
    const { stat } = await import('fs/promises');
    const stats = await stat(outputPath);

    console.log('\n' + '='.repeat(70));
    console.log(`\n🎉 SUCCESS!`);
    console.log(`\n📄 Output file: ${resolve(outputPath)}`);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);

    console.log(`\n✨ Features Preserved:`);
    console.log(`   ✓ Headings (all levels)`);
    console.log(`   ✓ Tables with proper formatting`);
    console.log(`   ✓ Code blocks`);
    console.log(`   ✓ Bold, italic, strikethrough`);
    console.log(`   ✓ Lists (ordered, unordered, task lists)`);
    console.log(`   ✓ Blockquotes`);
    console.log(`   ✓ Links`);
    console.log(`   ✓ Emojis 📊🔧✅`);

    console.log(`\n💡 Opening in Pages:`);
    console.log(`   Just click "Use Replacement Fonts" when prompted\n`);

    // Auto-open
    if (process.argv.includes('--auto-open')) {
      console.log(`📖 Opening in Pages...`);
      execSync(`open -a Pages "${resolve(outputPath)}"`, { stdio: 'inherit' });
    }

    return outputPath;

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error(`\n❌ CONVERSION FAILED\n`);
    console.error(`Error: ${error.message}`);
    console.error(`\nStack: ${error.stack}\n`);
    throw error;
  }
}

// Main
const inputPath = process.argv[2] || 'docs/plumbing-knowledge-graph-phase2-report.md';
const outputPath = process.argv[3] || 'plumbing-report-working.docx';

convertMarkdownToDocx(inputPath, outputPath)
  .then(() => {
    console.log(`\n✅ All done!\n`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n❌ Failed: ${error.message}\n`);
    process.exit(1);
  });
