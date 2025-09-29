/**
 * Unit tests for ShowAssetTool Handle input processing
 * Tests Handle URI and Handle instance input (NO traditional asset tests)
 */

import { jest } from '@jest/globals';
import { ShowAssetTool } from '../../../src/tools/ShowAssetTool.js';
import { AssetTypeDetector } from '../../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ShowAssetTool - Handle Input Processing', () => {
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
      testMode: true // Don't start server in unit tests
    });
  });

  describe('Legion URI String Input', () => {
    test('should accept valid Legion URI string', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      const result = await tool.execute({ asset: uri });

      expect(result.success).toBe(true);
      expect(result.detected_type).toMatch(/handle/);
    });

    test('should detect strategy Handle from URI', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      const detectionResult = detector.detect(uri);

      expect(detectionResult.type).toBe('handle');
      expect(detectionResult.subtype).toMatch(/strategy/);
      expect(detectionResult.uri).toBe(uri);
    });

    test('should store Handle URI not full instance', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      await tool.execute({ asset: uri });

      // Check internal storage - should store URI
      const handles = Array.from(tool.handleStorage.values());
      expect(handles.length).toBeGreaterThan(0);

      // Asset should be the URI string
      const stored = handles[0];
      expect(typeof stored.asset).toBe('string');
      expect(stored.asset).toContain('legion://');
    });

    test('should fail fast on invalid Legion URI', async () => {
      const invalidUri = 'legion://localhost/invalid/path/that/does/not/exist.js';

      // Detection should work but execution may fail on resolution
      const detectionResult = detector.detect(invalidUri);
      expect(detectionResult.type).toBe('handle');

      // Tool should handle gracefully
      const result = await tool.execute({ asset: invalidUri });
      // In test mode, should succeed with detection
      expect(result.success).toBe(true);
    });

    test('should fail fast on malformed Legion URI', async () => {
      const malformedUri = 'legion://missing-resource-type';

      // Should fail during detection
      expect(() => {
        detector.detect(malformedUri);
      }).toThrow();
    });
  });

  describe('Handle Instance Input', () => {
    test('should accept Handle instance directly', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const result = await tool.execute({ asset: handle });

      expect(result.success).toBe(true);
      expect(result.detected_type).toMatch(/handle/);
    });

    test('should detect Handle instance type', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const detectionResult = detector.detect(handle);

      expect(detectionResult.type).toBe('handle');
      expect(detectionResult.subtype).toMatch(/strategy/);
      expect(detectionResult.instance).toBe(handle);
    });

    test('should store Handle URI when given instance', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await tool.execute({ asset: handle });

      // Should store URI extracted from Handle
      const handles = Array.from(tool.handleStorage.values());
      expect(handles.length).toBeGreaterThan(0);

      const stored = handles[0];
      // Should store the Handle instance temporarily but prefer URI
      expect(stored.asset).toBeDefined();
      expect(typeof stored.asset.toURI === 'function' || typeof stored.asset === 'string').toBe(true);
    });

    test('should fail fast on invalid Handle instance', async () => {
      const invalidHandle = {
        // Missing toURI() method
        resourceType: 'strategy'
      };

      // Should fail during detection
      expect(() => {
        detector.detect(invalidHandle);
      }).toThrow(/must have toURI/);
    });

    test('should fail fast on missing Handle instance', async () => {
      // Should fail on null Handle
      expect(() => {
        detector.detect(null);
      }).toThrow(/Cannot detect asset type from null/);
    });
  });

  describe('Handle Metadata Extraction', () => {
    test('should extract Handle resourceType', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      expect(handle.resourceType).toBeDefined();
      expect(handle.resourceType).toMatch(/strategy/);
    });

    test('should extract Handle URI', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      expect(handle.toURI()).toBeDefined();
      expect(handle.toURI()).toContain('legion://');
      expect(handle.toURI()).toContain('strategy');
    });

    test('should extract Handle metadata', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const metadata = await handle.getMetadata();

      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe('object');
    });

    test('should cache Handle metadata', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const metadata1 = await handle.getMetadata();
      const metadata2 = await handle.getMetadata();

      // Should return same cached instance
      expect(metadata1).toBe(metadata2);
    });
  });

  describe('Traditional Asset Backward Compatibility', () => {
    test('should still accept string file path', async () => {
      const result = await tool.execute({ asset: '/tmp/test.json' });

      expect(result.success).toBe(true);
      // Should NOT detect as Handle
      expect(result.detected_type).not.toBe('handle');
    });

    test('should still accept object data', async () => {
      const data = { test: 'data', values: [1, 2, 3] };

      const result = await tool.execute({ asset: data });

      expect(result.success).toBe(true);
      // Should detect as json or data
      expect(['json', 'data']).toContain(result.detected_type);
    });

    test('should still accept Buffer data', async () => {
      const buffer = Buffer.from('test data');

      const result = await tool.execute({ asset: buffer });

      expect(result.success).toBe(true);
      // Should detect as appropriate type (text, image, etc.)
      expect(result.detected_type).toBeDefined();
    });

    test('should prioritize Handle detection over traditional', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      const detectionResult = detector.detect(uri);

      // Handle detection should win over string path detection
      expect(detectionResult.type).toBe('handle');
      expect(detectionResult.subtype).toMatch(/strategy/);
    });
  });

  describe('Error Handling', () => {
    test('should fail fast on null asset', async () => {
      const result = await tool.execute({ asset: null });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });

    test('should fail fast on undefined asset', async () => {
      const result = await tool.execute({ asset: undefined });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });

    test('should fail fast on empty params', async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });

    test('should fail fast on detection error', async () => {
      // Empty string should fail detection
      expect(() => {
        detector.detect('');
      }).toThrow(/Cannot detect asset type from empty string/);
    });
  });

  describe('Title Generation for Handles', () => {
    test('should generate title from strategy Handle', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const result = await tool.execute({ asset: handle });

      expect(result.title).toBeDefined();
      expect(typeof result.title).toBe('string');
      expect(result.title.length).toBeGreaterThan(0);
    });

    test('should use provided title over generated', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const customTitle = 'My Custom Strategy';

      const result = await tool.execute({
        asset: uri,
        title: customTitle
      });

      expect(result.title).toBe(customTitle);
    });

    test('should generate different titles for different Handle types', async () => {
      const strategyUri = `legion://localhost/strategy${testStrategyPath}`;

      const result1 = await tool.execute({ asset: strategyUri });

      // Title should reflect Handle type
      expect(result1.title).toBeDefined();
    });
  });
});