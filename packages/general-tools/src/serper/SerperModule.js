import { Module } from '@legion/module-loader';
import Serper from './index.js';

/**
 * SerperModule - Module wrapper for Serper tool with proper initialization
 */
export default class SerperModule extends Module {
  constructor(dependencies = {}) {
    super();
    this.name = 'SerperModule';
    this.description = 'Google search using Serper API';
    this.dependencies = dependencies;
  }

  /**
   * Static async factory method following the ResourceManager pattern
   */
  static async create(resourceManager) {
    // Get SERPER API key from environment
    const serperKey = resourceManager.get('env.SERPER');
    if (!serperKey) {
      throw new Error('SERPER environment variable not found');
    }
    
    // Create module with dependencies
    const module = new SerperModule({ SERPER: serperKey });
    await module.initialize();
    return module;
  }

  async initialize() {
    await super.initialize();
    
    // Create and initialize the Serper tool
    this.serperTool = new Serper();
    
    // Initialize with API key from dependencies
    if (this.dependencies.SERPER) {
      await this.serperTool.initialize({ apiKey: this.dependencies.SERPER });
    }
  }

  getTools() {
    return [this.serperTool];
  }
}