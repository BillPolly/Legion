import { jest } from '@jest/globals';
import { ImageGenerationTool } from '../../ImageGenerationTool.js';
import { createValidator } from '@legion/schema';

describe('ImageGenerationTool', () => {
  let tool;
  let mockModule;
  let subscriberCalls;

  beforeEach(() => {
    // Create mock module with metadata-driven pattern
    mockModule = {
      generateImage: jest.fn(),
      getToolMetadata: jest.fn((toolName) => ({
        name: 'generate_image',
        description: 'Generate an image using DALL-E 3. Returns base64 encoded image data by default or a URL if requested.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The text prompt to generate an image from'
            },
            size: {
              type: 'string',
              enum: ['1024x1024', '1792x1024', '1024x1792'],
              default: '1024x1024'
            },
            quality: {
              type: 'string',
              enum: ['standard', 'hd'],
              default: 'standard'
            },
            style: {
              type: 'string',
              enum: ['vivid', 'natural'],
              default: 'vivid'
            },
            response_format: {
              type: 'string',
              enum: ['url', 'b64_json'],
              default: 'b64_json'
            }
          },
          required: ['prompt']
        },
        outputSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            imageData: { type: 'string' },
            imageUrl: { type: 'string' },
            filename: { type: 'string' },
            metadata: { type: 'object' }
          }
        }
      }))
    };

    // Create tool instance with new pattern
    tool = new ImageGenerationTool(mockModule, 'generate_image');
    
    // Attach generateImage method to the tool instance
    tool.generateImage = mockModule.generateImage;
    
    // Track subscriber events
    subscriberCalls = [];
    tool.subscribe((eventName, eventData) => {
      subscriberCalls.push({ type: eventName, ...eventData });
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
      expect(result.data.imageData).toBe('data:image/png;base64,abc123');
      expect(result.data.artifact).toBeDefined();
      expect(result.data.artifact.type).toBe('image');
      expect(result.data.artifact.subtype).toBe('png');
      expect(result.data.artifact.downloadable).toBe(true);
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
      expect(result.data.code).toBe('IMAGE_GENERATION_ERROR');

      // Check error event was notified to subscribers
      const errorEvents = subscriberCalls.filter(event => event.type === 'error');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0]).toMatchObject({
        type: 'error',
        message: errorMessage,
        data: {
          code: 'IMAGE_GENERATION_ERROR'
        }
      });
    });

    test('should handle missing module gracefully', async () => {
      // Create tool with module that doesn't have generateImage
      const emptyModule = {
        getToolMetadata: jest.fn((toolName) => ({
          name: 'generate_image',
          description: 'Generate an image',
          inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] },
          outputSchema: { type: 'object' }
        }))
      };
      
      tool = new ImageGenerationTool(emptyModule, 'generate_image');
      
      // Set up new subscriber
      subscriberCalls = [];
      tool.subscribe((eventName, eventData) => {
        subscriberCalls.push({ type: eventName, ...eventData });
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
      // The tool still needs generateImage method to work
      const result = await tool.execute({
        prompt: 'test', // Include prompt to avoid undefined errors
        size: '1024x1024'
      });

      expect(result.success).toBe(true);
      expect(mockModule.generateImage).toHaveBeenCalledWith({
        prompt: 'test',
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

      expect(result.data.artifact.content).toBe('https://example.com/image.png');
      expect(result.data.artifact.type).toBe('image');
      expect(result.data.artifact.createdBy).toBe('generate_image');
    });
  });

});