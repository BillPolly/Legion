/**
 * ComponentStoreActor - Backend Actor for component persistence
 * Phase 2.2
 *
 * Manages CRUD operations for components via database
 */

import { Actor } from '@legion/actors';

export class ComponentStoreActor extends Actor {
  constructor(database) {
    super();
    this.db = database;
    this.collection = 'components';
  }

  /**
   * Actor message handler
   */
  async receive(messageType, data) {
    switch (messageType) {
      case 'component.create':
        return await this.createComponent(data);

      case 'component.get':
        return await this.getComponent(data.id);

      case 'component.update':
        return await this.updateComponent(data.id, data.updates);

      case 'component.delete':
        return await this.deleteComponent(data.id);

      case 'component.list':
        return await this.listComponents(data.filter);

      case 'component.import':
        return await this.importComponents(data.components);

      case 'component.export':
        return await this.exportComponents(data.ids);

      default:
        throw new Error(`Unknown message type: ${messageType}`);
    }
  }

  /**
   * Create new component
   */
  async createComponent(componentData) {
    const component = {
      id: this._generateId(),
      ...componentData,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: 1
    };

    await this.db.insert(this.collection, component);
    return component;
  }

  /**
   * Get component by ID
   */
  async getComponent(id) {
    return await this.db.findOne(this.collection, { id });
  }

  /**
   * Update existing component
   */
  async updateComponent(id, updates) {
    const component = await this.getComponent(id);
    if (!component) {
      throw new Error('Component not found');
    }

    const updated = {
      ...component,
      ...updates,
      id: component.id, // Preserve ID
      created: component.created, // Preserve created date
      modified: new Date().toISOString(),
      version: (component.version || 1) + 1
    };

    await this.db.update(this.collection, { id }, updated);
    return updated;
  }

  /**
   * Delete component
   */
  async deleteComponent(id) {
    return await this.db.delete(this.collection, { id });
  }

  /**
   * List components with optional filtering
   */
  async listComponents(filter = {}) {
    return await this.db.find(this.collection, filter);
  }

  /**
   * Import multiple components
   */
  async importComponents(components) {
    const imported = [];
    for (const componentData of components) {
      const created = await this.createComponent(componentData);
      imported.push(created);
    }
    return imported;
  }

  /**
   * Export components by IDs
   */
  async exportComponents(ids) {
    const exported = [];
    for (const id of ids) {
      const component = await this.getComponent(id);
      if (component) {
        exported.push(component);
      }
    }
    return exported;
  }

  /**
   * Generate unique component ID
   * @private
   */
  _generateId() {
    return 'comp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
