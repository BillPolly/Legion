#!/usr/bin/env node

/**
 * Get properly bundled CodeMirror modules
 * Downloads the actual bundled files from esm.sh with all dependencies included
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        file.close();
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`Failed: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', reject);
  });
}

async function getBundled() {
  console.log('📦 Getting bundled CodeMirror...\n');
  
  const libDir = path.join(__dirname, '..', 'public', 'lib');
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }
  
  // Create a single bundled file using esm.sh's bundle feature
  const bundleUrl = 'https://esm.sh/v135/bundle?imports=' + encodeURIComponent(JSON.stringify({
    "@codemirror/view": "6.26.3",
    "@codemirror/state": "6.4.1",
    "@codemirror/commands": "6.3.3",
    "@codemirror/language": "6.10.1",
    "@codemirror/search": "6.5.6",
    "@codemirror/autocomplete": "6.15.0",
    "@codemirror/lang-javascript": "6.2.2",
    "@codemirror/theme-one-dark": "6.1.2"
  }));
  
  // Actually, let's try a different approach - use skypack which provides cleaner bundles
  const modules = {
    'view': 'https://cdn.skypack.dev/@codemirror/view@6.26.3?min',
    'state': 'https://cdn.skypack.dev/@codemirror/state@6.4.1?min',
    'commands': 'https://cdn.skypack.dev/@codemirror/commands@6.3.3?min',
    'language': 'https://cdn.skypack.dev/@codemirror/language@6.10.1?min',
    'search': 'https://cdn.skypack.dev/@codemirror/search@6.5.6?min',
    'autocomplete': 'https://cdn.skypack.dev/@codemirror/autocomplete@6.15.0?min',
    'lang-javascript': 'https://cdn.skypack.dev/@codemirror/lang-javascript@6.2.2?min',
    'theme-one-dark': 'https://cdn.skypack.dev/@codemirror/theme-one-dark@6.1.2?min'
  };
  
  for (const [name, url] of Object.entries(modules)) {
    console.log(`⬇️  Downloading ${name}...`);
    const dest = path.join(libDir, `codemirror-${name}.js`);
    try {
      await downloadFile(url, dest);
      console.log(`✓ ${name}`);
    } catch (error) {
      console.error(`✗ ${name}: ${error.message}`);
    }
  }
  
  console.log('\n✅ Done!');
}

getBundled().catch(console.error);