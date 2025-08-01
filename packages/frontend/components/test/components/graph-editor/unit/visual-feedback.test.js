/**
 * Tests for visual feedback features like hover states
 */

import { GraphEditor } from '../../../../src/components/graph-editor/index.js';
import { UmbilicalUtils } from '../../../../src/umbilical/index.js';

describe('Graph Editor Visual Feedback', () => {
  let container;
  let graphEditor;
  let model, view, viewModel;

  beforeEach(() => {
    // Setup DOM container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Create graph editor instance
    graphEditor = GraphEditor.create({
      dom: container,
      width: 800,
      height: 600
    });

    // Get MVVM components
    model = graphEditor.getModel();
    view = graphEditor.getView();
    viewModel = graphEditor.getViewModel();

    // Add test data
    const nodeA = model.addNode({ id: 'A', x: 100, y: 100, label: 'Node A' });
    const nodeB = model.addNode({ id: 'B', x: 300, y: 100, label: 'Node B' });
    model.addEdge({ id: 'edge1', source: 'A', target: 'B' });

    // Initial render
    viewModel.render();
  });

  afterEach(() => {
    if (graphEditor) {
      graphEditor.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Hover States', () => {
    test('should track hovered elements', () => {
      const nodeA = model.getSceneGraph().getNodeById('A');
      
      // Initially no hover
      expect(viewModel.getHoveredElement().element).toBeNull();
      expect(viewModel.isHovered(nodeA)).toBe(false);

      // Set hover
      viewModel.setHoveredElement(nodeA, 'node');
      expect(viewModel.getHoveredElement().element).toBe(nodeA);
      expect(viewModel.getHoveredElement().type).toBe('node');
      expect(viewModel.isHovered(nodeA)).toBe(true);

      // Clear hover
      viewModel.clearHover();
      expect(viewModel.getHoveredElement().element).toBeNull();
      expect(viewModel.isHovered(nodeA)).toBe(false);
    });

    test('should trigger re-render on hover changes', () => {
      const nodeA = model.getSceneGraph().getNodeById('A');
      let renderCalled = false;
      
      // Mock view render request
      const originalRequestRender = view.requestRender;
      view.requestRender = () => {
        renderCalled = true;
        originalRequestRender.call(view);
      };

      // Set hover should trigger render
      renderCalled = false;
      viewModel.setHoveredElement(nodeA, 'node');
      expect(renderCalled).toBe(true);

      // Clear hover should trigger render
      renderCalled = false;
      viewModel.clearHover();
      expect(renderCalled).toBe(true);

      // Restore original method
      view.requestRender = originalRequestRender;
    });

    test('should pass hover state to renderer', () => {
      const nodeA = model.getSceneGraph().getNodeById('A');
      const renderer = view.getRenderer();
      
      // Mock renderer methods to capture options
      let capturedOptions = [];
      const originalRenderNode = renderer.renderNode;
      renderer.renderNode = (node, options) => {
        if (node === nodeA) {
          capturedOptions.push(options);
        }
        originalRenderNode.call(renderer, node, options);
      };

      // Force the view to be dirty so render actually executes
      viewModel.markNodeDirty(nodeA);
      
      // Render without hover
      capturedOptions = [];
      viewModel.render();
      expect(capturedOptions.length).toBeGreaterThan(0);
      expect(capturedOptions[capturedOptions.length - 1].isHovered).toBe(false);

      // Set hover and force dirty state for re-render
      capturedOptions = [];
      viewModel.setHoveredElement(nodeA, 'node');
      viewModel.markNodeDirty(nodeA);
      viewModel.render();
      expect(capturedOptions.length).toBeGreaterThan(0);
      expect(capturedOptions[capturedOptions.length - 1].isHovered).toBe(true);

      // Restore original method
      renderer.renderNode = originalRenderNode;
    });
  });

  describe('SVG Renderer Hover Effects', () => {
    test('should apply hover styles to nodes', () => {
      const nodeA = model.getSceneGraph().getNodeById('A');
      const renderer = view.getRenderer();
      
      // Render with hover
      renderer.beginFrame();
      renderer.renderNode(nodeA, { isHovered: true });
      renderer.endFrame();

      // Find the rendered node element
      const nodeGroup = container.querySelector(`[data-node-id="A"]`);
      expect(nodeGroup).toBeTruthy();
      
      const rect = nodeGroup.querySelector('rect');
      expect(rect).toBeTruthy();
      
      // Check hover styling is applied
      const stroke = rect.getAttribute('stroke');
      const strokeWidth = rect.getAttribute('stroke-width');
      expect(stroke).toBe('#0066cc');
      expect(parseFloat(strokeWidth)).toBeGreaterThanOrEqual(2);
    });

    test('should apply hover styles to edges', () => {
      const edge = model.getEdges()[0];
      const nodeA = model.getSceneGraph().getNodeById('A');
      const nodeB = model.getSceneGraph().getNodeById('B');
      const renderer = view.getRenderer();
      
      // Render with hover
      renderer.beginFrame();
      renderer.renderEdge(edge, nodeA, nodeB, { isHovered: true });
      renderer.endFrame();

      // Find the rendered edge element
      const edgeGroup = container.querySelector(`[data-edge-id="edge1"]`);
      expect(edgeGroup).toBeTruthy();
      
      const path = edgeGroup.querySelector('path');
      expect(path).toBeTruthy();
      
      // Check hover styling is applied
      const stroke = path.getAttribute('stroke');
      const strokeWidth = path.getAttribute('stroke-width');
      expect(stroke).toBe('#0066cc');
      expect(parseFloat(strokeWidth)).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Color Utilities', () => {
    test('should brighten hex colors', () => {
      const renderer = view.getRenderer();
      
      // Test brightening a dark color
      const brightened = renderer._brightenColor('#000000', 0.5);
      expect(brightened).toBe('#808080');
      
      // Test brightening a color that's already bright
      const alreadyBright = renderer._brightenColor('#ffffff', 0.1);
      expect(alreadyBright).toBe('#ffffff');
    });

    test('should handle named colors', () => {
      const renderer = view.getRenderer();
      
      const brightened = renderer._brightenColor('red', 0.1);
      expect(brightened).toBe('#ff6666');
      
      const unknown = renderer._brightenColor('purple', 0.1);
      expect(unknown).toBe('#e6e6e6'); // Default fallback
    });
  });
});