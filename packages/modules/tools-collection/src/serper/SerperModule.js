import { Module } from '@legion/tools-registry';
import { Serper } from './Serper.js';
import { fileURLToPath } from 'url';

/**
 * SerperModule - Module wrapper for Serper tool with proper initialization
 */
export default class SerperModule extends Module {
  constructor() {
    super();
    this.name = 'SerperModule';
    this.description = 'Google search using Serper API';
    this.version = '1.0.0';
    this.metadataPath = './tools-metadata.json';
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new SerperModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  async initialize() {
    await super.initialize();
    
    // Get API key first (needed for both modes)
    const serperKey = this.resourceManager.get('env.SERPER_API_KEY');
    
    // NEW APPROACH: Create tools using metadata
    if (this.metadata) {
      try {
        const tool = this.createToolFromMetadata('google_search', Serper);
        if (serperKey) {
          tool.apiKey = serperKey;
        }
        this.registerTool(tool.name, tool);
        console.log('SerperModule: Initialized using metadata-driven architecture');
        return;
      } catch (error) {
        console.warn('SerperModule: Metadata-driven initialization failed, falling back to legacy mode:', error.message);
      }
    }
    
    // FALLBACK: Legacy initialization
    if (!serperKey) {
      // Create module without API key - tool will fail at runtime
      console.warn('SERPER_API_KEY environment variable not found - tool will require initialization');
    }
    
    // Create the Serper tool
    // Don't initialize it - let it initialize at runtime or fail gracefully
    const serperTool = new Serper();
    
    // Set API key if available but don't call initialize
    // The tool will check for apiKey when invoke is called
    if (serperKey) {
      serperTool.apiKey = serperKey;
    }
    
    // Register the tool
    this.registerTool(serperTool.name, serperTool);
  }

  // Metadata-driven tool implementations
  async google_search(params) {
    // Get SERPER API key from environment via ResourceManager
    const serperKey = this.resourceManager.get('env.SERPER_API_KEY');
    if (!serperKey) {
      throw new Error('SERPER_API_KEY environment variable is required for Google search');
    }
    
    // Create and configure Serper tool
    const serperTool = new Serper();
    serperTool.apiKey = serperKey;
    
    // Execute the search
    return await serperTool.execute(params);
  }
}
