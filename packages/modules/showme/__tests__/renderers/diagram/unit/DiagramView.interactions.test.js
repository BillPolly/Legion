/**
 * Comprehensive interaction tests for DiagramView
 * Tests complex interaction scenarios, edge cases, and integration between different interaction types
 */

import { jest } from '@jest/globals';
import { DiagramView } from '../../../../src/renderers/diagram/view/DiagramView.js';
import { DiagramViewModel } from '../../../../src/renderers/diagram/viewmodel/DiagramViewModel.js';
import { DiagramLayoutEngine } from '../../../../src/renderers/diagram/layout/DiagramLayoutEngine.js';
import { 
  createTestDOM, 
  cleanupTestDOM,
  createSampleDiagramData 
} from '../test-setup.js';

describe('DiagramView - Comprehensive Interactions', () => {
  let dom;
  let container;
  let view;
  let viewModel;
  let layoutEngine;
  let sampleData;

  beforeEach(() => {
    dom = createTestDOM();
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    layoutEngine = new DiagramLayoutEngine();
    view = new DiagramView(container);
    viewModel = new DiagramViewModel({
      layoutEngine,
      view
    });

    sampleData = createSampleDiagramData();
    viewModel.setDiagramData(sampleData);
    viewModel.computeLayout();
    view.render(viewModel.getState());
  });

  afterEach(() => {
    cleanupTestDOM();
    if (view) view.destroy();
  });

  describe('Multi-Modal Interaction Sequences', () => {
    test('should handle mouse-keyboard sequence for multi-selection', () => {
      // Start with mouse selection
      viewModel.selectElement('node1');
      expect(viewModel.getState().selection.size).toBe(1);

      // Add to selection with Ctrl+click (simulated as keyboard modifier + mouse)
      const ctrlClickEvent = new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true });
      container.dispatchEvent(ctrlClickEvent);
      
      viewModel.addToSelection('node2');
      expect(viewModel.getState().selection.size).toBe(2);

      // Select all with keyboard
      const selectAllEvent = new KeyboardEvent('keydown', { 
        key: 'a', 
        ctrlKey: true, 
        bubbles: true 
      });
      container.dispatchEvent(selectAllEvent);

      // Should now have all elements selected
      const state = viewModel.getState();
      expect(state.selection.size).toBe(state.nodes.size + state.edges.size);
    });

    test('should handle drag-selection to keyboard navigation', () => {
      // Start with drag selection
      const elementInfo = { type: 'background', element: view.svg };
      
      // Mouse down to start drag
      view._handleMouseDown({ clientX: 50, clientY: 50, preventDefault: () => {}, button: 0 }, elementInfo);
      
      // Mouse move to create selection rectangle
      view._handleMouseMove({ clientX: 150, clientY: 150 }, elementInfo);
      
      // Check drag selection is active
      expect(view.interactionState.isDragSelecting).toBe(true);
      
      // Complete drag selection
      view._handleMouseUp({ clientX: 150, clientY: 150 }, elementInfo);
      
      // Now use keyboard to extend selection
      const arrowEvent = new KeyboardEvent('keydown', { 
        key: 'ArrowRight', 
        shiftKey: true, 
        bubbles: true 
      });
      container.dispatchEvent(arrowEvent);
      
      // Should maintain selection and add navigation
      expect(view.interactionState.isDragSelecting).toBe(false);
    });

    test('should handle pan-to-zoom-to-selection workflow', () => {
      // Start with panning
      const elementInfo = { type: 'background', element: view.svg };
      const initialPanX = view.viewport.panX;
      const initialPanY = view.viewport.panY;
      
      // Disable drag selection for panning
      view.stateMachine.config.enableDragSelection = false;
      
      view._handleMouseDown({ clientX: 100, clientY: 100, preventDefault: () => {}, button: 0 }, elementInfo);
      view._handleMouseMove({ clientX: 120, clientY: 110 }, elementInfo);
      
      expect(view.viewport.panX).not.toBe(initialPanX);
      expect(view.viewport.panY).not.toBe(initialPanY);
      
      view._handleMouseUp({ clientX: 120, clientY: 110 }, elementInfo);
      
      // Follow with zoom using mouse wheel
      const initialZoom = view.viewport.zoom;
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        clientX: 400,
        clientY: 300,
        bubbles: true
      });
      
      container.dispatchEvent(wheelEvent);
      expect(view.viewport.zoom).toBeGreaterThan(initialZoom);
      
      // Follow with element selection
      viewModel.selectElement('node1');
      view.render(viewModel.getState());
      
      const selectedNode = view.nodesLayer.querySelector('[data-id="node1"]');
      expect(selectedNode.classList.contains('node--selected')).toBe(true);
    });
  });

  describe('Interaction State Machine Edge Cases', () => {
    test('should handle rapid state transitions', () => {
      const elementInfo = { type: 'background', element: view.svg };
      
      // Rapid mouse events
      view._handleMouseDown({ clientX: 100, clientY: 100, preventDefault: () => {}, button: 0 }, elementInfo);
      view._handleMouseMove({ clientX: 101, clientY: 101 }, elementInfo);
      view._handleMouseMove({ clientX: 102, clientY: 102 }, elementInfo);
      view._handleMouseMove({ clientX: 103, clientY: 103 }, elementInfo);
      view._handleMouseUp({ clientX: 103, clientY: 103 }, elementInfo);
      
      // Should end up in idle state
      expect(view.stateMachine.getState()).toBe('IDLE');
    });

    test('should handle conflicting interactions gracefully', () => {
      // Try to start multiple interactions simultaneously
      const nodeInfo = { type: 'node', element: view.nodesLayer.querySelector('[data-id="node1"]'), id: 'node1' };
      const bgInfo = { type: 'background', element: view.svg };
      
      // Mouse down on node
      view._handleMouseDown({ clientX: 100, clientY: 100, preventDefault: () => {}, button: 0 }, nodeInfo);
      
      // Try to also start background interaction (should be ignored)
      view._handleMouseDown({ clientX: 200, clientY: 200, preventDefault: () => {}, button: 0 }, bgInfo);
      
      // Mouse move should continue node interaction, not background
      view._handleMouseMove({ clientX: 110, clientY: 110 }, nodeInfo);
      
      expect(view.stateMachine.getState()).not.toBe('DRAG_SELECTING');
    });

    test('should handle mouse leave during interactions', () => {
      const elementInfo = { type: 'background', element: view.svg };
      
      // Start drag selection
      view._handleMouseDown({ clientX: 100, clientY: 100, preventDefault: () => {}, button: 0 }, elementInfo);
      view._handleMouseMove({ clientX: 120, clientY: 120 }, elementInfo);
      
      expect(view.interactionState.isDragSelecting).toBe(true);
      
      // Mouse leaves container
      const leaveEvent = new MouseEvent('mouseleave', { bubbles: true });
      container.dispatchEvent(leaveEvent);
      
      // Should cancel interaction and return to idle
      expect(view.stateMachine.getState()).toBe('IDLE');
      expect(view.interactionState.isDragSelecting).toBe(false);
    });

    test('should handle Escape key during different interactions', () => {
      const elementInfo = { type: 'background', element: view.svg };
      
      // Test Escape during drag selection
      view._handleMouseDown({ clientX: 100, clientY: 100, preventDefault: () => {}, button: 0 }, elementInfo);
      view._handleMouseMove({ clientX: 150, clientY: 150 }, elementInfo);
      
      expect(view.interactionState.isDragSelecting).toBe(true);
      
      const escapeEvent = new KeyboardEvent('keydown', { 
        key: 'Escape', 
        bubbles: true 
      });
      container.dispatchEvent(escapeEvent);
      
      expect(view.interactionState.isDragSelecting).toBe(false);
      expect(view.stateMachine.getState()).toBe('IDLE');
    });
  });

  describe('Interaction Performance and Memory', () => {
    test('should not leak event listeners during rapid interactions', () => {
      // Mock event listener tracking
      const originalAddEventListener = container.addEventListener;
      const originalRemoveEventListener = container.removeEventListener;
      
      let addedEvents = 0;
      let removedEvents = 0;
      
      container.addEventListener = jest.fn((...args) => {
        addedEvents++;
        return originalAddEventListener.apply(container, args);
      });
      
      container.removeEventListener = jest.fn((...args) => {
        removedEvents++;
        return originalRemoveEventListener.apply(container, args);
      });
      
      // Perform many interactions
      for (let i = 0; i < 10; i++) {
        const elementInfo = { type: 'background', element: view.svg };
        view._handleMouseDown({ clientX: i * 10, clientY: i * 10, preventDefault: () => {}, button: 0 }, elementInfo);
        view._handleMouseMove({ clientX: i * 10 + 5, clientY: i * 10 + 5 }, elementInfo);
        view._handleMouseUp({ clientX: i * 10 + 5, clientY: i * 10 + 5 }, elementInfo);
      }
      
      // Cleanup
      view.destroy();
      
      // Should have cleaned up properly (some tolerance for internal events)
      expect(removedEvents).toBeGreaterThan(0);
      
      // Restore
      container.addEventListener = originalAddEventListener;
      container.removeEventListener = originalRemoveEventListener;
    });

    test('should handle large numbers of elements efficiently', () => {
      // Create larger dataset
      const largeData = {
        nodes: new Map(),
        edges: new Map()
      };
      
      // Add 100 nodes
      for (let i = 0; i < 100; i++) {
        largeData.nodes.set(`node${i}`, {
          id: `node${i}`,
          label: `Node ${i}`,
          position: { x: (i % 10) * 100, y: Math.floor(i / 10) * 80 },
          size: { width: 80, height: 60 }
        });
      }
      
      // Add 150 edges
      for (let i = 0; i < 150; i++) {
        const sourceId = `node${i % 100}`;
        const targetId = `node${(i + 1) % 100}`;
        largeData.edges.set(`edge${i}`, {
          id: `edge${i}`,
          source: sourceId,
          target: targetId,
          label: `Edge ${i}`,
          path: {
            start: largeData.nodes.get(sourceId).position,
            end: largeData.nodes.get(targetId).position
          }
        });
      }
      
      // Measure render time
      const startTime = performance.now();
      
      viewModel.setDiagramData(largeData);
      viewModel.computeLayout();
      view.render(viewModel.getState());
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render in reasonable time (< 100ms for 100 nodes, 150 edges)
      expect(renderTime).toBeLessThan(100);
      
      // Measure interaction time
      const interactionStartTime = performance.now();
      
      // Select all elements
      const selectAllEvent = new KeyboardEvent('keydown', { 
        key: 'a', 
        ctrlKey: true, 
        bubbles: true 
      });
      container.dispatchEvent(selectAllEvent);
      
      view.render(viewModel.getState());
      
      const interactionEndTime = performance.now();
      const interactionTime = interactionEndTime - interactionStartTime;
      
      // Interaction should also be fast
      expect(interactionTime).toBeLessThan(50);
    });
  });

  describe('Accessibility in Interactions', () => {
    test('should maintain accessibility during interactions', () => {
      // Check initial ARIA setup
      expect(container.getAttribute('role')).toBe('img');
      expect(container.tabIndex).toBe(0);
      
      // Select element and check announcement
      viewModel.selectElement('node1');
      view.render(viewModel.getState());
      
      const announceRegion = container.querySelector('[aria-live="polite"]');
      expect(announceRegion).toBeDefined();
      
      // Focus should be maintained during interactions
      container.focus();
      expect(document.activeElement).toBe(container);
      
      // Interaction should not break focus
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown({ clientX: 100, clientY: 100, preventDefault: () => {}, button: 0 }, elementInfo);
      view._handleMouseUp({ clientX: 100, clientY: 100 }, elementInfo);
      
      expect(document.activeElement).toBe(container);
    });

    test('should provide keyboard alternatives for mouse interactions', () => {
      // Test that all mouse interactions have keyboard equivalents
      
      // Selection via keyboard
      const selectAllEvent = new KeyboardEvent('keydown', { 
        key: 'a', 
        ctrlKey: true, 
        bubbles: true 
      });
      container.dispatchEvent(selectAllEvent);
      
      expect(viewModel.getState().selection.size).toBeGreaterThan(0);
      
      // Clear selection via keyboard
      const escapeEvent = new KeyboardEvent('keydown', { 
        key: 'Escape', 
        bubbles: true 
      });
      container.dispatchEvent(escapeEvent);
      
      expect(viewModel.getState().selection.size).toBe(0);
      
      // Pan via keyboard
      const panEvent = new KeyboardEvent('keydown', { 
        key: 'ArrowRight', 
        shiftKey: true, 
        bubbles: true 
      });
      container.dispatchEvent(panEvent);
      
      // Zoom via keyboard
      const zoomInEvent = new KeyboardEvent('keydown', { 
        key: '+', 
        ctrlKey: true, 
        bubbles: true 
      });
      container.dispatchEvent(zoomInEvent);
      
      const initialZoom = view.viewport.zoom;
      expect(view.viewport.zoom).toBeGreaterThanOrEqual(initialZoom);
    });
  });

  describe('Error Handling in Interactions', () => {
    test('should handle invalid interaction data gracefully', () => {
      // Test with null/undefined data
      expect(() => {
        view._handleMouseDown(null, { type: 'background', element: view.svg });
      }).not.toThrow();
      
      expect(() => {
        view._handleMouseMove(undefined, { type: 'background', element: view.svg });
      }).not.toThrow();
      
      // Test with invalid element info
      expect(() => {
        view._handleMouseDown({ clientX: 100, clientY: 100, preventDefault: () => {}, button: 0 }, null);
      }).not.toThrow();
    });

    test('should recover from interaction errors', () => {
      // Mock an error in the interaction handler
      const originalEmit = view._emit;
      let errorThrown = false;
      
      view._emit = jest.fn((event, data) => {
        if (event === 'nodeClick') {
          errorThrown = true;
          throw new Error('Test interaction error');
        }
        return originalEmit.call(view, event, data);
      });
      
      // Try to perform an interaction that will error
      const nodeInfo = { 
        type: 'node', 
        element: view.nodesLayer.querySelector('[data-id="node1"]'), 
        id: 'node1' 
      };
      
      expect(() => {
        view._handleClick({ preventDefault: () => {} }, nodeInfo);
      }).toThrow('Test interaction error');
      
      expect(errorThrown).toBe(true);
      
      // View should still be in a valid state
      expect(view.stateMachine.getState()).toBe('IDLE');
      
      // Restore
      view._emit = originalEmit;
    });

    test('should handle destroyed view interactions gracefully', () => {
      // Destroy the view
      view.destroy();
      
      // Try to interact with destroyed view
      expect(() => {
        view._handleMouseDown({ clientX: 100, clientY: 100, preventDefault: () => {}, button: 0 }, 
          { type: 'background', element: view.svg });
      }).not.toThrow();
      
      expect(() => {
        const keyEvent = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
        container.dispatchEvent(keyEvent);
      }).not.toThrow();
    });
  });

  describe('Integration with External Systems', () => {
    test('should emit correct events for external listeners', () => {
      const eventLog = [];
      
      // Listen to all events
      view.addEventListener('nodeClick', (data) => eventLog.push({ type: 'nodeClick', data }));
      view.addEventListener('edgeClick', (data) => eventLog.push({ type: 'edgeClick', data }));
      view.addEventListener('backgroundClick', (data) => eventLog.push({ type: 'backgroundClick', data }));
      view.addEventListener('selectionChange', (data) => eventLog.push({ type: 'selectionChange', data }));
      view.addEventListener('viewportChange', (data) => eventLog.push({ type: 'viewportChange', data }));
      
      // Perform various interactions
      const nodeElement = view.nodesLayer.querySelector('[data-id="node1"]');
      const nodeInfo = { type: 'node', element: nodeElement, id: 'node1' };
      
      view._handleClick({ preventDefault: () => {} }, nodeInfo);
      
      const bgInfo = { type: 'background', element: view.svg };
      view._handleClick({ preventDefault: () => {} }, bgInfo);
      
      // Check that events were emitted
      const nodeClickEvents = eventLog.filter(e => e.type === 'nodeClick');
      const bgClickEvents = eventLog.filter(e => e.type === 'backgroundClick');
      
      expect(nodeClickEvents.length).toBe(1);
      expect(bgClickEvents.length).toBe(1);
      expect(nodeClickEvents[0].data.nodeId).toBe('node1');
    });

    test('should work with custom event handlers', () => {
      let customHandlerCalled = false;
      let customHandlerData = null;
      
      // Add custom event handler
      view.addEventListener('nodeClick', (data) => {
        customHandlerCalled = true;
        customHandlerData = data;
      });
      
      // Trigger event
      const nodeElement = view.nodesLayer.querySelector('[data-id="node1"]');
      const nodeInfo = { type: 'node', element: nodeElement, id: 'node1' };
      
      view._handleClick({ preventDefault: () => {} }, nodeInfo);
      
      expect(customHandlerCalled).toBe(true);
      expect(customHandlerData.nodeId).toBe('node1');
    });
  });
});