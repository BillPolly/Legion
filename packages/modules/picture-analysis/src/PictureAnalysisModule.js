/**
 * PictureAnalysisModule - Module for AI-powered image analysis
 * 
 * Provides picture analysis capabilities using vision AI models through the Legion framework.
 * Follows ResourceManager pattern for dependency injection and API key management.
 */

import { Module } from '@legion/tools-registry';
import { PictureAnalysisTool } from './PictureAnalysisTool.js';

export default class PictureAnalysisModule extends Module {
  constructor() {
    super();
    this.name = 'picture-analysis';
    this.description = 'AI-powered image analysis using vision models';
    this.version = '1.0.0';
    this.resourceManager = null;
    this.llmClient = null;
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
   * Initialize the module and register tools
   */
  async initialize() {
    await super.initialize();
    
    // Get LLM client with vision capabilities
    await this._setupLLMClient();
    
    // Create and register the picture analysis tool
    const pictureAnalysisTool = new PictureAnalysisTool({ 
      llmClient: this.llmClient 
    });
    
    this.registerTool(pictureAnalysisTool.name, pictureAnalysisTool);
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
        throw new Error(`API key not found for provider ${provider}. Please set ${apiKeyPath.replace('env.', '')} in your .env file.`);
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

    // Verify the client supports vision (if supportsVision method exists)
    if (typeof this.llmClient.supportsVision === 'function') {
      const visionSupport = await this.llmClient.supportsVision();
      if (!visionSupport) {
        throw new Error('LLM client does not support vision capabilities required for picture analysis');
      }
    }
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
      toolCount: this.getTools().length,
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
