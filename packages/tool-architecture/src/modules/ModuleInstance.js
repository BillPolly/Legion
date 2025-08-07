/**
 * ModuleInstance base class
 * Base class for module instances that hold and provide tools
 */

import { EventEmitter } from 'events';

export class ModuleInstance extends EventEmitter {
  constructor(moduleDefinition, config) {
    super();
    this.moduleDefinition = moduleDefinition;
    this.config = config;
    this.tools = {};
  }
  
  /**
   * Create the tools (to be implemented by subclass)
   */
  createTools() {
    throw new Error('Must be implemented by subclass');
  }
  
  /**
   * Register a tool and forward its events
   * @param {string} name - Tool name
   * @param {Tool} tool - Tool instance
   */
  registerTool(name, tool) {
    this.tools[name] = tool;
    
    // Forward tool events to module level
    if (tool instanceof EventEmitter) {
      // Forward all tool events with context
      ['progress', 'error', 'info', 'warning'].forEach(eventType => {
        tool.on(eventType, (data) => {
          this.emit(eventType, {
            ...data,
            module: this.moduleDefinition?.name || 'unknown',
            tool: name
          });
        });
      });
    }
  }
  
  /**
   * Async initialization (can be overridden)
   */
  async initialize() {
    // Override in subclass if async setup needed
  }
  
  /**
   * Get a tool by name
   * @param {string} name - Tool name
   * @returns {Tool} The requested tool
   */
  getTool(name) {
    const tool = this.tools[name];
    if (!tool) {
      throw new Error(`Tool '${name}' not found in module`);
    }
    return tool;
  }
  
  /**
   * Execute a tool by name
   * @param {string} name - Tool name
   * @param {Object} input - Input for the tool
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(name, input) {
    const tool = this.getTool(name);
    return await tool.execute(input);
  }
  
  /**
   * List available tool names
   * @returns {string[]} Array of tool names
   */
  listTools() {
    return Object.keys(this.tools);
  }
  
  /**
   * Emit a progress event
   * @param {string} message - Progress message
   * @param {number} percentage - Progress percentage (0-100)
   * @param {Object} data - Additional data
   */
  progress(message, percentage = 0, data = {}) {
    this.emit('progress', { 
      module: this.moduleDefinition?.name || 'unknown',
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
      module: this.moduleDefinition?.name || 'unknown',
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
      module: this.moduleDefinition?.name || 'unknown',
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
      module: this.moduleDefinition?.name || 'unknown',
      message, 
      timestamp: new Date().toISOString(),
      ...data 
    });
  }
  
  /**
   * Optional: cleanup resources
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
    
    // Override in subclass if additional cleanup needed
  }
}