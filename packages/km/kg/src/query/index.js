/**
 * Advanced Query System for Knowledge Graph
 * 
 * This module provides a comprehensive query system that treats queries themselves
 * as first-class entities in the knowledge graph, enabling meta-querying,
 * query optimization, and query composition.
 */

// Export all query system components
export * from './core/index.js';
export * from './constraints/index.js';
export * from './types/index.js';
export * from './paths/index.js';
export * from './execution/index.js';
export * from './utils/index.js';

// Main query system class
export class QuerySystem {
  constructor(kgEngine) {
    this.kg = kgEngine;
    this.queryCache = new Map();
    this.executionHistory = [];
  }

  async execute(query, context = {}) {
    const result = await query.execute(this.kg, context);
    
    // Store execution history
    this.executionHistory.push({
      query: query.getId(),
      timestamp: new Date().toISOString(),
      resultCount: result.size(),
      executionTime: result.executionTime
    });

    return result;
  }

  getExecutionHistory() {
    return this.executionHistory;
  }

  clearCache() {
    this.queryCache.clear();
  }
}
