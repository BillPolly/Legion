/**
 * End-to-End Error Scenario Tests - Server Unavailable
 * 
 * Tests system behavior when server is unavailable, unreachable, or fails
 * NO MOCKS - Tests real network failures and error propagation
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { AssetDisplayManager } from '../../src/client/AssetDisplayManager.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import { JSDOM } from 'jsdom';

describe('Server Unavailable Error Scenarios End-to-End', () => {
  let tool;
  let server;
  let clientActor;
  let displayManager;
  let assetDetector;
  let resourceManager;
  let dom;
  let document;
  let window;
  const testPort = 3796;
  const unavailablePort = 3797;

  beforeAll(async () => {
    // Set up virtual DOM
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    document = dom.window.document;
    window = dom.window;
    
    global.document = document;
    global.window = window;
    global.HTMLElement = window.HTMLElement;
    
    // Initialize ResourceManager
    resourceManager = await ResourceManager.getInstance();
    
    // Initialize asset detector
    assetDetector = new AssetTypeDetector();
    
    // Start server for comparison tests
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 30000);

  afterAll(async () => {
    if (clientActor) {
      try {
        await clientActor.disconnect();
        await clientActor.cleanup();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    if (displayManager) {
      try {
        await displayManager.cleanup();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    if (server) {
      await server.stop();
    }
    
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
  });

  describe('tool execution with server unavailable', () => {
    test('should fail fast when server is never started', async () => {
      console.log('🚫 Testing tool with server never started...');
      
      // Create tool pointing to unavailable port
      const unavailableTool = new ShowAssetTool({
        assetDetector,
        serverPort: unavailablePort // Server never started on this port
      });

      const testAsset = { test: 'data', unavailable: true };
      
      const startTime = Date.now();
      const result = await unavailableTool.execute({
        asset: testAsset,
        title: 'Server Unavailable Test'
      });
      const endTime = Date.now();

      // Should fail fast
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/Failed to connect|Connection refused|ECONNREFUSED/i);
      
      // Should not have asset ID or URL
      expect(result.assetId).toBeUndefined();
      expect(result.url).toBeUndefined();
      
      // Should fail quickly (not wait for long timeouts)
      expect(endTime - startTime).toBeLessThan(10000); // Less than 10 seconds
      
      console.log(`✅ Tool failed fast in ${endTime - startTime}ms with error: ${result.error}`);
    });

    test('should fail fast when server port is occupied by non-ShowMe service', async () => {
      console.log('🚫 Testing tool with wrong service on port...');
      
      // Start a basic HTTP server on the unavailable port (not ShowMe server)
      const http = await import('http');
      const wrongServer = http.createServer((req, res) => {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not a ShowMe server');
      });
      
      await new Promise((resolve, reject) => {
        wrongServer.listen(unavailablePort, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const wrongServiceTool = new ShowAssetTool({
        assetDetector,
        serverPort: unavailablePort
      });

      const testAsset = { wrong: 'service', test: true };
      
      const result = await wrongServiceTool.execute({
        asset: testAsset,
        title: 'Wrong Service Test'
      });

      // Should fail because it's not a ShowMe server
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/ShowMe.*server|Invalid.*response|404/i);
      
      // Clean up
      wrongServer.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`✅ Tool detected wrong service: ${result.error}`);
    });

    test('should handle server startup during tool execution', async () => {
      console.log('🚫 Testing tool execution during server startup...');
      
      // Create tool pointing to port where server will start
      const startupTool = new ShowAssetTool({
        assetDetector,
        serverPort: unavailablePort
      });

      const testAsset = { startup: 'test', timing: true };
      
      // Start tool execution when server is not yet started
      const executionPromise = startupTool.execute({
        asset: testAsset,
        title: 'Startup Timing Test'
      });
      
      // Start server after a delay
      setTimeout(async () => {
        const delayedServer = new ShowMeServer({ 
          port: unavailablePort,
          skipLegionPackages: true 
        });
        await delayedServer.initialize();
        await delayedServer.start();
        
        // Clean up after test
        setTimeout(async () => {
          await delayedServer.stop();
        }, 2000);
      }, 1000);

      const result = await executionPromise;
      
      // Should fail because server wasn't available when tool executed
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      
      console.log(`✅ Tool handled startup timing: ${result.success ? 'SUCCESS' : 'FAILED AS EXPECTED'}`);
    });
  });

  describe('server shutdown during operations', () => {
    test('should handle server shutdown after asset upload but before display', async () => {
      console.log('🚫 Testing server shutdown between upload and display...');
      
      // Create tool with working server
      const workingTool = new ShowAssetTool({
        assetDetector,
        serverPort: testPort
      });

      const testAsset = { 
        shutdown: 'test', 
        data: Array(100).fill(0).map((_, i) => ({ id: i, value: `item-${i}` }))
      };
      
      // Upload asset successfully
      const uploadResult = await workingTool.execute({
        asset: testAsset,
        title: 'Shutdown Test Asset'
      });

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.assetId).toBeTruthy();
      
      console.log('✅ Asset uploaded successfully');

      // Now shut down the server
      await server.stop();
      console.log('✅ Server stopped');
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to create client actor and display asset
      try {
        displayManager = new AssetDisplayManager({
          serverUrl: `http://localhost:${testPort}`,
          wsUrl: `ws://localhost:${testPort}/showme`,
          container: document.getElementById('app')
        });
        await displayManager.initialize();
        
        clientActor = new ShowMeClientActor({
          serverUrl: `ws://localhost:${testPort}/showme`,
          displayManager: displayManager
        });
        
        // This should fail
        await expect(clientActor.initialize()).rejects.toThrow();
        console.log('✅ Client actor initialization failed as expected');
        
      } catch (error) {
        // Expected - client should not be able to connect
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/connect|refused|unavailable/i);
        console.log(`✅ Client connection failed as expected: ${error.message}`);
      }
      
      // Restart server for other tests
      server = new ShowMeServer({ 
        port: testPort,
        skipLegionPackages: true 
      });
      await server.initialize();
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    test('should handle server shutdown during active display session', async () => {
      console.log('🚫 Testing server shutdown during active session...');
      
      // Set up complete working system
      displayManager = new AssetDisplayManager({
        serverUrl: `http://localhost:${testPort}`,
        wsUrl: `ws://localhost:${testPort}/showme`,
        container: document.getElementById('app')
      });
      await displayManager.initialize();
      
      clientActor = new ShowMeClientActor({
        serverUrl: `ws://localhost:${testPort}/showme`,
        displayManager: displayManager
      });
      await clientActor.initialize();
      await clientActor.connect();
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Upload and display asset
      const workingTool = new ShowAssetTool({
        assetDetector,
        serverPort: testPort
      });

      const activeAsset = { active: 'session', data: 'test content' };
      
      const result = await workingTool.execute({
        asset: activeAsset,
        title: 'Active Session Test'
      });

      expect(result.success).toBe(true);
      
      // Display asset
      await clientActor.displayAsset(result.assetId, {
        width: 400,
        height: 300
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify display is working
      const activeWindow = document.querySelector(`[data-asset-id="${result.assetId}"]`);
      expect(activeWindow).toBeTruthy();
      
      console.log('✅ Asset displayed successfully');
      
      // Now shut down server during active session
      await server.stop();
      console.log('✅ Server stopped during active session');
      
      // Wait for connection to be detected as lost
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to display another asset (should fail)
      try {
        await clientActor.displayAsset('fake-asset-id', {
          width: 200,
          height: 200
        });
        
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected - connection should be lost
        expect(error).toBeTruthy();
        console.log(`✅ Display failed as expected after server shutdown: ${error.message}`);
      }
      
      // The existing window should still be visible (client-side)
      const existingWindow = document.querySelector(`[data-asset-id="${result.assetId}"]`);
      expect(existingWindow).toBeTruthy();
      console.log('✅ Existing window remains visible after server shutdown');
      
      // Clean up
      await clientActor.disconnect();
      await clientActor.cleanup();
      await displayManager.cleanup();
      clientActor = null;
      displayManager = null;
      
      // Restart server
      server = new ShowMeServer({ 
        port: testPort,
        skipLegionPackages: true 
      });
      await server.initialize();
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 1000));
    });
  });

  describe('network connectivity issues', () => {
    test('should handle network timeout scenarios', async () => {
      console.log('🚫 Testing network timeout scenarios...');
      
      // Create tool with very long timeout to simulate network issues
      const timeoutTool = new ShowAssetTool({
        assetDetector,
        serverPort: 99999, // Invalid port that will cause timeout
        timeout: 2000 // 2 second timeout
      });

      const testAsset = { timeout: 'test', large: 'data' };
      
      const startTime = Date.now();
      const result = await timeoutTool.execute({
        asset: testAsset,
        title: 'Network Timeout Test'
      });
      const endTime = Date.now();

      // Should fail due to timeout
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/timeout|connect|refused/i);
      
      // Should respect timeout settings
      expect(endTime - startTime).toBeLessThan(15000); // Should timeout reasonably quickly
      
      console.log(`✅ Network timeout handled in ${endTime - startTime}ms: ${result.error}`);
    });

    test('should handle malformed server responses', async () => {
      console.log('🚫 Testing malformed server responses...');
      
      // Start a server that returns malformed responses
      const http = await import('http');
      const malformedServer = http.createServer((req, res) => {
        if (req.url.includes('/api/assets')) {
          // Return malformed JSON
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{ invalid json response }');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Malformed server');
        }
      });
      
      await new Promise((resolve, reject) => {
        malformedServer.listen(unavailablePort, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const malformedTool = new ShowAssetTool({
        assetDetector,
        serverPort: unavailablePort
      });

      const testAsset = { malformed: 'response', test: true };
      
      const result = await malformedTool.execute({
        asset: testAsset,
        title: 'Malformed Response Test'
      });

      // Should fail due to malformed response
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/invalid|malformed|json|parse/i);
      
      // Clean up
      malformedServer.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`✅ Malformed response handled: ${result.error}`);
    });
  });

  describe('partial system failures', () => {
    test('should handle WebSocket connection failures with HTTP working', async () => {
      console.log('🚫 Testing WebSocket failure with HTTP working...');
      
      // Tool should work (HTTP)
      const httpTool = new ShowAssetTool({
        assetDetector,
        serverPort: testPort
      });

      const testAsset = { websocket: 'failure', http: 'working' };
      
      // Upload via HTTP should work
      const uploadResult = await httpTool.execute({
        asset: testAsset,
        title: 'WebSocket Failure Test'
      });

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.assetId).toBeTruthy();
      
      // Now create a display manager with wrong WebSocket URL
      displayManager = new AssetDisplayManager({
        serverUrl: `http://localhost:${testPort}`, // HTTP works
        wsUrl: `ws://localhost:${unavailablePort}/showme`, // WebSocket fails
        container: document.getElementById('app')
      });
      
      try {
        await displayManager.initialize();
        console.log('✅ Display manager created with wrong WebSocket URL');
        
        clientActor = new ShowMeClientActor({
          serverUrl: `ws://localhost:${unavailablePort}/showme`, // Wrong URL
          displayManager: displayManager
        });
        
        // This should fail
        await expect(clientActor.initialize()).rejects.toThrow();
        console.log('✅ Client actor failed to connect to WebSocket as expected');
        
      } catch (error) {
        // Expected - WebSocket connection should fail
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/connect|websocket|refused/i);
        console.log(`✅ WebSocket connection failed as expected: ${error.message}`);
      }
      
      // Clean up
      if (clientActor) {
        try {
          await clientActor.cleanup();
        } catch (e) {}
        clientActor = null;
      }
      if (displayManager) {
        try {
          await displayManager.cleanup();
        } catch (e) {}
        displayManager = null;
      }
    });

    test('should handle resource loading failures', async () => {
      console.log('🚫 Testing resource loading failures...');
      
      // Create a working system first
      displayManager = new AssetDisplayManager({
        serverUrl: `http://localhost:${testPort}`,
        wsUrl: `ws://localhost:${testPort}/showme`,
        container: document.getElementById('app')
      });
      await displayManager.initialize();
      
      clientActor = new ShowMeClientActor({
        serverUrl: `ws://localhost:${testPort}/showme`,
        displayManager: displayManager
      });
      await clientActor.initialize();
      await clientActor.connect();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to display an asset that doesn't exist
      try {
        await clientActor.displayAsset('non-existent-asset-id', {
          width: 400,
          height: 300
        });
        
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Expected - asset doesn't exist
        expect(error).toBeTruthy();
        console.log(`✅ Non-existent asset handled: ${error.message}`);
      }
      
      // Clean up
      await clientActor.disconnect();
      await clientActor.cleanup();
      await displayManager.cleanup();
      clientActor = null;
      displayManager = null;
    });
  });

  describe('error message quality', () => {
    test('should provide clear, actionable error messages', async () => {
      console.log('🚫 Testing error message quality...');
      
      const scenarios = [
        {
          name: 'Server not started',
          port: unavailablePort,
          expectedPattern: /connect|refused|unavailable/i
        },
        {
          name: 'Invalid port',
          port: 99999,
          expectedPattern: /connect|refused|invalid/i
        },
        {
          name: 'Negative port',
          port: -1,
          expectedPattern: /invalid|port/i
        }
      ];

      for (const scenario of scenarios) {
        console.log(`  Testing: ${scenario.name}`);
        
        const errorTool = new ShowAssetTool({
          assetDetector,
          serverPort: scenario.port
        });

        const result = await errorTool.execute({
          asset: { error: 'test' },
          title: `Error Test: ${scenario.name}`
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        expect(result.error).toMatch(scenario.expectedPattern);
        
        // Error message should be informative
        expect(result.error.length).toBeGreaterThan(10);
        expect(result.error).not.toMatch(/undefined|null|\[object/i);
        
        console.log(`    ✅ Error: ${result.error.substring(0, 80)}...`);
      }
    });

    test('should include relevant context in error messages', async () => {
      console.log('🚫 Testing error context inclusion...');
      
      const contextTool = new ShowAssetTool({
        assetDetector,
        serverPort: unavailablePort
      });

      const result = await contextTool.execute({
        asset: { context: 'test', important: 'data' },
        title: 'Context Error Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      
      // Error should include port information for debugging
      expect(result.error).toMatch(new RegExp(unavailablePort.toString()));
      
      console.log(`✅ Error includes context: ${result.error}`);
    });
  });

  describe('error recovery scenarios', () => {
    test('should handle server recovery after failures', async () => {
      console.log('🚫 Testing server recovery scenarios...');
      
      // First, fail with server unavailable
      const recoveryTool = new ShowAssetTool({
        assetDetector,
        serverPort: unavailablePort
      });

      const failResult = await recoveryTool.execute({
        asset: { recovery: 'test', phase: 'fail' },
        title: 'Recovery Test - Fail'
      });

      expect(failResult.success).toBe(false);
      console.log('✅ Initial failure confirmed');
      
      // Start server on the unavailable port
      const recoveryServer = new ShowMeServer({ 
        port: unavailablePort,
        skipLegionPackages: true 
      });
      await recoveryServer.initialize();
      await recoveryServer.start();
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now the same tool should work
      const successResult = await recoveryTool.execute({
        asset: { recovery: 'test', phase: 'success' },
        title: 'Recovery Test - Success'
      });

      expect(successResult.success).toBe(true);
      expect(successResult.assetId).toBeTruthy();
      
      console.log('✅ Server recovery successful');
      
      // Clean up
      await recoveryServer.stop();
    });
  });
});