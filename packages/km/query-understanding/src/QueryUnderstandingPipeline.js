/**
 * QueryUnderstandingPipeline - Main orchestrator for natural language query understanding
 *
 * Implements the 4-phase pipeline:
 * 1. Rewrite & Resolve (LLM) - Normalize questions
 * 2. NP/VP AST (Deterministic) - Parse into tree structure
 * 3. Semantic Mapping & Constraints (Semantic Search) - Map to ontology, build LogicalSkeleton
 * 4. Query Generation (DataSource Integration) - Convert to DataScript queries
 *
 * @module @legion/query-understanding
 */

export class QueryUnderstandingPipeline {
  /**
   * Create a new QueryUnderstandingPipeline
   *
   * @param {Object} resourceManager - ResourceManager instance (REQUIRED!)
   * @throws {Error} If resourceManager is not provided or not initialized
   */
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required for QueryUnderstandingPipeline');
    }

    this.resourceManager = resourceManager;
    this.initialized = false;

    // Phase processors (initialized in initialize())
    this.phase1 = null;  // RewriteResolver
    this.phase2 = null;  // NPVPParser
    this.phase3 = null;  // SemanticMapper + TreeWalker
    this.phase4 = null;  // DataScriptConverter

    // Dependencies (retrieved from ResourceManager)
    this.llmClient = null;
    this.semanticSearch = null;
    this.ontology = null;
    this.dataSource = null;
  }

  /**
   * Initialize the pipeline with required dependencies
   *
   * @param {Object} options - Configuration options
   * @param {string} [options.dataSource='dataStoreDataSource'] - DataSource to use (dataStoreDataSource, tripleStoreDataSource, graphDataSource)
   * @param {string} [options.domain] - Optional domain hint for disambiguation
   * @param {string} [options.ontologyCollectionName] - Qdrant collection name for ontology
   * @returns {Promise<void>}
   * @throws {Error} If required resources are not available
   */
  async initialize(options = {}) {
    const {
      dataSource = 'dataStoreDataSource',
      domain = null,
      ontologyCollectionName = 'default-ontology'
    } = options;

    // Get dependencies from ResourceManager
    // FAIL FAST if not available
    this.llmClient = await this.resourceManager.get('llmClient');
    if (!this.llmClient) {
      throw new Error('LLM client not available in ResourceManager - required for Phase 1');
    }

    this.semanticSearch = await this.resourceManager.get('semanticSearch');
    if (!this.semanticSearch) {
      throw new Error('Semantic search not available in ResourceManager - required for Phase 3');
    }

    // Ontology is optional - if not provided, SemanticMapper will use collection only
    this.ontology = await this.resourceManager.get('ontology');

    // DataSource is optional for ConvFinQA (we use FactQueryExecutor instead)
    this.dataSource = options.skipDataSource ? null : await this.resourceManager.get(dataSource);

    if (!options.skipDataSource && !this.dataSource) {
      throw new Error(`DataSource '${dataSource}' not available in ResourceManager - required for Phase 4`);
    }

    // Validate DataSource implements required interface (if provided)
    if (this.dataSource && typeof this.dataSource.query !== 'function') {
      throw new Error(`DataSource '${dataSource}' does not implement required query() method`);
    }

    // Store configuration
    this.config = {
      dataSourceName: dataSource,
      domain
    };

    // Initialize phase processors
    const { RewriteResolver } = await import('./phase1/RewriteResolver.js');
    const { NPVPParser } = await import('./phase2/NPVPParser.js');
    const { SemanticMapper } = await import('./phase3/SemanticMapper.js');
    const { TreeWalker } = await import('./phase3/TreeWalker.js');
    const { DataScriptConverter } = await import('./phase4/DataScriptConverter.js');

    this.phase1 = new RewriteResolver(this.llmClient);
    this.phase2 = new NPVPParser(this.llmClient);
    await this.phase2.initialize();

    // Phase 3 needs SemanticMapper + TreeWalker
    this.semanticMapper = new SemanticMapper(this.semanticSearch, {
      collectionName: options.ontologyCollectionName || 'default-ontology',
      confidenceThreshold: 0.6
    });
    this.phase3 = new TreeWalker(this.semanticMapper);

    this.phase4 = new DataScriptConverter();

    this.initialized = true;
  }

  /**
   * Process a natural language question through all 4 phases
   *
   * @param {string} question - Natural language question
   * @param {Object} context - Optional context (conversation history, domain hints, etc.)
   * @returns {Promise<Object>} Result object with queries and intermediate artifacts
   * @throws {Error} If pipeline not initialized or processing fails
   */
  async process(question, context = {}) {
    if (!this.initialized) {
      throw new Error('Pipeline not initialized - call initialize() first');
    }

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      throw new Error('Question must be a non-empty string');
    }

    try {
      // Phase 1: Rewrite & Resolve
      const canonicalQuestion = await this.phase1.resolve(question, {
        ...context,
        domain: this.config.domain
      });

      // Phase 2: NP/VP AST Parsing
      const ast = await this.phase2.parse(canonicalQuestion);

      // Phase 3: Semantic Mapping & LogicalSkeleton
      const logicalSkeleton = await this.phase3.walk(ast);

      // Phase 4: DataScript Conversion
      const dataScriptQuery = this.phase4.convert(logicalSkeleton);

      // Execute query against DataSource (if available)
      let results = null;
      if (this.dataSource) {
        results = await this.dataSource.query(dataScriptQuery);
      }

      // Return complete result object
      return {
        resolvedQuestion: canonicalQuestion,
        ast,
        skeleton: logicalSkeleton,
        query: dataScriptQuery,
        results
      };
    } catch (error) {
      throw new Error(`Pipeline processing failed: ${error.message}`);
    }
  }

  /**
   * Check if pipeline is ready to process questions
   *
   * @returns {boolean} True if initialized and ready
   */
  isReady() {
    return this.initialized &&
           this.llmClient !== null &&
           this.semanticSearch !== null &&
           this.ontology !== null &&
           this.dataSource !== null;
  }

  /**
   * Get pipeline status and configuration
   *
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      initialized: this.initialized,
      ready: this.isReady(),
      config: this.config || null,
      dependencies: {
        llmClient: this.llmClient !== null,
        semanticSearch: this.semanticSearch !== null,
        ontology: this.ontology !== null,
        dataSource: this.dataSource !== null
      }
    };
  }
}

export default QueryUnderstandingPipeline;
