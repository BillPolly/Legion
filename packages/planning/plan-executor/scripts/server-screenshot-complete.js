#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/tool-system';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServerAndScreenshot() {
  console.log('🚀 Creating Node.js server and taking screenshot...\n');

  let serverProcess = null;
  
  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    console.log('📦 Loading modules...');
    
    // Load file module
    const fileModulePath = path.resolve(__dirname, '../../general-tools/src/file/FileModule.js');
    const { default: FileModule } = await import(fileModulePath);
    await moduleLoader.loadModuleByName('file', FileModule);
    console.log('✅ Loaded FileModule');

    // Load playwright module
    const playwrightModulePath = path.resolve(__dirname, '../../playwright/module.json');
    await moduleLoader.loadModuleFromJson(playwrightModulePath);
    console.log('✅ Loaded Playwright module');

    // Create the plan executor
    const executor = new PlanExecutor({ moduleLoader });
    const workspaceDir = path.join(__dirname, '..', '__tests__', 'tmp', 'server-screenshot-complete');

    // Plan to create server files
    const createServerPlan = {
      id: 'create-server',
      name: 'Create Server Files',
      status: 'validated',
      workspaceDir,
      steps: [
        {
          id: 'setup',
          name: 'Create directories',
          actions: [
            {
              id: 'create-dir',
              type: 'file_operations',
              parameters: {
                dirpath: '$workspaceDir',
                operation: 'create'
              }
            }
          ]
        },
        {
          id: 'create-files',
          name: 'Create server and HTML files',
          actions: [
            {
              id: 'write-server',
              type: 'file_operations',
              parameters: {
                operation: 'write',
                filepath: '$workspaceDir/server.mjs',
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

const PORT = 3457;
server.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});
`
              }
            },
            {
              id: 'write-html',
              type: 'file_operations',
              parameters: {
                operation: 'write',
                filepath: '$workspaceDir/index.html',
                content: `<!DOCTYPE html>
<html>
<head>
    <title>Legion Screenshot Test</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 60px;
            background: rgba(255,255,255,0.15);
            border-radius: 30px;
            backdrop-filter: blur(20px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }
        h1 {
            font-size: 4em;
            margin-bottom: 20px;
            animation: fadeIn 1s ease-in;
        }
        .info {
            font-size: 1.5em;
            margin: 20px 0;
            opacity: 0.9;
        }
        .timestamp {
            font-size: 1.2em;
            opacity: 0.7;
            margin-top: 30px;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 Legion Plan Executor</h1>
        <p class="info">✨ Successfully created and served by Legion!</p>
        <p class="info">📸 Ready for screenshot capture</p>
        <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`
              }
            }
          ]
        }
      ]
    };

    console.log('\n📋 Step 1: Creating server files...\n');
    
    // Add event listeners for debugging
    executor.on('step:start', (data) => {
      console.log(`   Starting step: ${data.stepName || data.step?.name || data.stepId}`);
    });
    
    executor.on('action:start', (data) => {
      console.log(`   → Action: ${data.action?.type || data.actionType || 'unknown'}`);
    });
    
    executor.on('action:error', (data) => {
      console.error(`   Action error:`, data.error?.message || data.error);
      if (data.error?.stack) {
        console.error('   Stack:', data.error.stack);
      }
    });
    
    executor.on('step:error', (data) => {
      console.error(`   Step error in ${data.stepId}:`, data.error?.message || data.error);
      if (data.error?.stack) {
        console.error('   Stack trace:', data.error.stack);
      }
    });
    
    let createResult;
    try {
      createResult = await executor.executePlan(createServerPlan);
    } catch (planError) {
      console.error('Plan execution error:', planError.message);
      console.error('Stack:', planError.stack);
      throw planError;
    }
    
    if (!createResult.success) {
      console.error('Plan execution failed:', createResult);
      throw new Error('Failed to create server files');
    }
    console.log('✅ Server files created successfully');

    // Start the server
    console.log('\n📋 Step 2: Starting server...');
    serverProcess = spawn('node', [path.join(workspaceDir, 'server.mjs')], {
      stdio: 'pipe',
      detached: false
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server start timeout')), 10000);
      
      serverProcess.stdout.on('data', (data) => {
        console.log('   Server:', data.toString().trim());
        if (data.toString().includes('Server running')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        console.error('   Server error:', data.toString());
      });
      
      serverProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Give server extra time to stabilize
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('✅ Server is running');

    // Take screenshot using the new path parameter
    const screenshotPlan = {
      id: 'screenshot',
      name: 'Take Screenshot',
      status: 'validated',
      workspaceDir,
      steps: [
        {
          id: 'capture',
          name: 'Navigate and capture screenshot',
          actions: [
            {
              id: 'navigate',
              type: 'navigate_to_page',
              parameters: {
                url: 'http://localhost:3457',
                waitUntil: 'networkidle',
                timeout: 10000
              }
            },
            {
              id: 'screenshot',
              type: 'take_screenshot',
              parameters: {
                path: '$workspaceDir/webpage-screenshot.png',
                fullPage: true,
                format: 'png'
              }
            }
          ]
        }
      ]
    };

    console.log('\n📋 Step 3: Taking screenshot...\n');
    
    // Add event listeners for debugging
    executor.on('action:start', (data) => {
      console.log(`   → ${data.action.type}`);
    });
    
    executor.on('action:complete', (data) => {
      console.log(`   ✓ ${data.action.type} completed`);
      if (data.action.type === 'take_screenshot' && data.result?.data?.savedPath) {
        console.log(`   📸 Screenshot saved to: ${data.result.data.savedPath}`);
      }
    });
    
    executor.on('action:error', (data) => {
      console.error(`   ❌ ${data.action.type} failed:`, data.error?.message || data.error);
      if (data.error?.stack) {
        console.error('   Stack:', data.error.stack);
      }
    });

    const screenshotResult = await executor.executePlan(screenshotPlan);
    
    if (!screenshotResult.success) {
      throw new Error('Failed to take screenshot');
    }

    // Verify the screenshot exists
    const screenshotPath = path.join(workspaceDir, 'webpage-screenshot.png');
    const exists = await fs.access(screenshotPath).then(() => true).catch(() => false);
    
    if (exists) {
      const stats = await fs.stat(screenshotPath);
      console.log(`\n✅ Screenshot successfully saved!`);
      console.log(`   📁 Location: ${screenshotPath}`);
      console.log(`   📏 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.error('\n❌ Screenshot file not found!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Clean up server
    if (serverProcess) {
      console.log('\n🛑 Stopping server...');
      serverProcess.kill();
    }
  }
}

// Run the complete flow
createServerAndScreenshot().catch(console.error);