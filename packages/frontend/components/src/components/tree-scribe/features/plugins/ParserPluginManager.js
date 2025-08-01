/**
 * ParserPluginManager - Manages dynamic parser plugins for TreeScribe
 * Provides secure plugin loading, validation, and execution
 */

import { BaseParser } from '../parsing/BaseParser.js';
import { ErrorHandler, ParseError } from '../parsing/ErrorHandler.js';
import { PerformanceMonitor } from '../parsing/PerformanceMonitor.js';

export class PluginError extends Error {
  constructor(message, plugin, details = {}) {
    super(message);
    this.name = 'PluginError';
    this.plugin = plugin;
    this.details = details;
  }
}

export class ParserPluginManager {
  constructor(options = {}) {
    this.plugins = new Map();
    this.registry = options.registry || null;
    this.sandbox = options.sandbox !== false;
    this.maxPlugins = options.maxPlugins || 50;
    this.errorHandler = new ErrorHandler({ continueOnError: true });
    this.performanceMonitor = new PerformanceMonitor({ enabled: true });
    
    // Security settings
    this.security = {
      allowedGlobals: options.allowedGlobals || [
        'console', 'Object', 'Array', 'String', 'Number', 'Boolean',
        'Date', 'RegExp', 'Map', 'Set', 'JSON', 'Math', 'Promise'
      ],
      maxParseTime: options.maxParseTime || 5000, // 5 seconds
      maxMemory: options.maxMemory || 50 * 1024 * 1024, // 50MB
      maxNodeCount: options.maxNodeCount || 50000,
      maxDepth: options.maxDepth || 100
    };
    
    // Resource limits
    this.limits = {
      parseTime: this.security.maxParseTime,
      memory: this.security.maxMemory,
      nodes: this.security.maxNodeCount,
      depth: this.security.maxDepth
    };
  }

  /**
   * Register a plugin
   * @param {string} format - Format identifier
   * @param {Object} pluginModule - Plugin module
   * @returns {Promise<void>}
   */
  async register(format, pluginModule) {
    try {
      // Check plugin limit
      if (this.plugins.size >= this.maxPlugins) {
        throw new PluginError('Maximum number of plugins reached', format);
      }
      
      // Validate plugin structure
      this._validatePlugin(pluginModule);
      
      // Create sandboxed parser instance
      const parser = await this._createSandboxedParser(pluginModule);
      
      // Validate parser implementation
      this._validateParserImplementation(parser);
      
      // Store plugin
      this.plugins.set(format, {
        module: pluginModule,
        parser: parser,
        metadata: pluginModule.metadata,
        loaded: new Date(),
        metrics: {
          uses: 0,
          totalParseTime: 0,
          errors: 0
        }
      });
      
      console.log(`[PluginManager] Registered plugin: ${format} (${pluginModule.metadata.name})`);
      
    } catch (error) {
      this.errorHandler.handleError(error, {
        parser: 'PluginManager',
        format: format,
        operation: 'register'
      });
      throw error;
    }
  }

  /**
   * Unregister a plugin
   * @param {string} format - Format identifier
   */
  unregister(format) {
    if (this.plugins.has(format)) {
      const plugin = this.plugins.get(format);
      
      // Cleanup if needed
      if (plugin.parser.cleanup) {
        plugin.parser.cleanup();
      }
      
      this.plugins.delete(format);
      console.log(`[PluginManager] Unregistered plugin: ${format}`);
    }
  }

  /**
   * Get a parser for format
   * @param {string} format - Format identifier
   * @returns {BaseParser|null}
   */
  getParser(format) {
    const plugin = this.plugins.get(format);
    return plugin ? plugin.parser : null;
  }

  /**
   * Get all registered formats
   * @returns {string[]}
   */
  getFormats() {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get plugin metadata
   * @param {string} format - Format identifier
   * @returns {Object|null}
   */
  getMetadata(format) {
    const plugin = this.plugins.get(format);
    return plugin ? plugin.metadata : null;
  }

  /**
   * Execute parser with monitoring
   * @param {string} format - Format identifier
   * @param {string} content - Content to parse
   * @param {Object} options - Parse options
   * @returns {Promise<Object>} Parse result
   */
  async parse(format, content, options = {}) {
    const plugin = this.plugins.get(format);
    if (!plugin) {
      throw new PluginError(`No plugin registered for format: ${format}`, format);
    }
    
    // Update metrics
    plugin.metrics.uses++;
    
    // Monitor performance
    const timer = this.performanceMonitor.startTimer(`plugin-${format}`);
    
    try {
      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new PluginError('Parse timeout exceeded', format)), this.limits.parseTime);
      });
      
      // Parse with monitoring
      const parsePromise = this._executeInSandbox(plugin.parser, 'parse', [content, options]);
      
      // Race between parse and timeout
      const result = await Promise.race([parsePromise, timeoutPromise]);
      
      // Validate result
      this._validateParseResult(result, format);
      
      // Stop timer and update metrics
      const metrics = timer.stop();
      plugin.metrics.totalParseTime += metrics.duration;
      
      // Check resource usage
      if (metrics.memoryDelta > this.limits.memory) {
        this.errorHandler.addWarning('High memory usage', {
          format,
          memory: metrics.memoryDelta
        });
      }
      
      return result;
      
    } catch (error) {
      plugin.metrics.errors++;
      timer.stop();
      
      // Wrap in PluginError
      if (!(error instanceof PluginError)) {
        error = new PluginError(error.message, format, { originalError: error });
      }
      
      throw error;
    }
  }

  /**
   * Get plugin statistics
   * @returns {Object} Plugin statistics
   */
  getStatistics() {
    const stats = {
      totalPlugins: this.plugins.size,
      plugins: {}
    };
    
    for (const [format, plugin] of this.plugins) {
      stats.plugins[format] = {
        name: plugin.metadata.name,
        version: plugin.metadata.version,
        loaded: plugin.loaded,
        metrics: plugin.metrics,
        averageParseTime: plugin.metrics.uses > 0 
          ? plugin.metrics.totalParseTime / plugin.metrics.uses 
          : 0
      };
    }
    
    return stats;
  }

  /**
   * Load plugin from URL (development only)
   * @param {string} url - Plugin URL
   * @returns {Promise<Object>} Plugin module
   */
  async loadFromUrl(url) {
    if (!url.startsWith('http://localhost')) {
      throw new PluginError('Remote plugins only allowed from localhost', url);
    }
    
    try {
      const response = await fetch(url);
      const code = await response.text();
      
      // Basic security check
      if (code.includes('eval') || code.includes('Function(')) {
        throw new PluginError('Plugin contains forbidden code', url);
      }
      
      // Create module from code (simplified for demo)
      // In production, use proper sandboxing
      const module = { exports: {} };
      const func = new Function('module', 'exports', 'BaseParser', code);
      func(module, module.exports, BaseParser);
      
      return module.exports.default || module.exports;
      
    } catch (error) {
      throw new PluginError(`Failed to load plugin from URL: ${error.message}`, url);
    }
  }

  /**
   * Validate plugin structure
   * @private
   */
  _validatePlugin(plugin) {
    if (!plugin || typeof plugin !== 'object') {
      throw new PluginError('Plugin must be an object');
    }
    
    // Check metadata
    if (!plugin.metadata || typeof plugin.metadata !== 'object') {
      throw new PluginError('Plugin must have metadata object');
    }
    
    const requiredMeta = ['name', 'version', 'author', 'description'];
    for (const field of requiredMeta) {
      if (!plugin.metadata[field]) {
        throw new PluginError(`Plugin metadata missing required field: ${field}`);
      }
    }
    
    // Check parser
    if (!plugin.Parser || typeof plugin.Parser !== 'function') {
      throw new PluginError('Plugin must export a Parser class');
    }
  }

  /**
   * Create sandboxed parser instance
   * @private
   */
  async _createSandboxedParser(pluginModule) {
    const ParserClass = pluginModule.Parser;
    
    if (!this.sandbox) {
      // No sandboxing - direct instantiation
      return new ParserClass();
    }
    
    // Create sandboxed context
    const sandbox = this._createSandbox();
    
    // Create parser in sandbox
    try {
      // Simplified sandboxing for demo
      // In production, use VM or Worker
      const parser = new ParserClass();
      
      // Wrap methods to enforce limits
      const wrappedParser = this._wrapParser(parser);
      
      return wrappedParser;
      
    } catch (error) {
      throw new PluginError(`Failed to create parser: ${error.message}`, pluginModule.metadata.name);
    }
  }

  /**
   * Create sandbox environment
   * @private
   */
  _createSandbox() {
    const sandbox = {};
    
    // Add allowed globals
    for (const global of this.security.allowedGlobals) {
      if (typeof window !== 'undefined' && window[global]) {
        sandbox[global] = window[global];
      } else if (typeof global !== 'undefined' && global[global]) {
        sandbox[global] = global[global];
      }
    }
    
    // Add safe console
    sandbox.console = {
      log: (...args) => console.log('[Plugin]', ...args),
      warn: (...args) => console.warn('[Plugin]', ...args),
      error: (...args) => console.error('[Plugin]', ...args)
    };
    
    return sandbox;
  }

  /**
   * Wrap parser methods with security checks
   * @private
   */
  _wrapParser(parser) {
    const wrapped = Object.create(parser);
    const monitor = this.performanceMonitor;
    const limits = this.limits;
    
    // Wrap parse method
    const originalParse = parser.parse.bind(parser);
    wrapped.parse = function(content, options) {
      // Check content size
      if (content.length > 10 * 1024 * 1024) { // 10MB
        throw new PluginError('Content too large', parser.getName());
      }
      
      // Track nodes created
      let nodeCount = 0;
      const countNodes = (node) => {
        nodeCount++;
        if (nodeCount > limits.nodes) {
          throw new PluginError('Node count limit exceeded', parser.getName());
        }
        if (node.children) {
          node.children.forEach(countNodes);
        }
      };
      
      // Execute parse
      const result = originalParse(content, options);
      
      // Count nodes
      countNodes(result);
      
      return result;
    };
    
    // Wrap other methods similarly
    const methods = ['canParse', 'validate', 'getName', 'getSupportedFormats'];
    for (const method of methods) {
      if (typeof parser[method] === 'function') {
        wrapped[method] = parser[method].bind(parser);
      }
    }
    
    return wrapped;
  }

  /**
   * Execute method in sandbox
   * @private
   */
  async _executeInSandbox(parser, method, args) {
    // In production, this would use VM or Worker
    // For now, direct execution with monitoring
    return parser[method](...args);
  }

  /**
   * Validate parser implementation
   * @private
   */
  _validateParserImplementation(parser) {
    const requiredMethods = ['getName', 'getSupportedFormats', 'canParse', 'parse', 'validate'];
    
    for (const method of requiredMethods) {
      if (typeof parser[method] !== 'function') {
        throw new PluginError(`Parser missing required method: ${method}`, parser.getName ? parser.getName() : 'Unknown');
      }
    }
    
    // Test basic functionality
    try {
      const name = parser.getName();
      if (!name || typeof name !== 'string') {
        throw new PluginError('getName() must return a string');
      }
      
      const formats = parser.getSupportedFormats();
      if (!Array.isArray(formats) || formats.length === 0) {
        throw new PluginError('getSupportedFormats() must return non-empty array');
      }
      
    } catch (error) {
      throw new PluginError(`Parser validation failed: ${error.message}`);
    }
  }

  /**
   * Validate parse result
   * @private
   */
  _validateParseResult(result, format) {
    if (!result || typeof result !== 'object') {
      throw new PluginError('Parse result must be an object', format);
    }
    
    if (!result.title || typeof result.title !== 'string') {
      throw new PluginError('Parse result must have a title', format);
    }
    
    if (!Array.isArray(result.children)) {
      throw new PluginError('Parse result must have children array', format);
    }
    
    // Check depth
    const checkDepth = (node, depth = 0) => {
      if (depth > this.limits.depth) {
        throw new PluginError('Maximum depth exceeded', format);
      }
      if (node.children) {
        node.children.forEach(child => checkDepth(child, depth + 1));
      }
    };
    
    checkDepth(result);
  }
}