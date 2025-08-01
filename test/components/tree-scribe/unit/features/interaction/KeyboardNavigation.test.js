/**
 * KeyboardNavigation Tests
 * 
 * Testing KeyboardNavigation class for keyboard shortcuts, focus management, and accessibility
 */

import { KeyboardNavigation } from '../../../../../../src/components/tree-scribe/features/interaction/KeyboardNavigation.js';

describe('KeyboardNavigation', () => {
  let keyboardNavigation;
  let mockTreeView;
  let mockInteractionManager;
  let container;

  beforeEach(() => {
    // Create container
    container = document.createElement('div');
    container.className = 'tree-scribe-container';
    document.body.appendChild(container);

    // Create mock tree view
    mockTreeView = {
      container: container,
      destroyed: false,
      model: {
        getNode: (nodeId) => {
          const mockNodes = {
            'node-1': {
              getId: () => 'node-1',
              getTitle: () => 'Node 1',
              getDepth: () => 0,
              getChildren: () => [],
              getParent: () => null,
              getState: () => ({ expanded: false })
            },
            'node-2': {
              getId: () => 'node-2',
              getTitle: () => 'Node 2',
              getDepth: () => 1,
              getChildren: () => [],
              getParent: () => mockNodes['node-1'],
              getState: () => ({ expanded: true })
            },
            'parent-node': {
              getId: () => 'parent-node',
              getTitle: () => 'Parent Node',
              getDepth: () => 0,
              getChildren: () => [mockNodes['node-2']],
              getParent: () => null,
              getState: () => ({ expanded: true })
            }
          };
          return mockNodes[nodeId] || null;
        }
      },
      foldingManager: {
        expandAll: () => {}
      }
    };

    // Create mock interaction manager
    mockInteractionManager = {
      destroyed: false,
      focusedNodeId: null,
      eventListeners: new Map(),
      on: (eventType, callback) => {
        if (!mockInteractionManager.eventListeners.has(eventType)) {
          mockInteractionManager.eventListeners.set(eventType, []);
        }
        mockInteractionManager.eventListeners.get(eventType).push(callback);
        return () => {
          const listeners = mockInteractionManager.eventListeners.get(eventType);
          const index = listeners.indexOf(callback);
          if (index > -1) listeners.splice(index, 1);
        };
      },
      _emit: (eventType, data) => {
        const listeners = mockInteractionManager.eventListeners.get(eventType);
        if (listeners) {
          listeners.forEach(callback => callback(data));
        }
      },
      getFocusedNodeId: () => mockInteractionManager.focusedNodeId,
      focusNode: (nodeId) => {
        mockInteractionManager.focusedNodeId = nodeId;
        mockInteractionManager._emit('nodeFocus', { nodeId });
        return true;
      },
      focusNextNode: () => {
        mockInteractionManager.focusedNodeId = 'next-node';
        return true;
      },
      focusPreviousNode: () => {
        mockInteractionManager.focusedNodeId = 'prev-node';
        return true;
      },
      focusFirstNode: () => {
        mockInteractionManager.focusedNodeId = 'first-node';
        return true;
      },
      focusLastNode: () => {
        mockInteractionManager.focusedNodeId = 'last-node';
        return true;
      }
    };

    keyboardNavigation = new KeyboardNavigation(mockTreeView, mockInteractionManager);
  });

  afterEach(() => {
    if (keyboardNavigation && !keyboardNavigation.destroyed) {
      keyboardNavigation.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Initialization', () => {
    test('should initialize with tree view and interaction manager', () => {
      expect(keyboardNavigation.treeView).toBe(mockTreeView);
      expect(keyboardNavigation.interactionManager).toBe(mockInteractionManager);
      expect(keyboardNavigation.destroyed).toBe(false);
    });

    test('should throw error without required dependencies', () => {
      expect(() => {
        new KeyboardNavigation(null, mockInteractionManager);
      }).toThrow('TreeView is required');

      expect(() => {
        new KeyboardNavigation(mockTreeView, null);
      }).toThrow('InteractionManager is required');
    });

    test('should initialize with default options', () => {
      expect(keyboardNavigation.options.enableShortcuts).toBe(true);
      expect(keyboardNavigation.options.enableAriaSupport).toBe(true);
      expect(keyboardNavigation.options.enableFocusTrapping).toBe(true);
      expect(keyboardNavigation.options.announceNavigation).toBe(true);
    });

    test('should accept custom options', () => {
      const customNav = new KeyboardNavigation(mockTreeView, mockInteractionManager, {
        enableShortcuts: false,
        enableAriaSupport: false,
        announceNavigation: false
      });

      expect(customNav.options.enableShortcuts).toBe(false);
      expect(customNav.options.enableAriaSupport).toBe(false);
      expect(customNav.options.announceNavigation).toBe(false);

      customNav.destroy();
    });

    test('should create ARIA live region', () => {
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeDefined();
      expect(liveRegion.className).toBe('sr-only');
    });

    test('should subscribe to interaction manager events', () => {
      expect(mockInteractionManager.eventListeners.has('keyboardNavigation')).toBe(true);
      expect(mockInteractionManager.eventListeners.has('nodeFocus')).toBe(true);
    });
  });

  describe('Shortcut Registration', () => {
    test('should register keyboard shortcuts', () => {
      const handler = () => {};
      const result = keyboardNavigation.registerShortcut('Ctrl+K', 'Test shortcut', handler);
      
      expect(result).toBe(true);
      
      const shortcuts = keyboardNavigation.getShortcuts();
      const testShortcut = shortcuts.find(s => s.keyCombo === 'Ctrl+K');
      expect(testShortcut).toBeDefined();
      expect(testShortcut.description).toBe('Test shortcut');
    });

    test('should normalize key combinations', () => {
      keyboardNavigation.registerShortcut('ctrl+shift+k', 'Test', () => {});
      keyboardNavigation.registerShortcut('Shift+Ctrl+K', 'Test2', () => {});
      
      const shortcuts = keyboardNavigation.getShortcuts();
      // Both should normalize to the same combo
      const normalizedShortcuts = shortcuts.filter(s => s.keyCombo === 'Ctrl+Shift+K');
      expect(normalizedShortcuts.length).toBe(1); // Second one should replace first
    });

    test('should unregister shortcuts', () => {
      keyboardNavigation.registerShortcut('Ctrl+K', 'Test', () => {});
      expect(keyboardNavigation.getShortcuts().length).toBeGreaterThan(0);
      
      const result = keyboardNavigation.unregisterShortcut('Ctrl+K');
      expect(result).toBe(true);
      
      const shortcuts = keyboardNavigation.getShortcuts();
      const testShortcut = shortcuts.find(s => s.keyCombo === 'Ctrl+K');
      expect(testShortcut).toBeUndefined();
    });

    test('should enable/disable shortcuts', () => {
      keyboardNavigation.registerShortcut('Ctrl+K', 'Test', () => {});
      
      const result = keyboardNavigation.setShortcutEnabled('Ctrl+K', false);
      expect(result).toBe(true);
      
      const shortcuts = keyboardNavigation.getShortcuts();
      const testShortcut = shortcuts.find(s => s.keyCombo === 'Ctrl+K');
      expect(testShortcut.enabled).toBe(false);
      
      keyboardNavigation.setShortcutEnabled('Ctrl+K', true);
      const enabledShortcut = keyboardNavigation.getShortcuts().find(s => s.keyCombo === 'Ctrl+K');
      expect(enabledShortcut.enabled).toBe(true);
    });

    test('should handle invalid shortcut operations', () => {
      expect(keyboardNavigation.registerShortcut('', 'Invalid', () => {})).toBe(false);
      expect(keyboardNavigation.registerShortcut('Ctrl+K', 'Invalid', null)).toBe(false);
      expect(keyboardNavigation.unregisterShortcut('')).toBe(false);
      expect(keyboardNavigation.setShortcutEnabled('nonexistent', true)).toBe(false);
    });
  });

  describe('Default Navigation Shortcuts', () => {
    test('should handle arrow key navigation', () => {
      let focusedNode = null;
      mockInteractionManager.focusNextNode = () => {
        focusedNode = 'next';
        return true;
      };
      mockInteractionManager.focusPreviousNode = () => {
        focusedNode = 'previous';
        return true;
      };

      // Simulate ArrowDown
      mockInteractionManager._emit('keyboardNavigation', {
        key: 'ArrowDown',
        nodeId: 'current-node',
        event: { key: 'ArrowDown' }
      });
      expect(focusedNode).toBe('next');

      // Simulate ArrowUp
      mockInteractionManager._emit('keyboardNavigation', {
        key: 'ArrowUp',
        nodeId: 'current-node',
        event: { key: 'ArrowUp' }
      });
      expect(focusedNode).toBe('previous');
    });

    test('should handle Home and End keys', () => {
      let focusedNode = null;
      mockInteractionManager.focusFirstNode = () => {
        focusedNode = 'first';
        return true;
      };
      mockInteractionManager.focusLastNode = () => {
        focusedNode = 'last';
        return true;
      };

      // Simulate Home
      mockInteractionManager._emit('keyboardNavigation', {
        key: 'Home',
        nodeId: 'current-node',
        event: { key: 'Home' }
      });
      expect(focusedNode).toBe('first');

      // Simulate End
      mockInteractionManager._emit('keyboardNavigation', {
        key: 'End',
        nodeId: 'current-node',
        event: { key: 'End' }
      });
      expect(focusedNode).toBe('last');
    });

    test('should handle Enter and Space for toggle', () => {
      mockInteractionManager.getFocusedNodeId = () => 'toggle-node';
      
      // Test that the toggle methods are called by checking the internal state
      // We can't easily mock the private _emit method, so we'll test the shortcuts exist
      const shortcuts = keyboardNavigation.getShortcuts();
      
      const enterShortcut = shortcuts.find(s => s.keyCombo === 'Enter');
      expect(enterShortcut).toBeDefined();
      expect(enterShortcut.description).toContain('Toggle');
      expect(enterShortcut.enabled).toBe(true);

      // The space shortcut should be ' '
      const spaceShortcut = shortcuts.find(s => s.keyCombo === ' ');
      expect(spaceShortcut).toBeDefined();
      expect(spaceShortcut.description).toContain('Toggle');
      expect(spaceShortcut.enabled).toBe(true);

      // Test that the shortcuts get called when keyboard navigation events occur
      // We'll spy on the _emitToggle method instead
      let toggleCalled = false;
      const originalEmitToggle = keyboardNavigation._emitToggle;
      keyboardNavigation._emitToggle = (nodeId) => {
        expect(nodeId).toBe('toggle-node');
        toggleCalled = true;
      };

      // Simulate Enter
      mockInteractionManager._emit('keyboardNavigation', {
        key: 'Enter', 
        nodeId: 'toggle-node',
        event: { key: 'Enter' }
      });
      expect(toggleCalled).toBe(true);

      // Reset and test Space
      toggleCalled = false;
      mockInteractionManager._emit('keyboardNavigation', {
        key: ' ',
        nodeId: 'toggle-node', 
        event: { key: ' ' }
      });
      expect(toggleCalled).toBe(true);

      // Restore original method
      keyboardNavigation._emitToggle = originalEmitToggle;
    });

    test('should handle ArrowLeft navigation (collapse or parent)', () => {
      mockInteractionManager.getFocusedNodeId = () => 'node-2';
      let toggleData = null;
      let focusedNode = null;

      // Store original functions
      const originalEmit = mockInteractionManager._emit;
      const originalFocusNode = mockInteractionManager.focusNode;
      
      mockInteractionManager._emit = (eventType, data) => {
        if (eventType === 'nodeToggle') {
          toggleData = data;
        }
        originalEmit.call(mockInteractionManager, eventType, data);
      };
      mockInteractionManager.focusNode = (nodeId) => {
        focusedNode = nodeId;
        return originalFocusNode.call(mockInteractionManager, nodeId);
      };

      // Test with expanded node - should collapse
      mockInteractionManager._emit('keyboardNavigation', {
        key: 'ArrowLeft',
        nodeId: 'node-2',
        event: { key: 'ArrowLeft' }
      });
      expect(toggleData).toBeDefined();
      expect(toggleData.nodeId).toBe('node-2');

      // Test with collapsed node with parent - should navigate to parent
      toggleData = null;
      mockTreeView.model.getNode = (nodeId) => ({
        getId: () => nodeId,
        getState: () => ({ expanded: false }),
        getParent: () => ({ getId: () => 'parent-node' }),
        getChildren: () => []
      });

      mockInteractionManager._emit('keyboardNavigation', {
        key: 'ArrowLeft',
        nodeId: 'child-node',
        event: { key: 'ArrowLeft' }
      });
      expect(focusedNode).toBe('parent-node');
      
      // Restore original functions
      mockInteractionManager._emit = originalEmit;
      mockInteractionManager.focusNode = originalFocusNode;
    });

    test('should handle ArrowRight navigation (expand or child)', () => {
      mockInteractionManager.getFocusedNodeId = () => 'parent-node';
      let toggleData = null;
      let focusedNode = null;

      // Store original functions
      const originalEmit = mockInteractionManager._emit;
      const originalFocusNode = mockInteractionManager.focusNode;
      
      mockInteractionManager._emit = (eventType, data) => {
        if (eventType === 'nodeToggle') {
          toggleData = data;
        }
        originalEmit.call(mockInteractionManager, eventType, data);
      };
      mockInteractionManager.focusNode = (nodeId) => {
        focusedNode = nodeId;
        return originalFocusNode.call(mockInteractionManager, nodeId);
      };

      // Test with collapsed node with children - should expand
      mockTreeView.model.getNode = (nodeId) => ({
        getId: () => nodeId,
        getState: () => ({ expanded: false }),
        getChildren: () => [{ getId: () => 'child-1' }]
      });

      mockInteractionManager._emit('keyboardNavigation', {
        key: 'ArrowRight',
        nodeId: 'parent-node',
        event: { key: 'ArrowRight' }
      });
      expect(toggleData).toBeDefined();
      expect(toggleData.nodeId).toBe('parent-node');

      // Test with expanded node - should navigate to first child
      toggleData = null;
      mockTreeView.model.getNode = (nodeId) => ({
        getId: () => nodeId,
        getState: () => ({ expanded: true }),
        getChildren: () => [{ getId: () => 'child-1' }]
      });

      mockInteractionManager._emit('keyboardNavigation', {
        key: 'ArrowRight',
        nodeId: 'parent-node',
        event: { key: 'ArrowRight' }
      });
      expect(focusedNode).toBe('child-1');
      
      // Restore original functions
      mockInteractionManager._emit = originalEmit;
      mockInteractionManager.focusNode = originalFocusNode;
    });
  });

  describe('Special Shortcuts', () => {
    test('should handle expand all shortcut (*)', () => {
      let expandAllCalled = false;
      mockTreeView.foldingManager.expandAll = () => {
        expandAllCalled = true;
      };

      mockInteractionManager._emit('keyboardNavigation', {
        key: '*',
        nodeId: 'current-node',
        event: { key: '*' }
      });

      expect(expandAllCalled).toBe(true);
    });

    test('should handle focus search shortcut (/)', () => {
      // Create search input
      const searchInput = document.createElement('input');
      searchInput.className = 'search-input';
      container.appendChild(searchInput);

      let focused = false;
      searchInput.focus = () => { focused = true; };

      const mockEvent = {
        key: '/',
        preventDefault: () => {}
      };

      mockInteractionManager._emit('keyboardNavigation', {
        key: '/',
        nodeId: 'current-node',
        event: mockEvent
      });

      expect(focused).toBe(true);
    });

    test('should handle Escape key scenarios', () => {
      // Test 1: Clear search when search is focused
      const searchInput = document.createElement('input');
      searchInput.className = 'search-input';
      searchInput.value = 'test query';
      container.appendChild(searchInput);

      // Mock document.activeElement
      Object.defineProperty(document, 'activeElement', {
        value: searchInput,
        writable: true
      });

      let blurred = false;
      searchInput.blur = () => { blurred = true; };

      mockInteractionManager._emit('keyboardNavigation', {
        key: 'Escape',
        nodeId: 'current-node',
        event: { key: 'Escape' }
      });

      expect(searchInput.value).toBe('');
      expect(blurred).toBe(true);

      // Test 2: Release focus trap when trapped
      document.activeElement = container; // Reset
      keyboardNavigation.enableFocusTrap();
      
      mockInteractionManager._emit('keyboardNavigation', {
        key: 'Escape',
        nodeId: 'current-node',
        event: { key: 'Escape' }
      });

      expect(keyboardNavigation.focusTrapped).toBe(false);

      // Test 3: Focus first node otherwise
      keyboardNavigation.focusTrapped = false;
      let focusFirstCalled = false;
      mockInteractionManager.focusFirstNode = () => {
        focusFirstCalled = true;
        return true;
      };

      mockInteractionManager._emit('keyboardNavigation', {
        key: 'Escape',
        nodeId: 'current-node',
        event: { key: 'Escape' }
      });

      expect(focusFirstCalled).toBe(true);
    });
  });

  describe('Focus Management', () => {
    test('should track focus history', () => {
      expect(keyboardNavigation.getFocusHistory()).toEqual([]);

      // Simulate focus events
      mockInteractionManager._emit('nodeFocus', { nodeId: 'node-1' });
      mockInteractionManager._emit('nodeFocus', { nodeId: 'node-2' });
      mockInteractionManager._emit('nodeFocus', { nodeId: 'node-3' });

      const history = keyboardNavigation.getFocusHistory();
      expect(history).toEqual(['node-3', 'node-2', 'node-1']);
    });

    test('should limit focus history size', () => {
      // Set small history size for testing
      keyboardNavigation.maxHistorySize = 3;

      // Add more items than limit
      for (let i = 1; i <= 5; i++) {
        mockInteractionManager._emit('nodeFocus', { nodeId: `node-${i}` });
      }

      const history = keyboardNavigation.getFocusHistory();
      expect(history.length).toBe(3);
      expect(history).toEqual(['node-5', 'node-4', 'node-3']);
    });

    test('should handle duplicate focus events', () => {
      mockInteractionManager._emit('nodeFocus', { nodeId: 'node-1' });
      mockInteractionManager._emit('nodeFocus', { nodeId: 'node-2' });
      mockInteractionManager._emit('nodeFocus', { nodeId: 'node-1' }); // Duplicate

      const history = keyboardNavigation.getFocusHistory();
      expect(history).toEqual(['node-1', 'node-2']); // node-1 moved to front
    });

    test('should clear focus history', () => {
      mockInteractionManager._emit('nodeFocus', { nodeId: 'node-1' });
      expect(keyboardNavigation.getFocusHistory().length).toBe(1);

      keyboardNavigation.clearFocusHistory();
      expect(keyboardNavigation.getFocusHistory()).toEqual([]);
    });
  });

  describe('Focus Trapping', () => {
    test('should enable focus trap', () => {
      expect(keyboardNavigation.focusTrapped).toBe(false);

      const result = keyboardNavigation.enableFocusTrap();
      expect(result).toBe(true);
      expect(keyboardNavigation.focusTrapped).toBe(true);
      expect(container.getAttribute('aria-modal')).toBe('true');
    });

    test('should release focus trap', () => {
      keyboardNavigation.enableFocusTrap();
      expect(keyboardNavigation.focusTrapped).toBe(true);

      const result = keyboardNavigation.releaseFocusTrap();
      expect(result).toBe(true);
      expect(keyboardNavigation.focusTrapped).toBe(false);
      expect(container.hasAttribute('aria-modal')).toBe(false);
    });

    test('should handle Tab navigation when focus trapped', () => {
      // Create focusable elements
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      const input = document.createElement('input');
      
      container.appendChild(button1);
      container.appendChild(button2);
      container.appendChild(input);

      keyboardNavigation.enableFocusTrap();

      // Mock focus method and track current focus
      let currentFocus = button1;
      button1.focus = () => { currentFocus = button1; };
      button2.focus = () => { currentFocus = button2; };
      input.focus = () => { currentFocus = input; };

      // Mock the _getFocusableElements method to return our elements
      const originalGetFocusable = keyboardNavigation._getFocusableElements;
      keyboardNavigation._getFocusableElements = () => [button1, button2, input];

      let preventDefaultCalled = false;
      const mockEvent = {
        key: 'Tab',
        preventDefault: () => { preventDefaultCalled = true; }
      };

      // Mock document.activeElement by temporarily replacing it
      const originalActiveElement = document.activeElement;
      Object.defineProperty(document, 'activeElement', {
        value: button1,
        writable: true
      });

      try {
        // Test Tab navigation
        mockInteractionManager._emit('keyboardNavigation', {
          key: 'Tab',
          nodeId: 'current-node',
          event: mockEvent
        });

        expect(preventDefaultCalled).toBe(true);
        expect(currentFocus).toBe(button2); // Should move to next element
      } finally {
        // Restore original activeElement
        Object.defineProperty(document, 'activeElement', {
          value: originalActiveElement,
          writable: true
        });
        keyboardNavigation._getFocusableElements = originalGetFocusable;
      }
    });

    test('should handle Shift+Tab navigation when focus trapped', () => {
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      
      container.appendChild(button1);
      container.appendChild(button2);

      keyboardNavigation.enableFocusTrap();

      let currentFocus = button1;
      button1.focus = () => { currentFocus = button1; };
      button2.focus = () => { currentFocus = button2; };

      // Mock the _getFocusableElements method
      const originalGetFocusable = keyboardNavigation._getFocusableElements;
      keyboardNavigation._getFocusableElements = () => [button1, button2];

      let preventDefaultCalled = false;
      const mockEvent = {
        key: 'Tab',
        shiftKey: true,
        preventDefault: () => { preventDefaultCalled = true; }
      };

      // Mock document.activeElement
      const originalActiveElement = document.activeElement;
      Object.defineProperty(document, 'activeElement', {
        value: button1,
        writable: true
      });

      try {
        mockInteractionManager._emit('keyboardNavigation', {
          key: 'Shift+Tab',
          nodeId: 'current-node',
          event: mockEvent
        });

        expect(preventDefaultCalled).toBe(true);
        expect(currentFocus).toBe(button2); // Should wrap to last element
      } finally {
        // Restore original activeElement
        Object.defineProperty(document, 'activeElement', {
          value: originalActiveElement,
          writable: true
        });
        keyboardNavigation._getFocusableElements = originalGetFocusable;
      }
    });
  });

  describe('ARIA Support', () => {
    test('should announce node focus', () => {
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeDefined();

      // Simulate node focus
      mockInteractionManager._emit('nodeFocus', { nodeId: 'node-1' });

      // Should have announcement text
      expect(liveRegion.textContent).toContain('Node 1');
      expect(liveRegion.textContent).toContain('level 1');
    });

    test('should announce expanded/collapsed state', () => {
      const liveRegion = container.querySelector('[aria-live="polite"]');
      
      // Mock expanded node
      mockTreeView.model.getNode = (nodeId) => ({
        getId: () => nodeId,
        getTitle: () => 'Expandable Node',
        getDepth: () => 0,
        getChildren: () => [{ getId: () => 'child' }],
        getState: () => ({ expanded: true })
      });

      mockInteractionManager._emit('nodeFocus', { nodeId: 'expandable-node' });

      expect(liveRegion.textContent).toContain('expanded');
    });

    test('should not announce when disabled', () => {
      // Create separate container for custom navigation
      const customContainer = document.createElement('div');
      document.body.appendChild(customContainer);
      
      const customTreeView = {
        ...mockTreeView,
        container: customContainer
      };
      
      const customInteractionManager = {
        ...mockInteractionManager,
        eventListeners: new Map()
      };
      
      // Create custom nav with announcements disabled
      const customNav = new KeyboardNavigation(customTreeView, customInteractionManager, {
        announceNavigation: false
      });

      const liveRegion = customContainer.querySelector('[aria-live="polite"]');
      
      // Simulate focus event on the custom interaction manager
      customInteractionManager._emit = (eventType, data) => {
        const listeners = customInteractionManager.eventListeners.get(eventType);
        if (listeners) {
          listeners.forEach(callback => callback(data));
        }
      };
      
      customInteractionManager._emit('nodeFocus', { nodeId: 'node-1' });

      // Should not have announcement
      expect(liveRegion.textContent).toBe('');

      customNav.destroy();
      if (customContainer.parentNode) {
        customContainer.parentNode.removeChild(customContainer);
      }
    });

    test('should clear announcements after delay', (done) => {
      const liveRegion = container.querySelector('[aria-live="polite"]');
      
      mockInteractionManager._emit('nodeFocus', { nodeId: 'node-1' });
      expect(liveRegion.textContent).toBeTruthy();

      // Check that it's cleared after delay
      setTimeout(() => {
        expect(liveRegion.textContent).toBe('');
        done();
      }, 1100); // Slightly longer than the 1000ms delay
    });
  });

  describe('Error Handling', () => {
    test('should handle missing tree model gracefully', () => {
      mockTreeView.model = null;

      expect(() => {
        mockInteractionManager._emit('keyboardNavigation', {
          key: 'ArrowLeft',
          nodeId: 'nonexistent-node',
          event: { key: 'ArrowLeft' }
        });
      }).not.toThrow();
    });

    test('should handle shortcut handler errors', () => {
      // Register shortcut that throws error
      keyboardNavigation.registerShortcut('Ctrl+E', 'Error shortcut', () => {
        throw new Error('Handler error');
      });

      // Should not throw when handler errors
      expect(() => {
        mockInteractionManager._emit('keyboardNavigation', {
          key: 'Ctrl+E',
          nodeId: 'current-node',
          event: { key: 'E', ctrlKey: true }
        });
      }).not.toThrow();
    });

    test('should handle destroyed state', () => {
      keyboardNavigation.destroy();

      expect(keyboardNavigation.registerShortcut('Ctrl+K', 'Test', () => {})).toBe(false);
      expect(keyboardNavigation.unregisterShortcut('Ctrl+K')).toBe(false);
      expect(keyboardNavigation.enableFocusTrap()).toBe(false);
      expect(keyboardNavigation.releaseFocusTrap()).toBe(false);
      expect(keyboardNavigation.getShortcuts()).toEqual([]);
    });
  });

  describe('Information', () => {
    test('should provide keyboard navigation info', () => {
      const info = keyboardNavigation.getInfo();
      
      expect(info.name).toBe('KeyboardNavigation');
      expect(info.version).toBeDefined();
      expect(typeof info.shortcutCount).toBe('number');
      expect(typeof info.focusHistory).toBe('number');
      expect(typeof info.focusTrapped).toBe('boolean');
      expect(info.options).toBeDefined();
      expect(info.destroyed).toBe(false);
    });
  });

  describe('Cleanup', () => {
    test('should clean up properly on destroy', () => {
      expect(keyboardNavigation.destroyed).toBe(false);

      keyboardNavigation.destroy();

      expect(keyboardNavigation.destroyed).toBe(true);
      expect(keyboardNavigation.treeView).toBeNull();
      expect(keyboardNavigation.interactionManager).toBeNull();
    });

    test('should remove ARIA live region on destroy', () => {
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeDefined();

      keyboardNavigation.destroy();

      const liveRegionAfter = container.querySelector('[aria-live="polite"]');
      expect(liveRegionAfter).toBeNull();
    });

    test('should unsubscribe from interaction manager on destroy', () => {
      const initialListenerCount = mockInteractionManager.eventListeners.get('keyboardNavigation')?.length || 0;
      expect(initialListenerCount).toBeGreaterThan(0);

      keyboardNavigation.destroy();

      const finalListenerCount = mockInteractionManager.eventListeners.get('keyboardNavigation')?.length || 0;
      expect(finalListenerCount).toBe(0);
    });

    test('should be safe to call destroy multiple times', () => {
      expect(() => {
        keyboardNavigation.destroy();
        keyboardNavigation.destroy();
        keyboardNavigation.destroy();
      }).not.toThrow();
    });
  });
});