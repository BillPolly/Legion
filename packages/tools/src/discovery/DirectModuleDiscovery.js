/**
 * Direct Module Discovery
 * 
 * A fast, direct module discovery system that uses a curated list of known modules
 * instead of filesystem scanning. This ensures we only get legitimate modules.
 */

import path from 'path';
import fs from 'fs/promises';
import { getKnownModules } from './KnownModules.js';

export class DirectModuleDiscovery {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      includeDisabled: options.includeDisabled || false,
      ...options
    };
    
    this.discoveredModules = [];
    this.errors = [];
  }

  /**
   * Discover all known modules
   */
  async discoverModules(rootPath) {
    this.discoveredModules = [];
    this.errors = [];
    
    if (this.options.verbose) {
      console.log(`🔍 Starting direct module discovery from: ${rootPath}`);
    }
    
    const knownModules = getKnownModules();
    
    for (const moduleInfo of knownModules) {
      try {
        const fullPath = path.join(rootPath, moduleInfo.path);
        
        // Check if the file exists
        try {
          await fs.access(fullPath);
        } catch {
          if (this.options.verbose) {
            console.log(`  ⚠️ Module file not found: ${moduleInfo.path}`);
          }
          this.errors.push({
            module: moduleInfo.name,
            error: 'File not found',
            path: fullPath
          });
          continue;
        }
        
        // Read and analyze the module
        const content = await fs.readFile(fullPath, 'utf-8');
        
        // Check if it's a valid module
        const hasModule = content.includes('export default class') ||
                         content.includes('export { default }') ||
                         content.includes('export default {') ||
                         content.includes('module.exports');
        
        if (!hasModule && !moduleInfo.path.endsWith('index.js')) {
          if (this.options.verbose) {
            console.log(`  ⚠️ No module exports found in: ${moduleInfo.name}`);
          }
          continue;
        }
        
        // Check for getTools method or tools export
        const hasGetTools = content.includes('getTools()') || 
                          content.includes('getTools() {') ||
                          content.includes('export const tools') ||
                          content.includes('this.tools =');
        
        // Check for factory method
        const hasFactory = content.includes('static async create') ||
                          content.includes('static create(');
        
        // Check if needs ResourceManager (for informational purposes only)
        const needsResourceManager = content.includes('resourceManager') ||
                                    content.includes('ResourceManager') ||
                                    hasFactory;
        
        // Create module data
        const moduleData = {
          name: moduleInfo.name,
          type: 'class',
          path: fullPath,
          relativePath: moduleInfo.path,
          className: moduleInfo.className,
          baseClass: this.extractBaseClass(content),
          description: moduleInfo.description,
          package: moduleInfo.package,
          hasFactory,
          hasGetTools,
          needsResourceManager,
          dependencies: this.extractDependencies(content),
          metadata: {
            fileName: path.basename(fullPath),
            dirName: path.basename(path.dirname(fullPath)),
            knownModule: true
          }
        };
        
        this.discoveredModules.push(moduleData);
        
        if (this.options.verbose) {
          console.log(`  ✅ Found module: ${moduleInfo.name}`);
          if (hasGetTools) {
            console.log(`     - Has getTools() method`);
          }
          if (hasFactory) {
            console.log(`     - Has factory method`);
          }
        }
        
      } catch (error) {
        this.errors.push({
          module: moduleInfo.name,
          error: error.message,
          path: moduleInfo.path
        });
        
        if (this.options.verbose) {
          console.log(`  ❌ Error processing ${moduleInfo.name}: ${error.message}`);
        }
      }
    }
    
    if (this.options.verbose) {
      console.log(`\n✅ Direct discovery complete: ${this.discoveredModules.length} modules found`);
      if (this.errors.length > 0) {
        console.log(`⚠️ ${this.errors.length} modules had errors`);
      }
    }
    
    return this.discoveredModules;
  }

  /**
   * Extract base class from content
   */
  extractBaseClass(content) {
    const match = content.match(/export\s+(?:default\s+)?class\s+\w+\s+extends\s+(\w+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract dependencies from code
   */
  extractDependencies(content) {
    const dependencies = new Set();
    
    // Import statements
    const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      // Only include external dependencies
      if (!match[1].startsWith('.') && !match[1].startsWith('/')) {
        dependencies.add(match[1]);
      }
    }
    
    // Require statements
    const requireMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
    for (const match of requireMatches) {
      if (!match[1].startsWith('.') && !match[1].startsWith('/')) {
        dependencies.add(match[1]);
      }
    }
    
    return Array.from(dependencies);
  }

  /**
   * Get discovered modules
   */
  getDiscoveredModules() {
    return this.discoveredModules;
  }

  /**
   * Get discovery errors
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Get discovery statistics
   */
  getStats() {
    const modules = this.getDiscoveredModules();
    
    return {
      total: modules.length,
      withFactory: modules.filter(m => m.hasFactory).length,
      withTools: modules.filter(m => m.hasGetTools).length,
      needsResourceManager: modules.filter(m => m.needsResourceManager).length,
      byPackage: modules.reduce((acc, m) => {
        acc[m.package] = (acc[m.package] || 0) + 1;
        return acc;
      }, {}),
      errors: this.errors.length
    };
  }
}