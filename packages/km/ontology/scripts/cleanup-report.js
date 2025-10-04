#!/usr/bin/env node
/**
 * Clean up KG report - remove kg: prefixes and URIs for readability
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function cleanupReport(inputPath, outputPath) {
  console.log('\n🧹 CLEANING UP REPORT FOR READABILITY\n');
  console.log('='.repeat(70));

  let content = readFileSync(inputPath, 'utf-8');

  console.log('\n📝 Removing:');
  console.log('   ✅ kg: prefixes');
  console.log('   ✅ entity:kg: prefixes');
  console.log('   ✅ URI lines');
  console.log('   ✅ Namespace clutter\n');

  // Remove entity:kg: prefix (e.g., "entity:kg:Task" → "Task")
  content = content.replace(/entity:kg:/g, '');

  // Remove kg: prefix from class names and properties
  content = content.replace(/kg:/g, '');

  // Remove URI lines completely (e.g., "**URI:** `kg:WaterHeater`")
  content = content.replace(/\*\*URI:\*\* `[^`]+`\s*\n/g, '');

  // Clean up any double spaces or blank lines created
  content = content.replace(/\n\n\n+/g, '\n\n');

  writeFileSync(outputPath, content);

  console.log(`✅ Cleaned report saved to: ${resolve(outputPath)}\n`);
  console.log('📄 Report is now more readable without ontology notation!\n');
}

// Main
const inputPath = process.argv[2] || 'docs/plumbing-knowledge-graph-phase2-report.md';
const outputPath = process.argv[3] || 'docs/plumbing-knowledge-graph-phase2-report-clean.md';

cleanupReport(inputPath, outputPath);
