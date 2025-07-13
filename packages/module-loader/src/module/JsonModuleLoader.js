import { promises as fs } from 'fs';
import path from 'path';
import { SchemaValidator } from '../schemas/SchemaValidator.js';

/**
 * JsonModuleLoader - Loads and validates module.json configuration files
 */
export class JsonModuleLoader {
  /**
   * @param {Object} options - Loader options
   * @param {boolean} options.cacheEnabled - Enable caching of loaded modules
   * @param {boolean} options.strict - Throw errors on validation failures
   */
  constructor(options = {}) {
    this.options = {
      cacheEnabled: true,
      strict: false,
      ...options
    };
    
    this.validator = new SchemaValidator();
    this.cache = new Map();
  }

  /**
   * Read and parse a module.json file
   * @param {string} jsonPath - Path to module.json file
   * @returns {Promise<Object>} Parsed module configuration
   */
  async readModuleJson(jsonPath) {
    try {
      // Check cache first
      if (this.options.cacheEnabled && this.cache.has(jsonPath)) {
        return this.cache.get(jsonPath);
      }

      // Read file
      const content = await fs.readFile(jsonPath, 'utf8');
      
      // Parse JSON
      let config;
      try {
        config = JSON.parse(content);
      } catch (parseError) {
        throw new Error(`Invalid JSON in module.json at ${jsonPath}: ${parseError.message}`);
      }

      // Cache if enabled
      if (this.options.cacheEnabled) {
        this.cache.set(jsonPath, config);
      }

      return config;
    } catch (error) {
      if (error.message.includes('Invalid JSON')) {
        throw error;
      }
      
      const enhancedError = new Error(`Failed to read module.json at ${jsonPath}: ${error.message}`);
      enhancedError.cause = error;
      throw enhancedError;
    }
  }

  /**
   * Validate a module configuration
   * @param {Object} config - Module configuration to validate
   * @returns {Promise<{valid: boolean, errors: string[]}>} Validation result
   */
  async validateConfiguration(config) {
    const result = this.validator.validateModuleConfig(config);
    
    // In strict mode, throw on validation errors
    if (this.options.strict && !result.valid) {
      const error = new Error(`Module configuration validation failed: ${result.errors.join(', ')}`);
      error.validationErrors = result.errors;
      throw error;
    }
    
    return result;
  }

  /**
   * Load and validate a module configuration
   * @param {string} jsonPath - Path to module.json file
   * @returns {Promise<Object>} Validated module configuration with metadata
   */
  async loadModuleConfig(jsonPath) {
    // Read the configuration
    const config = await this.readModuleJson(jsonPath);
    
    // Validate
    const validation = await this.validateConfiguration(config);
    
    if (!validation.valid && this.options.strict) {
      // validateConfiguration will throw in strict mode
      return;
    }
    
    // Add metadata
    config._metadata = {
      path: jsonPath,
      directory: path.dirname(jsonPath),
      loadedAt: new Date().toISOString(),
      valid: validation.valid,
      errors: validation.errors
    };
    
    return config;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Discover module.json files in a directory
   * @param {string} directory - Directory to search
   * @param {Object} options - Discovery options
   * @param {Function} options.filter - Filter function for paths
   * @param {number} options.maxDepth - Maximum directory depth
   * @returns {Promise<string[]>} Array of module.json paths
   */
  async discoverJsonModules(directory, options = {}) {
    const {
      filter = () => true,
      maxDepth = 3
    } = options;

    const discovered = [];

    try {
      await this._scanDirectory(directory, discovered, filter, 0, maxDepth);
    } catch (error) {
      // Silently handle errors - return what we found
      if (this.options.strict) {
        console.warn(`Error discovering modules in ${directory}: ${error.message}`);
      }
    }

    return discovered;
  }

  /**
   * Recursively scan directory for module.json files
   * @private
   */
  async _scanDirectory(dir, results, filter, depth, maxDepth) {
    if (depth > maxDepth) {
      return;
    }

    try {
      // Check if module.json exists in this directory
      const moduleJsonPath = path.join(dir, 'module.json');
      try {
        const stat = await fs.stat(moduleJsonPath);
        if (stat.isFile() && filter(moduleJsonPath)) {
          results.push(moduleJsonPath);
        }
      } catch (error) {
        // module.json doesn't exist in this directory
      }

      // Scan subdirectories
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subDir = path.join(dir, entry.name);
          await this._scanDirectory(subDir, results, filter, depth + 1, maxDepth);
        }
      }
    } catch (error) {
      // Ignore errors in individual directories
      if (error.code !== 'ENOENT' && error.code !== 'EACCES') {
        throw error;
      }
    }
  }
}

export default JsonModuleLoader;