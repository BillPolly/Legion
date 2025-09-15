/**
 * Integration tests for HierarchicalComponent system
 * Tests real DOM mounting, parent-child relationships, and cleanup
 */

import { HierarchicalComponentLifecycle } from '../../src/lifecycle/HierarchicalComponentLifecycle.js';
import { HierarchicalComponent } from '../../src/core/HierarchicalComponent.js';
import { DataStoreAdapter } from '../../src/adapters/DataStoreAdapter.js';

describe('HierarchicalComponent Integration Tests', () => {
  let mockDataStore;
  let lifecycle;
  let container;

  beforeEach(() => {
    // Create real DataStore mock with reactive engine (no fallbacks - errors will be thrown)
    const subscriptions = new Map();
    
    mockDataStore = {
      simpleData: {},
      getProperty: jest.fn((path) => {
        const keys = path.split('.');
        let value = mockDataStore.simpleData;
        for (const key of keys) {
          if (value && typeof value === 'object' && key in value) {
            value = value[key];
          } else {
            return undefined;
          }
        }
        return value;
      }),
      setProperty: jest.fn((path, value) => {
        const keys = path.split('.');
        let target = mockDataStore.simpleData;
        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i];
          if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
          }
          target = target[key];
        }
        target[keys[keys.length - 1]] = value;
      }),
      on: jest.fn(),
      off: jest.fn(),
      // Reactive engine required by DataStoreAdapter
      _reactiveEngine: {
        addSubscription: jest.fn((subscription) => {
          subscriptions.set(subscription.id, subscription);
        }),
        removeSubscription: jest.fn((subscriptionId) => {
          subscriptions.delete(subscriptionId);
        }),
        getAllSubscriptions: jest.fn(() => Array.from(subscriptions.values()))
      }
    };

    lifecycle = new HierarchicalComponentLifecycle(mockDataStore);

    // Create real DOM container
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(async () => {
    // Real cleanup - unmount all components
    await lifecycle.cleanup();
    
    // Remove from real DOM
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('Simple Parent-Child Mounting', () => {
    it('should mount parent component with single child', async () => {
      // Setup test data
      mockDataStore.simpleData = {
        parent: { title: 'Parent Title' },
        child: { name: 'Child Name' }
      };

      // Mount parent component
      const parentDsl = 'ParentComponent :: parent => div.parent-container { parent.title }';
      const parentComponent = await lifecycle.mountHierarchical(parentDsl, container, mockDataStore.simpleData);

      expect(parentComponent).toBeInstanceOf(HierarchicalComponent);
      expect(parentComponent.isMounted).toBe(true);
      expect(container.querySelector('.parent-container')).not.toBeNull();

      // Mount child component in parent container
      const childContainer = document.createElement('div');
      childContainer.className = 'child-mount-point';
      parentComponent.container.appendChild(childContainer);

      const childDsl = 'ChildComponent :: child => span.child-element { child.name }';
      const childComponent = await lifecycle.mountHierarchical(childDsl, childContainer, mockDataStore.simpleData);

      // Establish parent-child relationship
      parentComponent.addChild('child1', childComponent);
      childComponent.setParent(parentComponent);

      // Verify DOM structure
      expect(childComponent).toBeInstanceOf(HierarchicalComponent);
      expect(childComponent.isMounted).toBe(true);
      expect(childComponent.parent).toBe(parentComponent);
      expect(parentComponent.getChild('child1')).toBe(childComponent);
      
      // Verify real DOM rendering
      const childElement = container.querySelector('.child-element');
      expect(childElement).not.toBeNull();
      expect(childElement.textContent).toBe('Child Name');
      
      // Verify parent DOM still exists
      const parentElement = container.querySelector('.parent-container');
      expect(parentElement).not.toBeNull();
      expect(parentElement.textContent).toBe('Parent Title');
    });

    it('should handle parent-child state isolation', async () => {
      // Setup isolated state data
      mockDataStore.simpleData = {
        parentData: { value: 'parent-value' },
        childData: { value: 'child-value' }
      };

      // Mount parent
      const parentDsl = 'ParentComp :: parentData => div { parentData.value }';
      const parent = await lifecycle.mountHierarchical(parentDsl, container, mockDataStore.simpleData);

      // Create child container
      const childContainer = document.createElement('div');
      parent.container.appendChild(childContainer);

      // Mount child with different state scope
      const childDsl = 'ChildComp :: childData => span { childData.value }';
      const child = await lifecycle.mountHierarchical(childDsl, childContainer, mockDataStore.simpleData);

      parent.addChild('isolated-child', child);
      child.setParent(parent);

      // Verify both components have access to their respective data
      expect(container.querySelector('div').textContent).toBe('parent-value');
      expect(container.querySelector('span').textContent).toBe('child-value');

      // Verify components are properly isolated but connected
      expect(child.parent).toBe(parent);
      expect(parent.children.size).toBe(1);
    });
  });

  describe('Multiple Child Components', () => {
    it('should mount parent with multiple children', async () => {
      // Setup data for multiple children
      mockDataStore.simpleData = {
        parent: { title: 'Multi-Child Parent' },
        child1: { text: 'First Child' },
        child2: { text: 'Second Child' },
        child3: { text: 'Third Child' }
      };

      // Mount parent
      const parentDsl = 'MultiParent :: parent => div.multi-parent { parent.title }';
      const parent = await lifecycle.mountHierarchical(parentDsl, container, mockDataStore.simpleData);

      // Mount multiple children
      const children = [];
      for (let i = 1; i <= 3; i++) {
        const childContainer = document.createElement('div');
        childContainer.className = `child-${i}-container`;
        parent.container.appendChild(childContainer);

        const childDsl = `Child${i} :: child${i} => p.child-${i} { child${i}.text }`;
        const child = await lifecycle.mountHierarchical(childDsl, childContainer, mockDataStore.simpleData);
        
        parent.addChild(`child${i}`, child);
        child.setParent(parent);
        children.push(child);
      }

      // Verify all children are mounted and connected
      expect(parent.children.size).toBe(3);
      expect(children).toHaveLength(3);
      
      children.forEach((child, index) => {
        expect(child.isMounted).toBe(true);
        expect(child.parent).toBe(parent);
        expect(parent.getChild(`child${index + 1}`)).toBe(child);
      });

      // Verify real DOM structure
      expect(container.querySelector('.multi-parent')).not.toBeNull();
      expect(container.querySelector('.child-1')).not.toBeNull();
      expect(container.querySelector('.child-2')).not.toBeNull();
      expect(container.querySelector('.child-3')).not.toBeNull();

      // Verify content rendering
      expect(container.querySelector('.child-1').textContent).toBe('First Child');
      expect(container.querySelector('.child-2').textContent).toBe('Second Child');
      expect(container.querySelector('.child-3').textContent).toBe('Third Child');
    });

    it('should handle adding and removing children dynamically', async () => {
      // Setup base data
      mockDataStore.simpleData = {
        container: { title: 'Dynamic Container' },
        newChild: { content: 'Dynamic Child' }
      };

      // Mount container component
      const containerDsl = 'Container :: container => div.container { container.title }';
      const containerComp = await lifecycle.mountHierarchical(containerDsl, container, mockDataStore.simpleData);

      expect(containerComp.children.size).toBe(0);

      // Add child dynamically
      const childContainer = document.createElement('div');
      containerComp.container.appendChild(childContainer);

      const childDsl = 'DynamicChild :: newChild => span.dynamic { newChild.content }';
      const dynamicChild = await lifecycle.mountHierarchical(childDsl, childContainer, mockDataStore.simpleData);

      containerComp.addChild('dynamic1', dynamicChild);
      dynamicChild.setParent(containerComp);

      expect(containerComp.children.size).toBe(1);
      expect(container.querySelector('.dynamic')).not.toBeNull();
      expect(container.querySelector('.dynamic').textContent).toBe('Dynamic Child');

      // Remove child dynamically
      await containerComp.removeChild('dynamic1');
      
      expect(containerComp.children.size).toBe(0);
      expect(dynamicChild.isMounted).toBe(false);
      
      // Child should be removed from DOM (component is unmounted)
      expect(container.querySelector('.dynamic')).toBeNull();
    });
  });

  describe('Nested Hierarchy (Parent->Child->Grandchild)', () => {
    it('should create and manage 3-level hierarchy', async () => {
      // Setup data for 3-level hierarchy
      mockDataStore.simpleData = {
        root: { title: 'Root Component' },
        middle: { label: 'Middle Level' },
        leaf: { value: 'Leaf Node' }
      };

      // Mount root component - Use a structure that separates content from child containers
      const rootDsl = 'RootComp :: root => div.root { root.title }';
      const rootComponent = await lifecycle.mountHierarchical(rootDsl, container, mockDataStore.simpleData);

      // Create a separate child container that doesn't interfere with root's text content
      const middleContainer = document.createElement('div');
      middleContainer.className = 'child-container';
      // Append to the original container, not the root element to avoid text content mixing
      container.appendChild(middleContainer);

      const middleDsl = 'MiddleComp :: middle => section.middle { middle.label }';
      const middleComponent = await lifecycle.mountHierarchical(middleDsl, middleContainer, mockDataStore.simpleData);

      rootComponent.addChild('middle', middleComponent);
      middleComponent.setParent(rootComponent);

      // Create a separate child container for leaf component
      const leafContainer = document.createElement('div');
      leafContainer.className = 'child-container';
      // Append to the middle container, not the middle element itself
      middleContainer.appendChild(leafContainer);

      const leafDsl = 'LeafComp :: leaf => span.leaf { leaf.value }';
      const leafComponent = await lifecycle.mountHierarchical(leafDsl, leafContainer, mockDataStore.simpleData);

      middleComponent.addChild('leaf', leafComponent);
      leafComponent.setParent(middleComponent);

      // Verify 3-level hierarchy structure
      expect(rootComponent.children.size).toBe(1);
      expect(middleComponent.parent).toBe(rootComponent);
      expect(middleComponent.children.size).toBe(1);
      expect(leafComponent.parent).toBe(middleComponent);
      expect(leafComponent.children.size).toBe(0);

      // Verify all components are mounted
      expect(rootComponent.isMounted).toBe(true);
      expect(middleComponent.isMounted).toBe(true);
      expect(leafComponent.isMounted).toBe(true);

      // Verify DOM structure and content
      const rootEl = container.querySelector('.root');
      const middleEl = container.querySelector('.middle');
      const leafEl = container.querySelector('.leaf');

      expect(rootEl).not.toBeNull();
      expect(middleEl).not.toBeNull();
      expect(leafEl).not.toBeNull();

      expect(rootEl.textContent).toBe('Root Component');
      expect(middleEl.textContent).toBe('Middle Level');
      expect(leafEl.textContent).toBe('Leaf Node');

      // Verify DOM structure - components are siblings in containers but logically nested
      // All elements should be in the main container
      expect(container.contains(rootEl)).toBe(true);
      expect(container.contains(middleEl)).toBe(true);
      expect(container.contains(leafEl)).toBe(true);
      
      // The parent-child relationship is managed logically, not through DOM nesting
      // to avoid text content interference
    });

    it('should handle complex nested component interactions', async () => {
      // Setup complex data structure
      mockDataStore.simpleData = {
        app: { name: 'Test App', version: '1.0' },
        header: { title: 'App Header' },
        nav: { items: ['Home', 'About', 'Contact'] },
        content: { body: 'Main content area' }
      };

      // Mount app (root)
      const appDsl = 'App :: app => div.app { app.name + " v" + app.version }';
      const app = await lifecycle.mountHierarchical(appDsl, container, mockDataStore.simpleData);

      // Mount header as child
      const headerContainer = document.createElement('header');
      app.container.appendChild(headerContainer);

      const headerDsl = 'Header :: header => h1.header { header.title }';
      const header = await lifecycle.mountHierarchical(headerDsl, headerContainer, mockDataStore.simpleData);

      app.addChild('header', header);
      header.setParent(app);

      // Mount nav as grandchild (child of header)
      const navContainer = document.createElement('nav');
      header.container.appendChild(navContainer);

      const navDsl = 'Navigation :: nav => ul.nav { "Navigation" }';
      const nav = await lifecycle.mountHierarchical(navDsl, navContainer, mockDataStore.simpleData);

      header.addChild('nav', nav);
      nav.setParent(header);

      // Mount content as child of app
      const contentContainer = document.createElement('main');
      app.container.appendChild(contentContainer);

      const contentDsl = 'Content :: content => div.content { content.body }';
      const content = await lifecycle.mountHierarchical(contentDsl, contentContainer, mockDataStore.simpleData);

      app.addChild('content', content);
      content.setParent(app);

      // Verify complex hierarchy
      expect(app.children.size).toBe(2); // header, content
      expect(header.children.size).toBe(1); // nav
      expect(nav.children.size).toBe(0);
      expect(content.children.size).toBe(0);

      // Verify parent-child relationships
      expect(header.parent).toBe(app);
      expect(content.parent).toBe(app);
      expect(nav.parent).toBe(header);

      // Verify all are mounted
      [app, header, nav, content].forEach(component => {
        expect(component.isMounted).toBe(true);
      });

      // Verify DOM structure
      expect(container.querySelector('.app')).not.toBeNull();
      expect(container.querySelector('.header')).not.toBeNull();
      expect(container.querySelector('.nav')).not.toBeNull();
      expect(container.querySelector('.content')).not.toBeNull();
    });
  });

  describe('Component Cleanup and Unmounting', () => {
    it('should cleanup single component properly', async () => {
      // Setup data
      mockDataStore.simpleData = {
        test: { message: 'Cleanup Test' }
      };

      // Mount component
      const dsl = 'CleanupTest :: test => div.cleanup { test.message }';
      const component = await lifecycle.mountHierarchical(dsl, container, mockDataStore.simpleData);

      expect(component.isMounted).toBe(true);
      expect(container.querySelector('.cleanup')).not.toBeNull();
      expect(lifecycle.hierarchicalComponents.size).toBe(1);

      // Unmount component
      await lifecycle.unmountHierarchical(component.id);

      // Verify cleanup
      expect(component.isMounted).toBe(false);
      expect(lifecycle.hierarchicalComponents.size).toBe(0);
    });

    it('should recursively cleanup parent with children', async () => {
      // Setup data
      mockDataStore.simpleData = {
        parent: { name: 'Parent' },
        child1: { value: 'Child 1' },
        child2: { value: 'Child 2' }
      };

      // Mount parent
      const parentDsl = 'ParentToCleanup :: parent => div.parent-cleanup { parent.name }';
      const parent = await lifecycle.mountHierarchical(parentDsl, container, mockDataStore.simpleData);

      // Mount children
      const child1Container = document.createElement('div');
      const child2Container = document.createElement('div');
      parent.container.appendChild(child1Container);
      parent.container.appendChild(child2Container);

      const child1Dsl = 'Child1Cleanup :: child1 => span.child1-cleanup { child1.value }';
      const child2Dsl = 'Child2Cleanup :: child2 => span.child2-cleanup { child2.value }';

      const child1 = await lifecycle.mountHierarchical(child1Dsl, child1Container, mockDataStore.simpleData);
      const child2 = await lifecycle.mountHierarchical(child2Dsl, child2Container, mockDataStore.simpleData);

      parent.addChild('child1', child1);
      parent.addChild('child2', child2);
      child1.setParent(parent);
      child2.setParent(parent);

      // Verify initial state
      expect(lifecycle.hierarchicalComponents.size).toBe(3);
      expect(parent.isMounted).toBe(true);
      expect(child1.isMounted).toBe(true);
      expect(child2.isMounted).toBe(true);

      // Cleanup parent (should cleanup children too)
      await lifecycle.unmountHierarchical(parent.id);

      // Verify all components cleaned up
      expect(lifecycle.hierarchicalComponents.size).toBe(0);
      expect(parent.isMounted).toBe(false);
      expect(child1.isMounted).toBe(false);
      expect(child2.isMounted).toBe(false);
    });

    it('should cleanup complex nested hierarchy', async () => {
      // Setup complex nested data
      mockDataStore.simpleData = {
        root: { id: 'root' },
        branch1: { id: 'branch1' },
        branch2: { id: 'branch2' },
        leaf1: { id: 'leaf1' },
        leaf2: { id: 'leaf2' },
        leaf3: { id: 'leaf3' }
      };

      // Build complex hierarchy: root -> branch1 -> leaf1, leaf2
      //                                -> branch2 -> leaf3
      const rootDsl = 'ComplexRoot :: root => div.complex-root { root.id }';
      const root = await lifecycle.mountHierarchical(rootDsl, container, mockDataStore.simpleData);

      // Branch 1
      const branch1Container = document.createElement('div');
      root.container.appendChild(branch1Container);

      const branch1Dsl = 'Branch1 :: branch1 => div.branch1 { branch1.id }';
      const branch1 = await lifecycle.mountHierarchical(branch1Dsl, branch1Container, mockDataStore.simpleData);
      root.addChild('branch1', branch1);
      branch1.setParent(root);

      // Branch 2
      const branch2Container = document.createElement('div');
      root.container.appendChild(branch2Container);

      const branch2Dsl = 'Branch2 :: branch2 => div.branch2 { branch2.id }';
      const branch2 = await lifecycle.mountHierarchical(branch2Dsl, branch2Container, mockDataStore.simpleData);
      root.addChild('branch2', branch2);
      branch2.setParent(root);

      // Leaves under branch1
      const leaf1Container = document.createElement('div');
      const leaf2Container = document.createElement('div');
      branch1.container.appendChild(leaf1Container);
      branch1.container.appendChild(leaf2Container);

      const leaf1Dsl = 'Leaf1 :: leaf1 => span.leaf1 { leaf1.id }';
      const leaf2Dsl = 'Leaf2 :: leaf2 => span.leaf2 { leaf2.id }';

      const leaf1 = await lifecycle.mountHierarchical(leaf1Dsl, leaf1Container, mockDataStore.simpleData);
      const leaf2 = await lifecycle.mountHierarchical(leaf2Dsl, leaf2Container, mockDataStore.simpleData);

      branch1.addChild('leaf1', leaf1);
      branch1.addChild('leaf2', leaf2);
      leaf1.setParent(branch1);
      leaf2.setParent(branch1);

      // Leaf under branch2
      const leaf3Container = document.createElement('div');
      branch2.container.appendChild(leaf3Container);

      const leaf3Dsl = 'Leaf3 :: leaf3 => span.leaf3 { leaf3.id }';
      const leaf3 = await lifecycle.mountHierarchical(leaf3Dsl, leaf3Container, mockDataStore.simpleData);

      branch2.addChild('leaf3', leaf3);
      leaf3.setParent(branch2);

      // Verify complex hierarchy is built
      expect(lifecycle.hierarchicalComponents.size).toBe(6); // root + 2 branches + 3 leaves
      
      const allComponents = [root, branch1, branch2, leaf1, leaf2, leaf3];
      allComponents.forEach(comp => {
        expect(comp.isMounted).toBe(true);
      });

      // Cleanup entire hierarchy from root
      await lifecycle.unmountHierarchical(root.id);

      // Verify complete cleanup
      expect(lifecycle.hierarchicalComponents.size).toBe(0);
      allComponents.forEach(comp => {
        expect(comp.isMounted).toBe(false);
      });
    });

    it('should handle cleanup on mount failures', async () => {
      // Setup valid data
      mockDataStore.simpleData = {
        valid: { data: 'valid' }
      };

      // Mount valid parent first
      const parentDsl = 'ValidParent :: valid => div.valid-parent { valid.data }';
      const parent = await lifecycle.mountHierarchical(parentDsl, container, mockDataStore.simpleData);

      expect(lifecycle.hierarchicalComponents.size).toBe(1);
      expect(parent.isMounted).toBe(true);

      // Attempt to mount invalid child (should fail)
      const childContainer = document.createElement('div');
      parent.container.appendChild(childContainer);

      const invalidChildDsl = 'invalid dsl syntax with no proper structure';
      
      await expect(lifecycle.mountHierarchical(invalidChildDsl, childContainer, mockDataStore.simpleData))
        .rejects.toThrow();

      // Parent should still be valid and tracked
      expect(lifecycle.hierarchicalComponents.size).toBe(1);
      expect(parent.isMounted).toBe(true);
      expect(lifecycle.getHierarchicalComponent(parent.id)).toBe(parent);
    });
  });
});