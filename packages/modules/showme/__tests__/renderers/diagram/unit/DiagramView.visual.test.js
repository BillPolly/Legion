/**
 * Unit tests for DiagramView visual feedback
 */

import { DiagramView } from '../../../../src/renderers/diagram/view/DiagramView.js';
import { DiagramViewModel } from '../../../../src/renderers/diagram/viewmodel/DiagramViewModel.js';
import { DiagramLayoutEngine } from '../../../../src/renderers/diagram/layout/DiagramLayoutEngine.js';
import { 
  createTestDOM, 
  cleanupTestDOM,
  createSampleDiagramData 
} from '../test-setup.js';

describe('DiagramView - Visual Feedback', () => {
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
  });

  afterEach(() => {
    cleanupTestDOM();
    if (view) view.destroy();
  });

  describe('Selection Visual Feedback', () => {
    test('should add selection visual to selected nodes', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);
      viewModel.computeLayout();

      // Select a node
      viewModel.selectNode('node1');
      
      // Render with selection
      const state = viewModel.getState();
      view.render(state);

      // Check that node has selection class
      const nodeElement = container.querySelector('[data-id="node1"]');
      expect(nodeElement).toBeDefined();
      expect(nodeElement.classList.contains('node--selected')).toBe(true);

      // Check for selection outline
      const selectionOutline = nodeElement.querySelector('.node-selection-outline');
      expect(selectionOutline).toBeDefined();
      expect(selectionOutline.getAttribute('stroke')).toBe('#007bff');
    });

    test('should add selection visual to selected edges', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);
      viewModel.computeLayout();

      // Select an edge
      viewModel.selectEdge('edge1');
      
      // Render with selection
      const state = viewModel.getState();
      view.render(state);

      // Check that edge has selection class
      const edgeElement = container.querySelector('[data-id="edge1"]');
      expect(edgeElement).toBeDefined();
      expect(edgeElement.classList.contains('edge--selected')).toBe(true);

      // Check for selection highlight
      const selectionHighlight = edgeElement.querySelector('.edge-selection-highlight');
      expect(selectionHighlight).toBeDefined();
      expect(selectionHighlight.getAttribute('stroke')).toBe('#007bff');
    });

    test('should show multiple selected elements', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);
      viewModel.computeLayout();

      // Select multiple elements
      viewModel.selectMultiple(['node1', 'node2', 'edge1']);
      
      // Render with selection
      const state = viewModel.getState();
      view.render(state);

      // Check all selected elements have visual feedback
      const node1 = container.querySelector('[data-id="node1"]');
      const node2 = container.querySelector('[data-id="node2"]');
      const edge1 = container.querySelector('[data-id="edge1"]');

      expect(node1.classList.contains('node--selected')).toBe(true);
      expect(node2.classList.contains('node--selected')).toBe(true);
      expect(edge1.classList.contains('edge--selected')).toBe(true);
    });
  });

  describe('Hover Visual Feedback', () => {
    test('should add hover visual to hovered nodes', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);
      viewModel.computeLayout();

      // Set hover state
      viewModel.setHoveredElement('node1');
      
      // Render with hover
      const state = viewModel.getState();
      view.render(state);

      // Check that node has hover class
      const nodeElement = container.querySelector('[data-id="node1"]');
      expect(nodeElement).toBeDefined();
      expect(nodeElement.classList.contains('node--hovered')).toBe(true);

      // Check for hover outline
      const hoverOutline = nodeElement.querySelector('.node-hover-outline');
      expect(hoverOutline).toBeDefined();
      expect(hoverOutline.getAttribute('stroke')).toBe('#28a745');
    });

    test('should add hover visual to hovered edges', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);
      viewModel.computeLayout();

      // Set hover state
      viewModel.setHoveredElement('edge1');
      
      // Render with hover
      const state = viewModel.getState();
      view.render(state);

      // Check that edge has hover class
      const edgeElement = container.querySelector('[data-id="edge1"]');
      expect(edgeElement).toBeDefined();
      expect(edgeElement.classList.contains('edge--hovered')).toBe(true);

      // Check for hover highlight
      const hoverHighlight = edgeElement.querySelector('.edge-hover-highlight');
      expect(hoverHighlight).toBeDefined();
      expect(hoverHighlight.getAttribute('stroke')).toBe('#28a745');
    });
  });

  describe('Combined Selection and Hover', () => {
    test('should show both selection and hover on same element', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);
      viewModel.computeLayout();

      // Select and hover the same node
      viewModel.selectNode('node1');
      viewModel.setHoveredElement('node1');
      
      // Render
      const state = viewModel.getState();
      view.render(state);

      // Check that node has both classes
      const nodeElement = container.querySelector('[data-id="node1"]');
      expect(nodeElement.classList.contains('node--selected')).toBe(true);
      expect(nodeElement.classList.contains('node--hovered')).toBe(true);

      // Check for both outlines
      const selectionOutline = nodeElement.querySelector('.node-selection-outline');
      const hoverOutline = nodeElement.querySelector('.node-hover-outline');
      expect(selectionOutline).toBeDefined();
      expect(hoverOutline).toBeDefined();
    });

    test('should show selection and hover on different elements', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);
      viewModel.computeLayout();

      // Select one node, hover another
      viewModel.selectNode('node1');
      viewModel.setHoveredElement('node2');
      
      // Render
      const state = viewModel.getState();
      view.render(state);

      // Check visual states
      const node1 = container.querySelector('[data-id="node1"]');
      const node2 = container.querySelector('[data-id="node2"]');

      expect(node1.classList.contains('node--selected')).toBe(true);
      expect(node1.classList.contains('node--hovered')).toBe(false);

      expect(node2.classList.contains('node--selected')).toBe(false);
      expect(node2.classList.contains('node--hovered')).toBe(true);
    });
  });

  describe('Visual State Updates', () => {
    test('should update visual when selection changes', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);
      viewModel.computeLayout();

      // Initial selection
      viewModel.selectNode('node1');
      view.render(viewModel.getState());

      let node1 = container.querySelector('[data-id="node1"]');
      let node2 = container.querySelector('[data-id="node2"]');
      expect(node1.classList.contains('node--selected')).toBe(true);
      expect(node2.classList.contains('node--selected')).toBe(false);

      // Change selection
      viewModel.selectNode('node2');
      view.render(viewModel.getState());

      node1 = container.querySelector('[data-id="node1"]');
      node2 = container.querySelector('[data-id="node2"]');
      expect(node1.classList.contains('node--selected')).toBe(false);
      expect(node2.classList.contains('node--selected')).toBe(true);
    });

    test('should clear visual when selection is cleared', () => {
      const data = createSampleDiagramData();
      viewModel.setDiagramData(data);
      viewModel.computeLayout();

      // Select and render
      viewModel.selectNode('node1');
      view.render(viewModel.getState());

      let node1 = container.querySelector('[data-id="node1"]');
      expect(node1.classList.contains('node--selected')).toBe(true);

      // Clear selection and re-render
      viewModel.clearSelection();
      view.render(viewModel.getState());

      node1 = container.querySelector('[data-id="node1"]');
      expect(node1.classList.contains('node--selected')).toBe(false);
      expect(node1.querySelector('.node-selection-outline')).toBeNull();
    });
  });
});