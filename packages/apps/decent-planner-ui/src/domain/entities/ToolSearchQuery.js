/**
 * ToolSearchQuery Entity
 * Represents a tool search request in the domain
 */

import { SearchType } from '../value-objects/SearchType.js';

export class ToolSearchQuery {
  constructor(query, searchType = SearchType.TEXT, limit = 50) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }
    
    this.query = query.trim();
    this.searchType = searchType;
    this.limit = Math.min(Math.max(1, limit), 100); // Cap between 1-100
    this.createdAt = new Date();
    this.results = null;
    this.error = null;
  }
  
  setResults(results) {
    if (!Array.isArray(results)) {
      throw new Error('Results must be an array');
    }
    this.results = results;
    this.error = null;
  }
  
  setError(error) {
    this.error = error;
    this.results = null;
  }
  
  hasResults() {
    return this.results !== null && this.results.length > 0;
  }
  
  isSuccessful() {
    return this.results !== null && this.error === null;
  }
  
  getResultCount() {
    return this.results ? this.results.length : 0;
  }
  
  toJSON() {
    return {
      query: this.query,
      searchType: this.searchType,
      limit: this.limit,
      createdAt: this.createdAt,
      resultCount: this.getResultCount(),
      hasError: this.error !== null
    };
  }
}