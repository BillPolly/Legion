/**
 * ConfigManager - Handles configuration loading and merging from various sources
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class ConfigManager {
  constructor(searchPath = process.cwd()) {
    this.config = {};
    this.configSearchPath = searchPath;
  }

  /**
   * Load configuration from all sources
   * @param {object} cliOptions - Command line options
   * @returns {object} Merged configuration
   */
  async load(cliOptions = {}) {
    // Start with default configuration
    this.config = {
      verbose: false,
      output: 'text',
      color: true,
      modules: {}
    };

    // Load configurations in order of precedence (lowest to highest)
    // 1. Home directory config
    const homeConfigPath = this.getHomeConfigPath();
    if (homeConfigPath) {
      await this.loadConfigFile(homeConfigPath);
    }

    // 2. Project configs (search up from current directory)
    const searchPaths = await this.getConfigSearchPaths();
    for (const searchPath of searchPaths) {
      await this.loadConfigFromDirectory(searchPath);
    }

    // 3. Environment variables
    this.loadEnvironmentConfig();

    // 4. Command line options (highest priority)
    if (cliOptions) {
      this.config = this.deepMerge(this.config, cliOptions);
    }

    return this.config;
  }

  /**
   * Get path to home config file
   * @returns {string} Path to home config
   */
  getHomeConfigPath() {
    // Allow override for testing
    if (this.getHomeConfigPath.override) {
      return this.getHomeConfigPath.override.call(this);
    }
    return path.join(os.homedir(), '.jsenvoyrc');
  }

  /**
   * Get all config search paths
   * @returns {string[]} Array of paths to search
   */
  async getConfigSearchPaths() {
    const paths = [];
    let currentPath = this.configSearchPath;
    
    // Search up the directory tree
    while (currentPath !== path.dirname(currentPath)) {
      paths.push(currentPath);
      currentPath = path.dirname(currentPath);
    }
    
    return paths;
  }

  /**
   * Load config from a directory
   * @param {string} dirPath - Directory path
   * @returns {boolean} True if config was loaded
   */
  async loadConfigFromDirectory(dirPath) {
    // Load all config files in order of preference
    const configFiles = ['.jsenvoyrc', 'jsenvoy.json'];
    let loaded = false;
    
    for (const filename of configFiles) {
      const configPath = path.join(dirPath, filename);
      if (await this.loadConfigFile(configPath)) {
        loaded = true;
      }
    }
    
    return loaded;
  }

  /**
   * Load a specific config file
   * @param {string} configPath - Path to config file
   * @returns {boolean} True if successfully loaded
   */
  async loadConfigFile(configPath) {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(content);
      this.config = this.deepMerge(this.config, config);
      return true;
    } catch (error) {
      // File doesn't exist or invalid JSON - ignore
      return false;
    }
  }

  /**
   * Load configuration from environment variables
   */
  loadEnvironmentConfig() {
    const envConfig = {};
    
    // Parse boolean environment variables
    if (process.env.JSENVOY_VERBOSE) {
      envConfig.verbose = process.env.JSENVOY_VERBOSE === 'true';
    }
    
    if (process.env.JSENVOY_COLOR) {
      envConfig.color = process.env.JSENVOY_COLOR === 'true';
    }
    
    // Parse string environment variables
    if (process.env.JSENVOY_OUTPUT) {
      envConfig.output = process.env.JSENVOY_OUTPUT;
    }
    
    // TODO: Add more environment variables as needed
    
    this.config = this.deepMerge(this.config, envConfig);
  }

  /**
   * Deep merge two objects
   * @param {object} target - Target object
   * @param {object} source - Source object to merge
   * @returns {object} Merged object
   */
  deepMerge(target, source) {
    const output = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
          if (!output[key] || typeof output[key] !== 'object' || Array.isArray(output[key])) {
            output[key] = {};
          }
          output[key] = this.deepMerge(output[key], source[key]);
        } else {
          output[key] = source[key];
        }
      }
    }
    
    return output;
  }

  /**
   * Merge configurations
   * @param {object} base - Base configuration
   * @param {object} override - Override configuration
   * @returns {object} Merged configuration
   */
  mergeConfigurations(base, override) {
    const merged = { ...base };
    
    // Simple properties
    for (const key of ['verbose', 'output', 'color']) {
      if (override[key] !== undefined) {
        merged[key] = override[key];
      }
    }
    
    // Merge resources
    if (override.resources) {
      merged.resources = { ...base.resources, ...override.resources };
    }
    
    // Merge modules config
    if (override.modules) {
      merged.modules = { ...base.modules };
      for (const [moduleName, moduleConfig] of Object.entries(override.modules)) {
        merged.modules[moduleName] = {
          ...merged.modules[moduleName],
          ...moduleConfig
        };
      }
    }
    
    // Merge other properties
    for (const key of Object.keys(override)) {
      if (!['verbose', 'output', 'color', 'resources', 'modules'].includes(key)) {
        merged[key] = override[key];
      }
    }
    
    return merged;
  }

  /**
   * Get module-specific configuration
   * @param {string} moduleName - Module name
   * @returns {object} Module configuration
   */
  getModuleConfig(moduleName) {
    return this.config.modules?.[moduleName] || {};
  }

  /**
   * Apply a preset configuration
   * @param {string} presetName - Name of the preset
   * @param {object} options - Current options
   */
  applyPreset(presetName, options) {
    if (!this.config?.presets || !this.config.presets[presetName]) {
      throw new Error(`Unknown preset: ${presetName}`);
    }
    
    const preset = this.config.presets[presetName];
    
    // Apply preset options (but don't override CLI args)
    if (preset.verbose !== undefined && options.verbose === false) {
      options.verbose = preset.verbose;
    }
    if (preset.output && !options.output) {
      options.output = preset.output;
    }
    if (preset.color !== undefined && options.color === true) {
      options.color = preset.color;
    }
    
    // Apply preset resources
    if (preset.resources) {
      if (!this.config.resources) {
        this.config.resources = {};
      }
      Object.assign(this.config.resources, preset.resources);
    }
  }

  /**
   * Get the current configuration
   * @returns {object} Current configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Set the search path for configuration files
   * @param {string} path - New search path
   */
  setSearchPath(path) {
    this.configSearchPath = path;
  }
}

export default ConfigManager;