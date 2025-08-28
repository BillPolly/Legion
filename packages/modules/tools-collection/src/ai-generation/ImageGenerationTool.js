/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const imageGenerationToolInputSchema = {
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
};

// Output schema as plain JSON Schema
const imageGenerationToolOutputSchema = {
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
};

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
      inputSchema: imageGenerationToolInputSchema,
      outputSchema: imageGenerationToolOutputSchema,
      schema: {
        input: imageGenerationToolInputSchema,
        output: imageGenerationToolOutputSchema
      }
    });
    
    this.dependencies = dependencies;
    this.config = dependencies;
    this.llmClient = dependencies.llmClient;
    
    // Handle both direct generateImage function and module instance
    if (dependencies.generateImage) {
      this.generateImage = dependencies.generateImage; // Direct reference to bound method
    } else if (dependencies.module && dependencies.module.generateImage) {
      this.generateImage = dependencies.module.generateImage.bind(dependencies.module);
      this.module = dependencies.module;
    }
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

  getMetadata() {
    return {
      description: 'Generate an image using DALL-E 3 AI model. Returns base64 encoded image data by default.',
      input: imageGenerationToolInputSchema,
      output: imageGenerationToolOutputSchema
    };
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