/**
 * ComponentLibraryHandle - Handle for component library collection
 * Phase 1.5
 *
 * Provides collection-level operations for managing saved components
 */

import { Handle } from '@legion/handle';
import { ComponentHandle } from './ComponentHandle.js';

export class ComponentLibraryHandle extends Handle {
  constructor(dataSource) {
    super(dataSource);
  }

  /**
   * REQUIRED: Get current value
   * Returns all components in the library (from cache)
   * CRITICAL: Must be synchronous - no await!
   */
  value() {
    this._validateNotDestroyed();
    // Phase 1 compatibility: MockDataSource uses 'data' array
    // Phase 2: ComponentLibraryDataSource uses query() on cache
    if (this.dataSource.data) {
      return this.dataSource.data;
    }
    return this.dataSource.query({});
  }

  /**
   * REQUIRED: Execute query with this handle as context
   * CRITICAL: Must be synchronous - no await!
   */
  query(querySpec) {
    this._validateNotDestroyed();
    return this.dataSource.query(querySpec);
  }

  /**
   * Get all components
   */
  all() {
    return this.value();
  }

  /**
   * Filter components by tag
   */
  byTag(tag) {
    const all = this.all();
    return all.filter(component =>
      component.tags && component.tags.includes(tag)
    );
  }

  /**
   * Filter components by author
   */
  byAuthor(author) {
    return this.query({ author });
  }

  /**
   * Filter components by category
   */
  byCategory(category) {
    return this.query({ category });
  }

  /**
   * Get most recent components
   */
  recent(limit) {
    const all = this.all();

    // Sort by modified date (most recent first)
    const sorted = [...all].sort((a, b) => {
      const dateA = new Date(a.modified || a.created);
      const dateB = new Date(b.modified || b.created);
      return dateB - dateA; // Descending
    });

    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Filter components with predicate function (client-side)
   */
  filter(predicate) {
    const all = this.all();
    return all.filter(predicate);
  }

  /**
   * Get ComponentHandle for specific component
   */
  get(componentId) {
    return new ComponentHandle(this.dataSource, componentId);
  }

  /**
   * Create new component (async - delegates to backend)
   */
  async createComponent(componentData) {
    this._validateNotDestroyed();
    return await this.dataSource.createComponent(componentData);
  }

  /**
   * Get component by ID (async - may fetch from backend)
   */
  async getComponent(componentId) {
    this._validateNotDestroyed();
    return await this.dataSource.getComponent(componentId);
  }

  /**
   * Update existing component (async - delegates to backend)
   */
  async updateComponent(componentId, updates) {
    this._validateNotDestroyed();
    return await this.dataSource.updateComponent(componentId, updates);
  }

  /**
   * Delete component (async - delegates to backend)
   */
  async deleteComponent(componentId) {
    this._validateNotDestroyed();
    return await this.dataSource.deleteComponent(componentId);
  }

  /**
   * List components with optional filter (async - delegates to backend)
   */
  async listComponents(filter = {}) {
    this._validateNotDestroyed();
    return await this.dataSource.listComponents(filter);
  }

  /**
   * Import multiple components (async - delegates to backend)
   */
  async importComponents(components) {
    this._validateNotDestroyed();

    const imported = [];
    for (const componentData of components) {
      const created = await this.createComponent(componentData);
      imported.push(created);
    }
    return imported;
  }

  /**
   * Export components by IDs (async - delegates to backend)
   */
  async exportComponents(componentIds) {
    this._validateNotDestroyed();

    // If no IDs specified, export all from cache
    if (!componentIds || componentIds.length === 0) {
      return this.all();
    }

    const exported = [];
    for (const id of componentIds) {
      const component = await this.getComponent(id);
      if (component) {
        exported.push(component);
      }
    }
    return exported;
  }

  /**
   * Synchronous CRUD methods for backwards compatibility with Phase 1 tests
   * These operate on cached data or data array depending on DataSource type
   */

  /**
   * Create new component (synchronous - Phase 1 compatibility)
   */
  create(componentData) {
    this._validateNotDestroyed();

    // Generate ID and metadata
    const component = {
      id: this._generateId(),
      ...componentData,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: 1
    };

    // Phase 1: MockDataSource uses 'data' array
    if (this.dataSource.data) {
      this.dataSource.data.push(component);
    }
    // Phase 2: ComponentLibraryDataSource uses 'cache' Map
    else if (this.dataSource.cache) {
      this.dataSource.cache.set(component.id, component);
    }

    return component;
  }

  /**
   * Update existing component (synchronous - Phase 1 compatibility)
   */
  update(componentId, updates) {
    this._validateNotDestroyed();

    let component;
    let index = -1;

    // Phase 1: MockDataSource uses 'data' array
    if (this.dataSource.data) {
      index = this.dataSource.data.findIndex(c => c.id === componentId);
      if (index === -1) {
        throw new Error('Component not found');
      }
      component = this.dataSource.data[index];
    }
    // Phase 2: ComponentLibraryDataSource uses 'cache' Map
    else if (this.dataSource.cache) {
      component = this.dataSource.cache.get(componentId);
      if (!component) {
        throw new Error('Component not found');
      }
    }

    const updated = {
      ...component,
      ...updates,
      id: componentId, // Preserve ID
      created: component.created, // Preserve created date
      modified: new Date().toISOString(),
      version: (component.version || 1) + 1
    };

    // Update in storage
    if (this.dataSource.data) {
      this.dataSource.data[index] = updated;
    } else if (this.dataSource.cache) {
      this.dataSource.cache.set(componentId, updated);
    }

    return updated;
  }

  /**
   * Delete component (synchronous - Phase 1 compatibility)
   */
  delete(componentId) {
    this._validateNotDestroyed();

    // Phase 1: MockDataSource uses 'data' array
    if (this.dataSource.data) {
      const index = this.dataSource.data.findIndex(c => c.id === componentId);
      if (index === -1) {
        return false;
      }
      this.dataSource.data.splice(index, 1);
      return true;
    }
    // Phase 2: ComponentLibraryDataSource uses 'cache' Map
    else if (this.dataSource.cache) {
      return this.dataSource.cache.delete(componentId);
    }

    return false;
  }

  /**
   * Import multiple components (synchronous - Phase 1 compatibility)
   */
  import(components) {
    this._validateNotDestroyed();

    const imported = [];

    for (const componentData of components) {
      const created = this.create(componentData);
      imported.push(created);
    }

    return imported;
  }

  /**
   * Export components by IDs (synchronous - Phase 1 compatibility)
   */
  export(componentIds) {
    this._validateNotDestroyed();

    // If no IDs specified, export all
    if (!componentIds || componentIds.length === 0) {
      return this.all();
    }

    const all = this.all();
    return all.filter(component => componentIds.includes(component.id));
  }

  /**
   * Generate unique ID for component
   * @private
   */
  _generateId() {
    return 'comp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
