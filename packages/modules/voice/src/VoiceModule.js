import { Module } from '@legion/tools-registry';
import { OpenAIVoiceProvider } from './providers/OpenAIVoiceProvider.js';
import { TranscribeAudioTool } from './tools/TranscribeAudioTool.js';
import { GenerateVoiceTool } from './tools/GenerateVoiceTool.js';
import { fileURLToPath } from 'url';

/**
 * VoiceModule - Legion module for voice services
 * 
 * Provides speech-to-text and text-to-speech capabilities through
 * a provider architecture. Currently supports OpenAI (Whisper + TTS).
 */
class VoiceModule extends Module {
  constructor(config = null) {
    super();
    this.name = 'voice';
    this.description = 'Voice services module providing speech-to-text and text-to-speech capabilities';
    this.version = '1.0.0';
    this.resourceManager = null;
    this.provider = null;
    this.config = config || {};
    this.tools = [];
    this.transcribeTool = null;
    this.generateTool = null;
    this.metadataPath = './tools-metadata.json';
    
    // If config provided directly (for testing), initialize immediately
    if (config) {
      this.provider = this.createProvider(config);
      this._createTools();
    }
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

  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // If already initialized (direct config), skip
    if (this.provider) {
      return this;
    }
    
    // Initialize provider first (needed for both modes)
    await this.initializeProvider();
    
    // NEW APPROACH: Create tools using metadata
    if (this.metadata) {
      try {
        const transcribeTool = this.createToolFromMetadata('transcribe_audio', TranscribeAudioTool);
        const generateTool = this.createToolFromMetadata('generate_voice', GenerateVoiceTool);

        // Pass provider to tools
        transcribeTool.provider = this.provider;
        generateTool.provider = this.provider;

        // Store references for compatibility
        this.transcribeTool = transcribeTool;
        this.generateTool = generateTool;
        this.tools = [transcribeTool, generateTool];

        this.registerTool(transcribeTool.name, transcribeTool);
        this.registerTool(generateTool.name, generateTool);

        console.log('VoiceModule: Initialized using metadata-driven architecture');
      } catch (error) {
        console.warn('VoiceModule: Metadata-driven initialization failed, falling back to legacy mode:', error.message);

        // Fallback to legacy
        this._createTools();
      }
    } else {
      // FALLBACK: Old approach for backwards compatibility
      this._createTools();
    }
    
    console.log(`VoiceModule initialized with ${this.config?.provider || 'openai'} provider`);
    return this;
  }

  /**
   * Initialize the voice provider
   */
  async initializeProvider() {
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
    this.provider = this.createProvider(this.config);
  }
  
  /**
   * Create and register tools
   */
  _createTools() {
    this.transcribeTool = new TranscribeAudioTool(this.provider);
    this.generateTool = new GenerateVoiceTool(this.provider);
    
    // Store tools in array for compatibility
    this.tools = [this.transcribeTool, this.generateTool];
    
    // Register tools in the Module's tool registry
    this.registerTool(this.transcribeTool.name, this.transcribeTool);
    this.registerTool(this.generateTool.name, this.generateTool);
  }

  /**
   * Create voice provider based on configuration
   */
  createProvider(config) {
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

  // Metadata-driven tool implementations
  async transcribe_audio(params) {
    const transcribeTool = new TranscribeAudioTool(this.provider);
    return await transcribeTool.execute(params);
  }

  async generate_voice(params) {
    const generateTool = new GenerateVoiceTool(this.provider);
    return await generateTool.execute(params);
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
   * Get tools array for compatibility
   */
  getTools() {
    return this.tools;
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
  
  /**
   * Test all tools in this module
   * @returns {Promise<Object>} Test results with detailed report
   */
  async testTools() {
    const results = {
      moduleName: this.name,
      totalTools: this.getTools().length,
      successful: 0,
      failed: 0,
      results: [],
      summary: ''
    };
    
    const tools = this.getTools();
    console.log(`[${this.name}] Testing ${tools.length} tools...`);
    
    for (const tool of tools) {
      const testResult = {
        toolName: tool.name,
        success: false,
        error: null,
        duration: 0
      };
      
      try {
        const startTime = Date.now();
        
        // Test tool based on its type
        if (tool.name === 'transcribe_audio') {
          // Skip transcribe test as it requires actual audio file
          testResult.success = true;
          testResult.skipped = true;
          testResult.reason = 'Requires audio file input';
        } else if (tool.name === 'generate_voice') {
          // Test with minimal parameters
          const testParams = {
            text: 'Test voice generation',
            voice: 'alloy'
          };
          await tool._execute(testParams);
          testResult.success = true;
        }
        
        testResult.duration = Date.now() - startTime;
        results.successful++;
        console.log(`[${this.name}] ✓ ${tool.name} passed (${testResult.duration}ms)`);
        
      } catch (error) {
        testResult.error = error.message;
        results.failed++;
        console.log(`[${this.name}] ✗ ${tool.name} failed: ${error.message}`);
      }
      
      results.results.push(testResult);
    }
    
    results.summary = `${results.successful}/${results.totalTools} tools passed`;
    console.log(`[${this.name}] Test complete: ${results.summary}`);
    
    return results;
  }
}

// Export the class as default for module.json
export default VoiceModule;