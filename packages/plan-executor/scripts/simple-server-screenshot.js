#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/module-loader';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSimpleServerPlan() {
  console.log('🚀 Creating server, taking screenshot...\n');

  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    console.log('📦 Loading modules...');
    
    // Load necessary modules
    const modulesToLoad = [
      '../../general-tools/src/file/FileModule.js',
      '../../general-tools/src/command-executor/module.json',
      '../../general-tools/src/page-screenshoter/module.json'
    ];

    for (const modulePath of modulesToLoad) {
      try {
        const fullPath = path.resolve(__dirname, modulePath);
        if (modulePath.endsWith('.json')) {
          await moduleLoader.loadModuleFromJson(fullPath);
          console.log(`✅ Loaded module from ${path.basename(path.dirname(fullPath))}`);
        } else {
          const { default: FileModule } = await import(fullPath);
          await moduleLoader.loadModuleByName('file', FileModule);
          console.log(`✅ Loaded FileModule`);
        }
      } catch (error) {
        console.log(`⚠️  Could not load ${modulePath}: ${error.message}`);
      }
    }

    // Create the plan executor
    const executor = new PlanExecutor({ moduleLoader });
    const workspaceDir = path.join(__dirname, '..', '__tests__', 'tmp', 'simple-server-demo');

    // Define a simple plan to create the server
    const createServerPlan = {
      id: 'create-server',
      name: 'Create Server Files',
      status: 'validated',
      workspaceDir,
      steps: [
        {
          id: 'setup',
          name: 'Setup directories',
          actions: [
            {
              type: 'file_operations',
              parameters: {
                dirpath: '$workspaceDir',
                operation: 'create'
              }
            }
          ]
        },
        {
          id: 'create-server',
          name: 'Create server.js',
          actions: [
            {
              type: 'file_operations',
              parameters: {
                filepath: '$workspaceDir/server.js',
                content: `const http = require('http');

const html = \`<!DOCTYPE html>
<html>
<head>
    <title>Legion Demo</title>
    <style>
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #5B21B6 0%, #7C3AED 50%, #8B5CF6 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            text-align: center;
            padding: 3rem;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 2rem;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
            max-width: 600px;
        }
        h1 {
            font-size: 4rem;
            margin: 0 0 1rem 0;
            font-weight: 900;
            letter-spacing: -0.02em;
        }
        .subtitle {
            font-size: 1.5rem;
            opacity: 0.9;
            margin-bottom: 2rem;
        }
        .tools {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-top: 2rem;
        }
        .tool {
            background: rgba(255, 255, 255, 0.2);
            padding: 1rem;
            border-radius: 1rem;
            backdrop-filter: blur(5px);
        }
        .icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        .timestamp {
            margin-top: 2rem;
            opacity: 0.7;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Legion</h1>
        <div class="subtitle">AI-Powered Plan Execution</div>
        
        <div class="tools">
            <div class="tool">
                <div class="icon">📁</div>
                <strong>File Operations</strong>
                <div>Created this server</div>
            </div>
            <div class="tool">
                <div class="icon">💻</div>
                <strong>Command Executor</strong>
                <div>Running the server</div>
            </div>
            <div class="tool">
                <div class="icon">📸</div>
                <strong>Page Screenshot</strong>
                <div>Capturing this page</div>
            </div>
            <div class="tool">
                <div class="icon">🚀</div>
                <strong>Plan Executor</strong>
                <div>Orchestrating all tools</div>
            </div>
        </div>
        
        <div class="timestamp">
            Generated: \${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>\`;

const server = http.createServer((req, res) => {
  console.log('Request:', req.url);
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

const PORT = 9876;
server.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});
`
              }
            }
          ]
        }
      ]
    };

    console.log('\n📋 Creating server files...\n');
    const createResult = await executor.executePlan(createServerPlan);

    if (!createResult.success) {
      console.error('❌ Failed to create server files');
      return;
    }

    console.log('✅ Server files created!');
    
    // Start the server manually
    console.log('\n🚀 Starting server...');
    const serverProcess = spawn('node', ['server.js'], {
      cwd: workspaceDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data.toString().trim()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`Server Error: ${data.toString().trim()}`);
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot
    console.log('\n📸 Taking screenshot...');
    const screenshotPlan = {
      id: 'screenshot',
      name: 'Take Screenshot',
      status: 'validated',
      workspaceDir,
      steps: [
        {
          id: 'capture',
          name: 'Capture webpage',
          actions: [
            {
              type: 'page_screenshot',
              parameters: {
                url: 'http://localhost:9876',
                outputPath: '$workspaceDir/screenshot.png',
                fullPage: true,
                viewport: {
                  width: 1280,
                  height: 800
                }
              }
            }
          ]
        }
      ]
    };

    const screenshotResult = await executor.executePlan(screenshotPlan);

    if (screenshotResult.success) {
      console.log('✅ Screenshot taken successfully!');
      console.log(`\n🖼️  Screenshot saved to: ${path.join(workspaceDir, 'screenshot.png')}`);
    } else {
      console.error('❌ Failed to take screenshot');
    }

    // Stop the server
    console.log('\n🛑 Stopping server...');
    serverProcess.kill();
    
    console.log('\n✨ Done! Check the screenshot at:');
    console.log(`   ${path.join(workspaceDir, 'screenshot.png')}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the plan
runSimpleServerPlan().catch(console.error);