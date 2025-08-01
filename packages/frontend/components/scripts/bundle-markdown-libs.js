#!/usr/bin/env node

import { build } from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Bundle markdown-it
build({
  entryPoints: [join(__dirname, '..', 'node_modules', 'markdown-it', 'index.mjs')],
  bundle: true,
  format: 'esm',
  outfile: join(__dirname, '..', 'public', 'lib', 'markdown-it.esm.js'),
  platform: 'browser',
  target: ['es2020'],
  minify: false,
  sourcemap: false,
}).then(() => {
  console.log('✅ Bundled markdown-it successfully');
}).catch((err) => {
  console.error('❌ Failed to bundle markdown-it:', err);
  process.exit(1);
});

// Bundle highlight.js
build({
  entryPoints: [join(__dirname, '..', 'node_modules', 'highlight.js', 'es', 'index.js')],
  bundle: true,
  format: 'esm',
  outfile: join(__dirname, '..', 'public', 'lib', 'highlight.esm.js'),
  platform: 'browser',
  target: ['es2020'],
  minify: false,
  sourcemap: false,
}).then(() => {
  console.log('✅ Bundled highlight.js successfully');
}).catch((err) => {
  console.error('❌ Failed to bundle highlight.js:', err);
  process.exit(1);
});