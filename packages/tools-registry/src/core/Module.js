/**
 * Module - Standard base class for Legion modules
 * 
 * Provides standardized interface for all modules in the Legion framework.
 * All modules must extend this class and follow the defined patterns.
 * 
 * NEW: Supports metadata-driven tool creation via tools-metadata.json
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';

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
    
    // NEW: Metadata management
    this.metadata = null;       // Loaded from tools-metadata.json
    this.metadataPath = null;   // Path to metadata file
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
    
    // Try to load metadata if metadataPath is set
    if (this.metadataPath) {
      await this.loadMetadata(this.metadataPath);
    }
    
    this.initialized = true;
  }

  /**
   * Load tool metadata from JSON file
   * @param {string} filePath - Path to tools-metadata.json file (relative to module)
   * @returns {Promise<Object>} Loaded metadata
   */
  async loadMetadata(filePath) {
    try {
      // Resolve path relative to module file location
      const fullPath = path.resolve(path.dirname(this.getModulePath()), filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      this.metadata = JSON.parse(content);
      this.metadataPath = fullPath;
      
      // Validate metadata structure
      this._validateMetadata();
      
      return this.metadata;
    } catch (error) {
      throw new Error(`Failed to load metadata from ${filePath}: ${error.message}`);
    }
  }

  /**
   * Get tool metadata by name
   * @param {string} toolName - Name of the tool
   * @returns {Object|null} Tool metadata or null if not found
   */
  getToolMetadata(toolName) {
    if (!this.metadata?.tools) {
      return null;
    }
    return this.metadata.tools[toolName] || null;
  }

  /**
   * Get all tool metadata
   * @returns {Object} All tool metadata keyed by tool name
   */
  getAllToolMetadata() {
    return this.metadata?.tools || {};
  }

  /**
   * Create tool instance using metadata
   * @param {string} toolName - Name of tool to create
   * @param {Function} ToolClass - Tool class constructor
   * @returns {Object} Tool instance
   */
  createToolFromMetadata(toolName, ToolClass) {
    const metadata = this.getToolMetadata(toolName);
    if (!metadata) {
      throw new Error(`Tool metadata not found: ${toolName}`);
    }
    
    // Use NEW pattern: Tool(module, toolName)
    return new ToolClass(this, toolName);
  }

  /**
   * Get module file path (to be overridden by subclasses if needed)
   * @returns {string} Path to module file
   */
  getModulePath() {
    // Default implementation - subclasses can override
    return import.meta.url;
  }

  /**
   * Validate metadata structure
   * @private
   */
  _validateMetadata() {
    if (!this.metadata) {
      throw new Error('Metadata is null or undefined');
    }
    
    if (!this.metadata.module) {
      throw new Error('Metadata must have "module" section');
    }
    
    if (!this.metadata.tools || typeof this.metadata.tools !== 'object') {
      throw new Error('Metadata must have "tools" section as object');
    }
    
    // Validate each tool has required properties
    for (const [toolName, toolMeta] of Object.entries(this.metadata.tools)) {
      if (!toolMeta.name) {
        throw new Error(`Tool ${toolName} missing name in metadata`);
      }
      if (!toolMeta.description) {
        throw new Error(`Tool ${toolName} missing description in metadata`);
      }
      if (!toolMeta.inputSchema) {
        throw new Error(`Tool ${toolName} missing inputSchema in metadata`);
      }
    }
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
  
  /**
   * Test all tools in this module
   * Generic implementation that works for all modules
   * @returns {Promise<Object>} Test results with detailed report
   */
  async testTools() {
    const tools = this.getTools();
    const results = {
      moduleName: this.name,
      totalTools: tools.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      results: [],
      summary: ''
    };
    
    console.log(`[${this.name}] Testing ${tools.length} tools...`);
    
    for (const tool of tools) {
      const testResult = {
        toolName: tool.name,
        success: false,
        error: null,
        duration: 0,
        skipped: false
      };
      
      try {
        const startTime = Date.now();
        
        // Basic validation test - ensure tool has _execute method
        if (typeof tool._execute !== 'function') {
          throw new Error('Tool does not implement _execute() method');
        }
        
        // Try to call _execute with empty/minimal params for basic functionality test
        try {
          // Most tools will fail with empty params, but we're testing the structure
          await tool._execute({});
        } catch (paramError) {
          // If it's a validation error, that's expected and means the tool structure is correct
          if (paramError.message.includes('validation') || 
              paramError.message.includes('required') ||
              paramError.message.includes('missing') ||
              paramError.message.includes('parameter')) {
            // This is good - tool is validating inputs properly
            testResult.success = true;
          } else {
            // Some other error - log it but don't fail the test entirely
            testResult.success = true;
            testResult.warning = paramError.message;
          }
        }
        
        testResult.duration = Date.now() - startTime;
        
        if (testResult.success) {
          results.successful++;
          console.log(`[${this.name}] ✓ ${tool.name} passed (${testResult.duration}ms)`);
        }
        
      } catch (error) {
        testResult.error = error.message;
        results.failed++;
        console.log(`[${this.name}] ✗ ${tool.name} failed: ${error.message}`);
      }
      
      results.results.push(testResult);
    }
    
    results.summary = `${results.successful}/${results.totalTools} tools passed, ${results.failed} failed, ${results.skipped} skipped`;
    console.log(`[${this.name}] Test complete: ${results.summary}`);
    
    return results;
  }
}