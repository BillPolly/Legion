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
      ...options
    };
    
    this.databaseStorage = options.databaseStorage;
    this.moduleLoader = new ModuleLoader();
    this.monorepoRoot = this.findMonorepoRoot();
  }
  
  /**
   * Discover modules in a specific directory
   * @param {string} directory - Directory to search
   * @returns {Array} Array of module information
   */
  async discoverModules(directory) {
    try {
      // Check if directory exists
      await fs.access(directory);
    } catch (error) {
      throw new DiscoveryError(
        `Directory does not exist: ${directory}`,
        directory,
        error
      );
    }
    
    const modules = [];
    await this.scanDirectory(directory, modules);
    
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
      if (this.options.verbose) {
        console.log('No packages directory found');
      }
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
   * @returns {boolean} True if valid, false otherwise
   */
  async validateModule(modulePath) {
    try {
      // First check if the file can be parsed (no syntax errors)
      const fileContent = await fs.readFile(modulePath, 'utf-8');
      
      // Basic syntax validation - this is not perfect but catches obvious errors
      // We could use a proper parser here but for MVP, just try to import
      
      try {
        const moduleInstance = await this.moduleLoader.loadModule(modulePath);
        
        // Check for Legion module interface - modules may have different interfaces
        // Try both interfaces: new-tool-registry interface and Legion module interface
        
        // Option 1: new-tool-registry interface (getName, getTools)
        if (typeof moduleInstance.getName === 'function' && 
            typeof moduleInstance.getTools === 'function') {
          try {
            moduleInstance.getName();
            moduleInstance.getTools();
            return true;
          } catch (e) {
            // Method exists but fails to execute
          }
        }
        
        // Option 2: Legion module interface (name property, listTools method)
        if (typeof moduleInstance.name === 'string' && 
            typeof moduleInstance.listTools === 'function') {
          try {
            const tools = moduleInstance.listTools();
            if (Array.isArray(tools)) {
              return true;
            }
          } catch (e) {
            // Method exists but fails to execute
          }
        }
        
        // Option 3: Simple object with getTools method (like ClaudeToolsModule after initialize)
        if (typeof moduleInstance.getTools === 'function') {
          try {
            const tools = moduleInstance.getTools();
            if (Array.isArray(tools)) {
              return true;
            }
          } catch (e) {
            // Method exists but fails to execute
          }
        }
        
        // If none of the expected interfaces work, module is invalid
        if (this.options.verbose) {
          console.log(`Module ${modulePath} doesn't implement expected interface`);
        }
        return false;
        
      } catch (importError) {
        // If it's a syntax error, return false
        if (importError instanceof SyntaxError) {
          if (this.options.verbose) {
            console.log(`Module has syntax error ${modulePath}: ${importError.message}`);
          }
          return false;
        }
        // For import/dependency errors, also return false (but this is expected for broken modules)
        if (this.options.verbose) {
          console.log(`Module validation failed for ${modulePath}: ${importError.message}`);
        }
        return false;
      }
    } catch (error) {
      if (this.options.verbose) {
        console.log(`Could not read module file ${modulePath}: ${error.message}`);
      }
      return false;
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
   * Save discovered modules to database
   * @param {Array} modules - Modules to save
   * @returns {number} Number of modules saved
   */
  async saveModulesToDatabase(modules) {
    if (!this.databaseStorage || !this.databaseStorage.db) {
      throw new DatabaseError(
        'Database operation failed: No database connection',
        'save',
        'modules',
        new Error('Database storage not initialized')
      );
    }
    
    let savedCount = 0;
    const collection = this.databaseStorage.db.collection('modules');
    
    for (const module of modules) {
      try {
        // Add lastUpdated timestamp
        const moduleDoc = {
          ...module,
          lastUpdated: new Date().toISOString()
        };
        
        // Upsert - update if exists, insert if not
        await collection.replaceOne(
          { name: module.name, packageName: module.packageName },
          moduleDoc,
          { upsert: true }
        );
        
        savedCount++;
      } catch (error) {
        if (this.options.verbose) {
          console.error(`Failed to save module ${module.name}: ${error.message}`);
        }
        // Continue with other modules even if one fails
      }
    }
    
    return savedCount;
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