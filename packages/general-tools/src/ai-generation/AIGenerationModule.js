import { Module } from '@legion/module-loader';
import { LLMClient } from '@legion/llm';

/**
 * AIGenerationModule - Module for AI-powered content generation
 * Currently supports DALL-E 3 image generation via LLMClient
 */
export default class AIGenerationModule extends Module {
  constructor(dependencies = {}) {
    super();
    this.name = 'AIGenerationModule';
    this.description = 'AI-powered content generation tools including DALL-E 3 image generation';
    this.dependencies = dependencies;
    this.llmClient = null;
  }

  /**
   * Static async factory method following the ResourceManager pattern
   * @param {ResourceManager} resourceManager - The resource manager for dependency injection
   * @returns {Promise<AIGenerationModule>} Initialized module instance
   */
  static async create(resourceManager) {
    // Get OpenAI API key from environment
    const apiKey = resourceManager.get('env.OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for AI generation module');
    }
    
    // Create module with dependencies
    const module = new AIGenerationModule({ apiKey });
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Initialize LLMClient with OpenAI provider for image generation
    if (this.dependencies.apiKey) {
      this.llmClient = new LLMClient({
        provider: 'openai',
        apiKey: this.dependencies.apiKey,
        model: 'dall-e-3' // Default model for images
      });
    } else {
      throw new Error('OpenAI API key is required for initialization');
    }
    
    // Verify that the provider supports image generation
    if (!this.llmClient.supportsImageGeneration()) {
      throw new Error('OpenAI provider should support image generation but check failed');
    }
  }

  /**
   * Generate an image using DALL-E 3
   * @param {Object} params - Generation parameters
   * @param {string} params.prompt - Text description of the image
   * @param {string} params.size - Image size (1024x1024, 1792x1024, 1024x1792)
   * @param {string} params.quality - Image quality (standard, hd)
   * @param {string} params.style - Image style (vivid, natural)
   * @param {string} params.response_format - Response format (b64_json, url)
   * @returns {Promise<Object>} Generated image data and metadata
   */
  async generateImage(params) {
    console.log('[AIGenerationModule] === UPDATED VERSION WITH LOGGING ===');
    const {
      prompt,
      size = '1024x1024',
      quality = 'standard',
      style = 'vivid',
      response_format = 'b64_json'
    } = params;

    console.log('[AIGenerationModule] generateImage called with:', {
      prompt: prompt ? prompt.substring(0, 50) + '...' : 'NO PROMPT',
      size,
      quality,
      style,
      response_format
    });

    if (!prompt) {
      throw new Error('Prompt is required for image generation');
    }

    if (!this.llmClient) {
      console.error('[AIGenerationModule] LLMClient is null - was initialize() called?');
      throw new Error('LLMClient not initialized. Module may not have been initialized properly.');
    }

    try {
      console.log(`[AIGenerationModule] Starting DALL-E 3 image generation...`);
      console.log(`  Prompt: "${prompt.substring(0, 50)}..."`);
      console.log(`  Using LLMClient:`, this.llmClient.constructor.name);
      
      // Call LLMClient's image generation method
      console.log('[AIGenerationModule] Calling llmClient.generateImage()...');
      const response = await this.llmClient.generateImage({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size,
        quality: quality,
        style: style,
        response_format: response_format
      });

      console.log('[AIGenerationModule] Received response from LLMClient');
      
      // Extract the generated image data (response is an array from provider)
      const imageData = Array.isArray(response) ? response[0] : response;
      console.log('[AIGenerationModule] Image data type:', typeof imageData);
      console.log('[AIGenerationModule] Has b64_json?', !!imageData.b64_json);
      console.log('[AIGenerationModule] Has url?', !!imageData.url);
      
      // Check what the b64_json actually contains
      if (imageData.b64_json) {
        const first50 = imageData.b64_json.substring(0, 50);
        console.log('[AIGenerationModule] First 50 chars of b64_json:', first50);
      }
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `dalle3-${timestamp}.png`;

      // Prepare the result based on response format
      let result;
      if (response_format === 'b64_json' && imageData.b64_json) {
        // Check if the base64 already has the data URL prefix
        let dataUrl;
        if (imageData.b64_json.startsWith('data:')) {
          // Already has prefix
          dataUrl = imageData.b64_json;
          console.log('[AIGenerationModule] Base64 already has data: prefix');
        } else {
          // Add the prefix
          dataUrl = `data:image/png;base64,${imageData.b64_json}`;
          console.log('[AIGenerationModule] Added data:image/png;base64, prefix');
        }
        
        // Log what we're actually sending
        console.log('[AIGenerationModule] Final imageData first 50 chars:', dataUrl.substring(0, 50));
        
        // Save the image to file for verification
        await this.saveImageToFile(imageData.b64_json, filename);
        
        result = {
          success: true,
          imageData: dataUrl,
          metadata: {
            prompt: prompt,
            revisedPrompt: imageData.revised_prompt || prompt,
            size: size,
            quality: quality,
            style: style,
            model: 'dall-e-3',
            timestamp: new Date().toISOString()
          },
          filename: filename,
          type: 'image',
          subtype: 'png',
          createdBy: 'generate_image'
        };
      } else if (imageData.url) {
        // Return URL format
        result = {
          success: true,
          imageUrl: imageData.url,
          metadata: {
            prompt: prompt,
            revisedPrompt: imageData.revised_prompt || prompt,
            size: size,
            quality: quality,
            style: style,
            model: 'dall-e-3',
            timestamp: new Date().toISOString()
          },
          filename: filename,
          type: 'image',
          subtype: 'png',
          createdBy: 'generate_image'
        };
      } else {
        throw new Error('Unexpected response format from DALL-E API');
      }

      console.log(`Image generated successfully: ${filename}`);
      return result;

    } catch (error) {
      console.error('[AIGenerationModule] Error generating image:', error);
      console.error('[AIGenerationModule] Error type:', error.constructor.name);
      console.error('[AIGenerationModule] Error stack:', error.stack);
      
      // Handle specific OpenAI errors
      if (error.response) {
        const errorMessage = error.response.data?.error?.message || 'Unknown OpenAI API error';
        throw new Error(`DALL-E API error: ${errorMessage}`);
      } else if (error.message) {
        throw new Error(`Image generation failed: ${error.message}`);
      } else {
        throw new Error('Image generation failed with unknown error');
      }
    }
  }

  /**
   * Save base64 image to file for verification
   * @param {string} base64Data - Raw base64 data (without data: prefix)
   * @param {string} filename - Filename to save as
   */
  async saveImageToFile(base64Data, filename) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');
      
      // Create a temp directory for generated images
      const tempDir = path.join(os.tmpdir(), 'legion-generated-images');
      await fs.mkdir(tempDir, { recursive: true });
      
      // Full path for the file
      const filePath = path.join(tempDir, filename);
      
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Write the file
      await fs.writeFile(filePath, imageBuffer);
      
      console.log(`[AIGenerationModule] ✅ Image saved to: ${filePath}`);
      console.log(`[AIGenerationModule] File size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
      
      // Also save a small text file with the first 100 chars of base64 for debugging
      const debugPath = path.join(tempDir, `${filename}.base64-preview.txt`);
      await fs.writeFile(debugPath, base64Data.substring(0, 500) + '...');
      console.log(`[AIGenerationModule] Debug preview saved to: ${debugPath}`);
      
    } catch (error) {
      console.error('[AIGenerationModule] Error saving image file:', error);
    }
  }

  /**
   * Get tools provided by this module
   * Since we're using module.json configuration, GenericModule will handle tool creation
   * This method is here for compatibility if needed
   */
  getTools() {
    // Tools are created from module.json configuration
    // This is handled by GenericModule when using ModuleFactory
    return [];
  }
}