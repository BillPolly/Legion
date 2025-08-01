#!/usr/bin/env node

/**
 * Download CodeMirror ES modules from esm.sh
 * These are properly bundled for browser use
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modules = [
  { name: 'view', url: 'https://esm.sh/@codemirror/view@6.26.3' },
  { name: 'state', url: 'https://esm.sh/@codemirror/state@6.4.1' },
  { name: 'commands', url: 'https://esm.sh/@codemirror/commands@6.3.3' },
  { name: 'language', url: 'https://esm.sh/@codemirror/language@6.10.1' },
  { name: 'search', url: 'https://esm.sh/@codemirror/search@6.5.6' },
  { name: 'autocomplete', url: 'https://esm.sh/@codemirror/autocomplete@6.15.0' },
  { name: 'lang-javascript', url: 'https://esm.sh/@codemirror/lang-javascript@6.2.2' },
  { name: 'theme-one-dark', url: 'https://esm.sh/@codemirror/theme-one-dark@6.1.2' }
];

const libDir = path.join(__dirname, '..', 'public', 'lib', 'codemirror');

async function downloadModule(name, url) {
  const filePath = path.join(libDir, `${name}.js`);
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        file.close();
        fs.unlinkSync(filePath);
        https.get(response.headers.location, (redirectResponse) => {
          const newFile = fs.createWriteStream(filePath);
          redirectResponse.pipe(newFile);
          newFile.on('finish', () => {
            newFile.close();
            resolve();
          });
        });
      } else if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        file.close();
        fs.unlinkSync(filePath);
        reject(new Error(`Failed to download ${name}: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlinkSync(filePath);
      reject(err);
    });
  });
}

async function processModule(filePath) {
  // Read the downloaded file
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace import statements - simpler approach
  // First handle @codemirror packages
  content = content.replace(/import "\/(@codemirror\/[^@?"]+)(@[^?"]+)?(\?[^"]+)?"/g, (match, pkg) => {
    const moduleName = pkg.replace('@codemirror/', '');
    return `import "/lib/codemirror/${moduleName}.js"`;
  });
  
  // Then handle other packages
  content = content.replace(/import "\/([^@\/][^?"]+)(@[^?"]+)?(\?[^"]+)?"/g, (match, pkg) => {
    return `import "/lib/codemirror/_deps/${pkg}.js"`;
  });
  
  // Handle export from statements
  content = content.replace(/from "\/(@codemirror\/[^@"]+)@[^"]+"/g, (match, pkg) => {
    const moduleName = pkg.replace('@codemirror/', '');
    return `from "/lib/codemirror/${moduleName}.js"`;
  });
  
  content = content.replace(/from "\/([^@\/][^"]+)@[^"]+"/g, (match, pkg) => {
    return `from "/lib/codemirror/_deps/${pkg}.js"`;
  });
  
  // Write back
  fs.writeFileSync(filePath, content);
}

async function downloadAll() {
  console.log('📦 Downloading CodeMirror ES modules...\n');
  
  // Create directories
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }
  
  const depsDir = path.join(libDir, '_deps');
  if (!fs.existsSync(depsDir)) {
    fs.mkdirSync(depsDir, { recursive: true });
  }
  
  // Download each module
  for (const module of modules) {
    console.log(`⬇️  Downloading ${module.name}...`);
    try {
      await downloadModule(module.name, module.url);
      await processModule(path.join(libDir, `${module.name}.js`));
      console.log(`✓ ${module.name}`);
    } catch (error) {
      console.error(`✗ Failed to download ${module.name}: ${error.message}`);
    }
  }
  
  // Create a test file
  const testContent = `<!DOCTYPE html>
<html>
<head>
    <title>CodeMirror Local Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .test { margin: 5px 0; }
        .pass { color: green; }
        .fail { color: red; }
        #editor { border: 1px solid #ccc; height: 200px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>CodeMirror Local Module Test</h1>
    <div id="results"></div>
    <div id="editor"></div>
    
    <script type="module">
        const results = document.getElementById('results');
        
        function log(msg, success) {
            const div = document.createElement('div');
            div.className = 'test ' + (success ? 'pass' : 'fail');
            div.textContent = (success ? '✓ ' : '✗ ') + msg;
            results.appendChild(div);
        }
        
        try {
            // Test imports
            const modules = await Promise.all([
                import('/lib/codemirror/view.js'),
                import('/lib/codemirror/state.js'),
                import('/lib/codemirror/commands.js'),
                import('/lib/codemirror/language.js'),
                import('/lib/codemirror/lang-javascript.js'),
                import('/lib/codemirror/theme-one-dark.js')
            ]);
            
            log('All modules loaded', true);
            
            const { EditorView, keymap, lineNumbers } = modules[0];
            const { EditorState } = modules[1];
            const { defaultKeymap } = modules[2];
            const { javascript } = modules[4];
            const { oneDark } = modules[5];
            
            // Test creating editor
            const state = EditorState.create({
                doc: 'console.log("Hello from local CodeMirror!");',
                extensions: [
                    javascript(),
                    oneDark,
                    lineNumbers(),
                    keymap.of(defaultKeymap)
                ]
            });
            
            const view = new EditorView({
                state,
                parent: document.getElementById('editor')
            });
            
            log('Editor created successfully', true);
            
        } catch (error) {
            log('Error: ' + error.message, false);
            console.error(error);
        }
    </script>
</body>
</html>`;
  
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'test-codemirror-local.html'), testContent);
  
  console.log('\n✅ Download complete!');
  console.log('📝 Test page created: public/test-codemirror-local.html');
}

downloadAll().catch(console.error);