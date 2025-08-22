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
import { SemanticSearchProvider } from '@legion/semantic-search';
import { createToolIndexer } from '../search/index.js';
import { ResourceManager } from '@legion/resource-manager';
import { PipelineVerifier } from './PipelineVerifier.js';
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
    // CRITICAL: Never re-initialize a ResourceManager that was passed in from tests
    // The test may have overridden environment values that would be lost
    if (!this.resourceManager) {
      this.resourceManager = ResourceManager.getInstance();
      if (!this.resourceManager.initialized) {
        await this.resourceManager.initialize();
      }
    } else {
      // ResourceManager was provided (likely from tests with overridden values)
      // DO NOT call initialize() as it would reload .env and overwrite test values
      console.log('LoadingManager: Using provided ResourceManager (test environment), skipping re-initialization');
    }

    // SemanticSearchProvider always uses local Nomic embeddings

    // Initialize MongoDB provider first so other components can share it
    if (!this.mongoProvider) {
      this.mongoProvider = await MongoDBToolRegistryProvider.create(this.resourceManager, {
        enableSemanticSearch: false
      });
    }

    // Initialize components with shared database provider
    this.moduleLoader = new ModuleLoader({
      verbose: this.verbose,
      resourceManager: this.resourceManager,
      databaseProvider: this.mongoProvider  // Share the same database provider
    });

    this.databasePopulator = new DatabasePopulator({
      verbose: this.verbose
    });
    await this.databasePopulator.initialize();

    // Don't initialize semantic search components until needed
    // this.semanticSearchProvider = await SemanticSearchProvider.create(this.resourceManager);
    // this.toolIndexer = await createToolIndexer(this.resourceManager);

    // Initialize verifier with basic MongoDB provider (vectorStore will be added when semantic search is initialized)
    this.verifier = new PipelineVerifier(this.mongoProvider.databaseService.mongoProvider, null);

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
    
    // Update verifier with vectorStore if semantic search is available
    if (this.verifier && this.semanticSearchProvider?.vectorStore) {
      if (this.verbose) {
        console.log('🔍 Updating Verifier with vector store...');
      }
      this.verifier.vectorStore = this.semanticSearchProvider.vectorStore;
      if (this.verbose) {
        console.log('✅ Verifier updated with vector store');
      }
    }
  }

  /**
   * Clear for reload - Manages the two-collection architecture
   * 
   * IMPORTANT: This method works with two separate collections:
   * 1. module_registry - Permanent record of discovered modules (NEVER deleted, only status updated)
   * 2. modules - Runtime state of loaded modules (cleared when reloading)
   * 
   * Two modes of operation:
   * 
   * Mode 1: Clear ALL modules (moduleFilter = null)
   * - Deletes ALL records from 'modules' collection
   * - Updates ALL records in 'module_registry' to status='unloaded'
   * - Clears ALL tools and perspectives
   * - Optionally clears ALL vectors from Qdrant
   * 
   * Mode 2: Clear SPECIFIC module (moduleFilter = 'moduleName')
   * - Deletes only matching records from 'modules' collection
   * - Updates only matching record in 'module_registry' to status='unloaded'
   * - Clears only tools and perspectives for that module
   * - Optionally clears only vectors for that module
   * 
   * @param {Object} options - Clear options
   * @param {boolean} options.clearVectors - Whether to clear vector database (default: true)
   * @param {string} options.moduleFilter - Module name to clear, or null to clear all modules
   */
  async clearForReload(options = {}) {
    await this.#ensureInitialized();

    const { 
      clearVectors = true,
      moduleFilter = null
    } = options;

    if (this.verbose) {
      console.log('🧹 Clearing for reload...');
      console.log(`   Clear vectors: ${clearVectors}`);
      if (moduleFilter) {
        console.log(`   Module filter: ${moduleFilter}`);
      }
    }

    let totalCleared = 0;

    // Build query filters based on operation mode
    // If moduleFilter is provided: clear only that module
    // If moduleFilter is null: clear all modules
    const moduleQuery = moduleFilter ? { name: moduleFilter } : {};
    const toolQuery = moduleFilter ? { moduleName: moduleFilter } : {};

    // Track when modules were cleared (used to prevent automatic reloading during operations)
    const clearedTimestamp = new Date();

    // STEP 1: Clear the 'modules' collection (runtime state)
    // This removes the actual loaded module instances
    // In single-module mode: only removes that module's runtime record
    // In all-modules mode: clears entire collection
    const modulesResult = await this.mongoProvider.databaseService.mongoProvider.db.collection('modules').deleteMany(moduleQuery);
    totalCleared += modulesResult.deletedCount;
    if (this.verbose) {
      const target = moduleFilter ? ` for module '${moduleFilter}'` : '';
      console.log(`  ✅ Cleared modules collection${target}: ${modulesResult.deletedCount} records deleted`);
    }

    // STEP 2: Update 'module_registry' status (permanent registry)
    // This preserves the module discovery information but marks them as unloaded
    // The module can be reloaded later without re-discovering it
    const registryResult = await this.mongoProvider.databaseService.mongoProvider.db.collection('module_registry').updateMany(
      moduleQuery,
      {
        $set: {
          loadingStatus: 'unloaded',      // Mark as not currently loaded
          validationStatus: 'pending',     // Needs re-validation when loaded
          clearedAt: clearedTimestamp,     // Track when it was cleared
          clearedForReload: true           // Flag indicating it's ready for reload
        }
      }
    );
    if (this.verbose) {
      const target = moduleFilter ? ` for module '${moduleFilter}'` : '';
      console.log(`  ✅ Updated module_registry${target}: ${registryResult.modifiedCount} statuses set to 'unloaded'`);
    }

    // Clear tools and perspectives (with optional filter)
    const toolResult = await this.mongoProvider.databaseService.mongoProvider.db.collection('tools').deleteMany(toolQuery);
    totalCleared += toolResult.deletedCount;
    if (this.verbose) {
      const target = moduleFilter ? ` for module '${moduleFilter}'` : '';
      console.log(`  ✅ Cleared tools${target}: ${toolResult.deletedCount} records deleted`);
    }

    const perspectiveResult = await this.mongoProvider.databaseService.mongoProvider.db.collection('tool_perspectives').deleteMany(toolQuery);
    totalCleared += perspectiveResult.deletedCount;
    if (this.verbose) {
      const target = moduleFilter ? ` for module '${moduleFilter}'` : '';
      console.log(`  ✅ Cleared perspectives${target}: ${perspectiveResult.deletedCount} records deleted`);
    }

    // Clear vectors if requested - ALWAYS initialize semantic search for clearing
    if (clearVectors) {
      await this.#ensureSemanticSearchInitialized();
      const qdrantCollections = ['legion_tools'];
      
      if (this.verbose) {
        const target = moduleFilter ? ` for module '${moduleFilter}'` : '';
        console.log(`  🧹 Clearing Qdrant vectors${target}...`);
      }
      
      for (const collectionName of qdrantCollections) {
        try {
          if (moduleFilter) {
            // Module-specific vector deletion
            // Find vectors with the module name in their payload
            const searchResult = await this.semanticSearchProvider.search(collectionName, 
              Array(768).fill(0), // dummy vector for search
              {
                limit: 1000, // reasonable batch size
                filter: {
                  must: [
                    { key: 'moduleName', match: { value: moduleFilter } }
                  ]
                }
              }
            );
            
            if (searchResult && searchResult.length > 0) {
              const vectorIds = searchResult.map(result => result.id);
              await this.semanticSearchProvider.vectorStore.delete(collectionName, vectorIds);
              
              if (this.verbose) {
                console.log(`  ✅ Deleted ${vectorIds.length} vectors for module '${moduleFilter}' from '${collectionName}'`);
              }
              totalCleared += vectorIds.length;
            } else if (this.verbose) {
              console.log(`  ℹ️ No vectors found for module '${moduleFilter}' in '${collectionName}'`);
            }
          } else {
            // Full collection deletion (original behavior)
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
          }
        } catch (error) {
          if (!error.message.includes('Not found')) {
            if (this.verbose) {
              console.log(`  ⚠️ Could not clear '${collectionName}': ${error.message}`);
            }
          }
        }

        // Note: We don't recreate the collection - it will be created when needed during upsert
        // This prevents arbitrarily creating collections during initialization
      }
    }

    // Verify clearing actually worked - ensure verifier is initialized
    if (!moduleFilter) {
      // For full clearing, ensure verifier is available and verify all collections are empty
      if (!this.verifier) {
        await this.#ensureSemanticSearchInitialized();
      }
      
      if (this.verifier) {
        const clearingVerification = await this.verifier.verifyCleared();
        if (!clearingVerification.success) {
          if (this.verbose) {
            console.log(`❌ Full clearing verification failed: ${clearingVerification.message}`);
          }
          throw new Error(`Full clearing verification failed: ${clearingVerification.message}`);
        }
        if (this.verbose) {
          console.log('✅ Full clearing verification passed');
        }
      }
    } else {
      if (this.verbose) {
        console.log(`✅ Module ${moduleFilter} clearing completed (verification skipped for module-specific clearing)`);
      }
    }
    
    // Show clearing summary if verifier is available
    if (this.verifier) {
      
      if (this.verbose) {
        console.log(`✅ Clearing verified:`);
        console.log(`   Tools cleared: ${toolResult.deletedCount}`);
        console.log(`   Perspectives cleared: ${perspectiveResult.deletedCount}`);
        if (clearVectors) {
          console.log(`   Vectors cleared: ${totalCleared - toolResult.deletedCount - perspectiveResult.deletedCount}`);
        }
        console.log(`   Module registry updated: ${registryResult.modifiedCount} modules marked as unloaded`);
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

        // Note: We don't recreate the collection - it will be created when needed during upsert
        // This prevents arbitrarily creating collections during initialization
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

    // Clear module-specific data before populating if we have a filter
    const shouldClearFirst = !!moduleFilter;

    if (shouldClearFirst) {
      if (this.verbose) {
        console.log(`🧹 Clearing database data for module: ${moduleFilter}`);
      }
      await this.clearForReload({
        moduleFilter: moduleFilter,
        clearVectors: true // Clear vectors too
      });
    }

    // Populate database with loaded modules - no need to clear since we did it above
    const popResult = await this.databasePopulator.populate(modulesToPopulate, {
      clearExisting: false // We already cleared what we needed above
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
      // NOTE: Use module_registry collection (where discovery saves modules), not modules collection (runtime state)
      const module = await this.mongoProvider.databaseService.mongoProvider.findOne('module_registry', { 
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
    
    // Update module indexing status - check if exists first, then update/insert appropriately
    for (const [moduleName, perspectiveCount] of Object.entries(modulesPerspectives)) {
      try {
        // Check if module already exists
        const existingModule = await this.mongoProvider.databaseService.mongoProvider.findOne(
          'modules',
          { name: moduleName }
        );
        
        if (existingModule) {
          // Update existing module
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
        } else {
          // Insert new module with all required fields
          await this.mongoProvider.databaseService.mongoProvider.insert(
            'modules',
            {
              name: moduleName,
              description: `${moduleName} module automatically discovered and loaded during tool registry indexing process. This module provides various tools and functionality within the Legion framework ecosystem.`,
              type: 'dynamic',
              path: `modules/${moduleName}`,
              indexingStatus: 'indexed',
              lastIndexedAt: new Date(),
              perspectiveCount: perspectiveCount,
              indexingError: null,
              createdAt: new Date(),
              status: 'active',
              loadingStatus: 'pending'
            }
          );
        }
      } catch (error) {
        console.warn(`Failed to update indexing status for module ${moduleName}: ${error.message}`);
        this.pipelineState.errors.push(`Failed to update module ${moduleName} indexing status: ${error.message}`);
      }
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
   * Generate embeddings for perspectives
   * @param {string|Object} options - Module filter string or options object
   * @param {string} [options.module] - Single module name to process
   * @param {boolean} [options.all] - Process all modules (default: true)
   */
  async generateEmbeddings(options = {}) {
    await this.#ensureInitialized();
    await this.#ensureSemanticSearchInitialized();

    // Normalize options
    const opts = typeof options === 'string' 
      ? { module: options }
      : { all: true, ...options };

    // Check prerequisites - look for actual perspectives in database
    const perspectiveCount = await this.mongoProvider.databaseService.mongoProvider.count('tool_perspectives', {});
    if (perspectiveCount === 0) {
      throw new Error('Cannot generate embeddings: no perspectives found in database. Run generatePerspectives() first.');
    }

    // Log what we're doing
    if (this.verbose) {
      if (opts.module) {
        console.log(`🧮 Generating embeddings for module: ${opts.module}`);
      } else {
        console.log(`🧮 Generating embeddings for all perspectives...`);
      }
    }

    // Import and create GenerateEmbeddingsStage
    const { GenerateEmbeddingsStage } = await import('./stages/GenerateEmbeddingsStage.js');
    const embeddingStage = new GenerateEmbeddingsStage({
      embeddingService: this.semanticSearchProvider.embeddingService,
      mongoProvider: this.mongoProvider.databaseService.mongoProvider,
      verifier: this.verifier,
      stateManager: this.stateManager,
      batchSize: 50
    });

    // Execute embedding generation
    const result = await embeddingStage.execute(opts);

    // Update pipeline state
    this.pipelineState.embeddingsGenerated = true;

    return {
      embeddingsGenerated: result.embeddingsGenerated || result.perspectivesProcessed || 0,
      perspectivesProcessed: result.perspectivesProcessed || 0,
      batchesProcessed: result.batchesProcessed || 0,
      success: result.success
    };
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

    // Check prerequisites - look for actual data in database
    const toolCount = await this.mongoProvider.databaseService.mongoProvider.count('tools', {});
    if (toolCount === 0) {
      throw new Error('Cannot index vectors: no tools found in database. Run loadModules() first.');
    }

    const perspectiveCount = await this.mongoProvider.databaseService.mongoProvider.count('tool_perspectives', {});
    if (perspectiveCount === 0) {
      throw new Error('Cannot index vectors: no perspectives found in database. Run generatePerspectives() first.');
    }

    const embeddingCount = await this.mongoProvider.databaseService.mongoProvider.count('tool_perspectives', {
      embedding: { $exists: true, $ne: null }
    });
    if (embeddingCount === 0) {
      throw new Error('Cannot index vectors: no embeddings found in database. Run generateEmbeddings() first.');
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
      // NOTE: Use module_registry collection (where discovery saves modules), not modules collection (runtime state)
      const module = await this.mongoProvider.databaseService.mongoProvider.findOne('module_registry', { 
        name: { $regex: new RegExp(`^${opts.module}$`, 'i') }
      });
      
      // Get tools for this module - use moduleName since that's how tools are stored
      const toolQuery = { moduleName: opts.module };
      const tools = await this.mongoProvider.databaseService.mongoProvider.find('tools', toolQuery);
      const toolIds = tools.map(t => t._id);
      const toolNames = tools.map(t => t.name);
      
      if (tools.length === 0) {
        if (this.verbose) {
          console.log(`⚠️ No tools found for module: ${opts.module}`);
        }
        this.pipelineState.errors.push(`No tools found for vector indexing (module: ${opts.module})`);
        return { perspectivesIndexed: 0, toolsProcessed: 0 };
      }
      
      // Query by toolId to get only perspectives for current tools (not old ones with same name)
      query.toolId = { $in: toolIds };
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
      // Debug: Check current count before upserting
      const currentCount = await this.toolIndexer.vectorStore.count(this.toolIndexer.collectionName);
      console.log(`📊 Current vectors in Qdrant before upsert: ${currentCount}`);
      
      // Debug: Show the IDs we're about to upsert
      const idsToUpsert = perspectives.map(p => p._id?.toString()).slice(0, 3);
      console.log(`📋 Sample IDs to upsert: ${idsToUpsert.join(', ')}`);
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
      // First delete existing vectors for this module to avoid duplicates
      if (opts.module) {
        // Delete by toolName filter for module-specific indexing
        const toolNames = new Set(perspectives.map(p => p.toolName));
        for (const toolName of toolNames) {
          try {
            await this.toolIndexer.vectorStore.deleteByFilter(this.toolIndexer.collectionName, {
              toolName: toolName
            });
            if (this.verbose) {
              console.log(`🗑️ Deleted existing vectors for tool: ${toolName}`);
            }
          } catch (deleteError) {
            // Continue if delete fails (vectors might not exist)
            if (this.verbose) {
              console.log(`⚠️ Could not delete existing vectors for ${toolName}: ${deleteError.message}`);
            }
          }
        }
      }
      
      // Now insert the new vectors
      await this.toolIndexer.vectorStore.upsert(this.toolIndexer.collectionName, vectors);

      if (this.verbose) {
        console.log(`✅ Indexed ${vectors.length} vectors from ${new Set(perspectives.map(p => p.toolName)).size} tools`);
        // Debug: Check count immediately after upserting
        const afterCount = await this.toolIndexer.vectorStore.count(this.toolIndexer.collectionName);
        console.log(`📊 Vectors in Qdrant immediately after insert: ${afterCount}`);
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
    
    // Get modules from registry (where discovered modules are stored)
    // NOTE: Use module_registry collection to find modules to load, not modules collection (runtime state)
    const modules = await this.mongoProvider.databaseService.mongoProvider.find('module_registry', query);
    
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
        // Check if module was recently cleared - don't automatically mark as loaded
        const existingModule = await this.mongoProvider.databaseService.mongoProvider.findOne('modules', { name: config.name });
        const wasRecentlyCleared = existingModule && existingModule.clearedForReload && 
          existingModule.clearedAt && (Date.now() - existingModule.clearedAt.getTime()) < 300000; // 5 minutes
          
        // Update module status to loaded, but respect cleared state - use upsert to handle missing modules
        const updateData = {
          $set: {
            loadingStatus: wasRecentlyCleared ? 'unloaded' : 'loaded',
            lastLoadedAt: new Date(),
            toolCount: instance.getTools ? instance.getTools().length : 0
          },
          $unset: {
            loadingError: ""
          },
          $setOnInsert: {
            name: config.name,
            description: config.description || `${config.name} module automatically loaded into the tool registry system. This module provides various tools and functionality within the Legion framework ecosystem.`,
            type: config.type || 'class',
            path: config.path || `modules/${config.name}`,
            createdAt: new Date(),
            status: 'active'
          }
        };
        
        // Clear the clearedForReload flag only if we're actually loading it
        if (!wasRecentlyCleared) {
          updateData.$unset.clearedForReload = "";
          updateData.$unset.clearedAt = "";
        }
        
        await this.mongoProvider.databaseService.mongoProvider.update(
          'modules',
          { name: config.name, className: config.className },
          updateData,
          { upsert: true }
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
    
    // Update failed modules - use upsert to handle missing modules
    for (const { config, error } of failedModules) {
      try {
        await this.mongoProvider.databaseService.mongoProvider.update(
          'modules',
          { name: config.name, className: config.className },
          {
            $set: {
              loadingStatus: 'failed',
              loadingError: error,
              lastLoadedAt: new Date()
            },
            $setOnInsert: {
              name: config.name,
              description: config.description || `${config.name} module encountered loading errors in the tool registry system. This module may require additional configuration or dependencies to function properly.`,
              type: config.type || 'class',
              path: config.path || `modules/${config.name}`,
              createdAt: new Date(),
              status: 'maintenance'
            }
          },
          { upsert: true }
        );
      } catch (updateError) {
        console.warn(`Failed to update failed module ${config.name}: ${updateError.message}`);
      }
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
      const verification = await this.verifier.runFinalVerification();
      results.verification = verification;
      
      if (this.verbose) {
        console.log(`📊 Final verification: ${verification.message}`);
        if (verification.toolCount !== undefined) {
          console.log(`   Tools: ${verification.toolCount}`);
          console.log(`   Perspectives: ${verification.perspectiveCount}`);
          console.log(`   Vectors: ${verification.vectorCount}`);
        }
      }
      
      if (!verification.success) {
        throw new Error(`Pipeline verification failed: ${verification.message}`);
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

  /**
   * Cleanup resources - close database connections
   */
  async cleanup() {
    try {
      // Close MongoDB connection if it exists
      if (this.mongoProvider && this.mongoProvider.databaseService) {
        if (this.mongoProvider.databaseService.cleanup) {
          await this.mongoProvider.databaseService.cleanup();
        } else if (this.mongoProvider.databaseService.disconnect) {
          await this.mongoProvider.databaseService.disconnect();
        }
      }
      
      // Close vector store connection if it exists
      if (this.vectorStore && this.vectorStore.disconnect) {
        await this.vectorStore.disconnect();
      }
      
      // Clear tool indexer if it exists
      if (this.toolIndexer && this.toolIndexer.cleanup) {
        await this.toolIndexer.cleanup();
      }
      
      this.initialized = false;
    } catch (error) {
      console.warn('LoadingManager cleanup warning:', error.message);
    }
  }
}