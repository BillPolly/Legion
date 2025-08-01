#!/usr/bin/env node

/**
 * Bundle CodeMirror 6 using esbuild - much faster and simpler!
 */

import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bundleCodeMirror() {
  console.log('📦 Bundling CodeMirror 6 with esbuild...\n');
  
  const libDir = path.join(__dirname, '..', 'public', 'lib');
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }
  
  // Create entry file
  const entryContent = `
// CodeMirror 6 Bundle - All exports in one place
export * from '@codemirror/view';
export * from '@codemirror/state';
export * from '@codemirror/commands';
export * from '@codemirror/language';
export * from '@codemirror/search';
export * from '@codemirror/autocomplete';
export * from '@codemirror/lang-javascript';
export { oneDark } from '@codemirror/theme-one-dark';

// Common exports at top level
export { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, Decoration } from '@codemirror/view';
export { EditorState, EditorSelection, StateEffect, StateField, Transaction, Compartment } from '@codemirror/state';
export { defaultKeymap, history, historyKeymap, undo, redo, undoDepth, redoDepth } from '@codemirror/commands';
export { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
export { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
export { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
export { javascript, javascriptLanguage, typescriptLanguage, jsxLanguage, tsxLanguage } from '@codemirror/lang-javascript';

// Add fast-diff for text diffing
export { default as fastDiff } from 'fast-diff';
`;

  const entryPath = path.join(libDir, 'codemirror-entry.js');
  fs.writeFileSync(entryPath, entryContent);

  try {
    // Bundle as ES module
    await esbuild.build({
      entryPoints: [entryPath],
      bundle: true,
      format: 'esm',
      outfile: path.join(libDir, 'codemirror-bundle.esm.js'),
      platform: 'browser',
      minify: true,
      sourcemap: false,
      metafile: true,
      logLevel: 'info'
    });
    
    // Bundle as IIFE for script tag usage
    const result = await esbuild.build({
      entryPoints: [entryPath],
      bundle: true,
      format: 'iife',
      globalName: 'CM',
      outfile: path.join(libDir, 'codemirror-bundle.js'),
      platform: 'browser',
      minify: true,
      sourcemap: false,
      metafile: true,
      logLevel: 'info'
    });
    
    // Clean up entry file
    fs.unlinkSync(entryPath);
    
    console.log('✅ Bundle created successfully!');
    console.log('📁 Output files:');
    console.log('   - lib/codemirror-bundle.js (IIFE, global CM)');
    console.log('   - lib/codemirror-bundle.esm.js (ES Module)');
    
    // Show bundle size
    const bundleStats = fs.statSync(path.join(libDir, 'codemirror-bundle.js'));
    console.log(`\n📊 Bundle size: ${(bundleStats.size / 1024).toFixed(2)} KB`);
    
    console.log('✅ CodeMirror bundle with fast-diff ready for use!');
    
  } catch (error) {
    console.error('❌ Bundle failed:', error);
    throw error;
  }
}

// Check if esbuild is available
try {
  await import('esbuild');
  bundleCodeMirror().catch(console.error);
} catch (error) {
  console.error('❌ esbuild not found. Please install it:');
  console.log('npm install --save-dev esbuild');
  process.exit(1);
}