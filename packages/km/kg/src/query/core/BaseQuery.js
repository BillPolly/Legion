/**
 * Base class for all query entities in the knowledge graph
 */
export class BaseQuery {
  constructor(id = null) {
    this._kgId = id || this.generateId();
    this.createdAt = new Date().toISOString();
    this.metadata = new Map();
    this.executionStats = {
      executionCount: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      lastExecuted: null,
      resultCount: 0
    };
  }

  generateId() {
    return `query_${Math.random().toString(36).substr(2, 9)}`;
  }

  getId() {
    return this._kgId;
  }

  setMetadata(key, value) {
    this.metadata.set(key, value);
    return this;
  }

  getMetadata(key) {
    return this.metadata.get(key);
  }

  /**
   * Convert query to KG triples for storage
   */
  toTriples() {
    const id = this.getId();
    const triples = [];

    // Basic query metadata
    triples.push([id, 'rdf:type', 'kg:Query']);
    triples.push([id, 'kg:queryType', this.constructor.name]);
    triples.push([id, 'kg:created', this.createdAt]);

    // Add metadata
    for (const [key, value] of this.metadata.entries()) {
      triples.push([id, `kg:${key}`, value]);
    }

    // Add execution statistics
    const statsId = `${id}_stats`;
    triples.push([id, 'kg:executionStats', statsId]);
    triples.push([statsId, 'rdf:type', 'kg:ExecutionStats']);
    triples.push([statsId, 'kg:executionCount', this.executionStats.executionCount]);
    triples.push([statsId, 'kg:totalExecutionTime', this.executionStats.totalExecutionTime]);
    triples.push([statsId, 'kg:averageExecutionTime', this.executionStats.averageExecutionTime]);
    if (this.executionStats.lastExecuted) {
      triples.push([statsId, 'kg:lastExecuted', this.executionStats.lastExecuted]);
    }
    triples.push([statsId, 'kg:resultCount', this.executionStats.resultCount]);

    return triples;
  }

  /**
   * Execute the query against a knowledge graph
   */
  async execute(kgEngine, context = {}) {
    const startTime = Date.now();
    const timeout = context.timeout || 5000; // Reduced to 5 second timeout for testing
    const queryId = this.getId();
    const queryType = this.constructor.name;
    
    console.log(`[QUERY EXEC START] ${queryType} ${queryId} - Stack depth: ${(context.executionStack || new Set()).size}`);
    
    try {
      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.error(`[QUERY TIMEOUT] ${queryType} ${queryId} after ${timeout}ms`);
          reject(new Error(`Query execution timeout after ${timeout}ms for query ${queryId}`));
        }, timeout);
      });
      
      const executionPromise = this._executeInternal(kgEngine, context);
      
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      console.log(`[QUERY EXEC SUCCESS] ${queryType} ${queryId} - Results: ${result.bindings.length}`);
      
      // Update execution statistics
      const executionTime = Math.max(1, Date.now() - startTime); // Ensure at least 1ms
      this.executionStats.executionCount++;
      this.executionStats.totalExecutionTime += executionTime;
      this.executionStats.averageExecutionTime = 
        this.executionStats.totalExecutionTime / this.executionStats.executionCount;
      this.executionStats.lastExecuted = new Date().toISOString();
      this.executionStats.resultCount = result.bindings.length;

      return result;
    } catch (error) {
      console.error(`[QUERY EXEC ERROR] ${queryType} ${queryId}:`, error.message);
      throw error;
    }
  }

  /**
   * Internal execution method - to be overridden by subclasses
   */
  async _executeInternal(kgEngine, context) {
    throw new Error('_executeInternal must be implemented by subclasses');
  }
}

export default BaseQuery;
