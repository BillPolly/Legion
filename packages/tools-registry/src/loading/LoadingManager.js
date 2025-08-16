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
import { MongoDBToolRegistryProvider } from '../providers/MongoDBToolRegistryProvider.js';
import { SemanticSearchProvider } from '../../../semantic-search/src/SemanticSearchProvider.js';
import { createToolIndexer } from '../search/index.js';
import { ResourceManager } from '@legion/resource-manager';

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

    // SemanticSearchProvider always uses local ONNX embeddings

    // Initialize components
    this.moduleLoader = new ModuleLoader({
      verbose: this.verbose,
      resourceManager: this.resourceManager
    });

    this.databasePopulator = new DatabasePopulator({
      verbose: this.verbose
    });

    // Only create MongoDB provider if not provided (allows sharing connections)
    if (!this.mongoProvider) {
      this.mongoProvider = await MongoDBToolRegistryProvider.create(this.resourceManager, {
        enableSemanticSearch: false
      });
    }

    // Don't initialize semantic search components until needed
    // this.semanticSearchProvider = await SemanticSearchProvider.create(this.resourceManager);
    // this.toolIndexer = await createToolIndexer(this.resourceManager);

    this.initialized = true;

    if (this.verbose) {
      console.log('✅ LoadingManager initialized with all components');
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
  }

  /**
   * Clear all databases (MongoDB collections + Qdrant vectors)
   */
  async clearAll() {
    await this.#ensureInitialized();

    if (this.verbose) {
      console.log('🧹 Clearing all databases...');
    }

    let totalCleared = 0;

    // Clear MongoDB collections
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

    for (const tool of tools) {
      try {
        // The ToolIndexer.indexTool method requires toolId as third parameter
        const toolId = tool._id || tool.toolId;
        const metadata = { module: tool.moduleName };
        
        const result = await this.toolIndexer.indexTool(tool, metadata, toolId);
        
        if (result.success) {
          perspectivesGenerated += result.perspectivesIndexed || 0;
          toolsProcessed++;
          
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
      id: perspective.embeddingId || `tool_${perspective.toolName}_${perspective.perspectiveType}_${Date.now() + index}`,
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