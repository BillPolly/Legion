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
    this.metadataPath = './module.json';
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
    
    // Get API key
    const serperKey = this.resourceManager.get('env.SERPER_API_KEY');
    
    // Create tool using metadata
    const tool = this.createToolFromMetadata('google_search', Serper);
    if (serperKey) {
      tool.apiKey = serperKey;
    }
    this.registerTool(tool.name, tool);
  }
}
