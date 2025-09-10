/**
 * Unit tests for DiagramView drag selection rectangle
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

describe('DiagramView - Drag Selection Rectangle', () => {
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
    container.tabIndex = 0;
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

  describe('Drag Selection Initiation', () => {
    test('should start drag selection on background mousedown', () => {
      const mockEvent = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        button: 0 // Left mouse button
      };
      const elementInfo = { type: 'background', element: view.svg };

      view._handleMouseDown(mockEvent, elementInfo);

      expect(view.interactionState.isDragSelecting).toBe(false); // Not selecting yet
      expect(view.interactionState.dragSelectionStart).toBeNull();
      expect(view.interactionState.potentialDragStart).toEqual({ x: 100, y: 100 });
    });

    test('should not start drag selection on node mousedown', () => {
      const mockEvent = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'node', id: 'node1', element: view.svg };

      view._handleMouseDown(mockEvent, elementInfo);

      expect(view.interactionState.isDragSelecting).toBe(false);
      expect(view.interactionState.dragSelectionStart).toBeNull();
    });

    test('should not start drag selection with right mouse button', () => {
      const mockEvent = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        button: 2 // Right mouse button
      };
      const elementInfo = { type: 'background', element: view.svg };

      view._handleMouseDown(mockEvent, elementInfo);

      expect(view.interactionState.isDragSelecting).toBe(false);
    });
  });

  describe('Drag Selection Rectangle Creation', () => {
    test('should create selection rectangle on mouse move after background mousedown', () => {
      // Start drag
      const startEvent = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      // Move mouse to start selection
      const moveEvent = {
        clientX: 150,
        clientY: 150,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      expect(view.interactionState.isDragSelecting).toBe(true);
      expect(view.interactionState.dragSelectionStart).toEqual({ x: 100, y: 100 });
      expect(view.interactionState.dragSelectionCurrent).toEqual({ x: 150, y: 150 });
    });

    test('should create visual selection rectangle element', () => {
      // Start drag selection
      const startEvent = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 150,
        clientY: 150,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      const selectionRect = view.overlayLayer.querySelector('.drag-selection-rect');
      expect(selectionRect).toBeDefined();
      expect(selectionRect.tagName.toLowerCase()).toBe('rect');
    });

    test('should update rectangle dimensions during drag', () => {
      // Start drag selection
      const startEvent = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      // First move
      const moveEvent1 = {
        clientX: 150,
        clientY: 150,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent1, elementInfo);

      const rect1 = view.overlayLayer.querySelector('.drag-selection-rect');
      expect(rect1.getAttribute('x')).toBe('100');
      expect(rect1.getAttribute('y')).toBe('100');
      expect(rect1.getAttribute('width')).toBe('50');
      expect(rect1.getAttribute('height')).toBe('50');

      // Second move
      const moveEvent2 = {
        clientX: 80,
        clientY: 80,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent2, elementInfo);

      const rect2 = view.overlayLayer.querySelector('.drag-selection-rect');
      expect(rect2.getAttribute('x')).toBe('80');
      expect(rect2.getAttribute('y')).toBe('80');
      expect(rect2.getAttribute('width')).toBe('20');
      expect(rect2.getAttribute('height')).toBe('20');
    });

    test('should handle negative width/height correctly', () => {
      // Start at (150, 150) and drag to (100, 100)
      const startEvent = {
        clientX: 150,
        clientY: 150,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      const rect = view.overlayLayer.querySelector('.drag-selection-rect');
      // Rectangle should be positioned at the top-left corner
      expect(rect.getAttribute('x')).toBe('100');
      expect(rect.getAttribute('y')).toBe('100');
      expect(rect.getAttribute('width')).toBe('50');
      expect(rect.getAttribute('height')).toBe('50');
    });
  });

  describe('Element Selection During Drag', () => {
    test('should preview selection during drag', () => {
      // Start drag selection
      const startEvent = {
        clientX: 50,
        clientY: 50,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      // Drag to encompass node1 (assuming it's positioned around 100,100)
      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      // Check if elements have preview selection styling
      const previewSelectedElements = view.svg.querySelectorAll('.preview-selected');
      expect(previewSelectedElements.length).toBeGreaterThan(0);
    });

    test('should update preview selection as drag area changes', () => {
      // Start drag selection
      const startEvent = {
        clientX: 50,
        clientY: 50,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      // Small drag area - no elements
      const moveEvent1 = {
        clientX: 60,
        clientY: 60,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent1, elementInfo);

      const preview1 = view.svg.querySelectorAll('.preview-selected');
      const initialCount = preview1.length;

      // Large drag area - include elements
      const moveEvent2 = {
        clientX: 300,
        clientY: 300,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent2, elementInfo);

      const preview2 = view.svg.querySelectorAll('.preview-selected');
      expect(preview2.length).toBeGreaterThanOrEqual(initialCount);
    });

    test('should not preview select already selected elements', () => {
      // Pre-select node1
      viewModel.selectNode('node1');
      view.render(viewModel.getState());

      // Start drag selection
      const startEvent = {
        clientX: 50,
        clientY: 50,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      // node1 should still have 'selected' class, not 'preview-selected'
      const node1Element = view.nodesLayer.querySelector('[data-id="node1"]');
      expect(node1Element.classList.contains('selected')).toBe(true);
      expect(node1Element.classList.contains('preview-selected')).toBe(false);
    });
  });

  describe('Drag Selection Completion', () => {
    test('should finalize selection on mouse up', () => {
      // Start drag selection
      const startEvent = {
        clientX: 50,
        clientY: 50,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      // End selection
      const upEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn(),
        button: 0
      };
      view._handleMouseUp(upEvent, elementInfo);

      expect(view.interactionState.isDragSelecting).toBe(false);
      expect(view.interactionState.dragSelectionStart).toBeNull();
      expect(view.interactionState.dragSelectionCurrent).toBeNull();
    });

    test('should remove selection rectangle on mouse up', () => {
      // Start and complete drag selection
      const startEvent = {
        clientX: 50,
        clientY: 50,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      // Rectangle should exist during drag
      let selectionRect = view.overlayLayer.querySelector('.drag-selection-rect');
      expect(selectionRect).toBeDefined();

      const upEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn(),
        button: 0
      };
      view._handleMouseUp(upEvent, elementInfo);

      // Rectangle should be removed after drag
      selectionRect = view.overlayLayer.querySelector('.drag-selection-rect');
      expect(selectionRect).toBeNull();
    });

    test('should clear preview selection styling on completion', () => {
      // Perform complete drag selection
      const startEvent = {
        clientX: 50,
        clientY: 50,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      const upEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn(),
        button: 0
      };
      view._handleMouseUp(upEvent, elementInfo);

      // No elements should have preview selection styling
      const previewSelected = view.svg.querySelectorAll('.preview-selected');
      expect(previewSelected.length).toBe(0);
    });

    test('should emit drag selection event with selected elements', () => {
      const dragSelectionEventFired = jest.fn();
      view.on('dragSelection', dragSelectionEventFired);

      // Perform drag selection
      const startEvent = {
        clientX: 50,
        clientY: 50,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      const upEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn(),
        button: 0
      };
      view._handleMouseUp(upEvent, elementInfo);

      expect(dragSelectionEventFired).toHaveBeenCalled();
      const eventArgs = dragSelectionEventFired.mock.calls[0];
      expect(eventArgs[0]).toEqual(expect.objectContaining({
        startX: 50,
        startY: 50,
        endX: 200,
        endY: 200,
        selectedElements: expect.any(Array)
      }));
    });
  });

  describe('Drag Selection with Modifiers', () => {
    test('should add to existing selection with Ctrl key', () => {
      // Pre-select node1
      viewModel.selectNode('node1');
      view.render(viewModel.getState());

      // Drag select with Ctrl key held
      const startEvent = {
        clientX: 250,
        clientY: 250,
        preventDefault: jest.fn(),
        button: 0,
        ctrlKey: true
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 350,
        clientY: 350,
        preventDefault: jest.fn(),
        ctrlKey: true
      };
      view._handleMouseMove(moveEvent, elementInfo);

      const upEvent = {
        clientX: 350,
        clientY: 350,
        preventDefault: jest.fn(),
        button: 0,
        ctrlKey: true
      };
      view._handleMouseUp(upEvent, elementInfo);

      // Should maintain existing selection plus new elements
      const selection = viewModel.selection;
      expect(selection.has('node1')).toBe(true);
    });

    test('should toggle selection with Alt key', () => {
      // Pre-select node1
      viewModel.selectNode('node1');
      view.render(viewModel.getState());

      // Drag select over node1 with Alt key
      const startEvent = {
        clientX: 80,
        clientY: 80,
        preventDefault: jest.fn(),
        button: 0,
        altKey: true
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 120,
        clientY: 120,
        preventDefault: jest.fn(),
        altKey: true
      };
      view._handleMouseMove(moveEvent, elementInfo);

      const upEvent = {
        clientX: 120,
        clientY: 120,
        preventDefault: jest.fn(),
        button: 0,
        altKey: true
      };
      view._handleMouseUp(upEvent, elementInfo);

      // node1 should be deselected if it was in the drag area
      const selection = viewModel.selection;
      expect(selection.has('node1')).toBe(false);
    });
  });

  describe('Drag Selection Cancellation', () => {
    test('should cancel drag selection on Escape key', () => {
      // Start drag selection
      const startEvent = {
        clientX: 50,
        clientY: 50,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      // Focus the container first to enable keyboard shortcuts
      container.focus();
      
      // Press Escape
      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });
      container.dispatchEvent(escapeEvent);

      expect(view.interactionState.isDragSelecting).toBe(false);
      
      // Selection rectangle should be removed
      const selectionRect = view.overlayLayer.querySelector('.drag-selection-rect');
      expect(selectionRect).toBeNull();
    });

    test('should cancel drag selection on mouse leave container', () => {
      // Start drag selection
      const startEvent = {
        clientX: 50,
        clientY: 50,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      // Mouse leaves container
      const leaveEvent = document.createEvent('MouseEvent');
      leaveEvent.initEvent('mouseleave', true, true);
      container.dispatchEvent(leaveEvent);

      expect(view.interactionState.isDragSelecting).toBe(false);
      
      // Selection rectangle should be removed
      const selectionRect = view.overlayLayer.querySelector('.drag-selection-rect');
      expect(selectionRect).toBeNull();
    });
  });

  describe('Drag Selection Styling', () => {
    test('should apply proper CSS classes to selection rectangle', () => {
      // Start drag selection
      const startEvent = {
        clientX: 50,
        clientY: 50,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      const selectionRect = view.overlayLayer.querySelector('.drag-selection-rect');
      expect(selectionRect.classList.contains('drag-selection-rect')).toBe(true);
    });

    test('should allow custom selection rectangle styling', () => {
      const customStyle = {
        stroke: '#ff0000',
        strokeWidth: 2,
        fill: 'rgba(255, 0, 0, 0.1)',
        strokeDasharray: '5,5'
      };
      view.setDragSelectionStyle(customStyle);

      // Start drag selection
      const startEvent = {
        clientX: 50,
        clientY: 50,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      const selectionRect = view.overlayLayer.querySelector('.drag-selection-rect');
      expect(selectionRect.getAttribute('stroke')).toBe('#ff0000');
      expect(selectionRect.getAttribute('stroke-width')).toBe('2');
    });
  });

  describe('Integration with Existing Features', () => {
    test('should work with pan and zoom', () => {
      // Set viewport transform
      view.viewport.zoom = 2;
      view.viewport.panX = 50;
      view.viewport.panY = 50;
      view._updateViewportTransform();

      // Drag selection should account for viewport transform
      const startEvent = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      expect(view.interactionState.isDragSelecting).toBe(true);
      
      // Coordinates should be transformed correctly
      const dragStart = view.interactionState.dragSelectionStart;
      expect(dragStart.x).toBe(100);
      expect(dragStart.y).toBe(100);
    });

    test('should not interfere with node dragging', () => {
      // Mouse down on a node should not start drag selection
      const startEvent = {
        clientX: 100,
        clientY: 100,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'node', id: 'node1', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      expect(view.interactionState.isDragSelecting).toBe(false);
      
      // No selection rectangle should be created
      const selectionRect = view.overlayLayer.querySelector('.drag-selection-rect');
      expect(selectionRect).toBeNull();
    });

    test('should update ViewModel selection correctly', () => {
      const originalSelectInBox = viewModel.selectInBox;
      const mockSelectInBox = jest.fn();
      viewModel.selectInBox = mockSelectInBox;

      // Perform drag selection
      const startEvent = {
        clientX: 50,
        clientY: 50,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      const upEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn(),
        button: 0
      };
      view._handleMouseUp(upEvent, elementInfo);

      expect(mockSelectInBox).toHaveBeenCalledWith(expect.objectContaining({
        x: 50,
        y: 50,
        width: 150,
        height: 150
      }));

      viewModel.selectInBox = originalSelectInBox;
    });
  });

  describe('Cleanup', () => {
    test('should clean up drag selection state on destroy', () => {
      // Start drag selection
      const startEvent = {
        clientX: 50,
        clientY: 50,
        preventDefault: jest.fn(),
        button: 0
      };
      const elementInfo = { type: 'background', element: view.svg };
      view._handleMouseDown(startEvent, elementInfo);

      const moveEvent = {
        clientX: 200,
        clientY: 200,
        preventDefault: jest.fn()
      };
      view._handleMouseMove(moveEvent, elementInfo);

      expect(view.interactionState.isDragSelecting).toBe(true);
      
      // Verify selection rectangle exists before destroy
      let selectionRect = view.overlayLayer.querySelector('.drag-selection-rect');
      expect(selectionRect).toBeDefined();

      view.destroy();

      // After destroy, interactionState should be null and no selection rect should exist in DOM
      expect(view.interactionState).toBeNull();
      // Since overlayLayer is also null after destroy, we can't check DOM elements
      // The test passes if destroy doesn't throw an error while cleaning up drag selection
    });
  });
});