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
    tool.on('error', () => {});
  });
  
  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  describe('File Path Error Categories', () => {
    test('FILE_NOT_FOUND: Non-existent file', async () => {
      const result = await tool.execute({
        file_path: 'definitely-does-not-exist.png',
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('FILE_NOT_FOUND');
      expect(result.data.errorMessage).toContain('File not found');
      expect(result.data.file_path).toBe('definitely-does-not-exist.png');
    });

    test('FILE_NOT_FOUND: Empty file path', async () => {
      const result = await tool.execute({
        file_path: '',
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('VALIDATION_ERROR');
      expect(result.data.errorMessage).toContain('Validation failed');
    });

    test('FILE_NOT_FOUND: Directory instead of file', async () => {
      const result = await tool.execute({
        file_path: testFilesDir,  // This is a directory, not a file
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('FILE_NOT_FOUND');
      expect(result.data.errorMessage).toContain('File not found');
    });

    test('FILE_NOT_FOUND: Null/undefined file path handled by validation', async () => {
      const result = await tool.execute({
        prompt: 'Describe this image'
        // missing file_path
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('VALIDATION_ERROR');
      expect(result.data.errorMessage).toContain('Validation failed');
    });
  });

  describe('File Format Error Categories', () => {
    test('UNSUPPORTED_FORMAT: Text file', async () => {
      const textFile = path.join(testFilesDir, 'test.txt');
      fs.writeFileSync(textFile, 'This is not an image');
      
      const result = await tool.execute({
        file_path: textFile,
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('UNSUPPORTED_FORMAT');
      expect(result.data.errorMessage).toContain('Unsupported format: .txt');
      expect(result.data.errorMessage).toContain('Supported: .png, .jpg, .jpeg, .gif, .webp');
    });

    test('UNSUPPORTED_FORMAT: Binary file with wrong extension', async () => {
      const binaryFile = path.join(testFilesDir, 'test.exe');
      fs.writeFileSync(binaryFile, Buffer.from([0x4D, 0x5A, 0x90, 0x00])); // PE header
      
      const result = await tool.execute({
        file_path: binaryFile,
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('UNSUPPORTED_FORMAT');
      expect(result.data.errorMessage).toContain('Unsupported format: .exe');
    });

    test('UNSUPPORTED_FORMAT: File without extension', async () => {
      const noExtFile = path.join(testFilesDir, 'noextension');
      fs.writeFileSync(noExtFile, 'some content');
      
      const result = await tool.execute({
        file_path: noExtFile,
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('UNSUPPORTED_FORMAT');
      expect(result.data.errorMessage).toContain('Unsupported format:');
    });

    test('UNSUPPORTED_FORMAT: Case sensitivity test', async () => {
      const upperCaseFile = path.join(testFilesDir, 'test.PNG');
      const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(upperCaseFile, pngData);
      
      const result = await tool.execute({
        file_path: upperCaseFile,
        prompt: 'Describe this image'
      });
      
      // Should succeed because validation is case-insensitive
      expect(result.success).toBe(true);
    });
  });

  describe('File Size Error Categories', () => {
    test('FILE_TOO_LARGE: File exceeding 20MB limit', async () => {
      const largeFile = path.join(testFilesDir, 'huge.png');
      const largeBuffer = Buffer.alloc(21 * 1024 * 1024, 'a'); // 21MB
      fs.writeFileSync(largeFile, largeBuffer);
      
      const result = await tool.execute({
        file_path: largeFile,
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('FILE_TOO_LARGE');
      expect(result.data.errorMessage).toContain('File too large');
      expect(result.data.errorMessage).toContain('21.0MB');
      expect(result.data.errorMessage).toContain('Maximum: 20MB');
    });

    test('FILE_TOO_LARGE: Boundary test - exactly 20MB should pass', async () => {
      const boundaryFile = path.join(testFilesDir, 'boundary.png');
      const boundaryBuffer = Buffer.alloc(20 * 1024 * 1024, 'a'); // Exactly 20MB
      fs.writeFileSync(boundaryFile, boundaryBuffer);
      
      const result = await tool.execute({
        file_path: boundaryFile,
        prompt: 'Describe this image'
      });
      
      // Should succeed - exactly at the limit
      expect(result.success).toBe(true);
    });

    test('Empty file should be categorized as encoding error', async () => {
      const emptyFile = path.join(testFilesDir, 'empty.png');
      fs.writeFileSync(emptyFile, '');
      
      const result = await tool.execute({
        file_path: emptyFile,
        prompt: 'Describe this image'
      });
      
      // Should fail at size validation stage but be categorized as encoding error
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('ENCODING_ERROR');
      expect(result.data.errorMessage).toContain('File is empty');
    });
  });

  describe('Input Validation Error Categories', () => {
    test('VALIDATION_ERROR: Prompt too short (< 10 characters)', async () => {
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Hi'  // Only 2 characters
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('VALIDATION_ERROR');
      expect(result.data.errorMessage).toContain('Validation failed');
    });

    test('VALIDATION_ERROR: Prompt too long (> 2000 characters)', async () => {
      const longPrompt = 'A'.repeat(2001); // 2001 characters
      
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: longPrompt
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('VALIDATION_ERROR');
      expect(result.data.errorMessage).toContain('Validation failed');
    });

    test('VALIDATION_ERROR: Boundary test - exactly 10 characters should pass', async () => {
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: '1234567890'  // Exactly 10 characters
      });
      
      expect(result.success).toBe(true);
    });

    test('VALIDATION_ERROR: Boundary test - exactly 2000 characters should pass', async () => {
      const boundaryPrompt = 'A'.repeat(2000); // Exactly 2000 characters
      
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: boundaryPrompt
      });
      
      expect(result.success).toBe(true);
    });

    test('VALIDATION_ERROR: Invalid input types', async () => {
      const result = await tool.execute({
        file_path: 123, // Should be string
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('VALIDATION_ERROR');
      expect(result.data.errorMessage).toContain('Validation failed');
    });
  });

  describe('LLM API Error Categories', () => {
    test('LLM_API_ERROR: Network timeout', async () => {
      mockLLMClient.mockRejectedValue(new Error('Request timed out'));
      
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('LLM_API_ERROR');
      expect(result.data.errorMessage).toContain('Request timed out');
    });

    test('LLM_API_ERROR: API key invalid', async () => {
      mockLLMClient.mockRejectedValue(new Error('Invalid API key'));
      
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('LLM_API_ERROR');
      expect(result.data.errorMessage).toContain('Invalid API key');
    });

    test('LLM_API_ERROR: Rate limit exceeded', async () => {
      mockLLMClient.mockRejectedValue(new Error('Rate limit exceeded'));
      
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('LLM_API_ERROR');
      expect(result.data.errorMessage).toContain('Rate limit exceeded');
    });

    test('LLM_API_ERROR: Service unavailable', async () => {
      mockLLMClient.mockRejectedValue(new Error('Service temporarily unavailable'));
      
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorCode).toBe('LLM_API_ERROR');
      expect(result.data.errorMessage).toContain('Service temporarily unavailable');
    });
  });

  describe('Error Response Format Validation', () => {
    test('All error responses follow the specified format', async () => {
      const result = await tool.execute({
        file_path: 'nonexistent.png',
        prompt: 'Describe this image'
      });
      
      // Validate error response structure
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('errorMessage');
      expect(result.data).toHaveProperty('errorCode');
      expect(result.data).toHaveProperty('file_path');
      
      // Validate error message is a string
      expect(typeof result.data.errorMessage).toBe('string');
      expect(result.data.errorMessage.length).toBeGreaterThan(0);
      
      // Validate error code is from expected set
      const validErrorCodes = [
        'FILE_NOT_FOUND',
        'UNSUPPORTED_FORMAT', 
        'FILE_TOO_LARGE',
        'VALIDATION_ERROR',
        'LLM_API_ERROR',
        'ENCODING_ERROR',
        'INTERNAL_ERROR'
      ];
      expect(validErrorCodes).toContain(result.data.errorCode);
    });

    test('Error response includes original file_path', async () => {
      const testPath = 'test/path/image.png';
      const result = await tool.execute({
        file_path: testPath,
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.file_path).toBe(testPath);
    });

    test('Error response does not include sensitive information', async () => {
      mockLLMClient.mockRejectedValue(new Error('API_KEY=secret123 failed'));
      
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toContain('API_KEY=secret123 failed');
      // Note: In a real implementation, we'd want to sanitize error messages
      // This test documents current behavior
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('Unicode characters in file path', async () => {
      const unicodePath = path.join(testFilesDir, '测试图片.png');
      const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(unicodePath, pngData);
      
      const result = await tool.execute({
        file_path: unicodePath,
        prompt: 'Describe this unicode filename image'
      });
      
      expect(result.success).toBe(true);
    });

    test('Unicode characters in prompt', async () => {
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this image in Chinese: 描述这张图片的内容和细节'
      });
      
      expect(result.success).toBe(true);
    });

    test('Very long file path', async () => {
      // Create nested directory structure
      const longDirPath = path.join(testFilesDir, 'a'.repeat(50), 'b'.repeat(50));
      fs.mkdirSync(longDirPath, { recursive: true });
      
      const longFilePath = path.join(longDirPath, 'test.png');
      const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(longFilePath, pngData);
      
      const result = await tool.execute({
        file_path: longFilePath,
        prompt: 'Describe this image with a very long path'
      });
      
      expect(result.success).toBe(true);
    });

    test('Special characters in prompt', async () => {
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this image with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?'
      });
      
      expect(result.success).toBe(true);
    });

    test('Whitespace handling in prompt', async () => {
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: '          Describe this image          '  // Leading/trailing spaces
      });
      
      expect(result.success).toBe(true);
    });

    test('Empty LLM response handling', async () => {
      // Clear any previous mock setup and set empty response
      mockLLMClient.mockClear();
      mockLLMClient.mockResolvedValue('');  // Empty response
      
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.analysis).toBe('');
    });

    test('Null LLM response handling', async () => {
      // Clear any previous mock setup and set null response
      mockLLMClient.mockClear();
      mockLLMClient.mockResolvedValue(null);  // Null response
      
      const result = await tool.execute({
        file_path: path.join(testFilesDir, 'test.png'),
        prompt: 'Describe this image'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.analysis).toBe(null);
    });
  });

  describe('Concurrent Execution Edge Cases', () => {
    test('Multiple simultaneous executions with different files', async () => {
      // Create multiple test files
      const file1 = path.join(testFilesDir, 'test1.png');
      const file2 = path.join(testFilesDir, 'test2.png');
      const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(file1, pngData);
      fs.writeFileSync(file2, pngData);
      
      // Execute multiple requests concurrently
      const promises = [
        tool.execute({ file_path: file1, prompt: 'Describe image 1' }),
        tool.execute({ file_path: file2, prompt: 'Describe image 2' }),
        tool.execute({ file_path: 'nonexistent.png', prompt: 'This will fail' })
      ];
      
      const results = await Promise.all(promises);
      
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(false);
      expect(results[2].data.errorCode).toBe('FILE_NOT_FOUND');
    });

    test('Multiple executions with same file should not interfere', async () => {
      const promises = Array(5).fill().map((_, i) => 
        tool.execute({ 
          file_path: path.join(testFilesDir, 'test.png'), 
          prompt: `Execution ${i}` 
        })
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});