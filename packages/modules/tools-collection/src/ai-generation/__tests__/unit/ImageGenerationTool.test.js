import { jest } from '@jest/globals';
import { ImageGenerationTool } from '../../ImageGenerationTool.js';
import { createValidator } from '@legion/schema';

describe('ImageGenerationTool', () => {
  let tool;
  let mockModule;
  let subscriberCalls;

  beforeEach(() => {
    // Create mock module
    mockModule = {
      generateImage: jest.fn()
    };

    // Create tool instance
    tool = new ImageGenerationTool({ module: mockModule });
    
    // Track subscriber events
    subscriberCalls = [];
    tool.subscribe((event) => {
      subscriberCalls.push(event);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    subscriberCalls = [];
  });

  describe('Tool Configuration', () => {
    test('should have correct name and description', () => {
      expect(tool.name).toBe('generate_image');
      expect(tool.description).toContain('Generate an image using DALL-E 3');
      expect(tool.description).toContain('base64 encoded image data by default');
    });

    test('should have valid input schema as plain JSON Schema', () => {
      const schema = tool.inputSchema;
      
      // Test schema structure - should be plain JSON Schema object
      expect(schema.type).toBe('object');
      expect(schema.properties.prompt).toBeDefined();
      expect(schema.required).toContain('prompt');
      
      // Test validation with @legion/schema
      const validator = createValidator(schema);
      
      const result = validator.validate({
        prompt: 'test prompt'
      });
      expect(result.valid).toBe(true);
      
      // Test missing required field
      const invalidResult = validator.validate({});
      expect(invalidResult.valid).toBe(false);
    });

    test('should validate optional parameters', () => {
      const validator = createValidator(tool.inputSchema);
      
      const validInputs = {
        prompt: 'test',
        size: '1792x1024',
        quality: 'hd',
        style: 'natural',
        response_format: 'url'
      };
      
      const result = validator.validate(validInputs);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(validInputs);
    });

    test('should reject invalid parameters', () => {
      const validator = createValidator(tool.inputSchema);
      
      const invalidInputs = {
        prompt: 'test',
        size: 'invalid-size',
        quality: 'ultra',
        style: 'abstract'
      };
      
      const result = validator.validate(invalidInputs);
      expect(result.valid).toBe(false);
    });
  });

  describe('execute', () => {
    test('should successfully generate image with provided parameters', async () => {
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

      // Check module was called with provided parameters (tool doesn't validate)
      expect(mockModule.generateImage).toHaveBeenCalledWith({
        prompt: 'A test image'
      });

      // Check result structure
      expect(result.success).toBe(true);
      expect(result.imageData).toBe('data:image/png;base64,abc123');
      expect(result.artifact).toBeDefined();
      expect(result.artifact.type).toBe('image');
      expect(result.artifact.subtype).toBe('png');
      expect(result.artifact.downloadable).toBe(true);
    });

    test('should notify subscribers with progress events during execution', async () => {
      mockModule.generateImage.mockResolvedValue({
        success: true,
        imageData: 'data:image/png;base64,test'
      });

      await tool.execute({ prompt: 'test' });

      // Check progress events through subscriber
      const progressEvents = subscriberCalls.filter(event => event.type === 'progress');
      expect(progressEvents).toHaveLength(4);
      
      expect(progressEvents[0]).toMatchObject({
        type: 'progress',
        percentage: 10,
        message: expect.stringContaining('Preparing')
      });
      
      expect(progressEvents[1]).toMatchObject({
        type: 'progress',
        percentage: 30,
        message: expect.stringContaining('Generating image')
      });
      
      expect(progressEvents[2]).toMatchObject({
        type: 'progress',
        percentage: 90,
        message: expect.stringContaining('successfully')
      });
      
      expect(progressEvents[3]).toMatchObject({
        type: 'progress',
        percentage: 100,
        message: 'Complete'
      });
    });

    test('should handle module errors gracefully', async () => {
      const errorMessage = 'API rate limit exceeded';
      mockModule.generateImage.mockRejectedValue(new Error(errorMessage));

      const result = await tool.execute({ prompt: 'test' });

      // Check error handling
      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
      expect(result.code).toBe('IMAGE_GENERATION_ERROR');

      // Check error event was notified to subscribers
      const errorEvents = subscriberCalls.filter(event => event.type === 'error');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0]).toMatchObject({
        type: 'error',
        message: errorMessage,
        code: 'IMAGE_GENERATION_ERROR'
      });
    });

    test('should handle missing module gracefully', async () => {
      tool = new ImageGenerationTool({}); // No module provided
      
      // Set up new subscriber
      subscriberCalls = [];
      tool.subscribe((event) => {
        subscriberCalls.push(event);
      });

      const result = await tool.execute({ prompt: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('AIGenerationModule instance not available');
    });

    test('should execute without validation (validation happens at invocation layer)', async () => {
      mockModule.generateImage.mockResolvedValue({
        success: true,
        imageData: 'data:image/png;base64,test'
      });
      
      // Tool should execute even with "invalid" input - validation happens at invocation layer
      const result = await tool.execute({
        // Missing required 'prompt' field - but tool doesn't validate
        size: '1024x1024'
      });

      expect(result.success).toBe(true);
      expect(mockModule.generateImage).toHaveBeenCalledWith({
        size: '1024x1024'
      });
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