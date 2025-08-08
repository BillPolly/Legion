import { jest } from '@jest/globals';
import { ImageGenerationTool } from '../../ImageGenerationTool.js';
import { z } from 'zod';

describe('ImageGenerationTool', () => {
  let tool;
  let mockModule;
  let mockEmit;

  beforeEach(() => {
    // Create mock module
    mockModule = {
      generateImage: jest.fn()
    };

    // Create tool instance
    tool = new ImageGenerationTool({ module: mockModule });
    
    // Mock emit method for event tracking
    mockEmit = jest.spyOn(tool, 'emit');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Tool Configuration', () => {
    test('should have correct name and description', () => {
      expect(tool.name).toBe('generate_image');
      expect(tool.description).toContain('Generate an image using DALL-E 3');
      expect(tool.description).toContain('base64 encoded image data by default');
    });

    test('should have valid input schema', () => {
      const schema = tool.inputSchema;
      
      // Test schema structure
      expect(schema).toBeInstanceOf(z.ZodObject);
      
      // Test required field
      const result = schema.safeParse({
        prompt: 'test prompt'
      });
      expect(result.success).toBe(true);
      
      // Test missing required field
      const invalidResult = schema.safeParse({});
      expect(invalidResult.success).toBe(false);
    });

    test('should validate optional parameters', () => {
      const validInputs = {
        prompt: 'test',
        size: '1792x1024',
        quality: 'hd',
        style: 'natural',
        response_format: 'url'
      };
      
      const result = tool.inputSchema.safeParse(validInputs);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInputs);
    });

    test('should reject invalid parameters', () => {
      const invalidInputs = {
        prompt: 'test',
        size: 'invalid-size',
        quality: 'ultra',
        style: 'abstract'
      };
      
      const result = tool.inputSchema.safeParse(invalidInputs);
      expect(result.success).toBe(false);
    });
  });

  describe('execute', () => {
    test('should successfully generate image with default parameters', async () => {
      const mockImageResult = {
        success: true,
        imageData: 'data:image/png;base64,abc123',
        filename: 'dalle3-2024-01-01.png',
        metadata: {
          prompt: 'A test image',
          revisedPrompt: 'A detailed test image',
          size: '1024x1024',
          quality: 'standard',
          style: 'vivid'
        }
      };
      
      mockModule.generateImage.mockResolvedValue(mockImageResult);

      const result = await tool.execute({
        prompt: 'A test image'
      });

      // Check module was called with validated parameters
      expect(mockModule.generateImage).toHaveBeenCalledWith({
        prompt: 'A test image',
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
        response_format: 'b64_json'
      });

      // Check result structure
      expect(result.success).toBe(true);
      expect(result.imageData).toBe('data:image/png;base64,abc123');
      expect(result.artifact).toBeDefined();
      expect(result.artifact.type).toBe('image');
      expect(result.artifact.subtype).toBe('png');
      expect(result.artifact.downloadable).toBe(true);
    });

    test('should emit progress events during execution', async () => {
      mockModule.generateImage.mockResolvedValue({
        success: true,
        imageData: 'data:image/png;base64,test'
      });

      await tool.execute({ prompt: 'test' });

      // Check progress events
      expect(mockEmit).toHaveBeenCalledWith('progress', expect.objectContaining({
        percentage: 10,
        status: expect.stringContaining('Preparing')
      }));
      
      expect(mockEmit).toHaveBeenCalledWith('progress', expect.objectContaining({
        percentage: 30,
        status: expect.stringContaining('Generating image')
      }));
      
      expect(mockEmit).toHaveBeenCalledWith('progress', expect.objectContaining({
        percentage: 90,
        status: expect.stringContaining('successfully')
      }));
      
      expect(mockEmit).toHaveBeenCalledWith('progress', expect.objectContaining({
        percentage: 100,
        status: 'Complete'
      }));
    });

    test('should handle module errors gracefully', async () => {
      const errorMessage = 'API rate limit exceeded';
      mockModule.generateImage.mockRejectedValue(new Error(errorMessage));

      const result = await tool.execute({ prompt: 'test' });

      // Check error handling
      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
      expect(result.code).toBe('IMAGE_GENERATION_ERROR');

      // Check error event was emitted
      expect(mockEmit).toHaveBeenCalledWith('error', expect.objectContaining({
        message: errorMessage,
        code: 'IMAGE_GENERATION_ERROR'
      }));
    });

    test('should handle missing module gracefully', async () => {
      tool = new ImageGenerationTool({}); // No module provided
      mockEmit = jest.spyOn(tool, 'emit');

      const result = await tool.execute({ prompt: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('AIGenerationModule instance not available');
    });

    test('should validate input parameters', async () => {
      const result = await tool.execute({
        // Missing required 'prompt' field
        size: '1024x1024'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Required');
    });

    test('should format artifact correctly for URL response', async () => {
      const mockImageResult = {
        success: true,
        imageUrl: 'https://example.com/image.png',
        filename: 'dalle3-2024.png',
        metadata: {
          prompt: 'test'
        }
      };
      
      mockModule.generateImage.mockResolvedValue(mockImageResult);

      const result = await tool.execute({
        prompt: 'test',
        response_format: 'url'
      });

      expect(result.artifact.content).toBe('https://example.com/image.png');
      expect(result.artifact.type).toBe('image');
      expect(result.artifact.createdBy).toBe('generate_image');
    });
  });

  describe('fromModule', () => {
    test('should create tool from module instance', () => {
      const mockModuleInstance = {
        generateImage: jest.fn()
      };

      const toolFromModule = ImageGenerationTool.fromModule(mockModuleInstance);

      expect(toolFromModule).toBeInstanceOf(ImageGenerationTool);
      expect(toolFromModule.module).toBe(mockModuleInstance);
    });
  });
});