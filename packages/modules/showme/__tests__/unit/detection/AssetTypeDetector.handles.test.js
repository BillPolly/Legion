/**
 * Unit tests for Handle detection in AssetTypeDetector
 * Tests Legion URI and Handle instance detection
 */

import { AssetTypeDetector } from '../../../src/detection/AssetTypeDetector.js';

describe('AssetTypeDetector - Handle Detection', () => {
  let detector;

  beforeEach(() => {
    detector = new AssetTypeDetector();
  });

  describe('Legion URI String Detection', () => {
    test('should detect valid Legion URI string', () => {
      const uri = 'legion://localhost/datastore/users/123';
      const result = detector.detect(uri);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('datastore');
      expect(result.uri).toBe(uri);
    });

    test('should detect strategy Legion URI', () => {
      const uri = 'legion://localhost/strategy/packages/agents/strategies/SimpleNode.js';
      const result = detector.detect(uri);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('strategy');
      expect(result.uri).toBe(uri);
    });

    test('should detect file Legion URI', () => {
      const uri = 'legion://localhost/file/home/user/document.txt';
      const result = detector.detect(uri);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('file');
      expect(result.uri).toBe(uri);
    });

    test('should handle Legion URI with query parameters', () => {
      const uri = 'legion://localhost/datastore/users?status=active';
      const result = detector.detect(uri);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('datastore');
      expect(result.uri).toBe(uri);
    });

    test('should handle Legion URI with fragment', () => {
      const uri = 'legion://localhost/file/document.txt#section1';
      const result = detector.detect(uri);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('file');
      expect(result.uri).toBe(uri);
    });
  });

  describe('Handle Instance Detection', () => {
    test('should detect object with toURI() and resourceType', () => {
      const handleLike = {
        toURI: () => 'legion://localhost/datastore/users/123',
        resourceType: 'datastore',
        data: { name: 'Test User' }
      };

      const result = detector.detect(handleLike);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('datastore');
      expect(result.uri).toBe('legion://localhost/datastore/users/123');
      expect(result.instance).toBe(handleLike);
    });

    test('should detect strategy handle instance', () => {
      const strategyHandle = {
        toURI: () => 'legion://localhost/strategy/SimpleNode.js',
        resourceType: 'strategy',
        getMetadata: () => Promise.resolve({ name: 'SimpleNode' })
      };

      const result = detector.detect(strategyHandle);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('strategy');
      expect(result.uri).toBe('legion://localhost/strategy/SimpleNode.js');
      expect(result.instance).toBe(strategyHandle);
    });

    test('should detect file handle instance', () => {
      const fileHandle = {
        toURI: () => 'legion://localhost/file/document.txt',
        resourceType: 'file',
        read: () => Promise.resolve('content')
      };

      const result = detector.detect(fileHandle);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('file');
      expect(result.uri).toBe('legion://localhost/file/document.txt');
      expect(result.instance).toBe(fileHandle);
    });
  });

  describe('Backward Compatibility with Traditional Assets', () => {
    test('should still detect image files', () => {
      const imagePath = '/path/to/image.png';
      const result = detector.detect(imagePath, { hint: 'image' });

      expect(result.type).toBe('image');
    });

    test('should still detect JSON objects', () => {
      const jsonData = { name: 'test', value: 123 };
      const result = detector.detect(jsonData);

      expect(result.type).toBe('json');
      expect(result.data).toBe(jsonData);
    });

    test('should still detect web URLs', () => {
      const url = 'https://example.com';
      const result = detector.detect(url);

      expect(result.type).toBe('web');
      expect(result.url).toBe(url);
    });

    test('should still detect code strings', () => {
      const code = 'function test() { return 42; }';
      const result = detector.detect(code, { hint: 'code' });

      expect(result.type).toBe('code');
    });

    test('should still detect table data', () => {
      // Use array of objects format (what isTabularData expects)
      const tableData = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ];
      const result = detector.detect(tableData);

      expect(result.type).toBe('data');
    });
  });

  describe('Handle Detection Priority', () => {
    test('should prioritize Legion URI over other detections', () => {
      // A string that could be detected as text but is a Legion URI
      const uri = 'legion://localhost/file/readme.txt';
      const result = detector.detect(uri);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('file');
    });

    test('should prioritize Handle instance over JSON detection', () => {
      // An object that has data but is also a Handle
      const handleLike = {
        toURI: () => 'legion://localhost/datastore/users/123',
        resourceType: 'datastore',
        name: 'Test',
        data: { value: 123 }
      };

      const result = detector.detect(handleLike);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('datastore');
    });
  });

  describe('Error Cases', () => {
    test('should handle invalid Legion URI format', () => {
      const invalidUri = 'legion://invalid';

      expect(() => {
        detector.detect(invalidUri);
      }).toThrow(/Invalid Legion URI/);
    });

    test('should handle Legion URI with missing resource type', () => {
      const invalidUri = 'legion://localhost/';

      expect(() => {
        detector.detect(invalidUri);
      }).toThrow(/Invalid Legion URI/);
    });

    test('should handle malformed Handle instance (missing toURI)', () => {
      const malformed = {
        resourceType: 'datastore',
        data: { name: 'Test' }
      };

      const result = detector.detect(malformed);

      // Should fall back to other detection (JSON in this case)
      expect(result.type).not.toBe('handle');
      expect(result.type).toBe('json');
    });

    test('should handle malformed Handle instance (missing resourceType)', () => {
      const malformed = {
        toURI: () => 'legion://localhost/datastore/users/123',
        data: { name: 'Test' }
      };

      const result = detector.detect(malformed);

      // Should fall back to other detection (JSON in this case)
      expect(result.type).not.toBe('handle');
      expect(result.type).toBe('json');
    });

    test('should handle null input', () => {
      expect(() => {
        detector.detect(null);
      }).toThrow(/Cannot detect asset type from null/);
    });

    test('should handle undefined input', () => {
      expect(() => {
        detector.detect(undefined);
      }).toThrow(/Cannot detect asset type from undefined/);
    });

    test('should handle Handle instance with toURI() that throws', () => {
      const faultyHandle = {
        toURI: () => {
          throw new Error('URI generation failed');
        },
        resourceType: 'datastore'
      };

      expect(() => {
        detector.detect(faultyHandle);
      }).toThrow(/URI generation failed/);
    });

    test('should handle Handle instance with non-Legion URI', () => {
      const handleWithNonLegionUri = {
        toURI: () => 'http://example.com/resource',
        resourceType: 'datastore'
      };

      expect(() => {
        detector.detect(handleWithNonLegionUri);
      }).toThrow(/Handle toURI\(\) must return Legion URI/);
    });
  });

  describe('Edge Cases', () => {
    test('should handle Legion URI with special characters in path', () => {
      const uri = 'legion://localhost/file/path/with%20spaces/file%20name.txt';
      const result = detector.detect(uri);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('file');
      expect(result.uri).toBe(uri);
    });

    test('should handle Legion URI with different server', () => {
      const uri = 'legion://remote-server/datastore/users/123';
      const result = detector.detect(uri);

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('datastore');
      expect(result.uri).toBe(uri);
    });

    test('should handle Handle instance with additional methods', () => {
      const extendedHandle = {
        toURI: () => 'legion://localhost/datastore/users/123',
        resourceType: 'datastore',
        query: () => {},
        subscribe: () => {},
        customMethod: () => 'custom'
      };

      const result = detector.detect(extendedHandle);

      expect(result.type).toBe('handle');
      expect(result.instance).toBe(extendedHandle);
    });

    test('should handle empty string', () => {
      expect(() => {
        detector.detect('');
      }).toThrow(/Cannot detect asset type from empty string/);
    });

    test('should handle whitespace-only string', () => {
      expect(() => {
        detector.detect('   ');
      }).toThrow(/Cannot detect asset type from empty string/);
    });
  });

  describe('Hint Handling with Handles', () => {
    test('should respect handle hint for Legion URI', () => {
      const uri = 'legion://localhost/datastore/users/123';
      const result = detector.detect(uri, { hint: 'handle' });

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('datastore');
    });

    test('should ignore non-handle hint for Legion URI', () => {
      // Legion URI should be detected as handle regardless of hint
      const uri = 'legion://localhost/file/document.txt';
      const result = detector.detect(uri, { hint: 'text' });

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('file');
    });

    test('should handle hint for Handle instance', () => {
      const handleLike = {
        toURI: () => 'legion://localhost/strategy/SimpleNode.js',
        resourceType: 'strategy'
      };

      const result = detector.detect(handleLike, { hint: 'handle' });

      expect(result.type).toBe('handle');
      expect(result.subtype).toBe('strategy');
    });
  });
});