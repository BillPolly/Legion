/**
 * TreeScribeViewModel Tests
 * 
 * Testing TreeScribeViewModel class - command pattern, event coordination, and model-view binding
 */

import { TreeScribeViewModel } from '../../../../../../src/components/tree-scribe/core/viewmodel/TreeScribeViewModel.js';
import { TreeScribeModel } from '../../../../../../src/components/tree-scribe/core/model/TreeScribeModel.js';
import { TreeScribeView } from '../../../../../../src/components/tree-scribe/core/view/TreeScribeView.js';

describe('TreeScribeViewModel', () => {
  let container;
  let model;
  let view;
  let viewModel;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    model = new TreeScribeModel();
    view = new TreeScribeView(container);
  });

  afterEach(() => {
    if (viewModel && viewModel.destroy) {
      viewModel.destroy();
    }
    if (view && view.destroy) {
      view.destroy();
    }
    if (model && model.destroy) {
      model.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Command Pattern', () => {
    beforeEach(() => {
      viewModel = new TreeScribeViewModel(model, view);
    });

    test('should implement command pattern for operations', () => {
      expect(viewModel.executeCommand).toBeInstanceOf(Function);
      expect(viewModel.canExecuteCommand).toBeInstanceOf(Function);
      expect(viewModel.getAvailableCommands).toBeInstanceOf(Function);
    });

    test('should execute loadYaml command', () => {
      const yamlContent = `
title: Test Document
sections:
  - title: Section 1
    description: Content 1
`;

      const success = viewModel.executeCommand('loadYaml', { yamlContent });
      
      expect(success).toBe(true);
      expect(model.rootNode).toBeDefined();
      expect(model.rootNode.title).toBe('Test Document');
    });

    test('should execute expandAll command', () => {
      // Load test data first
      const yamlContent = `
title: Root
sections:
  - title: Child 1
    subsections:
      - title: Grandchild 1
`;
      viewModel.executeCommand('loadYaml', { yamlContent });

      const success = viewModel.executeCommand('expandAll');
      
      expect(success).toBe(true);
      // All nodes should be expanded
      const allNodes = model.getAllNodes();
      allNodes.forEach(node => {
        if (!node.isLeaf()) {
          expect(node.state.expanded).toBe(true);
        }
      });
    });

    test('should execute collapseAll command', () => {
      // Load and expand test data first
      const yamlContent = `
title: Root
sections:
  - title: Child 1
    subsections:
      - title: Grandchild 1
`;
      viewModel.executeCommand('loadYaml', { yamlContent });
      viewModel.executeCommand('expandAll');

      const success = viewModel.executeCommand('collapseAll');
      
      expect(success).toBe(true);
      // All non-root nodes should be collapsed
      const allNodes = model.getAllNodes();
      allNodes.forEach(node => {
        if (!node.isRoot() && !node.isLeaf()) {
          expect(node.state.expanded).toBe(false);
        }
      });
    });

    test('should execute toggleNode command', () => {
      // Load test data with non-leaf node
      const yamlContent = `
title: Root
sections:
  - title: Child 1
    id: test-child
    subsections:
      - title: Grandchild
        description: Test content
`;
      viewModel.executeCommand('loadYaml', { yamlContent });
      
      const childNode = model.getNode('test-child');
      expect(childNode).toBeDefined();
      expect(childNode.isLeaf()).toBe(false); // Ensure it's not a leaf
      
      const initialState = childNode.state.expanded;
      const success = viewModel.executeCommand('toggleNode', { nodeId: 'test-child' });
      
      expect(success).toBe(true);
      expect(childNode.state.expanded).toBe(!initialState);
    });

    test('should check command availability with canExecuteCommand', () => {
      // Initially no document loaded
      expect(viewModel.canExecuteCommand('expandAll')).toBe(false);
      expect(viewModel.canExecuteCommand('collapseAll')).toBe(false);
      
      // Load document
      const yamlContent = 'title: Test';
      viewModel.executeCommand('loadYaml', { yamlContent });
      
      expect(viewModel.canExecuteCommand('expandAll')).toBe(true);
      expect(viewModel.canExecuteCommand('collapseAll')).toBe(true);
    });

    test('should return available commands list', () => {
      const commands = viewModel.getAvailableCommands();
      
      expect(Array.isArray(commands)).toBe(true);
      expect(commands).toContain('loadYaml');
      expect(commands).toContain('expandAll');
      expect(commands).toContain('collapseAll');
      expect(commands).toContain('toggleNode');
      expect(commands).toContain('search');
      expect(commands).toContain('export');
    });

    test('should handle invalid commands gracefully', () => {
      const success = viewModel.executeCommand('invalidCommand', {});
      expect(success).toBe(false);
      
      const canExecute = viewModel.canExecuteCommand('invalidCommand');
      expect(canExecute).toBe(false);
    });
  });

  describe('Event Coordination', () => {
    beforeEach(() => {
      viewModel = new TreeScribeViewModel(model, view);
    });

    test('should coordinate model change events to view updates', () => {
      // Mock view.renderTree to track calls
      let renderCalled = false;
      let renderData = null;
      const originalRender = view.renderTree;
      view.renderTree = (data) => {
        renderCalled = true;
        renderData = data;
        originalRender.call(view, data);
      };

      const yamlContent = `
title: Test Document
sections:
  - title: Section 1
`;
      
      viewModel.executeCommand('loadYaml', { yamlContent });
      
      expect(renderCalled).toBe(true);
      expect(renderData).toBeDefined();
    });

    test('should handle view events and update model', () => {
      // Load test data with non-leaf node
      const yamlContent = `
title: Root
sections:
  - title: Child 1
    id: test-node
    subsections:
      - title: Grandchild
`;
      viewModel.executeCommand('loadYaml', { yamlContent });
      
      const testNode = model.getNode('test-node');
      const initialExpanded = testNode.state.expanded;
      
      // Simulate view event (node toggle)
      viewModel.handleViewEvent('nodeToggle', { nodeId: 'test-node' });
      
      expect(testNode.state.expanded).toBe(!initialExpanded);
    });

    test('should emit events to external listeners', () => {
      let eventFired = false;
      let eventData = null;
      
      viewModel.on('documentLoaded', (data) => {
        eventFired = true;  
        eventData = data;
      });
      
      const yamlContent = 'title: Test Document';
      viewModel.executeCommand('loadYaml', { yamlContent });
      
      expect(eventFired).toBe(true);
      expect(eventData.title).toBe('Test Document');
    });

    test('should support multiple event listeners', () => {
      let listener1Called = false;
      let listener2Called = false;
      
      viewModel.on('nodeToggled', () => { listener1Called = true; });
      viewModel.on('nodeToggled', () => { listener2Called = true; });
      
      // Load and toggle node
      const yamlContent = 'title: Root\nsections:\n  - title: Child\n    id: test\n    subsections:\n      - title: Grandchild';
      viewModel.executeCommand('loadYaml', { yamlContent });
      viewModel.executeCommand('toggleNode', { nodeId: 'test' });
      
      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
    });

    test('should support event listener removal', () => {
      let listenerCalled = false;
      
      const removeListener = viewModel.on('documentLoaded', () => {
        listenerCalled = true;
      });
      
      removeListener(); // Remove listener
      
      viewModel.executeCommand('loadYaml', { yamlContent: 'title: Test' });
      
      expect(listenerCalled).toBe(false);
    });
  });

  describe('Model-View Binding', () => {
    beforeEach(() => {
      viewModel = new TreeScribeViewModel(model, view);
    });

    test('should bind model changes to view updates', () => {
      // Track view render calls
      let renderCount = 0;
      const originalRender = view.renderTree;
      view.renderTree = (...args) => {
        renderCount++;
        originalRender.apply(view, args);
      };

      // Initial state - no renders yet
      expect(renderCount).toBe(0);
      
      // Load document - should trigger render
      viewModel.executeCommand('loadYaml', { yamlContent: 'title: Test\nsections:\n  - title: Child' });
      expect(renderCount).toBe(1);
      
      // Toggle root node - should trigger render
      const rootNode = model.rootNode;
      if (rootNode && !rootNode.isLeaf()) {
        viewModel.executeCommand('toggleNode', { nodeId: rootNode.id });
        expect(renderCount).toBe(2);
      }
    });

    test('should maintain state synchronization between model and view', () => {
      const yamlContent = `
title: Root
sections:
  - title: Child 1
    id: child1
    subsections:
      - title: Grandchild 1
  - title: Child 2  
    id: child2
    description: Leaf node
`;
      
      viewModel.executeCommand('loadYaml', { yamlContent });
      
      // Get nodes from model
      const child1 = model.getNode('child1');
      const child2 = model.getNode('child2');
      
      expect(child1).toBeDefined();
      expect(child2).toBeDefined();
      expect(child1.isLeaf()).toBe(false); // Has children
      expect(child2.isLeaf()).toBe(true);  // Is leaf
      
      // Toggle first child (non-leaf)
      viewModel.executeCommand('toggleNode', { nodeId: 'child1' });
      
      // Check that model state changed
      expect(child1.state.expanded).toBe(true);
      expect(child2.state.expanded).toBe(false); // Should remain unchanged
    });

    test('should handle view destruction gracefully', () => {
      viewModel.executeCommand('loadYaml', { yamlContent: 'title: Test' });
      
      // Destroy view
      view.destroy();
      
      // ViewModel operations should still work (graceful degradation)
      expect(() => {
        viewModel.executeCommand('expandAll');
      }).not.toThrow();
    });

    test('should handle model destruction gracefully', () => {
      viewModel.executeCommand('loadYaml', { yamlContent: 'title: Test' });
      
      // Destroy model
      model.destroy();
      
      // ViewModel operations should handle this gracefully
      expect(() => {
        viewModel.executeCommand('expandAll');
      }).not.toThrow();
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      viewModel = new TreeScribeViewModel(model, view);
    });

    test('should track loading state', () => {
      expect(viewModel.getState().loading).toBe(false);
      
      // Loading state should be managed during async operations
      // (In a real implementation, loadYaml might be async)
      viewModel.executeCommand('loadYaml', { yamlContent: 'title: Test' });
      
      expect(viewModel.getState().loading).toBe(false); // Should be false after completion
    });

    test('should track error state', () => {
      expect(viewModel.getState().error).toBeNull();
      
      // Try to load invalid YAML (this should handle errors gracefully)
      viewModel.executeCommand('loadYaml', { yamlContent: 'invalid: yaml: content:\n  badly: formatted' });
      
      // Should either succeed (graceful handling) or track error
      const state = viewModel.getState();
      expect(state.error === null || typeof state.error === 'string').toBe(true);
    });

    test('should provide current document state', () => {
      const state1 = viewModel.getState();
      expect(state1.hasDocument).toBe(false);
      expect(state1.nodeCount).toBe(0);
      
      viewModel.executeCommand('loadYaml', { yamlContent: 'title: Test\nsections:\n  - title: Child' });
      
      const state2 = viewModel.getState();
      expect(state2.hasDocument).toBe(true);
      expect(state2.nodeCount).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    test('should clean up properly on destroy', () => {
      viewModel = new TreeScribeViewModel(model, view);
      
      // Load some data
      viewModel.executeCommand('loadYaml', { yamlContent: 'title: Test' });
      
      expect(viewModel.destroyed).toBe(false);
      
      viewModel.destroy();
      
      expect(viewModel.destroyed).toBe(true);
    });

    test('should remove all event listeners on destroy', () => {
      viewModel = new TreeScribeViewModel(model, view);
      
      let listenerCalled = false;
      viewModel.on('documentLoaded', () => { listenerCalled = true; });
      
      viewModel.destroy();
      
      // Should not call listener after destroy
      model._emit('modelChanged', { type: 'loaded' }); // Direct model event
      expect(listenerCalled).toBe(false);
    });

    test('should be safe to call destroy multiple times', () => {
      viewModel = new TreeScribeViewModel(model, view);
      
      expect(() => {
        viewModel.destroy();
        viewModel.destroy();
        viewModel.destroy();
      }).not.toThrow();
    });
  });
});