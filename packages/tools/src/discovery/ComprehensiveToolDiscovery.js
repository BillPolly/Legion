/**
 * Comprehensive Tool Discovery
 * 
 * Single-object solution for discovering and populating all modules and tools
 * in the Legion framework. Supports both clear (full refresh) and update (incremental)
 * modes for database population.
 */

import { ResourceManager } from '@legion/tools';
import { MongoDBToolRegistryProvider } from '../providers/MongoDBToolRegistryProvider.js';
import { DirectModuleDiscovery } from './DirectModuleDiscovery.js';
import { ModuleInstantiator } from './ModuleInstantiator.js';
import { ToolExtractor } from './ToolExtractor.js';
import { ToolAdapter } from './ToolAdapter.js';
import path from 'path';
import fs from 'fs';

export class ComprehensiveToolDiscovery {
  constructor() {
    // ResourceManager is a singleton - just create/get it
    this.resourceManager = new ResourceManager();
    
    // Create discovery component - use direct discovery for speed and accuracy
    this.discoveryService = new DirectModuleDiscovery({
      verbose: false,
      includeDisabled: false
    });
    
    this.instantiator = null; // Created after ResourceManager init
    this.extractor = new ToolExtractor({ verbose: false });
    this.adapter = new ToolAdapter({ verbose: false });
    
    this.provider = null;
    this.initialized = false;
  }

  /**
   * Main method to populate the database
   * @param {Object} options - Population options
   * @param {string} options.mode - 'clear' (default) or 'update'
   * @param {boolean} options.verbose - Show progress (default true)
   * @param {string} options.rootPath - Root path to search (defaults to Legion root)
   * @returns {Promise<Object>} Statistics about the population
   */
  async populateDatabase(options = {}) {
    const {
      mode = 'clear',  // 'clear' or 'update'
      verbose = true,
      rootPath = null,
      includeEmbeddings = false
    } = options;
    
    const startTime = Date.now();
    
    // Initialize if needed
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Determine root path
    const searchPath = rootPath || await this.findLegionRoot();
    
    if (verbose) {
      console.log('🚀 Comprehensive Tool Discovery');
      console.log(`📍 Root path: ${searchPath}`);
      console.log(`🔄 Mode: ${mode.toUpperCase()}`);
      console.log('');
    }
    
    // Initialize statistics
    const stats = {
      mode,
      startTime: new Date().toISOString(),
      modulesDiscovered: 0,
      modulesAdded: 0,
      modulesUpdated: 0,
      modulesSkipped: 0,
      modulesFailed: 0,
      toolsDiscovered: 0,
      toolsAdded: 0,
      toolsUpdated: 0,
      toolsSkipped: 0,
      toolsFailed: 0,
      duration: 0
    };
    
    try {
      // Handle clear mode
      if (mode === 'clear') {
        if (verbose) console.log('🗑️ Clearing existing database...');
        await this.clearDatabase();
        if (verbose) console.log('✅ Database cleared\n');
      }
      
      // Discover all modules
      if (verbose) console.log('🔍 Discovering modules...');
      const modules = await this.discoveryService.discoverModules(searchPath);
      stats.modulesDiscovered = modules.length;
      
      if (verbose) {
        console.log(`✅ Found ${modules.length} modules`);
        const stats = this.discoveryService.getStats();
        if (stats.byType) {
          const byType = stats.byType;
          console.log(`   Class: ${byType.class || 0}, JSON: ${byType.json || 0}, Definition: ${byType.definition || 0}\n`);
        } else {
          console.log(`   All modules are class-based\n`);
        }
      }
      
      // Process each module
      for (const moduleData of modules) {
        try {
          if (verbose) {
            console.log(`📦 Processing: ${moduleData.name}`);
          }
          
          // Handle module based on mode
          const moduleResult = await this.processModule(moduleData, mode, verbose);
          
          // Update statistics
          if (moduleResult.action === 'added') {
            stats.modulesAdded++;
          } else if (moduleResult.action === 'updated') {
            stats.modulesUpdated++;
          } else if (moduleResult.action === 'skipped') {
            stats.modulesSkipped++;
            if (verbose) console.log(`  ⏭️ Module unchanged, skipping tools`);
            continue; // Skip tool processing for unchanged modules
          }
          
          // Extract and process tools
          const toolResults = await this.processModuleTools(moduleData, mode, verbose);
          stats.toolsDiscovered += toolResults.discovered;
          stats.toolsAdded += toolResults.added;
          stats.toolsUpdated += toolResults.updated;
          stats.toolsSkipped += toolResults.skipped;
          stats.toolsFailed += toolResults.failed;
          
        } catch (error) {
          stats.modulesFailed++;
          if (verbose) {
            console.log(`  ❌ Failed: ${error.message}`);
          }
        }
      }
      
      // Generate embeddings if requested
      if (includeEmbeddings && this.provider.semanticSearchEnabled) {
        if (verbose) console.log('\n🤖 Generating embeddings for semantic search...');
        try {
          const embeddingResults = await this.generateEmbeddings();
          stats.embeddings = embeddingResults;
          if (verbose) console.log(`✅ Generated ${embeddingResults.generated} embeddings`);
        } catch (error) {
          if (verbose) console.log(`⚠️ Embedding generation failed: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Discovery failed:', error.message);
      throw error;
    }
    
    // Calculate duration
    stats.duration = Date.now() - startTime;
    stats.endTime = new Date().toISOString();
    
    // Print summary
    if (verbose) {
      this.printSummary(stats);
    }
    
    return stats;
  }

  /**
   * Initialize the discovery system
   */
  async initialize() {
    if (this.initialized) return;
    
    // Initialize ResourceManager
    if (!this.resourceManager.initialized) {
      await this.resourceManager.initialize();
    }
    
    // Create instantiator with ResourceManager
    this.instantiator = new ModuleInstantiator({
      resourceManager: this.resourceManager,
      verbose: false,
      fallbackStrategies: true,
      retries: 2
    });
    
    // Create database provider
    this.provider = await MongoDBToolRegistryProvider.create(
      this.resourceManager,
      { enableSemanticSearch: true }
    );
    
    this.initialized = true;
  }

  /**
   * Process a module based on mode
   */
  async processModule(moduleData, mode, verbose) {
    const result = { action: null };
    
    if (mode === 'update') {
      // Check if module exists
      const existingModule = await this.provider.getModule(moduleData.name);
      
      if (existingModule) {
        // Check if module has changed
        if (this.hasModuleChanged(existingModule, moduleData)) {
          await this.provider.saveModule(moduleData);
          result.action = 'updated';
          if (verbose) console.log(`  ↻ Updated module`);
        } else {
          result.action = 'skipped';
        }
      } else {
        // New module
        await this.provider.saveModule(moduleData);
        result.action = 'added';
        if (verbose) console.log(`  ✅ Added new module`);
      }
    } else {
      // Clear mode - just save
      await this.provider.saveModule(moduleData);
      result.action = 'added';
    }
    
    return result;
  }

  /**
   * Process tools for a module
   */
  async processModuleTools(moduleData, mode, verbose) {
    const results = {
      discovered: 0,
      added: 0,
      updated: 0,
      skipped: 0,
      failed: 0
    };
    
    try {
      // Try to instantiate the module
      const instance = await this.instantiator.instantiate(moduleData, {
        noFallback: false
      });
      
      if (!instance) {
        if (verbose) console.log(`  ⚠️ Could not instantiate module`);
        return results;
      }
      
      // Extract tools
      const tools = await this.extractor.extractTools(instance, moduleData);
      results.discovered = tools.length;
      
      if (tools.length === 0) {
        if (verbose) console.log(`  ℹ️ No tools found`);
        return results;
      }
      
      // Process each tool
      for (const tool of tools) {
        try {
          // Adapt tool to unified interface
          const adaptedTool = this.adapter.adaptTool(tool, {
            moduleName: moduleData.name,
            moduleType: moduleData.type
          });
          
          // Prepare tool data for database
          const toolData = {
            name: adaptedTool.name,
            moduleName: moduleData.name,
            moduleId: null, // Will be set by provider
            description: adaptedTool.description,
            summary: adaptedTool.description?.substring(0, 200),
            inputSchema: adaptedTool.inputSchema,
            outputSchema: adaptedTool.outputSchema,
            examples: adaptedTool.examples || [],
            tags: adaptedTool.tags || [],
            category: adaptedTool.category,
            complexity: adaptedTool.complexity || 'simple',
            permissions: adaptedTool.permissions || [],
            status: 'active'
          };
          
          if (mode === 'update') {
            // Check if tool exists
            const existingTool = await this.provider.getTool(tool.name, moduleData.name);
            
            if (existingTool) {
              if (this.hasToolChanged(existingTool, toolData)) {
                await this.provider.saveTool(toolData);
                results.updated++;
              } else {
                results.skipped++;
              }
            } else {
              await this.provider.saveTool(toolData);
              results.added++;
            }
          } else {
            // Clear mode
            await this.provider.saveTool(toolData);
            results.added++;
          }
          
        } catch (error) {
          results.failed++;
          if (verbose) {
            console.log(`    ⚠️ Tool ${tool.name} failed: ${error.message}`);
          }
        }
      }
      
      if (verbose) {
        if (mode === 'update') {
          console.log(`  🔧 Tools: ${results.added} added, ${results.updated} updated, ${results.skipped} skipped`);
        } else {
          console.log(`  🔧 Added ${results.added} tools`);
        }
      }
      
    } catch (error) {
      if (verbose) {
        console.log(`  ⚠️ Tool extraction failed: ${error.message}`);
      }
    }
    
    return results;
  }

  /**
   * Check if a module has changed
   */
  hasModuleChanged(existing, newData) {
    // Check key fields for changes
    return existing.description !== newData.description ||
           existing.version !== newData.version ||
           existing.type !== newData.type ||
           existing.path !== newData.path ||
           existing.className !== newData.className ||
           JSON.stringify(existing.dependencies || []) !== JSON.stringify(newData.dependencies || []) ||
           JSON.stringify(existing.tags || []) !== JSON.stringify(newData.tags || []);
  }

  /**
   * Check if a tool has changed
   */
  hasToolChanged(existing, newData) {
    // Check key fields for changes
    return existing.description !== newData.description ||
           existing.summary !== newData.summary ||
           JSON.stringify(existing.inputSchema) !== JSON.stringify(newData.inputSchema) ||
           JSON.stringify(existing.outputSchema) !== JSON.stringify(newData.outputSchema) ||
           JSON.stringify(existing.tags || []) !== JSON.stringify(newData.tags || []) ||
           existing.category !== newData.category ||
           existing.complexity !== newData.complexity;
  }

  /**
   * Clear the database
   */
  async clearDatabase() {
    await this.provider.databaseService.mongoProvider.delete('modules', {});
    await this.provider.databaseService.mongoProvider.delete('tools', {});
    await this.provider.databaseService.mongoProvider.delete('tool_usage', {});
  }

  /**
   * Generate embeddings for tools
   */
  async generateEmbeddings() {
    const results = { generated: 0, failed: 0 };
    
    try {
      // Get semantic search provider
      const semanticProvider = this.resourceManager.get('semanticSearchProvider');
      if (!semanticProvider) {
        // Try to create one
        const { SemanticSearchProvider } = await import('@legion/semantic-search');
        const provider = await SemanticSearchProvider.create(this.resourceManager);
        this.resourceManager.register('semanticSearchProvider', provider);
      }
      
      // Get tools without embeddings
      const toolsWithoutEmbeddings = await this.provider.getToolsWithoutEmbeddings(1000);
      
      for (const tool of toolsWithoutEmbeddings) {
        try {
          const searchText = `${tool.name} ${tool.description || ''} ${tool.summary || ''}`.trim();
          const embeddings = await semanticProvider.embeddingService.generateEmbeddings([searchText]);
          
          if (embeddings && embeddings.length > 0) {
            await this.provider.updateToolEmbedding(
              tool._id,
              embeddings[0],
              semanticProvider.useLocalEmbeddings ? 'local-onnx' : 'openai'
            );
            results.generated++;
          }
        } catch (error) {
          results.failed++;
        }
      }
    } catch (error) {
      console.error('Embedding generation setup failed:', error.message);
    }
    
    return results;
  }

  /**
   * Find the Legion root directory
   */
  async findLegionRoot() {
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          if (packageJson.name === '@legion/monorepo' || 
              (packageJson.workspaces && packageJson.workspaces.includes('packages/*'))) {
            return currentDir;
          }
        } catch (error) {
          // Invalid package.json, continue searching
        }
      }
      
      // Also check for Legion-specific directories
      const packagesDir = path.join(currentDir, 'packages');
      if (fs.existsSync(packagesDir)) {
        const hasLegionPackages = fs.existsSync(path.join(packagesDir, 'tools')) ||
                                  fs.existsSync(path.join(packagesDir, 'aiur')) ||
                                  fs.existsSync(path.join(packagesDir, 'module-loader'));
        if (hasLegionPackages) {
          return currentDir;
        }
      }
      
      currentDir = path.dirname(currentDir);
    }
    
    // Fallback to current directory
    return process.cwd();
  }

  /**
   * Print summary of the population
   */
  printSummary(stats) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 POPULATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\nMode: ${stats.mode.toUpperCase()}`);
    console.log(`Duration: ${(stats.duration / 1000).toFixed(2)} seconds`);
    
    console.log('\nModules:');
    console.log(`  Discovered: ${stats.modulesDiscovered}`);
    if (stats.mode === 'update') {
      console.log(`  Added: ${stats.modulesAdded}`);
      console.log(`  Updated: ${stats.modulesUpdated}`);
      console.log(`  Skipped: ${stats.modulesSkipped}`);
    } else {
      console.log(`  Added: ${stats.modulesAdded}`);
    }
    if (stats.modulesFailed > 0) {
      console.log(`  Failed: ${stats.modulesFailed}`);
    }
    
    console.log('\nTools:');
    console.log(`  Discovered: ${stats.toolsDiscovered}`);
    if (stats.mode === 'update') {
      console.log(`  Added: ${stats.toolsAdded}`);
      console.log(`  Updated: ${stats.toolsUpdated}`);
      console.log(`  Skipped: ${stats.toolsSkipped}`);
    } else {
      console.log(`  Added: ${stats.toolsAdded}`);
    }
    if (stats.toolsFailed > 0) {
      console.log(`  Failed: ${stats.toolsFailed}`);
    }
    
    if (stats.embeddings) {
      console.log('\nEmbeddings:');
      console.log(`  Generated: ${stats.embeddings.generated}`);
      if (stats.embeddings.failed > 0) {
        console.log(`  Failed: ${stats.embeddings.failed}`);
      }
    }
    
    // Get final database stats
    this.provider.getStats().then(dbStats => {
      console.log('\nDatabase Totals:');
      console.log(`  Modules: ${dbStats.modules}`);
      console.log(`  Tools: ${dbStats.tools}`);
      console.log('='.repeat(60));
    }).catch(() => {
      console.log('='.repeat(60));
    });
  }

  /**
   * Static method for one-line usage
   */
  static async populateDatabase(options = {}) {
    const discovery = new ComprehensiveToolDiscovery();
    return await discovery.populateDatabase(options);
  }
}

// Export as default for convenience
export default ComprehensiveToolDiscovery;