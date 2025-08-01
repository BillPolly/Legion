/**
 * InteractionManager Tests
 * 
 * Testing InteractionManager class for handling user interactions, event delegation, and keyboard navigation
 */

import { InteractionManager } from '../../../../../../src/components/tree-scribe/features/interaction/InteractionManager.js';

describe('InteractionManager', () => {
  let interactionManager;
  let container;
  let mockTreeView;
  let mockNodeRenderer;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'tree-scribe-container';
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Create mock tree view
    mockTreeView = {
      destroyed: false,
      container: container,
      focusedNodeId: null,
      setFocusedNode: (nodeId) => {
        mockTreeView.focusedNodeId = nodeId;
      },
      getFocusedNode: () => mockTreeView.focusedNodeId,
      scrollToNode: (nodeId) => {},
      getVisibleNodes: () => ['node-1', 'node-2', 'node-3'],
      getNodeElement: (nodeId) => {
        const element = document.createElement('div');
        element.className = 'tree-node';
        element.setAttribute('data-node-id', nodeId);
        element.setAttribute('tabindex', '0');
        return element;
      }
    };

    // Create mock node renderer
    mockNodeRenderer = {
      destroyed: false,
      eventListeners: new Map(),
      on: (eventType, callback) => {
        if (!mockNodeRenderer.eventListeners.has(eventType)) {
          mockNodeRenderer.eventListeners.set(eventType, []);
        }
        mockNodeRenderer.eventListeners.get(eventType).push(callback);
        return () => {
          const listeners = mockNodeRenderer.eventListeners.get(eventType);
          const index = listeners.indexOf(callback);
          if (index > -1) listeners.splice(index, 1);
        };
      },
      emit: (eventType, data) => {
        const listeners = mockNodeRenderer.eventListeners.get(eventType);
        if (listeners) {
          listeners.forEach(callback => callback(data));
        }
      }
    };

    interactionManager = new InteractionManager(mockTreeView, mockNodeRenderer);
  });

  afterEach(() => {
    if (interactionManager && !interactionManager.destroyed) {
      interactionManager.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Initialization', () => {
    test('should initialize with tree view and node renderer', () => {
      expect(interactionManager.treeView).toBe(mockTreeView);
      expect(interactionManager.nodeRenderer).toBe(mockNodeRenderer);
      expect(interactionManager.destroyed).toBe(false);
    });

    test('should set up event delegation on container', () => {
      // Check that event listeners are attached to container
      const events = interactionManager._getAttachedEvents();
      expect(events).toContain('click');
      expect(events).toContain('keydown');
      expect(events).toContain('focus');
      expect(events).toContain('blur');
    });

    test('should subscribe to node renderer events', () => {
      // Verify that interaction manager is listening to node renderer
      expect(mockNodeRenderer.eventListeners.has('nodeToggle')).toBe(true);
      expect(mockNodeRenderer.eventListeners.has('contentInteraction')).toBe(true);
    });

    test('should handle missing dependencies gracefully', () => {
      expect(() => {
        new InteractionManager(null, mockNodeRenderer);
      }).toThrow('TreeView is required');

      expect(() => {
        new InteractionManager(mockTreeView, null);
      }).toThrow('NodeRenderer is required');
    });
  });

  describe('Node Toggle Interaction', () => {
    test('should handle node toggle clicks', () => {
      let toggleEventData = null;
      interactionManager.on('nodeToggle', (data) => {
        toggleEventData = data;
      });

      // Create a proper node structure with toggle button
      const nodeElement = document.createElement('div');
      nodeElement.className = 'tree-node';
      nodeElement.setAttribute('data-node-id', 'test-node');
      
      const toggleButton = document.createElement('button');
      toggleButton.className = 'node-toggle';
      nodeElement.appendChild(toggleButton);
      
      container.appendChild(nodeElement);

      // Simulate click
      const clickEvent = new MouseEvent('click', { bubbles: true });
      toggleButton.dispatchEvent(clickEvent);

      expect(toggleEventData).toBeDefined();
      expect(toggleEventData.nodeId).toBe('test-node');
      expect(toggleEventData.action).toBe('toggle');
    });

    test('should prevent default behavior on toggle clicks', () => {
      // Create proper node structure
      const nodeElement = document.createElement('div');
      nodeElement.className = 'tree-node';
      nodeElement.setAttribute('data-node-id', 'test-node');
      
      const toggleButton = document.createElement('button');
      toggleButton.className = 'node-toggle';
      nodeElement.appendChild(toggleButton);
      
      container.appendChild(nodeElement);

      const clickEvent = new MouseEvent('click', { 
        bubbles: true, 
        cancelable: true 
      });
      
      let defaultPrevented = false;
      clickEvent.preventDefault = () => { defaultPrevented = true; };

      toggleButton.dispatchEvent(clickEvent);

      expect(defaultPrevented).toBe(true);
    });

    test('should handle node renderer toggle events', () => {
      let interactionEventData = null;
      interactionManager.on('nodeToggle', (data) => {
        interactionEventData = data;
      });

      // Simulate node renderer emitting toggle event
      mockNodeRenderer.emit('nodeToggle', {
        nodeId: 'test-node',
        expanded: false
      });

      expect(interactionEventData).toBeDefined();
      expect(interactionEventData.nodeId).toBe('test-node');
      expect(interactionEventData.expanded).toBe(false);
    });

    test('should ignore clicks on non-toggle elements', () => {
      let toggleEventData = null;
      interactionManager.on('nodeToggle', (data) => {
        toggleEventData = data;
      });

      // Create a non-toggle element
      const regularDiv = document.createElement('div');
      regularDiv.className = 'regular-element';
      container.appendChild(regularDiv);

      // Simulate click
      const clickEvent = new MouseEvent('click', { bubbles: true });
      regularDiv.dispatchEvent(clickEvent);

      expect(toggleEventData).toBeNull();
    });
  });

  describe('Event Handling', () => {
    test('should handle focus events', () => {
      let focusEventData = null;
      interactionManager.on('nodeFocus', (data) => {
        focusEventData = data;
      });

      // Create a mock node element
      const nodeElement = document.createElement('div');
      nodeElement.className = 'tree-node';
      nodeElement.setAttribute('data-node-id', 'focus-test-node');
      nodeElement.setAttribute('tabindex', '0');
      container.appendChild(nodeElement);

      // Simulate focus
      const focusEvent = new FocusEvent('focus', { bubbles: true });
      nodeElement.dispatchEvent(focusEvent);

      expect(focusEventData).toBeDefined();
      expect(focusEventData.nodeId).toBe('focus-test-node');
    });

    test('should handle blur events', () => {
      let blurEventData = null;
      interactionManager.on('nodeBlur', (data) => {
        blurEventData = data;
      });

      const nodeElement = document.createElement('div');
      nodeElement.className = 'tree-node';
      nodeElement.setAttribute('data-node-id', 'blur-test-node');
      nodeElement.setAttribute('tabindex', '0');
      container.appendChild(nodeElement);

      // Simulate blur
      const blurEvent = new FocusEvent('blur', { bubbles: true });
      nodeElement.dispatchEvent(blurEvent);

      expect(blurEventData).toBeDefined();
      expect(blurEventData.nodeId).toBe('blur-test-node');
    });

    test('should handle keyboard events', () => {
      let keyboardEventData = null;
      interactionManager.on('keyboardNavigation', (data) => {
        keyboardEventData = data;
      });

      const nodeElement = document.createElement('div');
      nodeElement.className = 'tree-node';
      nodeElement.setAttribute('data-node-id', 'keyboard-test-node');
      nodeElement.setAttribute('tabindex', '0');
      container.appendChild(nodeElement);

      // Simulate ArrowDown key press (Enter would trigger toggle, not navigation)
      const keyEvent = new KeyboardEvent('keydown', { 
        key: 'ArrowDown', 
        bubbles: true 
      });
      nodeElement.dispatchEvent(keyEvent);

      expect(keyboardEventData).toBeDefined();
      expect(keyboardEventData.key).toBe('ArrowDown');
      expect(keyboardEventData.nodeId).toBe('keyboard-test-node');
    });

    test('should handle content interaction events from node renderer', () => {
      let contentEventData = null;
      interactionManager.on('contentInteraction', (data) => {
        contentEventData = data;
      });

      // Simulate content interaction from node renderer
      mockNodeRenderer.emit('contentInteraction', {
        nodeId: 'test-node',
        type: 'link',
        url: 'http://example.com',
        text: 'Example Link'
      });

      expect(contentEventData).toBeDefined();
      expect(contentEventData.nodeId).toBe('test-node');
      expect(contentEventData.type).toBe('link');
    });
  });

  describe('Event Delegation', () => {
    test('should use event delegation for performance', () => {
      // Create multiple node elements
      const nodes = [];
      for (let i = 0; i < 10; i++) {
        const node = document.createElement('div');
        node.className = 'tree-node';
        node.setAttribute('data-node-id', `node-${i}`);
        node.setAttribute('tabindex', '0');
        container.appendChild(node);
        nodes.push(node);
      }

      let eventCount = 0;
      interactionManager.on('nodeFocus', () => {
        eventCount++;
      });

      // Focus on multiple nodes
      nodes.forEach((node, i) => {
        const focusEvent = new FocusEvent('focus', { bubbles: true });
        node.dispatchEvent(focusEvent);
      });

      expect(eventCount).toBe(10); // All events should be handled
    });

    test('should correctly identify event targets', () => {
      const events = [];
      interactionManager.on('nodeFocus', (data) => {
        events.push(data.nodeId);
      });

      // Create nested structure to test event bubbling
      const parentNode = document.createElement('div');
      parentNode.className = 'tree-node';
      parentNode.setAttribute('data-node-id', 'parent-node');
      parentNode.setAttribute('tabindex', '0');

      const childElement = document.createElement('span');
      childElement.className = 'node-title';
      childElement.textContent = 'Child Content';
      parentNode.appendChild(childElement);

      container.appendChild(parentNode);

      // Focus on child should register as parent node focus
      const focusEvent = new FocusEvent('focus', { bubbles: true });
      childElement.dispatchEvent(focusEvent);

      expect(events).toContain('parent-node');
    });

    test('should handle events only within container', () => {
      let eventReceived = false;
      interactionManager.on('nodeFocus', () => {
        eventReceived = true;
      });

      // Create element outside container
      const outsideElement = document.createElement('div');
      outsideElement.className = 'tree-node';
      outsideElement.setAttribute('data-node-id', 'outside-node');
      outsideElement.setAttribute('tabindex', '0');
      document.body.appendChild(outsideElement);

      // Focus on outside element
      const focusEvent = new FocusEvent('focus', { bubbles: true });
      outsideElement.dispatchEvent(focusEvent);

      expect(eventReceived).toBe(false);

      // Cleanup
      document.body.removeChild(outsideElement);
    });
  });

  describe('Keyboard Navigation', () => {
    test('should handle arrow key navigation', () => {
      const navigationEvents = [];
      interactionManager.on('keyboardNavigation', (data) => {
        navigationEvents.push(data);
      });

      const nodeElement = document.createElement('div');
      nodeElement.className = 'tree-node';
      nodeElement.setAttribute('data-node-id', 'nav-test-node');
      nodeElement.setAttribute('tabindex', '0');
      container.appendChild(nodeElement);

      // Test different arrow keys
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      keys.forEach(key => {
        const keyEvent = new KeyboardEvent('keydown', { 
          key, 
          bubbles: true 
        });
        nodeElement.dispatchEvent(keyEvent);
      });

      expect(navigationEvents.length).toBe(4);
      expect(navigationEvents.map(e => e.key)).toEqual(keys);
    });

    test('should handle Enter key for node toggle', () => {
      let toggleEventData = null;
      interactionManager.on('nodeToggle', (data) => {
        toggleEventData = data;
      });

      const nodeElement = document.createElement('div');
      nodeElement.className = 'tree-node';
      nodeElement.setAttribute('data-node-id', 'enter-test-node');
      nodeElement.setAttribute('tabindex', '0');
      container.appendChild(nodeElement);

      // Simulate Enter key press
      const keyEvent = new KeyboardEvent('keydown', { 
        key: 'Enter', 
        bubbles: true 
      });
      nodeElement.dispatchEvent(keyEvent);

      expect(toggleEventData).toBeDefined();
      expect(toggleEventData.nodeId).toBe('enter-test-node');
      expect(toggleEventData.action).toBe('toggle');
    });

    test('should handle Space key for node toggle', () => {
      let toggleEventData = null;
      interactionManager.on('nodeToggle', (data) => {
        toggleEventData = data;
      });

      const nodeElement = document.createElement('div');
      nodeElement.className = 'tree-node';
      nodeElement.setAttribute('data-node-id', 'space-test-node');
      nodeElement.setAttribute('tabindex', '0');
      container.appendChild(nodeElement);

      // Simulate Space key press
      const keyEvent = new KeyboardEvent('keydown', { 
        key: ' ', 
        bubbles: true 
      });
      nodeElement.dispatchEvent(keyEvent);

      expect(toggleEventData).toBeDefined();
      expect(toggleEventData.nodeId).toBe('space-test-node');
      expect(toggleEventData.action).toBe('toggle');
    });

    test('should prevent default behavior for handled keys', () => {
      const nodeElement = document.createElement('div');
      nodeElement.className = 'tree-node';
      nodeElement.setAttribute('data-node-id', 'prevent-test-node');
      nodeElement.setAttribute('tabindex', '0');
      container.appendChild(nodeElement);

      let defaultPrevented = false;
      const keyEvent = new KeyboardEvent('keydown', { 
        key: 'ArrowDown', 
        bubbles: true,
        cancelable: true
      });
      keyEvent.preventDefault = () => { defaultPrevented = true; };

      nodeElement.dispatchEvent(keyEvent);

      expect(defaultPrevented).toBe(true);
    });

    test('should ignore non-navigation keys', () => {
      let navigationEventData = null;
      interactionManager.on('keyboardNavigation', (data) => {
        navigationEventData = data;
      });

      const nodeElement = document.createElement('div');
      nodeElement.className = 'tree-node';
      nodeElement.setAttribute('data-node-id', 'ignore-test-node');
      nodeElement.setAttribute('tabindex', '0');
      container.appendChild(nodeElement);

      // Simulate non-navigation key
      const keyEvent = new KeyboardEvent('keydown', { 
        key: 'a', 
        bubbles: true 
      });
      nodeElement.dispatchEvent(keyEvent);

      expect(navigationEventData).toBeNull();
    });
  });

  describe('Focus Management', () => {
    test('should track focused node', () => {
      const nodeElement = document.createElement('div');
      nodeElement.className = 'tree-node';
      nodeElement.setAttribute('data-node-id', 'focus-track-node');
      nodeElement.setAttribute('tabindex', '0');
      container.appendChild(nodeElement);

      // Initially no focus
      expect(interactionManager.getFocusedNodeId()).toBeNull();

      // Focus node
      const focusEvent = new FocusEvent('focus', { bubbles: true });
      nodeElement.dispatchEvent(focusEvent);

      expect(interactionManager.getFocusedNodeId()).toBe('focus-track-node');

      // Blur node
      const blurEvent = new FocusEvent('blur', { bubbles: true });
      nodeElement.dispatchEvent(blurEvent);

      expect(interactionManager.getFocusedNodeId()).toBeNull();
    });

    test('should provide focus utilities', () => {
      expect(typeof interactionManager.focusNode).toBe('function');
      expect(typeof interactionManager.focusNextNode).toBe('function');
      expect(typeof interactionManager.focusPreviousNode).toBe('function');
      expect(typeof interactionManager.focusFirstNode).toBe('function');
      expect(typeof interactionManager.focusLastNode).toBe('function');
    });

    test('should focus specific nodes programmatically', () => {
      let focusEventData = null;
      interactionManager.on('nodeFocus', (data) => {
        focusEventData = data;
      });

      // Mock the tree view to return a node element
      mockTreeView.getNodeElement = (nodeId) => {
        const element = document.createElement('div');
        element.className = 'tree-node';
        element.setAttribute('data-node-id', nodeId);
        element.setAttribute('tabindex', '0');
        element.focus = () => {
          const focusEvent = new FocusEvent('focus', { bubbles: true });
          element.dispatchEvent(focusEvent);
        };
        container.appendChild(element);
        return element;
      };

      interactionManager.focusNode('test-focus-node');

      expect(focusEventData).toBeDefined();
      expect(focusEventData.nodeId).toBe('test-focus-node');
    });
  });

  describe('Event Listener Management', () => {
    test('should support adding event listeners', () => {
      let eventReceived = false;
      const removeListener = interactionManager.on('nodeToggle', () => {
        eventReceived = true;
      });

      expect(typeof removeListener).toBe('function');

      // Trigger event
      mockNodeRenderer.emit('nodeToggle', { nodeId: 'test' });

      expect(eventReceived).toBe(true);
    });

    test('should support removing event listeners', () => {
      let eventReceived = false;
      const removeListener = interactionManager.on('nodeToggle', () => {
        eventReceived = true;
      });

      removeListener(); // Remove listener

      // Trigger event
      mockNodeRenderer.emit('nodeToggle', { nodeId: 'test' });

      expect(eventReceived).toBe(false);
    });

    test('should support multiple listeners for same event', () => {
      let listener1Called = false;
      let listener2Called = false;

      interactionManager.on('nodeToggle', () => { listener1Called = true; });
      interactionManager.on('nodeToggle', () => { listener2Called = true; });

      // Trigger event
      mockNodeRenderer.emit('nodeToggle', { nodeId: 'test' });

      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
    });

    test('should handle listener errors gracefully', () => {
      // Add listener that throws error
      interactionManager.on('nodeToggle', () => {
        throw new Error('Listener error');
      });

      // Add normal listener
      let normalListenerCalled = false;
      interactionManager.on('nodeToggle', () => {
        normalListenerCalled = true;
      });

      // Should not throw and should call other listeners
      expect(() => {
        mockNodeRenderer.emit('nodeToggle', { nodeId: 'test' });
      }).not.toThrow();

      expect(normalListenerCalled).toBe(true);
    });
  });

  describe('Performance', () => {
    test('should handle many nodes efficiently', () => {
      // Create 1000 node elements
      const nodes = [];
      for (let i = 0; i < 1000; i++) {
        const node = document.createElement('div');
        node.className = 'tree-node';
        node.setAttribute('data-node-id', `perf-node-${i}`);
        node.setAttribute('tabindex', '0');
        container.appendChild(node);
        nodes.push(node);
      }

      let eventCount = 0;
      interactionManager.on('nodeFocus', () => {
        eventCount++;
      });

      const startTime = Date.now();

      // Focus all nodes
      nodes.forEach(node => {
        const focusEvent = new FocusEvent('focus', { bubbles: true });
        node.dispatchEvent(focusEvent);
      });

      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      expect(eventCount).toBe(1000);
    });

    test('should use event delegation to minimize listeners', () => {
      // The interaction manager should use only a few delegated listeners
      // rather than adding listeners to each node
      const initialListenerCount = interactionManager._getAttachedEvents().length;

      // Add many nodes
      for (let i = 0; i < 100; i++) {
        const node = document.createElement('div');
        node.className = 'tree-node';
        node.setAttribute('data-node-id', `delegation-node-${i}`);
        container.appendChild(node);
      }

      // Listener count should not increase
      const finalListenerCount = interactionManager._getAttachedEvents().length;
      expect(finalListenerCount).toBe(initialListenerCount);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing node IDs gracefully', () => {
      let errorOccurred = false;

      interactionManager.on('error', () => {
        errorOccurred = true;
      });

      // Create element without node ID
      const nodeElement = document.createElement('div');
      nodeElement.className = 'tree-node';
      // Missing data-node-id attribute
      container.appendChild(nodeElement);

      // Should not throw when handling events
      expect(() => {
        const focusEvent = new FocusEvent('focus', { bubbles: true });
        nodeElement.dispatchEvent(focusEvent);
      }).not.toThrow();
    });

    test('should handle destroyed dependencies', () => {
      // Destroy dependencies
      mockTreeView.destroyed = true;
      mockNodeRenderer.destroyed = true;

      // Should handle gracefully
      expect(() => {
        const keyEvent = new KeyboardEvent('keydown', { 
          key: 'ArrowDown', 
          bubbles: true 
        });
        container.dispatchEvent(keyEvent);
      }).not.toThrow();
    });

    test('should validate event targets', () => {
      let eventReceived = false;
      interactionManager.on('nodeFocus', () => {
        eventReceived = true;
      });

      // Create element that's not a tree node
      const nonNodeElement = document.createElement('div');
      nonNodeElement.className = 'not-a-tree-node';
      container.appendChild(nonNodeElement);

      // Should not trigger tree node events
      const focusEvent = new FocusEvent('focus', { bubbles: true });
      nonNodeElement.dispatchEvent(focusEvent);

      expect(eventReceived).toBe(false);
    });
  });

  describe('Cleanup', () => {
    test('should clean up properly on destroy', () => {
      expect(interactionManager.destroyed).toBe(false);

      interactionManager.destroy();

      expect(interactionManager.destroyed).toBe(true);
    });

    test('should remove DOM event listeners on destroy', () => {
      const initialEventCount = interactionManager._getAttachedEvents().length;
      expect(initialEventCount).toBeGreaterThan(0);

      interactionManager.destroy();

      const finalEventCount = interactionManager._getAttachedEvents().length;
      expect(finalEventCount).toBe(0);
    });

    test('should unsubscribe from node renderer events on destroy', () => {
      const initialListenerCount = mockNodeRenderer.eventListeners.get('nodeToggle')?.length || 0;
      expect(initialListenerCount).toBeGreaterThan(0);

      interactionManager.destroy();

      const finalListenerCount = mockNodeRenderer.eventListeners.get('nodeToggle')?.length || 0;
      expect(finalListenerCount).toBe(0);
    });

    test('should be safe to call destroy multiple times', () => {
      expect(() => {
        interactionManager.destroy();
        interactionManager.destroy();
        interactionManager.destroy();
      }).not.toThrow();
    });

    test('should stop handling events after destroy', () => {
      let eventReceived = false;
      interactionManager.on('nodeFocus', () => {
        eventReceived = true;
      });

      interactionManager.destroy();

      // Try to trigger event
      const nodeElement = document.createElement('div');
      nodeElement.className = 'tree-node';
      nodeElement.setAttribute('data-node-id', 'post-destroy-node');
      container.appendChild(nodeElement);

      const focusEvent = new FocusEvent('focus', { bubbles: true });
      nodeElement.dispatchEvent(focusEvent);

      expect(eventReceived).toBe(false);
    });
  });
});