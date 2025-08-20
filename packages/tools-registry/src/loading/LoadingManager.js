/**
 * LoadingManager - Central coordinator for all database loading operations
 * 
 * Manages the complete pipeline:
 * 1. Clear databases (MongoDB collections + Qdrant vectors)
 * 2. Load modules to MongoDB (with optional module filter)
 * 3. Generate perspectives for tools 
 * 4. Index vectors to Qdrant
 * 
 * Used by ToolRegistry and scripts for coordinated loading operations.
 */

import { ModuleLoader } from './ModuleLoader.js';
import { DatabasePopulator } from './DatabasePopulator.js';
import { ModuleDiscovery } from './ModuleDiscovery.js';
import { ComprehensiveValidator } from '../validation/ComprehensiveValidator.js';
import { MongoDBToolRegistryProvider } from '../providers/MongoDBToolRegistryProvider.js';
import { SemanticSearchProvider } from '../../../semantic-search/src/SemanticSearchProvider.js';
import { createToolIndexer } from '../search/index.js';
import { ResourceManager } from '@legion/resource-manager';
import { Verifier } from '../verification/Verifier.js';
import { PipelineOrchestrator } from './PipelineOrchestrator.js';
import { PerspectiveGenerator } from '../search/PerspectiveGenerator.js';

export class LoadingManager {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.resourceManager = options.resourceManager || null;
    
    // Components - can be provided to share connections
    this.moduleLoader = null;
    this.databasePopulator = null;
    this.mongoProvider = options.mongoProvider || null;
    this.semanticSearchProvider = options.semanticSearchProvider || null;
    this.toolIndexer = null;
    this.orchestrator = null; // NEW: Pipeline orchestrator
    
    // State tracking
    this.initialized = false;
    this.pipelineState = {
      cleared: false,
      modulesLoaded: false,
      perspectivesGenerated: false,
      vectorsIndexed: false,
      lastModuleFilter: null,
      moduleCount: 0,
      toolCount: 0,
      perspectiveCount: 0,
      vectorCount: 0,
      errors: []
    };
  }

  /**
   * Initialize all components
   */
  async initialize() {
    if (this.initialized) return;

    // Create ResourceManager if not provided
    if (!this.resourceManager) {
      this.resourceManager = ResourceManager.getInstance();
      if (!this.resourceManager.initialized) {
        await this.resourceManager.initialize();
      }
    }

    // SemanticSearchProvider always uses local Nomic embeddings

    // Initialize components
    this.moduleLoader = new ModuleLoader({
      verbose: this.verbose,
      resourceManager: this.resourceManager
    });

    this.databasePopulator = new DatabasePopulator({
      verbose: this.verbose
    });
    await this.databasePopulator.initialize();

    // Only create MongoDB provider if not provided (allows sharing connections)
    if (!this.mongoProvider) {
      this.mongoProvider = await MongoDBToolRegistryProvider.create(this.resourceManager, {
        enableSemanticSearch: false
      });
    }

    // Don't initialize semantic search components until needed
    // this.semanticSearchProvider = await SemanticSearchProvider.create(this.resourceManager);
    // this.toolIndexer = await createToolIndexer(this.resourceManager);

    // Initialize verifier (will be properly configured when semantic search is initialized)
    this.verifier = null;

    // Initialize orchestrator after other components are ready
    // Will be initialized when needed to ensure all dependencies are available
    this.orchestrator = null;

    this.initialized = true;

    if (this.verbose) {
      console.log('✅ LoadingManager initialized with all components');
    }
  }

  /**
   * Initialize the pipeline orchestrator
   */
  async #initializeOrchestrator() {
    if (this.orchestrator) return;

    // Ensure semantic search is initialized first
    await this.#ensureSemanticSearchInitialized();

    // Create perspective generator
    const perspectiveGenerator = new PerspectiveGenerator(
      this.mongoProvider.databaseService.mongoProvider
    );

    // Create orchestrator with all required dependencies
    this.orchestrator = new PipelineOrchestrator({
      mongoProvider: this.mongoProvider.databaseService.mongoProvider,
      vectorStore: this.semanticSearchProvider.vectorStore,
      moduleLoader: this.moduleLoader,
      perspectiveGenerator: perspectiveGenerator,
      embeddingService: this.semanticSearchProvider.embeddingService,
      embeddingBatchSize: 50,
      vectorBatchSize: 100
    });

    if (this.verbose) {
      console.log('✅ Pipeline orchestrator initialized');
    }
  }

  /**
   * Ensure semantic search components are initialized
   */
  async #ensureSemanticSearchInitialized() {
    // Only create if not provided (allows sharing from ToolRegistry)
    if (!this.semanticSearchProvider) {
      this.semanticSearchProvider = await SemanticSearchProvider.create(this.resourceManager);
    }
    if (!this.toolIndexer) {
      this.toolIndexer = await createToolIndexer(this.resourceManager);
    }
    
    // Always initialize verifier (semantic search provider can be null)
    if (!this.verifier) {
      if (this.verbose) {
        console.log('🔍 Creating Verifier for clearing verification...');
      }
      this.verifier = new Verifier(this.mongoProvider, this.semanticSearchProvider, this.verbose);
      if (this.verbose) {
        console.log('✅ Verifier created successfully');
      }
    }
  }

  /**
   * Clear for reload - preserves discovered modules but resets their loading status
   * @param {Object} options - Clear options
   * @param {boolean} options.clearVectors - Whether to clear vector database (default: true)
   * @param {boolean} options.clearModules - Whether to completely clear modules (default: false)
   */
  async clearForReload(options = {}) {
    await this.#ensureInitialized();

    const { 
      clearVectors = true,
      clearModules = false 
    } = options;

    if (this.verbose) {
      console.log('🧹 Clearing for reload...');
      console.log(`   Preserve modules: ${!clearModules}`);
      console.log(`   Clear vectors: ${clearVectors}`);
    }

    let totalCleared = 0;

    if (clearModules) {
      // Complete clear of modules
      const result = await this.mongoProvider.databaseService.mongoProvider.db.collection('modules').deleteMany({});
      totalCleared += result.deletedCount;
      if (this.verbose) {
        console.log(`  ✅ Cleared modules: ${result.deletedCount} records deleted`);
      }
    } else {
      // Reset module statuses but preserve discovery
      // Only update fields that exist in the runtime modules schema
      const result = await this.mongoProvider.databaseService.mongoProvider.db.collection('modules').updateMany(
        {},
        {
          $set: {
            loadingStatus: 'pending',
            validationStatus: 'pending'
          }
        }
      );
      if (this.verbose) {
        console.log(`  ✅ Reset ${result.modifiedCount} module statuses`);
      }
    }

    // Always clear tools and perspectives
    const toolResult = await this.mongoProvider.databaseService.mongoProvider.db.collection('tools').deleteMany({});
    totalCleared += toolResult.deletedCount;
    if (this.verbose) {
      console.log(`  ✅ Cleared tools: ${toolResult.deletedCount} records deleted`);
    }

    const perspectiveResult = await this.mongoProvider.databaseService.mongoProvider.db.collection('tool_perspectives').deleteMany({});
    totalCleared += perspectiveResult.deletedCount;
    if (this.verbose) {
      console.log(`  ✅ Cleared perspectives: ${perspectiveResult.deletedCount} records deleted`);
    }

    // Clear vectors if requested - ALWAYS initialize semantic search for clearing
    if (clearVectors) {
      await this.#ensureSemanticSearchInitialized();
      const qdrantCollections = ['legion_tools'];
      
      if (this.verbose) {
        console.log('  🧹 Clearing Qdrant vectors...');
      }
      
      for (const collectionName of qdrantCollections) {
        try {
          const countBefore = await this.semanticSearchProvider.count(collectionName);
          if (this.verbose) {
            console.log(`  📊 Found ${countBefore} vectors in '${collectionName}'`);
          }
          
          if (countBefore > 0) {
            // Delete the entire collection
            await this.semanticSearchProvider.vectorStore.deleteCollection(collectionName);
            if (this.verbose) {
              console.log(`  ✅ Deleted Qdrant collection '${collectionName}': ${countBefore} vectors removed`);
            }
            totalCleared += countBefore;
            
            // Wait a moment for deletion to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          if (!error.message.includes('Not found')) {
            if (this.verbose) {
              console.log(`  ⚠️ Could not clear '${collectionName}': ${error.message}`);
            }
          }
        }

        // Recreate collection with correct dimensions for Nomic embeddings (768D)
        try {
          await this.semanticSearchProvider.vectorStore.createCollection(collectionName, {
            dimension: 768,
            distance: 'cosine'
          });
          if (this.verbose) {
            console.log(`  ✅ Recreated '${collectionName}' with 768 dimensions (Nomic embeddings)`);
          }
          
          // Verify the collection was created and is empty
          const countAfter = await this.semanticSearchProvider.count(collectionName);
          if (this.verbose) {
            console.log(`  📊 Verified: ${countAfter} vectors in recreated collection`);
          }
        } catch (error) {
          if (this.verbose) {
            console.log(`  ⚠️ Could not recreate '${collectionName}': ${error.message}`);
          }
          throw new Error(`Failed to recreate Qdrant collection '${collectionName}': ${error.message}`);
        }
      }
    }

    // Verify clearing actually worked
    if (this.verifier) {
      const clearingVerification = await this.verifier.verifyClearingWorked({
        expectEmptyTools: true,
        expectEmptyPerspectives: true,
        expectEmptyVectors: clearVectors
      });
      
      const moduleVerification = await this.verifier.verifyModulesUnloaded();
      
      if (!clearingVerification.success || !moduleVerification.success) {
        const errors = [...clearingVerification.errors, ...moduleVerification.errors];
        const errorMsg = `Clearing verification failed: ${errors.join(', ')}`;
        if (this.verbose) {
          console.log(`❌ ${errorMsg}`);
        }
        throw new Error(errorMsg);
      } else if (this.verbose) {
        console.log(`✅ Clearing verified:`);
        console.log(`   Tools: ${clearingVerification.clearedCounts.tools}`);
        console.log(`   Perspectives: ${clearingVerification.clearedCounts.perspectives}`);
        console.log(`   Vectors: ${clearingVerification.clearedCounts.vectors}`);
        console.log(`   Modules: ${clearingVerification.clearedCounts.modules} (preserved)`);
        console.log(`   Module statuses: loaded=${moduleVerification.moduleStats.loaded}, unloaded=${moduleVerification.moduleStats.unloaded}`);
      }
    }

    if (this.verbose) {
      console.log(`✅ Clear for reload complete: ${totalCleared} records/vectors cleared`);
    }

    // Reset pipeline state
    this.pipelineState = {
      cleared: true,
      modulesLoaded: false,
      perspectivesGenerated: false,
      vectorsIndexed: false,
      lastModuleFilter: null,
      moduleCount: 0,
      toolCount: 0,
      perspectiveCount: 0,
      vectorCount: 0,
      errors: []
    };

    return { totalCleared };
  }

  /**
   * Clear all databases (MongoDB collections + Qdrant vectors)
   * Preserves module_registry collection to avoid re-discovery
   * @deprecated Use clearForReload() instead to preserve module discovery
   */
  async clearAll() {
    await this.#ensureInitialized();

    if (this.verbose) {
      console.log('🧹 Clearing all databases (preserving module_registry)...');
    }

    let totalCleared = 0;

    // Clear MongoDB collections - NOTE: module_registry is preserved!
    const mongoCollections = ['modules', 'tools', 'tool_perspectives'];
    
    for (const collectionName of mongoCollections) {
      const countBefore = await this.mongoProvider.databaseService.mongoProvider.count(collectionName, {});
      if (countBefore > 0) {
        const result = await this.mongoProvider.databaseService.mongoProvider.db.collection(collectionName).deleteMany({});
        if (this.verbose) {
          console.log(`  ✅ Cleared ${collectionName}: ${result.deletedCount} records deleted`);
        }
        totalCleared += result.deletedCount;
      }
    }

    // Clear Qdrant collections only if semantic search is initialized
    if (this.semanticSearchProvider) {
      const qdrantCollections = ['legion_tools'];
      
      for (const collectionName of qdrantCollections) {
        try {
          const countBefore = await this.semanticSearchProvider.count(collectionName);
          if (countBefore > 0) {
          await this.semanticSearchProvider.vectorStore.deleteCollection(collectionName);
          if (this.verbose) {
            console.log(`  ✅ Deleted Qdrant collection '${collectionName}': ${countBefore} vectors removed`);
          }
          totalCleared += countBefore;
        }
      } catch (error) {
        if (!error.message.includes('Not found')) {
          if (this.verbose) {
            console.log(`  ⚠️ Could not clear '${collectionName}': ${error.message}`);
          }
        }
      }

        // Recreate collection with correct dimensions for Nomic embeddings (768D)
        try {
          await this.semanticSearchProvider.vectorStore.createCollection(collectionName, {
            dimension: 768, // Nomic embed model dimensions
            distance: 'cosine'
          });
          if (this.verbose) {
            console.log(`  ✅ Recreated '${collectionName}' with 768 dimensions (Nomic embeddings)`);
          }
        } catch (error) {
          if (this.verbose) {
            console.log(`  ⚠️ Could not recreate '${collectionName}': ${error.message}`);
          }
        }
      }
    }

    if (this.verbose) {
      console.log(`✅ Clear complete: ${totalCleared} total records/vectors deleted`);
    }

    // Update state
    this.pipelineState = {
      cleared: true,
      modulesLoaded: false,
      perspectivesGenerated: false,
      vectorsIndexed: false,
      lastModuleFilter: null,
      moduleCount: 0,
      toolCount: 0,
      perspectiveCount: 0,
      vectorCount: 0,
      errors: []
    };

    return { totalCleared };
  }

  /**
   * Populate runtime modules collection from permanent module_registry
   * This allows clearing runtime state while preserving discovery data
   */
  async populateModulesFromRegistry(filter = null) {
    await this.#ensureInitialized();

    if (this.verbose) {
      console.log('📋 Populating modules from registry...');
    }

    // Build query for module_registry
    let query = { loadable: { $ne: false } };
    if (filter) {
      query.$or = [
        { name: { $regex: new RegExp(filter, 'i') } },
        { className: { $regex: new RegExp(filter, 'i') } }
      ];
    }

    // Get modules from registry
    const registryModules = await this.mongoProvider.databaseService.mongoProvider.find('module_registry', query);

    if (this.verbose) {
      console.log(`  Found ${registryModules.length} modules in registry`);
    }

    let populated = 0;
    let skipped = 0;

    // Populate runtime modules collection with default state
    for (const registryModule of registryModules) {
      if (this.verbose) {
        console.log(`  🔄 Processing registry module: ${registryModule.name}`);
      }
      
      try {
        // Check if already exists in runtime collection
        const existingModule = await this.mongoProvider.databaseService.mongoProvider.findOne('modules', {
          name: registryModule.name,
          className: registryModule.className,
          filePath: registryModule.filePath
        });

        if (existingModule) {
          skipped++;
          continue;
        }

        // Create runtime module entry with default state
        const runtimeModule = {
          // Core fields from registry
          name: registryModule.name,
          type: registryModule.type,
          path: registryModule.path,
          className: registryModule.className,
          filePath: registryModule.filePath,
          package: registryModule.package,
          dependencies: registryModule.dependencies || [],
          
          // Ensure description meets validation requirements
          description: registryModule.description && registryModule.description.length >= 10 
            ? registryModule.description
            : `${registryModule.name} module provides tools for specific functionality`,
          
          // Required schema fields that might be missing
          tags: [],
          category: 'utility',
          config: {},
          status: 'active',
          maintainer: {},
            
          // Loading status
          loadingStatus: 'pending',
          // Note: omitting null date fields as they're optional in schema
          
          // Indexing status
          indexingStatus: 'pending',
          // Note: omitting null date fields as they're optional in schema
          
          // Tool counts (ensure proper MongoDB integer type)
          toolCount: 0,
          perspectiveCount: 0,
          
          // Validation status
          validationStatus: 'pending',
          
          // Timestamps
          createdAt: new Date(),
          updatedAt: new Date()
        };

        if (this.verbose) {
          console.log(`  🔍 Created runtime module object for ${registryModule.name}`);
          console.log(`      Type: ${runtimeModule.type}, Status: ${runtimeModule.status}`);
        }

        // Insert into runtime collection
        try {
          if (this.verbose) {
            console.log(`  📝 Inserting ${registryModule.name} into runtime collection...`);
          }
          
          const insertResult = await this.mongoProvider.databaseService.mongoProvider.insert('modules', runtimeModule);
          populated++;

          if (this.verbose) {
            console.log(`  ✅ Populated: ${registryModule.name} (ID: ${insertResult.insertedIds?.[0]})`);
          }
        } catch (insertError) {
          if (this.verbose) {
            console.log(`  ❌ Insert failed for ${registryModule.name}: ${insertError.message}`);
            console.log('    Error code:', insertError.code);
            if (insertError.code === 121) {
              console.log('    This is a document validation error');
              // Show just the first few fields to avoid overwhelming output
              const debugData = {
                name: runtimeModule.name,
                type: runtimeModule.type,
                description: runtimeModule.description?.substring(0, 50) + '...',
                toolCount: runtimeModule.toolCount,
                perspectiveCount: runtimeModule.perspectiveCount,
                status: runtimeModule.status,
                category: runtimeModule.category
              };
              console.log('    Key fields being inserted:', JSON.stringify(debugData, null, 2));
            }
          }
          throw insertError;
        }

      } catch (error) {
        if (this.verbose) {
          console.log(`  ❌ Failed to populate ${registryModule.name}: ${error.message}`);
        }
      }
    }

    if (this.verbose) {
      console.log(`✅ Population complete: ${populated} populated, ${skipped} skipped`);
    }

    return {
      populated,
      skipped,
      total: registryModules.length
    };
  }

  /**
   * Load modules to MongoDB
   * @param {string|Object} options - Module filter string or options object
   * @param {string} [options.module] - Single module name to load
   * @param {string} [options.tool] - Single tool name (requires module)
   * @param {boolean} [options.all] - Load all modules (default: true)
   */
  async loadModules(options = {}) {
    await this.#ensureInitialized();

    // Normalize options
    const opts = typeof options === 'string' 
      ? { module: options }
      : { all: true, ...options };

    // Validate options
    if (opts.tool && !opts.module) {
      throw new Error('Cannot load a single tool without specifying its module');
    }

    let moduleFilter = null;
    let toolFilter = null;

    if (opts.tool) {
      // Single tool mode
      moduleFilter = opts.module;
      toolFilter = opts.tool;
      if (this.verbose) {
        console.log(`📦 Loading single tool: ${toolFilter} from module: ${moduleFilter}`);
      }
    } else if (opts.module) {
      // Single module mode
      moduleFilter = opts.module;
      if (this.verbose) {
        console.log(`📦 Loading single module: ${moduleFilter}`);
      }
    } else {
      // All modules mode (default)
      if (this.verbose) {
        console.log(`📦 Loading all modules...`);
      }
    }

    // First check if we need to populate runtime modules from registry
    const moduleCount = await this.mongoProvider.databaseService.mongoProvider.count('modules', {});
    if (moduleCount === 0) {
      if (this.verbose) {
        console.log('📋 No modules in runtime collection, populating from registry...');
      }
      await this.populateModulesFromRegistry(moduleFilter);
    }

    // Load modules using ModuleLoader
    const loadResult = await this.moduleLoader.loadModules(moduleFilter);

    if (this.verbose) {
      console.log(`✅ Loaded ${loadResult.summary.loaded} modules`);
      if (loadResult.summary.failed > 0) {
        console.log(`⚠️ ${loadResult.summary.failed} modules failed to load`);
      }
    }

    // Filter loaded modules if tool filter is specified
    let modulesToPopulate = loadResult.loaded;
    if (toolFilter && modulesToPopulate.length > 0) {
      // Filter tools within the module
      for (const moduleData of modulesToPopulate) {
        if (moduleData.tools) {
          const filteredTools = {};
          for (const [name, tool] of Object.entries(moduleData.tools)) {
            if (name === toolFilter) {
              filteredTools[name] = tool;
            }
          }
          moduleData.tools = filteredTools;
        }
      }
    }

    // Populate database with loaded modules
    const popResult = await this.databasePopulator.populate(modulesToPopulate, {
      clearExisting: false // Don't clear, we may have cleared already
    });

    if (this.verbose) {
      console.log(`✅ Database populated: ${popResult.modules.saved} modules, ${popResult.tools.saved} tools`);
    }

    // Update state
    this.pipelineState.modulesLoaded = true;
    this.pipelineState.lastModuleFilter = moduleFilter;
    this.pipelineState.moduleCount = popResult.modules.saved;
    this.pipelineState.toolCount = popResult.tools.saved;
    if (loadResult.summary.failed > 0) {
      this.pipelineState.errors.push(`${loadResult.summary.failed} modules failed to load`);
    }

    return {
      loadResult,
      popResult,
      modulesLoaded: loadResult.summary.loaded,
      toolsAdded: popResult.tools.saved
    };
  }

  /**
   * Generate perspectives for tools
   * @param {string|Object} options - Module filter string or options object
   * @param {string} [options.module] - Single module name to process
   * @param {string} [options.tool] - Single tool name (requires module)
   * @param {boolean} [options.all] - Process all modules (default: true)
   */
  async generatePerspectives(options = {}) {
    await this.#ensureInitialized();
    await this.#ensureSemanticSearchInitialized();

    // Normalize options
    const opts = typeof options === 'string' 
      ? { module: options }
      : { all: true, ...options };

    // Validate options
    if (opts.tool && !opts.module) {
      throw new Error('Cannot generate perspectives for a single tool without specifying its module');
    }

    // Check prerequisites
    if (!this.pipelineState.modulesLoaded) {
      throw new Error('Cannot generate perspectives: modules must be loaded first. Run loadModules() first.');
    }

    // Log what we're doing
    if (this.verbose) {
      if (opts.tool) {
        console.log(`📝 Generating perspectives for single tool: ${opts.tool} (module: ${opts.module})`);
      } else if (opts.module) {
        console.log(`📝 Generating perspectives for single module: ${opts.module}`);
      } else {
        console.log(`📝 Generating perspectives for all tools...`);
      }
    }

    // Build query based on options
    let query = {};
    
    if (opts.module) {
      // First find the module by name to get its ID (case-insensitive)
      const module = await this.mongoProvider.databaseService.mongoProvider.findOne('modules', { 
        name: { $regex: new RegExp(`^${opts.module}$`, 'i') }
      });
      
      if (module) {
        // Query tools by BOTH moduleId AND moduleName to handle data inconsistencies
        query.$or = [
          { moduleId: module._id },
          { moduleName: module.name }
        ];
        if (this.verbose) {
          console.log(`  Found module '${module.name}' with ID: ${module._id}, querying by both moduleId and moduleName`);
        }
      } else {
        // Fallback to moduleName for backwards compatibility
        query.moduleName = opts.module;
        if (this.verbose) {
          console.log(`  Module '${opts.module}' not found, using moduleName fallback`);
        }
      }
      
      // Add tool filter if specified
      if (opts.tool) {
        query.name = opts.tool;
      }
    }

    // Use direct MongoDB query for complex queries like $or
    let tools;
    if (query.$or || Object.keys(query).some(key => key.startsWith('$'))) {
      // Complex MongoDB query - use direct database access
      tools = await this.mongoProvider.databaseService.mongoProvider.find('tools', query);
    } else {
      // Simple query - use the higher-level listTools method
      tools = await this.mongoProvider.listTools(query);
    }
    
    if (tools.length === 0) {
      const context = opts.tool ? `tool: ${opts.tool}` : opts.module ? `module: ${opts.module}` : 'all modules';
      if (this.verbose) {
        console.log(`⚠️ No tools found for ${context}`);
      }
      this.pipelineState.errors.push(`No tools found for perspective generation (${context})`);
      return { perspectivesGenerated: 0, toolsProcessed: 0 };
    }

    // Use ToolIndexer to index tools (which generates perspectives automatically)
    let perspectivesGenerated = 0;
    let toolsProcessed = 0;
    let toolsFailed = 0;
    
    // Track perspectives per module for status updates
    const modulesPerspectives = {};

    for (const tool of tools) {
      try {
        // The ToolIndexer.indexTool method requires toolId as third parameter
        const toolId = tool._id || tool.toolId;
        const metadata = { module: tool.moduleName };
        
        const result = await this.toolIndexer.indexTool(tool, metadata, toolId);
        
        if (result.success) {
          perspectivesGenerated += result.perspectivesIndexed || 0;
          toolsProcessed++;
          
          // Track perspectives per module
          const moduleName = tool.moduleName || tool.module;
          if (moduleName) {
            modulesPerspectives[moduleName] = (modulesPerspectives[moduleName] || 0) + result.perspectivesIndexed;
          }
          
          if (this.verbose) {
            console.log(`  ✅ Generated ${result.perspectivesIndexed} perspectives for: ${tool.name}`);
          }
        }
      } catch (error) {
        toolsFailed++;
        this.pipelineState.errors.push(`Failed to generate perspectives for ${tool.name}: ${error.message}`);
        if (this.verbose) {
          console.log(`  ❌ Failed to generate perspectives for ${tool.name}: ${error.message}`);
        }
      }
    }
    
    // Update module indexing status
    for (const [moduleName, perspectiveCount] of Object.entries(modulesPerspectives)) {
      await this.mongoProvider.databaseService.mongoProvider.update(
        'modules',
        { name: moduleName },
        {
          $set: {
            indexingStatus: 'indexed',
            lastIndexedAt: new Date(),
            perspectiveCount: perspectiveCount,
            indexingError: null
          }
        }
      );
    }

    if (this.verbose) {
      console.log(`✅ Generated ${perspectivesGenerated} perspectives for ${toolsProcessed} tools`);
      if (toolsFailed > 0) {
        console.log(`⚠️ ${toolsFailed} tools failed perspective generation`);
      }
    }

    // Update state
    this.pipelineState.perspectivesGenerated = perspectivesGenerated > 0;
    this.pipelineState.perspectiveCount = perspectivesGenerated;

    return { perspectivesGenerated, toolsProcessed, toolsFailed };
  }

  /**
   * Index vectors to Qdrant
   * @param {string|Object} options - Module filter string or options object
   * @param {string} [options.module] - Single module name to process
   * @param {string} [options.tool] - Single tool name (requires module)
   * @param {boolean} [options.all] - Process all modules (default: true)
   */
  async indexVectors(options = {}) {
    await this.#ensureInitialized();
    await this.#ensureSemanticSearchInitialized();

    // Normalize options
    const opts = typeof options === 'string' 
      ? { module: options }
      : { all: true, ...options };

    // Validate options
    if (opts.tool && !opts.module) {
      throw new Error('Cannot index vectors for a single tool without specifying its module');
    }

    // Check prerequisites
    if (!this.pipelineState.modulesLoaded) {
      throw new Error('Cannot index vectors: modules must be loaded first. Run loadModules() first.');
    }

    if (!this.pipelineState.perspectivesGenerated) {
      throw new Error('Cannot index vectors: perspectives must be generated first. Run generatePerspectives() first.');
    }

    // Log what we're doing
    if (this.verbose) {
      if (opts.tool) {
        console.log(`🚀 Indexing vectors for single tool: ${opts.tool} (module: ${opts.module})`);
      } else if (opts.module) {
        console.log(`🚀 Indexing vectors for single module: ${opts.module}`);
      } else {
        console.log(`🚀 Indexing vectors for all tools...`);
      }
    }

    // Build query for perspectives with embeddings
    let query = { embedding: { $exists: true, $ne: null } };
    
    if (opts.tool) {
      // Single tool - direct query by tool name
      query.toolName = opts.tool;
    } else if (opts.module) {
      // Single module - get all tools for the module
      const module = await this.mongoProvider.databaseService.mongoProvider.findOne('modules', { 
        name: { $regex: new RegExp(`^${opts.module}$`, 'i') }
      });
      
      // Get tools for this module
      const toolQuery = module ? { moduleId: module._id } : { moduleName: opts.module };
      const tools = await this.mongoProvider.listTools(toolQuery);
      const toolNames = tools.map(t => t.name);
      
      if (toolNames.length === 0) {
        if (this.verbose) {
          console.log(`⚠️ No tools found for module: ${opts.module}`);
        }
        this.pipelineState.errors.push(`No tools found for vector indexing (module: ${opts.module})`);
        return { perspectivesIndexed: 0, toolsProcessed: 0 };
      }
      
      query.toolName = { $in: toolNames };
    }
    // else: all modules - no additional filter needed

    const perspectives = await this.mongoProvider.databaseService.mongoProvider.find('tool_perspectives', query);

    if (perspectives.length === 0) {
      const context = opts.tool ? `tool: ${opts.tool}` : opts.module ? `module: ${opts.module}` : 'all modules';
      const errorMessage = `No perspectives with embeddings found to index for ${context}. Run generatePerspectives() successfully first.`;
      if (this.verbose) {
        console.log(`⚠️ ${errorMessage}`);
      }
      this.pipelineState.errors.push(errorMessage);
      return { perspectivesIndexed: 0, toolsProcessed: 0 };
    }

    if (this.verbose) {
      console.log(`📝 Upserting ${perspectives.length} vectors to Qdrant collection: ${this.toolIndexer.collectionName} (768D)`);
    }

    // Transform perspectives to vectors using proper Qdrant format (matching ToolIndexer)
    const vectors = perspectives.map((perspective, index) => ({
      id: perspective._id?.toString() || `tool_${perspective.toolName}_${perspective.perspectiveType}_${index}`,
      vector: Array.from(perspective.embedding), // Ensure it's a regular array
      payload: {
        perspectiveId: perspective._id?.toString(),
        toolId: perspective.toolId?.toString(),
        toolName: perspective.toolName,
        perspectiveType: perspective.perspectiveType
      }
    }));

    try {
      // Index vectors using ToolIndexer's vectorStore with proper error handling
      await this.toolIndexer.vectorStore.upsert(this.toolIndexer.collectionName, vectors);

      if (this.verbose) {
        console.log(`✅ Indexed ${vectors.length} vectors from ${new Set(perspectives.map(p => p.toolName)).size} tools`);
      }

      // Update state
      this.pipelineState.vectorsIndexed = true;
      this.pipelineState.vectorCount = vectors.length;

      return {
        perspectivesIndexed: vectors.length,
        toolsProcessed: new Set(perspectives.map(p => p.toolName)).size
      };
    } catch (error) {
      this.pipelineState.errors.push(`Vector indexing failed: ${error.message}`);
      if (this.verbose) {
        console.log(`❌ Upsert error: ${error.message}`);
        console.log(`🔍 Debug - First vector sample:`, {
          id: vectors[0]?.id,
          vectorLength: vectors[0]?.vector?.length,
          vectorType: Array.isArray(vectors[0]?.vector) ? 'array' : typeof vectors[0]?.vector,
          payload: vectors[0]?.payload
        });
      }
      throw error;
    }
  }

  /**
   * Complete loading pipeline
   * @param {Object} options - Pipeline options
   * @param {string} [options.module] - Single module name to process
   * @param {string} [options.tool] - Single tool name (requires module)
   * @param {boolean} [options.all] - Process all modules (default: true)
   * @param {boolean} [options.clearFirst] - Clear databases first (default: true)
   * @param {boolean} [options.includePerspectives] - Generate perspectives (default: true)
   * @param {boolean} [options.includeVectors] - Index vectors (default: true)
   */
  async fullPipeline(options = {}) {
    await this.#ensureInitialized();

    const {
      module = null,
      tool = null,
      all = !module && !tool,
      clearFirst = true,
      includePerspectives = true,
      includeVectors = true
    } = options;

    // Build consistent options for all steps
    const filterOptions = tool ? { module, tool } : module ? { module } : { all: true };

    const startTime = Date.now();
    const results = {};

    if (this.verbose) {
      console.log('🚀 Starting full loading pipeline...');
      if (tool) {
        console.log(`   Processing single tool: ${tool} (module: ${module})`);
      } else if (module) {
        console.log(`   Processing single module: ${module}`);
      } else {
        console.log(`   Processing all modules`);
      }
      console.log(`   Clear first: ${clearFirst}`);
      console.log(`   Include perspectives: ${includePerspectives}`);
      console.log(`   Include vectors: ${includeVectors}`);
    }

    // Step 1: Clear if requested
    if (clearFirst) {
      results.clearResult = await this.clearAll();
    }

    // Step 2: Load modules
    results.loadResult = await this.loadModules(filterOptions);

    // Step 3: Generate perspectives
    if (includePerspectives) {
      results.perspectiveResult = await this.generatePerspectives(filterOptions);
    }

    // Step 4: Index vectors
    if (includeVectors) {
      results.vectorResult = await this.indexVectors(filterOptions);
    }

    const totalTime = Date.now() - startTime;

    if (this.verbose) {
      console.log(`✅ Full pipeline complete in ${(totalTime / 1000).toFixed(2)}s`);
      console.log(`   Modules loaded: ${results.loadResult?.modulesLoaded || 0}`);
      console.log(`   Tools added: ${results.loadResult?.toolsAdded || 0}`);
      if (includePerspectives) {
        console.log(`   Perspectives generated: ${results.perspectiveResult?.perspectivesGenerated || 0}`);
      }
      if (includeVectors) {
        console.log(`   Vectors indexed: ${results.vectorResult?.perspectivesIndexed || 0}`);
      }
    }

    return {
      ...results,
      totalTime,
      success: true
    };
  }

  /**
   * Run the staged pipeline with verification between stages
   * This is the NEW method that uses the PipelineOrchestrator
   * 
   * @param {Object} options - Pipeline options
   * @param {string} [options.module] - Single module name to process
   * @param {boolean} [options.forceRestart] - Force restart even if resume is possible
   * @param {boolean} [options.clearModules] - Whether to clear modules collection (default: false)
   * @returns {Promise<Object>} Pipeline execution report
   */
  async runFullPipeline(options = {}) {
    await this.#ensureInitialized();
    await this.#initializeOrchestrator();

    console.log('🚀 Starting staged pipeline with verification...');
    console.log('=' + '='.repeat(59));
    
    try {
      const result = await this.orchestrator.execute(options);
      
      // Update our state tracking from orchestrator results
      if (result.success) {
        this.pipelineState = {
          cleared: true,
          modulesLoaded: true,
          perspectivesGenerated: true,
          vectorsIndexed: true,
          lastModuleFilter: options.module || null,
          moduleCount: result.counts.tools,
          toolCount: result.counts.tools,
          perspectiveCount: result.counts.perspectives,
          vectorCount: result.counts.vectors,
          errors: []
        };
      }
      
      console.log('✅ Pipeline completed successfully');
      return result;
      
    } catch (error) {
      // Record error in state
      this.pipelineState.errors.push(error.message);
      
      console.error('❌ Pipeline failed:', error.message);
      console.log('💡 Run again to resume from last checkpoint');
      throw error;
    }
  }

  /**
   * Get current pipeline progress from orchestrator
   */
  async getPipelineProgress() {
    if (!this.orchestrator) {
      return null;
    }
    return await this.orchestrator.getProgress();
  }

  /**
   * Close all connections
   */
  async close() {
    if (this.databasePopulator) {
      await this.databasePopulator.close();
    }
    if (this.mongoProvider) {
      await this.mongoProvider.disconnect();
    }
  }

  /**
   * Discover all modules in the repository
   * Uses ModuleDiscovery to scan filesystem and register in database
   */
  async discoverModules() {
    await this.#ensureInitialized();
    
    if (this.verbose) {
      console.log('🔍 Discovering modules in repository...');
    }
    
    const discovery = new ModuleDiscovery({
      resourceManager: this.resourceManager,
      provider: this.mongoProvider,
      verbose: this.verbose
    });
    
    const result = await discovery.discover();
    
    if (this.verbose) {
      console.log(`✅ Discovery complete: ${result.stats.discovered} modules found`);
    }
    
    return result;
  }

  /**
   * Load modules from database instead of JSON registry
   * Gets the list of loadable modules from DB and loads them
   */
  async loadModulesFromDatabase(options = {}) {
    await this.#ensureInitialized();
    
    const { 
      onlyValidated = false,
      includeWarnings = true,
      filter = null
    } = options;
    
    // Build query for modules to load
    const query = {
      loadable: { $ne: false }
    };
    
    if (filter) {
      query.$or = [
        { name: { $regex: new RegExp(filter, 'i') } },
        { className: { $regex: new RegExp(filter, 'i') } }
      ];
    }
    
    if (onlyValidated) {
      query.validationStatus = 'validated';
    } else if (!includeWarnings) {
      query.validationStatus = { $ne: 'failed' };
    }
    
    // Get modules from database
    const modules = await this.mongoProvider.databaseService.mongoProvider.find('modules', query);
    
    if (this.verbose) {
      console.log(`📦 Loading ${modules.length} modules from database...`);
    }
    
    // Convert database modules to format expected by ModuleLoader
    const moduleConfigs = modules.map(m => ({
      name: m.name,
      type: m.type || 'class',
      path: m.path,
      className: m.className,
      description: m.description
    }));
    
    // Load each module
    const loadedModules = [];
    const failedModules = [];
    
    for (const config of moduleConfigs) {
      try {
        const module = await this.moduleLoader.loadModule(config);
        if (module) {
          loadedModules.push({ config, instance: module });
        }
      } catch (error) {
        failedModules.push({ config, error: error.message });
      }
    }
    
    // Update module loading status and save tools
    let toolsSaved = 0;
    let toolsFailed = 0;
    
    for (const { config, instance } of loadedModules) {
      try {
        // Update module status to loaded
        await this.mongoProvider.databaseService.mongoProvider.update(
          'modules',
          { name: config.name, className: config.className },
          {
            $set: {
              loadingStatus: 'loaded',
              lastLoadedAt: new Date(),
              toolCount: instance.getTools ? instance.getTools().length : 0
            },
            $unset: {
              loadingError: ""
            }
          }
        );
        
        // Save tools from this module
        if (instance.getTools) {
          const tools = instance.getTools();
          for (const tool of tools) {
            try {
              // Check if tool already exists
              const existingTool = await this.mongoProvider.databaseService.mongoProvider.findOne('tools', {
                name: tool.name,
                moduleName: instance.name || config.name
              });
              
              if (!existingTool) {
                // Create tool data
                const toolData = {
                  name: tool.name,
                  moduleName: instance.name || config.name,
                  description: tool.description || `${tool.name} tool from ${instance.name || config.name} module`,
                  inputSchema: tool.inputSchema || {},
                  outputSchema: tool.outputSchema || null,
                  category: 'execute',
                  status: 'active',
                  createdAt: new Date(),
                  updatedAt: new Date()
                };
                
                await this.mongoProvider.databaseService.mongoProvider.insert('tools', toolData);
                toolsSaved++;
              }
            } catch (toolError) {
              toolsFailed++;
              if (this.verbose) {
                console.log(`   ❌ Tool ${tool.name} failed: ${toolError.message}`);
              }
            }
          }
        }
      } catch (error) {
        if (this.verbose) {
          console.log(`  ❌ Failed to update module ${config.name}: ${error.message}`);
        }
      }
    }
    
    // Update failed modules
    for (const { config, error } of failedModules) {
      await this.mongoProvider.databaseService.mongoProvider.update(
        'modules',
        { name: config.name, className: config.className },
        {
          $set: {
            loadingStatus: 'failed',
            loadingError: error,
            lastLoadedAt: new Date()
          }
        }
      );
    }
    
    return {
      loaded: loadedModules,
      failed: failedModules,
      summary: {
        total: modules.length,
        loaded: loadedModules.length,
        failed: failedModules.length,
        toolsSaved,
        toolsFailed
      }
    };
  }

  /**
   * Validate all modules and tools
   * Updates database with validation status
   */
  async validateModules(options = {}) {
    await this.#ensureInitialized();
    
    if (this.verbose) {
      console.log('✅ Validating modules and tools...');
    }
    
    const validator = new ComprehensiveValidator({
      resourceManager: this.resourceManager,
      provider: this.mongoProvider,
      moduleLoader: this.moduleLoader,
      verbose: this.verbose
    });
    
    const result = await validator.validateAllModules();
    
    if (this.verbose) {
      console.log(`✅ Validation complete: ${result.modules.validated}/${result.modules.total} validated`);
    }
    
    return result;
  }

  /**
   * Complete enhanced pipeline with discovery and validation
   */
  async enhancedPipeline(options = {}) {
    const {
      discover = true,
      validate = true,
      clearFirst = false,
      includePerspectives = false,
      includeVectors = false,
      onlyValidated = false
    } = options;
    
    const startTime = Date.now();
    const results = {};
    
    if (this.verbose) {
      console.log('🚀 Starting enhanced loading pipeline...');
      console.log(`   Discover: ${discover}`);
      console.log(`   Validate: ${validate}`);
      console.log(`   Clear first: ${clearFirst}`);
    }
    
    // Step 1: Clear if requested
    if (clearFirst) {
      results.clearResult = await this.clearAll();
    }
    
    // Step 2: Discover modules
    if (discover) {
      results.discoveryResult = await this.discoverModules();
    }
    
    // Step 3: Load modules from database
    results.loadResult = await this.loadModules();
    
    // Step 4: Validate if requested
    if (validate) {
      results.validationResult = await this.validateModules();
    }
    
    // Step 5: Generate perspectives if requested
    if (includePerspectives) {
      results.perspectiveResult = await this.generatePerspectives();
    }
    
    // Step 6: Index vectors if requested
    if (includeVectors) {
      results.vectorResult = await this.indexVectors();
    }
    
    const totalTime = Date.now() - startTime;
    
    // Final verification of the complete system
    if (this.verifier) {
      if (this.verbose) {
        console.log('\n🔍 Running final system verification...');
      }
      const verification = await this.verifier.verifySystem();
      results.verification = verification;
      
      if (this.verbose) {
        this.verifier.logResults(verification);
      }
      
      if (!verification.success) {
        throw new Error(`Pipeline verification failed: ${verification.errors.join(', ')}`);
      }
    }
    
    if (this.verbose) {
      console.log(`✅ Enhanced pipeline complete in ${(totalTime / 1000).toFixed(2)}s`);
      console.log(`   Modules discovered: ${results.discoveryResult?.stats.discovered || 0}`);
      console.log(`   Modules loaded: ${results.loadResult?.modulesLoaded || 0}`);
      console.log(`   Modules validated: ${results.validationResult?.modules.validated || 0}`);
      console.log(`   Tools added: ${results.loadResult?.toolsAdded || 0}`);
    }
    
    return {
      ...results,
      totalTime,
      success: true
    };
  }

  /**
   * Get current pipeline state
   */
  getPipelineState() {
    return {
      ...this.pipelineState,
      isComplete: this.pipelineState.modulesLoaded && 
                 this.pipelineState.perspectivesGenerated && 
                 this.pipelineState.vectorsIndexed,
      hasErrors: this.pipelineState.errors.length > 0
    };
  }

  /**
   * Reset pipeline state
   */
  resetPipelineState() {
    this.pipelineState = {
      cleared: false,
      modulesLoaded: false,
      perspectivesGenerated: false,
      vectorsIndexed: false,
      lastModuleFilter: null,
      moduleCount: 0,
      toolCount: 0,
      perspectiveCount: 0,
      vectorCount: 0,
      errors: []
    };
  }

  /**
   * Ensure LoadingManager is initialized
   */
  async #ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}