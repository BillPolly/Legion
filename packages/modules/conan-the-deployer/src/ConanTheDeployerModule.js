/**
 * ConanTheDeployerModule - Comprehensive deployment management module using metadata-driven architecture
 * 
 * Provides tools for deploying, monitoring, and managing applications across multiple providers.
 */

import DeployApplicationTool from './tools/DeployApplicationTool.js';
import CheckDeploymentTool from './tools/CheckDeploymentTool.js';
import ListDeploymentsTool from './tools/ListDeploymentsTool.js';
import GetDeploymentLogsTool from './tools/GetDeploymentLogsTool.js';
import MonitorDeploymentTool from './tools/MonitorDeploymentTool.js';
import StopDeploymentTool from './tools/StopDeploymentTool.js';
import UpdateDeploymentTool from './tools/UpdateDeploymentTool.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ConanTheDeployerModule - Provides deployment management tools using metadata-driven architecture
 */
export default class ConanTheDeployerModule {
  constructor() {
    this.name = 'conan-the-deployer';
    this.description = 'Comprehensive deployment management tools for deploying and monitoring applications';
    this.version = '1.0.0';
    this.tools = {};
    this.initialized = false;
    
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
    
    this.toolClasses = {
      DeployApplicationTool,
      CheckDeploymentTool,
      ListDeploymentsTool,
      GetDeploymentLogsTool,
      MonitorDeploymentTool,
      StopDeploymentTool,
      UpdateDeploymentTool
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
    const module = new ConanTheDeployerModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    // Create tools directly without metadata dependency
    const deployTool = new DeployApplicationTool();
    const checkTool = new CheckDeploymentTool();
    
    this.registerTool(deployTool.name, deployTool);
    this.registerTool(checkTool.name, checkTool);
    
    this.initialized = true;
  }
  
  /**
   * Register a tool with the module
   */
  registerTool(name, tool) {
    this.tools[name] = tool;
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
      throw new Error('ConanTheDeployerModule must be initialized before getting tools');
    }
    return Object.values(this.tools);
  }
}