/**
 * Tool Registry Migration Script
 * 
 * Migrates existing tool definitions from JSON files to the MongoDB database.
 * Populates the tool registry with all tools from the Legion ecosystem
 * and generates semantic embeddings for enhanced search capabilities.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ToolRegistryDatabaseService } from '../database/ToolRegistryDatabaseService.js';
import { SemanticToolSearch } from '../semantic/SemanticToolSearch.js';
import { MongoDBToolRegistryProvider } from '../providers/MongoDBToolRegistryProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ToolRegistryMigration {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.databaseService = null;
    this.provider = null;
    this.semanticSearch = null;
    this.migrationStats = {
      modulesProcessed: 0,
      toolsProcessed: 0,
      embeddingsGenerated: 0,
      errors: []
    };
  }

  /**
   * Run the complete migration
   */
  async migrate(options = {}) {
    console.log('🚀 Starting Tool Registry Migration...');
    
    try {
      // Initialize components
      await this.initialize();
      
      // Clear existing data if requested
      if (options.clearExisting) {
        await this.clearExistingData();
      }

      // Migrate data from JSON files
      await this.migrateFromJsonFiles();
      
      // Discover and migrate runtime tools
      if (options.discoverRuntimeTools !== false) {
        await this.discoverRuntimeTools();
      }
      
      // Generate semantic embeddings
      if (options.generateEmbeddings !== false) {
        await this.generateSemanticEmbeddings();
      }
      
      // Validate migration
      await this.validateMigration();
      
      console.log('✅ Tool Registry Migration completed successfully!');
      this.printMigrationSummary();
      
      return {
        success: true,
        stats: this.migrationStats
      };

    } catch (error) {
      console.error('❌ Migration failed:', error);
      return {
        success: false,
        error: error.message,
        stats: this.migrationStats
      };
    }
  }

  /**
   * Initialize migration components
   */
  async initialize() {
    console.log('📋 Initializing migration components...');

    // Initialize database service
    this.databaseService = await ToolRegistryDatabaseService.create(this.resourceManager);
    
    // Initialize MongoDB provider
    this.provider = await MongoDBToolRegistryProvider.create(this.resourceManager, {
      enableSemanticSearch: true
    });

    // Initialize semantic search if available
    try {
      this.semanticSearch = await SemanticToolSearch.create(
        this.resourceManager, 
        this.provider
      );
      console.log('✅ Semantic search initialized for migration');
    } catch (error) {
      console.warn('⚠️  Semantic search not available during migration:', error.message);
    }

    console.log('✅ Migration components initialized');
  }

  /**
   * Clear existing data from database
   */
  async clearExistingData() {
    console.log('🧹 Clearing existing data...');

    try {
      await this.databaseService.mongoProvider.delete('tool_usage', {});
      await this.databaseService.mongoProvider.delete('tools', {});
      await this.databaseService.mongoProvider.delete('modules', {});
      
      console.log('✅ Existing data cleared');
    } catch (error) {
      console.warn('⚠️  Failed to clear existing data:', error.message);
    }
  }

  /**
   * Migrate data from JSON files
   */
  async migrateFromJsonFiles() {
    console.log('📄 Migrating data from JSON files...');

    const jsonFiles = [
      '../integration/tools-database.json',
      '../integration/tools-database-complete.json'
    ];

    for (const jsonFile of jsonFiles) {
      try {
        const filePath = path.resolve(__dirname, jsonFile);
        await this.migrateFromJsonFile(filePath);
      } catch (error) {
        console.warn(`⚠️  Could not migrate from ${jsonFile}:`, error.message);
        this.migrationStats.errors.push({
          type: 'json_file',
          file: jsonFile,
          error: error.message
        });
      }
    }
  }

  /**
   * Migrate data from a specific JSON file
   */
  async migrateFromJsonFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const toolsDatabase = JSON.parse(data);
      
      console.log(`📦 Processing ${path.basename(filePath)}...`);

      if (!toolsDatabase.modules) {
        console.warn(`No modules found in ${path.basename(filePath)}`);
        return;
      }

      // Process each module
      for (const [moduleName, moduleData] of Object.entries(toolsDatabase.modules)) {
        await this.migrateModule(moduleName, moduleData);
      }

    } catch (error) {
      console.error(`Failed to process ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Migrate a single module
   */
  async migrateModule(moduleName, moduleData) {
    try {
      console.log(`📦 Migrating module: ${moduleName}`);

      // Create module document
      const moduleDoc = {
        name: moduleName,
        description: moduleData.description || `${moduleName} module`,
        version: moduleData.version || '1.0.0',
        path: moduleData.path || 'dynamic',
        className: moduleData.className,
        type: moduleData.type || 'class',
        dependencies: moduleData.dependencies || [],
        tags: moduleData.tags || [moduleName, ...(this.inferModuleTags(moduleName))],
        category: this.inferModuleCategory(moduleName),
        config: moduleData.config || {},
        status: 'active',
        maintainer: moduleData.maintainer || {
          name: 'Legion Framework',
          url: 'https://github.com/legion-framework'
        }
      };

      // Save module
      const savedModule = await this.provider.saveModule(moduleDoc);
      this.migrationStats.modulesProcessed++;
      
      console.log(`✅ Module saved: ${moduleName} (ID: ${savedModule._id})`);

      // Migrate tools for this module
      if (moduleData.tools) {
        await this.migrateModuleTools(savedModule, moduleData.tools);
      }

    } catch (error) {
      console.error(`Failed to migrate module ${moduleName}:`, error.message);
      this.migrationStats.errors.push({
        type: 'module',
        name: moduleName,
        error: error.message
      });
    }
  }

  /**
   * Migrate tools for a module
   */
  async migrateModuleTools(moduleDoc, toolsData) {
    for (const [toolName, toolData] of Object.entries(toolsData)) {
      try {
        console.log(`🔧 Migrating tool: ${moduleDoc.name}.${toolName}`);

        // Create tool document
        const toolDoc = {
          name: toolName,
          moduleId: moduleDoc._id,
          moduleName: moduleDoc.name,
          description: toolData.description || `${toolName} tool`,
          summary: toolData.summary || toolData.description?.substring(0, 200),
          inputSchema: toolData.inputSchema || toolData.schema,
          outputSchema: toolData.outputSchema,
          examples: this.generateToolExamples(toolName, toolData),
          tags: this.inferToolTags(toolName, toolData.description),
          category: this.inferToolCategory(toolName),
          complexity: this.inferToolComplexity(toolData),
          permissions: toolData.permissions || [],
          status: 'active',
          performance: {
            avgExecutionTime: null,
            successRate: 1.0,
            lastBenchmark: new Date()
          }
        };

        // Save tool
        await this.provider.saveTool(toolDoc);
        this.migrationStats.toolsProcessed++;
        
        console.log(`✅ Tool saved: ${moduleDoc.name}.${toolName}`);

      } catch (error) {
        console.error(`Failed to migrate tool ${toolName}:`, error.message);
        this.migrationStats.errors.push({
          type: 'tool',
          name: `${moduleDoc.name}.${toolName}`,
          error: error.message
        });
      }
    }
  }

  /**
   * Discover and migrate runtime tools from actual Legion modules
   */
  async discoverRuntimeTools() {
    console.log('🔍 Discovering runtime tools...');

    try {
      // Scan packages directory for modules
      const packagesDir = path.resolve(__dirname, '../../../..');
      const packageDirs = await this.scanForModules(packagesDir);
      
      console.log(`📦 Found ${packageDirs.length} potential module directories`);

      for (const packageDir of packageDirs) {
        await this.discoverPackageTools(packageDir);
      }

    } catch (error) {
      console.warn('Runtime tool discovery failed:', error.message);
      this.migrationStats.errors.push({
        type: 'runtime_discovery',
        error: error.message
      });
    }
  }

  /**
   * Scan for module directories
   */
  async scanForModules(packagesDir) {
    const moduleDirectories = [];
    
    try {
      const entries = await fs.readdir(packagesDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const packagePath = path.join(packagesDir, entry.name);
          
          // Check if it has a module.json or looks like a Legion module
          const hasModuleJson = await this.fileExists(path.join(packagePath, 'module.json'));
          const hasPackageJson = await this.fileExists(path.join(packagePath, 'package.json'));
          const hasSrcDir = await this.fileExists(path.join(packagePath, 'src'));
          
          if (hasModuleJson || (hasPackageJson && hasSrcDir)) {
            moduleDirectories.push(packagePath);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to scan packages directory:', error.message);
    }

    return moduleDirectories;
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Discover tools from a package directory
   */
  async discoverPackageTools(packagePath) {
    try {
      const packageName = path.basename(packagePath);
      console.log(`🔍 Scanning package: ${packageName}`);

      // Try to load module.json if it exists
      const moduleJsonPath = path.join(packagePath, 'module.json');
      if (await this.fileExists(moduleJsonPath)) {
        const moduleJson = JSON.parse(await fs.readFile(moduleJsonPath, 'utf-8'));
        
        // Check if this module is already in database
        const existing = await this.provider.getModule(packageName);
        if (!existing && moduleJson.tools) {
          await this.migrateModule(packageName, moduleJson);
          console.log(`✅ Discovered module from runtime: ${packageName}`);
        }
      }

      // Try to load package.json for additional metadata
      const packageJsonPath = path.join(packagePath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        
        // Update existing module with package.json metadata if available
        const existing = await this.provider.getModule(packageName);
        if (existing && packageJson.description) {
          await this.provider.saveModule({
            ...existing,
            description: packageJson.description,
            version: packageJson.version || existing.version,
            updatedAt: new Date()
          });
        }
      }

    } catch (error) {
      console.warn(`Failed to discover tools in ${packagePath}:`, error.message);
    }
  }

  /**
   * Generate semantic embeddings for all tools
   */
  async generateSemanticEmbeddings() {
    if (!this.semanticSearch) {
      console.log('⚠️  Skipping semantic embeddings (semantic search not available)');
      return;
    }

    console.log('🧠 Generating semantic embeddings...');

    try {
      // Get all tools without embeddings
      const tools = await this.provider.getToolsWithoutEmbeddings();
      
      if (tools.length === 0) {
        console.log('✅ All tools already have embeddings');
        return;
      }

      console.log(`📝 Generating embeddings for ${tools.length} tools...`);

      // Process tools in batches
      const batchSize = 20;
      for (let i = 0; i < tools.length; i += batchSize) {
        const batch = tools.slice(i, i + batchSize);
        
        for (const tool of batch) {
          try {
            await this.semanticSearch.indexTool(tool);
            this.migrationStats.embeddingsGenerated++;
          } catch (error) {
            console.warn(`Failed to generate embedding for ${tool.name}:`, error.message);
            this.migrationStats.errors.push({
              type: 'embedding',
              tool: `${tool.moduleName}.${tool.name}`,
              error: error.message
            });
          }
        }

        // Small delay between batches
        if (i + batchSize < tools.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`✅ Generated ${this.migrationStats.embeddingsGenerated} embeddings`);

    } catch (error) {
      console.error('Failed to generate semantic embeddings:', error.message);
      this.migrationStats.errors.push({
        type: 'embeddings',
        error: error.message
      });
    }
  }

  /**
   * Validate the migration
   */
  async validateMigration() {
    console.log('✅ Validating migration...');

    try {
      const stats = await this.databaseService.getDatabaseStats();
      
      console.log('📊 Migration validation results:');
      console.log(`  Modules in database: ${stats.modules}`);
      console.log(`  Tools in database: ${stats.tools}`);
      console.log(`  Usage records: ${stats.usageRecords}`);

      if (stats.modules === 0) {
        throw new Error('No modules found in database - migration may have failed');
      }

      if (stats.tools === 0) {
        throw new Error('No tools found in database - migration may have failed');
      }

      console.log('✅ Migration validation passed');

    } catch (error) {
      console.error('❌ Migration validation failed:', error.message);
      throw error;
    }
  }

  /**
   * Print migration summary
   */
  printMigrationSummary() {
    console.log('\n📊 Migration Summary:');
    console.log('=====================');
    console.log(`✅ Modules processed: ${this.migrationStats.modulesProcessed}`);
    console.log(`✅ Tools processed: ${this.migrationStats.toolsProcessed}`);
    console.log(`✅ Embeddings generated: ${this.migrationStats.embeddingsGenerated}`);
    console.log(`❌ Errors encountered: ${this.migrationStats.errors.length}`);
    
    if (this.migrationStats.errors.length > 0) {
      console.log('\n❌ Errors:');
      for (const error of this.migrationStats.errors.slice(0, 10)) {
        console.log(`  ${error.type}: ${error.name || error.file || 'unknown'} - ${error.error}`);
      }
      
      if (this.migrationStats.errors.length > 10) {
        console.log(`  ... and ${this.migrationStats.errors.length - 10} more errors`);
      }
    }
    
    console.log('=====================\n');
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Infer module category
   */
  inferModuleCategory(moduleName) {
    const name = moduleName.toLowerCase();
    if (name.includes('file') || name.includes('fs')) return 'filesystem';
    if (name.includes('http') || name.includes('network') || name.includes('api')) return 'network';
    if (name.includes('ai') || name.includes('llm') || name.includes('semantic')) return 'ai';
    if (name.includes('test') || name.includes('jester')) return 'testing';
    if (name.includes('deploy') || name.includes('conan') || name.includes('railway')) return 'deployment';
    if (name.includes('data') || name.includes('json') || name.includes('storage')) return 'data';
    if (name.includes('voice') || name.includes('audio')) return 'media';
    if (name.includes('playwright') || name.includes('browser')) return 'automation';
    return 'utility';
  }

  /**
   * Infer module tags
   */
  inferModuleTags(moduleName) {
    const tags = [];
    const name = moduleName.toLowerCase();
    
    if (name.includes('file')) tags.push('filesystem');
    if (name.includes('http')) tags.push('network', 'api');
    if (name.includes('ai') || name.includes('llm')) tags.push('ai', 'ml');
    if (name.includes('test')) tags.push('testing', 'qa');
    if (name.includes('deploy')) tags.push('deployment', 'devops');
    if (name.includes('json')) tags.push('data', 'parsing');
    if (name.includes('voice')) tags.push('audio', 'speech');
    if (name.includes('semantic')) tags.push('search', 'nlp');
    
    return tags;
  }

  /**
   * Infer tool category
   */
  inferToolCategory(toolName) {
    const name = toolName.toLowerCase();
    if (name.includes('read') || name.includes('get') || name.includes('find')) return 'read';
    if (name.includes('write') || name.includes('create') || name.includes('save')) return 'write';
    if (name.includes('delete') || name.includes('remove')) return 'delete';
    if (name.includes('update') || name.includes('modify') || name.includes('edit')) return 'update';
    if (name.includes('execute') || name.includes('run') || name.includes('command')) return 'execute';
    if (name.includes('search') || name.includes('query') || name.includes('find')) return 'search';
    if (name.includes('transform') || name.includes('convert') || name.includes('parse')) return 'transform';
    if (name.includes('validate') || name.includes('check') || name.includes('verify')) return 'validate';
    if (name.includes('generate') || name.includes('build') || name.includes('make')) return 'generate';
    if (name.includes('analyze') || name.includes('inspect')) return 'analyze';
    return 'other';
  }

  /**
   * Infer tool tags
   */
  inferToolTags(toolName, description = '') {
    const tags = [];
    const text = `${toolName} ${description}`.toLowerCase();
    
    if (text.includes('file')) tags.push('file');
    if (text.includes('directory') || text.includes('folder')) tags.push('directory');
    if (text.includes('json')) tags.push('json', 'data');
    if (text.includes('command') || text.includes('bash') || text.includes('shell')) tags.push('command', 'terminal');
    if (text.includes('search') || text.includes('find')) tags.push('search');
    if (text.includes('http') || text.includes('api') || text.includes('request')) tags.push('network', 'api');
    if (text.includes('database') || text.includes('db')) tags.push('database');
    if (text.includes('ai') || text.includes('llm') || text.includes('gpt')) tags.push('ai');
    if (text.includes('test') || text.includes('spec')) tags.push('testing');
    if (text.includes('deploy') || text.includes('build')) tags.push('deployment');
    if (text.includes('audio') || text.includes('voice') || text.includes('speech')) tags.push('audio');
    if (text.includes('browser') || text.includes('playwright')) tags.push('automation', 'browser');
    
    // Add category as tag
    const category = this.inferToolCategory(toolName);
    if (category !== 'other') {
      tags.push(category);
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Infer tool complexity
   */
  inferToolComplexity(toolData) {
    if (toolData.inputSchema) {
      const schemaStr = JSON.stringify(toolData.inputSchema);
      const paramCount = (schemaStr.match(/"properties"/g) || []).length;
      const requiredCount = (schemaStr.match(/"required"/g) || []).length;
      
      if (paramCount > 5 || requiredCount > 3) return 'complex';
      if (paramCount > 2 || requiredCount > 1) return 'moderate';
    }
    
    return 'simple';
  }

  /**
   * Generate example usage for a tool
   */
  generateToolExamples(toolName, toolData) {
    const examples = [];
    const category = this.inferToolCategory(toolName);
    
    // Generate basic example based on category
    if (category === 'read' && toolName.includes('file')) {
      examples.push({
        title: 'Read a configuration file',
        description: 'Read the contents of a JSON configuration file',
        input: { filepath: 'config.json' },
        output: { success: true, content: '{"key": "value"}' }
      });
    } else if (category === 'write' && toolName.includes('file')) {
      examples.push({
        title: 'Create a new file',
        description: 'Write text content to a new file',
        input: { filepath: 'output.txt', content: 'Hello World' },
        output: { success: true, message: 'File created successfully' }
      });
    } else if (category === 'execute' && toolName.includes('command')) {
      examples.push({
        title: 'List directory contents',
        description: 'Execute ls command to list files',
        input: { command: 'ls -la' },
        output: { success: true, stdout: 'total 4\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .' }
      });
    }

    return examples;
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

/**
 * Run migration from command line
 */
export async function runMigrationCLI() {
  try {
    console.log('🚀 Tool Registry Migration CLI');
    console.log('==============================\n');

    // Initialize ResourceManager
    const { ResourceManager } = await import('@legion/tools');
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();

    console.log('✅ ResourceManager initialized');

    // Create and run migration
    const migration = new ToolRegistryMigration(resourceManager);
    
    const options = {
      clearExisting: process.argv.includes('--clear'),
      discoverRuntimeTools: !process.argv.includes('--no-discovery'),
      generateEmbeddings: !process.argv.includes('--no-embeddings')
    };

    const result = await migration.migrate(options);

    if (result.success) {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    } else {
      console.error('💥 Migration failed:', result.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 Migration CLI failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrationCLI();
}