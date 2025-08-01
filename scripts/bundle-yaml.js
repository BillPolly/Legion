#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the yaml library from node_modules
const yamlPath = join(__dirname, '..', 'node_modules', 'yaml', 'browser', 'index.js');
const yamlContent = readFileSync(yamlPath, 'utf8');

// Write to public/lib
const outputPath = join(__dirname, '..', 'public', 'lib', 'yaml.esm.js');
writeFileSync(outputPath, yamlContent);

console.log('✅ Bundled yaml to public/lib/yaml.esm.js');