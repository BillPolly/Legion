/**
 * Configuration Management System
 * Handles loading, validation, and management of tool configurations
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { ToolRegistry, ModuleProvider } from './ToolRegistry.js';
import { FileSystemModuleDefinition } from '../modules/FileSystemModule.js';
import { HTTPModuleDefinition } from '../modules/HTTPModule.js';
import { GitModuleDefinition } from '../modules/GitModule.js';

/**
 * Configuration Manager
 * Manages configuration loading, validation, and environment integration
 */
export class ConfigurationManager {
  constructor(options = {}) {
    this.options = {
      envPrefix: options.envPrefix || 'TOOLS',
      defaults: options.defaults || this.getDefaultConfiguration(),
      validationRules: options.validationRules || {},
      ...options
    };
    
    this.watchers = new Map();
    this.changeListeners = [];
  }

  /**
   * Load configuration from file
   * @param {string} filePath - Path to configuration file
   * @returns {Promise<Object>} Loaded and processed configuration
   */
  async loadFromFile(filePath) {
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`Configuration file not found: ${filePath}`);
    }

    const content = await fs.readFile(filePath, 'utf8');
    const fileExt = path.extname(filePath).toLowerCase();
    
    let config;
    if (fileExt === '.json') {
      config = JSON.parse(content);
    } else if (fileExt === '.yaml' || fileExt === '.yml') {
      config = this.parseYaml(content);
    } else {
      throw new Error(`Unsupported configuration file format: ${fileExt}`);
    }

    // Apply defaults
    config = this.mergeWithDefaults(config);
    
    // Apply environment variable overrides
    config = this.applyEnvironmentOverrides(config);
    
    // Validate configuration
    this.validateConfiguration(config);
    
    return config;
  }

  /**
   * Create ToolRegistry from configuration
   * @param {Object} config - Configuration object
   * @returns {Promise<ToolRegistry>} Configured tool registry
   */
  async createRegistry(config) {
    const registry = new ToolRegistry();
    
    // Register modules from configuration
    for (const [moduleName, moduleConfig] of Object.entries(config.modules || {})) {
      const definition = this.getModuleDefinition(moduleName);
      if (!definition) {
        throw new Error(`Unknown module type: ${moduleName}`);
      }
      
      const provider = new ModuleProvider({
        name: moduleName,
        definition,
        config: moduleConfig,
        lazy: config.registry?.lazy !== false
      });
      
      await registry.registerProvider(provider);
    }
    
    return registry;
  }

  /**
   * Watch configuration file for changes
   * @param {string} filePath - Path to configuration file
   * @param {Object} options - Watch options
   */
  watchConfiguration(filePath, options = {}) {
    const { debounceMs = 250 } = options;
    
    if (this.watchers.has(filePath)) {
      return; // Already watching this file
    }

    let debounceTimer;
    
    const watchCallback = async (eventType, filename) => {
      if (eventType !== 'change') return;
      
      // Clear existing debounce timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      // Set new debounce timer
      debounceTimer = setTimeout(async () => {
        try {
          const newConfig = await this.loadFromFile(filePath);
          this.notifyConfigChange(newConfig);
        } catch (error) {
          console.error('Error reloading configuration:', error.message);
        }
      }, debounceMs);
    };

    try {
      const watcher = fsSync.watch(filePath, watchCallback);
      this.watchers.set(filePath, watcher);
    } catch (error) {
      console.warn('File watching not available in this environment');
    }
  }

  /**
   * Stop watching configuration files
   */
  stopWatching() {
    for (const [filePath, watcher] of this.watchers) {
      try {
        watcher.close();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    this.watchers.clear();
  }

  /**
   * Register configuration change listener
   * @param {Function} listener - Change listener function
   */
  onConfigChange(listener) {
    this.changeListeners.push(listener);
  }

  /**
   * Get default configuration
   * @returns {Object} Default configuration
   */
  getDefaultConfiguration() {
    return {
      modules: {
        filesystem: {
          allowWrite: false,
          maxFileSize: 10 * 1024 * 1024, // 10MB
          permissions: {
            read: true,
            write: false,
            delete: false
          }
        },
        http: {
          timeout: 5000,
          maxRetries: 3,
          followRedirects: true,
          maxContentLength: 5 * 1024 * 1024 // 5MB
        },
        git: {
          defaultBranch: 'main',
          autoFetch: false,
          requireCleanWorkingDirectory: true
        }
      },
      registry: {
        lazy: true,
        cacheMetadata: true,
        enableStatistics: true
      }
    };
  }

  /**
   * Get module definition by name
   * @param {string} moduleName - Module name
   * @returns {Object} Module definition class
   */
  getModuleDefinition(moduleName) {
    const definitions = {
      filesystem: FileSystemModuleDefinition,
      http: HTTPModuleDefinition,
      git: GitModuleDefinition
    };
    
    return definitions[moduleName];
  }

  /**
   * Merge configuration with defaults
   * @param {Object} config - User configuration
   * @returns {Object} Merged configuration
   */
  mergeWithDefaults(config) {
    return this.deepMerge(this.options.defaults, config);
  }

  /**
   * Apply environment variable overrides
   * @param {Object} config - Configuration to override
   * @returns {Object} Configuration with environment overrides
   */
  applyEnvironmentOverrides(config) {
    const envPrefix = this.options.envPrefix;
    const result = JSON.parse(JSON.stringify(config)); // Deep clone
    
    for (const [key, value] of Object.entries(process.env)) {
      if (!key.startsWith(`${envPrefix}_`)) continue;
      
      // Convert environment variable key to config path
      // Handle nested paths like TOOLS_FILESYSTEM_BASE_PATH -> modules.filesystem.basePath
      const envPath = key
        .slice(envPrefix.length + 1) // Remove prefix and underscore
        .toLowerCase()
        .split('_');
        
      // Map environment paths to config paths
      const configPath = this.mapEnvironmentPathToConfigPath(envPath);
      
      // Parse environment value
      const parsedValue = this.parseEnvironmentValue(value);
      
      // Set value in configuration
      this.setNestedValue(result, configPath, parsedValue);
    }
    
    return result;
  }

  /**
   * Map environment variable path to configuration path
   * @param {Array<string>} envPath - Environment variable path components
   * @returns {Array<string>} Configuration path
   */
  mapEnvironmentPathToConfigPath(envPath) {
    // Convert environment paths to config structure
    // e.g., ['filesystem', 'base', 'path'] -> ['modules', 'filesystem', 'basePath']
    if (envPath.length >= 2) {
      const moduleName = envPath[0];
      const fieldParts = envPath.slice(1);
      
      // Convert snake_case to camelCase for field names
      const fieldName = fieldParts.map((part, index) => {
        if (index === 0) return part;
        // Special case for common abbreviations
        if (part.toLowerCase() === 'url') return 'URL';
        if (part.toLowerCase() === 'id') return 'ID';
        if (part.toLowerCase() === 'api') return 'API';
        return part.charAt(0).toUpperCase() + part.slice(1);
      }).join('');
      
      return ['modules', moduleName, fieldName];
    }
    
    return envPath;
  }

  /**
   * Parse environment variable value to appropriate type
   * @param {string} value - Environment variable value
   * @returns {any} Parsed value
   */
  parseEnvironmentValue(value) {
    // Handle boolean values
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Handle numeric values
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d*\.\d+$/.test(value)) return parseFloat(value);
    
    // Handle JSON arrays/objects
    if ((value.startsWith('[') && value.endsWith(']')) || 
        (value.startsWith('{') && value.endsWith('}'))) {
      try {
        return JSON.parse(value);
      } catch (error) {
        // If JSON parsing fails, return as string
      }
    }
    
    // Return as string
    return value;
  }

  /**
   * Set nested value in object using path array
   * @param {Object} obj - Object to modify
   * @param {Array<string>} path - Path array
   * @param {any} value - Value to set
   */
  setNestedValue(obj, path, value) {
    let current = obj;
    
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[path[path.length - 1]] = value;
  }

  /**
   * Validate configuration against schema
   * @param {Object} config - Configuration to validate
   */
  validateConfiguration(config) {
    try {
      // Validate required fields
      this.validateRequiredFields(config);
      
      // Validate field types
      this.validateFieldTypes(config);
      
      // Validate field constraints
      this.validateFieldConstraints(config);
      
      // Apply custom validation rules
      this.applyCustomValidationRules(config);
    } catch (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }
  }

  /**
   * Validate required fields
   * @param {Object} config - Configuration to validate
   */
  validateRequiredFields(config) {
    const requiredFields = [
      'modules.filesystem.basePath'
    ];
    
    for (const fieldPath of requiredFields) {
      const value = this.getNestedValue(config, fieldPath.split('.'));
      if (value === undefined || value === null) {
        throw new Error(`Required field missing: ${fieldPath}`);
      }
    }
  }

  /**
   * Validate field types
   * @param {Object} config - Configuration to validate
   */
  validateFieldTypes(config) {
    const typeValidations = {
      'modules.filesystem.allowWrite': 'boolean',
      'modules.filesystem.maxFileSize': 'number',
      'modules.http.timeout': 'number',
      'modules.http.maxRetries': 'number',
      'registry.lazy': 'boolean',
      'registry.cacheMetadata': 'boolean'
    };
    
    for (const [fieldPath, expectedType] of Object.entries(typeValidations)) {
      const value = this.getNestedValue(config, fieldPath.split('.'));
      if (value !== undefined && typeof value !== expectedType) {
        throw new Error(`Invalid type for field: ${fieldPath}. Expected ${expectedType}, got ${typeof value}`);
      }
    }
  }

  /**
   * Validate field constraints
   * @param {Object} config - Configuration to validate
   */
  validateFieldConstraints(config) {
    const constraints = {
      'modules.filesystem.maxFileSize': (value) => {
        if (value !== undefined && value <= 0) {
          throw new Error('Invalid value for field: modules.filesystem.maxFileSize must be positive');
        }
      },
      'modules.http.timeout': (value) => {
        if (value !== undefined && value <= 0) {
          throw new Error('Invalid value for field: modules.http.timeout must be positive');
        }
      },
      'modules.http.baseURL': (value) => {
        if (value !== undefined) {
          try {
            new URL(value);
          } catch (error) {
            throw new Error('Invalid value for field: modules.http.baseURL must be a valid URL');
          }
        }
      }
    };
    
    for (const [fieldPath, validator] of Object.entries(constraints)) {
      const value = this.getNestedValue(config, fieldPath.split('.'));
      validator(value);
    }
  }

  /**
   * Apply custom validation rules
   * @param {Object} config - Configuration to validate
   */
  applyCustomValidationRules(config) {
    for (const [fieldPath, validator] of Object.entries(this.options.validationRules)) {
      const value = this.getNestedValue(config, fieldPath.split('.'));
      if (value !== undefined) {
        validator(value);
      }
    }
  }

  /**
   * Get nested value from object using path array
   * @param {Object} obj - Object to read from
   * @param {Array<string>} path - Path array
   * @returns {any} Nested value or undefined
   */
  getNestedValue(obj, path) {
    let current = obj;
    
    for (const key of path) {
      if (current === null || current === undefined || !(key in current)) {
        return undefined;
      }
      current = current[key];
    }
    
    return current;
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.deepMerge(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Parse YAML content (simple implementation)
   * @param {string} content - YAML content
   * @returns {Object} Parsed object
   */
  parseYaml(content) {
    // Simple YAML parser for basic structures
    // In production, would use a proper YAML library like 'yaml'
    const lines = content.split('\n');
    const result = {};
    const stack = [{ obj: result, indent: -1 }];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const indent = line.length - line.trimStart().length;
      const colonIndex = trimmed.indexOf(':');
      
      if (colonIndex === -1) continue;
      
      const key = trimmed.slice(0, colonIndex).trim();
      const valueStr = trimmed.slice(colonIndex + 1).trim();
      
      // Pop stack items with higher or equal indentation
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      
      const parent = stack[stack.length - 1].obj;
      
      if (valueStr === '') {
        // Object/array start
        parent[key] = {};
        stack.push({ obj: parent[key], indent });
      } else {
        // Value
        parent[key] = this.parseYamlValue(valueStr);
      }
    }
    
    return result;
  }

  /**
   * Parse YAML value to appropriate type
   * @param {string} value - YAML value string
   * @returns {any} Parsed value
   */
  parseYamlValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d*\.\d+$/.test(value)) return parseFloat(value);
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    return value;
  }

  /**
   * Notify configuration change listeners
   * @param {Object} newConfig - New configuration
   */
  notifyConfigChange(newConfig) {
    for (const listener of this.changeListeners) {
      try {
        listener(newConfig);
      } catch (error) {
        console.error('Error in configuration change listener:', error);
      }
    }
  }
}