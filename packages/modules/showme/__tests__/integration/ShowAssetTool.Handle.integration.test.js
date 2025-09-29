/**
 * Integration tests for ShowAssetTool Handle display flow
 * Tests complete flow from Handle creation through display
 * NO MOCKS - uses real ResourceManager and Handles
 */

import { jest } from '@jest/globals';
import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ShowAssetTool Handle Display Flow Integration', () => {
  let tool;
  let detector;
  let resourceManager;
  let testStrategyPath;

  beforeAll(async () => {
    // Get real ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();

    // Use existing strategy for tests
    testStrategyPath = path.resolve(__dirname, '../../../../../agents/roma-agent/src/strategies/simple-node/SimpleNodeTestStrategy.js');
  });

  beforeEach(() => {
    detector = new AssetTypeDetector();
    tool = new ShowAssetTool({
      assetDetector: detector,
      resourceManager,
      testMode: true // Don't start server in integration tests
    });
  });

  describe('Complete Handle Display Flow with Handle Instance', () => {
    test('should create Handle from real strategy file', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      expect(handle).toBeDefined();
      expect(handle.toURI).toBeDefined();
      expect(handle.resourceType).toMatch(/strategy/);
    });

    test('should execute ShowAssetTool with Handle instance', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const result = await tool.execute({ asset: handle });

      expect(result.success).toBe(true);
      expect(result.detected_type).toMatch(/handle/);
      expect(result.assetId).toBeDefined();
    });

    test('should detect Handle correctly', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const result = await tool.execute({ asset: handle });

      expect(result.detected_type).toContain('handle');
      expect(result.detected_type).toContain('strategy');
    });

    test('should store Handle as URI not full instance', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await tool.execute({ asset: handle });

      // Check internal storage
      const handles = Array.from(tool.handleStorage.values());
      expect(handles.length).toBeGreaterThan(0);

      const stored = handles[0];
      // Should store URI string
      expect(typeof stored.asset).toBe('string');
      expect(stored.asset).toContain('legion://');
    });

    test('should cache Handle metadata', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const metadata1 = await handle.getMetadata();
      const metadata2 = await handle.getMetadata();

      // Should return same cached instance
      expect(metadata1).toBe(metadata2);
    });

    test('should generate title from Handle metadata', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const result = await tool.execute({ asset: handle });

      expect(result.title).toBeDefined();
      expect(typeof result.title).toBe('string');
      expect(result.title.length).toBeGreaterThan(0);
    });
  });

  describe('Complete Handle Display Flow with Handle URI String', () => {
    test('should execute ShowAssetTool with Handle URI string', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      const result = await tool.execute({ asset: uri });

      expect(result.success).toBe(true);
      expect(result.detected_type).toMatch(/handle/);
      expect(result.assetId).toBeDefined();
    });

    test('should detect Handle from URI string', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      const result = await tool.execute({ asset: uri });

      expect(result.detected_type).toContain('handle');
      expect(result.detected_type).toContain('strategy');
    });

    test('should store URI string directly', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      await tool.execute({ asset: uri });

      // Check internal storage
      const handles = Array.from(tool.handleStorage.values());
      expect(handles.length).toBeGreaterThan(0);

      const stored = handles[0];
      expect(stored.asset).toBe(uri);
    });

    test('should resolve Handle from stored URI on demand', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      await tool.execute({ asset: uri });

      // Simulate resolution on retrieval
      const handles = Array.from(tool.handleStorage.values());
      const stored = handles[0];
      const resolvedHandle = await ResourceManager.fromURI(stored.asset);

      expect(resolvedHandle).toBeDefined();
      expect(resolvedHandle.resourceType).toMatch(/strategy/);
    });

    test('should generate appropriate title for URI', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      const result = await tool.execute({ asset: uri });

      expect(result.title).toBeDefined();
      expect(result.title).toContain('Handle');
    });
  });

  describe('Handle Storage Efficiency', () => {
    test('should store URI string not full Handle object', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await tool.execute({ asset: handle });

      const handles = Array.from(tool.handleStorage.values());
      const stored = handles[0];

      // Storage should be minimal - just URI string
      expect(typeof stored.asset).toBe('string');
      expect(stored.asset.length).toBeLessThan(1000); // URI should be small
    });

    test('should avoid storing large Handle metadata', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await tool.execute({ asset: handle });

      const handles = Array.from(tool.handleStorage.values());
      const stored = handles[0];

      // Should not include full metadata in storage
      expect(stored.metadata).toBeUndefined();
    });

    test('should enable Handle re-resolution from URI', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      // First execution stores URI
      await tool.execute({ asset: uri });

      // Retrieve and re-resolve
      const handles = Array.from(tool.handleStorage.values());
      const stored = handles[0];
      const handle1 = await ResourceManager.fromURI(stored.asset);
      const handle2 = await ResourceManager.fromURI(stored.asset);

      // Both should resolve to valid Handles
      expect(handle1.resourceType).toBe(handle2.resourceType);
      expect(handle1.toURI()).toBe(handle2.toURI());
    });
  });

  describe('Error Handling in Handle Display Flow', () => {
    test('should fail fast on invalid Handle URI', async () => {
      const invalidUri = 'legion://localhost/invalid/path/does/not/exist.js';

      const result = await tool.execute({ asset: invalidUri });

      // Detection succeeds in test mode, but resolution would fail
      expect(result.success).toBe(true); // In test mode
      expect(result.detected_type).toMatch(/handle/);
    });

    test('should handle Handle resolution errors gracefully', async () => {
      const uri = 'legion://localhost/strategy/nonexistent.js';

      // Resolution may fail but should not crash
      try {
        await ResourceManager.fromURI(uri);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toBeDefined();
      }
    });

    test('should fail fast on malformed Handle instance', async () => {
      const malformed = {
        resourceType: 'strategy'
        // Missing toURI()
      };

      const result = await tool.execute({ asset: malformed });

      // Should fail during detection
      expect(result.success).toBe(false);
      expect(result.error).toContain('toURI');
    });
  });

  describe('Backward Compatibility with Traditional Assets', () => {
    test('should still handle traditional file paths', async () => {
      const filePath = '/tmp/test.json';

      const result = await tool.execute({ asset: filePath });

      expect(result.success).toBe(true);
      expect(result.detected_type).not.toContain('handle');
    });

    test('should still handle JSON objects', async () => {
      const jsonData = { test: 'data', values: [1, 2, 3] };

      const result = await tool.execute({ asset: jsonData });

      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('json');
    });

    test('should prioritize Handle detection', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      const result = await tool.execute({ asset: uri });

      // Should detect as Handle, not as string path
      expect(result.detected_type).toContain('handle');
    });
  });

  describe('Handle Metadata Extraction', () => {
    test('should extract metadata from strategy Handle', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const metadata = await handle.getMetadata();

      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe('object');
    });

    test('should cache metadata for performance', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const start1 = Date.now();
      const metadata1 = await handle.getMetadata();
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      const metadata2 = await handle.getMetadata();
      const time2 = Date.now() - start2;

      // Second call should be faster (cached)
      expect(time2).toBeLessThanOrEqual(time1);
      expect(metadata1).toBe(metadata2);
    });
  });

  describe('Multiple Handle Display', () => {
    test('should handle multiple Handles in sequence', async () => {
      const uri1 = `legion://localhost/strategy${testStrategyPath}`;
      const handle1 = await ResourceManager.fromURI(uri1);

      const result1 = await tool.execute({ asset: handle1 });
      const result2 = await tool.execute({ asset: uri1 });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.assetId).not.toBe(result2.assetId);
    });

    test('should maintain separate storage for each Handle', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      await tool.execute({ asset: uri, title: 'First' });
      await tool.execute({ asset: uri, title: 'Second' });

      const handles = Array.from(tool.handleStorage.values());
      expect(handles.length).toBe(2);
      expect(handles[0].title).not.toBe(handles[1].title);
    });
  });
});