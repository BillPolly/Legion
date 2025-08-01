#!/usr/bin/env node

/**
 * Properly cache CodeMirror modules with simple import paths
 * Downloads and processes modules to work with /lib/ imports
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map of simple names to packages we need
const moduleMap = {
  '@codemirror/view': { version: '6.26.3', deps: ['@codemirror/state', 'style-mod', 'w3c-keyname'] },
  '@codemirror/state': { version: '6.4.1', deps: [] },
  '@codemirror/commands': { version: '6.3.3', deps: ['@codemirror/state', '@codemirror/view', '@codemirror/language'] },
  '@codemirror/language': { version: '6.10.1', deps: ['@codemirror/state', '@codemirror/view', '@lezer/common', '@lezer/highlight', 'style-mod'] },
  '@codemirror/search': { version: '6.5.6', deps: ['@codemirror/state', '@codemirror/view', 'crelt'] },
  '@codemirror/autocomplete': { version: '6.15.0', deps: ['@codemirror/state', '@codemirror/view', '@codemirror/language', '@lezer/common'] },
  '@codemirror/lang-javascript': { version: '6.2.2', deps: ['@codemirror/language', '@lezer/javascript'] },
  '@codemirror/theme-one-dark': { version: '6.1.2', deps: ['@codemirror/state', '@codemirror/view', '@codemirror/language', '@lezer/highlight'] },
  // Dependencies
  'style-mod': { version: '4.1.0', deps: [] },
  'w3c-keyname': { version: '2.2.8', deps: [] },
  'crelt': { version: '1.0.6', deps: [] },
  '@lezer/common': { version: '1.2.0', deps: [] },
  '@lezer/highlight': { version: '1.2.0', deps: ['@lezer/common'] },
  '@lezer/javascript': { version: '1.4.13', deps: ['@lezer/highlight', '@lezer/common'] }
};

const cacheDir = path.join(__dirname, '..', 'public', 'lib');

// Download from unpkg which gives us raw UMD/ES builds
async function downloadModule(name, version) {
  const url = `https://unpkg.com/${name}@${version}/dist/index.js`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (redirectResponse) => {
          let data = '';
          redirectResponse.on('data', chunk => data += chunk);
          redirectResponse.on('end', () => resolve(data));
        });
      } else if (response.statusCode === 200) {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      } else {
        reject(new Error(`Failed to download ${name}: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

// Process module content to fix imports
function processModuleContent(content, moduleName) {
  // Replace bare module imports with /lib/ paths
  let processed = content;
  
  // Handle various import patterns
  processed = processed.replace(/from\s+["'](@[^"']+|[^@.][^"']*?)["']/g, (match, importPath) => {
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      return match; // Keep relative imports
    }
    return `from "/lib/${importPath}"`;
  });
  
  // Handle dynamic imports
  processed = processed.replace(/import\(["'](@[^"']+|[^@.][^"']*?)["']\)/g, (match, importPath) => {
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      return match;
    }
    return `import("/lib/${importPath}")`;
  });
  
  return processed;
}

async function cacheAllModules() {
  console.log('📦 Properly caching CodeMirror modules...\n');
  
  // Ensure cache directory exists
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  // First, download all modules
  const downloads = {};
  
  for (const [name, info] of Object.entries(moduleMap)) {
    const fileName = path.join(cacheDir, name);
    const fileDir = path.dirname(fileName);
    
    // Create directory if needed
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    
    if (fs.existsSync(fileName + '.js')) {
      console.log(`✓ ${name} (already cached)`);
      continue;
    }
    
    console.log(`⬇️  Downloading ${name}@${info.version}...`);
    
    try {
      const content = await downloadModule(name, info.version);
      const processed = processModuleContent(content, name);
      fs.writeFileSync(fileName + '.js', processed);
      console.log(`✓ ${name}`);
    } catch (error) {
      console.error(`✗ Failed to download ${name}: ${error.message}`);
      // Try alternative CDN
      console.log(`  Trying alternative source...`);
      try {
        const altUrl = `https://cdn.jsdelivr.net/npm/${name}@${info.version}/+esm`;
        const content = await downloadFromUrl(altUrl);
        const processed = processModuleContent(content, name);
        fs.writeFileSync(fileName + '.js', processed);
        console.log(`✓ ${name} (from jsdelivr)`);
      } catch (altError) {
        console.error(`✗ Also failed from jsdelivr: ${altError.message}`);
      }
    }
  }
  
  console.log('\n✅ All modules cached!');
}

function downloadFromUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
      response.on('error', reject);
    });
  });
}

// Run it
cacheAllModules().catch(console.error);