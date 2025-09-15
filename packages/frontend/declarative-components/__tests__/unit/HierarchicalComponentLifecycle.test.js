/**
 * Unit tests for HierarchicalComponentLifecycle class
 * Tests hierarchical component lifecycle management
 */

import { HierarchicalComponentLifecycle } from '../../src/lifecycle/HierarchicalComponentLifecycle.js';
import { ComponentLifecycle } from '../../src/lifecycle/ComponentLifecycle.js';
import { HierarchicalComponent } from '../../src/core/HierarchicalComponent.js';

describe('HierarchicalComponentLifecycle', () => {
  let mockDataStore;
  let lifecycle;

  beforeEach(() => {
    mockDataStore = {
      simpleData: {},
      getProperty: jest.fn(),
      setProperty: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    };
    
    lifecycle = new HierarchicalComponentLifecycle(mockDataStore);
  });

  describe('constructor', () => {
    it('should extend ComponentLifecycle', () => {
      expect(lifecycle).toBeInstanceOf(ComponentLifecycle);
    });

    it('should initialize with hierarchical component registry', () => {
      expect(lifecycle.hierarchicalComponents).toBeInstanceOf(Map);
      expect(lifecycle.hierarchicalComponents.size).toBe(0);
    });

    it('should initialize hierarchical component counter', () => {
      expect(lifecycle.hierarchicalComponentCounter).toBe(0);
    });
  });

  describe('mountHierarchical', () => {
    let container;
    
    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should require DSL parameter', async () => {
      await expect(lifecycle.mountHierarchical(null, container, {}))
        .rejects.toThrow('DSL is required and must be a string');
    });

    it('should require container parameter', async () => {
      await expect(lifecycle.mountHierarchical('component Test {}', null, {}))
        .rejects.toThrow('Container must be a valid HTMLElement');
    });

    it('should mount simple hierarchical component', async () => {
      const dsl = 'TestComponent :: test => div.test-component { "Hello" }';

      const component = await lifecycle.mountHierarchical(dsl, container, { test: { name: 'Test' } });

      expect(component).toBeInstanceOf(HierarchicalComponent);
      expect(component.id).toMatch(/^hierarchical_component_/);
      expect(component.isMounted).toBe(true);
    });

    it('should assign unique IDs to hierarchical components', async () => {
      const dsl = 'TestComponent :: test => div { }';

      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      document.body.appendChild(container1);
      document.body.appendChild(container2);

      const component1 = await lifecycle.mountHierarchical(dsl, container1, {});
      const component2 = await lifecycle.mountHierarchical(dsl, container2, {});

      expect(component1.id).not.toBe(component2.id);
      expect(component1.id).toMatch(/^hierarchical_component_1$/);
      expect(component2.id).toMatch(/^hierarchical_component_2$/);

      document.body.removeChild(container1);
      document.body.removeChild(container2);
    });

    it('should track mounted hierarchical components', async () => {
      const dsl = 'TestComponent :: test => div { }';

      const component = await lifecycle.mountHierarchical(dsl, container, {});

      expect(lifecycle.hierarchicalComponents.has(component.id)).toBe(true);
      expect(lifecycle.hierarchicalComponents.get(component.id)).toBe(component);
    });

    it('should accept parentAdapter parameter', async () => {
      const dsl = 'ChildComponent :: child => div { }';

      const mockParentAdapter = {
        getProperty: jest.fn(),
        setProperty: jest.fn()
      };

      const component = await lifecycle.mountHierarchical(dsl, container, {}, mockParentAdapter);

      expect(component.parentStateAdapter).toBe(mockParentAdapter);
    });

    it('should handle mount failures gracefully', async () => {
      const invalidDsl = 'invalid dsl syntax';

      await expect(lifecycle.mountHierarchical(invalidDsl, container, {}))
        .rejects.toThrow();

      // Should not have leftover components in registry
      expect(lifecycle.hierarchicalComponents.size).toBe(0);
    });
  });

  describe('unmountHierarchical', () => {
    let container;
    let component;

    beforeEach(async () => {
      container = document.createElement('div');
      document.body.appendChild(container);

      const dsl = 'TestComponent :: test => div { }';

      component = await lifecycle.mountHierarchical(dsl, container, {});
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should unmount hierarchical component', async () => {
      const componentId = component.id;
      
      await lifecycle.unmountHierarchical(componentId);

      expect(component.isMounted).toBe(false);
      expect(lifecycle.hierarchicalComponents.has(componentId)).toBe(false);
    });

    it('should return silently for non-existent component', async () => {
      await expect(lifecycle.unmountHierarchical('nonexistent'))
        .resolves.toBeUndefined();
    });

    it('should cleanup child components recursively', async () => {
      // Create a parent-child hierarchy
      const childDsl = 'ChildComponent :: child => span { }';

      const childContainer = document.createElement('div');
      component.container.appendChild(childContainer);
      
      const childComponent = await lifecycle.mountHierarchical(childDsl, childContainer, {});
      component.addChild('child1', childComponent);

      expect(lifecycle.hierarchicalComponents.size).toBe(2);

      // Unmount parent should cleanup child too
      await lifecycle.unmountHierarchical(component.id);

      expect(lifecycle.hierarchicalComponents.size).toBe(0);
      expect(component.isMounted).toBe(false);
      expect(childComponent.isMounted).toBe(false);
    });
  });

  describe('getHierarchicalComponent', () => {
    it('should return hierarchical component by ID', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const dsl = 'TestComponent :: test => div { }';

      const component = await lifecycle.mountHierarchical(dsl, container, {});
      const retrieved = lifecycle.getHierarchicalComponent(component.id);

      expect(retrieved).toBe(component);

      document.body.removeChild(container);
    });

    it('should return undefined for non-existent component', () => {
      const retrieved = lifecycle.getHierarchicalComponent('nonexistent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllHierarchicalComponents', () => {
    it('should return array of all hierarchical components', async () => {
      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      document.body.appendChild(container1);
      document.body.appendChild(container2);

      const dsl = 'TestComponent :: test => div { }';

      const component1 = await lifecycle.mountHierarchical(dsl, container1, {});
      const component2 = await lifecycle.mountHierarchical(dsl, container2, {});

      const allComponents = lifecycle.getAllHierarchicalComponents();

      expect(allComponents).toHaveLength(2);
      expect(allComponents).toContain(component1);
      expect(allComponents).toContain(component2);

      document.body.removeChild(container1);
      document.body.removeChild(container2);
    });

    it('should return empty array when no components mounted', () => {
      const allComponents = lifecycle.getAllHierarchicalComponents();
      expect(allComponents).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('should unmount all hierarchical components', async () => {
      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      document.body.appendChild(container1);
      document.body.appendChild(container2);

      const dsl = 'TestComponent :: test => div { }';

      const component1 = await lifecycle.mountHierarchical(dsl, container1, {});
      const component2 = await lifecycle.mountHierarchical(dsl, container2, {});

      expect(lifecycle.hierarchicalComponents.size).toBe(2);

      await lifecycle.cleanup();

      expect(lifecycle.hierarchicalComponents.size).toBe(0);
      expect(component1.isMounted).toBe(false);
      expect(component2.isMounted).toBe(false);

      document.body.removeChild(container1);
      document.body.removeChild(container2);
    });

    it('should call parent cleanup', async () => {
      const parentCleanupSpy = jest.spyOn(ComponentLifecycle.prototype, 'cleanup');
      
      await lifecycle.cleanup();
      
      expect(parentCleanupSpy).toHaveBeenCalled();
      
      parentCleanupSpy.mockRestore();
    });
  });

  describe('child lifecycle management', () => {
    let parentComponent;
    let container;

    beforeEach(async () => {
      container = document.createElement('div');
      document.body.appendChild(container);

      const parentDsl = 'ParentComponent :: parent => div { }';

      parentComponent = await lifecycle.mountHierarchical(parentDsl, container, {});
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should mount child component with parent reference', async () => {
      const childDsl = 'ChildComponent :: child => span { }';

      const childContainer = document.createElement('div');
      parentComponent.container.appendChild(childContainer);

      const mockParentAdapter = { getProperty: jest.fn() };
      const childComponent = await lifecycle.mountHierarchical(childDsl, childContainer, {}, mockParentAdapter);

      expect(childComponent.parentStateAdapter).toBe(mockParentAdapter);
    });

    it('should handle child component failures without affecting parent', async () => {
      const invalidChildDsl = 'invalid child dsl';
      const childContainer = document.createElement('div');
      parentComponent.container.appendChild(childContainer);

      await expect(lifecycle.mountHierarchical(invalidChildDsl, childContainer, {}))
        .rejects.toThrow();

      // Parent should still be mounted and tracked
      expect(parentComponent.isMounted).toBe(true);
      expect(lifecycle.hierarchicalComponents.has(parentComponent.id)).toBe(true);
    });
  });
});