/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * EncodeModule - Module wrapper for encoding/decoding tools
 */

import { Module, Tool } from '@legion/tools-registry';
import { fileURLToPath } from 'url';

/**
 * Base64 encoding tool
 * NEW: Pure logic implementation - metadata comes from module.json
 */
class Base64EncodeTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    const { data, inputEncoding = 'utf8' } = params;
    
    const buffer = Buffer.from(data, inputEncoding);
    const encoded = buffer.toString('base64');
    
    return {
      result: encoded,
      originalLength: data.length,
      encodedLength: encoded.length
    };
  }
}


/**
 * Base64 decoding tool
 * NEW: Pure logic implementation - metadata comes from module.json
 */
class Base64DecodeTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    const { data, outputEncoding = 'utf8' } = params;
    
    const buffer = Buffer.from(data, 'base64');
    const decoded = buffer.toString(outputEncoding);
    
    return {
      result: decoded,
      originalLength: data.length,
      decodedLength: decoded.length
    };
  }
}


/**
 * URL encoding tool
 * NEW: Pure logic implementation - metadata comes from module.json
 */
class UrlEncodeTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    const { data } = params;
    
    const encoded = encodeURIComponent(data);
    
    return {
      result: encoded,
      originalLength: data.length,
      encodedLength: encoded.length
    };
  }
}


/**
 * URL decoding tool
 * NEW: Pure logic implementation - metadata comes from module.json
 */
class UrlDecodeTool extends Tool {
  // NEW PATTERN: constructor(module, toolName)
  constructor(module, toolName) {
    super(module, toolName);
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    const { data } = params;
    
    const decoded = decodeURIComponent(data);
    
    return {
      result: decoded,
      originalLength: data.length,
      decodedLength: decoded.length
    };
  }
}

/**
 * EncodeModule - Provides encoding and decoding tools
 */
export default class EncodeModule extends Module {
  constructor() {
    super();
    this.name = 'encode';
    this.description = 'Encoding and decoding utilities for various formats';
    this.version = '1.0.0';
    
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './module.json';
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
    const module = new EncodeModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module - NEW metadata-driven approach
   */
  async initialize() {
    await super.initialize(); // This will load metadata automatically
    
    // NEW APPROACH: Create tools using metadata - NO FALLBACKS
    const tools = [
      { key: 'base64_encode', class: Base64EncodeTool },
      { key: 'base64_decode', class: Base64DecodeTool },
      { key: 'url_encode', class: UrlEncodeTool },
      { key: 'url_decode', class: UrlDecodeTool }
    ];

    for (const { key, class: ToolClass } of tools) {
      const tool = this.createToolFromMetadata(key, ToolClass);
      this.registerTool(tool.name, tool);
    }
  }
}


export { default as EncodeTool } from './index.js';
