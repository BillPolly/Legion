/**
 * ComponentLibraryDataSource - DataSource for ComponentLibraryHandle
 * Phase 2.3
 *
 * Wraps ComponentStoreActor for Handle operations
 * Provides required synchronous DataSource interface with async backend operations
 */

export class ComponentLibraryDataSource {
  constructor(backendActor) {
    this.backend = backendActor;
    this.cache = new Map(); // Simple cache for synchronous access
    this._subscriptions = new Map();
    this._subscriptionId = 0;
  }

  /**
   * REQUIRED: Synchronous query method
   * Returns cached data immediately
   */
  query(querySpec) {
    // Return from cache for synchronous access
    if (!querySpec || Object.keys(querySpec).length === 0) {
      return Array.from(this.cache.values());
    }

    // Simple filtering on cached data
    if (querySpec.id) {
      const item = this.cache.get(querySpec.id);
      return item ? [item] : [];
    }

    // Filter by other criteria
    const all = Array.from(this.cache.values());
    return all.filter(item =>
      Object.entries(querySpec).every(([key, value]) => item[key] === value)
    );
  }

  /**
   * REQUIRED: Synchronous subscribe method
   * Sets up subscription and returns subscription object immediately
   */
  subscribe(querySpec, callback) {
    const subscriptionId = ++this._subscriptionId;
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
      }
    };

    this._subscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  /**
   * REQUIRED: Get schema
   * Returns schema definition synchronously
   */
  getSchema() {
    return {
      type: 'ComponentLibrary',
      operations: ['create', 'read', 'update', 'delete', 'list', 'filter'],
      componentSchema: {
        id: { type: 'string', required: true },
        name: { type: 'string', required: true },
        description: { type: 'string' },
        dsl: { type: 'string' },
        cnl: { type: 'string' },
        json: { type: 'object' },
        dataModel: { type: 'object' },
        tags: { type: 'array' },
        author: { type: 'string' },
        category: { type: 'string' },
        created: { type: 'string' },
        modified: { type: 'string' },
        version: { type: 'number' }
      }
    };
  }

  /**
   * Async operation: Create component
   * Communicates with backend actor and updates cache
   */
  async createComponent(data) {
    const component = await this.backend.receive('component.create', data);
    this.cache.set(component.id, component);
    this._notifySubscribers();
    return component;
  }

  /**
   * Async operation: Get component by ID
   * Returns from cache if available, otherwise fetches from backend
   */
  async getComponent(id) {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }

    const component = await this.backend.receive('component.get', { id });
    if (component) {
      this.cache.set(id, component);
    }
    return component;
  }

  /**
   * Async operation: Update component
   * Updates via backend and refreshes cache
   */
  async updateComponent(id, updates) {
    const component = await this.backend.receive('component.update', { id, updates });
    this.cache.set(id, component);
    this._notifySubscribers();
    return component;
  }

  /**
   * Async operation: Delete component
   * Deletes via backend and removes from cache
   */
  async deleteComponent(id) {
    const result = await this.backend.receive('component.delete', { id });
    this.cache.delete(id);
    this._notifySubscribers();
    return result;
  }

  /**
   * Async operation: List components with optional filter
   * Fetches from backend and updates cache
   */
  async listComponents(filter = {}) {
    const results = await this.backend.receive('component.list', { filter });
    results.forEach(component => this.cache.set(component.id, component));
    return results;
  }

  /**
   * REQUIRED: Create query builder for Handle
   * Returns a basic query builder (not fully implemented for Phase 2)
   */
  queryBuilder(sourceHandle) {
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }

    // Minimal query builder for Phase 2 - full implementation in later phases
    return {
      _sourceHandle: sourceHandle,
      _operations: [],

      where(predicate) {
        this._operations.push({ type: 'where', predicate });
        return this;
      },

      select(mapper) {
        this._operations.push({ type: 'select', mapper });
        return this;
      },

      orderBy(field, direction = 'asc') {
        this._operations.push({ type: 'orderBy', field, direction });
        return this;
      },

      limit(count) {
        this._operations.push({ type: 'limit', count });
        return this;
      },

      // Terminal methods - minimal implementations
      first() {
        const results = this._sourceHandle.query({});
        return results.length > 0 ? results[0] : null;
      },

      toArray() {
        return this._sourceHandle.query({});
      },

      count() {
        return this._sourceHandle.query({}).length;
      }
    };
  }

  /**
   * Notify all subscribers of data changes
   * @private
   */
  _notifySubscribers() {
    // Notify asynchronously to avoid blocking
    setTimeout(() => {
      this._subscriptions.forEach(subscription => {
        try {
          const data = this.query(subscription.querySpec);
          subscription.callback(data);
        } catch (error) {
          console.error('Error notifying subscriber:', error);
        }
      });
    }, 0);
  }
}
