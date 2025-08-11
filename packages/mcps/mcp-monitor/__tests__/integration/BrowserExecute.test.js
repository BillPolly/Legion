/**
 * Comprehensive tests for browser_execute tool
 * Tests direct Puppeteer command execution through MCP
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { MCPClient } from '../../mcp-client.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Browser Execute Tool', () => {
  let client;
  let serverProcess;
  const testPort = 3017;
  const sessionId = 'browser-execute-test';
  
  beforeAll(async () => {
    // Start MCP server
    console.log('Starting MCP server...');
    serverProcess = spawn('node', ['mcp-server.js'], {
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Initialize MCP client
    client = new MCPClient();
    await client.connect('node', ['mcp-server.js']);
    await client.initialize({ name: 'test-client', version: '1.0.0' });
    client.sendNotification('notifications/initialized');
    
    // Start test server
    console.log('Starting test HTML server...');
    await client.callTool('start_server', {
      script: path.join(__dirname, '../apps/html-server.js'),
      wait_for_port: testPort,
      session_id: sessionId,
      log_level: 'info'
    });
    
    // Open browser page
    console.log('Opening browser page...');
    await client.callTool('open_page', {
      url: `http://localhost:${testPort}`,
      session_id: sessionId,
      headless: true  // Use headless for tests
    });
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 30000);
  
  afterAll(async () => {
    try {
      // Stop the test app
      await client.callTool('stop_app', { session_id: sessionId });
      
      // Disconnect client
      await client.disconnect();
      
      // Kill server process
      if (serverProcess) {
        serverProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });
  
  afterEach(async () => {
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  });
  
  describe('Basic Navigation', () => {
    it('should get page title', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'title',
        session_id: sessionId
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Command returned: "Full-Stack Monitor Demo"');
    });
    
    it('should get page URL', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'url',
        session_id: sessionId
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain(`http://localhost:${testPort}/`);
    });
    
    it('should reload the page', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'reload',
        session_id: sessionId
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('✅ Executed: page.reload()');
    });
  });
  
  describe('Element Interaction', () => {
    it('should click a button', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'click',
        args: ['#test-btn'],
        session_id: sessionId
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('✅ Executed: page.click("#test-btn")');
    });
    
    it('should type into an input field', async () => {
      // First clear any existing text
      await client.callTool('browser_execute', {
        command: 'evaluate',
        args: ['() => document.querySelector("#name-input") ? document.querySelector("#name-input").value = "" : null'],
        session_id: sessionId
      });
      
      // Type new text
      const result = await client.callTool('browser_execute', {
        command: 'type',
        args: ['#name-input', 'Test User'],
        session_id: sessionId
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('✅ Executed: page.type("#name-input", "Test User")');
      
      // Verify the text was typed
      const checkResult = await client.callTool('browser_execute', {
        command: 'evaluate',
        args: ['() => document.querySelector("#name-input") ? document.querySelector("#name-input").value : null'],
        session_id: sessionId
      });
      
      expect(checkResult.content[0].text).toContain('Command returned: "Test User"');
    });
    
    it('should wait for selector', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'waitForSelector',
        args: ['#test-btn', { timeout: 5000 }],
        session_id: sessionId
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('✅ Executed');
    });
  });
  
  describe('Page Evaluation', () => {
    it('should evaluate JavaScript on the page', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'evaluate',
        args: ['() => document.title'],
        session_id: sessionId
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Command returned: "Full-Stack Monitor Demo"');
    });
    
    it('should evaluate with parameters', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'evaluate',
        args: ['(x, y) => x + y', 5, 10],
        session_id: sessionId
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Command returned: 15');
    });
    
    it('should get page content', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'content',
        session_id: sessionId
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('<!DOCTYPE html>');
      expect(result.content[0].text).toContain('Full-Stack Monitor Demo');
    });
  });
  
  describe('Advanced Commands', () => {
    it('should take a screenshot', async () => {
      const screenshotPath = path.join(__dirname, 'test-screenshot.png');
      
      // Remove if exists
      if (fs.existsSync(screenshotPath)) {
        fs.unlinkSync(screenshotPath);
      }
      
      const result = await client.callTool('browser_execute', {
        command: 'screenshot',
        args: [{ path: screenshotPath }],
        session_id: sessionId
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Command returned: Buffer');
      
      // Verify file was created
      expect(fs.existsSync(screenshotPath)).toBe(true);
      
      // Clean up
      fs.unlinkSync(screenshotPath);
    });
    
    it('should get cookies', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'cookies',
        session_id: sessionId
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Command returned array');
    });
    
    it('should get viewport', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'viewport',
        session_id: sessionId
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('"width":');
      expect(result.content[0].text).toContain('"height":');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid command gracefully', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'invalidCommand',
        session_id: sessionId
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid command: "invalidCommand"');
      expect(result.content[0].text).toContain('Common commands:');
    });
    
    it('should handle missing selector', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'click',
        args: ['#non-existent-element'],
        session_id: sessionId
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Command failed');
      expect(result.content[0].text).toContain('No element found for selector');
    });
    
    it('should handle timeout errors', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'waitForSelector',
        args: ['#never-appears', { timeout: 1000 }],
        session_id: sessionId
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Command failed');
    }, 5000);
    
    it('should handle evaluate errors', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'evaluate',
        args: ['() => { throw new Error("Test error"); }'],
        session_id: sessionId
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Command failed');
    });
  });
  
  describe('Session Management', () => {
    it('should fail when no session exists', async () => {
      const result = await client.callTool('browser_execute', {
        command: 'title',
        session_id: 'non-existent-session'
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No active session');
    });
    
    it('should fail when no browser is open', async () => {
      // Start a new session without opening browser
      const newSessionId = 'no-browser-session';
      await client.callTool('start_server', {
        script: path.join(__dirname, '../apps/simple-server.js'),
        wait_for_port: 3018,
        session_id: newSessionId,
        log_level: 'info'
      });
      
      const result = await client.callTool('browser_execute', {
        command: 'title',
        session_id: newSessionId
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No browser open');
      
      // Clean up
      await client.callTool('stop_app', { session_id: newSessionId });
    });
  });
  
  describe('Complex Workflows', () => {
    it('should execute a sequence of commands', async () => {
      // Navigate to test endpoint
      const gotoResult = await client.callTool('browser_execute', {
        command: 'goto',
        args: [`http://localhost:${testPort}/test`],
        session_id: sessionId
      });
      expect(gotoResult.isError).toBeFalsy();
      
      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the response text
      const textResult = await client.callTool('browser_execute', {
        command: 'evaluate',
        args: ['() => document.body.textContent'],
        session_id: sessionId
      });
      expect(textResult.isError).toBeFalsy();
      expect(textResult.content[0].text).toContain('Test endpoint reached');
      
      // Go back
      const backResult = await client.callTool('browser_execute', {
        command: 'goBack',
        session_id: sessionId
      });
      expect(backResult.isError).toBeFalsy();
      
      // Verify we're back on main page
      const titleResult = await client.callTool('browser_execute', {
        command: 'title',
        session_id: sessionId
      });
      expect(titleResult.content[0].text).toContain('Full-Stack Monitor Demo');
    });
    
    it('should interact with forms', async () => {
      // Fill out a form
      await client.callTool('browser_execute', {
        command: 'type',
        args: ['#name-input', 'John Doe'],
        session_id: sessionId
      });
      
      // Click submit
      await client.callTool('browser_execute', {
        command: 'click',
        args: ['#error-btn'],  // Using error button as submit for testing
        session_id: sessionId
      });
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check logs to verify form submission generated logs
      const logs = await client.callTool('query_logs', {
        session_id: sessionId,
        last: '10s',
        query: 'error'
      });
      
      expect(logs.isError).toBeFalsy();
      // Logs should contain error from clicking error button
    });
  });
});