/**
 * ServerStarterModule - Module wrapper for server management tools using metadata-driven architecture
 */

import { Module } from '@legion/tools-registry';
import ServerStartTool from './ServerStartTool.js';
import ServerReadOutputTool from './ServerReadOutputTool.js';
import ServerStopTool from './ServerStopTool.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ServerStarterModule - Provides server management tools using metadata-driven architecture
 */
export default class ServerStarterModule extends Module {
  constructor() {
    super();
    this.name = 'server-starter';
    this.description = 'Server management tools for starting, stopping, and monitoring server processes';
    this.version = '1.0.0';
    
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
    
    this.toolClasses = {
      ServerStartTool,
      ServerReadOutputTool,
      ServerStopTool
    };
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new ServerStarterModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module - NEW metadata-driven approach
   */
  async initialize() {
    await super.initialize(); // This loads metadata automatically
    
    // NEW APPROACH: Create tools using metadata
    if (this.metadata) {
      const tools = [
        { key: 'server_start', class: ServerStartTool },
        { key: 'server_read_output', class: ServerReadOutputTool },
        { key: 'server_stop', class: ServerStopTool }
      ];

      for (const { key, class: ToolClass } of tools) {
        try {
          const tool = this.createToolFromMetadata(key, ToolClass);
          this.registerTool(tool.name, tool);
        } catch (error) {
          console.warn(`Failed to create metadata tool ${key}, falling back to legacy: ${error.message}`);
          
          // Fallback to legacy
          const legacyTool = new ToolClass();
          this.registerTool(legacyTool.name, legacyTool);
        }
      }
    } else {
      // FALLBACK: Old approach for backwards compatibility
      const startTool = new ServerStartTool();
      const readTool = new ServerReadOutputTool();
      const stopTool = new ServerStopTool();
      
      this.registerTool(startTool.name, startTool);
      this.registerTool(readTool.name, readTool);
      this.registerTool(stopTool.name, stopTool);
    }
  }

  /**
   * Get module metadata from loaded metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      author: this.author || 'Legion Team',
      tools: this.getTools().length,
      capabilities: this.capabilities || [],
      supportedFeatures: this.supportedFeatures || []
    };
  }

  /**
   * Get all tools provided by this module
   */
  getTools() {
    if (!this.initialized) {
      throw new Error('ServerStarterModule must be initialized before getting tools');
    }
    return Object.values(this.tools);
  }
}
