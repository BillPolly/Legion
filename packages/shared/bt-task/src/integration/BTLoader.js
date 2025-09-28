/**
 * BTLoader - Loads and validates BT configurations from JSON
 */

import { BTExecutor } from '../core/BTExecutor.js';
import fs from 'fs/promises';

/**
 * Loader for behavior tree configurations
 */
export class BTLoader {
  constructor(toolRegistry) {
    this.toolRegistry = toolRegistry;
    this.treeConfig = null;
    this.executor = new BTExecutor(toolRegistry);
  }
  
  /**
   * Load configuration object
   * @param {Object} config - Tree configuration
   */
  loadConfig(config) {
    this.validateConfig(config);
    this.treeConfig = config;
  }
  
  /**
   * Load from JSON string
   * @param {string} jsonString - JSON string configuration
   */
  loadJSON(jsonString) {
    try {
      const config = JSON.parse(jsonString);
      this.loadConfig(config);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  }
  
  /**
   * Load from file
   * @param {string} filePath - Path to JSON file
   */
  async loadFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      this.loadJSON(content);
      return this.treeConfig;
    } catch (error) {
      throw new Error(`Failed to load file: ${error.message}`);
    }
  }
  
  /**
   * Validate configuration
   * @param {Object} config - Configuration to validate
   */
  validateConfig(config) {
    // Validate required fields
    if (!config.type) {
      throw new Error('Node configuration missing required field: type is required');
    }
    
    // Validate node type
    const validTypes = [
      'action', 'sequence', 'selector', 
      'condition', 'retry', 'parallel'
    ];
    
    if (!validTypes.includes(config.type)) {
      throw new Error(`Unknown node type: ${config.type}`);
    }
    
    // Validate action nodes
    if (config.type === 'action' && !config.tool) {
      throw new Error('Action nodes require tool property');
    }
    
    // Validate composite nodes
    const compositeTypes = ['sequence', 'selector', 'parallel'];
    if (compositeTypes.includes(config.type)) {
      if (!config.children || !Array.isArray(config.children)) {
        throw new Error(`${config.type.charAt(0).toUpperCase() + config.type.slice(1)} nodes require children array`);
      }
      // Recursively validate children
      config.children.forEach(child => this.validateConfig(child));
    }
    
    // Validate condition nodes
    if (config.type === 'condition') {
      if (!config.condition) {
        throw new Error('Condition nodes require condition property');
      }
      // Condition nodes can have children but it's optional
      if (config.children && Array.isArray(config.children)) {
        config.children.forEach(child => this.validateConfig(child));
      }
    }
    
    // Validate retry nodes
    if (config.type === 'retry') {
      if (!config.children || !Array.isArray(config.children) || config.children.length === 0) {
        throw new Error('Retry nodes require at least one child');
      }
      // Validate retry children
      config.children.forEach(child => this.validateConfig(child));
    }
  }
  
  /**
   * Get loaded tree configuration
   * @returns {Object} Tree configuration
   */
  getTree() {
    return this.treeConfig;
  }
  
  /**
   * Execute the loaded tree
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async execute(context = {}) {
    if (!this.treeConfig) {
      throw new Error('No tree configuration loaded');
    }
    
    return this.executor.executeTree(this.treeConfig, {
      ...context,
      toolRegistry: this.toolRegistry
    });
  }
}

export default BTLoader;