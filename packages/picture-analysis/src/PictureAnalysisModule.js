/**
 * PictureAnalysisModule - Module for AI-powered image analysis
 * 
 * Provides picture analysis capabilities using vision AI models through the Legion framework.
 * Follows ResourceManager pattern for dependency injection and API key management.
 */

import { Module } from '@legion/tools-registry';
import { PictureAnalysisTool } from './PictureAnalysisTool.js';

export default class PictureAnalysisModule extends Module {
  constructor(dependencies = {}) {
    super({ name: 'picture-analysis' }, dependencies);
    this.name = 'picture-analysis';
    this.description = 'AI-powered image analysis using vision models';
    this.llmClient = dependencies.llmClient;
    this.tools = {};
  }

  /**
   * Async factory method following ResourceManager pattern
   * Gets LLM client automatically from ResourceManager with vision capabilities
   * @param {ResourceManager} resourceManager - The resource manager for dependency injection
   * @param {Object} options - Configuration options
   * @param {string} options.provider - LLM provider to use (default: 'anthropic')
   * @param {string} options.model - Model to use (default: 'claude-3-5-sonnet-20241022')
   * @returns {Promise<PictureAnalysisModule>} Initialized module instance
   */
  static async create(resourceManager, options = {}) {
    const provider = options.provider || 'anthropic';
    const model = options.model || 'claude-3-5-sonnet-20241022';
    
    // Get or create LLM client from ResourceManager
    let llmClient = resourceManager.get('llmClient');
    
    if (!llmClient) {
      // Get appropriate API key based on provider
      const apiKeyMap = {
        'anthropic': 'env.ANTHROPIC_API_KEY',
        'openai': 'env.OPENAI_API_KEY'
      };
      
      const apiKeyPath = apiKeyMap[provider];
      const apiKey = resourceManager.get(apiKeyPath);
      
      if (!apiKey) {
        throw new Error(`API key not found for provider ${provider}. Please set ${apiKeyPath.replace('env.', '')} in your .env file.`);
      }
      
      // Import and create LLM client
      const { LLMClient } = await import('@legion/llm');
      llmClient = new LLMClient({
        provider: provider,
        apiKey: apiKey,
        model: model
      });
      
      // Store for reuse
      resourceManager.set('llmClient', llmClient);
    }

    // Verify the client supports vision (if supportsVision method exists)
    if (typeof llmClient.supportsVision === 'function') {
      const visionSupport = await llmClient.supportsVision();
      if (!visionSupport) {
        throw new Error('LLM client does not support vision capabilities required for picture analysis');
      }
    }

    const module = new PictureAnalysisModule({ llmClient });
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module and register tools
   */
  async initialize() {
    await super.initialize();
    
    // Verify LLM client is available
    if (!this.llmClient) {
      throw new Error('LLM client is required for PictureAnalysisModule initialization');
    }
    
    // Create and register the picture analysis tool
    const pictureAnalysisTool = new PictureAnalysisTool({ 
      llmClient: this.llmClient 
    });
    
    this.registerTool(pictureAnalysisTool.name, pictureAnalysisTool);
    
    this.info(`Initialized picture analysis module with ${this.listTools().length} tools`);
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
      toolCount: this.listTools().length,
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