/**
 * Integration tests for Handle detection and resolution workflow
 * Tests complete flow: Handle URI → AssetTypeDetector → ResourceManager → Handle metadata
 * NO MOCKS - uses real ResourceManager and strategy files
 */

import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Handle Resolution Integration', () => {
  let detector;
  let resourceManager;
  let testStrategyPath;

  beforeAll(async () => {
    // Get real ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();

    // Use an existing strategy file for testing
    testStrategyPath = path.resolve(__dirname, '../../../../../packages/agents/roma-agent/src/strategies/simple-node/SimpleNodeTestStrategy.js');
  });

  beforeEach(() => {
    detector = new AssetTypeDetector();
  });

  describe('Legion URI Detection', () => {
    test('should detect Legion URI string for strategy', () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const result = detector.detect(uri);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('strategy');
      expect(result.uri).toBe(uri);
    });

    test('should detect Legion URI string for datastore', () => {
      const uri = 'legion://localhost/datastore/users/123';
      const result = detector.detect(uri);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('datastore');
      expect(result.uri).toBe(uri);
    });

    test('should detect Legion URI string for file', () => {
      const uri = 'legion://localhost/file/home/user/document.txt';
      const result = detector.detect(uri);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('file');
      expect(result.uri).toBe(uri);
    });
  });

  describe('Handle Instance Detection', () => {
    test('should detect strategy Handle instance', async () => {
      // Create real strategy Handle via ResourceManager
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      // Detect it
      const result = detector.detect(handle);

      expect(result.type).toBe('handle');
      // subtype comes from the resourceType in the URI, which includes the path segment
      expect(result.subtype).toBe(handle.resourceType);
      expect(result.uri).toContain('legion://');
      expect(result.instance).toBe(handle);
    });
  });

  describe('Handle Resolution via ResourceManager', () => {
    test('should resolve strategy Handle from URI', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      // Detect URI
      const detected = detector.detect(uri);
      expect(detected.type).toBe('handle');
      expect(detected.subtype).toBe('strategy');

      // Resolve via ResourceManager
      const handle = await ResourceManager.fromURI(detected.uri);

      expect(handle).toBeDefined();
      expect(typeof handle.toURI).toBe('function');
      expect(handle.resourceType).toBe('strategy');
    });

    test('should extract metadata from resolved strategy Handle', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      // Detect and resolve
      const detected = detector.detect(uri);
      const handle = await ResourceManager.fromURI(detected.uri);

      // Extract metadata
      const metadata = await handle.getMetadata();

      expect(metadata).toBeDefined();
      expect(metadata.strategyName).toBeDefined();
      expect(metadata.strategyType).toBeDefined();
    });
  });

  describe('Complete Handle Resolution Flow', () => {
    test('should complete full flow: URI → detection → resolution → metadata', async () => {
      // Step 1: Start with Legion URI string
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      // Step 2: Detect as Handle
      const detected = detector.detect(uri);
      expect(detected.type).toBe('handle');
      expect(detected.subtype).toBe('strategy');

      // Step 3: Resolve via ResourceManager
      const handle = await ResourceManager.fromURI(detected.uri);
      expect(handle).toBeDefined();
      expect(handle.resourceType).toBe('strategy');

      // Step 4: Extract metadata
      const metadata = await handle.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata.strategyName).toBeTruthy();

      // Step 5: Verify Handle can be re-detected
      const redetected = detector.detect(handle);
      expect(redetected.type).toBe('handle');
      expect(redetected.subtype).toBe(handle.resourceType);
      expect(redetected.instance).toBe(handle);
    });

    test('should handle re-detection of already-resolved Handle', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;

      // Resolve Handle
      const handle1 = await ResourceManager.fromURI(uri);

      // Detect the Handle instance
      const detected = detector.detect(handle1);
      expect(detected.type).toBe('handle');
      expect(detected.subtype).toBe(handle1.resourceType);

      // Resolve again from detected URI
      const handle2 = await ResourceManager.fromURI(detected.uri);

      // Should work and produce equivalent Handle
      expect(handle2.resourceType).toBe(handle1.resourceType);
      expect(handle2.toURI()).toBe(handle1.toURI());
    });
  });

  describe('Error Handling in Resolution Flow', () => {
    test('should fail-fast on invalid Legion URI', () => {
      const invalidUri = 'legion://invalid';

      expect(() => {
        detector.detect(invalidUri);
      }).toThrow(/Invalid Legion URI/);
    });

    test('should handle malformed Handle instance gracefully', () => {
      const malformed = {
        // Missing toURI()
        resourceType: 'strategy'
      };

      // Should not detect as Handle
      const result = detector.detect(malformed);
      expect(result.type).not.toBe('handle');
      expect(result.type).toBe('json'); // Falls back to JSON detection
    });
  });

  describe('Backward Compatibility', () => {
    test('should still detect traditional assets when not Handles', () => {
      // Traditional JSON
      const jsonData = { name: 'test', value: 123 };
      const jsonResult = detector.detect(jsonData);
      expect(jsonResult.type).toBe('json');
      expect(jsonResult.type).not.toBe('handle');

      // Traditional image path
      const imagePath = '/path/to/image.png';
      const imageResult = detector.detect(imagePath, { hint: 'image' });
      expect(imageResult.type).toBe('image');
      expect(imageResult.type).not.toBe('handle');

      // Traditional web URL
      const webUrl = 'https://example.com';
      const webResult = detector.detect(webUrl);
      expect(webResult.type).toBe('web');
      expect(webResult.type).not.toBe('handle');
    });

    test('should prioritize Handle detection over traditional detection', () => {
      // A Legion URI that could also be detected as text
      const uri = 'legion://localhost/file/readme.txt';
      const result = detector.detect(uri);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('file');
    });
  });
});