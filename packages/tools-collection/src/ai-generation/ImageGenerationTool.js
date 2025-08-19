import { Tool } from '@legion/tools-registry';

/**
 * ImageGenerationTool - Tool for generating images using DALL-E 3
 * This tool wraps the AIGenerationModule's generateImage method
 */
export class ImageGenerationTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'generate_image',
      description: 'Generate an image using DALL-E 3 AI model. Returns base64 encoded image data by default.',
      schema: {
        input: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Text description of the image to generate'
            },
            size: {
              type: 'string',
              enum: ['1024x1024', '1792x1024', '1024x1792'],
              default: '1024x1024',
              description: 'Size of the generated image'
            },
            quality: {
              type: 'string',
              enum: ['standard', 'hd'],
              default: 'standard',
              description: 'Quality of the generated image (hd costs more)'
            },
            style: {
              type: 'string',
              enum: ['vivid', 'natural'],
              default: 'vivid',
              description: 'Style of the generated image'
            },
            response_format: {
              type: 'string',
              enum: ['b64_json', 'url'],
              default: 'b64_json',
              description: 'Format for the generated image (b64_json for base64, url for hosted URL)'
            }
          },
          required: ['prompt']
        },
        output: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the generation was successful'
            },
            imageData: {
              type: 'string',
              description: 'Base64 encoded image data'
            },
            imageUrl: {
              type: 'string',
              description: 'URL to the generated image'
            },
            filename: {
              type: 'string',
              description: 'Generated filename'
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata'
            },
            artifact: {
              type: 'object',
              description: 'Artifact information'
            }
          },
          required: ['success']
        }
      },
      execute: async (args) => this.generateImage(args)
    });
    
    this.config = dependencies;
    this.module = dependencies.module;
  }

  async generateImage(args) {
    console.log('[ImageGenerationTool] Execute called');
    try {
      // Emit progress event
      console.log('[ImageGenerationTool] Emitting progress: 10%');
      this.progress('Preparing image generation request...', 10, {
        status: 'Preparing image generation request...'
      });

      console.log('[ImageGenerationTool] Inputs validated');

      // Emit progress event
      console.log('[ImageGenerationTool] Emitting progress: 30%');
      this.progress(`Generating image: "${args.prompt.substring(0, 50)}..."`, 30, {
        status: `Generating image: "${args.prompt.substring(0, 50)}..."`
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
      const result = await this.module.generateImage(args);
      console.log('[ImageGenerationTool] Module returned result');

      // Emit progress event
      this.progress('Image generated successfully', 90, {
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
      this.progress('Complete', 100, {
        status: 'Complete'
      });

      return formattedResult;

    } catch (error) {
      // Emit error event
      this.error(error.message, {
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