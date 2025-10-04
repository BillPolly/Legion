/**
 * Component Filtering Integration Tests - Phase 8.4
 *
 * End-to-end tests for component library filtering functionality
 * Tests complete filtering workflow through all MVVM layers with real components
 */

import { ComponentEditor } from '../../../src/components/component-editor/index.js';
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

describe('Component Filtering Integration - Phase 8.4', () => {
  let container;
  let database;
  let actor;
  let dataSource;
  let componentStore;

  beforeEach(() => {
    // Create DOM container
    container = document.createElement('div');
    container.id = 'filter-integration-test';
    document.body.appendChild(container);

    // Create backend stack
    database = new InMemoryDatabase();
    actor = new ComponentStoreActor(database);
    dataSource = new ComponentLibraryDataSource(actor);
    componentStore = new ComponentLibraryHandle(dataSource);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    database.clear();
  });

  describe('End-to-End Component Filtering', () => {
    test('should filter components by name through UI', async () => {
      // Create test components
      await componentStore.createComponent({
        name: 'UserCard',
        dsl: 'UserCard :: user => div',
        tags: [],
        dataModel: { entityName: 'user', schema: {}, sampleData: {} }
      });

      await componentStore.createComponent({
        name: 'ProductCard',
        dsl: 'ProductCard :: product => div',
        tags: [],
        dataModel: { entityName: 'product', schema: {}, sampleData: {} }
      });

      await componentStore.createComponent({
        name: 'UserProfile',
        dsl: 'UserProfile :: user => div',
        tags: [],
        dataModel: { entityName: 'user', schema: {}, sampleData: {} }
      });

      // Create editor
      const editor = ComponentEditor.create({ dom: container, componentStore });

      // Load component list
      const model = editor.viewModel.model;
      await model.loadComponentList();

      // Verify initial count
      expect(model.componentList.length).toBe(3);

      // Filter by name "User"
      const nameInput = container.querySelector('.filter-input');
      expect(nameInput).toBeTruthy();

      nameInput.value = 'User';
      nameInput.dispatchEvent(new Event('input'));

      // Wait for async filtering
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify filtered results in DOM
      const browserList = container.querySelector('.browser-list');
      const items = browserList.querySelectorAll('.component-item');
      expect(items.length).toBe(2); // UserCard and UserProfile

      // Verify component names
      const names = Array.from(items).map(item =>
        item.querySelector('.component-name').textContent
      );
      expect(names).toContain('UserCard');
      expect(names).toContain('UserProfile');
      expect(names).not.toContain('ProductCard');

      editor.destroy();
    });

    test('should filter components by tag through UI', async () => {
      await componentStore.createComponent({
        name: 'UserCard',
        dsl: 'UserCard :: user => div',
        tags: ['user', 'card'],
        dataModel: { entityName: 'user', schema: {}, sampleData: {} }
      });

      await componentStore.createComponent({
        name: 'UserProfile',
        dsl: 'UserProfile :: user => div',
        tags: ['user', 'profile'],
        dataModel: { entityName: 'user', schema: {}, sampleData: {} }
      });

      await componentStore.createComponent({
        name: 'ProductCard',
        dsl: 'ProductCard :: product => div',
        tags: ['product', 'card'],
        dataModel: { entityName: 'product', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({ dom: container, componentStore });

      // Load component list
      await editor.viewModel.model.loadComponentList();

      // Add tag option to select
      const tagSelect = container.querySelector('.filter-tag');
      const option = document.createElement('option');
      option.value = 'user';
      option.textContent = 'user';
      tagSelect.appendChild(option);

      // Filter by tag
      tagSelect.value = 'user';
      tagSelect.dispatchEvent(new Event('change'));

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify filtered results
      const browserList = container.querySelector('.browser-list');
      const items = browserList.querySelectorAll('.component-item');
      expect(items.length).toBe(2); // UserCard and UserProfile

      const names = Array.from(items).map(item =>
        item.querySelector('.component-name').textContent
      );
      expect(names).toContain('UserCard');
      expect(names).toContain('UserProfile');
      expect(names).not.toContain('ProductCard');

      editor.destroy();
    });

    test('should filter components by author through UI', async () => {
      await componentStore.createComponent({
        name: 'AliceComponent1',
        dsl: 'AliceComponent1 :: s => div',
        tags: [],
        author: 'alice',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await componentStore.createComponent({
        name: 'AliceComponent2',
        dsl: 'AliceComponent2 :: s => div',
        tags: [],
        author: 'alice',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await componentStore.createComponent({
        name: 'BobComponent',
        dsl: 'BobComponent :: s => div',
        tags: [],
        author: 'bob',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({ dom: container, componentStore });

      await editor.viewModel.model.loadComponentList();

      // Add author option to select
      const authorSelect = container.querySelector('.filter-author');
      const option = document.createElement('option');
      option.value = 'alice';
      option.textContent = 'alice';
      authorSelect.appendChild(option);

      // Filter by author
      authorSelect.value = 'alice';
      authorSelect.dispatchEvent(new Event('change'));

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify filtered results
      const browserList = container.querySelector('.browser-list');
      const items = browserList.querySelectorAll('.component-item');
      expect(items.length).toBe(2); // Both Alice's components

      const names = Array.from(items).map(item =>
        item.querySelector('.component-name').textContent
      );
      expect(names).toContain('AliceComponent1');
      expect(names).toContain('AliceComponent2');
      expect(names).not.toContain('BobComponent');

      editor.destroy();
    });

    test('should clear filters when filter value is empty', async () => {
      await componentStore.createComponent({
        name: 'Component1',
        dsl: 'Component1 :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await componentStore.createComponent({
        name: 'Component2',
        dsl: 'Component2 :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({ dom: container, componentStore });

      await editor.viewModel.model.loadComponentList();

      const nameInput = container.querySelector('.filter-input');

      // Apply filter
      nameInput.value = 'Component1';
      nameInput.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify filtered
      let items = container.querySelectorAll('.component-item');
      expect(items.length).toBe(1);

      // Clear filter
      nameInput.value = '';
      nameInput.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify all shown
      items = container.querySelectorAll('.component-item');
      expect(items.length).toBe(2);

      editor.destroy();
    });

    test('should support case-insensitive name filtering', async () => {
      await componentStore.createComponent({
        name: 'UserCard',
        dsl: 'UserCard :: user => div',
        tags: [],
        dataModel: { entityName: 'user', schema: {}, sampleData: {} }
      });

      await componentStore.createComponent({
        name: 'ProductCard',
        dsl: 'ProductCard :: product => div',
        tags: [],
        dataModel: { entityName: 'product', schema: {}, sampleData: {} }
      });

      const editor = ComponentEditor.create({ dom: container, componentStore });

      await editor.viewModel.model.loadComponentList();

      const nameInput = container.querySelector('.filter-input');

      // Filter with lowercase
      nameInput.value = 'user';
      nameInput.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify case-insensitive match
      const items = container.querySelectorAll('.component-item');
      expect(items.length).toBe(1);
      expect(items[0].querySelector('.component-name').textContent).toBe('UserCard');

      editor.destroy();
    });
  });
});
