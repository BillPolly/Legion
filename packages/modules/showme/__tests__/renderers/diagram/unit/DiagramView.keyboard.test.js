/**
 * Unit tests for DiagramView keyboard shortcuts
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

describe('DiagramView - Keyboard Shortcuts', () => {
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
    container.tabIndex = 0; // Make focusable
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

    // Focus container for keyboard tests
    container.focus();
  });

  afterEach(() => {
    cleanupTestDOM();
    if (view) view.destroy();
  });

  describe('Select All (Ctrl/Cmd+A)', () => {
    test('should select all elements with Ctrl+A', () => {
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true
      });

      container.dispatchEvent(keyboardEvent);

      const selection = viewModel.selection;
      expect(selection.size).toBe(5); // 3 nodes + 2 edges
      expect(selection.has('node1')).toBe(true);
      expect(selection.has('node2')).toBe(true);
      expect(selection.has('node3')).toBe(true);
      expect(selection.has('edge1')).toBe(true);
      expect(selection.has('edge2')).toBe(true);
    });

    test('should select all elements with Cmd+A on Mac', () => {
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'a',
        metaKey: true,
        bubbles: true
      });

      container.dispatchEvent(keyboardEvent);

      const selection = viewModel.selection;
      expect(selection.size).toBe(5);
    });

    test('should prevent default browser behavior', () => {
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      });

      const preventDefaultSpy = jest.spyOn(keyboardEvent, 'preventDefault');
      container.dispatchEvent(keyboardEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Clear Selection (Escape)', () => {
    test('should clear selection with Escape key', () => {
      // First select some elements
      viewModel.selectMultiple(['node1', 'edge1']);
      expect(viewModel.selection.size).toBe(2);

      // Press Escape
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });

      container.dispatchEvent(keyboardEvent);

      expect(viewModel.selection.size).toBe(0);
    });

    test('should clear hover state with Escape key', () => {
      // Set hover state
      viewModel.setHoveredElement('node1');
      expect(viewModel.getHoverInfo()).toBeDefined();

      // Press Escape
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });

      container.dispatchEvent(keyboardEvent);

      expect(viewModel.getHoverInfo()).toBeNull();
    });
  });

  describe('Delete Selected (Delete/Backspace)', () => {
    test('should delete selected elements with Delete key', () => {
      // Select elements
      viewModel.selectMultiple(['node1', 'edge1']);

      // Press Delete
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true
      });

      const deleteEventFired = jest.fn();
      view.on('deleteSelection', deleteEventFired);

      container.dispatchEvent(keyboardEvent);

      expect(deleteEventFired).toHaveBeenCalled();
    });

    test('should delete selected elements with Backspace key', () => {
      // Select elements
      viewModel.selectMultiple(['node2']);

      // Press Backspace
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true
      });

      const deleteEventFired = jest.fn();
      view.on('deleteSelection', deleteEventFired);

      container.dispatchEvent(keyboardEvent);

      expect(deleteEventFired).toHaveBeenCalled();
    });

    test('should not fire delete when nothing selected', () => {
      // No selection
      viewModel.clearSelection();

      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true
      });

      const deleteEventFired = jest.fn();
      view.on('deleteSelection', deleteEventFired);

      container.dispatchEvent(keyboardEvent);

      expect(deleteEventFired).not.toHaveBeenCalled();
    });
  });

  describe('Copy/Cut/Paste (Ctrl/Cmd+C/X/V)', () => {
    test('should copy selection with Ctrl+C', () => {
      viewModel.selectMultiple(['node1', 'edge1']);

      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true
      });

      const copyEventFired = jest.fn();
      view.on('copySelection', copyEventFired);

      container.dispatchEvent(keyboardEvent);

      expect(copyEventFired).toHaveBeenCalled();
    });

    test('should cut selection with Ctrl+X', () => {
      viewModel.selectMultiple(['node2']);

      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'x',
        ctrlKey: true,
        bubbles: true
      });

      const cutEventFired = jest.fn();
      view.on('cutSelection', cutEventFired);

      container.dispatchEvent(keyboardEvent);

      expect(cutEventFired).toHaveBeenCalled();
    });

    test('should paste with Ctrl+V', () => {
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'v',
        ctrlKey: true,
        bubbles: true
      });

      const pasteEventFired = jest.fn();
      view.on('paste', pasteEventFired);

      container.dispatchEvent(keyboardEvent);

      expect(pasteEventFired).toHaveBeenCalled();
    });
  });

  describe('Undo/Redo (Ctrl/Cmd+Z/Y)', () => {
    test('should trigger undo with Ctrl+Z', () => {
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true
      });

      const undoEventFired = jest.fn();
      view.on('undo', undoEventFired);

      container.dispatchEvent(keyboardEvent);

      expect(undoEventFired).toHaveBeenCalled();
    });

    test('should trigger redo with Ctrl+Y', () => {
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'y',
        ctrlKey: true,
        bubbles: true
      });

      const redoEventFired = jest.fn();
      view.on('redo', redoEventFired);

      container.dispatchEvent(keyboardEvent);

      expect(redoEventFired).toHaveBeenCalled();
    });

    test('should trigger redo with Ctrl+Shift+Z', () => {
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true
      });

      const redoEventFired = jest.fn();
      view.on('redo', redoEventFired);

      container.dispatchEvent(keyboardEvent);

      expect(redoEventFired).toHaveBeenCalled();
    });
  });

  describe('Navigation (Arrow Keys)', () => {
    test('should move selection with arrow keys', () => {
      // Select initial node
      viewModel.selectNode('node1');

      // Press right arrow
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true
      });

      const navigateEventFired = jest.fn();
      view.on('navigateSelection', navigateEventFired);

      container.dispatchEvent(keyboardEvent);

      expect(navigateEventFired).toHaveBeenCalledWith('right');
    });

    test('should pan viewport with arrow keys when holding Shift', () => {
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        shiftKey: true,
        bubbles: true
      });

      const initialPan = { ...view.viewport };
      container.dispatchEvent(keyboardEvent);

      // Viewport should have changed
      expect(view.viewport.panX).not.toBe(initialPan.panX);
    });
  });

  describe('Zoom (Ctrl/Cmd +/-/0)', () => {
    test('should zoom in with Ctrl+Plus', () => {
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: '+',
        ctrlKey: true,
        bubbles: true
      });

      const initialZoom = view.viewport.zoom;
      container.dispatchEvent(keyboardEvent);

      expect(view.viewport.zoom).toBeGreaterThan(initialZoom);
    });

    test('should zoom out with Ctrl+Minus', () => {
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: '-',
        ctrlKey: true,
        bubbles: true
      });

      const initialZoom = view.viewport.zoom;
      container.dispatchEvent(keyboardEvent);

      expect(view.viewport.zoom).toBeLessThan(initialZoom);
    });

    test('should reset zoom with Ctrl+0', () => {
      // First change zoom
      view.viewport.zoom = 2.5;

      const keyboardEvent = new KeyboardEvent('keydown', {
        key: '0',
        ctrlKey: true,
        bubbles: true
      });

      container.dispatchEvent(keyboardEvent);

      expect(view.viewport.zoom).toBe(1);
    });

    test('should fit to viewport with Ctrl+Shift+0', () => {
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: '0',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true
      });

      const zoomToFitSpy = jest.spyOn(view, 'zoomToFit');
      container.dispatchEvent(keyboardEvent);

      expect(zoomToFitSpy).toHaveBeenCalled();
    });
  });

  describe('Focus Management', () => {
    test('should only respond to shortcuts when focused', () => {
      // Remove focus
      container.blur();

      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true
      });

      const initialSelection = viewModel.selection.size;
      container.dispatchEvent(keyboardEvent);

      // Should not change selection when not focused
      expect(viewModel.selection.size).toBe(initialSelection);
    });

    test('should focus container on click', () => {
      // Make sure container is not currently focused
      if (document.activeElement === container) {
        container.blur();
      }
      
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
  });

  describe('Shortcut Customization', () => {
    test('should allow custom keyboard shortcuts', () => {
      // Register custom shortcut
      view.registerShortcut('ctrl+shift+d', () => {
        viewModel.duplicateSelection();
      });

      // Select an element
      viewModel.selectNode('node1');

      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true
      });

      const duplicateEventFired = jest.fn();
      viewModel.on('duplicateSelection', duplicateEventFired);

      container.dispatchEvent(keyboardEvent);

      expect(duplicateEventFired).toHaveBeenCalled();
    });

    test('should allow disabling default shortcuts', () => {
      // Disable select all
      view.disableShortcut('ctrl+a');

      const keyboardEvent = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true
      });

      const initialSelection = viewModel.selection.size;
      container.dispatchEvent(keyboardEvent);

      // Should not change selection
      expect(viewModel.selection.size).toBe(initialSelection);
    });
  });

  describe('Accessibility', () => {
    test('should provide keyboard shortcut help', () => {
      const shortcuts = view.getKeyboardShortcuts();

      expect(shortcuts).toContainEqual({
        key: 'ctrl+a',
        description: 'Select all elements',
        category: 'Selection'
      });

      expect(shortcuts).toContainEqual({
        key: 'escape',
        description: 'Clear selection',
        category: 'Selection'
      });

      expect(shortcuts).toContainEqual({
        key: 'delete',
        description: 'Delete selected elements',
        category: 'Edit'
      });
    });

    test('should show shortcuts dialog with ? key', () => {
      const keyboardEvent = new KeyboardEvent('keydown', {
        key: '?',
        bubbles: true
      });

      const showHelpEventFired = jest.fn();
      view.on('showKeyboardHelp', showHelpEventFired);

      container.dispatchEvent(keyboardEvent);

      expect(showHelpEventFired).toHaveBeenCalled();
    });
  });
});