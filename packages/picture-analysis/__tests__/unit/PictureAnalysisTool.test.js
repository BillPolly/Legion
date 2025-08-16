import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PictureAnalysisTool } from '../../src/PictureAnalysisTool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('PictureAnalysisTool', () => {
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
    fs.writeFileSync(path.join(testFilesDir, 'test.jpg'), pngData);
    
    // Create mock LLM client with manual mock functions
    mockLLMClient = {
      sendAndReceiveResponse: function() {},
      getProviderName: () => 'Mock',
      currentModel: 'mock-vision-model',
      _mockCalls: [],
      _mockResolvedValue: null,
      _mockRejectedValue: null
    };
    
    // Add mock functionality
    mockLLMClient.sendAndReceiveResponse = function(...args) {
      mockLLMClient._mockCalls.push(args);
      if (mockLLMClient._mockRejectedValue) {
        return Promise.reject(mockLLMClient._mockRejectedValue);
      }
      return Promise.resolve(mockLLMClient._mockResolvedValue || 'Default mock response');
    };
    
    // Helper methods
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
      mockLLMClient._mockResolvedValue = null;
      mockLLMClient._mockRejectedValue = null;
    };
    
    // Create tool instance
    tool = new PictureAnalysisTool({ llmClient: mockLLMClient });
    
    // Add error listener to prevent unhandled error events
    tool.on('error', () => {}); // Silently handle error events during tests
    
    // Clear mock calls
    mockLLMClient.mockClear();
  });
  
  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  describe('Tool Metadata', () => {
    test('has correct name', () => {
      expect(tool.name).toBe('analyse_picture');
    });

    test('has correct description', () => {
      expect(tool.description).toContain('Analyze images using AI vision models');
    });

    test('has Zod input schema', () => {
      expect(tool.validator).toBeDefined();
      expect(tool.validator.zodSchema).toBeDefined();
    });

    test('validates correct input schema', () => {
      const validInput = {
        file_path: '/path/to/image.png',
        prompt: 'Describe what you see in this image'
      };
      
      const validation = tool.validator.validate(validInput);
      expect(validation.valid).toBe(true);
      expect(validation.data).toEqual(validInput);
    });

    test('rejects invalid input schema', () => {
      const invalidInput = {
        file_path: '',
        prompt: 'short'
      };
      
      const validation = tool.validator.validate(invalidInput);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeDefined();
    });
  });

  describe('File Path Resolution and Validation', () => {
    test('executes with valid absolute path', async () => {
      const imagePath = path.join(testFilesDir, 'test.png');
      mockLLMClient.mockResolvedValue('Mock analysis result');
      
      const result = await tool.execute({
        file_path: imagePath,
        prompt: 'Describe this image in detail'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.analysis).toBe('Mock analysis result');
      expect(result.data.file_path).toBe(imagePath);
    });

    test('executes with valid relative path', async () => {
      const relativePath = path.relative(process.cwd(), path.join(testFilesDir, 'test.png'));
      mockLLMClient.mockResolvedValue('Mock analysis result');
      
      const result = await tool.execute({
        file_path: relativePath,
        prompt: 'Describe this image in detail'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.analysis).toBe('Mock analysis result');
    });

    test('returns error for non-existent file', async () => {
      const result = await tool.execute({
        file_path: 'non-existent-file.png',
        prompt: 'Describe this image in detail'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toContain('File not found');
      expect(result.data.errorCode).toBe('FILE_NOT_FOUND');
    });

    test('returns error for unsupported format', async () => {
      const textFile = path.join(testFilesDir, 'test.txt');
      fs.writeFileSync(textFile, 'not an image');
      
      const result = await tool.execute({
        file_path: textFile,
        prompt: 'Describe this image in detail'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toContain('Unsupported format: .txt');
      expect(result.data.errorCode).toBe('UNSUPPORTED_FORMAT');
    });

    test('returns error for oversized file', async () => {
      const largeFile = path.join(testFilesDir, 'large.png');
      const largeBuffer = Buffer.alloc(21 * 1024 * 1024, 'a'); // 21MB
      fs.writeFileSync(largeFile, largeBuffer);
      
      const result = await tool.execute({
        file_path: largeFile,
        prompt: 'Describe this image in detail'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toContain('File too large');
      expect(result.data.errorCode).toBe('FILE_TOO_LARGE');
    });
  });

  describe('LLM Vision API Integration', () => {
    test('constructs correct vision API request', async () => {
      const imagePath = path.join(testFilesDir, 'test.png');
      mockLLMClient.mockResolvedValue('Detailed analysis result');
      
      await tool.execute({
        file_path: imagePath,
        prompt: 'What objects do you see in this image?'
      });
      
      expect(mockLLMClient._mockCalls.length).toBe(1);
      const call = mockLLMClient._mockCalls[0];
      expect(call[0]).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What objects do you see in this image?' },
            { 
              type: 'image_url', 
              image_url: { 
                url: expect.stringMatching(/^data:image\/png;base64,/)
              } 
            }
          ]
        }
      ]);
      expect(call[1]).toEqual({
        max_tokens: 1000,
        temperature: 0.7
      });
    });

    test('handles different image formats correctly', async () => {
      const jpgPath = path.join(testFilesDir, 'test.jpg');
      mockLLMClient.mockResolvedValue('JPG analysis result');
      
      await tool.execute({
        file_path: jpgPath,
        prompt: 'Analyze this JPG image'
      });
      
      const call = mockLLMClient._mockCalls[0];
      const imageUrl = call[0][0].content[1].image_url.url;
      expect(imageUrl).toMatch(/^data:image\/jpeg;base64,/);
    });

    test('measures processing time', async () => {
      const imagePath = path.join(testFilesDir, 'test.png');
      
      // Simulate delay in API call
      mockLLMClient.sendAndReceiveResponse = function(...args) {
        mockLLMClient._mockCalls.push(args);
        return new Promise(resolve => setTimeout(() => resolve('Delayed result'), 100));
      };
      
      const result = await tool.execute({
        file_path: imagePath,
        prompt: 'Process this image slowly'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.processing_time_ms).toBeGreaterThan(50);
      expect(typeof result.data.processing_time_ms).toBe('number');
    });

    test('handles LLM API errors', async () => {
      const imagePath = path.join(testFilesDir, 'test.png');
      mockLLMClient.mockRejectedValue(new Error('API rate limit exceeded'));
      
      const result = await tool.execute({
        file_path: imagePath,
        prompt: 'Analyze this image'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toContain('API rate limit exceeded');
      expect(result.data.errorCode).toBe('LLM_API_ERROR');
    });
  });

  describe('Output Format', () => {
    test('returns correct success format', async () => {
      const imagePath = path.join(testFilesDir, 'test.png');
      mockLLMClient.mockResolvedValue('This is a detailed analysis of the image showing various elements.');
      
      const result = await tool.execute({
        file_path: imagePath,
        prompt: 'Provide detailed analysis'
      });
      
      expect(result).toMatchObject({
        success: true,
        data: {
          analysis: 'This is a detailed analysis of the image showing various elements.',
          file_path: imagePath,
          prompt: 'Provide detailed analysis',
          processing_time_ms: expect.any(Number)
        }
      });
    });

    test('returns correct error format', async () => {
      const result = await tool.execute({
        file_path: 'missing-file.png',
        prompt: 'Analyze missing file'
      });
      
      expect(result).toMatchObject({
        success: false,
        data: {
          errorMessage: expect.any(String),
          errorCode: 'FILE_NOT_FOUND',
          file_path: 'missing-file.png'
        }
      });
    });
  });

  describe('Event Emission', () => {
    test('emits progress events during execution', async () => {
      const imagePath = path.join(testFilesDir, 'test.png');
      mockLLMClient.mockResolvedValue('Analysis complete');
      
      const progressEvents = [];
      tool.on('progress', (event) => progressEvents.push(event));
      
      await tool.execute({
        file_path: imagePath,
        prompt: 'Track progress'
      });
      
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toMatchObject({
        tool: 'analyse_picture',
        message: expect.any(String),
        percentage: expect.any(Number)
      });
    });

    test('emits error events on failure', async () => {
      const errorEvents = [];
      tool.on('error', (event) => errorEvents.push(event));
      
      await tool.execute({
        file_path: 'non-existent.png',
        prompt: 'This will fail'
      });
      
      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0]).toMatchObject({
        tool: 'analyse_picture',
        message: expect.any(String)
      });
    });
  });

  describe('Input Validation', () => {
    test('validates through Tool base class', async () => {
      // This should be caught by the Tool base class validation
      const result = await tool.execute({
        file_path: '',
        prompt: 'short'
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toContain('Validation failed');
    });

    test('handles missing parameters gracefully', async () => {
      const result = await tool.execute({
        file_path: '/path/to/image.png'
        // missing prompt
      });
      
      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toContain('Validation failed');
    });
  });
});