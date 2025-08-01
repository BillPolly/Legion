/**
 * Tests for drag preview functionality
 */

import { GraphEditor } from '../../../../src/components/graph-editor/index.js';
import { SelectTool } from '../../../../src/components/graph-editor/tools/SelectTool.js';
import { UmbilicalUtils } from '../../../../src/umbilical/index.js';

describe('Graph Editor Drag Preview', () => {
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
    const nodeA = model.addNode({ id: 'A', position: { x: 100, y: 100 }, label: 'Node A' });
    const nodeB = model.addNode({ id: 'B', position: { x: 300, y: 100 }, label: 'Node B' });
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

  describe('Drag Preview State Management', () => {
    test('should start drag preview for nodes', () => {
      const nodeA = model.getSceneGraph().getNodeById('A');
      const nodeB = model.getSceneGraph().getNodeById('B');
      const nodes = [nodeA, nodeB];
      const startPosition = { x: 100, y: 100 };

      // Initially no drag preview
      expect(viewModel.getDragPreview().active).toBe(false);
      expect(viewModel.hasNodeDragPreview(nodeA)).toBe(false);

      // Start drag preview
      viewModel.startDragPreview(nodes, startPosition);
      
      const dragPreview = viewModel.getDragPreview();
      expect(dragPreview.active).toBe(true);
      expect(dragPreview.nodes).toHaveLength(2);
      expect(viewModel.hasNodeDragPreview(nodeA)).toBe(true);
      expect(viewModel.hasNodeDragPreview(nodeB)).toBe(true);

      // Check initial positions match node positions
      const nodeAPos = viewModel.getNodePreviewPosition(nodeA);
      expect(nodeAPos.x).toBe(100);
      expect(nodeAPos.y).toBe(100);
    });

    test('should update drag preview positions', () => {
      const nodeA = model.getSceneGraph().getNodeById('A');
      const startPosition = { x: 100, y: 100 };
      const offset = { x: 50, y: 25 };

      // Start and update drag preview
      viewModel.startDragPreview([nodeA], startPosition);
      viewModel.updateDragPreview(offset);

      // Check updated position
      const previewPos = viewModel.getNodePreviewPosition(nodeA);
      expect(previewPos.x).toBe(150); // 100 + 50
      expect(previewPos.y).toBe(125); // 100 + 25

      // Original node position should be unchanged
      const nodePos = nodeA.getPosition();
      expect(nodePos.x).toBe(100);
      expect(nodePos.y).toBe(100);
    });

    test('should commit drag preview to actual positions', () => {
      const nodeA = model.getSceneGraph().getNodeById('A');
      const startPosition = { x: 100, y: 100 };
      const offset = { x: 75, y: 50 };

      // Start, update, and commit drag preview
      viewModel.startDragPreview([nodeA], startPosition);
      viewModel.updateDragPreview(offset);
      viewModel.endDragPreview(true); // commit = true

      // Check that node position was updated
      const nodePos = nodeA.getPosition();
      expect(nodePos.x).toBe(175); // 100 + 75
      expect(nodePos.y).toBe(150); // 100 + 50

      // Drag preview should be inactive
      expect(viewModel.getDragPreview().active).toBe(false);
      expect(viewModel.hasNodeDragPreview(nodeA)).toBe(false);
    });

    test('should cancel drag preview without committing', () => {
      const nodeA = model.getSceneGraph().getNodeById('A');
      const originalPos = nodeA.getPosition();
      const startPosition = { x: 100, y: 100 };
      const offset = { x: 100, y: 100 };

      // Start, update, and cancel drag preview
      viewModel.startDragPreview([nodeA], startPosition);
      viewModel.updateDragPreview(offset);
      viewModel.endDragPreview(false); // commit = false

      // Check that node position was NOT updated
      const nodePos = nodeA.getPosition();
      expect(nodePos.x).toBe(originalPos.x);
      expect(nodePos.y).toBe(originalPos.y);

      // Drag preview should be inactive
      expect(viewModel.getDragPreview().active).toBe(false);
    });

    test('should trigger re-render on drag preview changes', () => {
      const nodeA = model.getSceneGraph().getNodeById('A');
      let renderCount = 0;
      
      // Mock view render request
      const originalRequestRender = view.requestRender;
      view.requestRender = () => {
        renderCount++;
        originalRequestRender.call(view);
      };

      // Start drag preview should trigger render
      renderCount = 0;
      viewModel.startDragPreview([nodeA], { x: 100, y: 100 });
      expect(renderCount).toBe(1);

      // Update drag preview should trigger render
      renderCount = 0;
      viewModel.updateDragPreview({ x: 50, y: 50 });
      expect(renderCount).toBe(1);

      // End drag preview should trigger render (may be 2 due to batch update)
      renderCount = 0;
      viewModel.endDragPreview(true);
      expect(renderCount).toBeGreaterThanOrEqual(1);

      // Restore original method
      view.requestRender = originalRequestRender;
    });
  });

  describe('SVG Renderer Drag Preview', () => {
    test('should render nodes with drag preview styling', () => {
      const nodeA = model.getSceneGraph().getNodeById('A');
      const renderer = view.getRenderer();
      const previewPosition = { x: 200, y: 150 };
      
      // Render with drag preview
      renderer.beginFrame();
      renderer.renderNode(nodeA, { 
        isDragPreview: true, 
        previewPosition: previewPosition 
      });
      renderer.endFrame();

      // Find the rendered node element
      const nodeGroup = container.querySelector(`[data-node-id="A"]`);
      expect(nodeGroup).toBeTruthy();
      
      // Check position is updated to preview position
      const transform = nodeGroup.getAttribute('transform');
      expect(transform).toBe('translate(200, 150)');
      
      // Check drag preview styling is applied
      const rect = nodeGroup.querySelector('rect');
      expect(rect).toBeTruthy();
      expect(rect.getAttribute('opacity')).toBe('0.7');
      expect(rect.getAttribute('stroke')).toBe('#0066cc');
      
      const text = nodeGroup.querySelector('text');
      expect(text).toBeTruthy();
      expect(text.getAttribute('opacity')).toBe('0.7');
    });

    test('should render nodes normally without drag preview', () => {
      const nodeA = model.getSceneGraph().getNodeById('A');
      const renderer = view.getRenderer();
      
      // Render without drag preview
      renderer.beginFrame();
      renderer.renderNode(nodeA, { isDragPreview: false });
      renderer.endFrame();

      // Find the rendered node element
      const nodeGroup = container.querySelector(`[data-node-id="A"]`);
      expect(nodeGroup).toBeTruthy();
      
      // Check normal position is used
      const transform = nodeGroup.getAttribute('transform');
      expect(transform).toBe('translate(100, 100)');
      
      // Check normal styling is applied
      const rect = nodeGroup.querySelector('rect');
      expect(rect).toBeTruthy();
      expect(rect.getAttribute('opacity')).toBe('1');
      
      const text = nodeGroup.querySelector('text');
      expect(text).toBeTruthy();
      expect(text.getAttribute('opacity')).toBe('1');
    });
  });

  describe('SelectTool Integration', () => {
    test('should use drag preview during node dragging', () => {
      const eventCoordinator = viewModel.getEventCoordinator();
      const nodeA = model.getSceneGraph().getNodeById('A');
      
      // Register and activate select tool
      const selectTool = new SelectTool();
      eventCoordinator.registerTool('select', selectTool);
      eventCoordinator.setActiveTool('select');
      
      // Mock interaction data
      const dragStartInteraction = {
        target: nodeA,
        targetType: 'node',
        dragData: {
          startPosition: { x: 100, y: 100 },
          delta: { x: 0, y: 0 }
        }
      };
      
      const dragInteraction = {
        dragData: {
          delta: { x: 50, y: 25 }
        }
      };
      
      const dragEndInteraction = {};

      // Simulate drag start
      selectTool.onDragStart(dragStartInteraction);
      expect(viewModel.getDragPreview().active).toBe(true);
      expect(viewModel.hasNodeDragPreview(nodeA)).toBe(true);

      // Simulate drag
      selectTool.onDrag(dragInteraction);
      const previewPos = viewModel.getNodePreviewPosition(nodeA);
      expect(previewPos.x).toBe(150); // 100 + 50
      expect(previewPos.y).toBe(125); // 100 + 25

      // Node actual position should be unchanged during drag
      const nodePos = nodeA.getPosition();
      expect(nodePos.x).toBe(100);
      expect(nodePos.y).toBe(100);

      // Simulate drag end
      selectTool.onDragEnd(dragEndInteraction);
      expect(viewModel.getDragPreview().active).toBe(false);
      
      // Node position should now be updated
      const finalPos = nodeA.getPosition();
      expect(finalPos.x).toBe(150);
      expect(finalPos.y).toBe(125);
    });

    test('should cancel drag preview on tool deactivation', () => {
      const eventCoordinator = viewModel.getEventCoordinator();
      const nodeA = model.getSceneGraph().getNodeById('A');
      const originalPos = nodeA.getPosition();
      
      // Register and activate select tool
      const selectTool = new SelectTool();
      eventCoordinator.registerTool('select', selectTool);
      eventCoordinator.setActiveTool('select');
      selectTool.onDragStart({
        target: nodeA,
        targetType: 'node',
        dragData: { startPosition: { x: 100, y: 100 }, delta: { x: 0, y: 0 } }
      });
      selectTool.onDrag({
        dragData: { delta: { x: 100, y: 100 } }
      });
      
      // Verify drag preview is active
      expect(viewModel.getDragPreview().active).toBe(true);
      
      // Deactivate tool (should cancel drag preview)
      selectTool.onDeactivate();
      
      // Drag preview should be canceled
      expect(viewModel.getDragPreview().active).toBe(false);
      
      // Node position should be unchanged
      const nodePos = nodeA.getPosition();
      expect(nodePos.x).toBe(originalPos.x);
      expect(nodePos.y).toBe(originalPos.y);
    });
  });

  describe('Multiple Node Drag Preview', () => {
    test('should handle multiple nodes in drag preview', () => {
      const nodeA = model.getSceneGraph().getNodeById('A');
      const nodeB = model.getSceneGraph().getNodeById('B');
      const nodes = [nodeA, nodeB];
      const offset = { x: 75, y: 50 };

      // Start drag preview for multiple nodes
      viewModel.startDragPreview(nodes, { x: 100, y: 100 });
      viewModel.updateDragPreview(offset);

      // Both nodes should have drag preview
      expect(viewModel.hasNodeDragPreview(nodeA)).toBe(true);
      expect(viewModel.hasNodeDragPreview(nodeB)).toBe(true);

      // Check preview positions
      const previewPosA = viewModel.getNodePreviewPosition(nodeA);
      const previewPosB = viewModel.getNodePreviewPosition(nodeB);
      
      expect(previewPosA.x).toBe(175); // 100 + 75
      expect(previewPosA.y).toBe(150); // 100 + 50
      expect(previewPosB.x).toBe(375); // 300 + 75
      expect(previewPosB.y).toBe(150); // 100 + 50

      // Commit changes
      viewModel.endDragPreview(true);

      // Both nodes should be moved
      expect(nodeA.getPosition().x).toBe(175);
      expect(nodeA.getPosition().y).toBe(150);
      expect(nodeB.getPosition().x).toBe(375);
      expect(nodeB.getPosition().y).toBe(150);
    });
  });
});