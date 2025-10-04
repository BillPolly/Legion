/**
 * Component Testing Integration Tests - Phase 7.6
 *
 * End-to-end tests for complete component testing workflow
 * Tests component test definition, execution, and result display
 *
 * Note: Detailed assertion types and failure scenarios are covered by ComponentTestRunner unit tests.
 * These integration tests focus on the end-to-end flow through the UI.
 */

import { ComponentEditor } from '../../../src/components/component-editor/index.js';
import { ComponentLibraryHandle } from '../../../src/components/component-editor/src/handles/ComponentLibraryHandle.js';
import { ComponentLibraryDataSource } from '../../../src/components/component-editor/src/datasources/ComponentLibraryDataSource.js';
import { ComponentStoreActor } from '../../../src/components/component-editor/src/actors/ComponentStoreActor.js';
import { ComponentTestRunner } from '../../../src/components/component-editor/src/testing/ComponentTestRunner.js';

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

// Mock ComponentLifecycle for testing (simulates real rendering)
class MockComponentLifecycle {
  async mount(dsl, container, data) {
    // Simple DSL parsing simulation
    if (dsl.includes('h2') && dsl.includes('user.name')) {
      const h2 = document.createElement('h2');
      h2.className = 'name';
      h2.textContent = data.name || '';
      container.appendChild(h2);
    }

    return {
      unmount: async () => {
        container.innerHTML = '';
      }
    };
  }
}

describe('Component Testing Integration - Phase 7.6', () => {
  let container;
  let database;
  let actor;
  let dataSource;
  let componentStore;
  let mockLifecycle;
  let mockTestRunner;

  beforeEach(() => {
    // Create DOM container
    container = document.createElement('div');
    container.id = 'testing-integration-test';
    document.body.appendChild(container);

    // Create backend stack
    database = new InMemoryDatabase();
    actor = new ComponentStoreActor(database);
    dataSource = new ComponentLibraryDataSource(actor);
    componentStore = new ComponentLibraryHandle(dataSource);

    // Create mock lifecycle and test runner
    mockLifecycle = new MockComponentLifecycle();
    mockTestRunner = new ComponentTestRunner(mockLifecycle);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    database.clear();
  });

  describe('End-to-End Component Testing Workflow', () => {
    test('should load component with test definitions', async () => {
      const component = await componentStore.createComponent({
        name: 'UserCard',
        dsl: 'UserCard :: user => div { h2.name { user.name } }',
        tags: [],
        dataModel: {
          entityName: 'user',
          schema: { properties: { name: { type: 'string' } } },
          sampleData: { name: 'John Doe' }
        },
        tests: [
          {
            name: 'should display user name',
            data: { name: 'Test User' },
            assertions: [
              {
                selector: 'h2.name',
                property: 'textContent',
                operator: 'equals',
                expected: 'Test User'
              }
            ]
          }
        ]
      });

      const editor = ComponentEditor.create({ dom: container, componentStore });
      await editor.loadComponent(component.id);

      // Verify component has tests
      const loadedComponent = await componentStore.getComponent(component.id);
      expect(loadedComponent.tests).toBeDefined();
      expect(loadedComponent.tests.length).toBe(1);
      expect(loadedComponent.tests[0].name).toBe('should display user name');

      editor.destroy();
    });

    test('should run tests and display results through UI', async () => {
      const component = await componentStore.createComponent({
        name: 'SimpleComponent',
        dsl: 'SimpleComponent :: user => h2.name { user.name }',
        tags: [],
        dataModel: {
          entityName: 'user',
          schema: { properties: { name: { type: 'string' } } },
          sampleData: { name: 'Test' }
        },
        tests: [
          {
            name: 'should display name',
            data: { name: 'Test User' },
            assertions: [
              {
                selector: 'h2.name',
                property: 'textContent',
                operator: 'equals',
                expected: 'Test User'
              }
            ]
          }
        ]
      });

      const editor = ComponentEditor.create({
        dom: container,
        componentStore,
        testRunner: mockTestRunner
      });
      await editor.loadComponent(component.id);

      // Trigger test via button
      const testButton = container.querySelector('.btn-test');
      expect(testButton).toBeTruthy();
      testButton.click();

      // Wait for async test execution
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify results displayed in UI
      const testResults = container.querySelector('.test-results');
      expect(testResults).toBeTruthy();

      const summary = testResults.querySelector('.test-summary');
      expect(summary.textContent).toContain('1 passed');

      editor.destroy();
    });
  });
});
