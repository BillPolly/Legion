/**
 * ComponentStoreActor Tests - Phase 2.2
 *
 * Tests for ComponentStoreActor implementation
 */

import { ComponentStoreActor } from '../../../src/components/component-editor/src/actors/ComponentStoreActor.js';

// Simple in-memory database for testing
class InMemoryDatabase {
  constructor() {
    this.collections = new Map();
  }

  async insert(collection, data) {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, []);
    }
    this.collections.get(collection).push(data);
    return data;
  }

  async findOne(collection, query) {
    if (!this.collections.has(collection)) {
      return null;
    }
    const items = this.collections.get(collection);
    return items.find(item => this._matches(item, query)) || null;
  }

  async find(collection, query = {}) {
    if (!this.collections.has(collection)) {
      return [];
    }
    const items = this.collections.get(collection);
    if (Object.keys(query).length === 0) {
      return [...items];
    }
    return items.filter(item => this._matches(item, query));
  }

  async update(collection, query, data) {
    if (!this.collections.has(collection)) {
      return null;
    }
    const items = this.collections.get(collection);
    const index = items.findIndex(item => this._matches(item, query));
    if (index === -1) {
      return null;
    }
    items[index] = data;
    return data;
  }

  async delete(collection, query) {
    if (!this.collections.has(collection)) {
      return false;
    }
    const items = this.collections.get(collection);
    const index = items.findIndex(item => this._matches(item, query));
    if (index === -1) {
      return false;
    }
    items.splice(index, 1);
    return true;
  }

  _matches(item, query) {
    return Object.entries(query).every(([key, value]) => {
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Handle nested queries (not needed for MVP but good to have)
        return this._matches(item[key], value);
      }
      return item[key] === value;
    });
  }

  // Test helper
  clear() {
    this.collections.clear();
  }
}

describe('ComponentStoreActor', () => {
  let actor;
  let database;

  beforeEach(() => {
    database = new InMemoryDatabase();
    actor = new ComponentStoreActor(database);
  });

  afterEach(() => {
    database.clear();
  });

  describe('Message Handling', () => {
    test('should handle component.create message', async () => {
      const componentData = {
        name: 'TestComponent',
        dsl: 'Test :: state => div',
        dataModel: { entityName: 'state', schema: {}, sampleData: {} }
      };

      const result = await actor.receive('component.create', componentData);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('TestComponent');
      expect(result.created).toBeDefined();
      expect(result.modified).toBeDefined();
      expect(result.version).toBe(1);
    });

    test('should handle component.get message', async () => {
      // Create component first
      const created = await actor.receive('component.create', {
        name: 'GetTest',
        dsl: 'GetTest :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      // Get component
      const result = await actor.receive('component.get', { id: created.id });

      expect(result).toEqual(created);
    });

    test('should handle component.update message', async () => {
      // Create component
      const created = await actor.receive('component.create', {
        name: 'UpdateTest',
        dsl: 'UpdateTest :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      // Update component
      const result = await actor.receive('component.update', {
        id: created.id,
        updates: { description: 'Updated description' }
      });

      expect(result.description).toBe('Updated description');
      expect(result.version).toBe(2);
      expect(result.modified).toBeDefined();
      expect(new Date(result.modified)).not.toBe('Invalid Date');
    });

    test('should handle component.delete message', async () => {
      // Create component
      const created = await actor.receive('component.create', {
        name: 'DeleteTest',
        dsl: 'DeleteTest :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      // Delete component
      const result = await actor.receive('component.delete', { id: created.id });

      expect(result).toBe(true);

      // Verify deletion
      const found = await actor.receive('component.get', { id: created.id });
      expect(found).toBeNull();
    });

    test('should handle component.list message', async () => {
      // Create multiple components
      await actor.receive('component.create', {
        name: 'Component1',
        dsl: 'C1 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        author: 'alice'
      });

      await actor.receive('component.create', {
        name: 'Component2',
        dsl: 'C2 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        author: 'bob'
      });

      // List all components
      const all = await actor.receive('component.list', {});
      expect(all.length).toBe(2);

      // List with filter
      const filtered = await actor.receive('component.list', { filter: { author: 'alice' } });
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Component1');
    });

    test('should handle component.import message', async () => {
      const components = [
        {
          name: 'Import1',
          dsl: 'I1 :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        },
        {
          name: 'Import2',
          dsl: 'I2 :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        }
      ];

      const result = await actor.receive('component.import', { components });

      expect(result.length).toBe(2);
      expect(result.every(c => c.id && c.version === 1)).toBe(true);
    });

    test('should handle component.export message', async () => {
      // Create components
      const comp1 = await actor.receive('component.create', {
        name: 'Export1',
        dsl: 'E1 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const comp2 = await actor.receive('component.create', {
        name: 'Export2',
        dsl: 'E2 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      // Export specific components
      const result = await actor.receive('component.export', { ids: [comp1.id] });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(comp1.id);
    });

    test('should throw error for unknown message type', async () => {
      await expect(actor.receive('unknown.message', {}))
        .rejects.toThrow('Unknown message type: unknown.message');
    });
  });

  describe('CRUD Operations', () => {
    test('createComponent() should generate ID and metadata', async () => {
      const result = await actor.createComponent({
        name: 'Test',
        dsl: 'Test :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^comp_/);
      expect(result.created).toBeDefined();
      expect(result.modified).toBeDefined();
      expect(result.version).toBe(1);
    });

    test('getComponent() should return component by ID', async () => {
      const created = await actor.createComponent({
        name: 'GetTest',
        dsl: 'GetTest :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const result = await actor.getComponent(created.id);

      expect(result).toEqual(created);
    });

    test('getComponent() should return null for non-existent ID', async () => {
      const result = await actor.getComponent('nonexistent');
      expect(result).toBeNull();
    });

    test('updateComponent() should update and increment version', async () => {
      const created = await actor.createComponent({
        name: 'UpdateTest',
        description: 'Original',
        dsl: 'UpdateTest :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const updated = await actor.updateComponent(created.id, {
        description: 'Updated'
      });

      expect(updated.description).toBe('Updated');
      expect(updated.version).toBe(2);
      expect(updated.id).toBe(created.id);
      expect(updated.created).toBe(created.created);
      expect(updated.modified).toBeDefined();
      expect(new Date(updated.modified)).not.toBe('Invalid Date');
    });

    test('updateComponent() should throw error for non-existent component', async () => {
      await expect(actor.updateComponent('nonexistent', { name: 'New' }))
        .rejects.toThrow('Component not found');
    });

    test('deleteComponent() should remove component', async () => {
      const created = await actor.createComponent({
        name: 'DeleteTest',
        dsl: 'DeleteTest :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const result = await actor.deleteComponent(created.id);
      expect(result).toBe(true);

      const found = await actor.getComponent(created.id);
      expect(found).toBeNull();
    });

    test('listComponents() should return all components when no filter', async () => {
      await actor.createComponent({
        name: 'Component1',
        dsl: 'C1 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await actor.createComponent({
        name: 'Component2',
        dsl: 'C2 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const result = await actor.listComponents();
      expect(result.length).toBe(2);
    });

    test('listComponents() should filter by field values', async () => {
      await actor.createComponent({
        name: 'Component1',
        dsl: 'C1 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        author: 'alice',
        category: 'forms'
      });

      await actor.createComponent({
        name: 'Component2',
        dsl: 'C2 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        author: 'bob',
        category: 'forms'
      });

      await actor.createComponent({
        name: 'Component3',
        dsl: 'C3 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        author: 'alice',
        category: 'data'
      });

      // Filter by author
      const byAuthor = await actor.listComponents({ author: 'alice' });
      expect(byAuthor.length).toBe(2);
      expect(byAuthor.every(c => c.author === 'alice')).toBe(true);

      // Filter by category
      const byCategory = await actor.listComponents({ category: 'forms' });
      expect(byCategory.length).toBe(2);
      expect(byCategory.every(c => c.category === 'forms')).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    test('importComponents() should import multiple components', async () => {
      const components = [
        {
          name: 'Import1',
          dsl: 'I1 :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        },
        {
          name: 'Import2',
          dsl: 'I2 :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        },
        {
          name: 'Import3',
          dsl: 'I3 :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        }
      ];

      const result = await actor.importComponents(components);

      expect(result.length).toBe(3);
      expect(result.every(c => c.id && c.version === 1)).toBe(true);

      // Verify all were added
      const all = await actor.listComponents();
      expect(all.length).toBe(3);
    });

    test('exportComponents() should export specific components', async () => {
      const comp1 = await actor.createComponent({
        name: 'Export1',
        dsl: 'E1 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const comp2 = await actor.createComponent({
        name: 'Export2',
        dsl: 'E2 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const comp3 = await actor.createComponent({
        name: 'Export3',
        dsl: 'E3 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const result = await actor.exportComponents([comp1.id, comp3.id]);

      expect(result.length).toBe(2);
      expect(result.map(c => c.id)).toContain(comp1.id);
      expect(result.map(c => c.id)).toContain(comp3.id);
      expect(result.map(c => c.id)).not.toContain(comp2.id);
    });

    test('exportComponents() should skip non-existent components', async () => {
      const comp1 = await actor.createComponent({
        name: 'Export1',
        dsl: 'E1 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const result = await actor.exportComponents([comp1.id, 'nonexistent']);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(comp1.id);
    });
  });
});
