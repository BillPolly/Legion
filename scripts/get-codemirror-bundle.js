#!/usr/bin/env node

/**
 * Get a proper bundled version of CodeMirror
 * Downloads from jsDelivr which provides bundled ES modules
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadBundle() {
  console.log('📦 Getting bundled CodeMirror...\n');
  
  const bundleUrl = 'https://cdn.jsdelivr.net/npm/codemirror@6.0.1/+esm';
  const bundlePath = path.join(__dirname, '..', 'public', 'lib', 'codemirror-bundle.js');
  
  // Ensure directory exists
  const libDir = path.join(__dirname, '..', 'public', 'lib');
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(bundlePath);
    
    https.get(bundleUrl, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('✓ Downloaded codemirror bundle');
          resolve();
        });
      } else {
        reject(new Error(`Failed: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

downloadBundle().catch(console.error);