/**
 * Integration Tests for Tool-Server Interaction
 * 
 * Tests real communication between ShowAssetTool and ShowMeServer
 * NO MOCKS - Tests actual HTTP communication and server behavior
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import fetch from 'node-fetch';

describe('Tool-Server Interaction Integration', () => {
  let tool;
  let server;
  let assetDetector;
  const testPort = 3798;

  beforeAll(async () => {
    // Start real server
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create tool with real dependencies
    assetDetector = new AssetTypeDetector();
    tool = new ShowAssetTool({
      assetDetector,
      serverPort: testPort
    });
  }, 30000);

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('server lifecycle management', () => {
    test('should verify server is running before sending assets', async () => {
      // Server should already be running from beforeAll
      const response = await fetch(`http://localhost:${testPort}/api/assets`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.assets)).toBe(true);
    });

    test('should handle server startup when not running', async () => {
      // Create a new tool instance with different port
      const newTool = new ShowAssetTool({
        assetDetector,
        serverPort: 3797
      });
      
      // Execute should start server automatically
      const result = await newTool.execute({
        asset: { test: 'data' },
        title: 'Auto-started server test'
      });
      
      expect(result.success).toBe(true);
      expect(result.window_id).toBeTruthy();
      
      // Clean up the new server
      if (newTool.server) {
        await newTool.server.stop();
      }
    });
  });

  describe('asset transmission', () => {
    test('should transmit JSON objects to server', async () => {
      const testData = {
        name: 'Test Object',
        value: 123,
        nested: { key: 'value' }
      };
      
      const result = await tool.execute({
        asset: testData,
        title: 'JSON Transmission Test'
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('json');
      expect(result.assetId).toBeTruthy();
      
      // Verify asset is stored on server
      const response = await fetch(`http://localhost:${testPort}/api/asset/${result.assetId}`);
      const stored = await response.json();
      
      expect(stored.success).toBe(true);
      expect(stored.data.asset).toEqual(testData);
      expect(stored.data.assetType).toBe('json');
    });

    test('should transmit text strings to server', async () => {
      const testText = 'This is a test string for transmission';
      
      const result = await tool.execute({
        asset: testText,
        title: 'Text Transmission Test'
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('text');
      expect(result.assetId).toBeTruthy();
      
      // Verify on server
      const response = await fetch(`http://localhost:${testPort}/api/asset/${result.assetId}`);
      const stored = await response.json();
      
      expect(stored.success).toBe(true);
      expect(stored.data.asset).toBe(testText);
    });

    test('should transmit Buffer data to server', async () => {
      const testBuffer = Buffer.from('Binary data test', 'utf8');
      
      const result = await tool.execute({
        asset: testBuffer,
        title: 'Buffer Transmission Test'
      });
      
      expect(result.success).toBe(true);
      expect(result.assetId).toBeTruthy();
      
      // Verify on server
      const response = await fetch(`http://localhost:${testPort}/api/asset/${result.assetId}`);
      const stored = await response.json();
      
      expect(stored.success).toBe(true);
      expect(stored.data.asset.type).toBe('buffer');
      expect(stored.data.asset.encoding).toBe('base64');
    });

    test('should transmit arrays as data tables', async () => {
      const testArray = [
        { id: 1, name: 'Item 1', value: 100 },
        { id: 2, name: 'Item 2', value: 200 },
        { id: 3, name: 'Item 3', value: 300 }
      ];
      
      const result = await tool.execute({
        asset: testArray,
        title: 'Array Transmission Test'
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('data');
      expect(result.assetId).toBeTruthy();
      
      // Verify on server
      const response = await fetch(`http://localhost:${testPort}/api/asset/${result.assetId}`);
      const stored = await response.json();
      
      expect(stored.success).toBe(true);
      expect(stored.data.asset).toEqual(testArray);
      expect(stored.data.assetType).toBe('data');
    });
  });

  describe('concurrent operations', () => {
    test('should handle multiple simultaneous asset transmissions', async () => {
      const assets = [
        { type: 'json', data: { id: 1 } },
        { type: 'text', data: 'Text content' },
        { type: 'array', data: [1, 2, 3] },
        { type: 'url', data: 'https://example.com' },
        { type: 'html', data: '<div>HTML</div>' }
      ];
      
      // Send all assets concurrently
      const promises = assets.map(item => 
        tool.execute({
          asset: item.data,
          title: `Concurrent ${item.type}`
        })
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.assetId).toBeTruthy();
        expect(result.window_id).toBeTruthy();
      });
      
      // All should have unique IDs
      const assetIds = results.map(r => r.assetId);
      const uniqueIds = new Set(assetIds);
      expect(uniqueIds.size).toBe(assetIds.length);
      
      // Verify all are stored on server
      const response = await fetch(`http://localhost:${testPort}/api/assets`);
      const stored = await response.json();
      
      expect(stored.assets.length).toBeGreaterThanOrEqual(assets.length);
    });

    test('should maintain data integrity under concurrent load', async () => {
      const testCount = 50;
      const assets = Array.from({ length: testCount }, (_, i) => ({
        id: i,
        data: `Asset ${i}`,
        timestamp: Date.now()
      }));
      
      // Send all concurrently
      const promises = assets.map(asset => 
        tool.execute({
          asset,
          title: `Load test ${asset.id}`
        })
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results.filter(r => r.success).length).toBe(testCount);
      
      // Verify each asset is correctly stored
      for (let i = 0; i < Math.min(5, results.length); i++) {
        const result = results[i];
        const response = await fetch(`http://localhost:${testPort}/api/asset/${result.assetId}`);
        const stored = await response.json();
        
        expect(stored.success).toBe(true);
        expect(stored.data.asset).toEqual(assets[i]);
      }
    });
  });

  describe('server response handling', () => {
    test('should handle successful server responses', async () => {
      const result = await tool.execute({
        asset: { success: 'test' },
        title: 'Success Response Test'
      });
      
      expect(result.success).toBe(true);
      expect(result.window_id).toMatch(/^window_asset_\d+_\d+$/);
      expect(result.url).toMatch(new RegExp(`http://localhost:${testPort}/showme#asset=`));
      expect(result.assetId).toMatch(/^asset_\d+_\d+$/);
    });

    test('should include all expected fields in response', async () => {
      const result = await tool.execute({
        asset: 'Test content',
        title: 'Field Verification Test',
        hint: 'text'
      });
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('window_id');
      expect(result).toHaveProperty('detected_type');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('assetId');
      
      expect(result.success).toBe(true);
      expect(result.title).toBe('Field Verification Test');
      expect(result.detected_type).toBe('text');
    });
  });

  describe('asset storage verification', () => {
    test('should store assets with correct metadata', async () => {
      const testAsset = {
        type: 'test',
        content: 'Metadata verification'
      };
      
      const result = await tool.execute({
        asset: testAsset,
        title: 'Metadata Test'
      });
      
      expect(result.success).toBe(true);
      
      // Retrieve from server
      const response = await fetch(`http://localhost:${testPort}/api/asset/${result.assetId}`);
      const stored = await response.json();
      
      expect(stored.success).toBe(true);
      expect(stored.data).toMatchObject({
        id: result.assetId,
        asset: testAsset,
        assetType: 'json',
        title: 'Metadata Test'
      });
      expect(stored.data.timestamp).toBeTruthy();
    });

    test('should list all stored assets', async () => {
      // Store a few assets
      await tool.execute({ asset: 'Asset 1' });
      await tool.execute({ asset: 'Asset 2' });
      await tool.execute({ asset: 'Asset 3' });
      
      // List all assets
      const response = await fetch(`http://localhost:${testPort}/api/assets`);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(Array.isArray(data.assets)).toBe(true);
      expect(data.assets.length).toBeGreaterThanOrEqual(3);
      
      // Verify asset structure
      data.assets.forEach(asset => {
        expect(asset).toHaveProperty('id');
        expect(asset).toHaveProperty('assetType');
        expect(asset).toHaveProperty('title');
        expect(asset).toHaveProperty('timestamp');
      });
    });

    test('should delete assets from storage', async () => {
      // Store an asset
      const result = await tool.execute({
        asset: 'To be deleted',
        title: 'Delete Test'
      });
      
      expect(result.success).toBe(true);
      const assetId = result.assetId;
      
      // Verify it exists
      let response = await fetch(`http://localhost:${testPort}/api/asset/${assetId}`);
      expect(response.ok).toBe(true);
      
      // Delete it
      response = await fetch(`http://localhost:${testPort}/api/assets/${assetId}`, {
        method: 'DELETE'
      });
      const deleteResult = await response.json();
      expect(deleteResult.success).toBe(true);
      
      // Verify it's gone
      response = await fetch(`http://localhost:${testPort}/api/asset/${assetId}`);
      expect(response.status).toBe(404);
    });
  });

  describe('network resilience', () => {
    test('should handle slow network conditions', async () => {
      // Create large asset to simulate slow transmission
      const largeAsset = {
        data: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          value: Math.random(),
          text: `Item ${i} with some content`
        }))
      };
      
      const startTime = Date.now();
      const result = await tool.execute({
        asset: largeAsset,
        title: 'Large Asset Test'
      });
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.assetId).toBeTruthy();
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });

    test('should handle rapid sequential requests', async () => {
      const results = [];
      
      for (let i = 0; i < 10; i++) {
        const result = await tool.execute({
          asset: `Sequential request ${i}`,
          title: `Seq ${i}`
        });
        results.push(result);
        
        // No delay between requests
      }
      
      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // All should have unique IDs
      const ids = results.map(r => r.assetId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});