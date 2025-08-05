import { Module } from '@legion/module-loader';
import { OpenAIVoiceProvider } from './providers/OpenAIVoiceProvider.js';
import { TranscribeAudioTool } from './tools/TranscribeAudioTool.js';
import { GenerateVoiceTool } from './tools/GenerateVoiceTool.js';

/**
 * VoiceModule - Legion module for voice services
 * 
 * Provides speech-to-text and text-to-speech capabilities through
 * a provider architecture. Currently supports OpenAI (Whisper + TTS).
 */
export class VoiceModule extends Module {
  constructor(config = {}) {
    super('voice', config);
    
    // Initialize provider based on configuration
    this.provider = this.initializeProvider(config);
    
    // Create tool instances
    this.transcribeTool = new TranscribeAudioTool(this.provider);
    this.generateTool = new GenerateVoiceTool(this.provider);
    
    // Store tools array for getTools()
    this.tools = [this.transcribeTool, this.generateTool];
    
    console.log(`VoiceModule initialized with ${config.provider || 'openai'} provider`);
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
   * Get all tools provided by this module
   */
  getTools() {
    return this.tools;
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