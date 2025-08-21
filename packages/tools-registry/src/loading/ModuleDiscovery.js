/**
 * Module Discovery System
 * 
 * Automatically discovers all modules in the monorepo by scanning for Module files.
 * Extracts metadata and stores in database for loading and validation.
 */

import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { MongoDBToolRegistryProvider } from '../providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ModuleDiscovery {
  constructor(options = {}) {
    this.monorepoRoot = options.monorepoRoot || this.findMonorepoRoot();
    this.resourceManager = options.resourceManager;
    this.provider = options.provider;
    this.verbose = options.verbose !== false;
    this.initialized = false;
    
    // Discovery stats
    this.stats = {
      scanned: 0,
      discovered: 0,
      registered: 0,
      updated: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * Find the monorepo root directory
   */
  findMonorepoRoot() {
    let currentPath = __dirname;
    while (currentPath !== '/') {
      const packagePath = path.join(currentPath, 'package.json');
      if (fsSync.existsSync(packagePath)) {
        try {
          const pkg = JSON.parse(fsSync.readFileSync(packagePath, 'utf-8'));
          if (pkg.workspaces) {
            return currentPath;
          }
        } catch (e) {
          // Continue searching
        }
      }
      currentPath = path.dirname(currentPath);
    }
    throw new Error('Could not find monorepo root');
  }

  /**
   * Initialize the discovery system
   */
  async initialize() {
    if (this.initialized) return;
    
    // Initialize ResourceManager
    if (!this.resourceManager) {
      this.resourceManager = ResourceManager.getInstance();
      if (!this.resourceManager.initialized) {
        await this.resourceManager.initialize();
      }
    }
    
    // Initialize database provider
    if (!this.provider) {
      this.provider = await MongoDBToolRegistryProvider.create(this.resourceManager, {
        enableSemanticSearch: false
      });
    }
    
    this.initialized = true;
  }

  /**
   * Discover all modules in the repository
   */
  async discoverAllModules() {
    await this.initialize();
    
    if (this.verbose) {
      console.log('\n🔍 Module Discovery');
      console.log('═'.repeat(60));
      console.log(`📁 Scanning from: ${this.monorepoRoot}`);
    }
    
    // Pattern to find all Module files
    const patterns = [
      'packages/**/src/**/*Module.js',
      'packages/**/src/**/*Module.mjs',
      'packages/**/module.json'
    ];
    
    const discoveredModules = [];
    
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: this.monorepoRoot,
        ignore: [
          '**/node_modules/**',
          '**/__tests__/**',
          '**/test/**',
          '**/tests/**',
          '**/*.test.js',
          '**/*.spec.js',
          '**/dist/**',
          '**/build/**'
        ]
      });
      
      if (this.verbose) {
        console.log(`\n📋 Pattern: ${pattern}`);
        console.log(`   Found ${files.length} files`);
      }
      
      for (const file of files) {
        this.stats.scanned++;
        const fullPath = path.join(this.monorepoRoot, file);
        
        try {
          const moduleInfo = await this.extractModuleInfo(fullPath);
          if (moduleInfo) {
            discoveredModules.push(moduleInfo);
            this.stats.discovered++;
            
            if (this.verbose) {
              console.log(`   ✅ ${moduleInfo.name}: ${moduleInfo.className || moduleInfo.type}`);
            }
          }
        } catch (error) {
          this.stats.failed++;
          this.stats.errors.push({
            file,
            error: error.message
          });
          
          if (this.verbose) {
            console.log(`   ❌ ${path.basename(file)}: ${error.message}`);
          }
        }
      }
    }
    
    return discoveredModules;
  }

  /**
   * Extract module information from a file
   */
  async extractModuleInfo(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const basename = path.basename(filePath);
    const relativePath = path.relative(this.monorepoRoot, filePath);
    const dirPath = path.dirname(relativePath);
    
    // Check if it's a JSON module
    if (basename === 'module.json') {
      const jsonModule = JSON.parse(content);
      return {
        name: jsonModule.name,
        type: 'json',
        path: dirPath,
        className: null,
        description: jsonModule.description || '',
        package: this.getPackageName(dirPath),
        filePath: relativePath,
        dependencies: jsonModule.dependencies || [],
        requiredEnvVars: this.extractEnvVars(JSON.stringify(jsonModule)),
        discoveredAt: new Date()
      };
    }
    
    // Extract class name from JavaScript module
    const classMatch = content.match(/export\s+(?:default\s+)?class\s+(\w+Module)/);
    const className = classMatch ? classMatch[1] : path.basename(filePath, '.js');
    
    // Extract module name
    let moduleName = className.replace(/Module$/, '');
    
    // Check for name property in constructor or static property
    const nameMatch = content.match(/this\.name\s*=\s*['"`]([^'"`]+)['"`]/);
    if (nameMatch) {
      moduleName = nameMatch[1];
    }
    
    // Extract description from comments or properties
    let description = '';
    const descMatch = content.match(/this\.description\s*=\s*['"`]([^'"`]+)['"`]/);
    if (descMatch) {
      description = descMatch[1];
    } else {
      // Try to extract from JSDoc
      const jsdocMatch = content.match(/\/\*\*[\s\S]*?\*\s*([^\n]+)/);
      if (jsdocMatch) {
        description = jsdocMatch[1].trim();
      }
    }
    
    // Extract dependencies (imports)
    const dependencies = [];
    const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
    for (const match of importMatches) {
      const dep = match[1];
      if (!dep.startsWith('.') && !dep.startsWith('/')) {
        dependencies.push(dep);
      }
    }
    
    // Extract environment variables
    const requiredEnvVars = this.extractEnvVars(content);
    
    return {
      name: moduleName,
      type: 'class',
      path: dirPath,
      className,
      description,
      package: this.getPackageName(dirPath),
      filePath: relativePath,
      dependencies: [...new Set(dependencies)],
      requiredEnvVars,
      discoveredAt: new Date()
    };
  }

  /**
   * Extract environment variables from content
   */
  extractEnvVars(content) {
    const envVars = new Set();
    
    // Pattern 1: process.env.VARIABLE
    const processEnvMatches = content.matchAll(/process\.env\.(\w+)/g);
    for (const match of processEnvMatches) {
      envVars.add(match[1]);
    }
    
    // Pattern 2: resourceManager.get('env.VARIABLE')
    const rmEnvMatches = content.matchAll(/resourceManager\.get\(['"`]env\.(\w+)['"`]\)/g);
    for (const match of rmEnvMatches) {
      envVars.add(match[1]);
    }
    
    // Pattern 3: Common API key patterns
    const apiKeyPatterns = [
      /OPENAI_API_KEY/g,
      /ANTHROPIC_API_KEY/g,
      /GITHUB_PAT/g,
      /GITHUB_TOKEN/g,
      /SERPER_API_KEY/g,
      /RAILWAY_API_TOKEN/g,
      /MONGODB_URL/g
    ];
    
    for (const pattern of apiKeyPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        envVars.add(match[0]);
      }
    }
    
    return Array.from(envVars);
  }

  /**
   * Get package name from path
   */
  getPackageName(dirPath) {
    const parts = dirPath.split(path.sep);
    const packagesIndex = parts.indexOf('packages');
    
    if (packagesIndex !== -1 && packagesIndex < parts.length - 1) {
      const packageName = parts[packagesIndex + 1];
      return `@legion/${packageName}`;
    }
    
    return '@legion/unknown';
  }

  /**
   * Register discovered modules in the database
   * Saves to both module_registry (permanent) and modules (runtime state)
   */
  async registerModules(modules) {
    await this.initialize();
    
    if (this.verbose) {
      console.log('\n📝 Registering Modules in Database');
      console.log('━'.repeat(50));
    }
    
    for (const moduleInfo of modules) {
      try {
        // STEP 1: Save to module_registry (permanent storage)
        // This is NEVER cleared during normal operations
        const registryEntry = {
          name: moduleInfo.name,
          type: moduleInfo.type,
          path: moduleInfo.path,
          className: moduleInfo.className,
          filePath: moduleInfo.filePath,
          package: moduleInfo.package,
          description: moduleInfo.description,
          dependencies: moduleInfo.dependencies,
          requiredEnvVars: moduleInfo.requiredEnvVars,
          loadable: true,
          discoveredAt: new Date(),
          lastValidatedAt: new Date()
        };
        
        // Check if already in registry
        const existingRegistry = await this.provider.databaseService.mongoProvider.findOne('module_registry', {
          name: moduleInfo.name,
          className: moduleInfo.className,
          filePath: moduleInfo.filePath
        });
        
        if (existingRegistry) {
          // Update registry entry
          await this.provider.databaseService.mongoProvider.update(
            'module_registry',
            { _id: existingRegistry._id },
            { $set: { ...registryEntry, discoveredAt: existingRegistry.discoveredAt } }
          );
        } else {
          // Create new registry entry
          await this.provider.databaseService.mongoProvider.insert('module_registry', registryEntry);
        }
        
        // STEP 2: Save to modules collection (runtime state)
        // This gets cleared and reloaded from module_registry
        const existing = await this.provider.databaseService.mongoProvider.findOne('modules', {
          name: moduleInfo.name,
          className: moduleInfo.className,
          filePath: moduleInfo.filePath
        });
        
        if (existing) {
          // Update existing module, preserving loading/indexing status
          const updates = {
            ...moduleInfo,
            updatedAt: new Date(),
            
            // Preserve existing discovery status
            discoveryStatus: 'discovered',
            discoveredAt: existing.discoveredAt || new Date(),
            
            // Preserve existing loading/indexing status
            loadingStatus: existing.loadingStatus || 'pending',
            lastLoadedAt: existing.lastLoadedAt,
            loadingError: existing.loadingError,
            
            indexingStatus: existing.indexingStatus || 'pending',
            lastIndexedAt: existing.lastIndexedAt,
            indexingError: existing.indexingError,
            
            // Preserve counts
            toolCount: existing.toolCount || 0,
            perspectiveCount: existing.perspectiveCount || 0,
            
            // Preserve validation status
            validationStatus: existing.validationStatus || 'pending',
            loadable: existing.loadable !== false
          };
          
          await this.provider.databaseService.mongoProvider.update(
            'modules',
            { _id: existing._id },
            { $set: updates }
          );
          
          this.stats.updated++;
          
          if (this.verbose) {
            console.log(`   📝 Updated: ${moduleInfo.name}`);
          }
        } else {
          // Create new module entry with status tracking
          const newModule = {
            ...moduleInfo,
            // Discovery status
            discoveryStatus: 'discovered',
            discoveredAt: new Date(),
            
            // Loading status
            loadingStatus: 'pending',
            lastLoadedAt: null,
            loadingError: null,
            
            // Indexing status
            indexingStatus: 'pending',
            lastIndexedAt: null,
            indexingError: null,
            
            // Validation status (legacy, kept for compatibility)
            validationStatus: 'pending',
            validationErrors: [],
            validationDate: null,
            
            // Counts
            toolCount: 0,
            perspectiveCount: 0,
            
            // Flags
            loadable: true,
            executionStatus: 'untested',
            lastTestedDate: null,
            
            // Timestamps
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          await this.provider.databaseService.mongoProvider.insert('modules', newModule);
          
          this.stats.registered++;
          
          if (this.verbose) {
            console.log(`   ✅ Registered: ${moduleInfo.name}`);
          }
        }
      } catch (error) {
        this.stats.failed++;
        this.stats.errors.push({
          module: moduleInfo.name,
          error: error.message
        });
        
        if (this.verbose) {
          console.log(`   ❌ Failed: ${moduleInfo.name} - ${error.message}`);
        }
      }
    }
    
    return this.stats;
  }

  /**
   * Complete discovery pipeline
   */
  async discover() {
    const modules = await this.discoverAllModules();
    const stats = await this.registerModules(modules);
    
    if (this.verbose) {
      console.log('\n📊 Discovery Summary');
      console.log('═'.repeat(50));
      console.log(`📁 Files scanned: ${stats.scanned}`);
      console.log(`🔍 Modules discovered: ${stats.discovered}`);
      console.log(`✅ New registrations: ${stats.registered}`);
      console.log(`📝 Updates: ${stats.updated}`);
      console.log(`❌ Failures: ${stats.failed}`);
      
      if (stats.errors.length > 0) {
        console.log('\n⚠️ Errors:');
        stats.errors.slice(0, 5).forEach(err => {
          console.log(`   - ${err.module || err.file}: ${err.error}`);
        });
      }
    }
    
    return {
      modules,
      stats
    };
  }
}

// Export singleton instance for convenience
export const moduleDiscovery = new ModuleDiscovery();
export default moduleDiscovery;