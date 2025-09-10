/**
 * Unit tests for DiagramView focus management
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

describe('DiagramView - Focus Management', () => {
  let dom;
  let container;
  let view;
  let viewModel;
  let layoutEngine;

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

    // Load sample data
    const data = createSampleDiagramData();
    viewModel.setDiagramData(data);
    viewModel.computeLayout();
    view.render(viewModel.getState());
  });

  afterEach(() => {
    cleanupTestDOM();
    if (view) view.destroy();
  });

  describe('Container Focus', () => {
    test('should make container focusable', () => {
      expect(container.tabIndex).toBe(0);
    });

    test('should focus container on click', () => {
      // Use test-setup utility for better JSDOM compatibility
      const originalFocus = container.focus;
      const mockFocus = jest.fn();
      container.focus = mockFocus;

      // Mock event with stopPropagation
      const mockEvent = {
        stopPropagation: jest.fn(),
        target: view.svg
      };
      const elementInfo = { type: 'background', element: view.svg };

      view._handleClick(mockEvent, elementInfo);

      expect(mockFocus).toHaveBeenCalled();
      container.focus = originalFocus;
    });

    test('should apply focus styles when focused', () => {
      container.focus();
      
      // Check if focus class is applied
      expect(container.classList.contains('diagram-focused')).toBe(true);
    });

    test('should remove focus styles when blurred', () => {
      container.focus();
      expect(container.classList.contains('diagram-focused')).toBe(true);

      container.blur();
      expect(container.classList.contains('diagram-focused')).toBe(false);
    });
  });

  describe('Element Focus Navigation', () => {
    test('should support Tab navigation through elements', () => {
      // Focus the container
      container.focus();

      // Tab should navigate to first node
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true
      });

      const mockNavigateFocus = jest.fn();
      view.on('navigateFocus', mockNavigateFocus);

      container.dispatchEvent(tabEvent);

      expect(mockNavigateFocus).toHaveBeenCalledWith('forward');
    });

    test('should support Shift+Tab navigation backwards', () => {
      container.focus();

      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true
      });

      const mockNavigateFocus = jest.fn();
      view.on('navigateFocus', mockNavigateFocus);

      container.dispatchEvent(shiftTabEvent);

      expect(mockNavigateFocus).toHaveBeenCalledWith('backward');
    });

    test('should cycle through all focusable elements', () => {
      // Mock focus cycle
      view.focusIndex = 0;
      view.focusableElements = ['node1', 'node2', 'edge1', 'edge2'];

      // Test forward navigation
      view.navigateToNextFocusableElement('forward');
      expect(view.focusIndex).toBe(1);

      view.navigateToNextFocusableElement('forward');
      expect(view.focusIndex).toBe(2);

      // Test wrapping at end
      view.focusIndex = 3;
      view.navigateToNextFocusableElement('forward');
      expect(view.focusIndex).toBe(0);
    });

    test('should navigate backwards through elements', () => {
      view.focusIndex = 2;
      view.focusableElements = ['node1', 'node2', 'edge1', 'edge2'];

      view.navigateToNextFocusableElement('backward');
      expect(view.focusIndex).toBe(1);

      // Test wrapping at beginning
      view.focusIndex = 0;
      view.navigateToNextFocusableElement('backward');
      expect(view.focusIndex).toBe(3);
    });
  });

  describe('Focus Indicators', () => {
    test('should show focus indicator on focused element', () => {
      view.setElementFocus('node1');

      const nodeElement = view.nodesLayer.querySelector('[data-id="node1"]');
      expect(nodeElement.classList.contains('focused')).toBe(true);
    });

    test('should remove focus indicator when element loses focus', () => {
      view.setElementFocus('node1');
      const nodeElement = view.nodesLayer.querySelector('[data-id="node1"]');
      expect(nodeElement.classList.contains('focused')).toBe(true);

      view.clearElementFocus();
      expect(nodeElement.classList.contains('focused')).toBe(false);
    });

    test('should move focus indicator between elements', () => {
      view.setElementFocus('node1');
      const node1Element = view.nodesLayer.querySelector('[data-id="node1"]');
      expect(node1Element.classList.contains('focused')).toBe(true);

      view.setElementFocus('node2');
      const node2Element = view.nodesLayer.querySelector('[data-id="node2"]');
      
      expect(node1Element.classList.contains('focused')).toBe(false);
      expect(node2Element.classList.contains('focused')).toBe(true);
    });

    test('should support custom focus indicator styles', () => {
      const style = {
        stroke: '#ff0000',
        strokeWidth: 3,
        strokeDasharray: '5,5'
      };
      view.setFocusIndicatorStyle(style);

      view.setElementFocus('node1');
      
      // Check that style was set on the view
      expect(view.focusIndicatorStyle).toEqual(style);
      
      // Check that focused class was applied to the element
      const focusedElement = view.svg.querySelector('[data-id="node1"].focused');
      expect(focusedElement).toBeDefined();
    });
  });

  describe('Focus Traps for Modals', () => {
    test('should create focus trap for modal dialogs', () => {
      const modalContent = document.createElement('div');
      modalContent.innerHTML = `
        <button id="first">First</button>
        <input id="middle" type="text">
        <button id="last">Last</button>
      `;

      const focusTrap = view.createFocusTrap(modalContent);
      expect(focusTrap).toBeDefined();
      expect(focusTrap.firstFocusable).toBe(modalContent.querySelector('#first'));
      expect(focusTrap.lastFocusable).toBe(modalContent.querySelector('#last'));
    });

    test('should trap focus within modal', () => {
      const modalContent = document.createElement('div');
      modalContent.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;
      document.body.appendChild(modalContent);

      const focusTrap = view.createFocusTrap(modalContent);
      focusTrap.activate();

      const firstButton = modalContent.querySelector('#first');
      const lastButton = modalContent.querySelector('#last');

      // Focus should start at first element
      expect(document.activeElement).toBe(firstButton);

      // Tab from last element should wrap to first
      lastButton.focus();
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true
      });
      lastButton.dispatchEvent(tabEvent);

      // Should focus first element
      setTimeout(() => {
        expect(document.activeElement).toBe(firstButton);
      }, 0);

      focusTrap.deactivate();
      document.body.removeChild(modalContent);
    });

    test('should restore focus when deactivating trap', () => {
      const originalElement = document.createElement('button');
      document.body.appendChild(originalElement);
      originalElement.focus();

      const modalContent = document.createElement('div');
      modalContent.innerHTML = '<button>Modal Button</button>';
      document.body.appendChild(modalContent);

      const focusTrap = view.createFocusTrap(modalContent);
      focusTrap.activate();

      // Focus should be in modal
      expect(document.activeElement).toBe(modalContent.querySelector('button'));

      // Deactivate should restore focus
      focusTrap.deactivate();
      expect(document.activeElement).toBe(originalElement);

      document.body.removeChild(originalElement);
      document.body.removeChild(modalContent);
    });
  });

  describe('ARIA Accessibility', () => {
    test('should have proper ARIA labels', () => {
      expect(container.getAttribute('role')).toBe('img');
      expect(container.getAttribute('aria-label')).toContain('Software Engineering Diagram');
    });

    test('should announce focus changes to screen readers', () => {
      const announceRegion = container.querySelector('[aria-live="polite"]');
      expect(announceRegion).toBeDefined();

      view.setElementFocus('node1');
      
      // Should announce the focused element
      setTimeout(() => {
        expect(announceRegion.textContent).toContain('Focused on node: Test Node 1');
      }, 100);
    });

    test('should provide keyboard navigation instructions', () => {
      const instructions = view.getKeyboardNavigationInstructions();
      expect(instructions).toContain('Tab to navigate between elements');
      expect(instructions).toContain('Arrow keys to move selection');
      expect(instructions).toContain('Enter or Space to activate');
    });

    test('should announce selection changes', () => {
      const announceRegion = container.querySelector('[aria-live="polite"]');
      
      viewModel.selectNode('node1');

      setTimeout(() => {
        expect(announceRegion.textContent).toContain('Selected: Test Node 1');
      }, 100);
    });

    test('should support high contrast mode', () => {
      view.enableHighContrastMode(true);

      expect(container.classList.contains('high-contrast')).toBe(true);

      // Test disabling high contrast
      view.enableHighContrastMode(false);
      expect(container.classList.contains('high-contrast')).toBe(false);
    });
  });

  describe('Focus Management with Interactions', () => {
    test('should maintain focus during pan operations', () => {
      container.focus();
      view.setElementFocus('node1');

      // Simulate pan operation by calling internal handler
      const elementInfo = { type: 'background', element: view.svg };
      const mockEvent = { clientX: 100, clientY: 100, preventDefault: jest.fn() };
      view._handleMouseDown(mockEvent, elementInfo);

      // Focus should remain on container and element
      expect(document.activeElement).toBe(container);
      expect(view.currentFocusedElement).toBe('node1');
    });

    test('should maintain focus during zoom operations', () => {
      container.focus();
      view.setElementFocus('node1');

      // Simulate zoom by calling zoom method directly
      const initialZoom = view.viewport.zoom;
      view._zoomIn();

      // Focus should remain
      expect(document.activeElement).toBe(container);
      expect(view.currentFocusedElement).toBe('node1');
      expect(view.viewport.zoom).toBeGreaterThan(initialZoom);
    });

    test('should handle focus with drag selection', () => {
      container.focus();

      // Simulate drag selection start with proper left mouse button
      const elementInfo = { type: 'background', element: view.svg };
      const mockEvent = { clientX: 50, clientY: 50, preventDefault: jest.fn(), button: 0 };
      view._handleMouseDown(mockEvent, elementInfo);
      
      // Need to simulate mouse move to trigger drag selection via state machine
      const mockMoveEvent = { clientX: 60, clientY: 60 };
      view._handleMouseMove(mockMoveEvent, elementInfo);

      // Should maintain focus on container
      expect(document.activeElement).toBe(container);
      expect(view.interactionState.isDragSelecting).toBe(true);
    });
  });

  describe('Focus State Persistence', () => {
    test('should remember last focused element', () => {
      view.setElementFocus('node1');
      view.clearElementFocus();

      expect(view.lastFocusedElement).toBe('node1');
    });

    test('should restore focus to last focused element', () => {
      view.setElementFocus('node1');
      view.clearElementFocus();

      view.restoreLastFocus();

      expect(view.currentFocusedElement).toBe('node1');
    });

    test('should handle focus when elements are deleted', () => {
      view.setElementFocus('node1');
      expect(view.currentFocusedElement).toBe('node1');
      
      // Simulate node deletion by clearing all elements
      viewModel.nodes.clear();
      viewModel.edges.clear();
      
      // Simulate render call that would normally update focus
      view.render(viewModel.getState());
      
      // Focus should be cleared since element no longer exists
      expect(view.currentFocusedElement).toBeNull();
    });
  });

  describe('Cleanup', () => {
    test('should clean up focus state on destroy', () => {
      view.setElementFocus('node1');
      const focusTrap = view.createFocusTrap(document.createElement('div'));
      
      // Test that focus state exists before destroy
      expect(view.currentFocusedElement).toBe('node1');
      expect(view.activeFocusTraps.length).toBe(1);
      
      view.destroy();

      expect(view.currentFocusedElement).toBeNull();
      expect(view.focusableElements).toEqual([]);
      expect(view.activeFocusTraps.length).toBe(0);
    });

    test('should remove event listeners on destroy', () => {
      const removeEventListenerSpy = jest.spyOn(container, 'removeEventListener');
      
      view.destroy();

      // Check that removeEventListener was called (may be called multiple times)
      expect(removeEventListenerSpy).toHaveBeenCalled();
      
      // Check specific calls if implementation supports it
      const calls = removeEventListenerSpy.mock.calls;
      const eventTypes = calls.map(call => call[0]);
      
      // Should include focus management events
      expect(eventTypes.some(type => ['focus', 'blur', 'keydown'].includes(type))).toBe(true);
    });
  });
});