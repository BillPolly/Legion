/**
 * Real LLM Web Page Integration Test
 * 
 * This test uses an actual LLM to create a simple web page,
 * then uses Playwright to capture and display a screenshot.
 */

import { jest } from '@jest/globals';
import { EnhancedCodeAgent } from '../../src/agent/EnhancedCodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

// This test requires a real LLM API key
const ENABLE_REAL_LLM_TEST = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;

// Skip if no API key available
const describeIfLLM = ENABLE_REAL_LLM_TEST ? describe : describe.skip;

// Increase timeout for LLM operations
jest.setTimeout(600000); // 10 minutes

describeIfLLM('Real LLM Web Page Workflow - Step by Step', () => {
  let agent;
  let testDir;
  let serverProcess;
  let serverPort = 8080;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = path.join(os.tmpdir(), `real-llm-webpage-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    console.log(`Test directory: ${testDir}`);
  });

  afterEach(async () => {
    // Cleanup server if running
    if (serverProcess) {
      try {
        serverProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      } catch (error) {
        console.warn('Server cleanup error (ignored):', error.message);
      }
      serverProcess = null;
    }
    
    // Cleanup agent
    if (agent) {
      try {
        await agent.cleanup();
      } catch (error) {
        console.warn('Agent cleanup error (ignored):', error.message);
      }
      agent = null;
    }
    
    // Remove test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Directory cleanup error (ignored):', error.message);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  test('Complete Web Page Creation and Screenshot Workflow', async () => {
    console.log('\n=== Starting Web Page Creation Workflow ===');
    
    // Step 1: Initialize Enhanced Code Agent
    console.log('\n--- Step 1: Initializing Enhanced Code Agent ---');
    
    const llmProvider = process.env.OPENAI_API_KEY ? 'openai' : 'anthropic';
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    
    agent = new EnhancedCodeAgent({
      projectType: 'frontend',
      enableConsoleOutput: true,
      enhancedConfig: {
        enableRuntimeTesting: true,
        enableBrowserTesting: true,
        enableLogAnalysis: true
      }
    });
    
    await agent.initialize(testDir, {
      llmConfig: {
        provider: llmProvider,
        apiKey: apiKey,
        model: llmProvider === 'openai' ? 'gpt-4' : 'claude-3-sonnet-20240229',
        temperature: 0.3,
        maxTokens: 4000
      }
    });
    
    expect(agent.initialized).toBe(true);
    console.log('✅ Agent initialized successfully');
    
    // Step 2: Plan a simple web page
    console.log('\n--- Step 2: Planning Simple Web Page ---');
    
    const requirements = {
      projectName: 'Color Display Page',
      description: 'A simple web page that displays colorful sections',
      features: [
        'HTML page with a title "Color Display Demo"',
        'Three colored sections: red, blue, and green',
        'Each section should have the color name as text',
        'Basic CSS styling with centered text',
        'A simple HTTP server to serve the page'
      ]
    };
    
    const plan = await agent.planProject(requirements);
    expect(plan).toBeDefined();
    console.log('✅ Web page planned successfully');
    
    // Step 3: Generate the web page code
    console.log('\n--- Step 3: Generating Web Page Code ---');
    
    await agent.generateCode();
    
    // List generated files
    const files = await fs.readdir(testDir, { recursive: true });
    console.log('Generated files:', files);
    
    // Find HTML file
    const htmlFile = files.find(f => f.endsWith('.html'));
    expect(htmlFile).toBeDefined();
    
    // Read and display HTML content
    const htmlPath = path.join(testDir, htmlFile);
    const htmlContent = await fs.readFile(htmlPath, 'utf8');
    console.log('\nGenerated HTML:\n', htmlContent);
    
    console.log('✅ Web page code generated successfully');
    
    // Step 4: Create a simple HTTP server if not already generated
    console.log('\n--- Step 4: Setting up HTTP Server ---');
    
    const serverFile = files.find(f => f.includes('server') && f.endsWith('.js'));
    let serverPath;
    
    if (!serverFile) {
      // Create a simple server
      const serverCode = `
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }
    
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.js') contentType = 'application/javascript';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

const PORT = process.env.PORT || ${serverPort};
server.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});
`;
      serverPath = path.join(testDir, 'server.js');
      await fs.writeFile(serverPath, serverCode);
      console.log('Created simple HTTP server');
    } else {
      serverPath = path.join(testDir, serverFile);
    }
    
    // Start the server
    serverProcess = spawn('node', [serverPath], {
      cwd: testDir,
      env: { ...process.env, PORT: serverPort }
    });
    
    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data}`);
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ HTTP server started');
    
    // Step 5: Use Playwright to take a screenshot
    console.log('\n--- Step 5: Taking Screenshot with Playwright ---');
    
    // Import playwright dynamically
    const { chromium } = await import('playwright');
    
    const browser = await chromium.launch({
      headless: true
    });
    
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Navigate to the page
    const url = `http://localhost:${serverPort}`;
    console.log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Take screenshot
    const screenshotPath = path.join(testDir, 'webpage-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    console.log(`✅ Screenshot saved to: ${screenshotPath}`);
    
    // Copy screenshot to permanent location
    const permanentDir = path.join(process.cwd(), 'test-screenshots');
    await fs.mkdir(permanentDir, { recursive: true });
    const permanentScreenshotPath = path.join(permanentDir, 'llm-generated-webpage-screenshot.png');
    await fs.copyFile(screenshotPath, permanentScreenshotPath);
    console.log(`📸 Permanent screenshot saved to: ${permanentScreenshotPath}`);
    
    // Close browser
    await browser.close();
    
    // Step 6: Display the screenshot
    console.log('\n--- Step 6: Displaying Screenshot ---');
    
    // Read the screenshot and display info
    const stats = await fs.stat(screenshotPath);
    console.log(`Screenshot size: ${stats.size} bytes`);
    
    // For terminal environments, we'll create a simple HTML viewer
    const viewerHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Screenshot Viewer</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #f0f0f0;
            font-family: Arial, sans-serif;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            text-align: center;
        }
        img {
            max-width: 100%;
            border: 2px solid #333;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .info {
            margin: 20px 0;
            padding: 10px;
            background: white;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Web Page Screenshot</h1>
        <div class="info">
            <p>Generated at: ${new Date().toISOString()}</p>
            <p>Original URL: ${url}</p>
        </div>
        <img src="webpage-screenshot.png" alt="Screenshot of generated web page">
    </div>
</body>
</html>
`;
    
    const viewerPath = path.join(testDir, 'screenshot-viewer.html');
    await fs.writeFile(viewerPath, viewerHtml);
    
    console.log(`\n✅ Screenshot viewer created at: ${viewerPath}`);
    console.log(`\n📸 To view the screenshot:`);
    console.log(`   1. Open: ${screenshotPath}`);
    console.log(`   2. Or open the viewer: ${viewerPath}`);
    
    // Verify screenshot exists and has content
    expect(stats.size).toBeGreaterThan(0);
    
    console.log('\n🎉 Web Page Creation and Screenshot Workflow Completed Successfully!');
  });
});

// Quick test without LLM
describe('Mock Web Page Workflow', () => {
  test('Can create and screenshot a simple static page', async () => {
    const testDir = path.join(os.tmpdir(), `mock-webpage-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    try {
      // Create a simple HTML page
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Color Display Demo</title>
    <style>
        body {
            margin: 0;
            font-family: Arial, sans-serif;
        }
        .section {
            height: 200px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
        }
        .red { background-color: #ff4444; }
        .blue { background-color: #4444ff; }
        .green { background-color: #44ff44; }
    </style>
</head>
<body>
    <div class="section red">RED SECTION</div>
    <div class="section blue">BLUE SECTION</div>
    <div class="section green">GREEN SECTION</div>
</body>
</html>
`;
      
      await fs.writeFile(path.join(testDir, 'index.html'), htmlContent);
      
      // Simple server
      const serverCode = `
const http = require('http');
const fs = require('fs');
const path = require('path');

http.createServer((req, res) => {
  fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(content);
  });
}).listen(8081, () => console.log('Server running on port 8081'));
`;
      
      await fs.writeFile(path.join(testDir, 'server.js'), serverCode);
      
      // Start server
      const serverProcess = spawn('node', ['server.js'], { cwd: testDir });
      
      // Wait for server
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Take screenshot
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      
      await page.goto('http://localhost:8081');
      const screenshotPath = path.join(testDir, 'mock-screenshot.png');
      await page.screenshot({ path: screenshotPath });
      
      await browser.close();
      serverProcess.kill();
      
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
      
      // Copy screenshot to a permanent location for viewing
      const permanentDir = path.join(process.cwd(), 'test-screenshots');
      await fs.mkdir(permanentDir, { recursive: true });
      const permanentPath = path.join(permanentDir, 'mock-webpage-screenshot.png');
      await fs.copyFile(screenshotPath, permanentPath);
      
      console.log(`Mock screenshot saved to: ${permanentPath}`);
      
    } finally {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });
});