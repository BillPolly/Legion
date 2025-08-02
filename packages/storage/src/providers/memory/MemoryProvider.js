/**
 * MemoryProvider - In-memory storage provider for testing and development
 * 
 * Implements the Provider interface using in-memory data structures.
 * Useful for testing and situations where persistent storage is not needed.
 */

import { Provider } from '../../core/Provider.js';

export class MemoryProvider extends Provider {
  constructor(config = {}) {
    super(config);
    this.collections = new Map();
    this.indexes = new Map();
  }

  async connect() {
    this.connected = true;
  }

  async disconnect() {
    this.collections.clear();
    this.indexes.clear();
    this.connected = false;
  }

  // Private helper to get or create collection
  _getCollection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, []);
    }
    return this.collections.get(name);
  }

  // Private helper to match document against query
  _matchesQuery(doc, query) {
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle operators
        for (const [op, opValue] of Object.entries(value)) {
          switch (op) {
            case '$gt':
              if (!(doc[key] > opValue)) return false;
              break;
            case '$gte':
              if (!(doc[key] >= opValue)) return false;
              break;
            case '$lt':
              if (!(doc[key] < opValue)) return false;
              break;
            case '$lte':
              if (!(doc[key] <= opValue)) return false;
              break;
            case '$in':
              if (!opValue.includes(doc[key])) return false;
              break;
            case '$exists':
              if (opValue && !(key in doc)) return false;
              if (!opValue && (key in doc)) return false;
              break;
            default:
              if (doc[key] !== value) return false;
          }
        }
      } else {
        // Simple equality
        if (doc[key] !== value) return false;
      }
    }
    return true;
  }

  // Implementation of Provider interface methods
  async find(collection, query = {}, options = {}) {
    const docs = this._getCollection(collection);
    let results = docs.filter(doc => this._matchesQuery(doc, query));
    
    // Apply sorting
    if (options.sort) {
      const sortKeys = Object.entries(options.sort);
      results.sort((a, b) => {
        for (const [key, direction] of sortKeys) {
          if (a[key] < b[key]) return -direction;
          if (a[key] > b[key]) return direction;
        }
        return 0;
      });
    }
    
    // Apply skip
    if (options.skip) {
      results = results.slice(options.skip);
    }
    
    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }
    
    // Apply projection
    if (options.projection) {
      results = results.map(doc => {
        const projected = {};
        for (const [key, include] of Object.entries(options.projection)) {
          if (include) {
            projected[key] = doc[key];
          }
        }
        return projected;
      });
    }
    
    // Return deep copies to prevent external modification
    return JSON.parse(JSON.stringify(results));
  }

  async insert(collection, documents, options = {}) {
    const docs = this._getCollection(collection);
    const isArray = Array.isArray(documents);
    const toInsert = isArray ? documents : [documents];
    
    const insertedIds = {};
    let insertedCount = 0;
    
    toInsert.forEach((doc, index) => {
      const docCopy = JSON.parse(JSON.stringify(doc));
      if (!docCopy._id) {
        docCopy._id = `${collection}_${Date.now()}_${index}`;
      }
      docs.push(docCopy);
      insertedIds[index] = docCopy._id;
      insertedCount++;
    });
    
    return {
      acknowledged: true,
      insertedCount,
      insertedIds
    };
  }

  async update(collection, query, update, options = {}) {
    const docs = this._getCollection(collection);
    const matching = docs.filter(doc => this._matchesQuery(doc, query));
    
    let modifiedCount = 0;
    const toUpdate = options.multi ? matching : matching.slice(0, 1);
    
    toUpdate.forEach(doc => {
      // Handle $set operator
      if (update.$set) {
        Object.assign(doc, update.$set);
        modifiedCount++;
      }
      // Handle $inc operator
      else if (update.$inc) {
        for (const [key, value] of Object.entries(update.$inc)) {
          doc[key] = (doc[key] || 0) + value;
        }
        modifiedCount++;
      }
      // Direct replacement
      else {
        Object.keys(doc).forEach(key => delete doc[key]);
        Object.assign(doc, update);
        modifiedCount++;
      }
    });
    
    return {
      acknowledged: true,
      modifiedCount,
      matchedCount: matching.length
    };
  }

  async delete(collection, query, options = {}) {
    const docs = this._getCollection(collection);
    const matching = docs.filter(doc => this._matchesQuery(doc, query));
    
    let deletedCount = 0;
    matching.forEach(doc => {
      const index = docs.indexOf(doc);
      if (index > -1) {
        docs.splice(index, 1);
        deletedCount++;
      }
    });
    
    return {
      acknowledged: true,
      deletedCount
    };
  }

  async count(collection, query = {}, options = {}) {
    const results = await this.find(collection, query, { limit: undefined });
    return results.length;
  }

  async listCollections() {
    return Array.from(this.collections.keys());
  }

  async dropCollection(collection) {
    const exists = this.collections.has(collection);
    this.collections.delete(collection);
    this.indexes.delete(collection);
    return exists;
  }

  getCapabilities() {
    return [
      ...super.getCapabilities(),
      'inmemory',
      'testing'
    ];
  }
}