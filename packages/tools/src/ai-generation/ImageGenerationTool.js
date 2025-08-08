import { Tool } from '../modules/Tool.js';
import { z } from 'zod';

/**
 * ImageGenerationTool - Tool for generating images using DALL-E 3
 * This tool wraps the AIGenerationModule's generateImage method
 */
export class ImageGenerationTool extends Tool {
  constructor(dependencies = {}) {
    // Define the tool schema
    super({
      name: 'generate_image',
      description: 'Generate an image using DALL-E 3 AI model. Returns base64 encoded image data by default.',
      inputSchema: z.object({
        prompt: z.string().describe('Text description of the image to generate'),
        size: z.enum(['1024x1024', '1792x1024', '1024x1792'])
          .optional()
          .default('1024x1024')
          .describe('Size of the generated image'),
        quality: z.enum(['standard', 'hd'])
          .optional()
          .default('standard')
          .describe('Quality of the generated image (hd costs more)'),
        style: z.enum(['vivid', 'natural'])
          .optional()
          .default('vivid')
          .describe('Style of the generated image'),
        response_format: z.enum(['b64_json', 'url'])
          .optional()
          .default('b64_json')
          .describe('Format for the generated image (b64_json for base64, url for hosted URL)')
      })
    });
    
    this.config = dependencies;
    this.module = dependencies.module; // Reference to AIGenerationModule instance
  }

  /**
   * Execute the image generation
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} Generated image data
   */
  async execute(args) {
    console.log('[ImageGenerationTool] Execute called');
    try {
      // Emit progress event
      console.log('[ImageGenerationTool] Emitting progress: 10%');
      this.emit('progress', {
        percentage: 10,
        status: 'Preparing image generation request...'
      });

      // Validate inputs
      const validated = this.inputSchema.parse(args);
      console.log('[ImageGenerationTool] Inputs validated');

      // Emit progress event
      console.log('[ImageGenerationTool] Emitting progress: 30%');
      this.emit('progress', {
        percentage: 30,
        status: `Generating image: "${validated.prompt.substring(0, 50)}..."`
      });

      // Call the module's generateImage method
      if (!this.module || !this.module.generateImage) {
        console.error('[ImageGenerationTool] Module not available:', {
          hasModule: !!this.module,
          hasGenerateImage: this.module ? !!this.module.generateImage : false
        });
        throw new Error('AIGenerationModule instance not available');
      }

      console.log('[ImageGenerationTool] Calling module.generateImage()...');
      const result = await this.module.generateImage(validated);
      console.log('[ImageGenerationTool] Module returned result');

      // Emit progress event
      this.emit('progress', {
        percentage: 90,
        status: 'Image generated successfully'
      });

      // Format the result for artifact detection
      const formattedResult = {
        success: true,
        ...result,
        // Ensure artifact-friendly structure
        artifact: {
          type: 'image',
          subtype: 'png',
          title: result.filename,
          content: result.imageData || result.imageUrl,
          metadata: result.metadata,
          createdBy: 'generate_image',
          downloadable: true
        }
      };

      // Emit completion
      this.emit('progress', {
        percentage: 100,
        status: 'Complete'
      });

      return formattedResult;

    } catch (error) {
      // Emit error event
      this.emit('error', {
        message: error.message,
        code: 'IMAGE_GENERATION_ERROR'
      });

      // Return error result
      return {
        success: false,
        error: error.message,
        code: 'IMAGE_GENERATION_ERROR'
      };
    }
  }

  /**
   * Static method to create tool from module instance
   * @param {AIGenerationModule} moduleInstance - The module instance
   * @returns {ImageGenerationTool} Tool instance
   */
  static fromModule(moduleInstance) {
    return new ImageGenerationTool({
      module: moduleInstance
    });
  }
}