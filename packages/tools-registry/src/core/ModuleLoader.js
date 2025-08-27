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
import { MetadataManager } from '../verification/MetadataManager.js';
import { ToolValidator } from '../verification/ToolValidator.js';
import { 
  ModuleLoadError, 
  ModuleValidationError, 
  ToolExecutionError, 
  ToolValidationError, 
  ParameterValidationError 
} from '../errors/index.js';

export class ModuleLoader {
  constructor(options = {}) {
    this.options = {
      validateMetadata: true,
      validateTools: true,
      strictMode: false,  // When true, fail on any validation warning
      ...options
    };
    this.moduleCache = new Map(); // Cache loaded module instances
    this.monorepoRoot = options.monorepoRoot || this.findMonorepoRoot();
    this.resourceManager = options.resourceManager;
    
    // Initialize validators if validation is enabled
    if (this.options.validateMetadata || this.options.validateTools) {
      this.metadataManager = new MetadataManager();
      this.toolValidator = new ToolValidator();
    }
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
    
    // Check if it's a directory and append index.js if needed
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        // First try index.js
        const indexPath = path.join(fullPath, 'index.js');
        try {
          await fs.access(indexPath);
          fullPath = indexPath;
        } catch {
          // If index.js doesn't exist, try the module name with .js extension
          const moduleNamePath = fullPath + '.js';
          try {
            await fs.access(moduleNamePath);
            fullPath = moduleNamePath;
          } catch {
            throw new Error(`No index.js or module.js found in directory: ${fullPath}`);
          }
        }
      }
    } catch (error) {
      // If the path doesn't exist as-is, try appending .js
      if (!fullPath.endsWith('.js')) {
        const jsPath = fullPath + '.js';
        try {
          await fs.access(jsPath);
          fullPath = jsPath;
        } catch {
          // Original path doesn't exist and neither does .js version
          throw new ModuleLoadError(
            `Module path not found: ${modulePath}`,
            modulePath,
            error
          );
        }
      } else {
        throw new ModuleLoadError(
          `Module path not found: ${modulePath}`,
          modulePath,
          error
        );
      }
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
      // Check if file exists (should already be verified above)
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
      
      // Create instance using standard interface - all modules must have static create method
      let moduleInstance;
      if (typeof ModuleClass === 'function') {
        // Standard interface requires static create method
        if (typeof ModuleClass.create === 'function') {
          if (!this.resourceManager) {
            throw new ModuleLoadError(
              `Module at ${fullPath} requires ResourceManager but none provided`,
              fullPath,
              new Error('ResourceManager is required for module creation')
            );
          }
          moduleInstance = await ModuleClass.create(this.resourceManager);
        } else {
          throw new ModuleValidationError(
            'Module does not implement standard interface',
            fullPath,
            ['Module class must have static async create(resourceManager) method']
          );
        }
      } else {
        throw new ModuleValidationError(
          'Invalid module structure - export is not a class',
          fullPath,
          ['Module export must be a class with static create() method']
        );
      }
      
      // Validate the module structure
      this.validateModuleStructure(moduleInstance);
      
      // Enhanced validation if enabled
      if (this.options.validateMetadata) {
        await this.performEnhancedValidation(moduleInstance, fullPath);
      }
      
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
   * Extract metadata from a loaded module - standard interface
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
    
    // Standard interface - all modules must have these properties
    const metadata = {
      name: moduleInstance.name || 'Unknown',
      version: moduleInstance.version || '1.0.0',
      description: moduleInstance.description || 'No description available'
    };
    
    // Extract additional optional metadata fields if present
    if (moduleInstance.author) {
      metadata.author = moduleInstance.author;
    }
    if (moduleInstance.keywords) {
      metadata.keywords = moduleInstance.keywords;
    }
    if (moduleInstance.dependencies) {
      metadata.dependencies = moduleInstance.dependencies;
    }
    
    // Get additional metadata if module has getMetadata method
    if (typeof moduleInstance.getMetadata === 'function') {
      const additionalMetadata = moduleInstance.getMetadata();
      Object.assign(metadata, additionalMetadata);
    }
    
    return metadata;
  }
  
  /**
   * Get tools from a module - standard interface only
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
    
    const moduleName = moduleInstance.name || 'unknown';
    
    // Standard interface - all modules must have getTools() method
    if (typeof moduleInstance.getTools !== 'function') {
      throw new ModuleValidationError(
        'Module does not have getTools method',
        moduleName,
        ['Module must have getTools() method that returns array of tools']
      );
    }
    
    const tools = moduleInstance.getTools();
    
    // Validate that getTools returns an array
    if (!Array.isArray(tools)) {
      throw new ModuleValidationError(
        'Module getTools() must return an array',
        moduleName,
        ['getTools() method must return an array of tool objects']
      );
    }
    
    // Validate each tool
    tools.forEach((tool, index) => {
      try {
        this.validateToolSchema(tool);
      } catch (error) {
        throw new ModuleValidationError(
          `Tool validation failed for tool at index ${index}`,
          moduleName,
          [error.message]
        );
      }
    });
    
    return tools;
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
   * Validate module structure - standard interface only
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
    
    let moduleName = moduleInstance.name || 'unknown';
    
    // Standard interface validation
    if (typeof moduleInstance.name !== 'string' || !moduleInstance.name) {
      errors.push('Module must have a name property (string)');
    }
    
    if (typeof moduleInstance.getTools !== 'function') {
      errors.push('Module must have getTools() method that returns array of tools');
    }
    
    // Check that module constructor has static create method
    const ModuleClass = moduleInstance.constructor;
    if (typeof ModuleClass.create !== 'function') {
      errors.push('Module class must have static async create(resourceManager) method');
    }
    
    if (errors.length > 0) {
      throw new ModuleValidationError(
        'Module validation failed - must follow standard Legion module interface',
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
   * Perform enhanced validation using MetadataManager and ToolValidator
   * @param {Object} moduleInstance - Module instance to validate
   * @param {string} modulePath - Path to the module file
   */
  async performEnhancedValidation(moduleInstance, modulePath) {
    const validationResults = {
      metadata: null,
      tools: [],
      overallScore: 0,
      errors: [],
      warnings: []
    };
    
    // Validate module metadata
    try {
      const metadata = await this.getModuleMetadata(moduleInstance);
      const metadataValidation = this.metadataManager.validateModuleMetadata(metadata);
      validationResults.metadata = metadataValidation;
      
      if (!metadataValidation.valid && this.options.strictMode) {
        throw new ModuleValidationError(
          `Module metadata validation failed for ${modulePath}`,
          modulePath,
          metadataValidation.errors
        );
      }
      
      validationResults.errors.push(...metadataValidation.errors);
      validationResults.warnings.push(...metadataValidation.warnings);
      
    } catch (error) {
      if (this.options.strictMode) {
        throw error;
      }
      validationResults.warnings.push(`Could not validate metadata: ${error.message}`);
    }
    
    // Validate tools if requested
    if (this.options.validateTools) {
      try {
        const tools = await this.getTools(moduleInstance);
        
        for (const tool of tools) {
          // Validate tool interface and metadata
          const toolValidation = await this.toolValidator.validateComplete(tool);
          validationResults.tools.push({
            name: tool.name,
            validation: toolValidation
          });
          
          if (!toolValidation.interface.valid && this.options.strictMode) {
            throw new ToolValidationError(
              `Tool validation failed for ${tool.name}`,
              tool.name,
              toolValidation.interface.errors
            );
          }
          
          // Aggregate errors and warnings
          if (toolValidation.interface.errors) {
            validationResults.errors.push(...toolValidation.interface.errors.map(e => `${tool.name}: ${e}`));
          }
          if (toolValidation.recommendations) {
            validationResults.warnings.push(...toolValidation.recommendations);
          }
        }
      } catch (error) {
        if (this.options.strictMode) {
          throw error;
        }
        validationResults.warnings.push(`Could not validate tools: ${error.message}`);
      }
    }
    
    // Calculate overall score
    let totalScore = 0;
    let scoreCount = 0;
    
    if (validationResults.metadata) {
      totalScore += validationResults.metadata.score || 0;
      scoreCount++;
    }
    
    for (const toolResult of validationResults.tools) {
      if (toolResult.validation && toolResult.validation.combinedScore !== undefined) {
        totalScore += toolResult.validation.combinedScore;
        scoreCount++;
      }
    }
    
    validationResults.overallScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
    
    // Log warnings in verbose mode
    if (this.options.verbose && validationResults.warnings.length > 0) {
      console.log(`Validation warnings for ${modulePath}:`);
      validationResults.warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    // Store validation results on the module instance for later retrieval
    moduleInstance.__validationResults = validationResults;
    
    return validationResults;
  }
  
  /**
   * Get validation results for a cached module
   * @param {string} modulePath - Path to the module
   * @returns {Object|null} Validation results if available
   */
  getValidationResults(modulePath) {
    const fullPath = path.isAbsolute(modulePath) ? 
      modulePath : path.resolve(this.monorepoRoot, modulePath);
    
    const moduleInstance = this.moduleCache.get(fullPath);
    return moduleInstance ? moduleInstance.__validationResults : null;
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