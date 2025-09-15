/**
 * Unit tests for HierarchicalComponent class
 * Tests hierarchical component structure and parent-child relationships
 */

import { HierarchicalComponent } from '../../src/core/HierarchicalComponent.js';
import { ComponentInstance } from '../../src/lifecycle/ComponentLifecycle.js';

describe('HierarchicalComponent', () => {
  let mockDefinition;
  let mockContainer;
  let mockDomElements;
  let mockLifecycle;
  let mockData;

  beforeEach(() => {
    mockDefinition = {
      name: 'TestComponent',
      entity: 'test',
      structure: {},
      bindings: [],
      events: []
    };
    
    mockContainer = document.createElement('div');
    mockDomElements = new Map([
      ['root', document.createElement('div')]
    ]);
    
    mockLifecycle = {
      getComponent: jest.fn(),
      mountedComponents: new Map()
    };
    
    mockData = { test: { name: 'Test Data' } };
  });

  describe('constructor', () => {
    it('should extend ComponentInstance', () => {
      const component = new HierarchicalComponent({
        id: 'test1',
        definition: mockDefinition,
        container: mockContainer,
        domElements: mockDomElements,
        lifecycle: mockLifecycle,
        data: mockData
      });

      expect(component).toBeInstanceOf(ComponentInstance);
    });

    it('should initialize with empty children map', () => {
      const component = new HierarchicalComponent({
        id: 'test1',
        definition: mockDefinition,
        container: mockContainer,
        domElements: mockDomElements,
        lifecycle: mockLifecycle,
        data: mockData
      });

      expect(component.children).toBeInstanceOf(Map);
      expect(component.children.size).toBe(0);
    });

    it('should initialize with empty childStateAdapters map', () => {
      const component = new HierarchicalComponent({
        id: 'test1',
        definition: mockDefinition,
        container: mockContainer,
        domElements: mockDomElements,
        lifecycle: mockLifecycle,
        data: mockData
      });

      expect(component.childStateAdapters).toBeInstanceOf(Map);
      expect(component.childStateAdapters.size).toBe(0);
    });

    it('should initialize with null parentStateAdapter', () => {
      const component = new HierarchicalComponent({
        id: 'test1',
        definition: mockDefinition,
        container: mockContainer,
        domElements: mockDomElements,
        lifecycle: mockLifecycle,
        data: mockData
      });

      expect(component.parentStateAdapter).toBeNull();
    });

    it('should initialize with empty eventSubscriptions map', () => {
      const component = new HierarchicalComponent({
        id: 'test1',
        definition: mockDefinition,
        container: mockContainer,
        domElements: mockDomElements,
        lifecycle: mockLifecycle,
        data: mockData
      });

      expect(component.eventSubscriptions).toBeInstanceOf(Map);
      expect(component.eventSubscriptions.size).toBe(0);
    });
  });

  describe('child component tracking', () => {
    let parentComponent;

    beforeEach(() => {
      parentComponent = new HierarchicalComponent({
        id: 'parent1',
        definition: mockDefinition,
        container: mockContainer,
        domElements: mockDomElements,
        lifecycle: mockLifecycle,
        data: mockData
      });
    });

    describe('addChild', () => {
      it('should add child component to children map', () => {
        const childComponent = new HierarchicalComponent({
          id: 'child1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });

        parentComponent.addChild('child1', childComponent);

        expect(parentComponent.children.has('child1')).toBe(true);
        expect(parentComponent.children.get('child1')).toBe(childComponent);
      });

      it('should throw error if child ID already exists', () => {
        const childComponent1 = new HierarchicalComponent({
          id: 'child1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });
        
        const childComponent2 = new HierarchicalComponent({
          id: 'child1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });

        parentComponent.addChild('child1', childComponent1);

        expect(() => {
          parentComponent.addChild('child1', childComponent2);
        }).toThrow('Child component with ID "child1" already exists');
      });

      it('should throw error if child is not a HierarchicalComponent', () => {
        const invalidChild = { id: 'invalid' };

        expect(() => {
          parentComponent.addChild('invalid', invalidChild);
        }).toThrow('Child must be a HierarchicalComponent instance');
      });
    });

    describe('removeChild', () => {
      it('should remove child component from children map', async () => {
        const childComponent = new HierarchicalComponent({
          id: 'child1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });

        parentComponent.addChild('child1', childComponent);
        expect(parentComponent.children.has('child1')).toBe(true);

        await parentComponent.removeChild('child1');
        expect(parentComponent.children.has('child1')).toBe(false);
      });

      it('should return true when child exists and is removed', async () => {
        const childComponent = new HierarchicalComponent({
          id: 'child1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });

        parentComponent.addChild('child1', childComponent);
        const result = await parentComponent.removeChild('child1');

        expect(result).toBe(true);
      });

      it('should return false when child does not exist', async () => {
        const result = await parentComponent.removeChild('nonexistent');
        expect(result).toBe(false);
      });

      it('should cleanup child state adapter when removing child', async () => {
        const childComponent = new HierarchicalComponent({
          id: 'child1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });

        const mockAdapter = { cleanup: jest.fn() };
        parentComponent.addChild('child1', childComponent);
        parentComponent.childStateAdapters.set('child1', mockAdapter);

        await parentComponent.removeChild('child1');

        expect(mockAdapter.cleanup).toHaveBeenCalled();
        expect(parentComponent.childStateAdapters.has('child1')).toBe(false);
      });

      it('should cleanup event subscriptions when removing child', () => {
        const childComponent = new HierarchicalComponent({
          id: 'child1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });

        const mockSubscription = { unsubscribe: jest.fn() };
        const subscriptionSet = new Set([mockSubscription]);
        
        parentComponent.addChild('child1', childComponent);
        parentComponent.eventSubscriptions.set('child1', subscriptionSet);

        parentComponent.removeChild('child1');

        expect(mockSubscription.unsubscribe).toHaveBeenCalled();
        expect(parentComponent.eventSubscriptions.has('child1')).toBe(false);
      });
    });

    describe('getChild', () => {
      it('should return child component by ID', () => {
        const childComponent = new HierarchicalComponent({
          id: 'child1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });

        parentComponent.addChild('child1', childComponent);
        const result = parentComponent.getChild('child1');

        expect(result).toBe(childComponent);
      });

      it('should return undefined for non-existent child', () => {
        const result = parentComponent.getChild('nonexistent');
        expect(result).toBeUndefined();
      });
    });

    describe('hasChild', () => {
      it('should return true if child exists', () => {
        const childComponent = new HierarchicalComponent({
          id: 'child1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });

        parentComponent.addChild('child1', childComponent);
        expect(parentComponent.hasChild('child1')).toBe(true);
      });

      it('should return false if child does not exist', () => {
        expect(parentComponent.hasChild('nonexistent')).toBe(false);
      });
    });

    describe('getAllChildren', () => {
      it('should return array of all child components', () => {
        const child1 = new HierarchicalComponent({
          id: 'child1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });

        const child2 = new HierarchicalComponent({
          id: 'child2',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });

        parentComponent.addChild('child1', child1);
        parentComponent.addChild('child2', child2);

        const children = parentComponent.getAllChildren();

        expect(children).toHaveLength(2);
        expect(children).toContain(child1);
        expect(children).toContain(child2);
      });

      it('should return empty array when no children', () => {
        const children = parentComponent.getAllChildren();
        expect(children).toHaveLength(0);
      });
    });

    describe('getChildCount', () => {
      it('should return number of child components', () => {
        expect(parentComponent.getChildCount()).toBe(0);

        const child1 = new HierarchicalComponent({
          id: 'child1',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });

        parentComponent.addChild('child1', child1);
        expect(parentComponent.getChildCount()).toBe(1);

        const child2 = new HierarchicalComponent({
          id: 'child2',
          definition: mockDefinition,
          container: mockContainer,
          domElements: mockDomElements,
          lifecycle: mockLifecycle,
          data: mockData
        });

        parentComponent.addChild('child2', child2);
        expect(parentComponent.getChildCount()).toBe(2);
      });
    });
  });

  describe('parent-child relationship management', () => {
    let parentComponent;
    let childComponent;

    beforeEach(() => {
      parentComponent = new HierarchicalComponent({
        id: 'parent1',
        definition: mockDefinition,
        container: mockContainer,
        domElements: mockDomElements,
        lifecycle: mockLifecycle,
        data: mockData
      });

      childComponent = new HierarchicalComponent({
        id: 'child1',
        definition: mockDefinition,
        container: mockContainer,
        domElements: mockDomElements,
        lifecycle: mockLifecycle,
        data: mockData
      });
    });

    describe('setParent', () => {
      it('should set parent component reference', () => {
        childComponent.setParent(parentComponent);
        expect(childComponent.parent).toBe(parentComponent);
      });

      it('should throw error if parent is not a HierarchicalComponent', () => {
        const invalidParent = { id: 'invalid' };

        expect(() => {
          childComponent.setParent(invalidParent);
        }).toThrow('Parent must be a HierarchicalComponent instance');
      });

      it('should allow setting parent to null', () => {
        childComponent.setParent(parentComponent);
        expect(childComponent.parent).toBe(parentComponent);

        childComponent.setParent(null);
        expect(childComponent.parent).toBeNull();
      });
    });

    describe('getParent', () => {
      it('should return parent component', () => {
        childComponent.setParent(parentComponent);
        expect(childComponent.getParent()).toBe(parentComponent);
      });

      it('should return null when no parent set', () => {
        expect(childComponent.getParent()).toBeNull();
      });
    });

    describe('hasParent', () => {
      it('should return true when parent is set', () => {
        childComponent.setParent(parentComponent);
        expect(childComponent.hasParent()).toBe(true);
      });

      it('should return false when no parent is set', () => {
        expect(childComponent.hasParent()).toBe(false);
      });
    });

    describe('isRoot', () => {
      it('should return true for components without parent', () => {
        expect(parentComponent.isRoot()).toBe(true);
      });

      it('should return false for components with parent', () => {
        childComponent.setParent(parentComponent);
        expect(childComponent.isRoot()).toBe(false);
      });
    });
  });
});