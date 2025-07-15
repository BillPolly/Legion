import { EventEmitter } from 'events';

/**
 * Base class for modules that contain related tools
 * Extends EventEmitter to support progress, warning, and error events
 */
class Module extends EventEmitter {
  constructor() {
    super();
    this.name = '';
    this.tools = [];
  }

  /**
   * Register a tool with this module
   * @param {string} name - Tool name
   * @param {Tool} tool - Tool instance
   */
  registerTool(name, tool) {
    this.tools.push(tool);
    
    // Set the module reference for event emission
    if (typeof tool.setModule === 'function') {
      tool.setModule(this);
    }
  }

  /**
   * Get all tools provided by this module
   * @returns {Array<Tool>} Array of tools
   */
  getTools() {
    return this.tools;
  }

  /**
   * Initialize the module
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
    // Override in subclasses if cleanup is needed
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