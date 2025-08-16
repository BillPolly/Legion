import { Tool } from '@legion/tools-registry';
import { InputSchema } from './utils/validation.js';
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
    super({
      name: 'analyse_picture',
      description: 'Analyze images using AI vision models. Accepts image file paths and natural language prompts to provide detailed visual analysis, descriptions, and insights.',
      inputSchema: InputSchema
    });
    
    this.llmClient = dependencies.llmClient;
    
    if (!this.llmClient) {
      throw new Error('LLM client is required for PictureAnalysisTool');
    }
  }

  async execute(input) {
    const startTime = Date.now();
    
    try {
      // Validate input first using the base class validator
      if (this.validator) {
        const validation = this.validator.validate(input);
        if (!validation.valid) {
          const errorMessage = validation.errors 
            ? JSON.stringify(validation.errors) 
            : 'Invalid input';
          return {
            success: false,
            data: {
              errorMessage: `Validation failed: ${errorMessage}`,
              errorCode: 'VALIDATION_ERROR',
              file_path: input.file_path || 'unknown'
            }
          };
        }
        input = validation.data || input; // Use validated/coerced data
      }
      
      this.progress('Starting image analysis...', 0);
      
      // Step 1: Resolve and validate file path
      this.progress('Resolving file path...', 10);
      let resolvedPath;
      try {
        resolvedPath = resolveFilePath(input.file_path);
      } catch (error) {
        this.error(`File resolution failed: ${error.message}`);
        return {
          success: false,
          data: {
            errorMessage: error.message,
            errorCode: 'FILE_NOT_FOUND',
            file_path: input.file_path
          }
        };
      }
      
      // Step 2: Validate image format
      this.progress('Validating image format...', 20);
      try {
        validateImageFormat(resolvedPath);
      } catch (error) {
        this.error(`Format validation failed: ${error.message}`);
        return {
          success: false,
          data: {
            errorMessage: error.message,
            errorCode: 'UNSUPPORTED_FORMAT',
            file_path: input.file_path
          }
        };
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
        
        return {
          success: false,
          data: {
            errorMessage: error.message,
            errorCode: errorCode,
            file_path: input.file_path
          }
        };
      }
      
      // Step 4: Encode image as base64
      this.progress('Encoding image...', 40);
      let imageData;
      try {
        imageData = encodeImageAsBase64(resolvedPath);
      } catch (error) {
        this.error(`Image encoding failed: ${error.message}`);
        return {
          success: false,
          data: {
            errorMessage: `Failed to encode image: ${error.message}`,
            errorCode: 'ENCODING_ERROR',
            file_path: input.file_path
          }
        };
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
        analysisResult = await this.llmClient.sendAndReceiveResponse(visionRequest, requestOptions);
      } catch (error) {
        this.error(`LLM API call failed: ${error.message}`);
        return {
          success: false,
          data: {
            errorMessage: `Vision analysis failed: ${error.message}`,
            errorCode: 'LLM_API_ERROR',
            file_path: input.file_path
          }
        };
      }
      
      // Step 7: Process and format response
      this.progress('Processing analysis results...', 90);
      const processingTime = Date.now() - startTime;
      
      const result = {
        success: true,
        data: {
          analysis: analysisResult,
          file_path: resolvedPath,
          prompt: input.prompt,
          processing_time_ms: processingTime
        }
      };
      
      this.progress('Analysis complete!', 100);
      this.info(`Successfully analyzed image: ${resolvedPath}`);
      
      return result;
      
    } catch (error) {
      // Catch any unexpected errors
      const processingTime = Date.now() - startTime;
      this.error(`Unexpected error during analysis: ${error.message}`);
      
      return {
        success: false,
        data: {
          errorMessage: `Unexpected error: ${error.message}`,
          errorCode: 'INTERNAL_ERROR',
          file_path: input.file_path,
          processing_time_ms: processingTime
        }
      };
    }
  }
}