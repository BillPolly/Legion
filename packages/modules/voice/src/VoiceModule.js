import { Module } from '@legion/tools-registry';
import { OpenAIVoiceProvider } from './providers/OpenAIVoiceProvider.js';
import { TranscribeAudioTool } from './tools/TranscribeAudioTool.js';
import { GenerateVoiceTool } from './tools/GenerateVoiceTool.js';

/**
 * VoiceModule - Legion module for voice services
 * 
 * Provides speech-to-text and text-to-speech capabilities through
 * a provider architecture. Currently supports OpenAI (Whisper + TTS).
 */
class VoiceModule extends Module {
  constructor() {
    super();
    this.name = 'voice';
    this.description = 'Voice services module providing speech-to-text and text-to-speech capabilities';
    this.version = '1.0.0';
    this.resourceManager = null;
    this.provider = null;
    this.config = {};
  }

  /**
   * Static async factory method following the ResourceManager pattern
   * @param {ResourceManager} resourceManager - The resource manager for dependency injection
   * @returns {Promise<VoiceModule>} Initialized module instance
   */
  static async create(resourceManager) {
    const module = new VoiceModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Get OpenAI API key from ResourceManager
    const apiKey = this.resourceManager.get('env.OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for voice module');
    }
    
    this.config = {
      apiKey: apiKey,
      provider: 'openai'  // Default to OpenAI provider
    };
    
    // Initialize provider based on configuration
    this.provider = this.initializeProvider(this.config);
    
    // Create and register tools
    const transcribeTool = new TranscribeAudioTool(this.provider);
    const generateTool = new GenerateVoiceTool(this.provider);
    
    this.registerTool(transcribeTool.name, transcribeTool);
    this.registerTool(generateTool.name, generateTool);
    
    console.log(`VoiceModule initialized with ${this.config.provider || 'openai'} provider`);
    return this;
  }

  /**
   * Initialize the voice provider based on configuration
   */
  initializeProvider(config) {
    const providerType = config.provider || 'openai';
    
    switch (providerType) {
      case 'openai':
        if (!config.apiKey) {
          throw new Error('OpenAI API key is required for voice module');
        }
        return new OpenAIVoiceProvider({
          apiKey: config.apiKey
        });
        
      // Future providers can be added here
      // case 'google':
      //   return new GoogleVoiceProvider(config);
      // case 'azure':
      //   return new AzureVoiceProvider(config);
      // case 'browser':
      //   return new BrowserVoiceProvider(config);
        
      default:
        throw new Error(`Unknown voice provider: ${providerType}`);
    }
  }


  /**
   * Transcribe audio to text
   * This method is called by the module.json tool definition
   */
  async transcribeAudio(params) {
    return this.transcribeTool.execute(params);
  }

  /**
   * Generate voice from text
   * This method is called by the module.json tool definition
   */
  async generateVoice(params) {
    return this.generateTool.execute(params);
  }

  /**
   * Get available voices from the provider
   */
  async getAvailableVoices() {
    return this.provider.getVoices();
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities() {
    return this.provider.getCapabilities();
  }

  /**
   * Get module information
   */
  getInfo() {
    return {
      name: this.name,
      version: '1.0.0',
      provider: this.provider.name,
      capabilities: this.provider.getCapabilities(),
      tools: this.tools.map(tool => ({
        name: tool.name,
        description: tool.description
      }))
    };
  }
}

// Export the class as default for module.json
export default VoiceModule;