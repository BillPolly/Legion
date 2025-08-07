#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/tool-system';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function finalServerScreenshot() {
  console.log('🚀 Complete Server + Screenshot Demo\n');

  let serverProcess = null;
  
  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    console.log('📦 Loading modules...');
    
    // Load required modules
    const fileModulePath = path.resolve(__dirname, '../../general-tools/src/file/FileModule.js');
    const { default: FileModule } = await import(fileModulePath);
    await moduleLoader.loadModuleByName('file', FileModule);
    console.log('✅ Loaded FileModule');

    const playwrightModulePath = path.resolve(__dirname, '../../playwright/module.json');
    await moduleLoader.loadModuleFromJson(playwrightModulePath);
    console.log('✅ Loaded Playwright module');

    // Test tools are available
    const fileOps = moduleLoader.getTool('file_operations');
    const navigate = moduleLoader.getTool('navigate_to_page');
    const screenshot = moduleLoader.getTool('take_screenshot');
    const closeBrowser = moduleLoader.getTool('close_browser');
    
    if (!fileOps || !navigate || !screenshot) {
      throw new Error('Required tools not found');
    }
    console.log('✅ All tools verified');

    const workspaceDir = path.join(__dirname, '..', '__tests__', 'tmp', 'final-demo');

    // Step 1: Create directory and files
    console.log('\n📁 Step 1: Creating server files...');
    
    await fileOps.execute({
      dirpath: workspaceDir,
      operation: 'create'
    });
    
    await fileOps.execute({
      operation: 'write',
      filepath: path.join(workspaceDir, 'server.mjs'),
      content: `import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = createServer(async (req, res) => {
  if (req.url === '/') {
    try {
      const html = await readFile(path.join(__dirname, 'index.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (err) {
      res.writeHead(500);
      res.end('Error loading page');
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3458;
server.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});
`
    });
    
    await fileOps.execute({
      operation: 'write',
      filepath: path.join(workspaceDir, 'index.html'),
      content: `<!DOCTYPE html>
<html>
<head>
    <title>Legion Demo - Final</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(45deg, #FF6B6B 0%, #4ECDC4 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 80px;
            background: rgba(255,255,255,0.2);
            border-radius: 40px;
            backdrop-filter: blur(30px);
            box-shadow: 0 30px 60px rgba(0,0,0,0.3);
        }
        h1 {
            font-size: 5em;
            margin-bottom: 30px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .success {
            font-size: 2em;
            margin: 20px 0;
        }
        .details {
            font-size: 1.3em;
            opacity: 0.9;
            margin-top: 40px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎉 Success!</h1>
        <p class="success">✅ Server created and running</p>
        <p class="success">📸 Ready for screenshot</p>
        <p class="success">🚀 Powered by Legion</p>
        <p class="details">Created at: ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`
    });
    
    console.log('✅ Server files created');

    // Step 2: Start the server
    console.log('\n🌐 Step 2: Starting server...');
    serverProcess = spawn('node', [path.join(workspaceDir, 'server.mjs')], {
      stdio: 'pipe',
      detached: false
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server start timeout')), 10000);
      
      serverProcess.stdout.on('data', (data) => {
        console.log('Server:', data.toString().trim());
        if (data.toString().includes('Server running')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Server is running');

    // Step 3: Navigate and take screenshot
    console.log('\n📸 Step 3: Taking screenshot...');
    
    const navResult = await navigate.execute({
      url: 'http://localhost:3458',
      waitUntil: 'networkidle',
      timeout: 10000
    });
    
    if (!navResult.success) {
      throw new Error('Navigation failed: ' + navResult.error);
    }
    console.log('✅ Navigated to page');
    
    const screenshotPath = path.join(workspaceDir, 'final-screenshot.png');
    const screenshotResult = await screenshot.execute({
      path: screenshotPath,
      fullPage: true,
      format: 'png'
    });
    
    console.log('Screenshot result:', JSON.stringify(screenshotResult, null, 2));
    
    if (!screenshotResult.success) {
      throw new Error('Screenshot failed: ' + screenshotResult.error);
    }
    
    // Verify screenshot
    const exists = await fs.access(screenshotPath).then(() => true).catch(() => false);
    if (exists) {
      const stats = await fs.stat(screenshotPath);
      console.log(`✅ Screenshot saved!`);
      console.log(`   📁 Path: ${screenshotPath}`);
      console.log(`   📏 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.error('❌ Screenshot file not found');
    }
    
    // Close browser
    await closeBrowser.execute({});
    console.log('✅ Browser closed');

    console.log('\n🎉 Complete! Server is running and screenshot has been saved.');
    console.log(`   View the screenshot at: ${screenshotPath}`);
    console.log(`   Server is at: http://localhost:3458`);
    console.log(`   Press Ctrl+C to stop the server.`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    
    if (serverProcess) {
      console.log('\n🛑 Stopping server...');
      serverProcess.kill();
    }
  }
}

// Run the complete demo
finalServerScreenshot().catch(console.error);