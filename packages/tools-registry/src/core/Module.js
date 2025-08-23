/**
 * Module - Standard base class for Legion modules
 * 
 * Provides standardized interface for all modules in the Legion framework.
 * All modules must extend this class and follow the defined patterns.
 */

import { EventEmitter } from 'events';

export class Module extends EventEmitter {
  constructor() {
    super();
    
    // Required properties - must be set by subclass
    this.name = null;           // Must be set by subclass
    this.description = null;    // Must be set by subclass 
    this.version = '1.0.0';     // Optional - can be overridden
    
    // Internal tool storage
    this.tools = {};
    this.initialized = false;
  }
  
  /**
   * Static async factory method - must be implemented by all modules
   * @param {ResourceManager} resourceManager - The resource manager for dependency injection
   * @returns {Promise<Module>} Initialized module instance
   */
  static async create(resourceManager) {
    throw new Error('Static create() method must be implemented by subclass');
  }
  
  /**
   * Async initialization - should be called by static create() method
   * Can be overridden by subclass for additional setup
   */
  async initialize() {
    if (this.initialized) return;
    
    // Validation
    if (!this.name) {
      throw new Error('Module name must be set in constructor');
    }
    if (!this.description) {
      throw new Error('Module description must be set in constructor');
    }
    
    this.initialized = true;
  }
  
  /**
   * Get all tools as an array - standard interface
   * @returns {Array} Array of tool objects
   */
  getTools() {
    if (!this.initialized) {
      throw new Error(`Module ${this.name || 'unknown'} must be initialized before getting tools`);
    }
    return Object.values(this.tools);
  }
  
  /**
   * Get a specific tool by name
   * @param {string} name - Tool name
   * @returns {Object} Tool object or null if not found
   */
  getTool(name) {
    return this.tools[name] || null;
  }
  
  /**
   * Register a tool with the module
   * @param {string} name - Tool name
   * @param {Object} tool - Tool instance
   */
  registerTool(name, tool) {
    if (!tool) {
      throw new Error(`Cannot register null/undefined tool: ${name}`);
    }
    
    if (!tool.name) {
      tool.name = name; // Ensure tool has name property
    }
    
    this.tools[name] = tool;
    
    // Forward tool events to module level if tool is an EventEmitter
    if (tool.on && typeof tool.on === 'function') {
      const forwardEvent = (eventType) => {
        tool.on(eventType, (data) => {
          this.emit(eventType, {
            tool: name,
            module: this.name,
            ...data
          });
        });
      };
      
      // Forward common events
      ['progress', 'error', 'info', 'warning'].forEach(forwardEvent);
    }
  }
  
  /**
   * List tool names
   * @returns {Array<string>} Array of tool names
   */
  listTools() {
    return Object.keys(this.tools);
  }
  
  /**
   * Execute a tool by name
   * @param {string} name - Tool name
   * @param {Object} input - Tool input parameters
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(name, input) {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found in module '${this.name}'`);
    }
    
    if (typeof tool.execute !== 'function') {
      throw new Error(`Tool '${name}' does not have execute method`);
    }
    
    return await tool.execute(input);
  }
  
  /**
   * Get module metadata
   * @returns {Object} Module metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      toolCount: Object.keys(this.tools).length,
      tools: Object.keys(this.tools).map(name => ({
        name: name,
        description: this.tools[name].description || 'No description'
      }))
    };
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    // Remove event listeners from all tools
    for (const tool of Object.values(this.tools)) {
      if (tool instanceof EventEmitter) {
        tool.removeAllListeners();
      }
    }
    
    // Remove module listeners
    this.removeAllListeners();
    
    // Clear tools
    this.tools = {};
    this.initialized = false;
  }
  
  /**
   * Emit a progress event
   * @param {string} message - Progress message
   * @param {number} percentage - Progress percentage (0-100)
   * @param {Object} data - Additional data
   */
  progress(message, percentage = 0, data = {}) {
    this.emit('progress', { 
      module: this.name,
      message, 
      percentage, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }
  
  /**
   * Emit an error event
   * @param {string} message - Error message
   * @param {Object} data - Additional error data
   */
  error(message, data = {}) {
    this.emit('error', { 
      module: this.name,
      message, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }
  
  /**
   * Emit an info event
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info(message, data = {}) {
    this.emit('info', { 
      module: this.name,
      message, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }
  
  /**
   * Emit a warning event
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warning(message, data = {}) {
    this.emit('warning', { 
      module: this.name,
      message, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }
}