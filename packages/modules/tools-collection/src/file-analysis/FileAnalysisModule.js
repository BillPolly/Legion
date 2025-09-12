import { Module } from '@legion/tools-registry';
import { LLMClient } from '@legion/llm-client'
import { FileConverter } from './utils/FileConverter.js';
import { fileURLToPath } from 'url';

/**
 * FileAnalysisModule - Module for analyzing files using AI vision capabilities
 * Supports images, PDFs, documents, and other file types
 */
export default class FileAnalysisModule extends Module {
  constructor() {
    super();
    this.name = 'FileAnalysisModule';
    this.description = 'Analyze files including images, PDFs, and documents using AI';
    this.version = '1.0.0';
    this.llmClient = null;
    this.openaiClient = null;
    this.metadataPath = './module.json';
  }

  /**
   * Static async factory method following the standard interface
   * @param {ResourceManager} resourceManager - The resource manager for dependency injection
   * @returns {Promise<FileAnalysisModule>} Initialized module instance
   */
  static async create(resourceManager) {
    const module = new FileAnalysisModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Initialize clients first (needed for both metadata and legacy modes)
    await this.initializeClients();
    
    // This module doesn't have separate tool classes - it uses module methods directly
    // So we skip the metadata-driven tool creation and just ensure the module is ready
    console.log('FileAnalysisModule: Initialized (module provides analyzeFile method directly)');
  }

  /**
   * Initialize LLM clients
   */
  async initializeClients() {
    // Get API keys from environment using ResourceManager
    const anthropicKey = this.resourceManager.get('env.ANTHROPIC_API_KEY');
    const openaiKey = this.resourceManager.get('env.OPENAI_API_KEY');
    
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for file analysis module');
    }
    
    // Initialize Anthropic client (primary)
    this.llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: anthropicKey
    });
    
    // Initialize OpenAI client if available
    if (openaiKey) {
      this.openaiClient = new LLMClient({
        provider: 'openai',
        apiKey: openaiKey
      });
    }
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

  // Metadata-driven tool implementation
  async analyze_file(params) {
    return await this.analyzeFile(params);
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
