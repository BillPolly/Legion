/**
 * PlanToolRegistry - Plan-specific tool registry that wraps Legion ModuleLoader
 * 
 * This class provides a plan-specific interface for loading modules and tools
 * while using the general-purpose Legion ModuleLoader internally. It handles
 * plan analysis, module loading, and tool validation for plan execution.
 */

import { ModuleLoader } from '@legion/module-loader';
import { PlanModuleAnalyzer } from './PlanModuleAnalyzer.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PlanToolRegistry {
  /**
   * Create a new PlanToolRegistry
   * @param {Object} options - Configuration options
   * @param {ModuleLoader} options.moduleLoader - Legion ModuleLoader instance (optional)
   * @param {PlanModuleAnalyzer} options.planAnalyzer - Plan analyzer instance (optional)
   */
  constructor(options = {}) {
    // If resourceManager is provided, use it to create ModuleLoader
    if (options.resourceManager) {
      this.moduleLoader = options.moduleLoader || new ModuleLoader(options.resourceManager);
    } else {
      this.moduleLoader = options.moduleLoader || new ModuleLoader();
    }
    this.planAnalyzer = options.planAnalyzer || new PlanModuleAnalyzer();
    this.isInitialized = false;
    this.moduleRegistry = null;
  }

  /**
   * Initialize the tool registry (initializes the underlying module loader)
   */
  async initialize() {
    if (!this.isInitialized) {
      await this.moduleLoader.initialize();
      await this._loadModuleRegistry();
      this.isInitialized = true;
    }
  }

  /**
   * Load all modules required for a plan
   * @param {Object} plan - The plan to load modules for
   * @throws {Error} If required tools are not available after loading
   */
  async loadModulesForPlan(plan) {
    await this.initialize();
    
    // Analyze the plan to determine requirements
    const analysis = this.planAnalyzer.analyzePlan(plan);
    
    // Load essential modules first
    await this._loadEssentialModules();
    
    // Load explicitly required modules from plan metadata
    if (analysis.requiredModules.length > 0) {
      for (const moduleName of analysis.requiredModules) {
        await this._loadModuleByName(moduleName);
      }
    }
    
    // Verify all required tools are available
    const availableTools = this.moduleLoader.getToolNames();
    const missingTools = this.planAnalyzer.findMissingTools(analysis.requiredTools, availableTools);
    
    if (missingTools.length > 0) {
      throw new Error(`Required tools not found: ${missingTools.join(', ')}`);
    }
  }

  /**
   * Get a tool by name
   * @param {string} toolName - Name of the tool to get
   * @returns {Object} Tool instance
   * @throws {Error} If tool is not found
   */
  getTool(toolName) {
    const tool = this.moduleLoader.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    return tool;
  }

  /**
   * Check if a tool is available
   * @param {string} toolName - Name of the tool to check
   * @returns {boolean} True if tool is available
   */
  hasTool(toolName) {
    return this.moduleLoader.hasTool(toolName);
  }

  /**
   * Get all available tool names
   * @returns {Array<string>} Array of tool names
   */
  getAvailableToolNames() {
    return this.moduleLoader.getToolNames();
  }

  /**
   * Get all loaded tools
   * @returns {Promise<Array>} Array of all tool instances
   */
  async getAllTools() {
    return await this.moduleLoader.getAllTools();
  }
  
  /**
   * Get all available modules from the registry
   * @returns {Array<string>} Array of module names
   */
  getAvailableModules() {
    if (!this.moduleRegistry) {
      return [];
    }
    return Object.keys(this.moduleRegistry.modules);
  }
  
  /**
   * Load a specific module by name
   * @param {string} moduleName - Name of the module to load
   * @returns {Promise<Object>} The loaded module
   */
  async loadModule(moduleName) {
    await this.initialize();
    await this._loadModuleByName(moduleName);
    return this.moduleLoader.getModule(moduleName);
  }

  /**
   * Clear all loaded modules and tools
   */
  clear() {
    this.moduleLoader.clear();
    this.isInitialized = false;
  }

  /**
   * Load essential modules required for plan execution
   * @private
   */
  async _loadEssentialModules() {
    const essentialModules = this.planAnalyzer.getEssentialModules();
    
    for (const moduleName of essentialModules) {
      try {
        await this._loadModuleByName(moduleName);
      } catch (error) {
        // Log warning but don't fail - some essential modules might not be available
        console.warn(`Failed to load essential module '${moduleName}': ${error.message}`);
      }
    }
  }

  /**
   * Load the module registry from ModuleRegistry.json
   * @private
   */
  async _loadModuleRegistry() {
    try {
      const projectRoot = this.moduleLoader.resourceManager.findProjectRoot();
      if (!projectRoot) {
        throw new Error('Project root not found');
      }
      
      const registryPath = path.join(projectRoot, 'packages', 'module-loader', 'src', 'ModuleRegistry.json');
      const registryContent = await fs.readFile(registryPath, 'utf8');
      this.moduleRegistry = JSON.parse(registryContent);
    } catch (error) {
      console.warn(`Failed to load module registry: ${error.message}`);
      this.moduleRegistry = { modules: {} };
    }
  }

  /**
   * Load a module by name using the module registry
   * @private
   * @param {string} moduleName - Name of the module to load
   */
  async _loadModuleByName(moduleName) {
    try {
      if (!this.moduleRegistry || !this.moduleRegistry.modules[moduleName]) {
        throw new Error(`Module '${moduleName}' not found in registry`);
      }

      const moduleInfo = this.moduleRegistry.modules[moduleName];
      const projectRoot = this.moduleLoader.resourceManager.findProjectRoot();
      if (!projectRoot) {
        throw new Error('Project root not found');
      }
      
      const modulePath = path.join(projectRoot, moduleInfo.path);

      if (moduleInfo.type === 'json') {
        // Load from module.json
        await this.moduleLoader.loadModuleFromJson(modulePath);
      } else if (moduleInfo.type === 'class') {
        // Load from JavaScript module
        const { [moduleInfo.className]: ModuleClass } = await import(`file://${modulePath}`);
        await this.moduleLoader.loadModuleByName(moduleName, ModuleClass);
      } else {
        throw new Error(`Unknown module type '${moduleInfo.type}' for module '${moduleName}'`);
      }
    } catch (error) {
      throw new Error(`Failed to load module '${moduleName}': ${error.message}`);
    }
  }
}