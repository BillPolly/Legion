import { Module } from '@legion/tools';
import { LLMClient } from '@legion/llm';
import { FileConverter } from './utils/FileConverter.js';

/**
 * FileAnalysisModule - Module for analyzing files using AI vision capabilities
 * Supports images, PDFs, documents, and other file types
 */
export default class FileAnalysisModule extends Module {
  constructor(dependencies = {}) {
    super();
    this.name = 'FileAnalysisModule';
    this.description = 'Analyze files including images, PDFs, and documents using AI';
    this.config = dependencies;
    this.llmClient = null;
    this.openaiClient = null;
  }

  /**
   * Static async factory method following the ResourceManager pattern
   * @param {ResourceManager} resourceManager - The resource manager for dependency injection
   * @returns {Promise<FileAnalysisModule>} Initialized module instance
   */
  static async create(resourceManager) {
    // Get API keys from environment
    const anthropicKey = resourceManager.env.ANTHROPIC_API_KEY;
    const openaiKey = resourceManager.env.OPENAI_API_KEY;
    
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for file analysis module');
    }
    
    // Create module with dependencies
    const module = new FileAnalysisModule({ anthropicKey, openaiKey });
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Initialize Anthropic client (primary)
    if (this.config.anthropicKey) {
      this.llmClient = new LLMClient({
        provider: 'anthropic',
        apiKey: this.config.anthropicKey
      });
    }
    
    // Initialize OpenAI client if available
    if (this.config.openaiKey) {
      this.openaiClient = new LLMClient({
        provider: 'openai',
        apiKey: this.config.openaiKey
      });
    }
    
    // Initialize tools dictionary
    this.initializeTools();
  }

  /**
   * Analyze a file with AI
   * @param {Object} params - Analysis parameters
   * @param {string} params.file_path - Path to the file to analyze
   * @param {string} params.prompt - Analysis prompt or question
   * @param {string} params.provider - LLM provider to use ('anthropic' or 'openai')
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeFile(params) {
    const { file_path, prompt, provider = 'anthropic' } = params;
    
    console.log(`[FileAnalysisModule] Analyzing file: ${file_path}`);
    console.log(`[FileAnalysisModule] Using provider: ${provider}`);
    console.log(`[FileAnalysisModule] Prompt: ${prompt}`);
    
    try {
      // Validate file exists and size
      await FileConverter.validateFileSize(file_path);
      
      // Read and prepare file
      const file = await FileConverter.readFile(file_path);
      console.log(`[FileAnalysisModule] File prepared: ${file.name} (${file.type}, ${file.data.length} bytes)`);
      
      // Select appropriate client
      let client;
      let model;
      
      if (provider === 'openai') {
        if (!this.openaiClient) {
          throw new Error('OpenAI client not available. OPENAI_API_KEY may not be set.');
        }
        client = this.openaiClient;
        model = file.type === 'image' ? 'gpt-4-vision-preview' : 'gpt-4-turbo-preview';
      } else {
        if (!this.llmClient) {
          throw new Error('Anthropic client not available. ANTHROPIC_API_KEY may not be set.');
        }
        client = this.llmClient;
        model = 'claude-3-5-sonnet-20241022';
      }
      
      // For PDFs, we need to handle them differently
      if (file.type === 'document' && file.mimeType === 'application/pdf') {
        // For now, we'll inform the user that PDF text extraction is needed
        // In a full implementation, we'd use pdf-parse or similar
        throw new Error('PDF analysis requires text extraction. Please convert PDF to text or image format first.');
      }
      
      // Prepare messages with file
      const messages = [
        {
          role: 'user',
          content: prompt
        }
      ];
      
      // Send request with file
      console.log(`[FileAnalysisModule] Sending request to ${provider} with ${model}`);
      const response = await client.sendAndReceiveResponse(messages, {
        files: [file],
        model: model,
        maxTokens: 4096
      });
      
      console.log(`[FileAnalysisModule] Received response (${response.length} chars)`);
      
      return {
        success: true,
        analysis: response,
        file: {
          name: file.name,
          type: file.type,
          mimeType: file.mimeType,
          size: file.data.length
        },
        provider: provider,
        model: model
      };
      
    } catch (error) {
      console.error(`[FileAnalysisModule] Error analyzing file:`, error);
      return {
        success: false,
        error: error.message,
        file_path: file_path
      };
    }
  }

  /**
   * Initialize tools for this module  
   */
  initializeTools() {
    // Initialize tools dictionary - no tools by default
    // Tools are supposed to be created from module.json configuration
    // but we'll ensure the dictionary exists
    this.tools = {};
  }
}