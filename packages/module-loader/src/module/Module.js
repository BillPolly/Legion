import { EventEmitter } from 'events';
import Tool from '../tool/Tool.js';
import OpenAIToolAdapter from '../tool/adapters/OpenAIToolAdapter.js';

/**
 * Module - A clean module base class that works with Tool
 * 
 * This module automatically forwards events from its tools and provides
 * a simpler API for managing tools.
 * 
 * @example
 * ```javascript
 * import { Module, Tool } from '@legion/module-loader';
 * 
 * class MyModule extends Module {
 *   constructor() {
 *     super('MyModule');
 *   }
 *   
 *   async initialize() {
 *     // Create and register tools
 *     this.registerTool(new MyTool());
 *     this.registerTool(new AnotherTool());
 *   }
 * }
 * ```
 */
class Module extends EventEmitter {
  /**
   * Create a new module
   * @param {string} name - Module name (optional for backward compatibility)
   */
  constructor(name = '') {
    super();
    this.name = name;
    this.tools = [];
    this.toolMap = new Map();
    this.toolAdapters = new Map();
  }
  
  /**
   * Register a tool with this module
   * @param {string} name - Tool name (for backward compatibility)
   * @param {Tool} tool - Tool instance
   * @returns {Module} This module for chaining
   */
  registerTool(name, tool) {
    // Handle both new style (single arg) and old style (name, tool) calls
    if (typeof name === 'object' && name.name) {
      tool = name;
      name = tool.name;
    }
    
    // Store the tool
    this.tools.push(tool);
    this.toolMap.set(tool.name || name, tool);
    
    // Set module reference if tool supports it (backward compatibility)
    if (typeof tool.setModule === 'function') {
      tool.setModule(this);
    }
    
    // Forward tool events with module context (if tool extends EventEmitter)
    if (tool instanceof EventEmitter) {
      tool.on('event', (event) => {
        // Add module name to event
        const moduleEvent = {
          ...event,
          module: this.name
        };
        
        // Only emit specific event type if there are listeners
        // This prevents unhandled 'error' events from crashing the process
        if (this.listenerCount(event.type) > 0) {
          this.emit(event.type, moduleEvent);
        }
        
        // Always emit generic 'event' for catch-all listeners
        this.emit('event', moduleEvent);
      });
    }
    
    return this;
  }
  
  /**
   * Get all tools as an array
   * @returns {Tool[]} Array of tools
   */
  getTools() {
    return this.tools;
  }
  
  /**
   * Get a tool by name
   * @param {string} name - Tool name
   * @returns {Tool|null} The tool or null if not found
   */
  getTool(name) {
    return this.toolMap.get(name) || null;
  }
  
  /**
   * Get all tools wrapped for OpenAI function calling
   * @returns {OpenAIToolAdapter[]} Array of wrapped tools
   */
  getOpenAITools() {
    const adapters = [];
    
    for (const tool of this.tools) {
      // Check if we already have an adapter for this tool
      if (!this.toolAdapters.has(tool.name)) {
        const adapter = new OpenAIToolAdapter(tool);
        adapter.setModule(this); // For legacy event compatibility
        this.toolAdapters.set(tool.name, adapter);
      }
      
      adapters.push(this.toolAdapters.get(tool.name));
    }
    
    return adapters;
  }
  
  /**
   * Initialize the module
   * Override this in subclasses to register tools
   * @returns {Promise<Module>} The initialized module
   */
  async initialize() {
    return this;
  }
  
  /**
   * Clean up module resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Remove all event listeners from tools
    for (const tool of this.tools) {
      if (tool instanceof EventEmitter) {
        tool.removeAllListeners();
      }
    }
    
    // Clear collections
    this.tools = [];
    this.toolMap.clear();
    this.toolAdapters.clear();
    
    // Remove module listeners
    this.removeAllListeners();
  }
  
  /**
   * Execute a tool by name
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} params - Parameters to pass to the tool
   * @returns {Promise<*>} Tool execution result
   */
  async executeTool(toolName, params) {
    const tool = this.getTool(toolName);
    
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in module '${this.name}'`);
    }
    
    // Use run() if available (new tools), otherwise execute() (legacy)
    if (typeof tool.run === 'function') {
      return await tool.run(params);
    } else if (typeof tool.execute === 'function') {
      return await tool.execute(params);
    } else {
      throw new Error(`Tool '${toolName}' has no execute or run method`);
    }
  }
  
  /**
   * Get module metadata
   * @returns {Object} Module metadata including all tools
   */
  getMetadata() {
    return {
      name: this.name,
      tools: this.tools.map(tool => {
        if (typeof tool.getMetadata === 'function') {
          return tool.getMetadata();
        }
        // Fallback for legacy tools
        return {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        };
      })
    };
  }
  
  /**
   * Emit a standardized event with consistent structure
   * @param {string} type - Event type: 'progress', 'warning', 'error', 'info'
   * @param {string} message - Human readable message
   * @param {Object} data - Optional structured data
   * @param {string} tool - Optional tool name that triggered the event
   * @param {string} level - Optional priority level: 'low', 'medium', 'high'
   */
  emitEvent(type, message, data = {}, tool = null, level = 'medium') {
    const event = {
      type,
      module: this.name,
      tool,
      message,
      data,
      timestamp: new Date().toISOString(),
      level
    };
    
    this.emit(type, event);
    this.emit('event', event); // Generic event for listeners who want all events
  }
  
  /**
   * Emit a progress event
   * @param {string} message - Progress message
   * @param {Object} data - Optional progress data (percentage, step, etc.)
   * @param {string} tool - Optional tool name
   */
  emitProgress(message, data = {}, tool = null) {
    this.emitEvent('progress', message, data, tool, 'low');
  }
  
  /**
   * Emit a warning event
   * @param {string} message - Warning message
   * @param {Object} data - Optional warning data
   * @param {string} tool - Optional tool name
   */
  emitWarning(message, data = {}, tool = null) {
    this.emitEvent('warning', message, data, tool, 'medium');
  }
  
  /**
   * Emit an error event
   * @param {string} message - Error message
   * @param {Object} data - Optional error data
   * @param {string} tool - Optional tool name
   */
  emitError(message, data = {}, tool = null) {
    this.emitEvent('error', message, data, tool, 'high');
  }
  
  /**
   * Emit an info event
   * @param {string} message - Info message
   * @param {Object} data - Optional info data
   * @param {string} tool - Optional tool name
   */
  emitInfo(message, data = {}, tool = null) {
    this.emitEvent('info', message, data, tool, 'low');
  }
}

export { Module };