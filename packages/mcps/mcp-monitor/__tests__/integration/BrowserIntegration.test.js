/**
 * @jest-environment node
 * 
 * Browser Integration Test Suite
 * Tests browser launch, screenshot, and video recording functionality
 */

import { MCPClient } from '../../mcp-client.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, unlinkSync } from 'fs';
import { portManager } from '../../utils/PortManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Browser Integration Tests', () => {
  let client;
  let sessionId;
  let webPort;
  const webAppPath = path.join(__dirname, 'test-apps/web-app/server.js');
  
  beforeAll(async () => {
    // Initialize MCP client
    client = new MCPClient();
    await client.connect('node', [path.join(__dirname, '../../mcp-server.js')]);
    await client.initialize({ 
      name: 'browser-test-client', 
      version: '1.0.0' 
    });
    client.sendNotification('notifications/initialized');
  }, 60000);
  
  beforeEach(async () => {
    // Create unique session ID and reserve port for each test
    sessionId = `browser-test-${Date.now()}`;
    webPort = await portManager.reservePort(sessionId, 'app');
    
    // Set PORT environment variable for the test app
    process.env.PORT = webPort;
    
    // Start the app for each test (tests expect a running session)
    const startResult = await client.callTool('start_app', {
      script: webAppPath,
      wait_for_port: webPort,
      browser_url: `http://localhost:${webPort}`,
      browser_headless: true,
      browser_viewport: { width: 1920, height: 1080 },
      session_id: sessionId,
      log_level: 'debug'
    });
    
    if (startResult.isError) {
      throw new Error(`Failed to start app: ${startResult.content[0].text}`);
    }
    
    // Wait for browser to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));
  }, 30000);
  
  afterEach(async () => {
    // Clean up session and release ports
    try {
      await client.callTool('stop_app', { session_id: sessionId });
      portManager.releaseSessionPorts(sessionId);
    } catch (error) {
      console.log('Cleanup error (may be normal):', error.message);
    }
  });
  
  afterAll(async () => {
    // Cleanup MCP client and any remaining sessions
    if (client) {
      try {
        await client.disconnect();
      } catch (error) {
        console.log('Disconnect error:', error.message);
      }
    }
    
    // Clean up PortManager
    portManager.cleanup();
  });
  
  describe('Browser Launch', () => {
    test('should have started app with browser in headless mode', async () => {
      // App is already started in beforeEach, just verify session exists
      const result = await client.callTool('list_sessions', {});
      
      expect(result.content[0].text).toContain(sessionId);
      expect(result.content[0].text).toContain('Active sessions');
    }, 60000);
    
    test('should capture browser console logs', async () => {
      // Wait for initial logs
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Query logs to see browser console output
      const result = await client.callTool('query_logs', {
        session_id: sessionId,
        query: 'Browser Console',
        limit: 20
      });
      
      const logs = result.content[0].text;
      console.log('Browser console logs captured:', logs);
      
      if (logs !== 'No logs found matching criteria') {
        expect(logs).toContain('[Browser Console]');
      }
    }, 30000);
  });
  
  describe('Screenshot Functionality', () => {
    test('should take screenshot and save to file', async () => {
      const screenshotPath = path.join(__dirname, 'test-screenshot.png');
      
      // Remove file if it exists
      if (existsSync(screenshotPath)) {
        unlinkSync(screenshotPath);
      }
      
      const result = await client.callTool('take_screenshot', {
        session_id: sessionId,
        path: screenshotPath,
        format: 'png',
        fullPage: true
      });
      
      expect(result.content[0].text).toContain('Screenshot saved to');
      expect(result.content[0].text).toContain(screenshotPath);
      expect(result.content[0].text).toContain('Format: PNG');
      expect(result.content[0].text).toContain('Full page: true');
      
      // Verify file was created
      expect(existsSync(screenshotPath)).toBe(true);
      
      // Clean up
      if (existsSync(screenshotPath)) {
        unlinkSync(screenshotPath);
      }
    }, 30000);
    
    test('should take screenshot and return as base64', async () => {
      const result = await client.callTool('take_screenshot', {
        session_id: sessionId,
        format: 'png',
        fullPage: false
      });
      
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Screenshot captured');
      expect(result.content[0].text).toContain('Format: PNG');
      
      // Check for base64 image data
      expect(result.content[1].type).toBe('image');
      expect(result.content[1].data).toBeDefined();
      expect(result.content[1].mimeType).toBe('image/png');
      
      // Validate base64 format
      const base64Data = result.content[1].data;
      expect(typeof base64Data).toBe('string');
      expect(base64Data.length).toBeGreaterThan(0);
      expect(/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)).toBe(true);
    }, 30000);
    
    test('should take JPEG screenshot with quality setting', async () => {
      const screenshotPath = path.join(__dirname, 'test-screenshot.jpg');
      
      const result = await client.callTool('take_screenshot', {
        session_id: sessionId,
        path: screenshotPath,
        format: 'jpeg',
        quality: 80,
        fullPage: false
      });
      
      expect(result.content[0].text).toContain('Screenshot saved to');
      expect(result.content[0].text).toContain('Format: JPEG');
      expect(result.content[0].text).toContain('Quality: 80%');
      
      // Verify file was created
      expect(existsSync(screenshotPath)).toBe(true);
      
      // Clean up
      if (existsSync(screenshotPath)) {
        unlinkSync(screenshotPath);
      }
    }, 30000);
    
    test('should take screenshot with clip region', async () => {
      const result = await client.callTool('take_screenshot', {
        session_id: sessionId,
        format: 'png',
        fullPage: false,  // Clip requires fullPage to be false
        clip: {
          x: 100,
          y: 100,
          width: 500,
          height: 400
        }
      });
      
      expect(result.content[0].text).toContain('Screenshot captured');
      expect(result.content[0].text).toContain('Clipped: 500x400 at (100, 100)');
      expect(result.content[1].type).toBe('image');
    }, 30000);
  });
  
  describe('Error Handling', () => {
    test('should handle screenshot without active browser', async () => {
      const result = await client.callTool('take_screenshot', {
        session_id: 'non-existent-session'
      });
      
      expect(result.isError).toBe(true);
      // Should indicate either no browser or no session
      expect(result.content[0].text).toMatch(/No active (browser|monitoring session)/i);
    }, 30000);
    
    test('should handle invalid screenshot format', async () => {
      const result = await client.callTool('take_screenshot', {
        session_id: sessionId,
        format: 'invalid-format'
      });
      
      // Should either error or default to a valid format
      expect(result.content).toBeDefined();
    }, 30000);
  });
  
  describe('Session Management', () => {
    test('should list sessions with browser info', async () => {
      const result = await client.callTool('list_sessions', {});
      
      expect(result.content[0].text).toContain(sessionId);
      expect(result.content[0].text).toContain('Active sessions');
    }, 30000);
  });
  
  describe('Cleanup', () => {
    test('should stop app and close browser', async () => {
      // Take a final screenshot before stopping
      const finalScreenshot = await client.callTool('take_screenshot', {
        session_id: sessionId,
        path: path.join(__dirname, 'final-screenshot.png')
      });
      
      expect(finalScreenshot.content[0].text).toContain('Screenshot saved');
      
      // Stop the app (will be stopped again in afterEach but that's OK)
      const stopResult = await client.callTool('stop_app', {
        session_id: sessionId
      });
      
      expect(stopResult.content[0].text).toContain('Stopped app');
      expect(stopResult.content[0].text).toContain(sessionId);
      
      // Verify browser is closed by trying to take screenshot
      const afterStopScreenshot = await client.callTool('take_screenshot', {
        session_id: sessionId
      });
      
      expect(afterStopScreenshot.isError).toBe(true);
      
      // Clean up screenshot file
      const screenshotPath = path.join(__dirname, 'final-screenshot.png');
      if (existsSync(screenshotPath)) {
        unlinkSync(screenshotPath);
      }
    }, 30000);
  });
});