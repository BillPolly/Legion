/**
 * Integration Tests for Tool → Server Communication
 * 
 * Tests complete flow from tool execution to server response
 * NO MOCKS - Tests real HTTP communication and data flow
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Tool → Server Communication Integration', () => {
  let tool;
  let server;
  let assetDetector;
  let resourceManager;
  const testPort = 3789;

  beforeAll(async () => {
    // Initialize ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Start real server
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    // Initialize asset detector
    assetDetector = new AssetTypeDetector();
    
    // Initialize tool with real server URL
    tool = new ShowAssetTool({
      assetDetector,
      serverPort: testPort
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 30000);

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('complete tool execution flow', () => {
    test('should execute tool and send asset to server via HTTP', async () => {
      const testAsset = {
        name: 'Test Object',
        value: 42,
        nested: { data: 'test' }
      };
      
      // Execute tool
      const result = await tool.execute({
        asset: testAsset,
        title: 'Tool → Server Test'
      });
      
      // Verify successful execution
      expect(result.success).toBe(true);
      expect(result.assetId).toBeTruthy();
      expect(result.url).toContain(`http://localhost:${testPort}`);
      expect(result.detected_type).toBe('json');
      
      // Verify asset is stored on server
      const response = await fetch(`${result.url}`);
      const serverAsset = await response.json();
      expect(serverAsset).toEqual(testAsset);
    });

    test('should handle image assets with proper transmission', async () => {
      // Create a test image (1x1 red pixel PNG)
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
        0x54, 0x08, 0x99, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x5B, 0x84, 0xC5,
        0xE1, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
        0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      
      const base64Image = `data:image/png;base64,${pngData.toString('base64')}`;
      
      // Execute tool with image
      const result = await tool.execute({
        asset: base64Image,
        hint: 'image',
        title: 'Test Image'
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('image');
      
      // Verify image is accessible from server
      const response = await fetch(`${result.url}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('image');
    });

    test('should handle code assets with syntax preservation', async () => {
      const codeAsset = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Test the function
console.log(fibonacci(10));`;
      
      // Execute tool with code
      const result = await tool.execute({
        asset: codeAsset,
        hint: 'code',
        title: 'Fibonacci Code',
        options: { language: 'javascript' }
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('code');
      
      // Verify code is preserved exactly
      const response = await fetch(`${result.url}`);
      const serverCode = await response.text();
      expect(serverCode).toBe(codeAsset);
    });

    test('should handle tabular data transmission', async () => {
      const tableData = [
        { id: 1, name: 'Alice', score: 95 },
        { id: 2, name: 'Bob', score: 87 },
        { id: 3, name: 'Charlie', score: 92 }
      ];
      
      // Execute tool with table data
      const result = await tool.execute({
        asset: tableData,
        hint: 'data',
        title: 'Student Scores'
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('data');
      
      // Verify data integrity
      const response = await fetch(`${result.url}`);
      const serverData = await response.json();
      expect(serverData).toEqual(tableData);
    });

    test('should handle web content assets', async () => {
      const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <h1>Test Page</h1>
  <p>This is a test paragraph.</p>
</body>
</html>`;
      
      // Execute tool with HTML
      const result = await tool.execute({
        asset: htmlContent,
        hint: 'web',
        title: 'HTML Page'
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('web');
      
      // Verify HTML is stored correctly
      const response = await fetch(`${result.url}`);
      const serverHtml = await response.text();
      expect(serverHtml).toBe(htmlContent);
    });
  });

  describe('server state management', () => {
    test('should maintain asset state across multiple tool executions', async () => {
      const assetIds = [];
      
      // Execute tool multiple times
      for (let i = 0; i < 5; i++) {
        const result = await tool.execute({
          asset: { index: i, data: `Asset ${i}` },
          title: `Asset ${i}`
        });
        
        expect(result.success).toBe(true);
        assetIds.push(result.assetId);
      }
      
      // Verify all assets are accessible
      for (let i = 0; i < assetIds.length; i++) {
        const response = await fetch(`http://localhost:${testPort}/api/assets/${assetIds[i]}`);
        const asset = await response.json();
        expect(asset.index).toBe(i);
        expect(asset.data).toBe(`Asset ${i}`);
      }
    });

    test('should handle concurrent tool executions', async () => {
      const executions = [];
      
      // Execute multiple tools concurrently
      for (let i = 0; i < 10; i++) {
        executions.push(
          tool.execute({
            asset: { concurrent: i },
            title: `Concurrent ${i}`
          })
        );
      }
      
      // Wait for all to complete
      const results = await Promise.all(executions);
      
      // Verify all succeeded
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.assetId).toBeTruthy();
      });
      
      // Verify all assets are stored
      for (const result of results) {
        const response = await fetch(`${result.url}`);
        expect(response.status).toBe(200);
      }
    });

    test('should provide unique asset IDs for each execution', async () => {
      const assetIds = new Set();
      
      // Execute tool multiple times with same asset
      for (let i = 0; i < 5; i++) {
        const result = await tool.execute({
          asset: { same: 'asset' },
          title: 'Same Asset'
        });
        
        expect(result.success).toBe(true);
        assetIds.add(result.assetId);
      }
      
      // All IDs should be unique
      expect(assetIds.size).toBe(5);
    });
  });

  describe('error propagation', () => {
    test('should propagate server errors to tool result', async () => {
      // Stop server temporarily
      await server.stop();
      
      // Try to execute tool
      const result = await tool.execute({
        asset: { test: 'data' },
        title: 'Error Test'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to connect to ShowMe server');
      
      // Restart server
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    test('should handle network timeouts gracefully', async () => {
      // Create a very large asset that might cause timeout
      const largeAsset = {
        data: Array(10000).fill(0).map((_, i) => ({
          index: i,
          value: Math.random(),
          nested: { deep: { data: 'x'.repeat(100) } }
        }))
      };
      
      // Execute with timeout handling
      const result = await tool.execute({
        asset: largeAsset,
        title: 'Large Asset',
        options: { timeout: 5000 }
      });
      
      // Should either succeed or timeout gracefully
      if (!result.success) {
        expect(result.error).toBeTruthy();
      } else {
        expect(result.assetId).toBeTruthy();
      }
    });

    test('should validate server response format', async () => {
      // Execute normal tool call
      const result = await tool.execute({
        asset: { validate: 'test' },
        title: 'Validation Test'
      });
      
      // Verify response has all required fields
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('assetId');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('detected_type');
      expect(result).toHaveProperty('window_id');
      expect(result).toHaveProperty('title');
    });
  });

  describe('asset type detection flow', () => {
    test('should detect and transmit JSON assets correctly', async () => {
      const jsonString = '{"key": "value", "number": 123}';
      
      const result = await tool.execute({
        asset: jsonString,
        title: 'JSON String Test'
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('json');
      
      // Verify parsed JSON on server
      const response = await fetch(`${result.url}`);
      const parsed = await response.json();
      expect(parsed.key).toBe('value');
      expect(parsed.number).toBe(123);
    });

    test('should detect and transmit CSV data correctly', async () => {
      const csvData = `Name,Age,City
Alice,30,New York
Bob,25,Los Angeles
Charlie,35,Chicago`;
      
      const result = await tool.execute({
        asset: csvData,
        title: 'CSV Data Test'
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('data');
    });

    test('should respect type hints over detection', async () => {
      const ambiguousAsset = '12345'; // Could be text or code
      
      // Execute with code hint
      const result = await tool.execute({
        asset: ambiguousAsset,
        hint: 'code',
        title: 'Hint Test'
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('code');
    });

    test('should fall back to text for unknown types', async () => {
      const unknownAsset = Symbol.for('test').toString();
      
      const result = await tool.execute({
        asset: unknownAsset,
        title: 'Unknown Type Test'
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('text');
    });
  });

  describe('options and metadata transmission', () => {
    test('should transmit display options to server', async () => {
      const displayOptions = {
        width: 800,
        height: 600,
        resizable: true,
        theme: 'dark'
      };
      
      const result = await tool.execute({
        asset: { options: 'test' },
        title: 'Options Test',
        options: displayOptions
      });
      
      expect(result.success).toBe(true);
      
      // Verify options are stored
      const response = await fetch(`http://localhost:${testPort}/api/assets/${result.assetId}/metadata`);
      const metadata = await response.json();
      expect(metadata.options).toMatchObject(displayOptions);
    });

    test('should transmit title and metadata', async () => {
      const testTitle = 'Test Asset Title';
      
      const result = await tool.execute({
        asset: { meta: 'test' },
        title: testTitle
      });
      
      expect(result.success).toBe(true);
      expect(result.title).toBe(testTitle);
      
      // Verify title is stored
      const response = await fetch(`http://localhost:${testPort}/api/assets/${result.assetId}/metadata`);
      const metadata = await response.json();
      expect(metadata.title).toBe(testTitle);
    });

    test('should include timestamp in server storage', async () => {
      const beforeTime = Date.now();
      
      const result = await tool.execute({
        asset: { timestamp: 'test' },
        title: 'Timestamp Test'
      });
      
      const afterTime = Date.now();
      
      expect(result.success).toBe(true);
      
      // Verify timestamp is within range
      const response = await fetch(`http://localhost:${testPort}/api/assets/${result.assetId}/metadata`);
      const metadata = await response.json();
      expect(metadata.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(metadata.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('resource cleanup', () => {
    test('should clean up resources after tool execution', async () => {
      const result = await tool.execute({
        asset: { cleanup: 'test' },
        title: 'Cleanup Test'
      });
      
      expect(result.success).toBe(true);
      
      // Asset should be accessible immediately
      const response1 = await fetch(`${result.url}`);
      expect(response1.status).toBe(200);
      
      // Asset should remain accessible (no premature cleanup)
      await new Promise(resolve => setTimeout(resolve, 100));
      const response2 = await fetch(`${result.url}`);
      expect(response2.status).toBe(200);
    });

    test('should handle server restart gracefully', async () => {
      // Execute tool before restart
      const result1 = await tool.execute({
        asset: { before: 'restart' },
        title: 'Before Restart'
      });
      expect(result1.success).toBe(true);
      
      // Restart server
      await server.stop();
      await new Promise(resolve => setTimeout(resolve, 500));
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Execute tool after restart
      const result2 = await tool.execute({
        asset: { after: 'restart' },
        title: 'After Restart'
      });
      expect(result2.success).toBe(true);
      
      // Old asset may not be accessible
      const oldResponse = await fetch(`${result1.url}`);
      expect([200, 404]).toContain(oldResponse.status);
      
      // New asset should be accessible
      const newResponse = await fetch(`${result2.url}`);
      expect(newResponse.status).toBe(200);
    });
  });
});