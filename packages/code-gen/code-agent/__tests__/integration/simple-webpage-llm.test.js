/**
 * Simple Web Page Generation with LLM and Screenshot
 * 
 * This test directly uses the LLM to generate a simple web page and takes a screenshot
 */

import { jest } from '@jest/globals';
import { LLMClient } from '../../../../llm/src/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

// This test requires a real LLM API key
const ENABLE_REAL_LLM_TEST = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;

// Skip if no API key available
const describeIfLLM = ENABLE_REAL_LLM_TEST ? describe : describe.skip;

// Increase timeout for LLM operations
jest.setTimeout(120000); // 2 minutes

describeIfLLM('Simple LLM Web Page Generation', () => {
  let testDir;
  let serverProcess;
  let llmClient;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `simple-llm-webpage-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    console.log(`Test directory: ${testDir}`);
  });

  afterEach(async () => {
    if (serverProcess) {
      serverProcess.kill();
    }
    
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  test('Generate colorful web page with LLM and take screenshot', async () => {
    console.log('\n=== Simple LLM Web Page Generation ===');
    
    // Step 1: Initialize LLM Client
    console.log('\n--- Step 1: Initializing LLM Client ---');
    
    const provider = process.env.OPENAI_API_KEY ? 'openai' : 'anthropic';
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    
    llmClient = new LLMClient({
      provider: provider,
      apiKey: apiKey,
      model: provider === 'openai' ? 'gpt-4' : 'claude-3-sonnet-20240229',
      maxRetries: 3
    });
    
    console.log(`Using ${provider} LLM`);
    
    // Step 2: Generate HTML with LLM
    console.log('\n--- Step 2: Generating HTML with LLM ---');
    
    const prompt = `Generate a complete HTML page with the following requirements:
1. Title: "Color Display Demo"
2. Three colored sections stacked vertically:
   - First section: red background (#ff4444), white text saying "RED SECTION"
   - Second section: blue background (#4444ff), white text saying "BLUE SECTION"  
   - Third section: green background (#44ff44), white text saying "GREEN SECTION"
3. Each section should be 200px tall
4. Text should be centered both horizontally and vertically
5. Use inline CSS in the <style> tag
6. Font should be Arial, 24px, bold

Return ONLY the complete HTML code, no explanations.`;

    const htmlResponse = await llmClient.sendAndReceiveResponse(
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.3,
        maxTokens: 1000
      }
    );
    
    console.log('LLM generated HTML successfully');
    
    // Save HTML file
    const htmlPath = path.join(testDir, 'index.html');
    await fs.writeFile(htmlPath, htmlResponse);
    console.log(`HTML saved to: ${htmlPath}`);
    
    // Step 3: Generate simple server with LLM
    console.log('\n--- Step 3: Generating Server Code ---');
    
    const serverPrompt = `Generate a simple Node.js HTTP server that:
1. Serves the index.html file from the current directory
2. Listens on port 8082
3. Logs "Server running on port 8082" when started
4. Handles errors gracefully

Use require() syntax. Return ONLY the JavaScript code, no explanations.`;

    const serverCode = await llmClient.sendAndReceiveResponse(
      [{ role: 'user', content: serverPrompt }],
      {
        temperature: 0.3,
        maxTokens: 500
      }
    );
    
    const serverPath = path.join(testDir, 'server.js');
    await fs.writeFile(serverPath, serverCode);
    console.log('Server code generated and saved');
    
    // Step 4: Start the server
    console.log('\n--- Step 4: Starting HTTP Server ---');
    
    serverProcess = spawn('node', ['server.js'], {
      cwd: testDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Wait for server to start
    await new Promise((resolve) => {
      serverProcess.stdout.on('data', (data) => {
        console.log(`Server: ${data}`);
        if (data.toString().includes('8082')) {
          resolve();
        }
      });
      
      serverProcess.stderr.on('data', (data) => {
        console.error(`Server Error: ${data}`);
      });
      
      // Timeout fallback
      setTimeout(resolve, 2000);
    });
    
    console.log('Server started successfully');
    
    // Step 5: Take screenshot with Playwright
    console.log('\n--- Step 5: Taking Screenshot ---');
    
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://localhost:8082', { waitUntil: 'networkidle' });
    
    // Take screenshot
    const screenshotPath = path.join(testDir, 'webpage-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Copy to permanent location
    const permanentDir = path.join(process.cwd(), 'test-screenshots');
    await fs.mkdir(permanentDir, { recursive: true });
    const permanentPath = path.join(permanentDir, 'simple-llm-webpage.png');
    await fs.copyFile(screenshotPath, permanentPath);
    
    console.log(`✅ Screenshot saved to: ${permanentPath}`);
    
    await browser.close();
    
    // Step 6: Verify and display result
    console.log('\n--- Step 6: Verification ---');
    
    const stats = await fs.stat(permanentPath);
    expect(stats.size).toBeGreaterThan(0);
    
    console.log('\n🎉 Successfully generated web page with LLM and captured screenshot!');
    console.log(`📸 View the screenshot at: ${permanentPath}`);
    
    // Also save the generated HTML for reference
    const htmlCopyPath = path.join(permanentDir, 'simple-llm-webpage.html');
    await fs.copyFile(htmlPath, htmlCopyPath);
    console.log(`📄 HTML saved to: ${htmlCopyPath}`);
  });
});

// Quick mock test
describe('Mock Simple Web Page', () => {
  test('Verify test setup', () => {
    expect(true).toBe(true);
    console.log('Test framework is working');
  });
});