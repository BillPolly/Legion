/**
 * Unit tests for DiagramView element highlighting functionality
 * Tests visual feedback for node and edge hover/selection states
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

describe('DiagramView - Element Highlighting', () => {
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

    // Load sample data
    sampleData = createSampleDiagramData();
    viewModel.setDiagramData(sampleData);
    viewModel.computeLayout();
    view.render(viewModel.getState());
  });

  afterEach(() => {
    cleanupTestDOM();
    if (view) view.destroy();
  });

  describe('Node Highlighting', () => {
    test('should add hover highlight to node', () => {
      // Set hover state
      viewModel.setHoveredElement('node1');
      
      // Render with hover
      view.render(viewModel.getState());

      // Check that node has hover class
      const nodeElement = view.nodesLayer.querySelector('[data-id="node1"]');
      expect(nodeElement).toBeDefined();
      expect(nodeElement.classList.contains('node--hovered')).toBe(true);

      // Check for hover outline
      const hoverOutline = nodeElement.querySelector('.node-hover-outline');
      expect(hoverOutline).toBeDefined();
      expect(hoverOutline.getAttribute('stroke')).toBe('#28a745');
      expect(hoverOutline.getAttribute('stroke-width')).toBe('2');
      expect(hoverOutline.getAttribute('opacity')).toBe('0.8');
    });

    test('should add selection highlight to node', () => {
      // Select node
      viewModel.selectElement('node1');
      
      // Render with selection
      view.render(viewModel.getState());

      // Check that node has selection class
      const nodeElement = view.nodesLayer.querySelector('[data-id="node1"]');
      expect(nodeElement).toBeDefined();
      expect(nodeElement.classList.contains('node--selected')).toBe(true);
      expect(nodeElement.classList.contains('selected')).toBe(true);

      // Check for selection outline
      const selectionOutline = nodeElement.querySelector('.node-selection-outline');
      expect(selectionOutline).toBeDefined();
      expect(selectionOutline.getAttribute('stroke')).toBe('#007bff');
      expect(selectionOutline.getAttribute('stroke-width')).toBe('2');
      expect(selectionOutline.getAttribute('stroke-dasharray')).toBe('5,5');
    });

    test('should show both selection and hover on same node', () => {
      // Select and hover the same node
      viewModel.selectElement('node1');
      viewModel.setHoveredElement('node1');
      
      // Render with both states
      view.render(viewModel.getState());

      const nodeElement = view.nodesLayer.querySelector('[data-id="node1"]');
      expect(nodeElement.classList.contains('node--selected')).toBe(true);
      expect(nodeElement.classList.contains('node--hovered')).toBe(true);

      // Should have both outlines
      const selectionOutline = nodeElement.querySelector('.node-selection-outline');
      const hoverOutline = nodeElement.querySelector('.node-hover-outline');
      expect(selectionOutline).toBeDefined();
      expect(hoverOutline).toBeDefined();
    });

    test('should remove hover highlight when hover cleared', () => {
      // Set hover first
      viewModel.setHoveredElement('node1');
      view.render(viewModel.getState());
      
      let nodeElement = view.nodesLayer.querySelector('[data-id="node1"]');
      expect(nodeElement.classList.contains('node--hovered')).toBe(true);

      // Clear hover
      viewModel.clearHover();
      view.render(viewModel.getState());

      nodeElement = view.nodesLayer.querySelector('[data-id="node1"]');
      expect(nodeElement.classList.contains('node--hovered')).toBe(false);
      
      // Hover outline should be gone
      const hoverOutline = nodeElement.querySelector('.node-hover-outline');
      expect(hoverOutline).toBeNull();
    });

    test('should remove selection highlight when selection cleared', () => {
      // Select first
      viewModel.selectElement('node1');
      view.render(viewModel.getState());
      
      let nodeElement = view.nodesLayer.querySelector('[data-id="node1"]');
      expect(nodeElement.classList.contains('node--selected')).toBe(true);

      // Clear selection
      viewModel.clearSelection();
      view.render(viewModel.getState());

      nodeElement = view.nodesLayer.querySelector('[data-id="node1"]');
      expect(nodeElement.classList.contains('node--selected')).toBe(false);
      expect(nodeElement.classList.contains('selected')).toBe(false);
      
      // Selection outline should be gone
      const selectionOutline = nodeElement.querySelector('.node-selection-outline');
      expect(selectionOutline).toBeNull();
    });
  });

  describe('Edge Highlighting', () => {
    test('should add hover highlight to edge', () => {
      // Set hover state
      viewModel.setHoveredElement('edge1');
      
      // Render with hover
      view.render(viewModel.getState());

      // Check that edge has hover class
      const edgeElement = view.edgesLayer.querySelector('[data-id="edge1"]');
      expect(edgeElement).toBeDefined();
      expect(edgeElement.classList.contains('edge--hovered')).toBe(true);

      // Check for hover highlight path
      const hoverHighlight = edgeElement.querySelector('.edge-hover-highlight');
      expect(hoverHighlight).toBeDefined();
      expect(hoverHighlight.getAttribute('stroke')).toBe('#28a745');
      expect(hoverHighlight.getAttribute('stroke-width')).toBe('4');
      expect(hoverHighlight.getAttribute('opacity')).toBe('0.5');
    });

    test('should add selection highlight to edge', () => {
      // Select edge
      viewModel.selectElement('edge1');
      
      // Render with selection
      view.render(viewModel.getState());

      // Check that edge has selection class
      const edgeElement = view.edgesLayer.querySelector('[data-id="edge1"]');
      expect(edgeElement).toBeDefined();
      expect(edgeElement.classList.contains('edge--selected')).toBe(true);
      expect(edgeElement.classList.contains('selected')).toBe(true);

      // Check for selection highlight path
      const selectionHighlight = edgeElement.querySelector('.edge-selection-highlight');
      expect(selectionHighlight).toBeDefined();
      expect(selectionHighlight.getAttribute('stroke')).toBe('#007bff');
      expect(selectionHighlight.getAttribute('stroke-width')).toBe('4');
      expect(selectionHighlight.getAttribute('opacity')).toBe('0.5');
    });

    test('should change main edge color when selected or hovered', () => {
      const edgeElement = view.edgesLayer.querySelector('[data-id="edge1"]');
      const mainPath = edgeElement.querySelector('.edge-path');
      
      // Initial color
      expect(mainPath.getAttribute('stroke')).toBe('#666');

      // Hover should change color
      viewModel.setHoveredElement('edge1');
      view.render(viewModel.getState());
      const hoveredEdge = view.edgesLayer.querySelector('[data-id="edge1"] .edge-path');
      expect(hoveredEdge.getAttribute('stroke')).toBe('#28a745');

      // Selection should override hover color
      viewModel.selectElement('edge1');
      view.render(viewModel.getState());
      const selectedEdge = view.edgesLayer.querySelector('[data-id="edge1"] .edge-path');
      expect(selectedEdge.getAttribute('stroke')).toBe('#007bff');
    });

    test('should show both selection and hover on same edge', () => {
      // Select and hover the same edge
      viewModel.selectElement('edge1');
      viewModel.setHoveredElement('edge1');
      
      // Render with both states
      view.render(viewModel.getState());

      const edgeElement = view.edgesLayer.querySelector('[data-id="edge1"]');
      expect(edgeElement.classList.contains('edge--selected')).toBe(true);
      expect(edgeElement.classList.contains('edge--hovered')).toBe(true);

      // Should have selection highlight (selection takes precedence in highlighting)
      const selectionHighlight = edgeElement.querySelector('.edge-selection-highlight');
      expect(selectionHighlight).toBeDefined();
      expect(selectionHighlight.getAttribute('stroke')).toBe('#007bff');
    });
  });

  describe('Multi-Element Highlighting', () => {
    test('should highlight multiple selected elements', () => {
      // Select multiple elements
      viewModel.selectElement('node1');
      viewModel.addToSelection('node2');
      viewModel.addToSelection('edge1');
      
      view.render(viewModel.getState());

      // Check all selected elements have highlights
      const node1 = view.nodesLayer.querySelector('[data-id="node1"]');
      const node2 = view.nodesLayer.querySelector('[data-id="node2"]');
      const edge1 = view.edgesLayer.querySelector('[data-id="edge1"]');

      expect(node1.classList.contains('node--selected')).toBe(true);
      expect(node2.classList.contains('node--selected')).toBe(true);
      expect(edge1.classList.contains('edge--selected')).toBe(true);

      // Check all have selection highlights
      expect(node1.querySelector('.node-selection-outline')).toBeDefined();
      expect(node2.querySelector('.node-selection-outline')).toBeDefined();
      expect(edge1.querySelector('.edge-selection-highlight')).toBeDefined();
    });

    test('should handle hover and selection on different elements', () => {
      // Select one, hover another
      viewModel.selectElement('node1');
      viewModel.setHoveredElement('node2');
      
      view.render(viewModel.getState());

      const node1 = view.nodesLayer.querySelector('[data-id="node1"]');
      const node2 = view.nodesLayer.querySelector('[data-id="node2"]');

      // Node1 should be selected only
      expect(node1.classList.contains('node--selected')).toBe(true);
      expect(node1.classList.contains('node--hovered')).toBe(false);
      expect(node1.querySelector('.node-selection-outline')).toBeDefined();
      expect(node1.querySelector('.node-hover-outline')).toBeNull();

      // Node2 should be hovered only
      expect(node2.classList.contains('node--selected')).toBe(false);
      expect(node2.classList.contains('node--hovered')).toBe(true);
      expect(node2.querySelector('.node-selection-outline')).toBeNull();
      expect(node2.querySelector('.node-hover-outline')).toBeDefined();
    });
  });

  describe('Highlighting State Transitions', () => {
    test('should update highlights when switching between elements', () => {
      // Start with node1 hovered
      viewModel.setHoveredElement('node1');
      view.render(viewModel.getState());

      let node1 = view.nodesLayer.querySelector('[data-id="node1"]');
      let node2 = view.nodesLayer.querySelector('[data-id="node2"]');
      
      expect(node1.classList.contains('node--hovered')).toBe(true);
      expect(node2.classList.contains('node--hovered')).toBe(false);

      // Switch to node2
      viewModel.setHoveredElement('node2');
      view.render(viewModel.getState());

      node1 = view.nodesLayer.querySelector('[data-id="node1"]');
      node2 = view.nodesLayer.querySelector('[data-id="node2"]');
      
      expect(node1.classList.contains('node--hovered')).toBe(false);
      expect(node2.classList.contains('node--hovered')).toBe(true);
      expect(node1.querySelector('.node-hover-outline')).toBeNull();
      expect(node2.querySelector('.node-hover-outline')).toBeDefined();
    });

    test('should preserve selection when hover changes', () => {
      // Select node1 and hover node2
      viewModel.selectElement('node1');
      viewModel.setHoveredElement('node2');
      view.render(viewModel.getState());

      const node1 = view.nodesLayer.querySelector('[data-id="node1"]');
      const node2 = view.nodesLayer.querySelector('[data-id="node2"]');
      
      expect(node1.classList.contains('node--selected')).toBe(true);
      expect(node2.classList.contains('node--hovered')).toBe(true);

      // Change hover to node1 (same as selection)
      viewModel.setHoveredElement('node1');
      view.render(viewModel.getState());

      const updatedNode1 = view.nodesLayer.querySelector('[data-id="node1"]');
      const updatedNode2 = view.nodesLayer.querySelector('[data-id="node2"]');
      
      // Node1 should now be both selected and hovered
      expect(updatedNode1.classList.contains('node--selected')).toBe(true);
      expect(updatedNode1.classList.contains('node--hovered')).toBe(true);
      expect(updatedNode2.classList.contains('node--hovered')).toBe(false);
    });
  });

  describe('Highlighting Style Customization', () => {
    test('should allow custom highlighting styles', () => {
      // This tests that the highlighting uses consistent color schemes
      viewModel.selectElement('node1');
      viewModel.setHoveredElement('edge1');
      view.render(viewModel.getState());

      const selectedNode = view.nodesLayer.querySelector('[data-id="node1"] .node-selection-outline');
      const hoveredEdge = view.edgesLayer.querySelector('[data-id="edge1"] .edge-hover-highlight');

      // Verify consistent color scheme
      expect(selectedNode.getAttribute('stroke')).toBe('#007bff'); // Selection color
      expect(hoveredEdge.getAttribute('stroke')).toBe('#28a745'); // Hover color
    });

    test('should maintain visual hierarchy (selection over hover)', () => {
      // When both selected and hovered, selection style should dominate
      viewModel.selectElement('edge1');
      viewModel.setHoveredElement('edge1');
      view.render(viewModel.getState());

      const edgeElement = view.edgesLayer.querySelector('[data-id="edge1"]');
      const mainPath = edgeElement.querySelector('.edge-path');
      const highlight = edgeElement.querySelector('.edge-selection-highlight');

      // Main path should use selection color
      expect(mainPath.getAttribute('stroke')).toBe('#007bff');
      // Highlight should use selection color
      expect(highlight.getAttribute('stroke')).toBe('#007bff');
    });
  });

  describe('Performance and Cleanup', () => {
    test('should efficiently update only changed elements', () => {
      // Initial render
      view.render(viewModel.getState());
      const initialNodeCount = view.nodesLayer.children.length;
      const initialEdgeCount = view.edgesLayer.children.length;

      // Add hover - should not change element count
      viewModel.setHoveredElement('node1');
      view.render(viewModel.getState());
      
      expect(view.nodesLayer.children.length).toBe(initialNodeCount);
      expect(view.edgesLayer.children.length).toBe(initialEdgeCount);
    });

    test('should clean up highlighting on view destroy', () => {
      // Set up highlighting
      viewModel.selectElement('node1');
      viewModel.setHoveredElement('node2');
      view.render(viewModel.getState());

      // Verify highlighting exists
      const selectedNode = view.nodesLayer.querySelector('[data-id="node1"]');
      const hoveredNode = view.nodesLayer.querySelector('[data-id="node2"]');
      
      expect(selectedNode.classList.contains('node--selected')).toBe(true);
      expect(hoveredNode.classList.contains('node--hovered')).toBe(true);

      // Destroy view should clean up DOM
      view.destroy();
      
      // Container should be empty or cleaned
      expect(view.svg).toBe(null);
      expect(view.viewportGroup).toBe(null);
      expect(view.nodesLayer).toBe(null);
      expect(view.edgesLayer).toBe(null);
    });
  });
});