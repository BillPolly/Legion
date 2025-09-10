/**
 * Unit tests for DiagramViewModel selection functionality
 */

import { DiagramViewModel } from '../../../../src/renderers/diagram/viewmodel/DiagramViewModel.js';
import { DiagramLayoutEngine } from '../../../../src/renderers/diagram/layout/DiagramLayoutEngine.js';
import { DiagramView } from '../../../../src/renderers/diagram/view/DiagramView.js';
import { 
  createTestDOM, 
  cleanupTestDOM,
  createSampleDiagramData 
} from '../test-setup.js';

describe('DiagramViewModel - Selection', () => {
  let dom;
  let container;
  let viewModel;
  let view;
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
  });

  afterEach(() => {
    cleanupTestDOM();
    if (view) view.destroy();
  });

  describe('Single Selection', () => {
    test('should select a node by ID', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectNode('node1');

      const state = viewModel.getState();
      expect(state.selection.has('node1')).toBe(true);
      expect(state.selection.size).toBe(1);
    });

    test('should deselect previous node when selecting new node', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectNode('node1');
      expect(viewModel.getState().selection.has('node1')).toBe(true);

      viewModel.selectNode('node2');
      const state = viewModel.getState();
      expect(state.selection.has('node1')).toBe(false);
      expect(state.selection.has('node2')).toBe(true);
      expect(state.selection.size).toBe(1);
    });

    test('should clear selection when selecting non-existent node', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectNode('node1');
      viewModel.selectNode('non-existent');

      const state = viewModel.getState();
      expect(state.selection.size).toBe(0);
    });

    test('should select an edge by ID', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectEdge('edge1');

      const state = viewModel.getState();
      expect(state.selection.has('edge1')).toBe(true);
      expect(state.selection.size).toBe(1);
    });

    test('should toggle selection on same element', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectNode('node1');
      expect(viewModel.getState().selection.has('node1')).toBe(true);

      viewModel.toggleSelection('node1');
      expect(viewModel.getState().selection.has('node1')).toBe(false);

      viewModel.toggleSelection('node1');
      expect(viewModel.getState().selection.has('node1')).toBe(true);
    });
  });

  describe('Multi-Selection', () => {
    test('should add to selection with addToSelection', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectNode('node1');
      viewModel.addToSelection('node2');

      const state = viewModel.getState();
      expect(state.selection.has('node1')).toBe(true);
      expect(state.selection.has('node2')).toBe(true);
      expect(state.selection.size).toBe(2);
    });

    test('should remove from selection with removeFromSelection', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectNode('node1');
      viewModel.addToSelection('node2');
      viewModel.addToSelection('node3');

      viewModel.removeFromSelection('node2');

      const state = viewModel.getState();
      expect(state.selection.has('node1')).toBe(true);
      expect(state.selection.has('node2')).toBe(false);
      expect(state.selection.has('node3')).toBe(true);
      expect(state.selection.size).toBe(2);
    });

    test('should select multiple elements at once', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectMultiple(['node1', 'node2', 'edge1']);

      const state = viewModel.getState();
      expect(state.selection.has('node1')).toBe(true);
      expect(state.selection.has('node2')).toBe(true);
      expect(state.selection.has('edge1')).toBe(true);
      expect(state.selection.size).toBe(3);
    });

    test('should support box selection', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);
      viewModel.computeLayout();

      // Select nodes within a box
      const box = { x: 50, y: 50, width: 200, height: 200 };
      viewModel.selectInBox(box);

      const state = viewModel.getState();
      // Should select nodes that fall within the box
      expect(state.selection.size).toBeGreaterThan(0);
    });
  });

  describe('Selection Clearing', () => {
    test('should clear all selections', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectMultiple(['node1', 'node2', 'edge1']);
      expect(viewModel.getState().selection.size).toBe(3);

      viewModel.clearSelection();
      expect(viewModel.getState().selection.size).toBe(0);
    });

    test('should clear selection on background click', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectNode('node1');
      expect(viewModel.getState().selection.size).toBe(1);

      viewModel.handleBackgroundClick();
      expect(viewModel.getState().selection.size).toBe(0);
    });
  });

  describe('Selection Events', () => {
    test('should emit selection change event', (done) => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      let changeCount = 0;
      const onSelectionChange = (selection) => {
        changeCount++;
        if (changeCount === 1) {
          expect(selection.has('node1')).toBe(true);
          done();
        }
      };

      viewModel = new DiagramViewModel({
        layoutEngine,
        view,
        onSelectionChange
      });
      viewModel.setDiagramData(data);
      viewModel.selectNode('node1');
    });

    test('should not emit event if selection unchanged', () => {
      const data = createSampleDiagramData();
      
      let changeCount = 0;
      const onSelectionChange = () => { changeCount++; };

      viewModel = new DiagramViewModel({
        layoutEngine,
        view,
        onSelectionChange
      });
      viewModel.setDiagramData(data);

      viewModel.selectNode('node1');
      expect(changeCount).toBe(1);

      // Selecting same node again should not trigger event
      viewModel.selectNode('node1');
      expect(changeCount).toBe(1);
    });
  });

  describe('Selection State', () => {
    test('should check if element is selected', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectNode('node1');
      
      expect(viewModel.isSelected('node1')).toBe(true);
      expect(viewModel.isSelected('node2')).toBe(false);
    });

    test('should get all selected elements', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectMultiple(['node1', 'node2', 'edge1']);
      
      const selected = viewModel.getSelectedElements();
      expect(selected).toEqual(['node1', 'node2', 'edge1']);
    });

    test('should get selected nodes only', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectMultiple(['node1', 'node2', 'edge1']);
      
      const nodes = viewModel.getSelectedNodes();
      expect(nodes).toEqual(['node1', 'node2']);
    });

    test('should get selected edges only', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectMultiple(['node1', 'edge1', 'edge2']);
      
      const edges = viewModel.getSelectedEdges();
      expect(edges).toEqual(['edge1', 'edge2']);
    });
  });

  describe('Keyboard Modifiers', () => {
    test('should handle shift-click for range selection', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectNode('node1');
      viewModel.selectWithModifier('node3', { shiftKey: true });

      const state = viewModel.getState();
      // Should select nodes between node1 and node3
      expect(state.selection.size).toBeGreaterThanOrEqual(2);
    });

    test('should handle ctrl/cmd-click for multi-selection', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectNode('node1');
      viewModel.selectWithModifier('node2', { ctrlKey: true });
      viewModel.selectWithModifier('edge1', { ctrlKey: true });

      const state = viewModel.getState();
      expect(state.selection.has('node1')).toBe(true);
      expect(state.selection.has('node2')).toBe(true);
      expect(state.selection.has('edge1')).toBe(true);
      expect(state.selection.size).toBe(3);
    });

    test('should handle select all', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);

      viewModel.selectAll();

      const state = viewModel.getState();
      // Should select all nodes and edges
      expect(state.selection.size).toBe(data.nodes.length + data.edges.length);
    });
  });
});