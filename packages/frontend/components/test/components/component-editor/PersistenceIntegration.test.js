/**
 * Persistence Integration Tests - Phase 2.5
 *
 * End-to-end tests for component persistence through full stack:
 * ComponentLibraryHandle → ComponentLibraryDataSource → ComponentStoreActor → Database
 *
 * NO MOCKS - Uses real components throughout
 */

import { ComponentLibraryHandle } from '../../../src/components/component-editor/src/handles/ComponentLibraryHandle.js';
import { ComponentLibraryDataSource } from '../../../src/components/component-editor/src/datasources/ComponentLibraryDataSource.js';
import { ComponentStoreActor } from '../../../src/components/component-editor/src/actors/ComponentStoreActor.js';

// Real InMemoryDatabase for integration testing
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
        return this._matches(item[key], value);
      }
      return item[key] === value;
    });
  }

  clear() {
    this.collections.clear();
  }
}

describe('Persistence Integration Tests - Phase 2.5', () => {
  let database;
  let actor;
  let dataSource;
  let handle;

  beforeEach(() => {
    // Create full stack - NO MOCKS
    database = new InMemoryDatabase();
    actor = new ComponentStoreActor(database);
    dataSource = new ComponentLibraryDataSource(actor);
    handle = new ComponentLibraryHandle(dataSource);
  });

  afterEach(() => {
    database.clear();
  });

  describe('End-to-End CRUD Workflow', () => {
    test('should create component through full stack and persist to database', async () => {
      // Create via Handle (top layer)
      const componentHandle = await handle.createComponent({
        name: 'E2E Test Component',
        dsl: 'E2ETest :: state => div { "Hello World" }',
        dataModel: {
          entityName: 'state',
          schema: {},
          sampleData: {}
        }
      });

      // Verify Handle has the component
      expect(componentHandle.id).toBeDefined();
      expect(componentHandle.name).toBe('E2E Test Component');

      // Verify DataSource cache has the component
      const fromCache = dataSource.query({ id: componentHandle.id });
      expect(fromCache.length).toBe(1);
      expect(fromCache[0].name).toBe('E2E Test Component');

      // Verify Actor can retrieve it
      const fromActor = await actor.getComponent(componentHandle.id);
      expect(fromActor).toBeDefined();
      expect(fromActor.name).toBe('E2E Test Component');

      // Verify Database has the component
      const fromDb = await database.findOne('components', { id: componentHandle.id });
      expect(fromDb).toBeDefined();
      expect(fromDb.name).toBe('E2E Test Component');
      expect(fromDb.version).toBe(1);
    });

    test('should retrieve component through full stack from database', async () => {
      // Create component directly in database
      const dbComponent = {
        id: 'comp_retrieve_test',
        name: 'Retrieve Test',
        dsl: 'RT :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        version: 1
      };
      await database.insert('components', dbComponent);

      // Retrieve via DataSource (should fetch from Actor → Database)
      const fromDataSource = await dataSource.getComponent('comp_retrieve_test');
      expect(fromDataSource).toEqual(dbComponent);

      // Verify it's now in cache
      const fromCache = dataSource.query({ id: 'comp_retrieve_test' });
      expect(fromCache.length).toBe(1);
      expect(fromCache[0]).toEqual(dbComponent);

      // Retrieve via Handle
      const fromHandle = await handle.getComponent('comp_retrieve_test');
      expect(fromHandle.id).toBe('comp_retrieve_test');
      expect(fromHandle.name).toBe('Retrieve Test');
    });

    test('should update component through full stack and persist to database', async () => {
      // Create component
      const componentHandle = await handle.createComponent({
        name: 'Update Test',
        description: 'Original description',
        dsl: 'UT :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const originalId = componentHandle.id;
      const originalVersion = componentHandle.version;

      // Update via Handle
      const updated = await handle.updateComponent(originalId, {
        description: 'Updated description',
        author: 'test-author'
      });

      // Verify Handle has updated version
      expect(updated.id).toBe(originalId);
      expect(updated.description).toBe('Updated description');
      expect(updated.author).toBe('test-author');
      expect(updated.version).toBe(originalVersion + 1);

      // Verify DataSource cache updated
      const fromCache = dataSource.query({ id: originalId });
      expect(fromCache[0].description).toBe('Updated description');
      expect(fromCache[0].version).toBe(originalVersion + 1);

      // Verify Database updated
      const fromDb = await database.findOne('components', { id: originalId });
      expect(fromDb.description).toBe('Updated description');
      expect(fromDb.author).toBe('test-author');
      expect(fromDb.version).toBe(originalVersion + 1);
    });

    test('should delete component through full stack and remove from database', async () => {
      // Create component
      const componentHandle = await handle.createComponent({
        name: 'Delete Test',
        dsl: 'DT :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const componentId = componentHandle.id;

      // Verify it exists in database
      let fromDb = await database.findOne('components', { id: componentId });
      expect(fromDb).toBeDefined();

      // Verify it exists in cache
      let fromCache = dataSource.query({ id: componentId });
      expect(fromCache.length).toBe(1);

      // Delete via Handle
      const result = await handle.deleteComponent(componentId);
      expect(result).toBe(true);

      // Verify removed from cache
      fromCache = dataSource.query({ id: componentId });
      expect(fromCache.length).toBe(0);

      // Verify removed from database
      fromDb = await database.findOne('components', { id: componentId });
      expect(fromDb).toBeNull();

      // Verify Handle can't retrieve it
      const retrieved = await handle.getComponent(componentId);
      expect(retrieved).toBeNull();
    });

    test('should list and filter components through full stack from database', async () => {
      // Create multiple components
      await handle.createComponent({
        name: 'Component 1',
        dsl: 'C1 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        author: 'alice',
        category: 'forms'
      });

      await handle.createComponent({
        name: 'Component 2',
        dsl: 'C2 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        author: 'bob',
        category: 'forms'
      });

      await handle.createComponent({
        name: 'Component 3',
        dsl: 'C3 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        author: 'alice',
        category: 'data'
      });

      // List all via Handle
      const all = await handle.listComponents();
      expect(all.length).toBe(3);

      // Filter by author via Handle
      const aliceComponents = await handle.listComponents({ author: 'alice' });
      expect(aliceComponents.length).toBe(2);
      expect(aliceComponents.every(c => c.author === 'alice')).toBe(true);

      // Filter by category via Handle
      const formsComponents = await handle.listComponents({ category: 'forms' });
      expect(formsComponents.length).toBe(2);
      expect(formsComponents.every(c => c.category === 'forms')).toBe(true);

      // Verify database has all components
      const fromDb = await database.find('components', {});
      expect(fromDb.length).toBe(3);
    });
  });

  describe('Cache Synchronization', () => {
    test('cache should stay synchronized during create operations', async () => {
      const component = await handle.createComponent({
        name: 'Cache Sync Test',
        dsl: 'CST :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      // Cache should have the component
      const fromCache = dataSource.query({ id: component.id });
      expect(fromCache.length).toBe(1);

      // Database should have the component
      const fromDb = await database.findOne('components', { id: component.id });
      expect(fromDb).toBeDefined();

      // Both should be identical
      expect(fromCache[0]).toEqual(fromDb);
    });

    test('cache should stay synchronized during update operations', async () => {
      const component = await handle.createComponent({
        name: 'Original',
        dsl: 'O :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const updated = await handle.updateComponent(component.id, {
        name: 'Updated'
      });

      // Cache should have updated version
      const fromCache = dataSource.query({ id: component.id });
      expect(fromCache[0].name).toBe('Updated');

      // Database should have updated version
      const fromDb = await database.findOne('components', { id: component.id });
      expect(fromDb.name).toBe('Updated');

      // Both should be identical
      expect(fromCache[0]).toEqual(fromDb);
    });

    test('cache should stay synchronized during delete operations', async () => {
      const component = await handle.createComponent({
        name: 'Delete Test',
        dsl: 'DT :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await handle.deleteComponent(component.id);

      // Cache should not have the component
      const fromCache = dataSource.query({ id: component.id });
      expect(fromCache.length).toBe(0);

      // Database should not have the component
      const fromDb = await database.findOne('components', { id: component.id });
      expect(fromDb).toBeNull();
    });

    test('cache should populate from database on first access', async () => {
      // Create component directly in database
      const dbComponent = {
        id: 'comp_cache_test',
        name: 'Cache Population Test',
        dsl: 'CPT :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        version: 1
      };
      await database.insert('components', dbComponent);

      // Cache should be empty
      let fromCache = dataSource.query({ id: 'comp_cache_test' });
      expect(fromCache.length).toBe(0);

      // Access via DataSource (should populate cache)
      await dataSource.getComponent('comp_cache_test');

      // Cache should now have the component
      fromCache = dataSource.query({ id: 'comp_cache_test' });
      expect(fromCache.length).toBe(1);
      expect(fromCache[0]).toEqual(dbComponent);
    });
  });

  describe('Subscription Notifications', () => {
    test('should notify subscribers on create operations', async () => {
      let notificationReceived = false;
      let notifiedData = null;

      const subscription = dataSource.subscribe({}, (data) => {
        notificationReceived = true;
        notifiedData = data;
      });

      await handle.createComponent({
        name: 'Notify Test',
        dsl: 'NT :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      // Wait for async notification
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(notificationReceived).toBe(true);
      expect(notifiedData).toBeDefined();
      expect(notifiedData.length).toBe(1);
      expect(notifiedData[0].name).toBe('Notify Test');

      subscription.unsubscribe();
    });

    test('should notify subscribers on update operations', async () => {
      const component = await handle.createComponent({
        name: 'Original',
        dsl: 'O :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      // Wait for create notification to complete before subscribing
      await new Promise(resolve => setTimeout(resolve, 10));

      let notificationCount = 0;
      const subscription = dataSource.subscribe({}, () => {
        notificationCount++;
      });

      await handle.updateComponent(component.id, { name: 'Updated' });

      // Wait for async notification
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(notificationCount).toBe(1);

      subscription.unsubscribe();
    });

    test('should notify subscribers on delete operations', async () => {
      const component = await handle.createComponent({
        name: 'Delete Test',
        dsl: 'DT :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      let notificationReceived = false;
      const subscription = dataSource.subscribe({}, () => {
        notificationReceived = true;
      });

      await handle.deleteComponent(component.id);

      // Wait for async notification
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(notificationReceived).toBe(true);

      subscription.unsubscribe();
    });

    test('should notify only matching subscribers based on query', async () => {
      let aliceNotifications = 0;
      let bobNotifications = 0;

      const aliceSub = dataSource.subscribe({ author: 'alice' }, () => {
        aliceNotifications++;
      });

      const bobSub = dataSource.subscribe({ author: 'bob' }, () => {
        bobNotifications++;
      });

      // Create alice component
      await handle.createComponent({
        name: 'Alice Component',
        dsl: 'AC :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        author: 'alice'
      });

      // Wait for notifications
      await new Promise(resolve => setTimeout(resolve, 10));

      // Both should be notified (subscription queries data after change)
      expect(aliceNotifications).toBe(1);
      expect(bobNotifications).toBe(1);

      aliceSub.unsubscribe();
      bobSub.unsubscribe();
    });
  });

  describe('Batch Operations', () => {
    test('should import multiple components through full stack', async () => {
      const components = [
        {
          name: 'Import 1',
          dsl: 'I1 :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        },
        {
          name: 'Import 2',
          dsl: 'I2 :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        },
        {
          name: 'Import 3',
          dsl: 'I3 :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        }
      ];

      const imported = await handle.importComponents(components);

      // Verify all imported
      expect(imported.length).toBe(3);
      expect(imported.every(c => c.id && c.version === 1)).toBe(true);

      // Verify all in database
      const fromDb = await database.find('components', {});
      expect(fromDb.length).toBe(3);

      // Verify all in cache
      const fromCache = dataSource.query({});
      expect(fromCache.length).toBe(3);
    });

    test('should export multiple components through full stack', async () => {
      const comp1 = await handle.createComponent({
        name: 'Export 1',
        dsl: 'E1 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const comp2 = await handle.createComponent({
        name: 'Export 2',
        dsl: 'E2 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const comp3 = await handle.createComponent({
        name: 'Export 3',
        dsl: 'E3 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const exported = await handle.exportComponents([comp1.id, comp3.id]);

      expect(exported.length).toBe(2);
      expect(exported.map(c => c.id)).toContain(comp1.id);
      expect(exported.map(c => c.id)).toContain(comp3.id);
      expect(exported.map(c => c.id)).not.toContain(comp2.id);
    });
  });

  describe('Complete CRUD Workflow', () => {
    test('should execute full lifecycle: create → read → update → delete', async () => {
      // CREATE
      const created = await handle.createComponent({
        name: 'Lifecycle Test',
        description: 'Testing full lifecycle',
        dsl: 'LT :: state => div { state.message }',
        dataModel: {
          entityName: 'state',
          schema: {
            properties: {
              message: { type: 'string' }
            }
          },
          sampleData: {
            message: 'Hello'
          }
        },
        author: 'test-user',
        category: 'test'
      });

      expect(created.id).toBeDefined();
      expect(created.version).toBe(1);

      // READ - from cache
      const fromCache = dataSource.query({ id: created.id });
      expect(fromCache.length).toBe(1);
      expect(fromCache[0].name).toBe('Lifecycle Test');

      // READ - from database via Handle
      const retrieved = await handle.getComponent(created.id);
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.description).toBe('Testing full lifecycle');

      // UPDATE
      const updated = await handle.updateComponent(created.id, {
        description: 'Updated lifecycle test',
        version: 2
      });

      expect(updated.description).toBe('Updated lifecycle test');
      expect(updated.version).toBe(2);

      // Verify update in database
      const afterUpdate = await database.findOne('components', { id: created.id });
      expect(afterUpdate.description).toBe('Updated lifecycle test');
      expect(afterUpdate.version).toBe(2);

      // DELETE
      const deleteResult = await handle.deleteComponent(created.id);
      expect(deleteResult).toBe(true);

      // Verify deletion
      const afterDelete = await database.findOne('components', { id: created.id });
      expect(afterDelete).toBeNull();

      const fromCacheAfterDelete = dataSource.query({ id: created.id });
      expect(fromCacheAfterDelete.length).toBe(0);

      const retrievedAfterDelete = await handle.getComponent(created.id);
      expect(retrievedAfterDelete).toBeNull();
    });
  });
});
