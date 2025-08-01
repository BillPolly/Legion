#!/usr/bin/env node

/**
 * Bundle CodeMirror for simple /lib/ imports
 * Creates a single bundled file with all dependencies
 */

import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bundle() {
  console.log('📦 Bundling CodeMirror...\n');

  const inputOptions = {
    input: {
      'codemirror': 'virtual-codemirror.js'
    },
    plugins: [
      {
        name: 'virtual-entry',
        resolveId(id) {
          if (id === 'virtual-codemirror.js') {
            return id;
          }
        },
        load(id) {
          if (id === 'virtual-codemirror.js') {
            return `
// CodeMirror bundle for /lib/codemirror
export { EditorView, keymap, lineNumbers, drawSelection, dropCursor } from '@codemirror/view';
export { EditorState, EditorSelection, StateEffect } from '@codemirror/state';
export { defaultKeymap, historyKeymap } from '@codemirror/commands';
export { foldGutter, foldKeymap } from '@codemirror/language';
export { openSearchPanel, searchKeymap } from '@codemirror/search';
export { autocompletion, completionKeymap, closeBrackets } from '@codemirror/autocomplete';
export { javascript } from '@codemirror/lang-javascript';
export { oneDark } from '@codemirror/theme-one-dark';
`;
          }
        }
      },
      nodeResolve()
    ]
  };

  const outputOptions = {
    dir: path.join(__dirname, '..', 'public', 'lib'),
    format: 'es',
    entryFileNames: '[name].js'
  };

  try {
    const bundle = await rollup(inputOptions);
    await bundle.write(outputOptions);
    await bundle.close();
    
    console.log('✅ Bundle created successfully!');
    
    // Create a test file
    createTest();
  } catch (error) {
    console.error('❌ Bundling failed:', error);
    process.exit(1);
  }
}

function createTest() {
  const testContent = `<!DOCTYPE html>
<html>
<head>
  <title>CodeMirror Bundle Test</title>
</head>
<body>
  <h1>CodeMirror Bundle Test</h1>
  <p>Check console for test results</p>
  <div id="editor" style="border: 1px solid #ccc; height: 200px;"></div>
  
  <script type="module">
    import { 
      EditorView, EditorState, EditorSelection,
      keymap, defaultKeymap, javascript, oneDark
    } from '/lib/codemirror.js';
    
    console.log('Testing CodeMirror bundle...');
    
    // Test imports
    const tests = {
      EditorView: typeof EditorView === 'function',
      EditorState: typeof EditorState === 'object',
      EditorSelection: typeof EditorSelection === 'object',
      keymap: typeof keymap === 'object',
      defaultKeymap: Array.isArray(defaultKeymap),
      javascript: typeof javascript === 'function',
      oneDark: Array.isArray(oneDark) || typeof oneDark === 'object'
    };
    
    let passed = 0;
    let failed = 0;
    
    for (const [name, result] of Object.entries(tests)) {
      if (result) {
        console.log('✓', name);
        passed++;
      } else {
        console.error('✗', name);
        failed++;
      }
    }
    
    console.log(\`\\nResults: \${passed} passed, \${failed} failed\\n\`);
    
    // Try to create an editor
    try {
      const state = EditorState.create({
        doc: 'console.log("Hello from CodeMirror!");',
        extensions: [
          javascript(),
          oneDark,
          keymap.of(defaultKeymap)
        ]
      });
      
      const view = new EditorView({
        state,
        parent: document.getElementById('editor')
      });
      
      console.log('✓ Editor created successfully!');
    } catch (error) {
      console.error('✗ Failed to create editor:', error);
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(
    path.join(__dirname, '..', 'public', 'test-codemirror-bundle.html'),
    testContent
  );
  
  console.log('📝 Test file created: public/test-codemirror-bundle.html');
}

// Check if we need to install rollup
try {
  await import('rollup');
  await import('@rollup/plugin-node-resolve');
  bundle();
} catch (error) {
  console.log('📦 Installing bundler (one-time setup)...');
  const { execSync } = await import('child_process');
  execSync('npm install --save-dev rollup @rollup/plugin-node-resolve', { stdio: 'inherit' });
  console.log('✅ Bundler installed, running bundle...\n');
  bundle();
}