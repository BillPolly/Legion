import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ResourceManager, ModuleLoader } from '@legion/module-loader';
import { PlanExecutor } from '../../src/core/PlanExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Server and Screenshot Integration', () => {
  let resourceManager;
  let moduleLoader;
  let executor;
  let serverProcess;
  const testDir = path.join(__dirname, 'tmp', 'server-screenshot-test');

  beforeEach(async () => {
    // Create ResourceManager and ModuleLoader
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    // Load required modules
    const fileModulePath = path.resolve(__dirname, '../../../general-tools/src/file/FileModule.js');
    const { default: FileModule } = await import(fileModulePath);
    await moduleLoader.loadModuleByName('file', FileModule);

    const playwrightModulePath = path.resolve(__dirname, '../../../playwright/module.json');
    await moduleLoader.loadModuleFromJson(playwrightModulePath);

    // Create executor
    executor = new PlanExecutor({ moduleLoader });

    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    // Kill server if running
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should create a Node.js server, run it, and take a screenshot', async () => {
    const plan = {
      id: 'server-screenshot-plan',
      name: 'Create Server and Take Screenshot',
      status: 'validated',
      workspaceDir: testDir,
      steps: [
        {
          id: 'setup',
          name: 'Create directories',
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
          name: 'Create server files',
          actions: [
            {
              type: 'file_operations',
              parameters: {
                operation: 'write',
                path: '$workspaceDir/server.mjs',
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

const PORT = 3456;
server.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});
`
              }
            },
            {
              type: 'file_operations',
              parameters: {
                operation: 'write',
                path: '$workspaceDir/index.html',
                content: `<!DOCTYPE html>
<html>
<head>
    <title>Legion Test Server</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
        }
        h1 {
            font-size: 3em;
            margin-bottom: 20px;
        }
        .timestamp {
            font-size: 1.2em;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Legion Test Server</h1>
        <p class="timestamp">Generated at: ${new Date().toLocaleString()}</p>
        <p>This page was created by Legion's plan executor!</p>
    </div>
</body>
</html>`
              }
            }
          ]
        }
      ]
    };

    // Execute the plan
    const result = await executor.executePlan(plan);
    expect(result.success).toBe(true);

    // Verify files were created
    const serverExists = await fs.access(path.join(testDir, 'server.mjs')).then(() => true).catch(() => false);
    const htmlExists = await fs.access(path.join(testDir, 'index.html')).then(() => true).catch(() => false);
    expect(serverExists).toBe(true);
    expect(htmlExists).toBe(true);

    // Start the server manually
    console.log('Starting server...');
    serverProcess = spawn('node', [path.join(testDir, 'server.mjs')], {
      stdio: 'pipe',
      detached: false
    });

    // Wait for server to start
    await new Promise((resolve) => {
      serverProcess.stdout.on('data', (data) => {
        console.log('Server output:', data.toString());
        if (data.toString().includes('Server running')) {
          resolve();
        }
      });
      serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });
    });

    // Give server a moment to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Now take a screenshot using Playwright with the new path parameter
    const screenshotPlan = {
      id: 'screenshot-plan',
      name: 'Take Screenshot',
      status: 'validated',
      workspaceDir: testDir,
      steps: [
        {
          id: 'navigate-and-screenshot',
          name: 'Navigate and take screenshot',
          actions: [
            {
              type: 'navigate_to_page',
              parameters: {
                url: 'http://localhost:3456',
                waitUntil: 'networkidle'
              }
            },
            {
              type: 'take_screenshot',
              parameters: {
                path: '$workspaceDir/screenshot.png',
                fullPage: true,
                format: 'png'
              }
            }
          ]
        }
      ]
    };

    const screenshotResult = await executor.executePlan(screenshotPlan);
    expect(screenshotResult.success).toBe(true);

    // Verify screenshot was saved
    const screenshotExists = await fs.access(path.join(testDir, 'screenshot.png')).then(() => true).catch(() => false);
    expect(screenshotExists).toBe(true);

    console.log(`\n✅ Screenshot saved to: ${path.join(testDir, 'screenshot.png')}`);
  }, 30000); // 30 second timeout
});