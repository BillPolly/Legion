/**
 * ModuleLoader - Handles module discovery and loading from @jsenvoy/tools
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ModuleLoader {
  constructor(resourceManager = null) {
    this.modules = new Map();
    this.moduleClasses = new Map();
    this.moduleInstances = new Map();
    this.resourceManager = resourceManager;
  }

  /**
   * Load all available modules
   * @param {object} options - Loading options
   * @returns {Map} Map of loaded modules
   */
  async loadModules(options = {}) {
    // Clear existing modules
    this.modules.clear();
    this.moduleClasses.clear();
    
    // Discover all module files
    const moduleFiles = await this.discoverModules();
    
    // Load each module
    for (const moduleFile of moduleFiles) {
      try {
        await this.loadModule(moduleFile, options);
      } catch (error) {
        // Skip modules that fail to load
        if (options.verbose) {
          console.error(`Failed to load module from ${moduleFile}:`, error.message);
        }
      }
    }
    
    return this.modules;
  }

  /**
   * Load a single module
   * @param {string} moduleFile - Path to module file
   * @param {object} options - Loading options
   */
  async loadModule(moduleFile, options = {}) {
    try {
      // Import the module class (ES modules)
      const moduleExports = await import(`file://${moduleFile}`);
      const ModuleClass = moduleExports.default;
      
      if (!ModuleClass) {
        return;
      }
      
      // Extract module name from class name (e.g., CalculatorModule -> calculator)
      const moduleName = ModuleClass.name
        .replace(/Module$/, '')
        .toLowerCase();
      
      // Store the module class for later instantiation
      this.moduleClasses.set(moduleName, ModuleClass);
      
      // Create a temporary instance to extract metadata
      const mockDependencies = this.createMockDependencies(ModuleClass);
      const tempInstance = new ModuleClass(mockDependencies);
      
      // Store module metadata
      const tools = tempInstance.getTools ? tempInstance.getTools() : [];
      
      // Count the actual number of functions
      let functionCount = 0;
      for (const tool of tools) {
        if (typeof tool.getAllToolDescriptions === 'function') {
          functionCount += tool.getAllToolDescriptions().length;
        } else {
          functionCount += 1;
        }
      }
      
      const moduleInfo = {
        name: moduleName,
        className: ModuleClass.name,
        dependencies: ModuleClass.dependencies || [],
        tools: tools,
        functionCount: functionCount
      };
      
      this.modules.set(moduleName, moduleInfo);
      
    } catch (error) {
      if (options.verbose) {
        console.error(`Failed to load module from ${moduleFile}:`, error.message);
      }
      throw error;
    }
  }

  /**
   * Create mock dependencies for module instantiation
   * @param {class} ModuleClass - Module class
   * @returns {object} Mock dependencies
   */
  createMockDependencies(ModuleClass) {
    const mockDependencies = {};
    
    if (ModuleClass.dependencies) {
      for (const dep of ModuleClass.dependencies) {
        // Provide mock values based on common dependency types
        if (dep.includes('Path') || dep === 'basePath') {
          mockDependencies[dep] = '/tmp';
        } else if (dep === 'encoding') {
          mockDependencies[dep] = 'utf8';
        } else if (dep.includes('create') || dep.includes('boolean')) {
          mockDependencies[dep] = false;
        } else if (dep === 'permissions') {
          mockDependencies[dep] = 0o755;
        } else {
          mockDependencies[dep] = 'mock-value';
        }
      }
    }
    
    return mockDependencies;
  }

  /**
   * Get module path
   * @returns {string} Path to modules directory
   */
  getModulePath() {
    // Resolve path to @jsenvoy/general-tools src directory where modules are located
    // From /packages/cli/src/core/ to /packages/general-tools/src/
    const toolsPath = path.resolve(__dirname, '../../../general-tools/src');
    return toolsPath;
  }

  /**
   * Discover all module files
   * @returns {string[]} Array of module file paths
   */
  async discoverModules() {
    const modulesPath = this.getModulePath();
    const moduleFiles = [];
    
    try {
      const entries = await fs.readdir(modulesPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Look for Module.js files in subdirectories
          const subPath = path.join(modulesPath, entry.name);
          const subFiles = await fs.readdir(subPath);
          
          for (const file of subFiles) {
            if (file.endsWith('Module.js')) {
              const fullPath = path.join(subPath, file);
              moduleFiles.push(fullPath);
            }
          }
        }
      }
    } catch (error) {
      // Ignore errors - directory might not exist
    }
    
    return moduleFiles;
  }

  /**
   * Create module instance
   * @param {string} moduleName - Module name
   * @returns {object} Module instance
   */
  createModuleInstance(moduleName) {
    // Check cache first
    if (this.moduleInstances.has(moduleName)) {
      return this.moduleInstances.get(moduleName);
    }
    
    // Get module class
    const ModuleClass = this.moduleClasses.get(moduleName);
    if (!ModuleClass) {
      throw new Error(`Module '${moduleName}' not found`);
    }
    
    try {
      // Resolve dependencies
      const dependencies = this.resolveModuleDependencies(moduleName, ModuleClass);
      
      // Create module instance
      const moduleInstance = new ModuleClass(dependencies);
      
      // Cache the instance
      this.moduleInstances.set(moduleName, moduleInstance);
      
      return moduleInstance;
    } catch (error) {
      throw new Error(`Failed to create module '${moduleName}': ${error.message}`);
    }
  }

  /**
   * Resolve module dependencies
   * @param {string} moduleName - Module name
   * @param {class} ModuleClass - Module class
   * @returns {object} Resolved dependencies
   */
  resolveModuleDependencies(moduleName, ModuleClass) {
    if (!ModuleClass.dependencies || !this.resourceManager) {
      return {};
    }
    
    const dependencies = {};
    
    for (const dep of ModuleClass.dependencies) {
      // First check for module-specific resource
      const moduleSpecificKey = `${moduleName}.${dep}`;
      if (this.resourceManager.has(moduleSpecificKey)) {
        dependencies[dep] = this.resourceManager.get(moduleSpecificKey);
      } else if (this.resourceManager.has(dep)) {
        // Fall back to global resource
        dependencies[dep] = this.resourceManager.get(dep);
      }
    }
    
    return dependencies;
  }

  /**
   * Get all module instances
   * @returns {object[]} Array of module instances
   */
  getAllModuleInstances() {
    const instances = [];
    
    for (const [moduleName] of this.moduleClasses) {
      try {
        const instance = this.createModuleInstance(moduleName);
        instances.push(instance);
      } catch (error) {
        // Skip modules that fail to instantiate
      }
    }
    
    return instances;
  }

  /**
   * Get module info
   * @param {string} moduleName - Module name
   * @returns {object} Module information
   */
  getModuleInfo(moduleName) {
    return this.modules.get(moduleName);
  }

  /**
   * Get all modules
   * @returns {Map} All loaded modules
   */
  getModules() {
    return this.modules;
  }

  /**
   * Get module classes
   * @returns {Map} Module classes
   */
  getModuleClasses() {
    return this.moduleClasses;
  }

  /**
   * Set resource manager
   * @param {ResourceManager} resourceManager - Resource manager instance
   */
  setResourceManager(resourceManager) {
    this.resourceManager = resourceManager;
  }
}

export default ModuleLoader;