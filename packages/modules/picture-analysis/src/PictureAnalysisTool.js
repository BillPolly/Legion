import { Tool } from '@legion/tools-registry';
import { 
  resolveFilePath, 
  validateImageFormat, 
  validateFileSize, 
  encodeImageAsBase64,
  getImageMetadata 
} from './utils/fileHandling.js';

/**
 * Picture Analysis Tool - Analyzes images using AI vision models
 */
export class PictureAnalysisTool extends Tool {
  constructor(dependencies = {}) {
    const inputSchema = {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          minLength: 1,
          description: 'File path is required'
        },
        prompt: {
          type: 'string',
          minLength: 10,
          maxLength: 2000,
          description: 'Prompt must be between 10 and 2000 characters'
        }
      },
      required: ['file_path', 'prompt']
    };
    
    const outputSchema = {
      type: 'object',
      properties: {
        analysis: {
          type: 'string',
          description: 'The AI analysis of the image'
        },
        file_path: {
          type: 'string',
          description: 'The resolved file path'
        },
        prompt: {
          type: 'string',
          description: 'The prompt used for analysis'
        },
        processing_time_ms: {
          type: 'number',
          description: 'Processing time in milliseconds'
        }
      },
      required: ['analysis', 'file_path', 'prompt', 'processing_time_ms']
    };
    
    super({
      name: 'analyse_picture',
      description: 'Analyze images using AI vision models. Accepts image file paths and natural language prompts to provide detailed visual analysis, descriptions, and insights.',
      schema: {
        input: inputSchema,
        output: outputSchema
      }
    });
    
    // Create validator for Legion framework compatibility
    // Schema validation is handled by the base Tool class
    
    // Add event API compatibility for tests
    this.eventListeners = new Map();
    
    this.llmClient = dependencies.llmClient;
    
    if (!this.llmClient) {
      throw new Error('LLM client is required for PictureAnalysisTool');
    }
  }
  
  // Event API compatibility for tests
  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(callback);
  }
  
  emit(eventName, ...args) {
    const listeners = this.eventListeners.get(eventName) || [];
    listeners.forEach(callback => callback(...args));
  }
  
  // Override progress to emit with tool name
  progress(message, percentage = 0, data = {}) {
    this.emit('progress', { 
      tool: this.name,
      message, 
      percentage, 
      ...data 
    });
  }
  
  // Override error to emit with tool name
  error(message, data = {}) {
    this.emit('error', { 
      tool: this.name,
      message, 
      ...data 
    });
  }
  
  // Override info to emit with tool name
  info(message, data = {}) {
    this.emit('info', { 
      tool: this.name,
      message, 
      ...data 
    });
  }

  async _execute(input) {
    const startTime = Date.now();
    
    try {
      // Input validation is handled by the base Tool class automatically
      
      this.progress('Starting image analysis...', 0);
      
      // Step 1: Resolve and validate file path
      this.progress('Resolving file path...', 10);
      let resolvedPath;
      try {
        resolvedPath = resolveFilePath(input.file_path);
      } catch (error) {
        this.error(`File resolution failed: ${error.message}`);
        throw new Error(error.message, {
          cause: {
            errorCode: 'FILE_NOT_FOUND',
            file_path: input.file_path
          }
        });
      }
      
      // Step 2: Validate image format
      this.progress('Validating image format...', 20);
      try {
        validateImageFormat(resolvedPath);
      } catch (error) {
        this.error(`Format validation failed: ${error.message}`);
        throw new Error(error.message, {
          cause: {
            errorCode: 'UNSUPPORTED_FORMAT',
            file_path: input.file_path
          }
        });
      }
      
      // Step 3: Validate file size
      this.progress('Validating file size...', 30);
      try {
        validateFileSize(resolvedPath);
      } catch (error) {
        this.error(`Size validation failed: ${error.message}`);
        
        // Determine appropriate error code based on error message
        let errorCode = 'FILE_TOO_LARGE';
        if (error.message.includes('File is empty')) {
          errorCode = 'ENCODING_ERROR'; // Empty files will fail at encoding stage conceptually
        }
        
        throw new Error(error.message, {
          cause: {
            errorCode: errorCode,
            file_path: input.file_path
          }
        });
      }
      
      // Step 4: Encode image as base64
      this.progress('Encoding image...', 40);
      let imageData;
      try {
        imageData = encodeImageAsBase64(resolvedPath);
      } catch (error) {
        this.error(`Image encoding failed: ${error.message}`);
        throw new Error(`Failed to encode image: ${error.message}`, {
          cause: {
            errorCode: 'ENCODING_ERROR',
            file_path: input.file_path
          }
        });
      }
      
      // Step 5: Construct vision API request
      this.progress('Preparing vision API request...', 50);
      const visionRequest = [
        {
          role: 'user',
          content: [
            { type: 'text', text: input.prompt },
            { 
              type: 'image_url', 
              image_url: { 
                url: `data:${imageData.mimeType};base64,${imageData.base64Data}` 
              } 
            }
          ]
        }
      ];
      
      const requestOptions = {
        max_tokens: 1000,
        temperature: 0.7
      };
      
      // Step 6: Send request to LLM
      this.progress('Analyzing image with AI vision...', 70);
      let analysisResult;
      try {
        // Use the standard LLM client interface for vision support
        let response;
        if (this.llmClient.sendVisionMessage) {
          // If LLM client has vision support
          response = await this.llmClient.sendVisionMessage(visionRequest, requestOptions);
        } else if (this.llmClient.provider && this.llmClient.provider.client) {
          // Fallback to direct provider access for vision
          response = await this.llmClient.provider.client.messages.create({
            model: this.llmClient.model || 'claude-3-5-sonnet-20241022',
            max_tokens: requestOptions.max_tokens,
            temperature: requestOptions.temperature,
            messages: visionRequest
          });
          analysisResult = response.content[0].text;
        } else {
          // Use standard complete method as fallback
          const prompt = `${visionRequest[0].content[0].text}\n\nImage: [base64 encoded image provided]`;
          response = await this.llmClient.complete(prompt, requestOptions);
        }
        
        if (typeof response === 'string') {
          analysisResult = response;
        } else if (response.content && response.content[0]) {
          analysisResult = response.content[0].text;
        } else {
          analysisResult = response.toString();
        }
      } catch (error) {
        this.error(`LLM API call failed: ${error.message}`);
        throw new Error(`Vision analysis failed: ${error.message}`, {
          cause: {
            errorCode: 'LLM_API_ERROR',
            file_path: input.file_path
          }
        });
      }
      
      // Step 7: Process and format response
      this.progress('Processing analysis results...', 90);
      const processingTime = Date.now() - startTime;
      
      const result = {
        analysis: analysisResult,
        file_path: resolvedPath,
        prompt: input.prompt,
        processing_time_ms: processingTime
      };
      
      this.progress('Analysis complete!', 100);
      this.info(`Successfully analyzed image: ${resolvedPath}`);
      
      return result;
      
    } catch (error) {
      // Catch any unexpected errors
      const processingTime = Date.now() - startTime;
      this.error(`Unexpected error during analysis: ${error.message}`);
      
      // Re-throw with additional context if it doesn't already have a cause
      if (!error.cause) {
        throw new Error(`Unexpected error: ${error.message}`, {
          cause: {
            errorCode: 'INTERNAL_ERROR',
            file_path: input.file_path,
            processing_time_ms: processingTime
          }
        });
      } else {
        // Re-throw the existing structured error
        throw error;
      }
    }
  }
}