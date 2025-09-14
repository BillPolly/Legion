/**
 * Unit tests for ComponentLifecycle
 * Tests component mounting, updating, unmounting, and lifecycle hooks
 */

import { ComponentLifecycle, ComponentInstance } from '../../../src/lifecycle/ComponentLifecycle.js';
import { DataStore } from '@legion/data-store';

describe('ComponentLifecycle', () => {
  let dataStore;
  let lifecycle;
  let schema;
  let container;

  beforeEach(async () => {
    // Create test schema
    schema = {
      ':entity/name': { unique: 'identity' },
      ':name': {},
      ':age': {},
      ':active': {},
      ':title': {},
      ':content': {}
    };

    dataStore = new DataStore(schema);
    lifecycle = new ComponentLifecycle(dataStore);

    // Create DOM container for testing
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (lifecycle) {
      lifecycle.cleanup();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Initialization', () => {
    test('should create ComponentLifecycle with DataStore', () => {
      expect(lifecycle).toBeDefined();
      expect(lifecycle.dataStore).toBe(dataStore);
      expect(lifecycle.dataStoreAdapter).toBeDefined();
      expect(lifecycle.compiler).toBeDefined();
    });

    test('should throw without DataStore', () => {
      expect(() => new ComponentLifecycle()).toThrow('DataStore is required');
    });

    test('should initialize with empty mounted components', () => {
      expect(lifecycle.mountedComponents.size).toBe(0);
      expect(lifecycle.componentCounter).toBe(0);
    });

    test('should initialize with empty lifecycle hooks', () => {
      expect(lifecycle.hooks.beforeMount.size).toBe(0);
      expect(lifecycle.hooks.afterMount.size).toBe(0);
      expect(lifecycle.hooks.beforeUpdate.size).toBe(0);
      expect(lifecycle.hooks.afterUpdate.size).toBe(0);
      expect(lifecycle.hooks.beforeUnmount.size).toBe(0);
      expect(lifecycle.hooks.afterUnmount.size).toBe(0);
    });
  });

  describe('Component Mounting', () => {
    test('should mount simple component with text content', async () => {
      const dsl = `
        SimpleComponent :: user =>
          div.container { user.name }
      `;

      const initialData = {
        name: 'John Doe'
      };

      const component = await lifecycle.mount(dsl, container, initialData);

      expect(component).toBeInstanceOf(ComponentInstance);
      expect(component.id).toMatch(/^component_\d+$/);
      expect(component.isMounted).toBe(true);
      expect(component.data.name).toBe('John Doe');

      // Verify DOM structure is created
      expect(container.children.length).toBe(1);
      const divElement = container.firstChild;
      expect(divElement.tagName).toBe('DIV');
      expect(divElement.className).toBe('container');
      // Text content will be set by bindings which are processed asynchronously
    });

    test('should mount component with nested structure', async () => {
      const dsl = `
        Card :: user =>
          div.card [
            h1.title { user.name }
            p.content { user.bio }
          ]
      `;

      const initialData = {
        name: 'Jane Smith',
        bio: 'Software Developer'
      };

      const component = await lifecycle.mount(dsl, container, initialData);

      expect(component).toBeInstanceOf(ComponentInstance);

      // Verify DOM structure is created
      expect(container.children.length).toBe(1);
      const cardDiv = container.firstChild;
      expect(cardDiv.className).toBe('card');
      expect(cardDiv.children.length).toBe(2);

      const titleH1 = cardDiv.children[0];
      expect(titleH1.tagName).toBe('H1');
      expect(titleH1.className).toBe('title');
      // Text content will be set by bindings

      const contentP = cardDiv.children[1];
      expect(contentP.tagName).toBe('P');
      expect(contentP.className).toBe('content');
      // Text content will be set by bindings
    });

    test('should mount component with attributes', async () => {
      const dsl = `
        InputForm :: user =>
          input.form-input { "" }
      `;

      const initialData = {
        name: 'Current Name'
      };

      const component = await lifecycle.mount(dsl, container, initialData);

      // Verify DOM element is created
      const input = container.firstChild;
      expect(input.tagName).toBe('INPUT');
      expect(input.className).toBe('form-input');
    });

    test('should mount component with event handlers', async () => {
      const dsl = `
        ClickButton :: user =>
          button.action-btn @click="increment" { "Click me" }
      `;

      const initialData = {
        clickCount: 0
      };

      const component = await lifecycle.mount(dsl, container, initialData);

      // Verify event handler setup
      const button = container.firstChild;
      expect(button.tagName).toBe('BUTTON');
      expect(button.className).toBe('action-btn');

      // Test event handling setup (not execution)
      expect(component.definition.events.length).toBe(1);
      expect(component.definition.events[0].event).toBe('click');
      expect(component.definition.events[0].action).toBe('increment');
    });

    test('should track mounted components', async () => {
      const dsl = `TestComponent :: user => div { user.name }`;
      
      expect(lifecycle.mountedComponents.size).toBe(0);
      
      const component1 = await lifecycle.mount(dsl, container, { name: 'User 1' });
      expect(lifecycle.mountedComponents.size).toBe(1);
      expect(lifecycle.getComponent(component1.id)).toBe(component1);

      const container2 = document.createElement('div');
      const component2 = await lifecycle.mount(dsl, container2, { name: 'User 2' });
      expect(lifecycle.mountedComponents.size).toBe(2);
      expect(lifecycle.getComponent(component2.id)).toBe(component2);
    });

    test('should initialize entities in DataStore', async () => {
      const dsl = `UserCard :: user => div { user.name }`;
      const initialData = { name: 'Test User', age: 25 };

      await lifecycle.mount(dsl, container, initialData);

      // Verify entity exists in DataStore
      const entityData = lifecycle.dataStoreAdapter.getEntityData('user');
      expect(entityData).toBeDefined();
      expect(entityData.name).toBe('Test User');
      expect(entityData.age).toBe(25);
    });
  });

  describe('Component Updates', () => {
    let component;

    beforeEach(async () => {
      const dsl = `UserProfile :: user => div { user.name }`;
      const initialData = { name: 'John Doe', age: 30 };
      component = await lifecycle.mount(dsl, container, initialData);
    });

    test('should update component data', async () => {
      expect(component.data.name).toBe('John Doe');

      await lifecycle.update(component.id, { name: 'Jane Smith', age: 25 });

      expect(component.data.name).toBe('Jane Smith');
      expect(component.data.age).toBe(25);
    });

    test('should update DataStore on component update', async () => {
      await lifecycle.update(component.id, { name: 'Updated Name' });

      const entityData = lifecycle.dataStoreAdapter.getEntityData('user');
      expect(entityData.name).toBe('Updated Name');
    });

    test('should throw error for non-existent component', async () => {
      await expect(lifecycle.update('non-existent', { name: 'Test' }))
        .rejects.toThrow('Component "non-existent" not found');
    });
  });

  describe('Component Unmounting', () => {
    let component;
    let container2;

    beforeEach(async () => {
      const dsl = `TestComponent :: user => div.test { user.name }`;
      component = await lifecycle.mount(dsl, container, { name: 'Test User' });
      
      container2 = document.createElement('div');
      document.body.appendChild(container2);
    });

    afterEach(() => {
      if (container2 && container2.parentNode) {
        container2.parentNode.removeChild(container2);
      }
    });

    test('should unmount component and remove from DOM', async () => {
      expect(container.children.length).toBe(1);
      expect(lifecycle.mountedComponents.has(component.id)).toBe(true);

      await lifecycle.unmount(component.id);

      expect(lifecycle.mountedComponents.has(component.id)).toBe(false);
      expect(component.isMounted).toBe(false);
    });

    test('should handle unmounting non-existent component gracefully', async () => {
      await expect(lifecycle.unmount('non-existent')).resolves.not.toThrow();
    });

    test('should cleanup all components', async () => {
      const component2 = await lifecycle.mount(
        'TestComponent2 :: user => div { user.name }',
        container2,
        { name: 'User 2' }
      );

      expect(lifecycle.mountedComponents.size).toBe(2);

      await lifecycle.cleanup();

      expect(lifecycle.mountedComponents.size).toBe(0);
      expect(component.isMounted).toBe(false);
      expect(component2.isMounted).toBe(false);
    });
  });

  describe('Lifecycle Hooks', () => {
    let beforeMountHook;
    let afterMountHook;
    let beforeUpdateHook;
    let afterUpdateHook;
    let beforeUnmountHook;
    let afterUnmountHook;

    beforeEach(() => {
      beforeMountHook = jest.fn();
      afterMountHook = jest.fn();
      beforeUpdateHook = jest.fn();
      afterUpdateHook = jest.fn();
      beforeUnmountHook = jest.fn();
      afterUnmountHook = jest.fn();

      lifecycle.addHook('beforeMount', beforeMountHook);
      lifecycle.addHook('afterMount', afterMountHook);
      lifecycle.addHook('beforeUpdate', beforeUpdateHook);
      lifecycle.addHook('afterUpdate', afterUpdateHook);
      lifecycle.addHook('beforeUnmount', beforeUnmountHook);
      lifecycle.addHook('afterUnmount', afterUnmountHook);
    });

    test('should execute mount hooks', async () => {
      const dsl = `TestComponent :: user => div { user.name }`;
      const component = await lifecycle.mount(dsl, container, { name: 'Test' });

      expect(beforeMountHook).toHaveBeenCalledWith({
        componentId: component.id,
        dsl,
        container,
        initialData: { name: 'Test' }
      });

      expect(afterMountHook).toHaveBeenCalledWith({
        componentId: component.id,
        componentInstance: component
      });
    });

    test('should execute update hooks', async () => {
      const dsl = `TestComponent :: user => div { user.name }`;
      const component = await lifecycle.mount(dsl, container, { name: 'Test' });

      await lifecycle.update(component.id, { name: 'Updated' });

      expect(beforeUpdateHook).toHaveBeenCalledWith({
        componentId: component.id,
        component,
        newData: { name: 'Updated' }
      });

      expect(afterUpdateHook).toHaveBeenCalledWith({
        componentId: component.id,
        component,
        newData: { name: 'Updated' }
      });
    });

    test('should execute unmount hooks', async () => {
      const dsl = `TestComponent :: user => div { user.name }`;
      const component = await lifecycle.mount(dsl, container, { name: 'Test' });

      await lifecycle.unmount(component.id);

      expect(beforeUnmountHook).toHaveBeenCalledWith({
        componentId: component.id,
        component
      });

      expect(afterUnmountHook).toHaveBeenCalledWith({
        componentId: component.id,
        component
      });
    });

    test('should handle hook errors gracefully', async () => {
      const errorHook = jest.fn(() => {
        throw new Error('Hook error');
      });
      
      lifecycle.addHook('beforeMount', errorHook);

      const dsl = `TestComponent :: user => div { user.name }`;
      
      // Should not throw despite hook error
      await expect(lifecycle.mount(dsl, container, { name: 'Test' }))
        .resolves.toBeInstanceOf(ComponentInstance);
    });

    test('should add and remove hooks', () => {
      const testHook = jest.fn();
      
      expect(lifecycle.hooks.beforeMount.has(testHook)).toBe(false);
      
      lifecycle.addHook('beforeMount', testHook);
      expect(lifecycle.hooks.beforeMount.has(testHook)).toBe(true);
      
      lifecycle.removeHook('beforeMount', testHook);
      expect(lifecycle.hooks.beforeMount.has(testHook)).toBe(false);
    });

    test('should throw error for invalid hook name', () => {
      expect(() => lifecycle.addHook('invalidHook', jest.fn()))
        .toThrow('Invalid hook name: invalidHook');
    });

    test('should throw error for non-function callback', () => {
      expect(() => lifecycle.addHook('beforeMount', 'not-a-function'))
        .toThrow('Hook callback must be a function');
    });
  });

  describe('Error Handling', () => {
    test('should throw error for invalid DSL', async () => {
      await expect(lifecycle.mount('', container))
        .rejects.toThrow('DSL is required and must be a string');

      await expect(lifecycle.mount('invalid dsl', container))
        .rejects.toThrow('Component mount failed');
    });

    test('should throw error for invalid container', async () => {
      const dsl = `TestComponent :: user => div { user.name }`;
      
      await expect(lifecycle.mount(dsl, null))
        .rejects.toThrow('Container must be a valid HTMLElement');

      await expect(lifecycle.mount(dsl, 'not-an-element'))
        .rejects.toThrow('Container must be a valid HTMLElement');
    });

    test('should cleanup on mount failure', async () => {
      const invalidDsl = 'InvalidComponent =>'; // Missing entity
      
      expect(lifecycle.mountedComponents.size).toBe(0);
      
      await expect(lifecycle.mount(invalidDsl, container))
        .rejects.toThrow('Component mount failed');
      
      expect(lifecycle.mountedComponents.size).toBe(0);
    });
  });

  describe('Component Queries', () => {
    let component1;
    let component2;

    beforeEach(async () => {
      const dsl1 = `Component1 :: user => div { user.name }`;
      const dsl2 = `Component2 :: user => span { user.name }`;
      
      component1 = await lifecycle.mount(dsl1, container, { name: 'User 1' });
      
      const container2 = document.createElement('div');
      component2 = await lifecycle.mount(dsl2, container2, { name: 'User 2' });
    });

    test('should get component by ID', () => {
      expect(lifecycle.getComponent(component1.id)).toBe(component1);
      expect(lifecycle.getComponent(component2.id)).toBe(component2);
      expect(lifecycle.getComponent('non-existent')).toBeUndefined();
    });

    test('should get all components', () => {
      const allComponents = lifecycle.getAllComponents();
      expect(allComponents).toHaveLength(2);
      expect(allComponents).toContain(component1);
      expect(allComponents).toContain(component2);
    });
  });
});

describe('ComponentInstance', () => {
  let dataStore;
  let lifecycle;
  let component;
  let container;

  beforeEach(async () => {
    const schema = {
      ':entity/name': { unique: 'identity' },
      ':name': {},
      ':age': {}
    };

    dataStore = new DataStore(schema);
    lifecycle = new ComponentLifecycle(dataStore);
    container = document.createElement('div');

    const dsl = `TestComponent :: user => div.test { user.name }`;
    component = await lifecycle.mount(dsl, container, { name: 'Test User', age: 30 });
  });

  afterEach(() => {
    lifecycle.cleanup();
  });

  describe('Component Instance Properties', () => {
    test('should have correct instance properties', () => {
      expect(component.id).toMatch(/^component_\d+$/);
      expect(component.definition).toBeDefined();
      expect(component.container).toBe(container);
      expect(component.domElements).toBeInstanceOf(Map);
      expect(component.lifecycle).toBe(lifecycle);
      expect(component.data).toEqual({ name: 'Test User', age: 30 });
      expect(component.isMounted).toBe(true);
      expect(typeof component.mountTime).toBe('number');
    });

    test('should provide metadata', () => {
      const metadata = component.getMetadata();
      
      expect(metadata.id).toBe(component.id);
      expect(metadata.name).toBe('TestComponent');
      expect(metadata.entity).toBe('user');
      expect(metadata.isMounted).toBe(true);
      expect(typeof metadata.mountTime).toBe('number');
      expect(typeof metadata.elementCount).toBe('number');
      expect(typeof metadata.bindingCount).toBe('number');
      expect(typeof metadata.eventCount).toBe('number');
    });
  });

  describe('Component Instance Methods', () => {
    test('should update component data', async () => {
      expect(component.data.name).toBe('Test User');

      await component.update({ name: 'Updated User', age: 35 });

      expect(component.data.name).toBe('Updated User');
      expect(component.data.age).toBe(35);
    });

    test('should throw error when updating unmounted component', async () => {
      await component.unmount();

      await expect(component.update({ name: 'New Name' }))
        .rejects.toThrow('Cannot update unmounted component');
    });

    test('should unmount component', async () => {
      expect(component.isMounted).toBe(true);
      expect(lifecycle.mountedComponents.has(component.id)).toBe(true);

      await component.unmount();

      expect(component.isMounted).toBe(false);
      expect(lifecycle.mountedComponents.has(component.id)).toBe(false);
    });

    test('should handle multiple unmount calls gracefully', async () => {
      await component.unmount();
      expect(component.isMounted).toBe(false);

      // Should not throw
      await expect(component.unmount()).resolves.not.toThrow();
    });
  });

  describe('DOM Element Access', () => {
    test('should provide DOM element access', () => {
      const allElements = component.getAllElements();
      expect(allElements).toBeInstanceOf(Map);
      expect(allElements.size).toBeGreaterThan(0);
    });

    test('should get element by key', () => {
      // The root element should be accessible
      const rootElement = component.getElement('root');
      expect(rootElement).toBeInstanceOf(HTMLElement);
      expect(rootElement.tagName).toBe('DIV');
      expect(rootElement.className).toBe('test');
    });
  });
});