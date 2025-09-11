/**
 * Integration test for image generation with artifact detection
 * 
 * Tests that generated images are properly detected as artifacts
 * and have the correct structure for display in the chat UI
 */

import { jest } from '@jest/globals';
import { ArtifactDetector } from '../../../../../../aiur/src/agents-bt/artifacts/ArtifactDetector.js';
import AIGenerationModule from '../../AIGenerationModule.js';

// Mock LLMClient for testing
const mockGenerateImage = jest.fn();
const mockSupportsImageGeneration = jest.fn();

jest.mock('@legion/llm-client', () => {
  return {
    LLMClient: jest.fn().mockImplementation(() => ({
      generateImage: mockGenerateImage,
      supportsImageGeneration: mockSupportsImageGeneration
    }))
  };
});

describe('Image Generation Artifact Integration', () => {
  let module;
  let artifactDetector;
  let mockResourceManager;

  beforeEach(async () => {
    // Reset mocks
    mockGenerateImage.mockReset();
    mockSupportsImageGeneration.mockReset();
    
    // Setup default mock behavior
    mockSupportsImageGeneration.mockReturnValue(true);
    mockGenerateImage.mockResolvedValue([{
      b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      revised_prompt: 'A detailed test image'
    }]);
    
    // Setup mock ResourceManager
    mockResourceManager = {
      get: jest.fn().mockImplementation((key) => {
        if (key === 'env.OPENAI_API_KEY') {
          return 'test-api-key';
        }
        throw new Error(`Resource not found: ${key}`);
      })
    };

    // Create module
    module = await AIGenerationModule.create(mockResourceManager);
    
    // Replace the real llmClient with our mock after initialization (same fix as unit tests)
    const mockLLMClient = {
      generateImage: mockGenerateImage,
      supportsImageGeneration: mockSupportsImageGeneration
    };
    module.llmClient = mockLLMClient;
    
    // Create artifact detector
    artifactDetector = new ArtifactDetector();
  });

  describe('Artifact Detection from Image Generation', () => {
    test('should detect base64 image as artifact', async () => {
      // Generate an image
      const result = await module.generateImage({
        prompt: 'A test image',
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
        response_format: 'b64_json'
      });

      // Detect artifacts from the result
      const artifacts = await artifactDetector.detectArtifacts('generate_image', result);

      // Verify artifact was detected
      expect(artifacts).toHaveLength(1);
      
      const artifact = artifacts[0];
      expect(artifact.type).toBe('image');
      expect(artifact.subtype).toBe('png');
      expect(artifact.title).toMatch(/^dalle3-.*\.png$/);
      expect(artifact.content).toMatch(/^data:image\/png;base64,/);
      expect(artifact.exists).toBe(true);
      expect(artifact.createdBy).toBe('generate_image');
      
      // Check metadata
      expect(artifact.metadata).toMatchObject({
        isGenerated: true,
        isBase64: true,
        downloadable: true,
        prompt: 'A test image',
        model: 'dall-e-3',
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid'
      });
    });

    test('should detect URL image as artifact', async () => {
      // Mock URL response
      mockGenerateImage.mockResolvedValue([{
        url: 'https://example.com/generated-image.png',
        revised_prompt: 'A detailed test image'
      }]);

      // Generate an image with URL format
      const result = await module.generateImage({
        prompt: 'A test image',
        response_format: 'url'
      });

      // Detect artifacts
      const artifacts = await artifactDetector.detectArtifacts('generate_image', result);

      // Verify artifact
      expect(artifacts).toHaveLength(1);
      
      const artifact = artifacts[0];
      expect(artifact.type).toBe('image');
      expect(artifact.content).toBe('https://example.com/generated-image.png');
      expect(artifact.metadata.isUrl).toBe(true);
      expect(artifact.metadata.isBase64).toBe(false);
      expect(artifact.metadata.downloadable).toBe(false);
    });

    test('should handle multiple image formats correctly', async () => {
      const testCases = [
        { size: '1024x1024', quality: 'standard', style: 'vivid' },
        { size: '1792x1024', quality: 'hd', style: 'natural' },
        { size: '1024x1792', quality: 'standard', style: 'natural' }
      ];

      for (const testCase of testCases) {
        const result = await module.generateImage({
          prompt: `Test with ${testCase.size}`,
          ...testCase,
          response_format: 'b64_json'
        });

        const artifacts = await artifactDetector.detectArtifacts('generate_image', result);
        
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].metadata.size).toBe(testCase.size);
        expect(artifacts[0].metadata.quality).toBe(testCase.quality);
        expect(artifacts[0].metadata.style).toBe(testCase.style);
      }
    });
  });

  describe('Artifact Structure for UI Display', () => {
    test('artifact should have all required fields for chat display', async () => {
      const result = await module.generateImage({
        prompt: 'A beautiful sunset',
        response_format: 'b64_json'
      });

      const artifacts = await artifactDetector.detectArtifacts('generate_image', result);
      const artifact = artifacts[0];

      // Check all required fields for UI display
      expect(artifact).toHaveProperty('id');
      expect(artifact).toHaveProperty('type', 'image');
      expect(artifact).toHaveProperty('subtype');
      expect(artifact).toHaveProperty('title');
      expect(artifact).toHaveProperty('content');
      expect(artifact).toHaveProperty('size');
      expect(artifact).toHaveProperty('exists', true);
      expect(artifact).toHaveProperty('preview');
      expect(artifact).toHaveProperty('createdBy', 'generate_image');
      expect(artifact).toHaveProperty('createdAt');
      expect(artifact).toHaveProperty('metadata');

      // ID should be unique
      expect(artifact.id).toMatch(/^artifact-\d+-[a-z0-9]+$/);
      
      // createdAt should be a valid ISO date
      expect(new Date(artifact.createdAt).toISOString()).toBe(artifact.createdAt);
    });

    test('artifact should be ready for ImageRenderer', async () => {
      const result = await module.generateImage({
        prompt: 'An icon for testing',
        response_format: 'b64_json'
      });

      const artifacts = await artifactDetector.detectArtifacts('generate_image', result);
      const artifact = artifacts[0];

      // ImageRenderer expects these fields
      expect(artifact.type).toBe('image');
      expect(artifact.content).toBeDefined();
      expect(artifact.content).toMatch(/^data:image\/png;base64,/);
      
      // Should be downloadable
      expect(artifact.metadata.downloadable).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should not create artifact when generation fails', async () => {
      const failedResult = {
        success: false,
        error: 'API error'
      };

      const artifacts = await artifactDetector.detectArtifacts('generate_image', failedResult);
      
      expect(artifacts).toHaveLength(0);
    });

    test('should handle missing image data gracefully', async () => {
      const emptyResult = {
        success: true,
        metadata: { prompt: 'test' }
        // No imageData or imageUrl
      };

      const artifacts = await artifactDetector.detectArtifacts('generate_image', emptyResult);
      
      expect(artifacts).toHaveLength(0);
    });
  });

  describe('Artifact Metadata Preservation', () => {
    test('should preserve all generation metadata', async () => {
      const result = await module.generateImage({
        prompt: 'A complex scene with many details',
        size: '1792x1024',
        quality: 'hd',
        style: 'natural',
        response_format: 'b64_json'
      });

      const artifacts = await artifactDetector.detectArtifacts('generate_image', result);
      const artifact = artifacts[0];

      // All metadata should be preserved
      expect(artifact.metadata).toMatchObject({
        prompt: 'A complex scene with many details',
        size: '1792x1024',
        quality: 'hd',
        style: 'natural',
        model: 'dall-e-3'
      });

      // Should have timestamp
      expect(artifact.metadata.timestamp).toBeDefined();
      expect(new Date(artifact.metadata.timestamp)).toBeInstanceOf(Date);
    });

    test('should include revised prompt when available', async () => {
      const result = await module.generateImage({
        prompt: 'A simple test',
        response_format: 'b64_json'
      });

      // The mock returns 'A detailed test image' as revised prompt
      expect(result.metadata.revisedPrompt).toBe('A detailed test image');
      
      const artifacts = await artifactDetector.detectArtifacts('generate_image', result);
      
      // The artifact metadata should include the revised prompt
      expect(artifacts[0].metadata.revisedPrompt).toBe('A detailed test image');
    });
  });
});