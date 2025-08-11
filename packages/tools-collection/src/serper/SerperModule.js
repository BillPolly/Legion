import { Module } from '@legion/tools';
import { Serper } from './Serper.js';

/**
 * SerperModule - Module wrapper for Serper tool with proper initialization
 */
export default class SerperModule extends Module {
  constructor(dependencies = {}) {
    super();
    this.name = 'SerperModule';
    this.description = 'Google search using Serper API';
    this.config = dependencies;
  }

  /**
   * Static async factory method following the ResourceManager pattern
   */
  static async create(resourceManager) {
    // Get SERPER API key from environment
    const serperKey = resourceManager.get('env.SERPER_API_KEY');
    if (!serperKey) {
      // Create module without API key - tool will fail at runtime
      console.warn('SERPER_API_KEY environment variable not found - tool will require initialization');
    }
    
    // Create module with dependencies
    const module = new SerperModule({ SERPER: serperKey });
    await module.initialize();
    return module;
  }

  async initialize() {
    await super.initialize();
    
    // Initialize tools dictionary
    this.tools = {};
    
    // Create the Serper tool
    // Don't initialize it - let it initialize at runtime or fail gracefully
    const serperTool = new Serper();
    
    // Set API key if available but don't call initialize
    // The tool will check for apiKey when invoke is called
    if (this.config.SERPER) {
      serperTool.apiKey = this.config.SERPER;
    }
    
    // Register the tool
    this.registerTool(serperTool.name, serperTool);
  }
}