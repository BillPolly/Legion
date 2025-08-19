import { Tool } from '@legion/tools-registry';
import { z } from 'zod';

/**
 * ImageGenerationTool - Tool for generating images using DALL-E 3
 * This tool wraps the AIGenerationModule's generateImage method
 */
export class ImageGenerationTool extends Tool {
  constructor(dependencies = {}) {
    const inputSchema = z.object({
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
    });
    
    const outputSchema = z.object({
      success: z.boolean().describe('Whether the generation was successful'),
      imageData: z.string().optional().describe('Base64 encoded image data'),
      imageUrl: z.string().optional().describe('URL to the generated image'),
      filename: z.string().optional().describe('Generated filename'),
      metadata: z.object({}).optional().describe('Additional metadata'),
      artifact: z.object({}).optional().describe('Artifact information')
    });
    
    // Define the tool schema
    super({
      name: 'generate_image',
      description: 'Generate an image using DALL-E 3 AI model. Returns base64 encoded image data by default.',
      inputSchema: inputSchema,
      execute: async (args) => {
        console.log('[ImageGenerationTool] Execute called');
        try {
          // Emit progress event
          console.log('[ImageGenerationTool] Emitting progress: 10%');
          this.progress('Preparing image generation request...', 10, {
            status: 'Preparing image generation request...'
          });

          // Validate inputs
          const validated = inputSchema.parse(args);
          console.log('[ImageGenerationTool] Inputs validated');

          // Emit progress event
          console.log('[ImageGenerationTool] Emitting progress: 30%');
          this.progress(`Generating image: "${validated.prompt.substring(0, 50)}..."`, 30, {
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
      },
      getMetadata: () => ({
        description: 'Generate an image using DALL-E 3 AI model. Returns base64 encoded image data by default.',
        input: inputSchema,
        output: outputSchema
      })
    });
    
    this.config = dependencies;
    this.module = dependencies.module; // Reference to AIGenerationModule instance
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