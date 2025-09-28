/**
 * SimpleTripleStore - A minimal synchronous in-memory triple store
 * 
 * Provides synchronous add() and query() methods for use with RDFParser/RDFSerializer.
 * This is a lightweight implementation specifically for RDF parsing/serialization use cases.
 * 
 * For production use with full features (persistence, indices, subscriptions),
 * use @legion/triplestore with its async API.
 */

export class SimpleTripleStore {
  constructor() {
    // Store triples as array of [subject, predicate, object]
    // Preserve original types (numbers, booleans, strings)
    this.triples = [];
    
    // Track subscriptions for change notifications
    this.subscribers = [];
    this.nextSubscriberId = 1;
  }

  /**
   * Add a triple to the store (synchronous)
   * @param {string|number} subject - The subject
   * @param {string} predicate - The predicate
   * @param {string|number|boolean} object - The object
   */
  add(subject, predicate, object) {
    // Check if triple already exists
    const exists = this.triples.some(([s, p, o]) => 
      s === subject && p === predicate && o === object
    );
    
    if (!exists) {
      this.triples.push([subject, predicate, object]);
      
      // Notify subscribers of change
      this._notifySubscribers();
    }
  }

  /**
   * Query triples with pattern matching (synchronous)
   * Use null for wildcards
   * 
   * @param {string|number|null} subject - Subject or null for wildcard
   * @param {string|null} predicate - Predicate or null for wildcard
   * @param {string|number|boolean|null} object - Object or null for wildcard
   * @returns {Array<[subject, predicate, object]>} - Array of matching triples
   */
  query(subject, predicate, object) {
    return this.triples.filter(([s, p, o]) => {
      if (subject !== null && subject !== undefined && s !== subject) return false;
      if (predicate !== null && predicate !== undefined && p !== predicate) return false;
      if (object !== null && object !== undefined && o !== object) return false;
      return true;
    });
  }

  /**
   * Get the total number of triples
   * @returns {number} - Count of triples
   */
  size() {
    return this.triples.length;
  }

  /**
   * Clear all triples
   */
  clear() {
    this.triples = [];
  }

  /**
   * Get all triples
   * @returns {Array<[subject, predicate, object]>} - All triples
   */
  getAllTriples() {
    return [...this.triples];
  }

  /**
   * Remove a triple from the store (synchronous)
   * @param {string|number} subject - The subject
   * @param {string} predicate - The predicate
   * @param {string|number|boolean} object - The object
   * @returns {boolean} - True if triple was removed, false if not found
   */
  remove(subject, predicate, object) {
    const initialLength = this.triples.length;
    
    this.triples = this.triples.filter(([s, p, o]) =>
      !(s === subject && p === predicate && o === object)
    );
    
    const removed = this.triples.length < initialLength;
    
    if (removed) {
      // Notify subscribers of change
      this._notifySubscribers();
    }
    
    return removed;
  }

  /**
   * Subscribe to changes in the triple store
   * 
   * Callback is invoked whenever triples are added or removed.
   * 
   * @param {Function} callback - Callback invoked on changes
   * @returns {Object} - Subscription object with unsubscribe method
   */
  subscribe(callback) {
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    const subscriberId = this.nextSubscriberId++;
    
    this.subscribers.push({
      id: subscriberId,
      callback
    });
    
    // Return subscription object with unsubscribe method
    return {
      unsubscribe: () => {
        this.subscribers = this.subscribers.filter(sub => sub.id !== subscriberId);
      }
    };
  }

  /**
   * Notify all subscribers of a change
   * @private
   */
  _notifySubscribers() {
    for (const subscriber of this.subscribers) {
      subscriber.callback();
    }
  }
}