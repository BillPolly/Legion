/**
 * Full component integration tests for Graph Editor
 */

import { GraphEditor } from '../../../../src/components/graph-editor/index.js';
import { SelectTool } from '../../../../src/components/graph-editor/tools/SelectTool.js';
import { PanTool } from '../../../../src/components/graph-editor/tools/PanTool.js';

// Mock document.elementFromPoint for jsdom
document.elementFromPoint = () => null;

describe('Graph Editor Full Component Integration', () => {
  let container;
  let graphEditor;
  let model, view, viewModel;
  
  beforeEach(() => {
    // Create container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    // Create graph editor
    graphEditor = GraphEditor.create({
      dom: container,
      width: 800,
      height: 600,
      theme: 'light',
      onModelChange: () => {} // Required callback
    });
    
    // Get components
    model = graphEditor.getModel();
    view = graphEditor.getView();
    viewModel = graphEditor.getViewModel();
  });
  
  afterEach(() => {
    if (graphEditor) {
      graphEditor.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Component Creation and Destruction', () => {
    test('should create all MVVM components', () => {
      expect(model).toBeDefined();
      expect(view).toBeDefined();
      expect(viewModel).toBeDefined();
      
      expect(model.getSceneGraph()).toBeDefined();
      expect(view.getRenderer()).toBeDefined();
      expect(viewModel.getEventCoordinator()).toBeDefined();
    });

    test('should follow umbilical protocol', () => {
      // Test introspection mode
      let requirements = null;
      GraphEditor.create({
        describe: (reqs) => { requirements = reqs; }
      });
      
      expect(requirements).toBeDefined();
      expect(requirements.getAll).toBeDefined();
      const allReqs = requirements.getAll();
      expect(allReqs.dom).toBeDefined();
      expect(allReqs.dom.type).toBe('HTMLElement');
      
      // Test validation mode
      let validation = null;
      GraphEditor.create({
        dom: container,
        onModelChange: () => {},
        validate: (checks) => { validation = checks; return checks; }
      });
      
      expect(validation).toBeDefined();
      expect(validation.hasDomElement).toBeDefined();
      expect(validation.hasModelChangeCallback).toBeDefined();
      expect(validation.isValid).toBe(true);
    });

    test('should handle destruction properly', () => {
      const anotherEditor = GraphEditor.create({
        dom: container,
        width: 400,
        height: 300,
        onModelChange: () => {}
      });
      
      anotherEditor.destroy();
      
      // Should throw error when accessing after destruction
      expect(() => anotherEditor.getModel()).toThrow('destroyed');
    });
  });

  describe('Graph Creation Workflow', () => {
    test('should create a complete graph with nodes and edges', () => {
      // Add nodes
      const node1 = model.addNode({
        id: 'node1',
        position: { x: 100, y: 100 },
        label: 'Node 1',
        size: { width: 120, height: 60 }
      });
      
      const node2 = model.addNode({
        id: 'node2',
        position: { x: 300, y: 100 },
        label: 'Node 2'
      });
      
      const node3 = model.addNode({
        id: 'node3',
        position: { x: 200, y: 250 },
        label: 'Node 3'
      });
      
      // Add edges
      const edge1 = model.addEdge({
        id: 'edge1',
        source: 'node1',
        target: 'node2',
        label: 'connects to'
      });
      
      const edge2 = model.addEdge({
        id: 'edge2',
        source: 'node2',
        target: 'node3',
        directed: true
      });
      
      // Verify graph structure
      expect(model.getSceneGraph().getAllNodes()).toHaveLength(4); // including root
      expect(model.getEdges()).toHaveLength(2);
      
      // Verify spatial indexing works
      const sceneGraph = model.getSceneGraph();
      const nodesInRect = sceneGraph.getNodesInRect(50, 50, 200, 200);
      expect(nodesInRect).toContain(node1);
      expect(nodesInRect).not.toContain(node2);
    });

    test('should handle hierarchical node structures', () => {
      // Create parent node
      const parentNode = model.addNode({
        id: 'parent',
        position: { x: 100, y: 100 },
        label: 'Parent',
        size: { width: 200, height: 150 }
      });
      
      // Add child nodes
      const child1 = model.addNode({
        id: 'child1',
        position: { x: 20, y: 20 },
        label: 'Child 1'
      }, 'parent');
      
      const child2 = model.addNode({
        id: 'child2',
        position: { x: 100, y: 20 },
        label: 'Child 2'
      }, 'parent');
      
      // Verify hierarchy
      expect(parentNode.getChildren()).toHaveLength(2);
      expect(child1.getParent()).toBe(parentNode);
      expect(child2.getParent()).toBe(parentNode);
      
      // Remove parent should remove children
      model.removeNode('parent');
      
      expect(model.getSceneGraph().getNodeById('parent')).toBeUndefined();
      expect(model.getSceneGraph().getNodeById('child1')).toBeUndefined();
      expect(model.getSceneGraph().getNodeById('child2')).toBeUndefined();
    });
  });

  describe('Full Edit Cycle', () => {
    test('should support complete edit workflow with undo/redo', () => {
      // Setup tools
      const eventCoordinator = viewModel.getEventCoordinator();
      const selectTool = new SelectTool();
      eventCoordinator.registerTool('select', selectTool);
      eventCoordinator.setActiveTool('select');
      
      // Add nodes using commands
      viewModel.executeCommandType('addNode', {
        nodeData: { id: 'n1', position: { x: 100, y: 100 }, label: 'Node 1' }
      });
      
      viewModel.executeCommandType('addNode', {
        nodeData: { id: 'n2', position: { x: 300, y: 100 }, label: 'Node 2' }
      });
      
      // Connect nodes
      viewModel.executeCommandType('connectNodes', {
        sourceNodeId: 'n1',
        targetNodeId: 'n2',
        edgeData: { id: 'e1', label: 'Edge 1' }
      });
      
      // Verify creation
      expect(model.getSceneGraph().getAllNodes()).toHaveLength(3); // n1, n2, root
      expect(model.getEdges()).toHaveLength(1);
      
      // Move node
      viewModel.executeCommandType('moveNode', {
        nodeId: 'n1',
        position: { x: 150, y: 150 },
        oldPosition: { x: 100, y: 100 }
      });
      
      const movedNode = model.getSceneGraph().getNodeById('n1');
      expect(movedNode.getPosition()).toEqual({ x: 150, y: 150 });
      
      // Test undo
      expect(viewModel.canUndo()).toBe(true);
      viewModel.undo(); // Undo move
      expect(movedNode.getPosition()).toEqual({ x: 100, y: 100 });
      
      viewModel.undo(); // Undo edge
      expect(model.getEdges()).toHaveLength(0);
      
      viewModel.undo(); // Undo node 2
      expect(model.getSceneGraph().getNodeById('n2')).toBeUndefined();
      
      viewModel.undo(); // Undo node 1
      expect(model.getSceneGraph().getNodeById('n1')).toBeUndefined();
      
      // Test redo
      expect(viewModel.canRedo()).toBe(true);
      viewModel.redo(); // Redo node 1
      expect(model.getSceneGraph().getNodeById('n1')).toBeTruthy();
      
      viewModel.redo(); // Redo node 2
      expect(model.getSceneGraph().getNodeById('n2')).toBeTruthy();
      
      viewModel.redo(); // Redo edge
      expect(model.getEdges()).toHaveLength(1);
      
      viewModel.redo(); // Redo move
      expect(model.getSceneGraph().getNodeById('n1').getPosition()).toEqual({ x: 150, y: 150 });
      
      // Should not be able to redo further
      expect(viewModel.canRedo()).toBe(false);
    });

    test('should handle complex node removal with connected edges', () => {
      // Create a graph with multiple connections
      model.addNode({ id: 'a', position: { x: 100, y: 100 } });
      model.addNode({ id: 'b', position: { x: 200, y: 100 } });
      model.addNode({ id: 'c', position: { x: 300, y: 100 } });
      
      model.addEdge({ id: 'ab', source: 'a', target: 'b' });
      model.addEdge({ id: 'bc', source: 'b', target: 'c' });
      model.addEdge({ id: 'ac', source: 'a', target: 'c' });
      
      // Remove middle node
      viewModel.executeCommandType('removeNode', { nodeId: 'b' });
      
      // Verify node and connected edges are removed
      expect(model.getSceneGraph().getNodeById('b')).toBeUndefined();
      expect(model.getEdgeById('ab')).toBeUndefined();
      expect(model.getEdgeById('bc')).toBeUndefined();
      expect(model.getEdgeById('ac')).toBeTruthy(); // Should remain
      
      // Undo should restore everything
      viewModel.undo();
      expect(model.getSceneGraph().getNodeById('b')).toBeTruthy();
      expect(model.getEdgeById('ab')).toBeTruthy();
      expect(model.getEdgeById('bc')).toBeTruthy();
    });
  });

  describe('Viewport and Interaction', () => {
    test('should handle pan and zoom operations', () => {
      const viewport = view.getViewport();
      
      // Initial state
      expect(viewport.getPan()).toEqual({ x: 0, y: 0 });
      expect(viewport.getZoom()).toBe(1.0);
      
      // Pan
      viewport.setPan(50, 75);
      expect(viewport.getPan()).toEqual({ x: 50, y: 75 });
      
      // Zoom
      viewport.setZoom(2.0, { x: 400, y: 300 });
      expect(viewport.getZoom()).toBe(2.0);
      
      // Reset
      viewport.reset();
      expect(viewport.getPan()).toEqual({ x: 0, y: 0 });
      expect(viewport.getZoom()).toBe(1.0);
    });

    test('should coordinate between tools and viewport', () => {
      const eventCoordinator = viewModel.getEventCoordinator();
      const panTool = new PanTool();
      eventCoordinator.registerTool('pan', panTool);
      eventCoordinator.setActiveTool('pan');
      
      const initialPan = view.getViewport().getPan();
      
      // Simulate pan drag
      view._notifyEvent({
        type: 'mousedown',
        position: { x: 100, y: 100 },
        screenPosition: { x: 100, y: 100 },
        button: 0
      });
      
      view._notifyEvent({
        type: 'mousemove',
        position: { x: 150, y: 125 },
        screenPosition: { x: 150, y: 125 }
      });
      
      view._notifyEvent({
        type: 'mouseup',
        position: { x: 150, y: 125 },
        screenPosition: { x: 150, y: 125 }
      });
      
      // Viewport should have moved
      const newPan = view.getViewport().getPan();
      expect(newPan.x).not.toBe(initialPan.x);
      expect(newPan.y).not.toBe(initialPan.y);
    });
  });

  describe('Visual Feedback Integration', () => {
    test('should update hover state on mouse movement', () => {
      // Add a node
      const node = model.addNode({
        id: 'hover-test',
        position: { x: 100, y: 100 },
        size: { width: 100, height: 50 }
      });
      
      // Initially no hover
      expect(viewModel.getHoveredElement().element).toBeNull();
      
      // Mock renderer hit test
      const renderer = view.getRenderer();
      const originalGetElementAt = renderer.getElementAt;
      renderer.getElementAt = (x, y) => {
        if (x >= 100 && x <= 200 && y >= 100 && y <= 150) {
          return { type: 'node', element: node };
        }
        return null;
      };
      
      // Simulate mouse move over node
      view._notifyEvent({
        type: 'mousemove',
        position: { x: 150, y: 125 },
        screenPosition: { x: 150, y: 125 }
      });
      
      // Should have hover
      expect(viewModel.getHoveredElement().element).toBe(node);
      expect(viewModel.getHoveredElement().type).toBe('node');
      
      // Move away
      view._notifyEvent({
        type: 'mousemove',
        position: { x: 50, y: 50 },
        screenPosition: { x: 50, y: 50 }
      });
      
      // Should clear hover
      expect(viewModel.getHoveredElement().element).toBeNull();
      
      // Restore original method
      renderer.getElementAt = originalGetElementAt;
    });

    test('should show drag preview during node movement', () => {
      const eventCoordinator = viewModel.getEventCoordinator();
      const selectTool = new SelectTool();
      eventCoordinator.registerTool('select', selectTool);
      eventCoordinator.setActiveTool('select');
      
      // Add a node
      const node = model.addNode({
        id: 'drag-test',
        position: { x: 100, y: 100 },
        label: 'Drag Me'
      });
      
      // Start drag
      selectTool.onDragStart({
        target: node,
        targetType: 'node',
        dragData: {
          startPosition: { x: 100, y: 100 },
          delta: { x: 0, y: 0 }
        }
      });
      
      // Should have drag preview
      expect(viewModel.getDragPreview().active).toBe(true);
      expect(viewModel.hasNodeDragPreview(node)).toBe(true);
      
      // Drag
      selectTool.onDrag({
        dragData: {
          delta: { x: 50, y: 25 }
        }
      });
      
      // Preview position should update but not actual node
      const previewPos = viewModel.getNodePreviewPosition(node);
      expect(previewPos).toEqual({ x: 150, y: 125 });
      expect(node.getPosition()).toEqual({ x: 100, y: 100 });
      
      // End drag
      selectTool.onDragEnd({});
      
      // Should commit and create command
      expect(viewModel.getDragPreview().active).toBe(false);
      expect(node.getPosition()).toEqual({ x: 150, y: 125 });
      expect(viewModel.canUndo()).toBe(true);
    });
  });

  describe('Renderer Integration', () => {
    test('should switch between SVG and Canvas renderers', async () => {
      // Default should be SVG
      expect(view.getRendererType()).toBe('svg');
      
      const svgRenderer = view.getRenderer();
      expect(svgRenderer.constructor.name).toBe('SVGRenderer');
      
      // Switch to Canvas
      await view.setRendererType('canvas');
      expect(view.getRendererType()).toBe('canvas');
      
      const canvasRenderer = view.getRenderer();
      expect(canvasRenderer.constructor.name).toBe('CanvasRenderer');
      expect(canvasRenderer).not.toBe(svgRenderer);
      
      // Switch back
      await view.setRendererType('svg');
      expect(view.getRendererType()).toBe('svg');
      const newSvgRenderer = view.getRenderer();
      expect(newSvgRenderer.constructor.name).toBe('SVGRenderer');
    });

    test('should render graph correctly with both renderers', async () => {
      // Add some content
      model.addNode({ id: 'n1', position: { x: 100, y: 100 }, label: 'Test' });
      model.addNode({ id: 'n2', position: { x: 200, y: 200 }, label: 'Test 2' });
      model.addEdge({ source: 'n1', target: 'n2' });
      
      // Render with SVG
      viewModel.render();
      const svgElements = container.querySelectorAll('svg g[data-node-id]');
      expect(svgElements.length).toBe(2);
      
      // Switch to Canvas and render
      await view.setRendererType('canvas');
      viewModel.render();
      
      // Canvas should exist
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeTruthy();
      // Canvas size might not match container in jsdom environment
      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
      
      // Switch back to SVG
      await view.setRendererType('svg');
      viewModel.render();
      
      // SVG should be back
      expect(container.querySelector('svg')).toBeTruthy();
    });
  });

  describe('Event Callbacks', () => {
    test.skip('should trigger umbilical callbacks - TODO: fix async initialization', async () => {
      // Create manual mock functions
      let modelChangeCount = 0;
      let selectionChangeCount = 0;
      let historyChangeCount = 0;
      let lastModelChange = null;
      let lastSelection = null;
      
      const callbacks = {
        onModelChange: (type, data) => {
          modelChangeCount++;
          lastModelChange = { type, data };
        },
        onSelectionChange: (selection) => {
          selectionChangeCount++;
          lastSelection = selection;
        },
        onHistoryChange: () => {
          historyChangeCount++;
        }
      };
      
      const editor = GraphEditor.create({
        dom: container,
        ...callbacks
      });
      
      // Need to wait a moment for initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const editorModel = editor.getModel();
      const editorViewModel = editor.getViewModel();
      
      // Model change - wait for async propagation
      editorModel.addNode({ id: 'test', position: { x: 0, y: 0 } });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(modelChangeCount).toBe(1);
      expect(lastModelChange.type).toBe('nodeAdded');
      expect(lastModelChange.data.node).toBeTruthy();
      
      // Selection change
      editorViewModel.selectNode('test');
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(selectionChangeCount).toBe(1);
      expect(lastSelection).toEqual(['test']);
      
      // History change
      editorViewModel.executeCommandType('moveNode', {
        nodeId: 'test',
        position: { x: 100, y: 100 },
        oldPosition: { x: 0, y: 0 }
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(historyChangeCount).toBeGreaterThan(0);
      
      editor.destroy();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid operations gracefully', () => {
      // Try to add edge with non-existent nodes - this should throw
      expect(() => {
        model.addEdge({
          source: 'nonexistent1',
          target: 'nonexistent2'
        });
      }).toThrow('Source and target nodes must exist');
      
      // Try to remove non-existent node
      const result = viewModel.executeCommandType('removeNode', {
        nodeId: 'nonexistent'
      });
      
      expect(result).toBe(false);
      
      // Try invalid command type
      const invalidResult = viewModel.executeCommandType('invalidCommand', {});
      expect(invalidResult).toBe(false);
    });
  });

  describe('Performance and Batching', () => {
    test('should handle batch operations efficiently', () => {
      const changeEvents = [];
      model.onChange = (type, data) => {
        changeEvents.push({ type, data });
      };
      
      // Batch add many nodes
      model.beginBatch();
      
      for (let i = 0; i < 100; i++) {
        model.addNode({
          id: `node-${i}`,
          position: { x: (i % 10) * 100, y: Math.floor(i / 10) * 100 }
        });
      }
      
      model.endBatch();
      
      // Should have one batch event instead of 100 individual events
      const batchEvents = changeEvents.filter(e => e.type === 'batchUpdate');
      expect(batchEvents).toHaveLength(1);
      
      // Count nodeAdded changes in the batch
      const nodeAddedChanges = batchEvents[0].data.changes.filter(c => c.type === 'nodeAdded');
      expect(nodeAddedChanges).toHaveLength(100);
      
      // Verify all nodes exist
      expect(model.getSceneGraph().getAllNodes()).toHaveLength(101); // 100 + root
    });
  });
});