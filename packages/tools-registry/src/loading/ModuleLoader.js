/**
 * Simple Module Loader
 * 
 * Loads modules from the module registry with straightforward logic.
 * No complex fallback strategies or auto-detection - just direct loading.
 */

import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { DynamicJsonModule } from './DynamicJsonModule.js';
import { ResourceManager } from '@legion/resource-manager';

export class ModuleLoader {
  constructor(options = {}) {
    this.monorepoRoot = options.monorepoRoot || this.findMonorepoRoot();
    this.resourceManager = options.resourceManager;
    this.verbose = options.verbose || false;
    this.databaseProvider = null;
  }

  /**
   * Initialize the loader
   */
  async initialize() {
    // Initialize ResourceManager if not provided
    if (!this.resourceManager) {
      this.resourceManager = ResourceManager.getInstance();
      await this.resourceManager.initialize();
    }
  }

  /**
   * Load all modules from the database (discovered modules)
   */
  async loadModules(filter = null) {
    await this.initialize();
    
    // Get database provider - create if needed
    if (!this.databaseProvider) {
      const { MongoDBToolRegistryProvider } = await import('../providers/MongoDBToolRegistryProvider.js');
      this.databaseProvider = await MongoDBToolRegistryProvider.create(this.resourceManager, {
        enableSemanticSearch: false
      });
    }
    
    // Load modules from database where discovery put them
    let query = { 
      loadable: { $ne: false }  // Include all loadable modules
    };
    
    // Apply filter if provided
    if (filter) {
      query.$or = [
        { name: { $regex: new RegExp(filter, 'i') } },
        { className: { $regex: new RegExp(filter, 'i') } }
      ];
    }
    
    let modules = await this.databaseProvider.databaseService.mongoProvider.find('modules', query);
    
    if (this.verbose) {
      console.log(`📋 Found ${modules.length} modules in database`);
    }
    
    if (this.verbose) {
      console.log(`📦 Loading ${modules.length} modules from registry`);
    }
    
    const loadedModules = [];
    const failedModules = [];
    
    for (const moduleConfig of modules) {
      try {
        if (this.verbose) {
          console.log(`  Loading ${moduleConfig.name} (${moduleConfig.type})...`);
        }
        
        const module = await this.loadModule(moduleConfig);
        if (module) {
          // Check if module was recently cleared - don't automatically mark as loaded
          const moduleRecord = await this.databaseProvider.databaseService.mongoProvider.findOne('modules', { _id: moduleConfig._id });
          const wasRecentlyCleared = moduleRecord && moduleRecord.clearedForReload && 
            moduleRecord.clearedAt && (Date.now() - moduleRecord.clearedAt.getTime()) < 300000; // 5 minutes
          
          // Update loading status to success, but respect cleared state
          const tools = module.getTools ? module.getTools() : [];
          const updateData = {
            $set: {
              loadingStatus: wasRecentlyCleared ? 'unloaded' : 'loaded',
              lastLoadedAt: new Date(),
              toolCount: tools.length
            },
            $unset: {
              loadingError: ""
            },
            $setOnInsert: {
              name: moduleConfig.name || 'unknown',
              description: moduleConfig.description || `${moduleConfig.name || 'unknown'} module successfully loaded into the tool registry system. This module provides various tools and functionality within the Legion framework ecosystem.`,
              type: moduleConfig.type || 'class',
              path: moduleConfig.path || 'unknown',
              createdAt: new Date(),
              status: 'active'
            }
          };
          
          // Clear the clearedForReload flag only if we're actually loading it
          if (!wasRecentlyCleared) {
            updateData.$unset.clearedForReload = "";
            updateData.$unset.clearedAt = "";
          }
          
          await this.databaseProvider.databaseService.mongoProvider.update(
            'modules',
            { _id: moduleConfig._id },
            updateData
          );
          
          loadedModules.push({
            config: moduleConfig,
            instance: module
          });
          
          if (this.verbose) {
            console.log(`    ✅ Loaded with ${tools.length} tools`);
          }
        }
      } catch (error) {
        // Update loading status to failed
        await this.databaseProvider.databaseService.mongoProvider.update(
          'modules',
          { _id: moduleConfig._id },
          {
            $set: {
              loadingStatus: 'failed',
              loadingError: error.message,
              lastLoadedAt: new Date()
            }
          }
        );
        
        failedModules.push({
          config: moduleConfig,
          error: error.message
        });
        
        if (this.verbose) {
          console.log(`    ❌ Failed: ${error.message}`);
        }
      }
    }
    
    return {
      loaded: loadedModules,
      failed: failedModules,
      summary: {
        total: modules.length,
        loaded: loadedModules.length,
        failed: failedModules.length
      }
    };
  }

  /**
   * Load a single module based on its configuration
   */
  async loadModule(moduleConfig) {
    if (moduleConfig.type === 'json') {
      return await this.loadJsonModule(moduleConfig);
    } else {
      return await this.loadClassModule(moduleConfig);
    }
  }

  /**
   * Load a class-based module
   */
  async loadClassModule(moduleConfig) {
    const modulePath = path.join(this.monorepoRoot, moduleConfig.path, 'index.js');
    
    if (this.verbose) {
      console.log(`  Attempting to load from: ${modulePath}`);
    }
    
    try {
      // Convert to file URL for proper ES module import
      const moduleUrl = `file://${modulePath}`;
      
      // Import the module
      const moduleExports = await import(moduleUrl);
      const ModuleClass = moduleExports.default || moduleExports[moduleConfig.className];
      
      if (!ModuleClass) {
        throw new Error(`Module class ${moduleConfig.className} not found in exports`);
      }
      
      // Check if module has a static create method (async factory pattern)
      if (typeof ModuleClass.create === 'function') {
        // Use the async factory method
        return await ModuleClass.create(this.resourceManager);
      }
      
      // Check if module needs dependencies
      if (ModuleClass.dependencies && ModuleClass.dependencies.length > 0) {
        // Module needs dependencies - create with ResourceManager
        const dependencies = {};
        for (const dep of ModuleClass.dependencies) {
          const value = this.resourceManager.get(`env.${dep}`);
          if (value) {
            dependencies[dep] = value;
          }
        }
        return new ModuleClass(dependencies);
      }
      
      // Simple module without dependencies
      return new ModuleClass();
      
    } catch (error) {
      if (this.verbose) {
        console.log(`  Primary path failed: ${error.message}`);
      }
      
      // Try without index.js suffix
      const altPath = path.join(this.monorepoRoot, moduleConfig.path + '.js');
      const altUrl = `file://${altPath}`;
      
      if (this.verbose) {
        console.log(`  Trying alternative path: ${altPath}`);
      }
      
      try {
        const moduleExports = await import(altUrl);
        const ModuleClass = moduleExports.default || moduleExports[moduleConfig.className];
        
        if (!ModuleClass) {
          throw new Error(`Module class ${moduleConfig.className} not found`);
        }
        
        // Same instantiation logic as above
        if (typeof ModuleClass.create === 'function') {
          return await ModuleClass.create(this.resourceManager);
        }
        
        return new ModuleClass();
      } catch (altError) {
        throw new Error(`Failed to load module from both ${modulePath} and ${altPath}. Primary error: ${error.message}. Alternative error: ${altError.message}`);
      }
    }
  }

  /**
   * Load a JSON-based module
   */
  async loadJsonModule(moduleConfig) {
    return await DynamicJsonModule.createFromJson(
      moduleConfig.path,
      this.monorepoRoot
    );
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
        // Continue searching
      }
      
      // Check for Legion-specific directories
      const packagesDir = path.join(currentDir, 'packages');
      try {
        const hasLegionPackages = fsSync.existsSync(path.join(packagesDir, 'tools')) ||
                                  fsSync.existsSync(path.join(packagesDir, 'aiur'));
        if (hasLegionPackages) {
          return currentDir;
        }
      } catch (error) {
        // Continue searching
      }
      
      currentDir = path.dirname(currentDir);
    }
    
    // Default to current directory
    return process.cwd();
  }
}

export default ModuleLoader;