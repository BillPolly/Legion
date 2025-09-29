/**
 * StrategyDataSource - DataSource implementation for strategy resources
 *
 * Enables loading task strategies from JavaScript files and instantiating them with context.
 * Strategies are loaded dynamically from files and can be analyzed for metadata.
 *
 * URI Examples:
 * - legion://local/strategy/agents/roma-agent/src/strategies/simple-node/SimpleNodeTestStrategy.js
 * - legion://local/strategy/relative/path/MyCustomStrategy.js
 *
 * Usage:
 * ```javascript
 * const handle = await resourceManager.createHandleFromURI('legion://local/strategy/path/to/strategy.js');
 *
 * // Load strategy factory
 * const factory = await handle.loadStrategy();
 *
 * // Instantiate with context
 * const strategy = await handle.instantiate(context, options);
 * ```
 */

import { validateDataSourceInterface } from '@legion/handle/src/DataSource.js';
import path from 'path';
import { fileURLToPath } from 'url';

export class StrategyDataSource {
  constructor(context) {
    if (!context || !context.resourceManager) {
      throw new Error('Context with ResourceManager is required');
    }

    this.context = context;
    this.resourceManager = context.resourceManager;
    this.parsed = context.parsed;

    // Strategy file path from URI
    this.filePath = this.parsed.path || '';
    this.server = this.parsed.server;
    this.resourceType = this.parsed.resourceType;

    // Strategy cache
    this._strategyFactory = null;
    this._strategyMetadata = null;
    this._loadedStrategy = null;

    // Validate interface compliance
    validateDataSourceInterface(this, 'StrategyDataSource');
  }

  /**
   * Execute query against strategy - SYNCHRONOUS
   * @param {Object} querySpec - Query specification
   * @returns {Array} Query results
   */
  query(querySpec) {
    throw new Error('Strategy operations are async - use StrategyHandle.queryAsync() instead of sync query()');
  }

  /**
   * Execute async query against strategy
   * @param {Object} querySpec - Query specification
   * @returns {Promise<Array>} Query results
   */
  async queryAsync(querySpec) {
    const results = [];

    try {
      if (querySpec.loadStrategy) {
        // Load the strategy factory from file
        const factory = await this._loadStrategyFactory();
        results.push({
          type: 'StrategyFactory',
          factory,
          filePath: this.filePath,
          data: factory
        });
      } else if (querySpec.instantiate) {
        // Load and instantiate strategy with context
        const { context, options } = querySpec.instantiate;
        const strategy = await this._instantiateStrategy(context, options);
        results.push({
          type: 'Strategy',
          strategy,
          filePath: this.filePath,
          data: strategy
        });
      } else if (querySpec.getMetadata) {
        // Extract strategy metadata without full instantiation
        const metadata = await this._extractMetadata();
        results.push({
          type: 'StrategyMetadata',
          metadata,
          filePath: this.filePath,
          data: metadata
        });
      } else {
        // Default: return strategy information
        const metadata = await this._extractMetadata();
        results.push({
          type: 'StrategyInfo',
          filePath: this.filePath,
          metadata,
          data: metadata
        });
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to query strategy at ${this.filePath}: ${error.message}`);
    }
  }

  /**
   * Load strategy factory from file
   * @private
   * @returns {Promise<Function>} Strategy factory function
   */
  async _loadStrategyFactory() {
    if (this._strategyFactory) {
      return this._strategyFactory;
    }

    // Resolve absolute path
    // Note: URI parsing removes leading '/', so paths like 'Users/...' need it restored
    let absolutePath = this.filePath;
    if (!path.isAbsolute(absolutePath)) {
      // Check if it looks like an absolute path that lost its leading '/'
      if (absolutePath.startsWith('Users/') || absolutePath.startsWith('home/') || absolutePath.match(/^[A-Z]:\\/)) {
        absolutePath = '/' + absolutePath;
      } else {
        absolutePath = path.resolve(process.cwd(), absolutePath);
      }
    }

    try {
      // Dynamic import of strategy file
      const module = await import(absolutePath);

      // Extract strategy factory (try different export patterns)
      const factory = module.default
        || module.createStrategy
        || module[Object.keys(module).find(k => k.startsWith('create'))];

      if (!factory || typeof factory !== 'function') {
        throw new Error('Strategy file must export a factory function (default export or createXXXStrategy)');
      }

      this._strategyFactory = factory;
      return factory;
    } catch (error) {
      throw new Error(`Failed to load strategy from ${absolutePath}: ${error.message}`);
    }
  }

  /**
   * Instantiate strategy with context
   * @private
   * @param {Object} context - Strategy context (llmClient, toolRegistry, etc.)
   * @param {Object} options - Strategy options
   * @returns {Promise<Object>} Instantiated strategy
   */
  async _instantiateStrategy(context, options = {}) {
    const factory = await this._loadStrategyFactory();

    try {
      // Call factory to create strategy instance
      const strategy = await factory(context, options);

      if (!strategy || typeof strategy !== 'object') {
        throw new Error('Strategy factory must return a strategy object');
      }

      this._loadedStrategy = strategy;
      return strategy;
    } catch (error) {
      throw new Error(`Failed to instantiate strategy: ${error.message}`);
    }
  }

  /**
   * Extract metadata from strategy file
   * @private
   * @returns {Promise<Object>} Strategy metadata
   */
  async _extractMetadata() {
    if (this._strategyMetadata) {
      return this._strategyMetadata;
    }

    const fs = await import('fs/promises');

    // Resolve absolute path (same logic as _loadStrategyFactory)
    let absolutePath = this.filePath;
    if (!path.isAbsolute(absolutePath)) {
      if (absolutePath.startsWith('Users/') || absolutePath.startsWith('home/') || absolutePath.match(/^[A-Z]:\\/)) {
        absolutePath = '/' + absolutePath;
      } else {
        absolutePath = path.resolve(process.cwd(), absolutePath);
      }
    }

    try {
      // Read strategy file content
      const content = await fs.readFile(absolutePath, 'utf-8');

      // Extract metadata from source code
      const metadata = {
        filePath: this.filePath,
        fileName: path.basename(this.filePath),
        strategyName: this._extractStrategyName(content),
        strategyType: this._extractStrategyType(content),
        requiredTools: this._extractRequiredTools(content),
        promptSchemas: this._extractPromptSchemas(content),
        description: this._extractDescription(content),
        fileSize: content.length,
        lastModified: (await fs.stat(absolutePath)).mtime
      };

      this._strategyMetadata = metadata;
      return metadata;
    } catch (error) {
      // If file doesn't exist yet or can't be read, return minimal metadata
      return {
        filePath: this.filePath,
        fileName: path.basename(this.filePath),
        strategyName: path.basename(this.filePath, '.js'),
        error: error.message
      };
    }
  }

  /**
   * Extract strategy name from source code
   * @private
   */
  _extractStrategyName(content) {
    // Try to find: export const createXXXStrategy = ...
    const createMatch = content.match(/export\s+(?:const|function)\s+(create\w+Strategy)/);
    if (createMatch) {
      return createMatch[1].replace(/^create/, '').replace(/Strategy$/, '');
    }

    // Try to find class name
    const classMatch = content.match(/class\s+(\w+Strategy)/);
    if (classMatch) {
      return classMatch[1].replace(/Strategy$/, '');
    }

    // Fallback to filename
    return path.basename(this.filePath, '.js').replace(/Strategy$/, '');
  }

  /**
   * Extract strategy type from source code
   * @private
   */
  _extractStrategyType(content) {
    // Try to find: createTypedStrategy('strategy-type', ...)
    const typeMatch = content.match(/createTypedStrategy\s*\(\s*['"]([^'"]+)['"]/);
    if (typeMatch) {
      return typeMatch[1];
    }

    // Fallback to name-based type
    const name = this._extractStrategyName(content);
    return name.toLowerCase().replace(/([A-Z])/g, '-$1').replace(/^-/, '');
  }

  /**
   * Extract required tools from source code
   * @private
   */
  _extractRequiredTools(content) {
    // Try to find: createTypedStrategy('type', ['tool1', 'tool2'], ...)
    const toolsMatch = content.match(/createTypedStrategy\s*\([^,]+,\s*\[([^\]]+)\]/);
    if (toolsMatch) {
      return toolsMatch[1]
        .split(',')
        .map(t => t.trim().replace(/['"]/g, ''))
        .filter(t => t);
    }

    return [];
  }

  /**
   * Extract prompt schemas from source code
   * @private
   */
  _extractPromptSchemas(content) {
    // Try to find prompt schema object: { promptName: 'promptName', ... }
    const schemaMatch = content.match(/\{[^}]*\n\s*(\w+):\s*['"](\w+)['"]/g);
    if (schemaMatch) {
      return schemaMatch
        .map(m => {
          const match = m.match(/(\w+):\s*['"](\w+)['"]/);
          return match ? match[2] : null;
        })
        .filter(p => p);
    }

    return [];
  }

  /**
   * Extract description from JSDoc or comments
   * @private
   */
  _extractDescription(content) {
    // Try to find JSDoc comment at top of file
    const jsdocMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\s*\n/);
    if (jsdocMatch) {
      return jsdocMatch[1];
    }

    // Try to find single-line comment
    const commentMatch = content.match(/\/\/\s*(.+?Strategy)/);
    if (commentMatch) {
      return commentMatch[1];
    }

    return `Strategy from ${path.basename(this.filePath)}`;
  }

  /**
   * Subscribe to strategy changes (filesystem watching)
   * @param {Object} querySpec - Query specification for subscription
   * @param {Function} callback - Callback function
   * @returns {string} Subscription ID
   */
  subscribe(querySpec, callback) {
    // Strategy files don't typically need subscriptions, but we can support it
    throw new Error('Strategy file watching not yet implemented');
  }

  /**
   * Unsubscribe from changes
   * @param {string} subscriptionId - Subscription ID to cancel
   */
  unsubscribe(subscriptionId) {
    // Not implemented yet
  }

  /**
   * Create query builder for strategy resources
   * @param {Object} sourceHandle - Source handle (not used for strategies)
   * @returns {Object} Query builder interface
   */
  queryBuilder(sourceHandle) {
    // Strategies don't support complex query building like filesystems or databases
    // Return a minimal builder interface that delegates to queryAsync
    return {
      loadStrategy: () => this.queryAsync({ loadStrategy: true }),
      instantiate: (context, options) => this.queryAsync({ instantiate: { context, options } }),
      getMetadata: () => this.queryAsync({ getMetadata: true }),
      toArray: () => Promise.resolve([])
    };
  }

  /**
   * Get schema for strategy
   * @returns {Object} Strategy schema
   */
  getSchema() {
    return {
      type: 'strategy',
      properties: {
        filePath: { type: 'string', description: 'Path to strategy file' },
        strategyName: { type: 'string', description: 'Name of the strategy' },
        strategyType: { type: 'string', description: 'Type identifier for the strategy' },
        requiredTools: { type: 'array', items: { type: 'string' }, description: 'Tools required by strategy' },
        promptSchemas: { type: 'array', items: { type: 'string' }, description: 'Prompt schemas used by strategy' },
        description: { type: 'string', description: 'Strategy description' }
      },
      operations: {
        loadStrategy: 'Load strategy factory from file',
        instantiate: 'Instantiate strategy with context and options',
        getMetadata: 'Extract metadata from strategy file'
      }
    };
  }
}

export default StrategyDataSource;