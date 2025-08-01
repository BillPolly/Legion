/**
 * Verify that our bundled CodeMirror works correctly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verifying CodeMirror bundle...\n');

// Check that files exist
const libDir = path.join(__dirname, '..', 'public', 'lib');
const bundleFiles = [
  'codemirror-bundle.js',
  'codemirror-bundle.esm.js'
];

let allGood = true;

bundleFiles.forEach(file => {
  const filePath = path.join(libDir, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✓ ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  } else {
    console.log(`✗ ${file} - NOT FOUND`);
    allGood = false;
  }
});

// Read the bundle and check for key exports
console.log('\n📦 Checking bundle exports...');
const bundleContent = fs.readFileSync(path.join(libDir, 'codemirror-bundle.js'), 'utf8');

const expectedExports = [
  'EditorView',
  'EditorState',
  'javascript',
  'lineNumbers',
  'oneDark'
];

expectedExports.forEach(exportName => {
  if (bundleContent.includes(exportName)) {
    console.log(`✓ Contains ${exportName}`);
  } else {
    console.log(`✗ Missing ${exportName}`);
    allGood = false;
  }
});

console.log(allGood ? '\n✅ Bundle verification passed!' : '\n❌ Bundle verification failed!');