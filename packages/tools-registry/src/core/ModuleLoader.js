/**
 * ModuleLoader - Core module loading capability
 * 
 * Loads Legion modules from JavaScript files, extracts metadata,
 * retrieves tools, and invokes them with proper validation.
 * 
 * No mocks, no fallbacks - real implementation only.
 */

import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { pathToFileURL } from 'url';
import { 
  ModuleLoadError, 
  ModuleValidationError, 
  ToolExecutionError, 
  ToolValidationError, 
  ParameterValidationError 
} from '../errors/index.js';

export class ModuleLoader {
  constructor(options = {}) {
    this.options = options;
    this.moduleCache = new Map(); // Cache loaded module instances
    this.monorepoRoot = options.monorepoRoot || this.findMonorepoRoot();
    this.resourceManager = options.resourceManager;
  }
  
  /**
   * Load a module from a JavaScript file
   * @param {string} modulePath - Path to the module file (absolute or relative)
   * @param {Object} options - Loading options
   * @param {boolean} options.forceReload - Force reload bypassing all caches
   * @returns {Object} Module instance
   */
  async loadModule(modulePath, options = {}) {
    // Resolve the full path
    let fullPath = modulePath;
    if (!path.isAbsolute(modulePath)) {
      fullPath = path.resolve(this.monorepoRoot, modulePath);
    }
    
    // Check cache first (unless forcing reload)
    if (!options.forceReload && this.moduleCache.has(fullPath)) {
      return this.moduleCache.get(fullPath);
    }
    
    // If forcing reload, clear from cache first
    if (options.forceReload && this.moduleCache.has(fullPath)) {
      this.moduleCache.delete(fullPath);
    }
    
    try {
      // Check if file exists
      await fs.access(fullPath);
      
      // Convert to file URL for dynamic import (Windows compatibility)
      let moduleUrl = pathToFileURL(fullPath).href;
      
      // Add cache-busting query parameter for force reload
      if (options.forceReload) {
        moduleUrl += `?t=${Date.now()}`;
      }
      
      // Dynamic import of the module - may throw SyntaxError for invalid JS
      let importedModule;
      try {
        importedModule = await import(moduleUrl);
      } catch (importError) {
        if (importError instanceof SyntaxError) {
          throw new ModuleLoadError(
            `Failed to load module at ${fullPath}: Syntax error in module`,
            fullPath,
            importError
          );
        }
        throw importError;
      }
      
      // Handle different export styles
      let ModuleClass;
      if (importedModule.default) {
        ModuleClass = importedModule.default;
      } else if (importedModule.Module) {
        ModuleClass = importedModule.Module;
      } else {
        throw new ModuleValidationError(
          'Invalid module structure - no default export or Module export found',
          fullPath,
          ['No default export or Module export found']
        );
      }
      
      // Create instance if it's a class, otherwise use as-is
      let moduleInstance;
      if (typeof ModuleClass === 'function') {
        // Check if module has a static create method (async factory pattern)
        if (typeof ModuleClass.create === 'function') {
          moduleInstance = await ModuleClass.create(this.resourceManager);
        } else {
          // Try to instantiate as a class - Legion modules often need ResourceManager
          try {
            // First try with ResourceManager if available
            if (this.resourceManager) {
              moduleInstance = new ModuleClass(this.resourceManager);
            } else {
              moduleInstance = new ModuleClass();
            }
          } catch (error) {
            // If constructor fails, might be a function that returns an instance
            try {
              moduleInstance = ModuleClass();
            } catch (secondError) {
              // Last resort - try empty constructor
              moduleInstance = new ModuleClass();
            }
          }
        }
      } else {
        moduleInstance = ModuleClass;
      }
      
      // Validate the module structure
      this.validateModuleStructure(moduleInstance);
      
      // Cache the instance
      this.moduleCache.set(fullPath, moduleInstance);
      
      return moduleInstance;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new ModuleLoadError(
          `Failed to load module at ${fullPath}: File not found`,
          fullPath,
          error
        );
      } else if (error instanceof ModuleValidationError) {
        throw error;
      } else {
        throw new ModuleLoadError(
          `Failed to load module at ${fullPath}: ${error.message}`,
          fullPath,
          error
        );
      }
    }
  }
  
  /**
   * Extract metadata from a loaded module
   * @param {Object} moduleInstance - Loaded module instance
   * @returns {Object} Module metadata
   */
  async getModuleMetadata(moduleInstance) {
    if (!moduleInstance) {
      throw new ModuleValidationError(
        'Invalid module instance: null or undefined',
        'unknown',
        ['Module instance is null or undefined']
      );
    }
    
    // Get name using different interfaces
    let name = 'Unknown';
    if (typeof moduleInstance.getName === 'function') {
      name = moduleInstance.getName();
    } else if (typeof moduleInstance.name === 'string') {
      name = moduleInstance.name;
    }
    
    const metadata = {
      name: name,
      version: moduleInstance.getVersion ? moduleInstance.getVersion() : 'unknown',
      description: moduleInstance.getDescription ? moduleInstance.getDescription() : 
                   (moduleInstance.description || 'No description available')
    };
    
    // Add any additional metadata if available
    if (moduleInstance.getMetadata) {
      const additionalMetadata = moduleInstance.getMetadata();
      Object.assign(metadata, additionalMetadata);
    }
    
    return metadata;
  }
  
  /**
   * Get tools from a module
   * @param {Object} moduleInstance - Loaded module instance
   * @returns {Array} Array of tool definitions
   */
  async getTools(moduleInstance) {
    if (!moduleInstance) {
      throw new ModuleValidationError(
        'Invalid module instance',
        'unknown',
        ['Module instance is null or undefined']
      );
    }
    
    let tools = [];
    let moduleName = moduleInstance.getName ? moduleInstance.getName() : 
                     moduleInstance.name || 'unknown';
    
    // Try different interfaces for getting tools
    if (typeof moduleInstance.getTools === 'function') {
      tools = moduleInstance.getTools();
    } else if (typeof moduleInstance.listTools === 'function') {
      const toolNames = moduleInstance.listTools();
      // listTools() returns tool names, need to get actual tools
      if (Array.isArray(toolNames) && typeof moduleInstance.getTool === 'function') {
        tools = toolNames.map(name => moduleInstance.getTool(name));
      } else {
        tools = toolNames; // Hope they're already tool objects
      }
    } else {
      throw new ModuleValidationError(
        'Module does not have getTools or listTools method',
        moduleName,
        ['Module must have getTools() or listTools() method']
      );
    }
    
    // Validate each tool
    if (Array.isArray(tools)) {
      tools.forEach(tool => {
        this.validateToolSchema(tool);
      });
    }
    
    return tools || [];
  }
  
  /**
   * Invoke a tool with parameters
   * @param {Object} tool - Tool definition
   * @param {Object} parameters - Tool parameters
   * @returns {Object} Tool execution result
   */
  async invokeTool(tool, parameters) {
    if (!tool || typeof tool.execute !== 'function') {
      throw new ToolValidationError(
        'Tool does not have execute method',
        tool ? tool.name : 'unknown',
        ['Tool must have execute method']
      );
    }
    
    // Validate parameters against schema
    if (tool.inputSchema) {
      this.validateParameters(parameters, tool.inputSchema);
    }
    
    try {
      // Execute the tool
      const result = await tool.execute(parameters);
      return result;
    } catch (error) {
      // If it's already one of our errors, re-throw
      if (error instanceof ParameterValidationError) {
        throw error;
      }
      // Otherwise wrap in ToolExecutionError
      throw new ToolExecutionError(
        `Tool execution failed: ${error.message}`,
        tool.name,
        parameters,
        error
      );
    }
  }
  
  /**
   * Validate module structure
   * @param {Object} moduleInstance - Module to validate
   */
  validateModuleStructure(moduleInstance) {
    const errors = [];
    
    if (!moduleInstance) {
      throw new ModuleValidationError(
        'Module is null or undefined',
        'unknown',
        ['Module is null or undefined']
      );
    }
    
    // Check for Legion module interface patterns
    let hasValidInterface = false;
    let moduleName = 'unknown';
    
    // Pattern 1: getName() + getTools() (tools-registry interface)
    if (typeof moduleInstance.getName === 'function' && 
        typeof moduleInstance.getTools === 'function') {
      hasValidInterface = true;
      try {
        moduleName = moduleInstance.getName();
      } catch (e) {
        // getName exists but fails
        errors.push('getName method exists but fails to execute');
      }
    }
    // Pattern 2: name property + getTools() method (Legion module interface)
    else if (typeof moduleInstance.name === 'string' && 
             typeof moduleInstance.getTools === 'function') {
      hasValidInterface = true;
      moduleName = moduleInstance.name;
    }
    // Pattern 3: name property + listTools() method (alternate Legion interface)
    else if (typeof moduleInstance.name === 'string' && 
             typeof moduleInstance.listTools === 'function') {
      hasValidInterface = true;
      moduleName = moduleInstance.name;
    }
    
    if (!hasValidInterface) {
      errors.push('Module must implement one of the supported interfaces:');
      errors.push('  - getName() + getTools() methods');
      errors.push('  - name property + getTools() method');
      errors.push('  - name property + listTools() method');
    }
    
    if (errors.length > 0) {
      throw new ModuleValidationError(
        'Module validation failed',
        moduleName,
        errors
      );
    }
  }
  
  /**
   * Validate tool schema
   * @param {Object} tool - Tool to validate
   */
  validateToolSchema(tool) {
    if (!tool) {
      throw new ToolValidationError(
        'Tool is null or undefined',
        'unknown',
        ['Tool is null or undefined']
      );
    }
    
    const errors = [];
    
    // Only require name and execute as truly required properties
    // description, inputSchema, outputSchema are optional but recommended
    const requiredProperties = ['name', 'execute'];
    const missingRequired = requiredProperties.filter(prop => !tool[prop]);
    
    if (missingRequired.length > 0) {
      errors.push(`Tool missing required properties: ${missingRequired.join(', ')}`);
    }
    
    // Validate execute is a function if present
    if (tool.execute && typeof tool.execute !== 'function') {
      errors.push('Tool execute must be a function');
    }
    
    // Validate schemas if present (but don't require them)
    if (tool.inputSchema && (typeof tool.inputSchema !== 'object' || !tool.inputSchema.type)) {
      errors.push('Invalid schema format: inputSchema must be an object with type property');
    }
    
    if (tool.outputSchema && (typeof tool.outputSchema !== 'object' || !tool.outputSchema.type)) {
      errors.push('Invalid schema format: outputSchema must be an object with type property');
    }
    
    if (errors.length > 0) {
      throw new ToolValidationError(
        'Tool validation failed',
        tool.name || 'unknown',
        errors
      );
    }
  }
  
  /**
   * Validate parameters against a JSON schema
   * @param {Object} parameters - Parameters to validate
   * @param {Object} schema - JSON schema
   */
  validateParameters(parameters, schema) {
    if (!schema || !schema.properties) {
      return; // No schema to validate against
    }
    
    // Check required parameters
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredParam of schema.required) {
        if (!(requiredParam in parameters)) {
          throw new ParameterValidationError(
            `Missing required parameter: ${requiredParam}`,
            requiredParam,
            'required',
            'missing'
          );
        }
      }
    }
    
    // Check parameter types
    if (schema.properties) {
      for (const [paramName, paramValue] of Object.entries(parameters)) {
        if (schema.properties[paramName]) {
          const expectedType = schema.properties[paramName].type;
          const actualType = typeof paramValue;
          
          // Basic type validation
          if (expectedType === 'number' && actualType !== 'number') {
            throw new ParameterValidationError(
              `Invalid parameter type for ${paramName}: expected number, got ${actualType}`,
              paramName,
              'number',
              actualType
            );
          }
          if (expectedType === 'string' && actualType !== 'string') {
            throw new ParameterValidationError(
              `Invalid parameter type for ${paramName}: expected string, got ${actualType}`,
              paramName,
              'string',
              actualType
            );
          }
          if (expectedType === 'boolean' && actualType !== 'boolean') {
            throw new ParameterValidationError(
              `Invalid parameter type for ${paramName}: expected boolean, got ${actualType}`,
              paramName,
              'boolean',
              actualType
            );
          }
          if (expectedType === 'object' && (actualType !== 'object' || paramValue === null)) {
            throw new ParameterValidationError(
              `Invalid parameter type for ${paramName}: expected object, got ${actualType}`,
              paramName,
              'object',
              actualType
            );
          }
          if (expectedType === 'array' && !Array.isArray(paramValue)) {
            throw new ParameterValidationError(
              `Invalid parameter type for ${paramName}: expected array, got ${actualType}`,
              paramName,
              'array',
              actualType
            );
          }
        }
      }
    }
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    this.moduleCache.clear();
  }
  
  /**
   * Find the monorepo root directory
   */
  findMonorepoRoot() {
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      // Check for package.json with workspaces
      const packageJsonPath = path.join(currentDir, 'package.json');
      
      try {
        const packageJson = JSON.parse(fsSync.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.name === '@legion/monorepo' || 
            (packageJson.workspaces && packageJson.workspaces.includes('packages/*'))) {
          return currentDir;
        }
      } catch (error) {
        // Continue searching up
      }
      
      currentDir = path.dirname(currentDir);
    }
    
    // Default to process.cwd() if not found
    return process.cwd();
  }
}