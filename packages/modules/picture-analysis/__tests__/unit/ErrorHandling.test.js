import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PictureAnalysisTool } from '../../src/PictureAnalysisTool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Error Handling and Edge Cases', () => {
  const testFilesDir = path.join(__dirname, '../testdata');
  let mockLLMClient;
  let tool;
  
  beforeEach(() => {
    // Create test files directory
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
    
    // Create test image file (1x1 pixel PNG)
    const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(path.join(testFilesDir, 'test.png'), pngData);
    
    // Create mock LLM client
    mockLLMClient = {
      _mockCalls: [],
      _mockResolvedValue: 'Default mock response',
      _mockRejectedValue: null
    };
    
    // Add mock functionality
    mockLLMClient.sendAndReceiveResponse = function(...args) {
      mockLLMClient._mockCalls.push(args);
      if (mockLLMClient._mockRejectedValue) {
        return Promise.reject(mockLLMClient._mockRejectedValue);
      }
      return Promise.resolve(mockLLMClient._mockResolvedValue);
    };
    
    mockLLMClient.mockResolvedValue = function(value) {
      mockLLMClient._mockResolvedValue = value;
      mockLLMClient._mockRejectedValue = null;
    };
    
    mockLLMClient.mockRejectedValue = function(error) {
      mockLLMClient._mockRejectedValue = error;
      mockLLMClient._mockResolvedValue = null;
    };
    
    mockLLMClient.mockClear = function() {
      mockLLMClient._mockCalls = [];
      mockLLMClient._mockResolvedValue = 'Default mock response';
      mockLLMClient._mockRejectedValue = null;
    };
    
    // Create tool instance
    tool = new PictureAnalysisTool({ llmClient: mockLLMClient });
    
    // Add error listener to prevent unhandled error events
    tool.subscribe(() => {});
  });
  
  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  describe('File Path Error Categories', () => {
    test('FILE_NOT_FOUND: Non-existent file', async () => {
      await expect(tool.execute({
        file_path: 'definitely-does-not-exist.png',
        prompt: 'Describe this image'
      })).rejects.toThrow();
      
      // Test the thrown error has the right structure
      try {
        await tool.execute({
          file_path: 'definitely-does-not-exist.png',
          prompt: 'Describe this image'
        });
      } catch (error) {
        expect(error.cause.errorCode).toBe('FILE_NOT_FOUND');
        expect(error.cause.file_path).toBe('definitely-does-not-exist.png');
      }
    });

    test('FILE_NOT_FOUND: Directory instead of file', async () => {
      await expect(tool.execute({
        file_path: testFilesDir,  // This is a directory, not a file
        prompt: 'Describe this image'
      })).rejects.toThrow();
      
      try {
        await tool.execute({
          file_path: testFilesDir,
          prompt: 'Describe this image'
        });
      } catch (error) {
        expect(error.cause.errorCode).toBe('FILE_NOT_FOUND');
      }
    });
  });

  describe('File Format Error Categories', () => {
    test('UNSUPPORTED_FORMAT: Text file', async () => {
      // Create a text file with image extension
      const textFile = path.join(testFilesDir, 'fake-image.png');
      fs.writeFileSync(textFile, 'This is just text, not an image');
      
      await expect(tool.execute({
        file_path: textFile,
        prompt: 'Describe this image'
      })).rejects.toThrow();
      
      try {
        await tool.execute({
          file_path: textFile,
          prompt: 'Describe this image'
        });
      } catch (error) {
        expect(error.cause.errorCode).toBe('UNSUPPORTED_FORMAT');
      }
    });

    test('UNSUPPORTED_FORMAT: File without extension', async () => {
      const noExtFile = path.join(testFilesDir, 'no-extension-file');
      fs.writeFileSync(noExtFile, 'random content');
      
      await expect(tool.execute({
        file_path: noExtFile,
        prompt: 'Describe this image'
      })).rejects.toThrow();
      
      try {
        await tool.execute({
          file_path: noExtFile,
          prompt: 'Describe this image'
        });
      } catch (error) {
        expect(error.cause.errorCode).toBe('UNSUPPORTED_FORMAT');
      }
    });
  });

  describe('File Size Error Categories', () => {
    test('FILE_TOO_LARGE: File exceeding 20MB limit', async () => {
      // Create a large file (simulate > 20MB)
      const largeFile = path.join(testFilesDir, 'huge.png');
      const largeData = Buffer.alloc(21 * 1024 * 1024, 'x'); // 21MB of 'x'
      fs.writeFileSync(largeFile, largeData);
      
      await expect(tool.execute({
        file_path: largeFile,
        prompt: 'Describe this image'
      })).rejects.toThrow();
      
      try {
        await tool.execute({
          file_path: largeFile,
          prompt: 'Describe this image'
        });
      } catch (error) {
        expect(error.cause.errorCode).toBe('FILE_TOO_LARGE');
      }
    });

    test('Empty file should be categorized as encoding error', async () => {
      const emptyFile = path.join(testFilesDir, 'empty.png');
      fs.writeFileSync(emptyFile, '');
      
      await expect(tool.execute({
        file_path: emptyFile,
        prompt: 'Describe this image'
      })).rejects.toThrow();
      
      try {
        await tool.execute({
          file_path: emptyFile,
          prompt: 'Describe this image'
        });
      } catch (error) {
        expect(error.cause.errorCode).toBe('ENCODING_ERROR');
      }
    });
  });

  describe('LLM API Error Categories', () => {
    test('LLM_API_ERROR: Network error during API call', async () => {
      // Mock LLM client to throw a network error
      mockLLMClient.mockRejectedValue(new Error('Network timeout'));
      
      await expect(tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this image'
      })).rejects.toThrow();
      
      try {
        await tool.execute({
          file_path: path.join(testFilesDir, 'test.png'),
          prompt: 'Describe this image'
        });
      } catch (error) {
        expect(error.cause.errorCode).toBe('LLM_API_ERROR');
      }
    });

    test('LLM_API_ERROR: Authentication error', async () => {
      mockLLMClient.mockRejectedValue(new Error('Authentication failed'));
      
      await expect(tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this image'
      })).rejects.toThrow();
    });

    test('LLM_API_ERROR: Rate limit exceeded', async () => {
      mockLLMClient.mockRejectedValue(new Error('Rate limit exceeded'));
      
      await expect(tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this image'
      })).rejects.toThrow();
    });
  });

  describe('Success Cases', () => {
    test('Valid image analysis completes successfully', async () => {
      mockLLMClient.mockResolvedValue('This is a detailed analysis of the image...');
      
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this image in detail'
      });
      
      expect(result).toBeDefined();
      expect(result.analysis).toBe('This is a detailed analysis of the image...');
      expect(result.file_path).toBe(path.join(testFilesDir, 'test.png'));
      expect(result.prompt).toBe('Describe this image in detail');
      expect(result.processing_time_ms).toBeGreaterThan(0);
    });

    test('Complex analysis request with multiple details', async () => {
      const complexAnalysis = 'Complex multi-paragraph analysis with technical details...';
      mockLLMClient.mockResolvedValue(complexAnalysis);
      
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Provide a detailed technical analysis including colors, composition, objects, text, and any technical specifications you can identify'
      });
      
      expect(result.analysis).toBe(complexAnalysis);
      expect(result.processing_time_ms).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Boundary Testing', () => {
    test('Minimum valid prompt length (10 characters)', async () => {
      mockLLMClient.mockResolvedValue('Brief analysis');
      
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: '1234567890' // exactly 10 characters
      });
      
      expect(result.analysis).toBe('Brief analysis');
    });

    test('Maximum valid prompt length (2000 characters)', async () => {
      mockLLMClient.mockResolvedValue('Comprehensive analysis');
      const maxPrompt = 'a'.repeat(2000);
      
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: maxPrompt
      });
      
      expect(result.analysis).toBe('Comprehensive analysis');
      expect(result.prompt).toBe(maxPrompt);
    });

    test('File exactly at 20MB limit should pass validation', async () => {
      const exactFile = path.join(testFilesDir, 'exact-20mb.png');
      // Create valid PNG header
      const pngHeader = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
      const paddedData = Buffer.concat([pngHeader, Buffer.alloc(20 * 1024 * 1024 - pngHeader.length, 0)]);
      fs.writeFileSync(exactFile, paddedData);
      
      mockLLMClient.mockResolvedValue('Analysis of large image');
      
      const result = await tool.execute({
        file_path: exactFile,
        prompt: 'Describe this large image'
      });
      
      expect(result.analysis).toBe('Analysis of large image');
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('Tool should recover after errors', async () => {
      // First call fails
      await expect(tool.execute({
        file_path: 'non-existent.png',
        prompt: 'Describe this image'
      })).rejects.toThrow();
      
      // Second call should work
      mockLLMClient.mockResolvedValue('Recovery successful');
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this working image'
      });
      
      expect(result.analysis).toBe('Recovery successful');
    });
  });
});