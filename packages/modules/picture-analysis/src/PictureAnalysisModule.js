/**
 * PictureAnalysisModule - Module for AI-powered image analysis
 * 
 * Provides picture analysis capabilities using vision AI models through the Legion framework.
 * Follows ResourceManager pattern for dependency injection and API key management.
 */

import { Tool, Module } from '@legion/tools-registry';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  resolveFilePath, 
  validateImageFormat, 
  validateFileSize, 
  encodeImageAsBase64,
  getImageMetadata 
} from './utils/fileHandling.js';

/**
 * Picture analysis tool that analyzes images using AI vision models
 * NEW: Pure logic implementation - metadata comes from tools-metadata.json
 */
class PictureAnalysisTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
    this.shortName = 'analyze';
    this.llmClient = module.llmClient;
    
    if (!this.llmClient) {
      throw new Error('LLM client is required for PictureAnalysisTool');
    }
  }

  // BACKWARDS COMPATIBILITY: support old pattern during migration
  static createLegacy(dependencies = {}) {
    const tool = new PictureAnalysisTool({
      name: 'analyse_picture',
      description: 'Analyze images using AI vision models. Accepts image file paths and natural language prompts to provide detailed visual analysis, descriptions, and insights.',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            minLength: 1,
            description: 'File path to the image to analyze'
          },
          prompt: {
            type: 'string',
            minLength: 10,
            maxLength: 2000,
            description: 'Natural language prompt describing what to analyze about the image'
          }
        },
        required: ['file_path', 'prompt']
      },
      outputSchema: {
        type: 'object',
        properties: {
          analysis: { type: 'string', description: 'The AI analysis of the image' },
          file_path: { type: 'string', description: 'The resolved file path' },
          prompt: { type: 'string', description: 'The prompt used for analysis' },
          processing_time_ms: { type: 'number', description: 'Processing time in milliseconds' }
        },
        required: ['analysis', 'file_path', 'prompt', 'processing_time_ms']
      }
    });
    tool.llmClient = dependencies.llmClient;
    return tool;
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    const startTime = Date.now();
    const { file_path, prompt } = params;
    
    this.progress('Starting image analysis...', 0);
    
    // Step 1: Resolve and validate file path
    this.progress('Resolving file path...', 10);
    const resolvedPath = resolveFilePath(file_path);
    
    // Step 2: Validate image format
    this.progress('Validating image format...', 20);
    validateImageFormat(resolvedPath);
    
    // Step 3: Validate file size
    this.progress('Validating file size...', 30);
    validateFileSize(resolvedPath);
    
    // Step 4: Encode image as base64
    this.progress('Encoding image...', 40);
    const imageData = encodeImageAsBase64(resolvedPath);
    
    // Step 5: Construct vision API request
    this.progress('Preparing vision API request...', 50);
    const visionRequest = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
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
        const promptText = `${visionRequest[0].content[0].text}\n\nImage: [base64 encoded image provided]`;
        response = await this.llmClient.complete(promptText, requestOptions);
      }
      
      if (typeof response === 'string') {
        analysisResult = response;
      } else if (response.content && response.content[0]) {
        analysisResult = response.content[0].text;
      } else {
        analysisResult = response.toString();
      }
    } catch (error) {
      throw new Error(`Vision analysis failed: ${error.message}`);
    }
    
    // Step 7: Process and format response
    this.progress('Processing analysis results...', 90);
    const processingTime = Date.now() - startTime;
    
    const result = {
      analysis: analysisResult,
      file_path: resolvedPath,
      prompt: prompt,
      processing_time_ms: processingTime
    };
    
    this.progress('Analysis complete!', 100);
    this.info(`Successfully analyzed image: ${resolvedPath}`);
    
    return result;
  }
}

/**
 * PictureAnalysisModule - NEW metadata-driven architecture
 * Metadata comes from tools-metadata.json, tools contain pure logic only
 */
export default class PictureAnalysisModule extends Module {
  constructor(dependencies = {}) {
    super();
    this.name = 'picture-analysis';
    this.description = 'AI-powered image analysis using vision models';
    this.version = '1.0.0';
    this.resourceManager = dependencies.resourceManager || null;
    this.llmClient = dependencies.llmClient || null;
    
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new PictureAnalysisModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module - NEW metadata-driven approach
   */
  async initialize() {
    await super.initialize(); // This will load metadata automatically
    
    // Get LLM client with vision capabilities (only if not already provided)
    if (!this.llmClient) {
      await this._setupLLMClient();
    }
    
    // Emit initialization event
    this.emit('info', { message: 'Initialized picture analysis module with vision support' });
    
    // NEW APPROACH: Create tools using metadata
    if (this.metadata) {
      // Create analyse_picture tool using metadata
      const pictureAnalysisTool = this.createToolFromMetadata('analyse_picture', PictureAnalysisTool);
      this.registerTool(pictureAnalysisTool.name, pictureAnalysisTool);
    } else {
      // FALLBACK: Old approach for backwards compatibility
      const pictureAnalysisTool = PictureAnalysisTool.createLegacy({ llmClient: this.llmClient });
      this.registerTool(pictureAnalysisTool.name, pictureAnalysisTool);
    }
  }

  /**
   * Setup LLM client with vision capabilities
   */
  async _setupLLMClient() {
    const provider = 'anthropic';
    const model = 'claude-3-5-sonnet-20241022';
    
    // Get or create LLM client from ResourceManager
    this.llmClient = this.resourceManager.get('llmClient');
    
    if (!this.llmClient) {
      // Get appropriate API key based on provider
      const apiKeyMap = {
        'anthropic': 'env.ANTHROPIC_API_KEY',
        'openai': 'env.OPENAI_API_KEY'
      };
      
      const apiKeyPath = apiKeyMap[provider];
      const apiKey = this.resourceManager.get(apiKeyPath);
      
      if (!apiKey) {
        throw new Error(`ANTHROPIC_API_KEY environment variable is required for picture analysis`);
      }
      
      // Import and create LLM client
      const { LLMClient } = await import('@legion/llm');
      this.llmClient = new LLMClient({
        provider: provider,
        apiKey: apiKey,
        model: model
      });
      
      // Store for reuse
      this.resourceManager.set('llmClient', this.llmClient);
    }

    // Verify vision support if client has the method
    if (this.llmClient.supportsVision && typeof this.llmClient.supportsVision === 'function') {
      const hasVision = await this.llmClient.supportsVision();
      if (!hasVision) {
        throw new Error('LLM client does not support vision capabilities required for picture analysis');
      }
    }
    // Claude 3 models support vision by default
  }

  /**
   * Get a specific tool by name
   * @param {string} name - Tool name
   * @returns {Object} The tool instance
   * @throws {Error} If tool not found
   */
  getTool(name) {
    const tool = super.getTool(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found in module`);
    }
    return tool;
  }

  /**
   * Get module metadata
   * @returns {Object} Module metadata
   */
  getMetadata() {
    return {
      name: 'picture-analysis',
      version: '1.0.0',
      description: 'AI-powered image analysis using vision models',
      toolCount: (() => {
        try {
          return this.getTools().length;
        } catch {
          return 0;
        }
      })(),
      requiredDependencies: ['ANTHROPIC_API_KEY'],
      supportedFormats: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      maxFileSize: '20MB',
      capabilities: [
        'Image description and analysis',
        'Object detection and identification', 
        'Scene understanding',
        'Text extraction (OCR)',
        'Visual question answering'
      ]
    };
  }
}
