/**
 * SystemService - Single Responsibility for System-wide Operations
 * 
 * Handles only system-level operations:
 * - System initialization and shutdown
 * - Health checks and monitoring
 * - Pipeline execution coordination
 * - System-wide configuration
 * 
 * Clean Architecture: Application Layer Service
 * Depends only on abstractions, not concretions
 */

export class SystemService {
  constructor(dependencies) {
    // Dependency Inversion: Depend on abstractions
    this.moduleService = dependencies.moduleService;
    this.toolService = dependencies.toolService;
    this.searchService = dependencies.searchService;
    this.cacheService = dependencies.cacheService;
    this.databaseService = dependencies.databaseService;
    this.eventBus = dependencies.eventBus;
    this.resourceManager = dependencies.resourceManager;
    
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize the entire system
   * Single responsibility: System startup coordination
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return { success: true, message: 'System already initialized' };
    }

    if (this.initializationPromise) {
      return await this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization(options);
    return await this.initializationPromise;
  }

  /**
   * Check system health
   * Single responsibility: System health validation
   */
  async checkHealth() {
    const healthChecks = {
      database: false,
      cache: false,
      modules: false,
      tools: false,
      search: false,
      overall: false
    };

    const errors = [];

    try {
      // Database health
      healthChecks.database = await this.databaseService.isHealthy();
      if (!healthChecks.database) {
        errors.push('Database connection failed');
      }
    } catch (error) {
      errors.push(`Database health check error: ${error.message}`);
    }

    try {
      // Cache health
      healthChecks.cache = await this.cacheService.isHealthy();
      if (!healthChecks.cache) {
        errors.push('Cache system failed');
      }
    } catch (error) {
      errors.push(`Cache health check error: ${error.message}`);
    }

    try {
      // Module system health
      const moduleStats = await this.moduleService.getModuleStatistics();
      healthChecks.modules = moduleStats.totalLoaded > 0;
      if (!healthChecks.modules) {
        errors.push('No modules loaded');
      }
    } catch (error) {
      errors.push(`Module health check error: ${error.message}`);
    }

    try {
      // Tool system health
      const toolStats = await this.toolService.getToolStatistics();
      healthChecks.tools = toolStats.registered > 0;
      if (!healthChecks.tools) {
        errors.push('No tools registered');
      }
    } catch (error) {
      errors.push(`Tool health check error: ${error.message}`);
    }

    try {
      // Search system health
      const searchStats = await this.searchService.getSearchStatistics();
      healthChecks.search = searchStats.vectorsIndexed > 0;
      if (!healthChecks.search) {
        errors.push('Search system not ready');
      }
    } catch (error) {
      errors.push(`Search health check error: ${error.message}`);
    }

    // Overall health
    healthChecks.overall = Object.values(healthChecks)
      .filter(key => key !== 'overall')
      .every(check => check === true);

    const result = {
      healthy: healthChecks.overall,
      checks: healthChecks,
      errors: errors.length > 0 ? errors : null,
      timestamp: new Date().toISOString()
    };

    this.eventBus.emit('system:health-check', result);

    return result;
  }

  /**
   * Execute the full initialization pipeline
   * Single responsibility: Pipeline execution coordination
   */
  async executePipeline(options = {}) {
    const {
      skipModules = false,
      skipPerspectives = false,
      skipEmbeddings = false,
      skipIndexing = false
    } = options;

    const pipeline = {
      started: new Date().toISOString(),
      steps: [],
      success: false,
      errors: []
    };

    try {
      // Step 1: Load modules
      if (!skipModules) {
        pipeline.steps.push(await this._executeModuleLoading());
      }

      // Step 2: Generate perspectives
      if (!skipPerspectives) {
        pipeline.steps.push(await this._executePerspectiveGeneration());
      }

      // Step 3: Generate embeddings
      if (!skipEmbeddings) {
        pipeline.steps.push(await this._executeEmbeddingGeneration());
      }

      // Step 4: Index vectors
      if (!skipIndexing) {
        pipeline.steps.push(await this._executeVectorIndexing());
      }

      pipeline.success = pipeline.steps.every(step => step.success);
      pipeline.completed = new Date().toISOString();

    } catch (error) {
      pipeline.errors.push(error.message);
      pipeline.failed = new Date().toISOString();
    }

    this.eventBus.emit('system:pipeline-complete', pipeline);
    return pipeline;
  }

  /**
   * Get system configuration
   * Single responsibility: System configuration retrieval
   */
  async getSystemConfiguration() {
    return {
      environment: this.resourceManager.get('env.NODE_ENV') || 'development',
      mongoUri: !!this.resourceManager.get('env.MONGO_URI'),
      qdrantUrl: !!this.resourceManager.get('env.QDRANT_URL'),
      nomicApiKey: !!this.resourceManager.get('env.NOMIC_API_KEY'),
      moduleSearchPaths: this.resourceManager.get('moduleSearchPaths') || [],
      cacheConfig: this.resourceManager.get('cacheConfig') || {},
      searchConfig: this.resourceManager.get('searchConfig') || {}
    };
  }

  /**
   * Shutdown system gracefully
   * Single responsibility: System shutdown coordination
   */
  async shutdown(options = {}) {
    const { timeout = 30000 } = options;
    
    const shutdown = {
      started: new Date().toISOString(),
      steps: [],
      success: false
    };

    try {
      // Clear caches
      shutdown.steps.push({
        name: 'cache-clear',
        success: true,
        cleared: await this.cacheService.clear()
      });

      // Close database connections
      if (this.databaseService.close) {
        await this.databaseService.close();
        shutdown.steps.push({
          name: 'database-close',
          success: true
        });
      }

      // Emit shutdown event
      this.eventBus.emit('system:shutdown', shutdown);

      shutdown.success = true;
      shutdown.completed = new Date().toISOString();
      
      this.isInitialized = false;
      this.initializationPromise = null;

    } catch (error) {
      shutdown.error = error.message;
      shutdown.failed = new Date().toISOString();
    }

    return shutdown;
  }

  /**
   * Get system statistics
   * Single responsibility: System metrics aggregation
   */
  async getSystemStatistics() {
    try {
      const [moduleStats, toolStats, searchStats, cacheStats] = await Promise.all([
        this.moduleService.getModuleStatistics(),
        this.toolService.getToolStatistics(),
        this.searchService.getSearchStatistics(),
        this.cacheService.getStatistics()
      ]);

      return {
        modules: moduleStats,
        tools: toolStats,
        search: searchStats,
        cache: cacheStats,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get system statistics: ${error.message}`);
    }
  }

  /**
   * Test system functionality end-to-end
   * Single responsibility: System validation
   */
  async testSystem(options = {}) {
    const { includeSearch = true, sampleQueries = null } = options;
    
    const tests = {
      started: new Date().toISOString(),
      results: [],
      success: false,
      errors: []
    };

    try {
      // Test module loading
      tests.results.push({
        test: 'module-loading',
        success: true,
        ...(await this.moduleService.getModuleStatistics())
      });

      // Test tool registration
      tests.results.push({
        test: 'tool-registration',
        success: true,
        ...(await this.toolService.getToolStatistics())
      });

      // Test search functionality
      if (includeSearch) {
        const searchTest = await this.searchService.testSemanticSearch(sampleQueries);
        tests.results.push({
          test: 'semantic-search',
          success: searchTest.successfulQueries > 0,
          ...searchTest
        });
      }

      tests.success = tests.results.every(result => result.success);
      tests.completed = new Date().toISOString();

    } catch (error) {
      tests.errors.push(error.message);
      tests.failed = new Date().toISOString();
    }

    this.eventBus.emit('system:test-complete', tests);
    return tests;
  }

  /**
   * Perform system initialization
   * Private helper - single responsibility
   */
  async _performInitialization(options) {
    const init = {
      started: new Date().toISOString(),
      steps: [],
      success: false
    };

    try {
      // Initialize database
      await this.databaseService.initialize();
      init.steps.push({ name: 'database', success: true });

      // Initialize cache
      if (this.cacheService.initialize) {
        await this.cacheService.initialize();
      }
      init.steps.push({ name: 'cache', success: true });

      this.isInitialized = true;
      init.success = true;
      init.completed = new Date().toISOString();

      this.eventBus.emit('system:initialized', init);

      return { success: true, initialization: init };

    } catch (error) {
      init.error = error.message;
      init.failed = new Date().toISOString();
      
      this.eventBus.emit('system:initialization-failed', init);
      
      return { success: false, error: error.message, initialization: init };
    }
  }

  /**
   * Execute module loading step
   * Private helper - single responsibility
   */
  async _executeModuleLoading() {
    const step = { name: 'module-loading', started: new Date().toISOString() };
    
    try {
      const result = await this.moduleService.loadAllModules();
      step.success = result.success;
      step.moduleCount = result.successCount;
      step.errors = result.errors;
      step.completed = new Date().toISOString();
    } catch (error) {
      step.success = false;
      step.error = error.message;
      step.failed = new Date().toISOString();
    }
    
    return step;
  }

  /**
   * Execute perspective generation step
   * Private helper - single responsibility
   */
  async _executePerspectiveGeneration() {
    const step = { name: 'perspective-generation', started: new Date().toISOString() };
    
    try {
      const result = await this.searchService.generatePerspectives();
      step.success = result.generated > 0;
      step.generated = result.generated;
      step.errors = result.errors;
      step.completed = new Date().toISOString();
    } catch (error) {
      step.success = false;
      step.error = error.message;
      step.failed = new Date().toISOString();
    }
    
    return step;
  }

  /**
   * Execute embedding generation step
   * Private helper - single responsibility
   */
  async _executeEmbeddingGeneration() {
    const step = { name: 'embedding-generation', started: new Date().toISOString() };
    
    try {
      const result = await this.searchService.generateEmbeddings();
      step.success = result.embedded > 0;
      step.embedded = result.embedded;
      step.errors = result.errors;
      step.completed = new Date().toISOString();
    } catch (error) {
      step.success = false;
      step.error = error.message;
      step.failed = new Date().toISOString();
    }
    
    return step;
  }

  /**
   * Execute vector indexing step
   * Private helper - single responsibility
   */
  async _executeVectorIndexing() {
    const step = { name: 'vector-indexing', started: new Date().toISOString() };
    
    try {
      const result = await this.searchService.indexVectors();
      step.success = result.indexed > 0;
      step.indexed = result.indexed;
      step.errors = result.errors;
      step.completed = new Date().toISOString();
    } catch (error) {
      step.success = false;
      step.error = error.message;
      step.failed = new Date().toISOString();
    }
    
    return step;
  }
}