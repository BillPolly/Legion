/**
 * Live integration tests for AIGenerationModule using real OpenAI API
 * 
 * These tests require a valid OPENAI_API_KEY in the .env file
 * They make real API calls and may incur costs
 * 
 * Run with: npm test -- LiveImageGeneration.test.js
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '../modules/Tool.js';
import AIGenerationModule from '../../AIGenerationModule.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Increase timeout for API calls
jest.setTimeout(30000);

describe('AIGenerationModule - Live Integration Tests', () => {
  let resourceManager;
  let module;
  let testOutputDir;

  beforeAll(async () => {
    // Initialize ResourceManager to load .env file
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Check if we have the API key
    try {
      const apiKey = resourceManager.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.log('⚠️  Skipping live tests: OPENAI_API_KEY not found in .env file');
        return;
      }
    } catch (error) {
      console.log('⚠️  Skipping live tests: OPENAI_API_KEY not found in .env file');
      return;
    }

    // Create test output directory for generated images
    testOutputDir = path.join(__dirname, 'test-output');
    await fs.mkdir(testOutputDir, { recursive: true });
    
    console.log('🚀 Running live image generation tests with real OpenAI API');
  });

  beforeEach(async () => {
    // Skip if no API key
    try {
      resourceManager.env.OPENAI_API_KEY;
    } catch {
      return;
    }

    // Create module using ResourceManager
    module = await AIGenerationModule.create(resourceManager);
  });

  afterAll(async () => {
    // Clean up test output directory (optional - comment out to keep test images)
    // try {
    //   await fs.rm(testOutputDir, { recursive: true, force: true });
    // } catch (error) {
    //   console.warn('Could not clean up test output directory:', error);
    // }
  });

  describe('Module Creation and Initialization', () => {
    test('should create module with real API key', async () => {
      // Skip if no API key
      try {
        resourceManager.env.OPENAI_API_KEY;
      } catch {
        console.log('Skipping: No API key');
        return;
      }

      expect(module).toBeInstanceOf(AIGenerationModule);
      expect(module.llmClient).toBeDefined();
      expect(module.llmClient.supportsImageGeneration()).toBe(true);
    });
  });

  describe('Image Generation with Real API', () => {
    test('should generate a simple image with base64 response', async () => {
      // Skip if no API key
      try {
        resourceManager.env.OPENAI_API_KEY;
      } catch {
        console.log('Skipping: No API key');
        return;
      }

      const result = await module.generateImage({
        prompt: 'A simple red circle on a white background',
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
        response_format: 'b64_json'
      });

      // Verify result structure
      expect(result.success).toBe(true);
      expect(result.imageData).toBeDefined();
      expect(result.imageData).toMatch(/^data:image\/png;base64,/);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.prompt).toBe('A simple red circle on a white background');
      expect(result.metadata.revisedPrompt).toBeDefined();
      expect(result.filename).toMatch(/^dalle3-.*\.png$/);

      // Save the image to verify it's valid
      const base64Data = result.imageData.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const outputPath = path.join(testOutputDir, `test-circle-${Date.now()}.png`);
      await fs.writeFile(outputPath, imageBuffer);
      
      console.log(`✅ Generated image saved to: ${outputPath}`);
      console.log(`   Revised prompt: ${result.metadata.revisedPrompt}`);
      
      // Verify the file was created and has content
      const stats = await fs.stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    test('should generate an artistic image with natural style', async () => {
      // Skip if no API key
      try {
        resourceManager.env.OPENAI_API_KEY;
      } catch {
        console.log('Skipping: No API key');
        return;
      }

      const result = await module.generateImage({
        prompt: 'A serene Japanese garden with a koi pond and cherry blossoms, photorealistic',
        size: '1024x1024',
        quality: 'standard',
        style: 'natural',
        response_format: 'b64_json'
      });

      expect(result.success).toBe(true);
      expect(result.imageData).toBeDefined();
      expect(result.metadata.style).toBe('natural');
      
      // Save the artistic image
      const base64Data = result.imageData.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const outputPath = path.join(testOutputDir, `test-garden-${Date.now()}.png`);
      await fs.writeFile(outputPath, imageBuffer);
      
      console.log(`✅ Generated artistic image saved to: ${outputPath}`);
      console.log(`   Size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
    });

    test('should generate image with URL response format', async () => {
      // Skip if no API key
      try {
        resourceManager.env.OPENAI_API_KEY;
      } catch {
        console.log('Skipping: No API key');
        return;
      }

      const result = await module.generateImage({
        prompt: 'A futuristic cityscape at night with neon lights',
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
        response_format: 'url'
      });

      expect(result.success).toBe(true);
      expect(result.imageUrl).toBeDefined();
      expect(result.imageUrl).toMatch(/^https:\/\//);
      expect(result.imageData).toBeUndefined();
      
      console.log(`✅ Generated image URL: ${result.imageUrl}`);
      console.log(`   Note: This URL is temporary and will expire`);
    });

    test('should handle wide aspect ratio image', async () => {
      // Skip if no API key
      try {
        resourceManager.env.OPENAI_API_KEY;
      } catch {
        console.log('Skipping: No API key');
        return;
      }

      const result = await module.generateImage({
        prompt: 'A panoramic mountain landscape with snow-capped peaks at sunrise',
        size: '1792x1024',
        quality: 'standard',
        style: 'vivid',
        response_format: 'b64_json'
      });

      expect(result.success).toBe(true);
      expect(result.metadata.size).toBe('1792x1024');
      
      // Save the panoramic image
      const base64Data = result.imageData.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const outputPath = path.join(testOutputDir, `test-panorama-${Date.now()}.png`);
      await fs.writeFile(outputPath, imageBuffer);
      
      console.log(`✅ Generated panoramic image saved to: ${outputPath}`);
    });

    test('should handle tall aspect ratio image', async () => {
      // Skip if no API key
      try {
        resourceManager.env.OPENAI_API_KEY;
      } catch {
        console.log('Skipping: No API key');
        return;
      }

      const result = await module.generateImage({
        prompt: 'A tall waterfall in a tropical rainforest',
        size: '1024x1792',
        quality: 'standard',
        style: 'natural',
        response_format: 'b64_json'
      });

      expect(result.success).toBe(true);
      expect(result.metadata.size).toBe('1024x1792');
      
      // Save the tall image
      const base64Data = result.imageData.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const outputPath = path.join(testOutputDir, `test-waterfall-${Date.now()}.png`);
      await fs.writeFile(outputPath, imageBuffer);
      
      console.log(`✅ Generated tall image saved to: ${outputPath}`);
    });
  });

  describe('Error Handling with Real API', () => {
    test('should handle invalid prompt gracefully', async () => {
      // Skip if no API key
      try {
        resourceManager.env.OPENAI_API_KEY;
      } catch {
        console.log('Skipping: No API key');
        return;
      }

      // OpenAI may reject certain prompts based on content policy
      try {
        await module.generateImage({
          prompt: '', // Empty prompt
          response_format: 'b64_json'
        });
        fail('Should have thrown an error for empty prompt');
      } catch (error) {
        expect(error.message).toContain('Prompt is required');
      }
    });

    test('should handle invalid size parameter', async () => {
      // Skip if no API key
      try {
        resourceManager.env.OPENAI_API_KEY;
      } catch {
        console.log('Skipping: No API key');
        return;
      }

      try {
        await module.generateImage({
          prompt: 'A test image',
          size: '500x500', // Invalid size for DALL-E 3
          response_format: 'b64_json'
        });
        fail('Should have thrown an error for invalid size');
      } catch (error) {
        // OpenAI will reject invalid sizes
        expect(error.message).toBeDefined();
        console.log(`Expected error for invalid size: ${error.message}`);
      }
    });
  });

  describe('Artifact Structure Validation', () => {
    test('should return artifact-compatible structure', async () => {
      // Skip if no API key
      try {
        resourceManager.env.OPENAI_API_KEY;
      } catch {
        console.log('Skipping: No API key');
        return;
      }

      const result = await module.generateImage({
        prompt: 'A small test icon, minimalist design',
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json'
      });

      // Verify artifact-friendly structure
      expect(result.type).toBe('image');
      expect(result.subtype).toBe('png');
      expect(result.createdBy).toBe('generate_image');
      expect(result.filename).toBeDefined();
      expect(result.imageData).toBeDefined();
      
      // Should be ready for artifact system
      expect(result.success).toBe(true);
      expect(result.metadata).toHaveProperty('prompt');
      expect(result.metadata).toHaveProperty('model', 'dall-e-3');
      expect(result.metadata).toHaveProperty('timestamp');
    });
  });
});