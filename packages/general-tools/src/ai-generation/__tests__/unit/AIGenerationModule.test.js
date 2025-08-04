import { jest } from '@jest/globals';
import AIGenerationModule from '../../AIGenerationModule.js';

// Mock LLMClient
jest.mock('@legion/llm', () => {
  return {
    LLMClient: jest.fn().mockImplementation(() => ({
      generateImage: jest.fn(),
      supportsImageGeneration: jest.fn().mockReturnValue(true)
    }))
  };
});

describe('AIGenerationModule', () => {
  let mockResourceManager;
  
  beforeEach(() => {
    // Create mock ResourceManager
    mockResourceManager = {
      get: jest.fn().mockImplementation((key) => {
        if (key === 'env.OPENAI_API_KEY') {
          return 'test-api-key-123';
        }
        throw new Error(`Resource not found: ${key}`);
      })
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Module Creation', () => {
    test('should create module with valid API key', async () => {
      const module = await AIGenerationModule.create(mockResourceManager);
      
      expect(module).toBeInstanceOf(AIGenerationModule);
      expect(module.name).toBe('AIGenerationModule');
      expect(module.description).toContain('AI-powered content generation');
      expect(mockResourceManager.get).toHaveBeenCalledWith('env.OPENAI_API_KEY');
    });

    test('should throw error when API key is missing', async () => {
      mockResourceManager.get.mockImplementation(() => null);
      
      await expect(AIGenerationModule.create(mockResourceManager))
        .rejects.toThrow('OPENAI_API_KEY environment variable is required');
    });

    test('should initialize LLMClient during initialization', async () => {
      const module = await AIGenerationModule.create(mockResourceManager);
      
      expect(module.llmClient).toBeDefined();
      expect(module.llmClient.generateImage).toBeDefined();
      expect(module.llmClient.supportsImageGeneration()).toBe(true);
    });
  });

  describe('generateImage', () => {
    let module;
    let mockGenerateImage;

    beforeEach(async () => {
      const { LLMClient } = await import('@legion/llm');
      mockGenerateImageImage = jest.fn();
      LLMClient.mockImplementation(() => ({
        generateImage: mockGenerateImage,
        supportsImageGeneration: jest.fn().mockReturnValue(true)
      }));
      
      module = await AIGenerationModule.create(mockResourceManager);
    });

    test('should generate image with default parameters', async () => {
      const mockResponse = [{
        b64_json: 'base64encodedimage',
        revised_prompt: 'A detailed mountain landscape'
      }];
      mockGenerateImageImage.mockResolvedValue(mockResponse);

      const result = await module.generateImage({
        prompt: 'A mountain landscape'
      });

      expect(mockGenerate).toHaveBeenCalledWith({
        model: 'dall-e-3',
        prompt: 'A mountain landscape',
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
        response_format: 'b64_json'
      });

      expect(result.success).toBe(true);
      expect(result.imageData).toBe('data:image/png;base64,base64encodedimage');
      expect(result.metadata.prompt).toBe('A mountain landscape');
      expect(result.metadata.revisedPrompt).toBe('A detailed mountain landscape');
      expect(result.filename).toMatch(/^dalle3-.*\.png$/);
    });

    test('should generate image with custom parameters', async () => {
      const mockResponse = [{
        b64_json: 'custombase64image',
        revised_prompt: 'A photorealistic sunset'
      }];
      mockGenerateImage.mockResolvedValue(mockResponse);

      const result = await module.generateImage({
        prompt: 'A sunset',
        size: '1792x1024',
        quality: 'hd',
        style: 'natural'
      });

      expect(mockGenerate).toHaveBeenCalledWith({
        model: 'dall-e-3',
        prompt: 'A sunset',
        n: 1,
        size: '1792x1024',
        quality: 'hd',
        style: 'natural',
        response_format: 'b64_json'
      });

      expect(result.metadata.size).toBe('1792x1024');
      expect(result.metadata.quality).toBe('hd');
      expect(result.metadata.style).toBe('natural');
    });

    test('should handle URL response format', async () => {
      const mockResponse = [{
        url: 'https://example.com/generated-image.png',
        revised_prompt: 'A beautiful landscape'
      }];
      mockGenerateImage.mockResolvedValue(mockResponse);

      const result = await module.generateImage({
        prompt: 'A landscape',
        response_format: 'url'
      });

      expect(result.success).toBe(true);
      expect(result.imageUrl).toBe('https://example.com/generated-image.png');
      expect(result.imageData).toBeUndefined();
    });

    test('should throw error when prompt is missing', async () => {
      await expect(module.generateImage({}))
        .rejects.toThrow('Prompt is required for image generation');
    });

    test('should handle LLM API errors', async () => {
      mockGenerateImage.mockRejectedValue(new Error('OpenAI Image Generation Error: Invalid API key'));

      await expect(module.generateImage({ prompt: 'test' }))
        .rejects.toThrow('Image generation failed: OpenAI Image Generation Error: Invalid API key');
    });

    test('should handle unexpected errors', async () => {
      mockGenerateImage.mockRejectedValue(new Error('Network error'));

      await expect(module.generateImage({ prompt: 'test' }))
        .rejects.toThrow('Image generation failed: Network error');
    });

    test('should handle unexpected response format', async () => {
      mockGenerateImage.mockResolvedValue([{}]); // No b64_json or url

      await expect(module.generateImage({ prompt: 'test' }))
        .rejects.toThrow('Unexpected response format from DALL-E API');
    });
  });

  describe('getTools', () => {
    test('should return empty array for GenericModule compatibility', async () => {
      const module = await AIGenerationModule.create(mockResourceManager);
      const tools = module.getTools();
      
      expect(tools).toEqual([]);
    });
  });
});