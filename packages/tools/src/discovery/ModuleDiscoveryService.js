/**
 * Module Discovery Service
 * 
 * Simple service that returns modules from the known modules list.
 * No filesystem scanning - all modules are pre-defined in KnownModules.js
 */

import { getKnownModules, getModuleFullPath } from './KnownModules.js';
import path from 'path';
import fs from 'fs/promises';

export class ModuleDiscoveryService {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      includeDisabled: options.includeDisabled || false,
      ...options
    };
    
    this.discoveredModules = new Map();
    this.errors = [];
    this.monorepoRoot = null;
  }

  /**
   * Discover all modules from the known modules list
   * @param {string} rootPath - Root path for the monorepo (will be auto-detected if not provided)
   * @returns {Promise<Array>} Array of module definitions
   */
  async discoverModules(rootPath) {
    this.monorepoRoot = rootPath || await this.findMonorepoRoot();
    this.discoveredModules.clear();
    this.errors = [];
    
    if (this.options.verbose) {
      console.log(`🔍 Module Discovery Service`);
      console.log(`📍 Monorepo root: ${this.monorepoRoot}`);
    }
    
    // Get all known modules
    const knownModules = getKnownModules();
    
    if (this.options.verbose) {
      console.log(`📋 Processing ${knownModules.length} known modules...`);
    }
    
    // Process each module
    for (const module of knownModules) {
      try {
        const moduleData = await this.processKnownModule(module);
        if (moduleData) {
          this.discoveredModules.set(moduleData.name, moduleData);
        }
      } catch (error) {
        this.errors.push({
          module: module.name,
          error: error.message
        });
        if (this.options.verbose) {
          console.log(`  ⚠️ Failed to process ${module.name}: ${error.message}`);
        }
      }
    }
    
    if (this.options.verbose) {
      console.log(`✅ Discovered ${this.discoveredModules.size} modules`);
      if (this.errors.length > 0) {
        console.log(`⚠️ ${this.errors.length} modules had errors`);
      }
    }
    
    return Array.from(this.discoveredModules.values());
  }

  /**
   * Process a known module definition
   */
  async processKnownModule(knownModule) {
    const fullPath = getModuleFullPath(knownModule, this.monorepoRoot);
    
    // Check if the module file exists
    try {
      await fs.access(fullPath);
    } catch (error) {
      if (this.options.verbose) {
        console.log(`  ⚠️ Module file not found: ${fullPath}`);
      }
      if (!this.options.includeDisabled) {
        return null;
      }
    }
    
    // Build module data in the format expected by the rest of the system
    const moduleData = {
      name: knownModule.name,
      type: knownModule.type === 'json' ? 'module.json' : 'class',
      path: fullPath,
      relativePath: knownModule.path,
      className: knownModule.className,
      package: knownModule.package,
      description: knownModule.description,
      tags: knownModule.tags || [],
      category: knownModule.category,
      version: knownModule.version || '1.0.0',
      status: 'active',
      source: 'known-modules'
    };
    
    // For JSON modules, add the module.json path
    if (knownModule.type === 'json') {
      moduleData.moduleJsonPath = knownModule.moduleJsonPath 
        ? path.join(this.monorepoRoot, knownModule.moduleJsonPath)
        : fullPath;
    }
    
    return moduleData;
  }

  /**
   * Find the monorepo root directory
   */
  async findMonorepoRoot() {
    // First check for MONOREPO_ROOT in environment (via ResourceManager if available)
    try {
      const { ResourceManager } = await import('@legion/tools');
      const rm = new ResourceManager();
      await rm.initialize();
      const monorepoName = rm.get('env.MONOREPO_ROOT');
      
      if (monorepoName) {
        // Search for a directory with this name
        let currentDir = process.cwd();
        
        while (currentDir !== path.dirname(currentDir)) {
          const baseName = path.basename(currentDir);
          if (baseName === monorepoName) {
            return currentDir;
          }
          currentDir = path.dirname(currentDir);
        }
      }
    } catch (error) {
      // ResourceManager not available, continue with fallback
    }
    
    // Fallback: search for monorepo structure
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      
      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
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
        await fs.access(packagesDir);
        const hasLegionPackages = 
          await this.exists(path.join(packagesDir, 'tools')) ||
          await this.exists(path.join(packagesDir, 'aiur')) ||
          await this.exists(path.join(packagesDir, 'module-loader'));
        if (hasLegionPackages) {
          return currentDir;
        }
      } catch (error) {
        // Directory doesn't exist, continue
      }
      
      currentDir = path.dirname(currentDir);
    }
    
    // Last resort: return current directory
    return process.cwd();
  }

  /**
   * Check if a path exists
   */
  async exists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get discovery statistics
   */
  getStats() {
    const modules = Array.from(this.discoveredModules.values());
    const byType = {};
    const byPackage = {};
    const byStatus = {};
    
    modules.forEach(module => {
      // Count by type
      const type = module.type === 'module.json' ? 'json' : 'class';
      byType[type] = (byType[type] || 0) + 1;
      
      // Count by package
      if (module.package) {
        byPackage[module.package] = (byPackage[module.package] || 0) + 1;
      }
      
      // Count by status
      const status = module.status || 'unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });
    
    return {
      total: modules.length,
      byType,
      byPackage,
      byStatus,
      errors: this.errors.length
    };
  }

  /**
   * Get all discovered modules
   */
  getModules() {
    return Array.from(this.discoveredModules.values());
  }

  /**
   * Get a specific module by name
   */
  getModule(name) {
    return this.discoveredModules.get(name);
  }

  /**
   * Get errors encountered during discovery
   */
  getErrors() {
    return this.errors;
  }
}