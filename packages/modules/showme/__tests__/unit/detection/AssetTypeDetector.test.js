/**
 * Unit Tests for AssetTypeDetector
 * 
 * Tests the multi-stage asset type detection system:
 * 1. Hint-based detection
 * 2. Content analysis
 * 3. File extension analysis
 * 4. Default fallback
 */

import { AssetTypeDetector } from '../../../src/detection/AssetTypeDetector.js';

describe('AssetTypeDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new AssetTypeDetector();
  });

  describe('detectAssetType', () => {
    describe('hint-based detection', () => {
      test('should use valid hint when provided and asset is compatible', () => {
        const imageBuffer = Buffer.from('fake-image-data');
        const result = detector.detectAssetType(imageBuffer, 'image');
        expect(result).toBe('image');
      });

      test('should ignore invalid hint and fall back to content analysis', () => {
        const jsonData = { key: 'value' };
        // Try to hint as image but it's clearly JSON
        const result = detector.detectAssetType(jsonData, 'image');
        expect(result).toBe('json');
      });

      test('should validate hint against asset compatibility', () => {
        const textData = 'Hello world';
        // Hint as JSON but it's not valid JSON structure
        const result = detector.detectAssetType(textData, 'json');
        expect(result).toBe('text');
      });
    });

    describe('content-based detection', () => {
      test('should detect image data from buffer', () => {
        const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF]); // JPEG header
        const result = detector.detectAssetType(imageBuffer);
        expect(result).toBe('image');
      });

      test('should detect JSON data from object structure', () => {
        const jsonData = { users: [{ id: 1, name: 'John' }], total: 1 };
        const result = detector.detectAssetType(jsonData);
        expect(result).toBe('json');
      });

      test('should detect JSON data from valid JSON string', () => {
        const jsonString = '{"key": "value", "number": 42}';
        const result = detector.detectAssetType(jsonString);
        expect(result).toBe('json');
      });

      test('should detect tabular data from array of objects', () => {
        const tableData = [
          { id: 1, name: 'John', age: 30 },
          { id: 2, name: 'Jane', age: 25 }
        ];
        const result = detector.detectAssetType(tableData);
        expect(result).toBe('data');
      });

      test('should detect tabular data from CSV-like string', () => {
        const csvData = 'id,name,age\n1,John,30\n2,Jane,25';
        const result = detector.detectAssetType(csvData);
        expect(result).toBe('data');
      });

      test('should detect web content from URL', () => {
        const url = 'https://api.example.com/data';
        const result = detector.detectAssetType(url);
        expect(result).toBe('web');
      });

      test('should detect web content from HTML string', () => {
        const html = '<html><body><h1>Hello</h1></body></html>';
        const result = detector.detectAssetType(html);
        expect(result).toBe('web');
      });

      test('should detect code from file extension patterns', () => {
        const jsFilePath = '/tmp/component.js';
        const result = detector.detectAssetType(jsFilePath);
        expect(result).toBe('code');
      });

      test('should detect code from syntax patterns in content', () => {
        const codeContent = 'function hello() { console.log("Hello"); }';
        const result = detector.detectAssetType(codeContent);
        expect(result).toBe('code');
      });
    });

    describe('file extension detection', () => {
      test('should detect image from common extensions', () => {
        const imagePath = '/tmp/photo.jpg';
        const result = detector.detectAssetType(imagePath);
        expect(result).toBe('image');
      });

      test('should detect code from programming file extensions', () => {
        const pyFilePath = '/home/user/script.py';
        const result = detector.detectAssetType(pyFilePath);
        expect(result).toBe('code');
      });

      test('should detect JSON from .json extension', () => {
        const jsonFilePath = 'config.json';
        const result = detector.detectAssetType(jsonFilePath);
        expect(result).toBe('json');
      });
    });

    describe('default fallback', () => {
      test('should default to text for unrecognized content', () => {
        const unknownData = 'Some random text that doesn\'t match patterns';
        const result = detector.detectAssetType(unknownData);
        expect(result).toBe('text');
      });

      test('should default to text for empty string', () => {
        const result = detector.detectAssetType('');
        expect(result).toBe('text');
      });

      test('should default to text for null/undefined', () => {
        expect(detector.detectAssetType(null)).toBe('text');
        expect(detector.detectAssetType(undefined)).toBe('text');
      });
    });
  });

  describe('helper methods', () => {
    describe('isImageData', () => {
      test('should identify image buffers by headers', () => {
        const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF]);
        const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
        
        expect(detector.isImageData(jpegBuffer)).toBe(true);
        expect(detector.isImageData(pngBuffer)).toBe(true);
      });

      test('should identify image by file extension', () => {
        expect(detector.isImageData('/path/image.jpg')).toBe(true);
        expect(detector.isImageData('/path/image.png')).toBe(true);
        expect(detector.isImageData('/path/image.gif')).toBe(true);
        expect(detector.isImageData('image.webp')).toBe(true);
      });

      test('should reject non-image data', () => {
        expect(detector.isImageData('plain text')).toBe(false);
        expect(detector.isImageData({ key: 'value' })).toBe(false);
        expect(detector.isImageData('/path/file.txt')).toBe(false);
      });
    });

    describe('isJsonData', () => {
      test('should identify objects as JSON', () => {
        expect(detector.isJsonData({ key: 'value' })).toBe(true);
        expect(detector.isJsonData([])).toBe(true);
      });

      test('should identify valid JSON strings', () => {
        expect(detector.isJsonData('{"key": "value"}')).toBe(true);
        expect(detector.isJsonData('[1, 2, 3]')).toBe(true);
      });

      test('should reject invalid JSON strings', () => {
        expect(detector.isJsonData('not json')).toBe(false);
        expect(detector.isJsonData('{"invalid": json}')).toBe(false);
      });

      test('should identify JSON files by extension', () => {
        expect(detector.isJsonData('config.json')).toBe(true);
        expect(detector.isJsonData('/path/data.json')).toBe(true);
      });
    });

    describe('isTabularData', () => {
      test('should identify arrays of objects with consistent structure', () => {
        const data = [
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' }
        ];
        expect(detector.isTabularData(data)).toBe(true);
      });

      test('should identify CSV format strings', () => {
        const csv = 'id,name,age\n1,John,30\n2,Jane,25';
        expect(detector.isTabularData(csv)).toBe(true);
      });

      test('should identify TSV format strings', () => {
        const tsv = 'id\tname\tage\n1\tJohn\t30\n2\tJane\t25';
        expect(detector.isTabularData(tsv)).toBe(true);
      });

      test('should reject non-tabular data', () => {
        expect(detector.isTabularData('plain text')).toBe(false);
        expect(detector.isTabularData([1, 2, 3])).toBe(false); // Array of primitives
        expect(detector.isTabularData({ key: 'value' })).toBe(false); // Single object
      });
    });

    describe('isWebContent', () => {
      test('should identify HTTP/HTTPS URLs', () => {
        expect(detector.isWebContent('https://example.com')).toBe(true);
        expect(detector.isWebContent('http://localhost:3000')).toBe(true);
        expect(detector.isWebContent('https://api.service.com/data')).toBe(true);
      });

      test('should identify HTML content', () => {
        expect(detector.isWebContent('<html><body>content</body></html>')).toBe(true);
        expect(detector.isWebContent('<!DOCTYPE html><html></html>')).toBe(true);
      });

      test('should reject non-web content', () => {
        expect(detector.isWebContent('plain text')).toBe(false);
        expect(detector.isWebContent('/local/file/path')).toBe(false);
        expect(detector.isWebContent({ key: 'value' })).toBe(false);
      });
    });

    describe('isCodeFile', () => {
      test('should identify programming file extensions', () => {
        expect(detector.isCodeFile('/path/script.js')).toBe(true);
        expect(detector.isCodeFile('component.jsx')).toBe(true);
        expect(detector.isCodeFile('script.py')).toBe(true);
        expect(detector.isCodeFile('main.cpp')).toBe(true);
        expect(detector.isCodeFile('style.css')).toBe(true);
        expect(detector.isCodeFile('markup.html')).toBe(true);
      });

      test('should identify code patterns in content', () => {
        expect(detector.isCodeFile('function test() { return true; }')).toBe(true);
        expect(detector.isCodeFile('def hello_world():\n    print("Hello")')).toBe(true);
        expect(detector.isCodeFile('const value = 42;')).toBe(true);
        expect(detector.isCodeFile('#include <iostream>')).toBe(true);
      });

      test('should reject non-code content', () => {
        expect(detector.isCodeFile('plain text without code patterns')).toBe(false);
        expect(detector.isCodeFile('/path/document.txt')).toBe(false);
        expect(detector.isCodeFile('README.md')).toBe(false);
      });
    });

    describe('validateHint', () => {
      test('should validate image hint against image data', () => {
        const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF]);
        expect(detector.validateHint('image', imageBuffer)).toBe(true);
      });

      test('should validate JSON hint against JSON data', () => {
        const jsonData = { key: 'value' };
        expect(detector.validateHint('json', jsonData)).toBe(true);
      });

      test('should reject incompatible hint/asset combinations', () => {
        const textData = 'plain text';
        expect(detector.validateHint('image', textData)).toBe(false);
        expect(detector.validateHint('json', textData)).toBe(false);
      });

      test('should reject invalid hint values', () => {
        expect(detector.validateHint('invalid_type', 'any data')).toBe(false);
        expect(detector.validateHint('', 'any data')).toBe(false);
        expect(detector.validateHint(null, 'any data')).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    test('should handle malformed data gracefully', () => {
      // Should not throw, should fall back to default
      expect(() => detector.detectAssetType(Symbol('test'))).not.toThrow();
      expect(detector.detectAssetType(Symbol('test'))).toBe('text');
    });

    test('should handle circular object references', () => {
      const circular = { key: 'value' };
      circular.self = circular;
      
      expect(() => detector.detectAssetType(circular)).not.toThrow();
      // Should still detect as JSON despite circular reference
      expect(detector.detectAssetType(circular)).toBe('json');
    });
  });
});