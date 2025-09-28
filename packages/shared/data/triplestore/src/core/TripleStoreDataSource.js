import { ITripleStore } from './ITripleStore.js';
import { ValidationError } from './StorageError.js';

/**
 * TripleStoreDataSource - Universal DataSource wrapper for triple stores
 * 
 * Wraps any ITripleStore implementation to provide the standard DataSource interface
 * with query(), update(), subscribe(), and getSchema() methods.
 * 
 * This allows triple stores to be used interchangeably with other data sources
 * in the Legion framework through a consistent interface.
 * 
 * Query Format:
 * {
 *   subject: 'entity:1' | null,  // null for wildcard
 *   predicate: 'name' | null,     // null for wildcard
 *   object: 'value' | null        // null for wildcard
 * }
 * 
 * Update Format:
 * {
 *   operation: 'add' | 'remove' | 'clear',
 *   subject?: string,
 *   predicate?: string,
 *   object?: any
 * }
 */
export class TripleStoreDataSource {
  constructor(tripleStore) {
    if (!tripleStore || !(tripleStore instanceof ITripleStore)) {
      throw new ValidationError('TripleStoreDataSource requires an ITripleStore instance');
    }
    
    this.store = tripleStore;
    this.listeners = new Map();
    this.nextListenerId = 1;
    
    // Cache for tracking changes
    this.lastSnapshot = null;
  }

  /**
   * Query the triple store
   * @param {Object} querySpec - Query specification
   * @returns {Promise<Array>} - Array of matching triples
   */
  async query(querySpec = {}) {
    // Handle different query formats
    if (Array.isArray(querySpec)) {
      // Array format: [subject, predicate, object]
      const [subject, predicate, object] = querySpec;
      return this.store.query(
        subject !== undefined ? subject : null,
        predicate !== undefined ? predicate : null,
        object !== undefined ? object : null
      );
    }
    
    // Object format: { subject, predicate, object }
    const { subject = null, predicate = null, object = null } = querySpec;
    
    // Special queries
    if (querySpec.type === 'size') {
      return { size: await this.store.size() };
    }
    
    if (querySpec.type === 'metadata') {
      return this.store.getMetadata();
    }
    
    // Standard triple query
    const results = await this.store.query(subject, predicate, object);
    
    // Return in consistent format
    return results.map(([s, p, o]) => ({
      subject: s,
      predicate: p,
      object: o
    }));
  }

  /**
   * Update the triple store
   * @param {Object} updateSpec - Update specification
   * @returns {Promise<Object>} - Result of the update
   */
  async update(updateSpec) {
    const { operation } = updateSpec;
    
    // Take snapshot before update for change detection
    if (this.listeners.size > 0) {
      this.lastSnapshot = await this._takeSnapshot();
    }
    
    let result;
    
    switch (operation) {
      case 'add':
        const { subject, predicate, object } = updateSpec;
        if (!subject || !predicate) {
          throw new ValidationError('Add operation requires subject and predicate');
        }
        result = await this.store.addTriple(subject, predicate, object);
        break;
        
      case 'remove':
        const { subject: s, predicate: p, object: o } = updateSpec;
        if (!s || !p) {
          throw new ValidationError('Remove operation requires subject and predicate');
        }
        result = await this.store.removeTriple(s, p, o);
        break;
        
      case 'clear':
        await this.store.clear();
        result = true;
        break;
        
      case 'batch':
        // Handle batch operations
        const { operations } = updateSpec;
        const results = [];
        for (const op of operations) {
          results.push(await this.update(op));
        }
        result = results;
        break;
        
      default:
        throw new ValidationError(`Unknown operation: ${operation}`);
    }
    
    // Notify listeners of changes
    if (this.listeners.size > 0) {
      await this._notifyListeners(updateSpec, result);
    }
    
    return {
      success: result !== false,
      result,
      operation
    };
  }

  /**
   * Subscribe to changes in the triple store
   * @param {Object} querySpec - Query to watch for changes
   * @param {Function} callback - Function to call on changes
   * @returns {Function} - Unsubscribe function
   */
  subscribe(querySpec, callback) {
    const listenerId = this.nextListenerId++;
    
    const listener = {
      id: listenerId,
      querySpec,
      callback
    };
    
    this.listeners.set(listenerId, listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listenerId);
    };
  }

  /**
   * Get the schema of the triple store
   * @returns {Object} - Schema information
   */
  getSchema() {
    const metadata = this.store.getMetadata();
    
    return {
      type: 'triplestore',
      provider: metadata.type,
      schema: metadata.schema || {},
      capabilities: {
        query: true,
        update: true,
        subscribe: true,
        transactions: metadata.supportsTransactions || false,
        persistence: metadata.supportsPersistence || false,
        ...metadata.capabilities
      },
      queryFormat: {
        type: 'object',
        properties: {
          subject: { type: ['string', 'null'], description: 'Subject of triple' },
          predicate: { type: ['string', 'null'], description: 'Predicate of triple' },
          object: { type: ['string', 'number', 'boolean', 'null'], description: 'Object of triple' }
        }
      },
      updateFormat: {
        type: 'object',
        properties: {
          operation: { 
            type: 'string', 
            enum: ['add', 'remove', 'clear', 'batch'],
            description: 'Operation to perform'
          },
          subject: { type: 'string', description: 'Subject for add/remove' },
          predicate: { type: 'string', description: 'Predicate for add/remove' },
          object: { type: ['string', 'number', 'boolean'], description: 'Object for add/remove' },
          operations: { type: 'array', description: 'Array of operations for batch' }
        },
        required: ['operation']
      }
    };
  }

  // Private helper methods

  /**
   * Take a snapshot of the store for change detection
   * @private
   */
  async _takeSnapshot() {
    const allTriples = await this.store.query(null, null, null);
    return new Set(allTriples.map(([s, p, o]) => `${s}|${p}|${o}`));
  }

  /**
   * Notify listeners of changes
   * @private
   */
  async _notifyListeners(updateSpec, result) {
    // Get current snapshot
    const currentSnapshot = await this._takeSnapshot();
    
    // Determine what changed
    const changes = this._detectChanges(this.lastSnapshot, currentSnapshot);
    
    // Notify each listener if their query is affected
    for (const listener of this.listeners.values()) {
      if (await this._isAffected(listener.querySpec, changes, updateSpec)) {
        const data = await this.query(listener.querySpec);
        listener.callback({
          type: 'change',
          operation: updateSpec.operation,
          data,
          changes
        });
      }
    }
  }

  /**
   * Detect changes between snapshots
   * @private
   */
  _detectChanges(oldSnapshot, newSnapshot) {
    const added = [];
    const removed = [];
    
    // Find added triples
    for (const triple of newSnapshot) {
      if (!oldSnapshot || !oldSnapshot.has(triple)) {
        const [s, p, o] = triple.split('|');
        added.push({ subject: s, predicate: p, object: this._parseObject(o) });
      }
    }
    
    // Find removed triples
    if (oldSnapshot) {
      for (const triple of oldSnapshot) {
        if (!newSnapshot.has(triple)) {
          const [s, p, o] = triple.split('|');
          removed.push({ subject: s, predicate: p, object: this._parseObject(o) });
        }
      }
    }
    
    return { added, removed };
  }

  /**
   * Check if a query is affected by changes
   * @private
   */
  async _isAffected(querySpec, changes, updateSpec) {
    // Clear operation affects all queries
    if (updateSpec.operation === 'clear') {
      return true;
    }
    
    const { subject, predicate, object } = querySpec;
    
    // Check if any changed triples match the query
    const allChanges = [...changes.added, ...changes.removed];
    
    for (const change of allChanges) {
      const subjectMatch = !subject || subject === change.subject;
      const predicateMatch = !predicate || predicate === change.predicate;
      const objectMatch = object === null || object === undefined || object === change.object;
      
      if (subjectMatch && predicateMatch && objectMatch) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Parse object value from string
   * @private
   */
  _parseObject(value) {
    // Handle type-prefixed values from DataScriptProvider
    if (typeof value === 'string') {
      if (value === '__null__') return null;
      if (value === '__undefined__') return undefined;
      if (value.startsWith('__bool__')) return value === '__bool__true';
      if (value.startsWith('__num__')) return Number(value.substring(7));
    }
    
    // Try to parse as number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      const num = Number(value);
      if (!isNaN(num)) return num;
    }
    
    // Try to parse as boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    return value;
  }

  /**
   * Get statistics about the data source
   */
  async getStats() {
    const size = await this.store.size();
    const metadata = this.store.getMetadata();
    
    return {
      type: 'triplestore',
      provider: metadata.type,
      tripleCount: size,
      listenerCount: this.listeners.size,
      capabilities: metadata.capabilities
    };
  }
}