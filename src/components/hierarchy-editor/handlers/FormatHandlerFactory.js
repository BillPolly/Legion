/**
 * FormatHandlerFactory - Factory for creating format handlers
 */

import { BaseFormatHandler } from './BaseFormatHandler.js';

// Import handlers to ensure they register themselves
import './JsonHandler.js';
import './XmlHandler.js';
import './YamlHandler.js';
import './MarkdownHandler.js';

export class FormatHandlerFactory {
  
  /**
   * Create a handler for the specified format
   * @param {string} format - Format type
   * @returns {BaseFormatHandler} Handler instance
   */
  static create(format) {
    return BaseFormatHandler.getHandler(format);
  }
  
  /**
   * Get supported formats
   * @returns {string[]} Array of supported format names
   */
  static getSupportedFormats() {
    return BaseFormatHandler.getFormats();
  }
  
  /**
   * Check if format is supported
   * @param {string} format - Format to check
   * @returns {boolean} True if supported
   */
  static isSupported(format) {
    return BaseFormatHandler.getFormats().includes(format.toLowerCase());
  }
  
  /**
   * Register a custom handler
   * @param {string} format - Format name
   * @param {class} HandlerClass - Handler class
   */
  static registerHandler(format, HandlerClass) {
    BaseFormatHandler.register(format, HandlerClass);
  }
}