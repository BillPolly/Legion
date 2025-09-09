/**
 * Unit Tests for ShowAssetTool
 * 
 * Tests the core tool for displaying assets in floating windows
 */

import { ShowAssetTool } from '../../../src/tools/ShowAssetTool.js';
import { AssetTypeDetector } from '../../../src/detection/AssetTypeDetector.js';

describe('ShowAssetTool', () => {
  let tool;
  let assetDetector;

  beforeEach(() => {
    assetDetector = new AssetTypeDetector();
    tool = new ShowAssetTool({ assetDetector, testMode: true });
  });

  describe('constructor', () => {
    test('should initialize with asset detector', () => {
      expect(tool.assetDetector).toBe(assetDetector);
    });

    test('should throw error if no asset detector provided', () => {
      expect(() => new ShowAssetTool()).toThrow('requires assetDetector');
    });
  });

  describe('execute', () => {
    test('should return error for missing asset parameter', async () => {
      const result = await tool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter: asset');
    });

    test('should return error for null asset parameter', async () => {
      const result = await tool.execute({ asset: null });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter: asset');
    });

    test('should successfully display simple text asset', async () => {
      const result = await tool.execute({ asset: 'Hello World' });
      
      expect(result.success).toBe(true);
      expect(result.window_id).toMatch(/^showme_\d+_[a-z0-9]+$/);
      expect(result.detected_type).toBe('text');
      expect(result.title).toBe('Text Viewer');
    });

    test('should successfully display JSON asset', async () => {
      const asset = { key: 'value', number: 42 };
      const result = await tool.execute({ asset });
      
      expect(result.success).toBe(true);
      expect(result.window_id).toBeTruthy();
      expect(result.detected_type).toBe('json');
      expect(result.title).toBe('JSON Viewer');
    });

    test('should successfully display array data', async () => {
      const asset = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ];
      const result = await tool.execute({ asset });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('data');
      expect(result.title).toBe('Data Table');
    });

    test('should use provided title when given', async () => {
      const result = await tool.execute({
        asset: 'test content',
        title: 'Custom Title'
      });
      
      expect(result.success).toBe(true);
      expect(result.title).toBe('Custom Title');
    });

    test('should respect valid hint parameter', async () => {
      const result = await tool.execute({
        asset: { key: 'value' },
        hint: 'text'
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('text');
      expect(result.title).toBe('Text Viewer');
    });

    test('should ignore invalid hint and use auto-detection', async () => {
      const result = await tool.execute({
        asset: { key: 'value' },
        hint: 'image'
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('json');
    });
  });

  describe('title generation', () => {
    test('should generate appropriate title for image file path', async () => {
      const result = await tool.execute({
        asset: '/path/to/photo.jpg'
      });
      
      expect(result.title).toBe('Image: photo.jpg');
    });

    test('should generate appropriate title for code file path', async () => {
      const result = await tool.execute({
        asset: '/src/component.jsx'
      });
      
      expect(result.title).toBe('Code: component.jsx');
    });

    test('should generate appropriate title for URL', async () => {
      const result = await tool.execute({
        asset: 'https://api.example.com/data'
      });
      
      expect(result.title).toBe('Web: https://api.example.com/data');
    });

    test('should handle HTML content', async () => {
      const result = await tool.execute({
        asset: '<html><body>Test</body></html>'
      });
      
      expect(result.detected_type).toBe('web');
      expect(result.title).toBe('Web Content');
    });
  });

  describe('window ID generation', () => {
    test('should generate unique window IDs', async () => {
      const result1 = await tool.execute({ asset: 'test1' });
      const result2 = await tool.execute({ asset: 'test2' });
      
      expect(result1.window_id).not.toBe(result2.window_id);
      expect(result1.window_id).toMatch(/^showme_\d+_[a-z0-9]+$/);
      expect(result2.window_id).toMatch(/^showme_\d+_[a-z0-9]+$/);
    });
  });

  describe('error handling', () => {
    test('should handle asset detector errors gracefully', async () => {
      // Mock a failing asset detector
      const failingDetector = {
        detectAssetType: () => {
          throw new Error('Detection failed');
        }
      };
      const failingTool = new ShowAssetTool({ assetDetector: failingDetector, testMode: true });
      
      const result = await failingTool.execute({ asset: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to display asset');
    });

    test('should handle complex objects without errors', async () => {
      const complexAsset = {
        nested: {
          array: [1, 2, { deep: true }],
          fn: function() { return 'test'; },
          date: new Date(),
          regex: /test/g
        }
      };
      
      const result = await tool.execute({ asset: complexAsset });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('json');
    });

    test('should handle circular references in objects', async () => {
      const circular = { key: 'value' };
      circular.self = circular;
      
      const result = await tool.execute({ asset: circular });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('json');
    });
  });

  describe('asset preview generation', () => {
    test('should handle buffer assets in preview', async () => {
      const buffer = Buffer.from([0xFF, 0xD8, 0xFF]); // JPEG header
      const result = await tool.execute({ asset: buffer });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('image');
      expect(result.title).toBe('Image Viewer');
    });

    test('should handle very long text assets', async () => {
      const longText = 'a'.repeat(1000);
      const result = await tool.execute({ asset: longText });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('text');
    });
  });
});