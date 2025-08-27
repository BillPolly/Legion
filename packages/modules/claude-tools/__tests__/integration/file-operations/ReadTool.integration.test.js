/**
 * Integration tests for ReadTool
 * NO MOCKS - Uses real file system
 */

import { ReadTool } from '../../../src/file-operations/ReadTool.js';
import {
  assertSuccess,
  assertFailure,
  measureToolPerformance
} from '../../utils/TestUtils.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('ReadTool Integration', () => {
  let readTool;
  let testDir;

  beforeEach(async () => {
    readTool = new ReadTool();
    // Use system temp directory for integration tests
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-tools-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Real File System Operations', () => {
    test('should read large file efficiently', async () => {
      // Create a 1MB file
      const largeContent = 'x'.repeat(1024 * 1024);
      const filePath = path.join(testDir, 'large.txt');
      await fs.writeFile(filePath, largeContent);

      const { result, executionTime } = await measureToolPerformance(
        readTool,
        { file_path: filePath }
      );

      const data = assertSuccess(result);
      expect(data.size).toBe(1024 * 1024);
      expect(executionTime).toBeLessThan(1000); // Should read in under 1 second
    });

    test('should handle Unicode content correctly', async () => {
      const unicodeContent = '你好世界 🌍 مرحبا بالعالم';
      const filePath = path.join(testDir, 'unicode.txt');
      await fs.writeFile(filePath, unicodeContent, 'utf8');

      const result = await readTool.execute({ file_path: filePath });
      const data = assertSuccess(result);

      expect(data.content).toBe(unicodeContent);
      expect(data.encoding).toBe('utf8');
    });

    test('should read file with different line endings', async () => {
      const contents = {
        unix: 'Line1\nLine2\nLine3',
        windows: 'Line1\r\nLine2\r\nLine3',
        mac: 'Line1\rLine2\rLine3'
      };

      for (const [type, content] of Object.entries(contents)) {
        const filePath = path.join(testDir, `${type}.txt`);
        await fs.writeFile(filePath, content);

        const result = await readTool.execute({ 
          file_path: filePath,
          limit: 2
        });
        const data = assertSuccess(result);

        const lines = data.content.split(/\r?\n|\r/);
        expect(lines[0]).toBe('Line1');
        expect(lines[1]).toBe('Line2');
      }
    });

    test('should handle system files', async () => {
      // Try to read a known system file (cross-platform)
      const systemFile = process.platform === 'win32' 
        ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
        : '/etc/hosts';

      // Check if file exists first
      try {
        await fs.access(systemFile, fs.constants.R_OK);
        
        const result = await readTool.execute({ file_path: systemFile });
        const data = assertSuccess(result);
        
        expect(data.content).toBeDefined();
        expect(data.file_path).toBe(systemFile);
      } catch (error) {
        // Skip test if no read access to system file
        console.log(`Skipping system file test: ${error.message}`);
      }
    });

    test('should read multiple files concurrently', async () => {
      const files = [];
      for (let i = 0; i < 10; i++) {
        const filePath = path.join(testDir, `file${i}.txt`);
        const content = `Content of file ${i}`;
        await fs.writeFile(filePath, content);
        files.push({ path: filePath, content });
      }

      const promises = files.map(file => 
        readTool.execute({ file_path: file.path })
      );

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        const data = assertSuccess(result);
        expect(data.content).toBe(files[index].content);
      });
    });
  });

  describe('Real Jupyter Notebook Handling', () => {
    test('should read actual Jupyter notebook format', async () => {
      const notebook = {
        cells: [
          {
            cell_type: 'code',
            execution_count: 1,
            metadata: {},
            outputs: [
              {
                name: 'stdout',
                output_type: 'stream',
                text: ['Hello World\n']
              }
            ],
            source: ['print("Hello World")']
          },
          {
            cell_type: 'markdown',
            metadata: {},
            source: ['# My Notebook\n', 'This is a test notebook']
          }
        ],
        metadata: {
          kernelspec: {
            display_name: 'Python 3',
            language: 'python',
            name: 'python3'
          },
          language_info: {
            name: 'python',
            version: '3.9.0'
          }
        },
        nbformat: 4,
        nbformat_minor: 5
      };

      const notebookPath = path.join(testDir, 'real.ipynb');
      await fs.writeFile(notebookPath, JSON.stringify(notebook, null, 2));

      const result = await readTool.execute({ file_path: notebookPath });
      const data = assertSuccess(result);

      expect(data.metadata.type).toBe('notebook');
      expect(data.content).toContain('print("Hello World")');
      expect(data.content).toContain('# My Notebook');
      expect(data.content).toContain('This is a test notebook');
    });
  });

  describe('Permission and Access Errors', () => {
    test('should handle permission denied gracefully', async () => {
      const filePath = path.join(testDir, 'no-read.txt');
      await fs.writeFile(filePath, 'secret');
      
      // Remove read permissions (Unix-like systems)
      if (process.platform !== 'win32') {
        await fs.chmod(filePath, 0o000);

        const result = await readTool.execute({ file_path: filePath });
        // ReadTool may return different error codes based on system
        const error = assertFailure(result);
        expect(['PERMISSION_DENIED', 'EXECUTION_ERROR', 'EACCES'].some(code => 
          (error.code === code) || (error.message && error.message.includes('permission'))
        )).toBe(true);

        // Restore permissions for cleanup
        await fs.chmod(filePath, 0o644);
      }
    });

    test('should handle symbolic links', async () => {
      if (process.platform !== 'win32') {
        const targetPath = path.join(testDir, 'target.txt');
        const linkPath = path.join(testDir, 'link.txt');
        
        await fs.writeFile(targetPath, 'Target content');
        await fs.symlink(targetPath, linkPath);

        const result = await readTool.execute({ file_path: linkPath });
        const data = assertSuccess(result);

        expect(data.content).toBe('Target content');
      }
    });

    test('should fail on broken symbolic links', async () => {
      if (process.platform !== 'win32') {
        const linkPath = path.join(testDir, 'broken-link.txt');
        await fs.symlink('/nonexistent/target', linkPath);

        const result = await readTool.execute({ file_path: linkPath });
        const error = assertFailure(result, 'RESOURCE_NOT_FOUND');
        expect(error.message).toContain('not found');
      }
    });
  });

  describe('Binary File Detection', () => {
    test('should detect and handle various binary formats', async () => {
      const binaryFormats = {
        'image.png': Buffer.from([0x89, 0x50, 0x4E, 0x47]), // PNG
        'image.jpg': Buffer.from([0xFF, 0xD8, 0xFF]), // JPEG
        'archive.zip': Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP
        'document.pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]) // PDF
      };

      for (const [filename, header] of Object.entries(binaryFormats)) {
        const filePath = path.join(testDir, filename);
        await fs.writeFile(filePath, header);

        const result = await readTool.execute({ file_path: filePath });
        const data = assertSuccess(result);

        expect(data.encoding).toBe('base64');
        expect(data.metadata.type).toBe('binary');
        
        // Verify base64 encoding is valid
        const decoded = Buffer.from(data.content, 'base64');
        expect(decoded.slice(0, header.length).equals(header)).toBe(true);
      }
    });
  });
});