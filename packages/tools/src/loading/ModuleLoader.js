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
import { ResourceManager } from '@legion/tools';

export class ModuleLoader {
  constructor(options = {}) {
    this.monorepoRoot = options.monorepoRoot || this.findMonorepoRoot();
    this.resourceManager = options.resourceManager;
    this.verbose = options.verbose || false;
  }

  /**
   * Initialize the loader
   */
  async initialize() {
    // Initialize ResourceManager if not provided
    if (!this.resourceManager) {
      this.resourceManager = new ResourceManager();
      await this.resourceManager.initialize();
    }
  }

  /**
   * Load all modules from the registry
   */
  async loadModules(filter = null) {
    await this.initialize();
    
    // Read the module registry
    const registryPath = path.join(this.monorepoRoot, 'packages/tools/src/loading/module-registry.json');
    const registryContent = await fs.readFile(registryPath, 'utf-8');
    let modules = JSON.parse(registryContent);
    
    // Apply filter if provided
    if (filter) {
      modules = modules.filter(m => 
        m.name.toLowerCase().includes(filter.toLowerCase())
      );
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
          loadedModules.push({
            config: moduleConfig,
            instance: module
          });
          
          if (this.verbose) {
            const tools = module.getTools ? module.getTools() : [];
            console.log(`    ✅ Loaded with ${tools.length} tools`);
          }
        }
      } catch (error) {
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