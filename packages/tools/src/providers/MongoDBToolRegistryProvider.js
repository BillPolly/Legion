/**
 * MongoDB Tool Registry Provider
 * 
 * MongoDB implementation of the Tool Registry Provider interface.
 * Uses the Legion storage package for database operations and provides
 * advanced features like semantic search, usage tracking, and real-time updates.
 */

import { IToolRegistryProvider, PROVIDER_CAPABILITIES } from './IToolRegistryProvider.js';
import { ToolRegistryDatabaseService } from '../database/ToolRegistryDatabaseService.js';

export class MongoDBToolRegistryProvider extends IToolRegistryProvider {
  /**
   * Private constructor - use create() factory method
   */
  constructor(dependencies) {
    if (!dependencies?._factoryCall) {
      throw new Error('MongoDBToolRegistryProvider must be created using create() factory method');
    }

    super(dependencies.config || {});
    
    this.resourceManager = dependencies.resourceManager;
    this.databaseService = dependencies.databaseService;
    this.semanticSearchEnabled = dependencies.semanticSearchEnabled || false;
  }

  /**
   * Async factory method following Legion ResourceManager pattern
   */
  static async create(resourceManager, options = {}) {
    if (!resourceManager?.initialized) {
      throw new Error('MongoDBToolRegistryProvider requires initialized ResourceManager');
    }

    console.log('🗄️ Creating MongoDB Tool Registry Provider...');

    // Initialize database service
    const databaseService = await ToolRegistryDatabaseService.create(resourceManager);

    const provider = new MongoDBToolRegistryProvider({
      _factoryCall: true,
      resourceManager,
      databaseService,
      semanticSearchEnabled: options.enableSemanticSearch !== false,
      config: {
        cacheTimeout: options.cacheTimeout || 300000, // 5 minutes
        batchSize: options.batchSize || 100,
        ...options
      }
    });

    await provider.initialize();
    return provider;
  }

  /**
   * Initialize the provider
   */
  async initialize() {
    if (this.initialized) return;

    console.log('📋 Initializing MongoDB Tool Registry Provider...');

    // Database service is already initialized
    this.initialized = true;
    this.connected = this.databaseService.mongoProvider.connected;

    console.log('✅ MongoDB Tool Registry Provider initialized');
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    if (this.connected) return;
    
    if (!this.databaseService.mongoProvider.connected) {
      await this.databaseService.mongoProvider.connect();
    }
    
    this.connected = true;
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    if (!this.connected) return;
    
    await this.databaseService.cleanup();
    this.connected = false;
  }

  // ============================================================================
  // MODULE OPERATIONS
  // ============================================================================

  /**
   * Get module by name
   */
  async getModule(name) {
    if (!this.connected) await this.connect();
    return await this.databaseService.getModuleByName(name);
  }

  /**
   * List all modules with optional filtering
   */
  async listModules(options = {}) {
    if (!this.connected) await this.connect();
    return await this.databaseService.listModules(options);
  }

  /**
   * Save or update a module
   */
  async saveModule(moduleData) {
    if (!this.connected) await this.connect();
    
    // Ensure required fields
    const processedData = {
      name: moduleData.name,
      description: moduleData.description || `${moduleData.name} module`,
      version: moduleData.version || '1.0.0',
      type: moduleData.type || 'class',
      path: moduleData.path || 'dynamic',
      className: moduleData.className,
      dependencies: moduleData.dependencies || [],
      tags: moduleData.tags || [moduleData.name],
      category: moduleData.category || this.inferModuleCategory(moduleData.name),
      config: moduleData.config || {},
      status: moduleData.status || 'active',
      ...moduleData
    };

    return await this.databaseService.upsertModule(processedData);
  }

  /**
   * Delete a module
   */
  async deleteModule(name) {
    if (!this.connected) await this.connect();
    
    const module = await this.getModule(name);
    if (!module) return false;
    
    await this.databaseService.deleteModule(module._id);
    return true;
  }

  /**
   * Search modules by text
   */
  async searchModules(searchText, options = {}) {
    if (!this.connected) await this.connect();
    return await this.databaseService.searchModules(searchText, options);
  }

  // ============================================================================
  // TOOL OPERATIONS
  // ============================================================================

  /**
   * Get tool by name
   */
  async getTool(toolName, moduleName = null) {
    if (!this.connected) await this.connect();
    return await this.databaseService.getToolByName(toolName, moduleName);
  }

  /**
   * List tools with optional filtering
   */
  async listTools(options = {}) {
    if (!this.connected) await this.connect();
    return await this.databaseService.listTools(options);
  }

  /**
   * Save or update a tool
   */
  async saveTool(toolData) {
    if (!this.connected) await this.connect();
    
    // Ensure moduleId is set
    if (!toolData.moduleId && toolData.moduleName) {
      const module = await this.getModule(toolData.moduleName);
      if (module) {
        toolData.moduleId = module._id;
      }
    }

    // Process tool data
    const processedData = {
      name: toolData.name,
      moduleId: toolData.moduleId,
      moduleName: toolData.moduleName,
      description: toolData.description || `${toolData.name} tool`,
      summary: toolData.summary || toolData.description?.substring(0, 200),
      inputSchema: toolData.inputSchema || toolData.schema,
      outputSchema: toolData.outputSchema,
      examples: toolData.examples || [],
      tags: toolData.tags || this.inferToolTags(toolData.name, toolData.description),
      category: toolData.category || this.inferToolCategory(toolData.name),
      complexity: toolData.complexity || 'simple',
      permissions: toolData.permissions || [],
      status: toolData.status || 'active',
      ...toolData
    };

    return await this.databaseService.upsertTool(processedData);
  }

  /**
   * Delete a tool
   */
  async deleteTool(toolName, moduleName) {
    if (!this.connected) await this.connect();
    
    const tool = await this.getTool(toolName, moduleName);
    if (!tool) return false;
    
    await this.databaseService.mongoProvider.delete('tools', { _id: tool._id });
    
    // Update module tool count
    await this.databaseService.mongoProvider.update(
      'modules',
      { _id: tool.moduleId },
      { $inc: { toolCount: -1 } }
    );
    
    return true;
  }

  /**
   * Search tools by text
   */
  async searchTools(searchText, options = {}) {
    if (!this.connected) await this.connect();
    return await this.databaseService.searchTools(searchText, options);
  }

  /**
   * Find similar tools using semantic search
   */
  async findSimilarTools(embedding, options = {}) {
    if (!this.connected) await this.connect();
    if (!this.hasCapability(PROVIDER_CAPABILITIES.SEMANTIC_SEARCH)) {
      return [];
    }
    
    return await this.databaseService.findSimilarTools(embedding, options);
  }

  /**
   * Update tool embedding
   */
  async updateToolEmbedding(toolId, embedding, model) {
    if (!this.connected) await this.connect();
    if (!this.hasCapability(PROVIDER_CAPABILITIES.SEMANTIC_SEARCH)) {
      return true;
    }
    
    const result = await this.databaseService.updateToolEmbedding(toolId, embedding, model);
    return result.modifiedCount > 0;
  }

  /**
   * Get tools without embeddings
   */
  async getToolsWithoutEmbeddings(limit = 100) {
    if (!this.connected) await this.connect();
    if (!this.hasCapability(PROVIDER_CAPABILITIES.SEMANTIC_SEARCH)) {
      return [];
    }
    
    return await this.databaseService.getToolsWithoutEmbeddings(limit);
  }

  // ============================================================================
  // USAGE TRACKING
  // ============================================================================

  /**
   * Record tool usage
   */
  async recordUsage(usageData) {
    if (!this.connected) await this.connect();
    if (!this.hasCapability(PROVIDER_CAPABILITIES.USAGE_TRACKING)) {
      return;
    }
    
    // Get tool ID if not provided
    if (!usageData.toolId && usageData.toolName && usageData.moduleName) {
      const tool = await this.getTool(usageData.toolName, usageData.moduleName);
      if (tool) {
        usageData.toolId = tool._id;
      }
    }
    
    const processedData = {
      toolId: usageData.toolId,
      toolName: usageData.toolName,
      moduleName: usageData.moduleName,
      sessionId: usageData.sessionId || 'system',
      userId: usageData.userId,
      timestamp: usageData.timestamp || new Date(),
      executionTime: usageData.executionTime,
      success: usageData.success !== false,
      errorType: usageData.errorType,
      inputSize: usageData.inputSize,
      outputSize: usageData.outputSize,
      context: usageData.context,
      feedback: usageData.feedback
    };
    
    await this.databaseService.recordToolUsage(processedData);
  }

  /**
   * Get usage statistics for a tool
   */
  async getUsageStats(toolName, moduleName, options = {}) {
    if (!this.connected) await this.connect();
    if (!this.hasCapability(PROVIDER_CAPABILITIES.USAGE_TRACKING)) {
      return {
        totalUsage: 0,
        successfulUsage: 0,
        averageExecutionTime: null,
        lastUsed: null
      };
    }
    
    const tool = await this.getTool(toolName, moduleName);
    if (!tool) {
      return {
        totalUsage: 0,
        successfulUsage: 0,
        averageExecutionTime: null,
        lastUsed: null
      };
    }
    
    return await this.databaseService.getToolUsageStats(tool._id, options);
  }

  /**
   * Get trending tools
   */
  async getTrendingTools(options = {}) {
    if (!this.connected) await this.connect();
    if (!this.hasCapability(PROVIDER_CAPABILITIES.USAGE_TRACKING)) {
      return [];
    }
    
    return await this.databaseService.getTrendingTools(options);
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Save multiple modules in batch
   */
  async saveModules(modules) {
    if (!this.connected) await this.connect();
    
    const results = [];
    
    for (const moduleData of modules) {
      try {
        const result = await this.saveModule(moduleData);
        results.push({ success: true, module: result });
      } catch (error) {
        results.push({ success: false, error: error.message, moduleData });
      }
    }
    
    return results;
  }

  /**
   * Save multiple tools in batch
   */
  async saveTools(tools) {
    if (!this.connected) await this.connect();
    
    const results = [];
    
    for (const toolData of tools) {
      try {
        const result = await this.saveTool(toolData);
        results.push({ success: true, tool: result });
      } catch (error) {
        results.push({ success: false, error: error.message, toolData });
      }
    }
    
    return results;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get provider statistics
   */
  async getStats() {
    if (!this.connected) await this.connect();
    return await this.databaseService.getDatabaseStats();
  }

  /**
   * Health check
   */
  async healthCheck() {
    const baseHealth = await super.healthCheck();
    
    if (!this.connected) {
      return { ...baseHealth, status: 'disconnected' };
    }
    
    try {
      const dbHealth = await this.databaseService.healthCheck();
      return {
        ...baseHealth,
        status: dbHealth.status,
        database: dbHealth.database,
        stats: dbHealth.stats
      };
    } catch (error) {
      return {
        ...baseHealth,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    const capabilities = [
      PROVIDER_CAPABILITIES.MODULES,
      PROVIDER_CAPABILITIES.TOOLS,
      PROVIDER_CAPABILITIES.SEARCH,
      PROVIDER_CAPABILITIES.USAGE_TRACKING,
      PROVIDER_CAPABILITIES.TRANSACTIONS
    ];

    if (this.semanticSearchEnabled) {
      capabilities.push(PROVIDER_CAPABILITIES.SEMANTIC_SEARCH);
    }

    return capabilities;
  }

  // ============================================================================
  // INFERENCE HELPERS
  // ============================================================================

  /**
   * Infer module category from name
   */
  inferModuleCategory(moduleName) {
    const name = moduleName.toLowerCase();
    if (name.includes('file') || name.includes('fs')) return 'filesystem';
    if (name.includes('http') || name.includes('network') || name.includes('api')) return 'network';
    if (name.includes('ai') || name.includes('llm')) return 'ai';
    if (name.includes('test')) return 'testing';
    if (name.includes('deploy')) return 'deployment';
    if (name.includes('data') || name.includes('json')) return 'data';
    if (name.includes('storage') || name.includes('db')) return 'storage';
    return 'utility';
  }

  /**
   * Infer tool category from name
   */
  inferToolCategory(toolName) {
    const name = toolName.toLowerCase();
    if (name.includes('read') || name.includes('get') || name.includes('find')) return 'read';
    if (name.includes('write') || name.includes('create') || name.includes('save')) return 'write';
    if (name.includes('delete') || name.includes('remove')) return 'delete';
    if (name.includes('update') || name.includes('modify')) return 'update';
    if (name.includes('execute') || name.includes('run') || name.includes('command')) return 'execute';
    if (name.includes('search') || name.includes('query')) return 'search';
    if (name.includes('transform') || name.includes('convert')) return 'transform';
    if (name.includes('validate') || name.includes('check')) return 'validate';
    if (name.includes('generate') || name.includes('build')) return 'generate';
    return 'other';
  }

  /**
   * Infer tool tags from name and description
   */
  inferToolTags(toolName, description = '') {
    const tags = [];
    const text = `${toolName} ${description}`.toLowerCase();
    
    if (text.includes('file')) tags.push('file');
    if (text.includes('directory') || text.includes('folder')) tags.push('directory');
    if (text.includes('json')) tags.push('json');
    if (text.includes('command') || text.includes('bash')) tags.push('command');
    if (text.includes('search')) tags.push('search');
    if (text.includes('http') || text.includes('api')) tags.push('network');
    if (text.includes('database') || text.includes('db')) tags.push('database');
    if (text.includes('ai') || text.includes('llm')) tags.push('ai');
    
    // Add category as tag
    const category = this.inferToolCategory(toolName);
    if (category !== 'other') {
      tags.push(category);
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }

  // ============================================================================
  // DATABASE POPULATION
  // ============================================================================

  /**
   * Populate database with all tools and modules found in the repository
   * This method clears existing data and rediscovers all modules and tools
   * @param {Object} options - Population options
   * @returns {Promise<Object>} - Population results
   */
  async populateDatabase(options = {}) {
    const {
      clearExisting = true,
      includeEmbeddings = true,
      verbose = true,
      dryRun = false
    } = options;

    if (!this.connected) await this.connect();

    const results = {
      modules: { discovered: 0, saved: 0, errors: [] },
      tools: { discovered: 0, saved: 0, errors: [] },
      embeddings: { generated: 0, errors: [] },
      startTime: new Date(),
      endTime: null
    };

    try {
      if (verbose) console.log('🔄 Starting database population...');

      // Step 1: Clear existing data if requested
      if (clearExisting && !dryRun) {
        if (verbose) console.log('🗑️ Clearing existing database collections...');
        await this.databaseService.mongoProvider.delete('modules', {});
        await this.databaseService.mongoProvider.delete('tools', {});
        await this.databaseService.mongoProvider.delete('tool_usage', {});
        if (verbose) console.log('✅ Database cleared');
      }

      // Step 2: Discover all modules in the repository
      if (verbose) console.log('🔍 Discovering modules in repository...');
      const discoveredModules = await this._discoverModules();
      results.modules.discovered = discoveredModules.length;
      
      if (verbose) console.log(`📦 Found ${discoveredModules.length} modules`);

      // Step 3: Save discovered modules
      if (!dryRun) {
        if (verbose) console.log('💾 Saving modules to database...');
        
        for (const moduleData of discoveredModules) {
          try {
            await this.saveModule(moduleData);
            results.modules.saved++;
            if (verbose) console.log(`  ✅ Saved module: ${moduleData.name}`);
          } catch (error) {
            results.modules.errors.push({
              module: moduleData.name,
              error: error.message
            });
            if (verbose) console.log(`  ❌ Failed to save module ${moduleData.name}: ${error.message}`);
          }
        }
      }

      // Step 4: Discover all tools from saved modules
      if (verbose) console.log('🔧 Discovering tools from modules...');
      const discoveredTools = await this._discoverTools(discoveredModules);
      results.tools.discovered = discoveredTools.length;
      
      if (verbose) console.log(`🛠️ Found ${discoveredTools.length} tools`);

      // Step 5: Save discovered tools
      if (!dryRun) {
        if (verbose) console.log('💾 Saving tools to database...');
        
        for (const toolData of discoveredTools) {
          try {
            await this.saveTool(toolData);
            results.tools.saved++;
            if (verbose) console.log(`  ✅ Saved tool: ${toolData.name} (${toolData.moduleName})`);
          } catch (error) {
            results.tools.errors.push({
              tool: toolData.name,
              module: toolData.moduleName,
              error: error.message
            });
            if (verbose) console.log(`  ❌ Failed to save tool ${toolData.name}: ${error.message}`);
          }
        }
      }

      // Step 6: Generate embeddings for semantic search if enabled
      if (includeEmbeddings && this.semanticSearchEnabled && !dryRun) {
        if (verbose) console.log('🤖 Generating embeddings for semantic search...');
        try {
          const embeddingResults = await this._generateToolEmbeddings();
          results.embeddings = embeddingResults;
          if (verbose) console.log(`✅ Generated ${embeddingResults.generated} embeddings`);
        } catch (error) {
          results.embeddings.errors.push({
            phase: 'generation',
            error: error.message
          });
          if (verbose) console.log(`⚠️ Embedding generation failed: ${error.message}`);
        }
      }

      results.endTime = new Date();
      const duration = results.endTime - results.startTime;

      if (verbose) {
        console.log('\n📊 Population Results:');
        console.log(`  Modules: ${results.modules.saved}/${results.modules.discovered} saved`);
        console.log(`  Tools: ${results.tools.saved}/${results.tools.discovered} saved`);
        if (includeEmbeddings && this.semanticSearchEnabled) {
          console.log(`  Embeddings: ${results.embeddings.generated} generated`);
        }
        console.log(`  Duration: ${Math.round(duration / 1000)}s`);
        
        if (results.modules.errors.length > 0) {
          console.log(`  Module errors: ${results.modules.errors.length}`);
        }
        if (results.tools.errors.length > 0) {
          console.log(`  Tool errors: ${results.tools.errors.length}`);
        }
        if (dryRun) {
          console.log('  (Dry run - no data was actually saved)');
        }
      }

      return results;

    } catch (error) {
      results.endTime = new Date();
      results.error = error.message;
      
      if (verbose) {
        console.error('❌ Database population failed:', error.message);
      }
      
      throw error;
    }
  }

  /**
   * Discover all modules in the repository
   * @private
   */
  async _discoverModules() {
    const modules = [];
    const fs = await import('fs/promises');
    const path = await import('path');

    // Get the Legion root directory
    const legionRoot = await this._findLegionRoot();
    const packagesDir = path.join(legionRoot, 'packages');

    try {
      const packageDirs = await fs.readdir(packagesDir);
      
      for (const packageName of packageDirs) {
        const packagePath = path.join(packagesDir, packageName);
        
        try {
          const stats = await fs.stat(packagePath);
          if (!stats.isDirectory()) continue;

          // Look for package.json to get basic info
          const packageJsonPath = path.join(packagePath, 'package.json');
          let packageInfo = null;
          
          try {
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
            packageInfo = JSON.parse(packageJsonContent);
          } catch (error) {
            // No package.json or invalid JSON, skip this package
            continue;
          }

          // Look for modules in src directory
          const srcDir = path.join(packagePath, 'src');
          
          try {
            await fs.access(srcDir);
            const moduleFiles = await this._findModuleFiles(srcDir);
            
            for (const moduleFile of moduleFiles) {
              const moduleData = await this._analyzeModuleFile(moduleFile, packageInfo);
              if (moduleData) {
                modules.push(moduleData);
              }
            }
          } catch (error) {
            // No src directory, look for direct module files
            const directModules = await this._findModuleFiles(packagePath);
            
            for (const moduleFile of directModules) {
              const moduleData = await this._analyzeModuleFile(moduleFile, packageInfo);
              if (moduleData) {
                modules.push(moduleData);
              }
            }
          }

        } catch (error) {
          console.warn(`⚠️ Error processing package ${packageName}:`, error.message);
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Error reading packages directory:', error.message);
    }

    return modules;
  }

  /**
   * Discover all tools from the discovered modules
   * @private
   */
  async _discoverTools(modules) {
    const tools = [];
    
    for (const moduleData of modules) {
      try {
        // Try to instantiate the module to get its tools
        let moduleInstance = null;
        
        try {
          if (moduleData.className && moduleData.path !== 'dynamic') {
            // Try to import the module class
            const modulePath = moduleData.path;
            const ModuleClass = await import(modulePath);
            const ActualClass = ModuleClass.default || ModuleClass[moduleData.className];
            
            if (ActualClass) {
              if (ActualClass.create && typeof ActualClass.create === 'function') {
                // Use factory pattern with ResourceManager
                moduleInstance = await ActualClass.create(this.resourceManager);
              } else {
                // Try direct instantiation
                moduleInstance = new ActualClass();
              }
            }
          } else if (moduleData.type === 'builtin') {
            // Handle built-in modules
            moduleInstance = await this._createBuiltinModule(moduleData);
          }
        } catch (error) {
          console.warn(`⚠️ Could not instantiate module ${moduleData.name}:`, error.message);
          continue;
        }

        if (moduleInstance && moduleInstance.getTools) {
          try {
            const moduleTools = moduleInstance.getTools();
            
            for (const tool of moduleTools) {
              const toolData = {
                name: tool.name,
                moduleName: moduleData.name,
                description: tool.description,
                summary: tool.description?.substring(0, 200) || `${tool.name} tool`,
                inputSchema: tool.inputSchema,
                outputSchema: tool.outputSchema,
                examples: tool.examples || [],
                tags: this.inferToolTags(tool.name, tool.description),
                category: this.inferToolCategory(tool.name),
                complexity: tool.complexity || 'simple',
                permissions: tool.permissions || [],
                status: 'active'
              };
              
              tools.push(toolData);
            }
          } catch (error) {
            console.warn(`⚠️ Error getting tools from module ${moduleData.name}:`, error.message);
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ Error processing module ${moduleData.name}:`, error.message);
      }
    }

    return tools;
  }

  /**
   * Find the Legion root directory
   * @private
   */
  async _findLegionRoot() {
    const path = await import('path');
    const fs = await import('fs');
    
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
      
      currentDir = path.dirname(currentDir);
    }
    
    // Fallback: assume current directory is within Legion
    return process.cwd();
  }

  /**
   * Find module files in a directory
   * @private
   */
  async _findModuleFiles(directory) {
    const fs = await import('fs/promises');
    const path = await import('path');
    const moduleFiles = [];

    try {
      const files = await fs.readdir(directory, { recursive: true });
      
      for (const file of files) {
        const fullPath = path.join(directory, file);
        
        // Look for files that likely contain module classes
        if (file.endsWith('Module.js') || 
            file.endsWith('module.js') ||
            (file.endsWith('.js') && file.includes('Module'))) {
          
          try {
            const stats = await fs.stat(fullPath);
            if (stats.isFile()) {
              moduleFiles.push(fullPath);
            }
          } catch (error) {
            // File doesn't exist or can't be accessed
            continue;
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error reading directory ${directory}:`, error.message);
    }

    return moduleFiles;
  }

  /**
   * Analyze a module file to extract module information
   * @private
   */
  async _analyzeModuleFile(filePath, packageInfo) {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath, '.js');
      
      // Extract class name from file content
      const classMatch = content.match(/export\s+(?:default\s+)?class\s+(\w+)/);
      const className = classMatch ? classMatch[1] : fileName;
      
      // Extract description from JSDoc comment
      const descMatch = content.match(/\/\*\*[\s\S]*?\*\s*([^*\n]+)/);
      const description = descMatch ? descMatch[1].trim() : `${className} module`;

      const moduleData = {
        name: className,
        description,
        version: packageInfo?.version || '1.0.0',
        type: 'class',
        path: filePath,
        className,
        packageName: packageInfo?.name || 'unknown',
        dependencies: this._extractDependencies(content),
        tags: [className.toLowerCase(), packageInfo?.name?.replace('@legion/', '') || 'unknown'],
        category: this.inferModuleCategory(className),
        config: {},
        status: 'active'
      };

      return moduleData;
    } catch (error) {
      console.warn(`⚠️ Error analyzing module file ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Extract dependencies from module file content
   * @private
   */
  _extractDependencies(content) {
    const dependencies = [];
    
    // Look for import statements
    const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      const importPath = match[1];
      if (importPath.startsWith('@legion/') || importPath.startsWith('./') || importPath.startsWith('../')) {
        dependencies.push(importPath);
      }
    }
    
    // Look for require statements
    const requireMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
    for (const match of requireMatches) {
      const requirePath = match[1];
      if (requirePath.startsWith('@legion/') || !requirePath.startsWith('.')) {
        dependencies.push(requirePath);
      }
    }
    
    return [...new Set(dependencies)];
  }

  /**
   * Create built-in module instances
   * @private
   */
  async _createBuiltinModule(moduleData) {
    // Handle known built-in modules
    switch (moduleData.name) {
      case 'FileModule':
        const { FileModule } = await import('@legion/tools');
        return new FileModule();
      
      case 'CalculatorModule':
        const { CalculatorModule } = await import('@legion/tools');
        return new CalculatorModule();
      
      default:
        return null;
    }
  }

  /**
   * Generate embeddings for all tools
   * @private
   */
  async _generateToolEmbeddings() {
    const results = { generated: 0, errors: [] };
    
    try {
      // Get the semantic search provider for embedding generation
      const semanticProvider = this.resourceManager.get('semanticSearchProvider');
      if (!semanticProvider) {
        throw new Error('Semantic search provider not available');
      }

      // Get all tools that need embeddings
      const toolsWithoutEmbeddings = await this.getToolsWithoutEmbeddings(1000);
      
      for (const tool of toolsWithoutEmbeddings) {
        try {
          // Create searchable text from tool data
          const searchText = `${tool.name} ${tool.description || ''} ${tool.summary || ''}`.trim();
          
          // Generate embedding
          const embeddings = await semanticProvider.embeddingService.generateEmbeddings([searchText]);
          
          if (embeddings && embeddings.length > 0) {
            await this.updateToolEmbedding(
              tool._id, 
              embeddings[0], 
              semanticProvider.useLocalEmbeddings ? 'local-onnx' : 'openai'
            );
            results.generated++;
          }
        } catch (error) {
          results.errors.push({
            tool: tool.name,
            error: error.message
          });
        }
      }
    } catch (error) {
      results.errors.push({
        phase: 'setup',
        error: error.message
      });
    }

    return results;
  }
}