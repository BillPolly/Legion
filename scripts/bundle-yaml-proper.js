#!/usr/bin/env node

import { build } from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Build yaml as a single bundle
build({
  entryPoints: [join(__dirname, '..', 'node_modules', 'yaml', 'browser', 'index.js')],
  bundle: true,
  format: 'esm',
  outfile: join(__dirname, '..', 'public', 'lib', 'yaml.esm.js'),
  platform: 'browser',
  target: ['es2020'],
  minify: false,
  sourcemap: false,
}).then(() => {
  console.log('✅ Bundled yaml successfully');
}).catch((err) => {
  console.error('❌ Failed to bundle yaml:', err);
  process.exit(1);
});