import { describe, it, expect, beforeEach, beforeAll, afterEach } from '@jest/globals';
import FileProcessor from '../src/processors/FileProcessor.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('FileProcessor', () => {
  let fileProcessor;
  let testDir;

  beforeAll(async () => {
    // Create test directory structure
    testDir = '/tmp/semantic-search-file-test';
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test files
    await fs.writeFile(path.join(testDir, 'readme.md'), `# Test README

This is a test markdown file.

## Section One
Content for section one.

## Section Two  
Content for section two.`);

    await fs.writeFile(path.join(testDir, 'config.json'), JSON.stringify({
      name: 'test-config',
      version: '1.0.0',
      settings: {
        database: 'test-db',
        port: 3000
      }
    }, null, 2));

    await fs.writeFile(path.join(testDir, 'script.js'), `function hello() {
  console.log('Hello world');
}

function goodbye() {
  console.log('Goodbye world');
}

export { hello, goodbye };`);

    await fs.writeFile(path.join(testDir, 'notes.txt'), 'Simple text file with basic content for testing.');

    // Create subdirectory
    await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true });
    await fs.writeFile(path.join(testDir, 'subdir', 'nested.md'), '# Nested Document\n\nThis is in a subdirectory.');
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    fileProcessor = new FileProcessor({
      basePath: testDir,
      supportedFileTypes: ['.txt', '.md', '.json', '.js'],
      maxFileSize: 1024 * 1024
    });
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      expect(fileProcessor.options.basePath).toBe(testDir);
      expect(fileProcessor.options.supportedFileTypes).toContain('.txt');
      expect(fileProcessor.options.supportedFileTypes).toContain('.md');
    });

    it('should throw error without basePath', () => {
      expect(() => {
        new FileProcessor({});
      }).toThrow('basePath is required');
    });
  });

  describe('single file processing', () => {
    it('should process a markdown file', async () => {
      const filePath = path.join(testDir, 'readme.md');
      const result = await fileProcessor.processFile(filePath);
      
      expect(result.filePath).toBe(filePath);
      expect(result.contentType).toBe('text/markdown');
      expect(result.content).toContain('# Test README');
      expect(result.size).toBeGreaterThan(0);
      expect(result.metadata.filename).toBe('readme.md');
      expect(result.metadata.extension).toBe('.md');
    });

    it('should process a JSON file', async () => {
      const filePath = path.join(testDir, 'config.json');
      const result = await fileProcessor.processFile(filePath);
      
      expect(result.contentType).toBe('application/json');
      expect(result.content).toContain('test-config');
      expect(result.metadata.filename).toBe('config.json');
    });

    it('should process a JavaScript file', async () => {
      const filePath = path.join(testDir, 'script.js');
      const result = await fileProcessor.processFile(filePath);
      
      expect(result.contentType).toBe('text/javascript');
      expect(result.content).toContain('function hello');
      expect(result.metadata.filename).toBe('script.js');
    });

    it('should throw error for non-existent file', async () => {
      const nonExistentPath = path.join(testDir, 'missing.txt');
      
      await expect(
        fileProcessor.processFile(nonExistentPath)
      ).rejects.toThrow('File not found or not accessible');
    });

    it('should throw error for unsupported file type', async () => {
      // Create temporary unsupported file
      const unsupportedPath = path.join(testDir, 'image.png');
      await fs.writeFile(unsupportedPath, 'fake image data');
      
      await expect(
        fileProcessor.processFile(unsupportedPath)
      ).rejects.toThrow('Unsupported file type: .png');
      
      // Cleanup
      await fs.unlink(unsupportedPath);
    });
  });

  describe('directory processing', () => {
    it('should scan directory and find all supported files', async () => {
      const files = await fileProcessor.scanDirectory(testDir, { recursive: false });
      
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBe(4); // readme.md, config.json, script.js, notes.txt
      
      const filenames = files.map(f => path.basename(f.filePath));
      expect(filenames).toContain('readme.md');
      expect(filenames).toContain('config.json');
      expect(filenames).toContain('script.js');
      expect(filenames).toContain('notes.txt');
    });

    it('should scan directory recursively when requested', async () => {
      const files = await fileProcessor.scanDirectory(testDir, { recursive: true });
      
      expect(files.length).toBe(5); // Including nested.md
      
      const filenames = files.map(f => path.basename(f.filePath));
      expect(filenames).toContain('nested.md');
    });

    it('should filter files by extension', async () => {
      const files = await fileProcessor.scanDirectory(testDir, { 
        recursive: false,
        fileTypes: ['.md'] 
      });
      
      expect(files.length).toBe(1);
      expect(path.basename(files[0].filePath)).toBe('readme.md');
    });

    it('should respect file size limits', async () => {
      // Create a large file
      const largePath = path.join(testDir, 'large.txt');
      await fs.writeFile(largePath, 'x'.repeat(2000));
      
      const smallLimitProcessor = new FileProcessor({
        basePath: testDir,
        supportedFileTypes: ['.txt'],
        maxFileSize: 1000
      });
      
      const files = await smallLimitProcessor.scanDirectory(testDir, { recursive: false });
      
      // Should not include the large file
      const largeFile = files.find(f => path.basename(f.filePath) === 'large.txt');
      expect(largeFile).toBeUndefined();
      
      // Cleanup
      await fs.unlink(largePath);
    });
  });

  describe('batch file processing', () => {
    it('should process multiple files in batch', async () => {
      const files = await fileProcessor.scanDirectory(testDir, { recursive: false });
      const results = await fileProcessor.processFiles(files);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(files.length);
      
      // Each result should have processed content
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.filePath).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.contentType).toBeDefined();
      });
    });

    it('should handle errors in individual files gracefully', async () => {
      // Create a file that will cause processing error (unsupported type)
      const problematicPath = path.join(testDir, 'problem.png');
      await fs.writeFile(problematicPath, 'fake image data');
      
      const files = [
        { filePath: problematicPath, contentType: 'image/png' },
        { filePath: path.join(testDir, 'notes.txt'), contentType: 'text/plain' }
      ];
      
      const results = await fileProcessor.processFiles(files);
      
      expect(results).toHaveLength(2);
      
      // One should fail (unsupported), one should succeed  
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      expect(successCount).toBe(1);
      expect(errorCount).toBe(1);
      
      // Error result should have error message
      const errorResult = results.find(r => !r.success);
      expect(errorResult.error).toBeDefined();
      expect(errorResult.error).toContain('Unsupported file type');
      
      // Cleanup
      await fs.unlink(problematicPath);
    });
  });

  describe('path validation', () => {
    it('should validate paths are within basePath', () => {
      const validPath = path.join(testDir, 'readme.md');
      const invalidPath = '/etc/passwd';
      
      expect(fileProcessor.isPathAllowed(validPath)).toBe(true);
      expect(fileProcessor.isPathAllowed(invalidPath)).toBe(false);
    });

    it('should prevent path traversal attacks', () => {
      const maliciousPath = path.join(testDir, '../../../etc/passwd');
      const resolvedPath = path.resolve(maliciousPath);
      
      expect(fileProcessor.isPathAllowed(resolvedPath)).toBe(false);
    });
  });

  describe('file filtering', () => {
    it('should filter files by supported extensions', async () => {
      // Create unsupported file temporarily
      const unsupportedPath = path.join(testDir, 'image.png');
      await fs.writeFile(unsupportedPath, 'fake image');
      
      const filtered = await fileProcessor.filterSupportedFiles([
        path.join(testDir, 'readme.md'),
        path.join(testDir, 'script.js'),
        unsupportedPath
      ]);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(f => path.basename(f.filePath))).not.toContain('image.png');
      
      // Cleanup
      await fs.unlink(unsupportedPath);
    });
  });
});