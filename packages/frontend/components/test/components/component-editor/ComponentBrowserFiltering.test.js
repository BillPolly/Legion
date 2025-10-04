/**
 * Component Browser Filtering Tests - Phase 8.3
 *
 * Tests for component browser filtering functionality
 * Tests filter event handling and component list filtering
 */

import { ComponentEditorViewModel } from '../../../src/components/component-editor/src/viewmodel/ComponentEditorViewModel.js';
import { ComponentEditorModel } from '../../../src/components/component-editor/src/model/ComponentEditorModel.js';
import { ComponentEditorView } from '../../../src/components/component-editor/src/view/ComponentEditorView.js';
import { ComponentLibraryHandle } from '../../../src/components/component-editor/src/handles/ComponentLibraryHandle.js';
import { ComponentLibraryDataSource } from '../../../src/components/component-editor/src/datasources/ComponentLibraryDataSource.js';
import { ComponentStoreActor } from '../../../src/components/component-editor/src/actors/ComponentStoreActor.js';

// In-memory database for testing
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

describe('Component Browser Filtering - Phase 8.3', () => {
  let container;
  let database;
  let actor;
  let dataSource;
  let componentStore;
  let model;
  let view;
  let viewModel;

  beforeEach(() => {
    // Create DOM container
    container = document.createElement('div');
    container.id = 'browser-filter-test';
    document.body.appendChild(container);

    // Create backend stack
    database = new InMemoryDatabase();
    actor = new ComponentStoreActor(database);
    dataSource = new ComponentLibraryDataSource(actor);
    componentStore = new ComponentLibraryHandle(dataSource);

    // Create MVVM stack
    model = new ComponentEditorModel({ componentStore });
    view = new ComponentEditorView({ dom: container });
    viewModel = new ComponentEditorViewModel({ model, view });
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    database.clear();
  });

  describe('Model - Component List Loading', () => {
    test('should load all components', async () => {
      await componentStore.createComponent({
        name: 'Component1',
        dsl: 'Component1 :: s => div',
        tags: ['tag1'],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await componentStore.createComponent({
        name: 'Component2',
        dsl: 'Component2 :: s => div',
        tags: ['tag2'],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      const components = await model.loadComponentList();
      expect(components.length).toBe(2);
    });

    test('should filter components by name', async () => {
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

      await model.loadComponentList();

      const filtered = model.filterComponentsByName('User');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('UserCard');
    });

    test('should filter components by tag', async () => {
      await componentStore.createComponent({
        name: 'UserProfile',
        dsl: 'UserProfile :: user => div',
        tags: ['user', 'profile'],
        dataModel: { entityName: 'user', schema: {}, sampleData: {} }
      });

      await componentStore.createComponent({
        name: 'UserCard',
        dsl: 'UserCard :: user => div',
        tags: ['user', 'card'],
        dataModel: { entityName: 'user', schema: {}, sampleData: {} }
      });

      await componentStore.createComponent({
        name: 'ProductCard',
        dsl: 'ProductCard :: product => div',
        tags: ['product', 'card'],
        dataModel: { entityName: 'product', schema: {}, sampleData: {} }
      });

      const filtered = model.filterComponentsByTag('user');
      expect(filtered.length).toBe(2);
      expect(filtered.every(c => c.tags.includes('user'))).toBe(true);
    });

    test('should filter components by author', async () => {
      await componentStore.createComponent({
        name: 'AliceComponent',
        dsl: 'AliceComponent :: s => div',
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

      const filtered = model.filterComponentsByAuthor('alice');
      expect(filtered.length).toBe(1);
      expect(filtered[0].author).toBe('alice');
    });

    test('should support case-insensitive name filtering', async () => {
      await componentStore.createComponent({
        name: 'UserCard',
        dsl: 'UserCard :: user => div',
        tags: [],
        dataModel: { entityName: 'user', schema: {}, sampleData: {} }
      });

      await model.loadComponentList();

      const filtered = model.filterComponentsByName('user');
      expect(filtered.length).toBe(1);
    });
  });

  describe('ViewModel - Filter Event Handling', () => {
    test('should handle name filter change', async () => {
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

      // Load initial list
      await viewModel.loadComponentList();

      // Spy on view.renderComponentList
      let renderedComponents = null;
      viewModel.view.renderComponentList = (components) => {
        renderedComponents = components;
      };

      // Change name filter
      await viewModel.handleNameFilter('User');

      expect(renderedComponents).toBeTruthy();
      expect(renderedComponents.length).toBe(1);
      expect(renderedComponents[0].name).toBe('UserCard');
    });

    test('should handle tag filter change', async () => {
      await componentStore.createComponent({
        name: 'UserProfile',
        dsl: 'UserProfile :: user => div',
        tags: ['user'],
        dataModel: { entityName: 'user', schema: {}, sampleData: {} }
      });

      await componentStore.createComponent({
        name: 'ProductCard',
        dsl: 'ProductCard :: product => div',
        tags: ['product'],
        dataModel: { entityName: 'product', schema: {}, sampleData: {} }
      });

      await viewModel.loadComponentList();

      let renderedComponents = null;
      viewModel.view.renderComponentList = (components) => {
        renderedComponents = components;
      };

      await viewModel.handleTagFilter('user');

      expect(renderedComponents.length).toBe(1);
      expect(renderedComponents[0].tags).toContain('user');
    });

    test('should handle author filter change', async () => {
      await componentStore.createComponent({
        name: 'Component1',
        dsl: 'Component1 :: s => div',
        tags: [],
        author: 'alice',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await componentStore.createComponent({
        name: 'Component2',
        dsl: 'Component2 :: s => div',
        tags: [],
        author: 'bob',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await viewModel.loadComponentList();

      let renderedComponents = null;
      viewModel.view.renderComponentList = (components) => {
        renderedComponents = components;
      };

      await viewModel.handleAuthorFilter('alice');

      expect(renderedComponents.length).toBe(1);
      expect(renderedComponents[0].author).toBe('alice');
    });

    test('should clear filters when filter value is empty', async () => {
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

      await viewModel.loadComponentList();

      // Apply filter
      await viewModel.handleNameFilter('User');

      let renderedComponents = null;
      viewModel.view.renderComponentList = (components) => {
        renderedComponents = components;
      };

      // Clear filter
      await viewModel.handleNameFilter('');

      expect(renderedComponents.length).toBe(2);
    });
  });

  describe('View - Filter UI Events', () => {
    test('should wire up name filter input event', async () => {
      await componentStore.createComponent({
        name: 'TestComponent',
        dsl: 'TestComponent :: s => div',
        tags: [],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await viewModel.loadComponentList();

      const nameInput = container.querySelector('.filter-input');
      expect(nameInput).toBeTruthy();

      let filterCalled = false;
      viewModel.handleNameFilter = async (name) => {
        filterCalled = true;
        expect(name).toBe('Test');
      };

      nameInput.value = 'Test';
      nameInput.dispatchEvent(new Event('input'));

      expect(filterCalled).toBe(true);
    });

    test('should wire up tag filter select event', async () => {
      await componentStore.createComponent({
        name: 'TestComponent',
        dsl: 'TestComponent :: s => div',
        tags: ['test'],
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await viewModel.loadComponentList();

      const tagSelect = container.querySelector('.filter-tag');
      expect(tagSelect).toBeTruthy();

      // Add option to select (normally populated by component list)
      const option = document.createElement('option');
      option.value = 'test';
      option.textContent = 'test';
      tagSelect.appendChild(option);

      let filterCalled = false;
      viewModel.handleTagFilter = async (tag) => {
        filterCalled = true;
        expect(tag).toBe('test');
      };

      tagSelect.value = 'test';
      tagSelect.dispatchEvent(new Event('change'));

      expect(filterCalled).toBe(true);
    });

    test('should wire up author filter select event', async () => {
      await componentStore.createComponent({
        name: 'TestComponent',
        dsl: 'TestComponent :: s => div',
        tags: [],
        author: 'alice',
        dataModel: { entityName: 's', schema: {}, sampleData: {} }
      });

      await viewModel.loadComponentList();

      const authorSelect = container.querySelector('.filter-author');
      expect(authorSelect).toBeTruthy();

      // Add option to select (normally populated by component list)
      const option = document.createElement('option');
      option.value = 'alice';
      option.textContent = 'alice';
      authorSelect.appendChild(option);

      let filterCalled = false;
      viewModel.handleAuthorFilter = async (author) => {
        filterCalled = true;
        expect(author).toBe('alice');
      };

      authorSelect.value = 'alice';
      authorSelect.dispatchEvent(new Event('change'));

      expect(filterCalled).toBe(true);
    });
  });
});
