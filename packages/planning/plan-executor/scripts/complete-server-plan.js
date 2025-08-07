#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/tool-system';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runCompleteServerPlan() {
  console.log('🚀 Creating Node.js server, running it, and taking screenshot...\n');

  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    console.log('📦 Loading modules...');
    
    // Load all necessary modules
    const modulesToLoad = [
      '../../general-tools/src/file/FileModule.js',
      '../../general-tools/src/command-executor/module.json',
      '../../general-tools/src/server-starter/module.json',
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

    // Show available tools
    console.log('\n🔧 Available tools:');
    const toolNames = moduleLoader.getToolNames();
    toolNames.forEach(name => console.log(`   - ${name}`));

    // Create the plan executor
    const executor = new PlanExecutor({ moduleLoader });

    // Define the complete plan
    const plan = {
      id: 'complete-server-screenshot',
      name: 'Create, Run Server and Take Screenshot',
      status: 'validated',
      workspaceDir: path.join(__dirname, '..', '__tests__', 'tmp', 'complete-server-demo'),
      steps: [
        {
          id: 'setup',
          name: 'Setup project structure',
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
          name: 'Create server.js file',
          actions: [
            {
              type: 'file_operations',
              parameters: {
                filepath: '$workspaceDir/server.js',
                content: `const http = require('http');

const server = http.createServer((req, res) => {
  console.log('Request received:', req.url);
  
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`
<!DOCTYPE html>
<html>
<head>
    <title>Legion Plan Executor Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 60px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            text-align: center;
        }
        h1 {
            color: #333;
            font-size: 3em;
            margin-bottom: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .status {
            background: #4CAF50;
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            display: inline-block;
            font-weight: bold;
            margin: 20px 0;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        .tools {
            text-align: left;
            background: #f5f5f5;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .tools h3 {
            color: #667eea;
            margin-bottom: 10px;
        }
        .tools li {
            margin: 10px 0;
            color: #555;
        }
        .timestamp {
            color: #999;
            font-size: 0.9em;
            margin-top: 30px;
        }
        .legion-logo {
            font-size: 4em;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="legion-logo">🚀</div>
        <h1>Legion Plan Executor</h1>
        <div class="status">SERVER RUNNING</div>
        
        <div class="tools">
            <h3>✨ Created with Legion Tools:</h3>
            <ul>
                <li>📁 <strong>file_operations</strong> - Created directories and files</li>
                <li>💻 <strong>command_executor</strong> - Started the Node.js server</li>
                <li>🚀 <strong>server_start</strong> - Managed server lifecycle</li>
                <li>📸 <strong>page_screenshot</strong> - Will capture this page</li>
            </ul>
        </div>
        
        <p style="color: #666; font-size: 1.2em; line-height: 1.6;">
            This webpage was automatically generated by the Legion Plan Executor
            using real tools from the module system.
        </p>
        
        <div class="timestamp">
            Generated at: \${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>
\`);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 8765;
server.listen(PORT, () => {
  console.log(\`🌐 Server running at http://localhost:\${PORT}\`);
  console.log('Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
`
              }
            }
          ]
        },
        {
          id: 'start-server',
          name: 'Start the Node.js server',
          actions: [
            {
              type: 'server_start',
              parameters: {
                command: 'node',
                args: ['server.js'],
                cwd: '$workspaceDir',
                port: 8765,
                readyPattern: 'Server running at'
              }
            }
          ]
        },
        {
          id: 'wait',
          name: 'Wait for server to be ready',
          actions: [
            {
              type: 'command_executor',
              parameters: {
                command: 'sleep',
                args: ['2'],
                cwd: '$workspaceDir'
              }
            }
          ]
        },
        {
          id: 'screenshot',
          name: 'Take screenshot of the webpage',
          actions: [
            {
              type: 'page_screenshot',
              parameters: {
                url: 'http://localhost:8765',
                outputPath: '$workspaceDir/screenshot.png',
                fullPage: true,
                viewport: {
                  width: 1280,
                  height: 800
                }
              }
            }
          ]
        },
        {
          id: 'stop-server',
          name: 'Stop the server',
          actions: [
            {
              type: 'server_stop',
              parameters: {
                port: 8765
              }
            }
          ]
        }
      ]
    };

    console.log('\n📋 Executing complete plan...\n');
    const result = await executor.executePlan(plan);

    if (result.success) {
      console.log('\n✅ Plan executed successfully!');
      console.log(`📁 Files created in: ${plan.workspaceDir}`);
      console.log('\n📊 Results:');
      console.log(`   ✓ Server files created`);
      console.log(`   ✓ Server started on port 8765`);
      console.log(`   ✓ Screenshot saved as screenshot.png`);
      console.log(`   ✓ Server stopped cleanly`);
      console.log(`\n🖼️  Screenshot location: ${path.join(plan.workspaceDir, 'screenshot.png')}`);
    } else {
      console.error('\n❌ Plan execution failed');
      console.error('Failed steps:', result.failedSteps);
      console.error('Completed steps:', result.completedSteps);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the complete plan
runCompleteServerPlan().catch(console.error);