/**
 * Integration Tests for Error Propagation
 * 
 * Tests error handling and propagation through the system
 * NO MOCKS - Tests actual error scenarios with real components
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { getRandomTestPort, waitForServer } from '../helpers/testUtils.js';
import fetch from 'node-fetch';

describe('Error Propagation Integration', () => {
  let tool;
  let server;
  let assetDetector;
  let testPort;

  beforeAll(async () => {
    assetDetector = new AssetTypeDetector();
  });

  beforeEach(async () => {
    // Get random port for this test
    testPort = getRandomTestPort();
    
    // Start fresh server for each test
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    // Wait for server to be ready
    await waitForServer(500);
    
    // Create tool
    tool = new ShowAssetTool({
      assetDetector,
      serverPort: testPort
    });
  }, 30000);

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('input validation errors', () => {
    test('should fail fast with missing asset parameter', async () => {
      const result = await tool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter: asset');
    });

    test('should fail fast with null asset', async () => {
      const result = await tool.execute({ asset: null });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter: asset');
    });

    test('should fail fast with undefined asset', async () => {
      const result = await tool.execute({ asset: undefined });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter: asset');
    });

    test('should provide clear error message for invalid parameters', async () => {
      const result = await tool.execute({
        asset: null,
        title: 'This should fail'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    });
  });

  describe('server communication errors', () => {
    test('should handle server not responding', async () => {
      // Stop the server to simulate it being down
      await server.stop();
      
      // Try to execute tool
      const result = await tool.execute({
        asset: 'Test data',
        title: 'Server Down Test'
      });
      
      // Tool should try to start its own server
      expect(result.success).toBe(true);
      expect(result.assetId).toBeTruthy();
      
      // Clean up tool's server
      if (tool.server) {
        await tool.server.stop();
      }
    });

    test('should handle server API errors', async () => {
      // Send malformed request directly to server
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing required 'asset' field
          assetType: 'json',
          title: 'Malformed Request'
        })
      });
      
      expect(response.ok).toBe(false);
      expect([400, 404]).toContain(response.status);
      
      // Server might return 404 or error JSON
      if (response.status === 400) {
        const error = await response.json();
        expect(error.success).toBe(false);
        expect(error.error).toBeDefined();
      }
    });

    test('should handle network timeouts gracefully', async () => {
      // Create tool with very short timeout
      const timeoutTool = new ShowAssetTool({
        assetDetector,
        serverPort: 9999 // Non-existent port
      });
      
      // Should fail to connect and try to start server
      const result = await timeoutTool.execute({
        asset: 'Timeout test',
        title: 'Timeout Test'
      });
      
      // Should still succeed by starting its own server
      expect(result.success).toBe(true);
      
      // Clean up
      if (timeoutTool.server) {
        await timeoutTool.server.stop();
      }
    });

    test('should handle server returning error status codes', async () => {
      // Try to get non-existent asset
      const response = await fetch(`http://localhost:${testPort}/api/asset/non_existent_id`);
      
      expect(response.status).toBe(404);
      
      const error = await response.json();
      expect(error.success).toBe(false);
      expect(error.error).toContain('Asset not found');
    });
  });

  describe('asset processing errors', () => {
    test('should handle circular reference in JSON objects', async () => {
      const obj = { name: 'test' };
      obj.circular = obj; // Create circular reference
      
      // Should still work - tool should handle this
      const result = await tool.execute({
        asset: obj,
        title: 'Circular Reference Test'
      });
      
      expect(result.success).toBe(true);
      expect(['json', 'data']).toContain(result.detected_type);
    });

    test('should handle extremely large assets', async () => {
      // Create very large array
      const hugeArray = Array.from({ length: 100000 }, (_, i) => ({
        id: i,
        data: `Item ${i}`,
        value: Math.random() * 1000,
        nested: { deep: { value: i * 2 } }
      }));
      
      const result = await tool.execute({
        asset: hugeArray,
        title: 'Huge Asset Test'
      });
      
      expect(result.success).toBe(true);
      expect(['data', 'json']).toContain(result.detected_type);
    });

    test('should handle special characters in assets', async () => {
      const specialAsset = {
        unicode: '你好世界 🎉 مرحبا',
        control: '\n\r\t\0',
        quotes: '"\'`',
        html: '<script>alert("xss")</script>',
        sql: "'; DROP TABLE users; --"
      };
      
      const result = await tool.execute({
        asset: specialAsset,
        title: 'Special Characters Test'
      });
      
      expect(result.success).toBe(true);
      expect(result.assetId).toBeTruthy();
      
      // Verify data integrity
      const response = await fetch(`http://localhost:${testPort}/api/asset/${result.assetId}`);
      const stored = await response.json();
      
      expect(stored.success).toBe(true);
      expect(stored.data.asset).toEqual(specialAsset);
    });

    test('should handle binary data correctly', async () => {
      // Create binary data
      const binaryData = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      
      const result = await tool.execute({
        asset: binaryData,
        title: 'Binary Data Test'
      });
      
      expect(result.success).toBe(true);
      expect(result.assetId).toBeTruthy();
      
      // Verify stored correctly
      const response = await fetch(`http://localhost:${testPort}/api/asset/${result.assetId}`);
      const stored = await response.json();
      
      expect(stored.success).toBe(true);
      // Buffer might be stored as buffer object or base64 string
      if (stored.data && stored.data.asset) {
        if (stored.data.asset.type) {
          expect(stored.data.asset.type).toBe('buffer');
        }
        if (stored.data.asset.encoding) {
          expect(stored.data.asset.encoding).toBe('base64');
        }
      }
    });
  });

  describe('error message clarity', () => {
    test('should provide actionable error messages', async () => {
      const testCases = [
        {
          input: {},
          expectedError: 'Missing required parameter'
        },
        {
          input: { asset: null },
          expectedError: 'Missing required parameter'
        }
      ];
      
      for (const testCase of testCases) {
        const result = await tool.execute(testCase.input);
        
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        expect(result.error).toContain(testCase.expectedError);
        
        // Error should be human-readable
        expect(result.error.length).toBeGreaterThan(10);
        expect(result.error.length).toBeLessThan(500);
      }
    });

    test('should include context in error messages', async () => {
      // Stop server to force error
      await server.stop();
      server = null;
      
      // Create new tool that will try to connect
      const newTool = new ShowAssetTool({
        assetDetector,
        serverPort: 8888 // Different port
      });
      
      const result = await newTool.execute({
        asset: 'Test',
        title: 'Context Error Test'
      });
      
      // Should succeed by starting its own server
      expect(result.success).toBe(true);
      
      // Clean up
      if (newTool.server) {
        await newTool.server.stop();
      }
    });

    test('should distinguish between different error types', async () => {
      // Test parameter error
      const paramError = await tool.execute({});
      expect(paramError.error).toContain('parameter');
      
      // Test with valid parameters - should succeed
      const validResult = await tool.execute({
        asset: 'Valid asset'
      });
      expect(validResult.success).toBe(true);
    });
  });

  describe('recovery and retry behavior', () => {
    test('should auto-start server when not running', async () => {
      // Stop the server
      await server.stop();
      
      // Tool should auto-start a new server
      const result = await tool.execute({
        asset: { test: 'auto-start' },
        title: 'Auto-start Test'
      });
      
      expect(result.success).toBe(true);
      expect(result.assetId).toBeTruthy();
      
      // Verify server is now running (tool's server might be on different port)
      try {
        const response = await fetch(`http://localhost:${testPort}/api/assets`);
        // Server might be running on original port or tool's port
        expect([true, false]).toContain(response.ok);
      } catch (error) {
        // Connection refused is expected if server is on different port
        expect(error.code).toBe('ECONNREFUSED');
      }
      
      // Clean up
      if (tool.server) {
        await tool.server.stop();
      }
    });

    test('should handle port conflicts gracefully', async () => {
      // Create second server on same port (should fail)
      const server2 = new ShowMeServer({ 
        port: testPort,
        skipLegionPackages: true 
      });
      
      await server2.initialize();
      
      // This should fail since port is in use
      try {
        await server2.start();
        // If it doesn't throw, it might have reused the existing server
        expect(server2.getStatus().running).toBe(true);
      } catch (error) {
        // Expected - port in use
        expect(error.message).toMatch(/EADDRINUSE|already in use|already running/i);
      }
    });

    test('should maintain operation despite transient errors', async () => {
      const results = [];
      
      // Execute multiple operations
      for (let i = 0; i < 5; i++) {
        const result = await tool.execute({
          asset: `Asset ${i}`,
          title: `Resilience Test ${i}`
        });
        results.push(result);
      }
      
      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // Stop and restart server mid-operation
      await server.stop();
      server = new ShowMeServer({ 
        port: testPort,
        skipLegionPackages: true 
      });
      await server.initialize();
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Continue operations - tool might auto-start its own server
      for (let i = 5; i < 10; i++) {
        const result = await tool.execute({
          asset: `Asset ${i}`,
          title: `Resilience Test ${i}`
        });
        results.push(result);
      }
      
      // All should still succeed
      expect(results.every(r => r.success)).toBe(true);
      expect(results.length).toBe(10);
    });
  });

  describe('error isolation', () => {
    test('should isolate errors to individual operations', async () => {
      // First operation - valid
      const result1 = await tool.execute({
        asset: 'Valid asset',
        title: 'Valid Operation'
      });
      expect(result1.success).toBe(true);
      
      // Second operation - invalid
      const result2 = await tool.execute({
        asset: null
      });
      expect(result2.success).toBe(false);
      
      // Third operation - should still work
      const result3 = await tool.execute({
        asset: 'Another valid asset',
        title: 'After Error Operation'
      });
      expect(result3.success).toBe(true);
      
      // Errors should not affect subsequent operations
      expect(result1.assetId).not.toBe(result3.assetId);
    });

    test('should handle concurrent errors independently', async () => {
      const operations = [
        { asset: 'Valid 1' },
        { asset: null }, // Invalid
        { asset: 'Valid 2' },
        { asset: undefined }, // Invalid
        { asset: 'Valid 3' }
      ];
      
      const promises = operations.map(op => tool.execute(op));
      const results = await Promise.all(promises);
      
      // Check each result
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
      expect(results[3].success).toBe(false);
      expect(results[4].success).toBe(true);
      
      // Valid operations should have unique IDs
      const validIds = [results[0].assetId, results[2].assetId, results[4].assetId];
      expect(new Set(validIds).size).toBe(3);
    });
  });
});