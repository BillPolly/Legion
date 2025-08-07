#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/tool-core';
import { PlanExecutor } from '../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runServerPlan() {
  console.log('🚀 Creating and running Node.js server plan...\n');

  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    console.log('📦 Loading modules from general-tools...');
    
    // Load modules from module.json files
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
          // Load FileModule
          const { default: FileModule } = await import(fullPath);
          await moduleLoader.loadModuleByName('file', FileModule);
          console.log(`✅ Loaded FileModule`);
        }
      } catch (error) {
        console.log(`⚠️  Could not load ${modulePath}: ${error.message}`);
      }
    }

    // Get all available tools
    console.log('\n🔧 Available tools:');
    const toolNames = moduleLoader.getToolNames();
    toolNames.forEach(name => console.log(`   - ${name}`));

    // Create the plan executor
    const executor = new PlanExecutor({ moduleLoader });

    // Define the plan
    const plan = {
      id: 'node-server-screenshot',
      name: 'Create Node Server and Take Screenshot',
      status: 'validated',
      workspaceDir: path.join(__dirname, '..', '__tests__', 'tmp', 'server-demo'),
      steps: [
        {
          id: 'create-dirs',
          name: 'Create project directories',
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
const fs = require('fs');
const path = require('path');

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
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        }
        h1 {
            text-align: center;
            font-size: 3em;
            margin-bottom: 30px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .info {
            background: rgba(255, 255, 255, 0.2);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .timestamp {
            text-align: center;
            font-size: 1.2em;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Legion Plan Executor</h1>
        <div class="info">
            <h2>Server Successfully Created!</h2>
            <p>This webpage was created by the Legion Plan Executor using real tools:</p>
            <ul>
                <li>✅ Created directories with file_operations</li>
                <li>✅ Wrote server.js with file_operations</li>
                <li>✅ Started server with command_executor</li>
                <li>📸 Screenshot will be taken with page_screenshoter</li>
            </ul>
        </div>
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

const PORT = 3456;
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

    console.log('\n📋 Executing plan...\n');
    const result = await executor.executePlan(plan);

    if (result.success) {
      console.log('✅ Plan executed successfully!');
      console.log(`📁 Server files created in: ${plan.workspaceDir}`);
      console.log('\n🔍 Plan execution results:');
      console.log(`   Completed steps: ${result.completedSteps.join(', ')}`);
      console.log(`   Failed steps: ${result.failedSteps.join(', ') || 'none'}`);
      console.log(`   Execution time: ${result.statistics.executionTime}ms`);
      
      // Now let's try to use command executor if available
      if (toolNames.includes('command_executor') || toolNames.includes('execute_command')) {
        console.log('\n🚀 Starting the server...');
        // We'll add server start logic here if the tool is available
      } else {
        console.log('\n⚠️  Command executor tool not available. Server files created but not started.');
        console.log('You can manually run: node server.js');
      }
    } else {
      console.error('❌ Plan execution failed');
      console.error('Failed steps:', result.failedSteps);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the plan
runServerPlan().catch(console.error);