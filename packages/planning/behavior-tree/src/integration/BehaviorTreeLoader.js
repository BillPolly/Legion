/**
 * BehaviorTreeLoader - Loads BT configurations from files and registers them as tools
 * 
 * Features:
 * - Load individual BT JSON files
 * - Load entire directories of BT configurations
 * - Validate configurations before loading
 * - Register BTs as tools in ToolRegistry
 * - Support for configuration templates and inheritance
 */

import fs from 'fs/promises';
import path from 'path';
import { BehaviorTreeTool } from './BehaviorTreeTool.js';

export class BehaviorTreeLoader {
  constructor(toolRegistry) {
    this.toolRegistry = toolRegistry;
    this.loadedConfigs = new Map();
    this.templates = new Map();
  }

  /**
   * Load a single BT configuration file
   * @param {string} configPath - Path to JSON configuration file
   * @param {Object} options - Loading options
   * @returns {Promise<BehaviorTreeTool>} Loaded BT tool
   */
  async loadBehaviorTreeConfig(configPath, options = {}) {
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      // Apply template inheritance if specified
      if (config.extends) {
        config = await this.applyTemplate(config);
      }
      
      // Validate configuration
      const validation = this.validateBTConfig(config);
      if (!validation.valid) {
        throw new Error(`Invalid BT configuration in ${configPath}: ${validation.errors.join(', ')}`);
      }

      // Create BT tool
      const btTool = new BehaviorTreeTool(config, this.toolRegistry);
      
      // Cache the configuration
      this.loadedConfigs.set(config.name, {
        config,
        tool: btTool,
        filePath: configPath,
        loadedAt: Date.now()
      });

      if (options.debugMode) {
        console.log(`[BehaviorTreeLoader] Loaded BT: ${config.name} from ${configPath}`);
      }

      return btTool;
    } catch (error) {
      throw new Error(`Failed to load BT configuration from ${configPath}: ${error.message}`);
    }
  }

  /**
   * Load all BT configurations from a directory
   * @param {string} directoryPath - Directory containing JSON files
   * @param {Object} options - Loading options
   * @returns {Promise<Array<BehaviorTreeTool>>} Array of loaded BT tools
   */
  async loadBehaviorTreeDirectory(directoryPath, options = {}) {
    const tools = [];

    try {
      const files = await fs.readdir(directoryPath);
      const configFiles = files.filter(f => f.endsWith('.json'));

      // Load templates first if they exist
      const templateFiles = configFiles.filter(f => f.includes('template'));
      for (const templateFile of templateFiles) {
        await this.loadTemplate(path.join(directoryPath, templateFile));
      }

      // Load regular configurations
      const regularFiles = configFiles.filter(f => !f.includes('template'));
      for (const configFile of regularFiles) {
        try {
          const tool = await this.loadBehaviorTreeConfig(
            path.join(directoryPath, configFile), 
            options
          );
          tools.push(tool);
        } catch (error) {
          if (options.continueOnError) {
            console.warn(`[BehaviorTreeLoader] Failed to load ${configFile}:`, error.message);
          } else {
            throw error;
          }
        }
      }

      if (options.debugMode) {
        console.log(`[BehaviorTreeLoader] Loaded ${tools.length} BT configurations from ${directoryPath}`);
      }

      return tools;
    } catch (error) {
      throw new Error(`Failed to load BT directory ${directoryPath}: ${error.message}`);
    }
  }

  /**
   * Register BT tool with ToolRegistry
   * @param {BehaviorTreeTool} btTool - BT tool to register
   * @returns {Promise<void>}
   */
  async registerBehaviorTreeTool(btTool) {
    try {
      // Register the BT tool directly with the registry
      // TODO: This should use proper ModuleProvider when available from tool-architecture
      if (this.toolRegistry && this.toolRegistry.registerTool) {
        this.toolRegistry.registerTool(btTool.config.name, btTool);
      }
    } catch (error) {
      throw new Error(`Failed to register BT tool ${btTool.config.name}: ${error.message}`);
    }
  }

  /**
   * Load and register all BTs from a directory
   * @param {string} directoryPath - Directory path
   * @param {Object} options - Options
   * @returns {Promise<Array<BehaviorTreeTool>>} Loaded and registered tools
   */
  async loadAndRegisterDirectory(directoryPath, options = {}) {
    const tools = await this.loadBehaviorTreeDirectory(directoryPath, options);
    
    for (const tool of tools) {
      await this.registerBehaviorTreeTool(tool);
    }

    return tools;
  }

  /**
   * Load a configuration template
   * @param {string} templatePath - Path to template file
   * @returns {Promise<void>}
   */
  async loadTemplate(templatePath) {
    try {
      const templateData = await fs.readFile(templatePath, 'utf-8');
      const template = JSON.parse(templateData);
      
      if (!template.templateName) {
        throw new Error('Template must specify templateName');
      }

      this.templates.set(template.templateName, template);
    } catch (error) {
      throw new Error(`Failed to load template from ${templatePath}: ${error.message}`);
    }
  }

  /**
   * Apply template inheritance to configuration
   * @param {Object} config - Configuration that extends a template
   * @returns {Promise<Object>} Merged configuration
   */
  async applyTemplate(config) {
    if (!config.extends) return config;

    const templateName = config.extends;
    const template = this.templates.get(templateName);
    
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Deep merge template and config (config overrides template)
    const merged = this.deepMerge(template, config);
    
    // Remove template-specific fields
    delete merged.templateName;
    delete merged.extends;

    return merged;
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object (template)
   * @param {Object} source - Source object (config)
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.deepMerge(target[key] || {}, value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Validate BT configuration
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validateBTConfig(config) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!config.name) {
      errors.push('Configuration must specify name');
    }

    if (!config.implementation) {
      errors.push('Configuration must specify implementation');
    } else {
      if (!config.implementation.type) {
        errors.push('Implementation must specify root node type');
      }
    }

    // Validate input schema
    if (config.input) {
      for (const [inputName, inputSpec] of Object.entries(config.input)) {
        if (!inputSpec.type && !inputSpec.default) {
          warnings.push(`Input ${inputName} should specify type or default value`);
        }
      }
    }

    // Validate output schema
    if (config.output) {
      for (const [outputName, outputSpec] of Object.entries(config.output)) {
        if (!outputSpec.type) {
          warnings.push(`Output ${outputName} should specify type`);
        }
      }
    }

    // Validate implementation tree
    if (config.implementation) {
      const treeValidation = this.validateBTTree(config.implementation);
      errors.push(...treeValidation.errors);
      warnings.push(...treeValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate BT tree structure recursively
   * @param {Object} node - BT node configuration
   * @returns {Object} Validation result
   */
  validateBTTree(node) {
    const errors = [];
    const warnings = [];

    if (!node.type) {
      errors.push('BT node must specify type');
      return { errors, warnings };
    }

    // Validate based on node type
    switch (node.type) {
      case 'action':
        if (!node.tool) {
          errors.push('Action nodes must specify tool');
        }
        break;

      case 'sequence':
      case 'selector':
      case 'parallel':
        if (!node.children || !Array.isArray(node.children)) {
          errors.push(`${node.type} nodes must have children array`);
        } else if (node.children.length === 0) {
          warnings.push(`${node.type} node has no children`);
        }
        break;

      case 'retry':
        if (!node.maxAttempts || node.maxAttempts < 1) {
          errors.push('Retry nodes must specify maxAttempts > 0');
        }
        if (!node.child) {
          errors.push('Retry nodes must specify child');
        }
        break;
    }

    // Recursively validate children
    if (node.children) {
      for (const child of node.children) {
        const childValidation = this.validateBTTree(child);
        errors.push(...childValidation.errors);
        warnings.push(...childValidation.warnings);
      }
    }

    // Validate single child
    if (node.child) {
      const childValidation = this.validateBTTree(node.child);
      errors.push(...childValidation.errors);
      warnings.push(...childValidation.warnings);
    }

    return { errors, warnings };
  }

  /**
   * Get loaded configuration by name
   * @param {string} name - Configuration name
   * @returns {Object|null} Configuration info or null
   */
  getLoadedConfig(name) {
    return this.loadedConfigs.get(name) || null;
  }

  /**
   * List all loaded configurations
   * @returns {Array<Object>} Array of loaded config info
   */
  listLoadedConfigs() {
    return Array.from(this.loadedConfigs.values());
  }

  /**
   * Reload a configuration file
   * @param {string} name - Configuration name to reload
   * @returns {Promise<BehaviorTreeTool>} Reloaded tool
   */
  async reloadConfig(name) {
    const existing = this.loadedConfigs.get(name);
    if (!existing) {
      throw new Error(`Configuration ${name} not found`);
    }

    return await this.loadBehaviorTreeConfig(existing.filePath);
  }

  /**
   * Clear all loaded configurations
   */
  clear() {
    this.loadedConfigs.clear();
    this.templates.clear();
  }
}