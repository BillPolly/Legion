/**
 * ComponentLibraryDataSource Tests - Phase 2.3
 *
 * Tests for ComponentLibraryDataSource implementation
 * This DataSource wraps the ComponentStoreActor for Handle operations
 */

import { ComponentLibraryDataSource } from '../../../src/components/component-editor/src/datasources/ComponentLibraryDataSource.js';

// Mock Actor for testing DataSource
class MockComponentStoreActor {
  constructor() {
    this.storage = new Map();
    this.nextId = 1;
  }

  async receive(messageType, data) {
    switch (messageType) {
      case 'component.create':
        const id = `comp_${this.nextId++}`;
        const component = {
          id,
          ...data,
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          version: 1
        };
        this.storage.set(id, component);
        return component;

      case 'component.get':
        return this.storage.get(data.id) || null;

      case 'component.update':
        const existing = this.storage.get(data.id);
        if (!existing) throw new Error('Component not found');
        const updated = {
          ...existing,
          ...data.updates,
          modified: new Date().toISOString(),
          version: existing.version + 1
        };
        this.storage.set(data.id, updated);
        return updated;

      case 'component.delete':
        return this.storage.delete(data.id);

      case 'component.list':
        const all = Array.from(this.storage.values());
        if (!data.filter || Object.keys(data.filter).length === 0) {
          return all;
        }
        return all.filter(item =>
          Object.entries(data.filter).every(([key, value]) => item[key] === value)
        );

      default:
        throw new Error(`Unknown message type: ${messageType}`);
    }
  }
}

describe('ComponentLibraryDataSource', () => {
  let backendActor;
  let dataSource;

  beforeEach(() => {
    backendActor = new MockComponentStoreActor();
    dataSource = new ComponentLibraryDataSource(backendActor);
  });

  describe('Constructor', () => {
    test('should create ComponentLibraryDataSource with backend actor', () => {
      expect(dataSource).toBeInstanceOf(ComponentLibraryDataSource);
      expect(dataSource.backend).toBe(backendActor);
    });

    test('should initialize cache', () => {
      expect(dataSource.cache).toBeInstanceOf(Map);
      expect(dataSource.cache.size).toBe(0);
    });
  });

  describe('Required DataSource Methods', () => {
    describe('query() - REQUIRED synchronous method', () => {
      test('should return cached data synchronously', async () => {
        // Add some data to cache
        const component = {
          id: 'comp_1',
          name: 'TestComponent',
          dsl: 'Test :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        };
        dataSource.cache.set('comp_1', component);

        // Query should return synchronously from cache
        const result = dataSource.query({ id: 'comp_1' });
        expect(result).toEqual([component]);
      });

      test('should return all cached components for empty query', () => {
        dataSource.cache.set('comp_1', { id: 'comp_1', name: 'Comp1' });
        dataSource.cache.set('comp_2', { id: 'comp_2', name: 'Comp2' });

        const result = dataSource.query({});
        expect(result.length).toBe(2);
      });

      test('should filter cached data by simple criteria', () => {
        dataSource.cache.set('comp_1', { id: 'comp_1', author: 'alice' });
        dataSource.cache.set('comp_2', { id: 'comp_2', author: 'bob' });

        const result = dataSource.query({ author: 'alice' });
        expect(result.length).toBe(1);
        expect(result[0].author).toBe('alice');
      });
    });

    describe('subscribe() - REQUIRED synchronous method', () => {
      test('should create subscription synchronously', () => {
        const callback = () => {};
        const subscription = dataSource.subscribe({}, callback);

        expect(subscription).toBeDefined();
        expect(subscription.id).toBeDefined();
        expect(typeof subscription.unsubscribe).toBe('function');
      });

      test('should track subscriptions', () => {
        const callback1 = () => {};
        const callback2 = () => {};

        const sub1 = dataSource.subscribe({}, callback1);
        const sub2 = dataSource.subscribe({}, callback2);

        expect(dataSource._subscriptions.size).toBe(2);

        sub1.unsubscribe();
        expect(dataSource._subscriptions.size).toBe(1);

        sub2.unsubscribe();
        expect(dataSource._subscriptions.size).toBe(0);
      });

      test('should call callback when data changes', async () => {
        let called = false;
        const callback = () => { called = true; };
        dataSource.subscribe({}, callback);

        // Create component (should trigger callback)
        await dataSource.createComponent({
          name: 'Test',
          dsl: 'Test :: s => div',
          dataModel: { entityName: 's', schema: {}, sampleData: {} }
        });

        // Wait for async callback
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(called).toBe(true);
      });
    });

    describe('getSchema() - REQUIRED synchronous method', () => {
      test('should return schema synchronously', () => {
        const schema = dataSource.getSchema();

        expect(schema).toBeDefined();
        expect(schema.type).toBe('ComponentLibrary');
        expect(schema.operations).toContain('create');
        expect(schema.operations).toContain('read');
        expect(schema.operations).toContain('update');
        expect(schema.operations).toContain('delete');
      });

      test('should include component schema definition', () => {
        const schema = dataSource.getSchema();

        expect(schema.componentSchema).toBeDefined();
        expect(schema.componentSchema.id).toBeDefined();
        expect(schema.componentSchema.name).toBeDefined();
        expect(schema.componentSchema.dsl).toBeDefined();
      });
    });
  });

  describe('Async CRUD Operations', () => {
    test('createComponent() should create via backend and cache result', async () => {
      const componentData = {
        name: 'NewComponent',
        dsl: 'New :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      };

      const result = await dataSource.createComponent(componentData);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('NewComponent');
      expect(result.version).toBe(1);

      // Verify cached
      expect(dataSource.cache.has(result.id)).toBe(true);
      expect(dataSource.cache.get(result.id)).toEqual(result);
    });

    test('getComponent() should return from cache if available', async () => {
      // Add to cache
      const cached = { id: 'comp_cached', name: 'Cached' };
      dataSource.cache.set('comp_cached', cached);

      const result = await dataSource.getComponent('comp_cached');
      expect(result).toEqual(cached);
    });

    test('getComponent() should fetch from backend if not cached', async () => {
      // Create component via backend
      const created = await backendActor.receive('component.create', {
        name: 'BackendComponent',
        dsl: 'BC :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      // Get via dataSource (not in cache)
      const result = await dataSource.getComponent(created.id);

      expect(result).toEqual(created);
      // Should now be cached
      expect(dataSource.cache.has(created.id)).toBe(true);
    });

    test('updateComponent() should update via backend and update cache', async () => {
      const created = await dataSource.createComponent({
        name: 'UpdateTest',
        description: 'Original',
        dsl: 'UT :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const updated = await dataSource.updateComponent(created.id, {
        description: 'Updated'
      });

      expect(updated.description).toBe('Updated');
      expect(updated.version).toBe(2);

      // Verify cache updated
      expect(dataSource.cache.get(created.id).description).toBe('Updated');
    });

    test('deleteComponent() should delete via backend and remove from cache', async () => {
      const created = await dataSource.createComponent({
        name: 'DeleteTest',
        dsl: 'DT :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      expect(dataSource.cache.has(created.id)).toBe(true);

      const result = await dataSource.deleteComponent(created.id);
      expect(result).toBe(true);

      // Verify removed from cache
      expect(dataSource.cache.has(created.id)).toBe(false);
    });

    test('listComponents() should fetch from backend and cache results', async () => {
      await dataSource.createComponent({
        name: 'Comp1',
        dsl: 'C1 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        author: 'alice'
      });

      await dataSource.createComponent({
        name: 'Comp2',
        dsl: 'C2 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} },
        author: 'bob'
      });

      // Clear cache to test fetching
      dataSource.cache.clear();

      // List with filter
      const results = await dataSource.listComponents({ author: 'alice' });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Comp1');

      // Verify all results cached
      expect(dataSource.cache.size).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    test('should maintain cache across operations', async () => {
      const comp1 = await dataSource.createComponent({
        name: 'Comp1',
        dsl: 'C1 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      expect(dataSource.cache.size).toBe(1);

      const comp2 = await dataSource.createComponent({
        name: 'Comp2',
        dsl: 'C2 :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      expect(dataSource.cache.size).toBe(2);

      await dataSource.deleteComponent(comp1.id);
      expect(dataSource.cache.size).toBe(1);
      expect(dataSource.cache.has(comp2.id)).toBe(true);
    });

    test('cache should reflect updates', async () => {
      const created = await dataSource.createComponent({
        name: 'Original',
        dsl: 'O :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      expect(dataSource.cache.get(created.id).name).toBe('Original');

      await dataSource.updateComponent(created.id, { name: 'Updated' });

      expect(dataSource.cache.get(created.id).name).toBe('Updated');
    });
  });

  describe('Subscription Notifications', () => {
    test('should notify subscribers on create', async () => {
      let called = false;
      const callback = () => { called = true; };
      dataSource.subscribe({}, callback);

      await dataSource.createComponent({
        name: 'Test',
        dsl: 'T :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(called).toBe(true);
    });

    test('should notify subscribers on update', async () => {
      const created = await dataSource.createComponent({
        name: 'Test',
        dsl: 'T :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      let called = false;
      const callback = () => { called = true; };
      dataSource.subscribe({}, callback);

      await dataSource.updateComponent(created.id, { name: 'Updated' });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(called).toBe(true);
    });

    test('should notify subscribers on delete', async () => {
      const created = await dataSource.createComponent({
        name: 'Test',
        dsl: 'T :: s => div',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      let called = false;
      const callback = () => { called = true; };
      dataSource.subscribe({}, callback);

      await dataSource.deleteComponent(created.id);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(called).toBe(true);
    });
  });
});
