/**
 * ImageGenerationTool - Tool for generating images using DALL-E 3
 * This tool wraps the AIGenerationModule's generateImage method
 * All schemas come from module.json metadata
 */

import { Tool } from '@legion/tools-registry';

export class ImageGenerationTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
    this.shortName = 'imagen';
  }

  async _execute(args) {
    console.log('[ImageGenerationTool] Execute called');
    
    try {
      // Emit progress event
      console.log('[ImageGenerationTool] Emitting progress: 10%');
      this.progress('Preparing image generation request...', 10, {
        status: 'Preparing image generation request...'
      });

      // Use args directly - validation removed, happens at invocation layer
      console.log('[ImageGenerationTool] Inputs validated');

      // Emit progress event
      console.log('[ImageGenerationTool] Emitting progress: 30%');
      const promptText = args.prompt || 'image';
      this.progress(`Generating image: "${promptText.substring(0, 50)}..."`, 30, {
        status: `Generating image: "${promptText.substring(0, 50)}..."`
      });

      // Call the generateImage method directly
      if (!this.generateImage) {
        console.error('[ImageGenerationTool] generateImage method not available');
        const error = new Error('AIGenerationModule instance not available');
        this.error(error.message, 'IMAGE_GENERATION_ERROR');
        throw error;
      }

      console.log('[ImageGenerationTool] Calling generateImage()...');
      const result = await this.generateImage(args);
      console.log('[ImageGenerationTool] generateImage returned result');

      // Emit progress event
      this.progress('Image generated successfully', 90, {
        status: 'Image generated successfully'
      });

      // Format the result for artifact detection
      const formattedResult = {
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
      console.error('[ImageGenerationTool] Error during execution:', error);
      
      // Emit error event
      this.error(error.message, { code: 'IMAGE_GENERATION_ERROR' });
      
      // Re-throw with code in cause to be handled by base Tool class
      error.cause = { ...error.cause, code: 'IMAGE_GENERATION_ERROR' };
      throw error;
    }
  }
}