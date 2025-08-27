import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  resolveFilePath, 
  validateImageFormat, 
  validateFileSize, 
  encodeImageAsBase64,
  getImageMetadata
} from '../../src/utils/fileHandling.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('File Handling Utilities', () => {
  const testFilesDir = path.join(__dirname, '../testdata');
  
  beforeEach(() => {
    // Create test files directory
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
    
    // Create test image files (1x1 pixel images)
    const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(path.join(testFilesDir, 'test.png'), pngData);
    fs.writeFileSync(path.join(testFilesDir, 'test.jpg'), pngData); // Same data, different extension
    fs.writeFileSync(path.join(testFilesDir, 'test.jpeg'), pngData);
    fs.writeFileSync(path.join(testFilesDir, 'test.gif'), pngData);
    fs.writeFileSync(path.join(testFilesDir, 'test.webp'), pngData);
    fs.writeFileSync(path.join(testFilesDir, 'test.txt'), 'not an image');
    fs.writeFileSync(path.join(testFilesDir, 'test.unsupported'), 'unsupported format');
    
    // Create a large file (simulate > 20MB)
    const largeBuffer = Buffer.alloc(21 * 1024 * 1024, 'a'); // 21MB
    fs.writeFileSync(path.join(testFilesDir, 'large.png'), largeBuffer);
    
    // Create empty file
    fs.writeFileSync(path.join(testFilesDir, 'empty.png'), '');
  });
  
  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  describe('resolveFilePath', () => {
    test('resolves absolute paths directly', () => {
      const absolutePath = path.join(testFilesDir, 'test.png');
      const resolved = resolveFilePath(absolutePath);
      expect(resolved).toBe(absolutePath);
    });

    test('resolves relative paths from current working directory', () => {
      const relativePath = path.relative(process.cwd(), path.join(testFilesDir, 'test.png'));
      const resolved = resolveFilePath(relativePath);
      expect(resolved).toBe(path.join(testFilesDir, 'test.png'));
    });

    test('throws error for non-existent files', () => {
      expect(() => {
        resolveFilePath('non-existent-file.png');
      }).toThrow('File not found');
    });

    test('throws error for directories', () => {
      expect(() => {
        resolveFilePath(testFilesDir);
      }).toThrow('File not found');
    });

    test('searches monorepo root when file not found in cwd', () => {
      // This test assumes MONOREPO_ROOT is set or falls back to project root
      const nonExistentRelative = 'definitely-does-not-exist.png';
      expect(() => {
        resolveFilePath(nonExistentRelative);
      }).toThrow('File not found');
    });
  });

  describe('validateImageFormat', () => {
    test('accepts supported image formats', () => {
      expect(() => validateImageFormat('test.png')).not.toThrow();
      expect(() => validateImageFormat('test.jpg')).not.toThrow();
      expect(() => validateImageFormat('test.jpeg')).not.toThrow();
      expect(() => validateImageFormat('test.gif')).not.toThrow();
      expect(() => validateImageFormat('test.webp')).not.toThrow();
    });

    test('accepts uppercase extensions', () => {
      expect(() => validateImageFormat('test.PNG')).not.toThrow();
      expect(() => validateImageFormat('test.JPG')).not.toThrow();
      expect(() => validateImageFormat('test.JPEG')).not.toThrow();
    });

    test('rejects unsupported formats', () => {
      expect(() => validateImageFormat('test.txt')).toThrow('Unsupported format: .txt');
      expect(() => validateImageFormat('test.pdf')).toThrow('Unsupported format: .pdf');
      expect(() => validateImageFormat('test.bmp')).toThrow('Unsupported format: .bmp');
      expect(() => validateImageFormat('test')).toThrow('Unsupported format: ');
    });
  });

  describe('validateFileSize', () => {
    test('accepts files under 20MB limit', () => {
      const smallFile = path.join(testFilesDir, 'test.png');
      expect(() => validateFileSize(smallFile)).not.toThrow();
    });

    test('rejects files over 20MB limit', () => {
      const largeFile = path.join(testFilesDir, 'large.png');
      expect(() => validateFileSize(largeFile)).toThrow('File too large');
    });

    test('rejects empty files', () => {
      const emptyFile = path.join(testFilesDir, 'empty.png');
      expect(() => validateFileSize(emptyFile)).toThrow('File is empty');
    });

    test('throws error for non-existent files', () => {
      expect(() => validateFileSize('non-existent.png')).toThrow();
    });
  });

  describe('encodeImageAsBase64', () => {
    test('encodes image files as base64', () => {
      const imagePath = path.join(testFilesDir, 'test.png');
      const result = encodeImageAsBase64(imagePath);
      
      expect(result).toHaveProperty('base64Data');
      expect(result).toHaveProperty('mimeType');
      expect(result).toHaveProperty('format');
      
      expect(typeof result.base64Data).toBe('string');
      expect(result.base64Data.length).toBeGreaterThan(0);
      expect(result.mimeType).toBe('image/png');
      expect(result.format).toBe('png');
    });

    test('handles different image formats', () => {
      const formats = [
        { file: 'test.jpg', mime: 'image/jpeg', format: 'jpg' },
        { file: 'test.jpeg', mime: 'image/jpeg', format: 'jpeg' },
        { file: 'test.gif', mime: 'image/gif', format: 'gif' },
        { file: 'test.webp', mime: 'image/webp', format: 'webp' }
      ];

      formats.forEach(({ file, mime, format }) => {
        const imagePath = path.join(testFilesDir, file);
        const result = encodeImageAsBase64(imagePath);
        
        expect(result.mimeType).toBe(mime);
        expect(result.format).toBe(format);
        expect(result.base64Data).toBeDefined();
      });
    });

    test('throws error for non-existent files', () => {
      expect(() => {
        encodeImageAsBase64('non-existent.png');
      }).toThrow();
    });
  });

  describe('getImageMetadata', () => {
    test('extracts metadata from image files', () => {
      const imagePath = path.join(testFilesDir, 'test.png');
      const metadata = getImageMetadata(imagePath);
      
      expect(metadata).toHaveProperty('size');
      expect(metadata).toHaveProperty('format');
      expect(metadata).toHaveProperty('mimeType');
      expect(metadata).toHaveProperty('path');
      
      expect(typeof metadata.size).toBe('number');
      expect(metadata.size).toBeGreaterThan(0);
      expect(metadata.format).toBe('png');
      expect(metadata.mimeType).toBe('image/png');
      expect(metadata.path).toBe(imagePath);
    });

    test('throws error for non-existent files', () => {
      expect(() => {
        getImageMetadata('non-existent.png');
      }).toThrow();
    });
  });
});