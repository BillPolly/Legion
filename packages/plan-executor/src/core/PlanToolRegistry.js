/**
 * PlanToolRegistry - Plan-specific tool registry that wraps Legion ModuleLoader
 * 
 * This class provides a plan-specific interface for loading modules and tools
 * while using the general-purpose Legion ModuleLoader internally. It handles
 * plan analysis, module loading, and tool validation for plan execution.
 */

import { ModuleLoader } from '@legion/module-loader';
import { PlanModuleAnalyzer } from './PlanModuleAnalyzer.js';

export class PlanToolRegistry {
  /**
   * Create a new PlanToolRegistry
   * @param {Object} options - Configuration options
   * @param {ModuleLoader} options.moduleLoader - Legion ModuleLoader instance (optional)
   * @param {PlanModuleAnalyzer} options.planAnalyzer - Plan analyzer instance (optional)
   */
  constructor(options = {}) {
    this.moduleLoader = options.moduleLoader || new ModuleLoader();
    this.planAnalyzer = options.planAnalyzer || new PlanModuleAnalyzer();
    this.isInitialized = false;
  }

  /**
   * Initialize the tool registry (initializes the underlying module loader)
   */
  async initialize() {
    if (!this.isInitialized) {
      await this.moduleLoader.initialize();
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
   * Load a module by name
   * @private
   * @param {string} moduleName - Name of the module to load
   */
  async _loadModuleByName(moduleName) {
    try {
      // Try to load from known module locations
      if (moduleName === 'file') {
        const { FileModule } = await import('../../../general-tools/src/file/FileModule.js');
        await this.moduleLoader.loadModuleByName('file', FileModule);
      } else if (moduleName === 'command-executor') {
        // Load command-executor from module.json
        const modulePath = '../../../general-tools/src/command-executor/module.json';
        const resolvedPath = new URL(modulePath, import.meta.url).pathname;
        await this.moduleLoader.loadModuleFromJson(resolvedPath);
      } else {
        // For other modules, try to load from conventional locations
        const modulePath = `../../../${moduleName}/src`;
        await this.moduleLoader.loadModule(modulePath);
      }
    } catch (error) {
      throw new Error(`Failed to load module '${moduleName}': ${error.message}`);
    }
  }
}