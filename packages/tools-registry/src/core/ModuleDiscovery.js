/**
 * ModuleDiscovery - Discovers Legion modules in the monorepo
 * 
 * Finds all module files, validates them, and stores them in the database
 * No mocks, no fallbacks - real implementation only
 */

import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { ModuleLoader } from './ModuleLoader.js';
import { MetadataManager } from '../verification/MetadataManager.js';
import { Logger } from '../utils/Logger.js';
import { 
  DiscoveryError,
  ModuleValidationError,
  DatabaseError 
} from '../errors/index.js';

export class ModuleDiscovery {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      ignoreDirs: ['node_modules', '.git', 'dist', 'build', 'coverage', '__tests__'],
      modulePattern: /Module\.js$/,  // Files ending with Module.js
      validateMetadata: false,  // Disable irrelevant metadata validation
      ...options
    };
    
    this.databaseStorage = options.databaseStorage;
    this.resourceManager = options.resourceManager;
    this.moduleLoader = new ModuleLoader({ resourceManager: this.resourceManager });
    this.metadataManager = new MetadataManager();
    this.monorepoRoot = this.findMonorepoRoot();
    this.logger = Logger.create('ModuleDiscovery', { verbose: this.options.verbose });
  }
  
  /**
   * Discover modules in a specific directory
   * @param {string} directory - Directory to search (resolved relative to monorepo root if not absolute)
   * @returns {Array} Array of module information
   */
  async discoverModules(directory) {
    // Resolve path relative to monorepo root if not absolute
    let resolvedDirectory;
    if (path.isAbsolute(directory)) {
      resolvedDirectory = directory;
    } else {
      resolvedDirectory = path.resolve(this.monorepoRoot, directory);
    }
    
    try {
      // Check if directory exists
      await fs.access(resolvedDirectory);
    } catch (error) {
      throw new DiscoveryError(
        `Directory does not exist: ${resolvedDirectory} (resolved from: ${directory})`,
        resolvedDirectory,
        error
      );
    }
    
    const modules = [];
    await this.scanDirectory(resolvedDirectory, modules);
    
    return modules;
  }
  
  /**
   * Recursively scan directory for module files
   * @param {string} dir - Directory to scan
   * @param {Array} modules - Array to collect modules
   */
  async scanDirectory(dir, modules) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip ignored directories
        if (!this.options.ignoreDirs.includes(entry.name)) {
          await this.scanDirectory(fullPath, modules);
        }
      } else if (entry.isFile()) {
        // Check if it matches module pattern
        if (this.options.modulePattern.test(entry.name)) {
          // Skip base Module.js classes (not actual modules)
          if (entry.name === 'Module.js' && (
            fullPath.includes('/tools-registry/src/core/Module.js') ||  // Base class
            fullPath.includes('/node-runner/src/base/Module.js') ||     // Base class
            fullPath.includes('/tools-registry-obsolete/')               // Obsolete package
          )) {
            continue;
          }
          const moduleInfo = this.getModuleInfo(fullPath);
          modules.push(moduleInfo);
        }
      }
    }
  }
  
  /**
   * Discover modules across the entire monorepo
   * @returns {Array} Array of module information
   */
  async discoverInMonorepo() {
    const packagesDir = path.join(this.monorepoRoot, 'packages');
    const modules = [];
    
    try {
      // Scan packages directory
      const packageDirs = await fs.readdir(packagesDir, { withFileTypes: true });
      
      for (const dir of packageDirs) {
        if (dir.isDirectory() && !this.options.ignoreDirs.includes(dir.name)) {
          const packagePath = path.join(packagesDir, dir.name);
          await this.scanDirectory(packagePath, modules);
        }
      }
    } catch (error) {
      // Packages directory might not exist
      this.logger.verbose('No packages directory found');
    }
    
    // Also scan src directory if it exists
    const srcDir = path.join(this.monorepoRoot, 'src');
    try {
      await fs.access(srcDir);
      await this.scanDirectory(srcDir, modules);
    } catch (error) {
      // src directory might not exist
    }
    
    return modules;
  }
  
  /**
   * Discover and validate modules with compliance checking
   * Uses reusable loading function and passes MODULE objects to validation
   * @returns {Object} Discovery result with modules and validation details
   */
  async discoverAndValidate() {
    const modules = await this.discoverInMonorepo();
    const results = {
      discovered: modules.length,
      validated: [],
      invalid: [],
      summary: {
        total: modules.length,
        valid: 0,
        invalid: 0,
        errors: 0
      }
    };
    
    // Ensure ResourceManager is available for loading
    await this._ensureResourceManager();
    
    for (const module of modules) {
      try {
        // Use reusable loading function: find file → get path → load MODULE object
        const moduleObject = await this.moduleLoader.loadModule(module.path);
        
        // Validate the loaded MODULE object (not the path)
        const validation = await this.validateModule(moduleObject);
        
        const moduleResult = {
          ...module,
          validation,
          moduleObject // Keep the loaded MODULE object for further processing
        };
        
        if (validation.valid) {
          results.validated.push(moduleResult);
          results.summary.valid++;
        } else {
          results.invalid.push(moduleResult);
          results.summary.invalid++;
        }
        
        results.summary.errors += validation.errors.length;
        
      } catch (loadError) {
        // If loading fails, create a failed validation result
        const validation = {
          valid: false,
          toolsCount: 0,
          errors: [`Failed to load module: ${loadError.message}`],
          metadata: null
        };
        
        const moduleResult = {
          ...module,
          validation
        };
        
        results.invalid.push(moduleResult);
        results.summary.invalid++;
        results.summary.errors += validation.errors.length;
      }
    }
    
    return results;
  }
  
  /**
   * Discover modules in a specific package
   * @param {string} packageName - Package name to search
   * @returns {Array} Array of module information
   */
  async discoverInPackage(packageName) {
    const packagePath = path.join(this.monorepoRoot, 'packages', packageName);
    
    try {
      await fs.access(packagePath);
      return await this.discoverModules(packagePath);
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Discover modules matching a pattern
   * @param {RegExp} pattern - Pattern to match module names
   * @returns {Array} Array of module information
   */
  async discoverByPattern(pattern) {
    const allModules = await this.discoverInMonorepo();
    return allModules.filter(module => pattern.test(module.name));
  }
  
  /**
   * Validate a module file
   * @param {string} modulePath - Path to module file
   * @returns {Object} Validation result with score and details
   */
  /**
   * Validate an already-loaded module object
   * Single Responsibility: Only validation, no loading
   */
  async validateModule(moduleObject) {
    const result = this._createValidationResult();
    
    try {
      if (!moduleObject) {
        result.valid = false;
        result.errors.push('Module object is null or undefined');
        return result;
      }

      // Module must have getTools() method - REQUIRED
      if (typeof moduleObject.getTools !== 'function') {
        result.valid = false;
        result.toolsCount = 0;
        result.errors.push('Module does not have getTools() method - all modules must implement getTools()');
        return result;
      }

      // Try to get tools and count them
      try {
        const tools = moduleObject.getTools();
        result.toolsCount = Array.isArray(tools) ? tools.length : 0;
        
        // Check if tools have basic structure - these are ERRORS not warnings
        if (Array.isArray(tools) && tools.length > 0) {
          for (const tool of tools) {
            if (!tool.name) {
              result.valid = false;
              result.errors.push(`Tool missing required name property`);
            }
            if (!tool.execute || typeof tool.execute !== 'function') {
              result.valid = false;
              result.errors.push(`Tool ${tool.name || 'unnamed'} missing required execute function`);
            }
          }
        }
      } catch (error) {
        // If getTools() throws, module is invalid
        result.valid = false;
        result.toolsCount = 0;
        result.errors.push(`getTools() failed: ${error.message}`);
        return result;
      }

      // Validate metadata if available
      if (typeof moduleObject.getMetadata === 'function' || moduleObject.metadata) {
        try {
          let metadata = null;
          if (typeof moduleObject.getMetadata === 'function') {
            metadata = await moduleObject.getMetadata();
          } else if (moduleObject.metadata) {
            metadata = moduleObject.metadata;
          }
          
          if (metadata) {
            const metadataValidation = this.metadataManager.validateModuleMetadata(metadata);
            result.metadata = metadata;
            // Add metadata errors to result
            result.errors.push(...metadataValidation.errors);
            // If metadata is invalid, module is invalid
            if (!metadataValidation.valid) {
              result.valid = false;
            }
          }
        } catch (metaError) {
          // Metadata errors are real errors
          result.valid = false;
          result.errors.push(`Metadata validation failed: ${metaError.message}`);
        }
      }

      // If we got here with no errors, module is valid
      if (result.errors.length === 0) {
        result.valid = true;
      }
      
    } catch (error) {
      result.valid = false;
      result.errors.push(`Module validation failed: ${error.message}`);
      this.logger.verbose(`Module validation failed: ${error.message}`);
    }
    
    return result;
  }

  /**
   * Create initial validation result structure
   * Single Responsibility: Result initialization
   */
  _createValidationResult() {
    return {
      valid: false,
      toolsCount: 0,  // Initialize toolsCount
      errors: [],
      metadata: null
    };
  }

  /**
   * Ensure ResourceManager is available
   * Single Responsibility: Resource management initialization
   */
  async _ensureResourceManager() {
    if (!this.resourceManager) {
      const { ResourceManager } = await import('@legion/resource-manager');
      this.resourceManager = ResourceManager.getInstance();
      await this.resourceManager.initialize();
    }
  }

  /**
   * Validate module metadata
   * Single Responsibility: Metadata validation
   */
  async _validateModuleMetadata(moduleInstance, result) {
    try {
      let metadata = null;
      if (typeof moduleInstance.getMetadata === 'function') {
        metadata = await moduleInstance.getMetadata();
      } else if (moduleInstance.metadata) {
        metadata = moduleInstance.metadata;
      }
      
      if (metadata) {
        const metadataValidation = this.metadataManager.validateModuleMetadata(metadata);
        result.metadata = metadata;
        result.score = metadataValidation.score;
        result.errors.push(...metadataValidation.errors);
        result.warnings.push(...metadataValidation.warnings);
        result.valid = metadataValidation.valid && result.valid;
      } else {
        result.warnings.push('Module does not provide metadata');
        result.score = 60;
      }
    } catch (metaError) {
      result.warnings.push(`Could not validate metadata: ${metaError.message}`);
    }
  }

  
  /**
   * Extract module information from file path
   * @param {string} filePath - Path to module file
   * @returns {Object} Module information
   */
  getModuleInfo(filePath) {
    const fileName = path.basename(filePath, '.js');
    const relativePath = path.relative(this.monorepoRoot, filePath);
    
    // Extract package name from path
    let packageName = 'monorepo';
    
    // Match packages/xxx pattern to get the package name
    const packageMatch = relativePath.match(/packages\/([^\/]+)\//);
    if (packageMatch) {
      packageName = packageMatch[1];
    }
    
    return {
      name: fileName,
      path: filePath,
      relativePath: relativePath,
      packageName: packageName,
      discoveredAt: new Date().toISOString()
    };
  }
  
  /**
   * Filter modules based on criteria
   * @param {Array} modules - Modules to filter
   * @param {Object} criteria - Filter criteria
   * @returns {Array} Filtered modules
   */
  filterModules(modules, criteria = {}) {
    let filtered = [...modules];
    
    if (criteria.packageName) {
      filtered = filtered.filter(m => m.packageName === criteria.packageName);
    }
    
    if (criteria.namePattern) {
      filtered = filtered.filter(m => criteria.namePattern.test(m.name));
    }
    
    return filtered;
  }
  
  /**
   * Save discovered modules to module-registry collection
   * @param {Array} modules - Modules to save
   * @returns {number} Number of modules saved
   */
  async saveToModuleRegistry(modules) {
    if (!this.databaseStorage || !this.databaseStorage.db) {
      throw new DatabaseError(
        'Database operation failed: No database connection',
        'save',
        'module-registry',
        new Error('Database storage not initialized')
      );
    }
    
    let savedCount = 0;
    const collection = this.databaseStorage.db.collection('module-registry');
    
    for (const module of modules) {
      try {
        // Extract toolsCount from validation if available
        const toolsCount = module.validation?.toolsCount || 0;
        
        // Add lastUpdated timestamp and toolsCount
        const moduleDoc = {
          ...module,
          toolsCount: toolsCount,  // Add toolsCount field from validation
          lastUpdated: new Date().toISOString(),
          status: 'discovered'  // Mark as discovered but not loaded
        };
        
        // Upsert - update if exists, insert if not
        await collection.replaceOne(
          { name: module.name, packageName: module.packageName },
          moduleDoc,
          { upsert: true }
        );
        
        savedCount++;
      } catch (error) {
        this.logger.warn(`Failed to save module ${module.name}: ${error.message}`);
        // Continue with other modules even if one fails
      }
    }
    
    return savedCount;
  }
  
  /**
   * @deprecated Use saveToModuleRegistry instead
   */
  async saveModulesToDatabase(modules) {
    return this.saveToModuleRegistry(modules);
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