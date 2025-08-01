#!/usr/bin/env node

/**
 * Setup CodeMirror with proper ES modules
 * Downloads from skypack which provides pinned, optimized ES modules
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const libDir = path.join(__dirname, '..', 'public', 'lib');

// Simple module list - skypack handles dependencies
const modules = [
  '@codemirror/view',
  '@codemirror/state', 
  '@codemirror/commands',
  '@codemirror/language',
  '@codemirror/search',
  '@codemirror/autocomplete',
  '@codemirror/lang-javascript',
  '@codemirror/theme-one-dark'
];

async function downloadFromSkypack(moduleName) {
  const url = `https://cdn.skypack.dev/${moduleName}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Skypack redirects to pinned URL
        https.get(response.headers.location, (redirectResponse) => {
          let data = '';
          redirectResponse.on('data', chunk => data += chunk);
          redirectResponse.on('end', () => resolve({ 
            content: data, 
            pinnedUrl: response.headers.location 
          }));
        });
      } else {
        reject(new Error(`Failed to get ${moduleName}: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

async function setupModules() {
  console.log('📦 Setting up CodeMirror with Skypack modules...\n');
  
  // Create lib directory
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }
  
  // Create import map
  const importMap = {
    imports: {}
  };
  
  for (const moduleName of modules) {
    console.log(`📍 Getting ${moduleName}...`);
    
    try {
      const { content, pinnedUrl } = await downloadFromSkypack(moduleName);
      
      // Skypack returns a small loader that points to the actual module
      // Extract the pinned URL from the content
      const pinnedMatch = content.match(/from\s*["']([^"']+)["']/);
      const actualUrl = pinnedMatch ? pinnedMatch[1] : pinnedUrl;
      
      // For our simple server approach, save the redirect URL
      importMap.imports[moduleName] = actualUrl;
      
      console.log(`✓ ${moduleName} -> ${actualUrl}`);
    } catch (error) {
      console.error(`✗ Failed ${moduleName}: ${error.message}`);
    }
  }
  
  // Save import map
  const importMapPath = path.join(libDir, 'import-map.json');
  fs.writeFileSync(importMapPath, JSON.stringify(importMap, null, 2));
  
  // Create a simple loader module
  const loaderContent = `
/**
 * CodeMirror ES Module Loader
 * Uses Skypack CDN for proper ES modules
 */

// Re-export from Skypack
${modules.map(m => `export * as ${m.replace('@codemirror/', '').replace('-', '_')} from '${importMap.imports[m]}';`).join('\n')}
`;

  fs.writeFileSync(path.join(libDir, 'codemirror.js'), loaderContent);
  
  console.log('\n✅ Setup complete!');
  console.log('📄 Import map saved to:', importMapPath);
}

// Create a test to verify all routes work
async function createRouteTest() {
  const testContent = `
/**
 * Test that all CodeMirror routes are accessible
 */

import { view, state, commands, language, search, autocomplete, lang_javascript, theme_one_dark } from '/lib/codemirror.js';

// Test that modules loaded
console.log('Testing CodeMirror module routes...');

const tests = [
  { name: 'view', module: view },
  { name: 'state', module: state },
  { name: 'commands', module: commands },
  { name: 'language', module: language },
  { name: 'search', module: search },
  { name: 'autocomplete', module: autocomplete },
  { name: 'lang_javascript', module: lang_javascript },
  { name: 'theme_one_dark', module: theme_one_dark }
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  if (test.module && typeof test.module === 'object') {
    console.log('✓', test.name, 'loaded successfully');
    passed++;
  } else {
    console.error('✗', test.name, 'failed to load');
    failed++;
  }
}

console.log(\`\\nTest Results: \${passed} passed, \${failed} failed\`);

// Test specific exports
if (view.EditorView) {
  console.log('✓ EditorView is available');
} else {
  console.error('✗ EditorView is not available');
}

if (state.EditorState) {
  console.log('✓ EditorState is available');
} else {
  console.error('✗ EditorState is not available');
}

export { passed, failed };
`;

  fs.writeFileSync(path.join(__dirname, '..', 'public', 'test-codemirror-routes.html'), `
<!DOCTYPE html>
<html>
<head>
  <title>CodeMirror Route Test</title>
</head>
<body>
  <h1>CodeMirror Route Test</h1>
  <p>Check the console for results</p>
  <script type="module">
    ${testContent}
  </script>
</body>
</html>
  `);
  
  console.log('📝 Created test file: public/test-codemirror-routes.html');
}

// Run setup and create test
setupModules()
  .then(() => createRouteTest())
  .catch(console.error);