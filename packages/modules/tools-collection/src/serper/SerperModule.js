import { Module } from '@legion/tools-registry';
import { Serper } from './Serper.js';

/**
 * SerperModule - Module wrapper for Serper tool with proper initialization
 */
export default class SerperModule extends Module {
  constructor() {
    super();
    this.name = 'SerperModule';
    this.description = 'Google search using Serper API';
    this.version = '1.0.0';
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

  async initialize() {
    await super.initialize();
    
    // Get SERPER API key from environment via ResourceManager
    const serperKey = this.resourceManager.get('env.SERPER_API_KEY');
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
}
