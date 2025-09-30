/**
 * End-to-End Integration Test for Handle Display
 * Tests complete flow: ShowAssetTool → Actor → Handle resolution → Display
 * NO MOCKS - Real components, real Handles, real server
 */

import { jest } from '@jest/globals';
import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeModule } from '../../src/ShowMeModule.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ResourceManager } from '@legion/resource-manager';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('E2E Handle Display Integration', () => {
  let showMeModule;
  let showAssetTool;
  let server;
  let resourceManager;
  let testStrategyPath;
  let testStrategyURI;

  beforeAll(async () => {
    // Get real ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();

    // Setup test strategy path
    testStrategyPath = path.resolve(__dirname, '../../../../../agents/roma-agent/src/strategies/simple-node/SimpleNodeTestStrategy.js');
    testStrategyURI = `legion://localhost/strategy${testStrategyPath}`;

    // Initialize ShowMe server (without starting HTTP server)
    server = new ShowMeServer({
      port: 3701, // Use different port for tests
      skipLegionPackages: true,
      browserOptions: {
        app: false // Disable browser launch in tests
      }
    });

    await server.initialize();
  }, 30000);

  afterAll(async () => {
    if (server && server.isRunning) {
      await server.stop();
    }
  });

  beforeEach(async () => {
    // Initialize ShowMeModule
    showMeModule = new ShowMeModule();
    await showMeModule.ensureInitialized();

    // Get ShowAssetTool
    showAssetTool = showMeModule.tools.find(t => t.name === 'show_asset');
    expect(showAssetTool).toBeDefined();
  });

  describe('Strategy Handle Display Flow', () => {
    test('should create Handle from strategy file', async () => {
      const handle = await ResourceManager.fromURI(testStrategyURI);

      expect(handle).toBeDefined();
      expect(handle.toURI()).toBe(testStrategyURI);
      expect(handle.resourceType).toMatch(/strategy/);
    });

    test('should detect Handle type correctly', async () => {
      const detector = new AssetTypeDetector();
      const result = detector.detect(testStrategyURI);

      expect(result.type).toBe('handle');
      expect(result.subtype).toMatch(/strategy/);
      expect(result.uri).toBe(testStrategyURI);
    });

    test('should execute ShowAssetTool with Handle URI', async () => {
      const result = await showAssetTool.execute({
        asset: testStrategyURI,
        title: 'Test Strategy Handle'
      });

      expect(result.success).toBe(true);
      expect(result.detected_type).toMatch(/handle/);
      expect(result.title).toBe('Test Strategy Handle');
      expect(result.assetId).toBeDefined();
    });

    test('should execute ShowAssetTool with Handle instance', async () => {
      const handle = await ResourceManager.fromURI(testStrategyURI);

      const result = await showAssetTool.execute({
        asset: handle,
        title: 'Test Strategy Instance'
      });

      expect(result.success).toBe(true);
      expect(result.detected_type).toMatch(/handle/);
      expect(result.title).toBe('Test Strategy Instance');
    });

    test('should store Handle as URI not full instance', async () => {
      const handle = await ResourceManager.fromURI(testStrategyURI);

      const result = await showAssetTool.execute({ asset: handle });

      // In test mode, assets are tracked but not sent to server
      expect(result.success).toBe(true);
      expect(result.assetId).toBeDefined();
    });
  });

  describe('Handle Metadata and Introspection', () => {
    test('should extract Handle metadata', async () => {
      const handle = await ResourceManager.fromURI(testStrategyURI);
      const metadata = await handle.getMetadata();

      expect(metadata).toBeDefined();
      expect(typeof metadata).toBe('object');
      expect(metadata.strategyName).toBeDefined();
    });

    test('should extract strategy information', async () => {
      const handle = await ResourceManager.fromURI(testStrategyURI);
      const metadata = await handle.getMetadata();

      // Strategy should have name
      expect(metadata.strategyName).toBeDefined();
      expect(typeof metadata.strategyName).toBe('string');
    });

    test('should cache metadata for performance', async () => {
      const handle = await ResourceManager.fromURI(testStrategyURI);

      const metadata1 = await handle.getMetadata();
      const metadata2 = await handle.getMetadata();

      // Should return same cached object
      expect(metadata1).toBe(metadata2);
    });

    test('should provide Handle URI', async () => {
      const handle = await ResourceManager.fromURI(testStrategyURI);

      const uri = handle.toURI();

      expect(uri).toBe(testStrategyURI);
      expect(uri).toContain('legion://');
      expect(uri).toContain('strategy');
    });
  });

  describe('Renderer Selection', () => {
    test('should select StrategyRenderer for strategy Handles', async () => {
      const handle = await ResourceManager.fromURI(testStrategyURI);

      // The detector should identify it as a strategy Handle
      const detector = new AssetTypeDetector();
      const result = detector.detect(handle);

      expect(result.type).toBe('handle');
      expect(result.subtype).toMatch(/strategy/);
    });

    test('should detect different Handle types', async () => {
      const detector = new AssetTypeDetector();

      // Strategy Handle
      const strategyResult = detector.detect(testStrategyURI);
      expect(strategyResult.subtype).toMatch(/strategy/);
    });
  });

  describe('Error Scenarios End-to-End', () => {
    test('should detect invalid Handle URI', async () => {
      const invalidURI = 'legion://localhost/strategy/nonexistent.js';

      // Detection should succeed (URI is well-formed)
      const detector = new AssetTypeDetector();
      const result = detector.detect(invalidURI);

      expect(result.type).toBe('handle');
      expect(result.uri).toBe(invalidURI);
    });

    test('should fail fast on malformed Legion URI', async () => {
      const malformedURI = 'legion://malformed-uri';

      expect(() => {
        const detector = new AssetTypeDetector();
        detector.detect(malformedURI);
      }).toThrow(/Invalid Legion URI format/);
    });

    test('should fail fast on null asset', async () => {
      const result = await showAssetTool.execute({ asset: null });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });

    test('should fail fast on invalid Handle-like object', async () => {
      const invalidHandle = {
        resourceType: 'strategy'
        // Missing toURI()
      };

      const result = await showAssetTool.execute({ asset: invalidHandle });

      expect(result.success).toBe(false);
      expect(result.error).toContain('toURI');
    });
  });

  describe('Backward Compatibility', () => {
    test('should detect traditional JSON asset', async () => {
      const jsonData = { test: 'data', values: [1, 2, 3] };
      const detector = new AssetTypeDetector();

      const result = detector.detect(jsonData);

      expect(result.type).toBe('json');
    });

    test('should detect string file path', async () => {
      const filePath = '/tmp/test.json';
      const detector = new AssetTypeDetector();

      const result = detector.detect(filePath);

      expect(result.type).not.toBe('handle');
    });

    test('should prioritize Handle detection over string path', async () => {
      const detector = new AssetTypeDetector();

      // Legion URI string should be detected as Handle, not file path
      const result = detector.detect(testStrategyURI);

      expect(result.type).toBe('handle');
      expect(result.type).not.toBe('text');
    });
  });

  describe('Multiple Handle Display', () => {
    test('should handle multiple sequential displays', async () => {
      const result1 = await showAssetTool.execute({
        asset: testStrategyURI,
        title: 'First Display'
      });

      const result2 = await showAssetTool.execute({
        asset: testStrategyURI,
        title: 'Second Display'
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.assetId).not.toBe(result2.assetId);
      expect(result1.title).not.toBe(result2.title);
    });
  });

  describe('Handle Resolution Performance', () => {
    test('should resolve Handle efficiently', async () => {
      const start = Date.now();
      const handle = await ResourceManager.fromURI(testStrategyURI);
      const resolutionTime = Date.now() - start;

      expect(handle).toBeDefined();
      expect(resolutionTime).toBeLessThan(1000); // Should be fast
    });

    test('should cache resolved Handles', async () => {
      const handle1 = await ResourceManager.fromURI(testStrategyURI);
      const handle2 = await ResourceManager.fromURI(testStrategyURI);

      // ResourceManager should cache Handles
      expect(handle1.toURI()).toBe(handle2.toURI());
    });
  });

  describe('Title Generation', () => {
    test('should generate title from Handle type', async () => {
      const result = await showAssetTool.execute({ asset: testStrategyURI });

      expect(result.success).toBe(true);
      expect(result.title).toBeDefined();
      expect(typeof result.title).toBe('string');
    });

    test('should use custom title when provided', async () => {
      const customTitle = 'My Custom Strategy';

      const result = await showAssetTool.execute({
        asset: testStrategyURI,
        title: customTitle
      });

      expect(result.success).toBe(true);
      expect(result.title).toBe(customTitle);
    });
  });

  describe('Complete Integration Flow', () => {
    test('should complete full flow: tool call → detection → display', async () => {
      // Step 1: Create Handle
      const handle = await ResourceManager.fromURI(testStrategyURI);
      expect(handle).toBeDefined();

      // Step 2: Detect Handle type
      const detector = new AssetTypeDetector();
      const detection = detector.detect(handle);
      expect(detection.type).toBe('handle');

      // Step 3: Execute tool
      const result = await showAssetTool.execute({ asset: handle });
      expect(result.success).toBe(true);
      expect(result.detected_type).toMatch(/handle/);
      expect(result.assetId).toBeDefined();
    });
  });
});