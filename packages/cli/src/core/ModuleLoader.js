/**
 * ModuleLoader - Handles module discovery and loading from @legion/tools
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ModuleFactory } from '@legion/module-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ModuleLoader {
  constructor(resourceManager = null) {
    this.modules = new Map();
    this.moduleClasses = new Map();
    this.moduleInstances = new Map();
    this.jsonModules = new Map(); // Track which modules are JSON-based
    this.resourceManager = resourceManager;
    this.moduleFactory = null;
    
    if (resourceManager) {
      this.moduleFactory = new ModuleFactory(resourceManager);
    }
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
    
    // Load from registry first
    try {
      const registryPath = path.resolve(__dirname, '../../../module-loader/src/ModuleRegistry.json');
      const registryContent = await fs.readFile(registryPath, 'utf-8');
      const registry = JSON.parse(registryContent);
      
      if (registry.modules) {
        // Project root is the Legion root (4 levels up from cli/src/core to Legion root)
        const projectRoot = path.resolve(__dirname, '../../../..');
        
        for (const [moduleName, moduleConfig] of Object.entries(registry.modules)) {
          // Resolve the path correctly from Legion root
          const modulePath = path.join(projectRoot, moduleConfig.path);
          try {
            await this.loadModuleFromRegistry(moduleName, modulePath, moduleConfig, options);
          } catch (error) {
            // Skip modules that fail to load
            if (options.verbose) {
              console.error(`Failed to load module ${moduleName} from ${modulePath}:`, error.message);
            }
          }
        }
      }
    } catch (error) {
      // Fallback to discovering modules
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
    }
    
    return this.modules;
  }

  /**
   * Load a module from the registry
   * @param {string} moduleName - Module name from registry
   * @param {string} modulePath - Path to module file
   * @param {object} moduleConfig - Module configuration from registry
   * @param {object} options - Loading options
   */
  async loadModuleFromRegistry(moduleName, modulePath, moduleConfig, options = {}) {
    try {
      // Check if it's a JSON module
      if (moduleConfig.type === 'json') {
        return await this.loadJsonModuleFromRegistry(moduleName, modulePath, options);
      }
      
      // Import the module class (ES modules)
      const moduleExports = await import(`file://${modulePath}`);
      const ModuleClass = moduleExports.default || moduleExports[moduleConfig.className];
      
      if (!ModuleClass) {
        return;
      }
      
      // Store the module class for later instantiation
      this.moduleClasses.set(moduleName, ModuleClass);
      
      // Create a temporary instance to extract metadata
      const mockDependencies = this.createMockDependencies(ModuleClass);
      const tempInstance = new ModuleClass(mockDependencies);
      
      // Initialize the module if it has an initialize method
      if (typeof tempInstance.initialize === 'function') {
        try {
          await tempInstance.initialize();
        } catch (initError) {
          // Some modules might fail initialization without proper dependencies
          // Continue anyway - tools might still be available
        }
      }
      
      // Store module metadata - be careful with getTools as it might need initialization
      let tools = [];
      let functionCount = 0;
      
      try {
        // getTools might be async or sync
        let toolsResult = tempInstance.getTools ? tempInstance.getTools() : [];
        // Handle async getTools
        if (toolsResult && typeof toolsResult.then === 'function') {
          toolsResult = await toolsResult;
        }
        tools = Array.isArray(toolsResult) ? toolsResult : [];
        
        // Count the actual number of functions
        for (const tool of tools) {
          if (typeof tool.getAllToolDescriptions === 'function') {
            functionCount += tool.getAllToolDescriptions().length;
          } else {
            functionCount += 1;
          }
        }
      } catch (error) {
        // Module needs initialization - just set tools to empty for now
        tools = [];
        functionCount = 0;
      }
      
      const moduleInfo = {
        name: moduleName,
        className: moduleConfig.className || ModuleClass.name,
        dependencies: ModuleClass.dependencies || [],
        tools: tools,
        functionCount: functionCount,
        isJsonModule: false
      };
      
      this.modules.set(moduleName, moduleInfo);
      
    } catch (error) {
      if (options.verbose) {
        console.error(`Failed to load module ${moduleName} from ${modulePath}:`, error.message);
      }
      throw error;
    }
  }

  /**
   * Load a JSON module from registry
   * @param {string} moduleName - Module name from registry
   * @param {string} jsonFile - Path to module.json file
   * @param {object} options - Loading options
   */
  async loadJsonModuleFromRegistry(moduleName, jsonFile, options = {}) {
    if (!this.moduleFactory) {
      throw new Error('ModuleFactory not initialized. ResourceManager required for JSON modules.');
    }

    try {
      // Use ModuleFactory to create the JSON module directly
      const moduleInstance = await this.moduleFactory.createJsonModule(jsonFile);
      
      // Store the instance for later use
      this.moduleInstances.set(moduleName, moduleInstance);
      this.jsonModules.set(moduleName, true);
      
      // Get tools - be careful as getTools might return null/undefined
      let tools = [];
      let functionCount = 0;
      
      try {
        // getTools might be async for GenericModule
        const toolsResult = moduleInstance.getTools ? await moduleInstance.getTools() : [];
        tools = Array.isArray(toolsResult) ? toolsResult : [];
        
        // Count functions
        for (const tool of tools) {
          if (typeof tool.getAllToolDescriptions === 'function') {
            functionCount += tool.getAllToolDescriptions().length;
          } else {
            functionCount += 1;
          }
        }
      } catch (error) {
        // Module might need initialization or tools not available
        tools = [];
        functionCount = 0;
      }
      
      // Store module info
      const moduleInfo = {
        name: moduleName,
        className: moduleInstance.constructor.name,
        dependencies: moduleInstance.dependencies || [],
        tools: tools,
        functionCount: functionCount,
        isJsonModule: true
      };
      
      this.modules.set(moduleName, moduleInfo);
      
      return moduleInfo;
    } catch (error) {
      if (options.verbose) {
        console.error(`Failed to load JSON module ${moduleName} from ${jsonFile}:`, error.message);
      }
      throw error;
    }
  }

  /**
   * Load a single module
   * @param {string} moduleFile - Path to module file
   * @param {object} options - Loading options
   */
  async loadModule(moduleFile, options = {}) {
    try {
      // Check if it's a JSON module
      if (moduleFile.endsWith('module.json')) {
        return await this.loadJsonModule(moduleFile, options);
      }
      
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
      
      // Initialize the module if it has an initialize method
      if (typeof tempInstance.initialize === 'function') {
        try {
          await tempInstance.initialize();
        } catch (initError) {
          // Some modules might fail initialization without proper dependencies
          // Continue anyway - tools might still be available
        }
      }
      
      // Store module metadata - be careful with getTools as it might need initialization
      let tools = [];
      let functionCount = 0;
      
      try {
        // getTools might be async or sync
        let toolsResult = tempInstance.getTools ? tempInstance.getTools() : [];
        // Handle async getTools
        if (toolsResult && typeof toolsResult.then === 'function') {
          toolsResult = await toolsResult;
        }
        tools = Array.isArray(toolsResult) ? toolsResult : [];
        
        // Count the actual number of functions
        for (const tool of tools) {
          if (typeof tool.getAllToolDescriptions === 'function') {
            functionCount += tool.getAllToolDescriptions().length;
          } else {
            functionCount += 1;
          }
        }
      } catch (error) {
        // Module needs initialization - just set tools to empty for now
        tools = [];
        functionCount = 0;
      }
      
      const moduleInfo = {
        name: moduleName,
        className: ModuleClass.name,
        dependencies: ModuleClass.dependencies || [],
        tools: tools,
        functionCount: functionCount,
        isJsonModule: false
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
   * Load a JSON module
   * @param {string} jsonFile - Path to module.json file
   * @param {object} options - Loading options
   */
  async loadJsonModule(jsonFile, options = {}) {
    if (!this.moduleFactory) {
      throw new Error('ModuleFactory not initialized. ResourceManager required for JSON modules.');
    }

    try {
      // Use ModuleFactory to create the module
      const moduleDir = path.dirname(jsonFile);
      const moduleInstance = await this.moduleFactory.createModuleAuto(moduleDir);
      
      // Get module name
      const moduleName = moduleInstance.name || path.basename(moduleDir);
      
      // Store the instance for later use
      this.moduleInstances.set(moduleName, moduleInstance);
      this.jsonModules.set(moduleName, true);
      
      // Get tools - be careful as getTools might return null/undefined
      let tools = [];
      let functionCount = 0;
      
      try {
        // getTools might be async for GenericModule
        const toolsResult = moduleInstance.getTools ? await moduleInstance.getTools() : [];
        tools = Array.isArray(toolsResult) ? toolsResult : [];
        
        // Count functions
        for (const tool of tools) {
          if (typeof tool.getAllToolDescriptions === 'function') {
            functionCount += tool.getAllToolDescriptions().length;
          } else {
            functionCount += 1;
          }
        }
      } catch (error) {
        // Module might need initialization or tools not available
        tools = [];
        functionCount = 0;
      }
      
      // Store module metadata
      const moduleInfo = {
        name: moduleName,
        className: moduleInstance.constructor.name,
        dependencies: moduleInstance.dependencies ? Object.keys(moduleInstance.dependencies) : [],
        tools: tools,
        functionCount: functionCount,
        isJsonModule: true
      };
      
      this.modules.set(moduleName, moduleInfo);
      
    } catch (error) {
      if (options.verbose) {
        console.error(`Failed to load JSON module from ${jsonFile}:`, error.message);
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
    // Resolve path to @legion/general-tools src directory where modules are located
    // From /packages/cli/src/core/ to /packages/general-tools/src/
    const toolsPath = path.resolve(__dirname, '../../../general-tools/src');
    return toolsPath;
  }

  /**
   * Discover all module files from ModuleRegistry.json
   * @returns {string[]} Array of module file paths
   */
  async discoverModules() {
    const moduleFiles = [];
    
    try {
      // First, try to load from ModuleRegistry.json
      const registryPath = path.resolve(__dirname, '../../../module-loader/src/ModuleRegistry.json');
      const registryContent = await fs.readFile(registryPath, 'utf-8');
      const registry = JSON.parse(registryContent);
      
      if (registry.modules) {
        // Project root is the Legion root (4 levels up from cli/src/core)
        const projectRoot = path.resolve(__dirname, '../../../..');
        
        for (const [moduleName, moduleConfig] of Object.entries(registry.modules)) {
          // Resolve the path correctly from Legion root
          const modulePath = path.join(projectRoot, moduleConfig.path);
          moduleFiles.push(modulePath);
        }
      }
    } catch (error) {
      // Fallback to discovering from general-tools only
      const modulesPath = this.getModulePath();
      
      try {
        const entries = await fs.readdir(modulesPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            // Look for Module.js and module.json files in subdirectories
            const subPath = path.join(modulesPath, entry.name);
            const subFiles = await fs.readdir(subPath);
            
            let hasModuleJs = false;
            let hasModuleJson = false;
            
            for (const file of subFiles) {
              if (file.endsWith('Module.js')) {
                const fullPath = path.join(subPath, file);
                moduleFiles.push(fullPath);
                hasModuleJs = true;
              } else if (file === 'module.json') {
                hasModuleJson = true;
              }
            }
            
            // Only add module.json if there's no Module.js (Module.js takes precedence)
            if (!hasModuleJs && hasModuleJson) {
              const jsonPath = path.join(subPath, 'module.json');
              moduleFiles.push(jsonPath);
            }
          }
        }
      } catch (error) {
        // Ignore errors - directory might not exist
      }
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
    
    // Check if it's a JSON module (already instantiated during load)
    if (this.jsonModules.has(moduleName)) {
      const instance = this.moduleInstances.get(moduleName);
      if (!instance) {
        throw new Error(`JSON module '${moduleName}' not properly loaded`);
      }
      return instance;
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
    if (resourceManager) {
      this.moduleFactory = new ModuleFactory(resourceManager);
    }
  }
}

export default ModuleLoader;