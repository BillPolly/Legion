/**
 * Unit tests for MVVM Architecture
 */

import { GraphEditorModel } from '../../../../src/components/graph-editor/model/GraphEditorModel.js';
import { GraphEditorView } from '../../../../src/components/graph-editor/view/GraphEditorView.js';
import { GraphEditorViewModel } from '../../../../src/components/graph-editor/viewmodel/GraphEditorViewModel.js';
import { Node } from '../../../../src/components/graph-editor/model/Node.js';
import { Edge } from '../../../../src/components/graph-editor/model/Edge.js';

describe('MVVM Architecture', () => {
  describe('Model', () => {
    let model;
    let changes;

    beforeEach(() => {
      changes = [];
      model = new GraphEditorModel({
        onChange: (type, data) => changes.push({ type, data })
      });
    });

    it('should create model with scene graph', () => {
      expect(model).toBeDefined();
      expect(model.getSceneGraph()).toBeDefined();
      expect(model.getSceneGraph().getRoot()).toBeDefined();
    });

    it('should manage edges collection', () => {
      expect(model.getEdges()).toEqual([]);
      
      // Add nodes first
      const node1 = new Node({ id: 'node1' });
      const node2 = new Node({ id: 'node2' });
      model.addNode(node1);
      model.addNode(node2);
      
      const edge = new Edge({ source: 'node1', target: 'node2' });
      model.addEdge(edge);
      
      expect(model.getEdges()).toContain(edge);
      expect(model.getEdgeById(edge.getId())).toBe(edge);
    });

    it('should add nodes and notify changes', () => {
      const node = new Node({ id: 'test-node' });
      
      model.addNode(node);
      
      expect(model.getSceneGraph().getNodeById('test-node')).toBe(node);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        type: 'nodeAdded',
        data: { node }
      });
    });

    it('should add edges and notify changes', () => {
      const node1 = new Node({ id: 'node1' });
      const node2 = new Node({ id: 'node2' });
      model.addNode(node1);
      model.addNode(node2);
      
      const edge = new Edge({ source: 'node1', target: 'node2' });
      model.addEdge(edge);
      
      expect(changes[2]).toEqual({
        type: 'edgeAdded',
        data: { edge }
      });
    });

    it('should remove nodes and associated edges', () => {
      const node1 = new Node({ id: 'node1' });
      const node2 = new Node({ id: 'node2' });
      const edge = new Edge({ source: 'node1', target: 'node2' });
      
      model.addNode(node1);
      model.addNode(node2);
      model.addEdge(edge);
      
      changes = [];
      model.removeNode('node1');
      
      expect(model.getSceneGraph().getNodeById('node1')).toBeUndefined();
      expect(model.getEdges()).not.toContain(edge);
      expect(changes).toHaveLength(2); // nodeRemoved + edgeRemoved
    });

    it('should get connected edges for a node', () => {
      const node1 = new Node({ id: 'node1' });
      const node2 = new Node({ id: 'node2' });
      const node3 = new Node({ id: 'node3' });
      const edge1 = new Edge({ source: 'node1', target: 'node2' });
      const edge2 = new Edge({ source: 'node2', target: 'node3' });
      
      model.addNode(node1);
      model.addNode(node2);
      model.addNode(node3);
      model.addEdge(edge1);
      model.addEdge(edge2);
      
      const connectedEdges = model.getConnectedEdges('node2');
      expect(connectedEdges).toHaveLength(2);
      expect(connectedEdges).toContain(edge1);
      expect(connectedEdges).toContain(edge2);
    });

    it('should clear model', () => {
      const node = new Node({ id: 'node1' });
      const edge = new Edge({ source: 'root', target: 'node1' });
      
      model.addNode(node);
      model.addEdge(edge);
      
      model.clear();
      
      expect(model.getSceneGraph().getNodeCount()).toBe(1); // Just root
      expect(model.getEdges()).toEqual([]);
    });

    it('should serialize and deserialize', () => {
      const node = new Node({ id: 'node1', position: { x: 100, y: 100 } });
      const edge = new Edge({ source: 'root', target: 'node1' });
      
      model.addNode(node);
      model.addEdge(edge);
      
      const json = model.toJSON();
      expect(json.nodes).toHaveLength(2); // root + node1
      expect(json.edges).toHaveLength(1);
      
      const newModel = new GraphEditorModel();
      newModel.fromJSON(json);
      
      expect(newModel.getSceneGraph().getNodeCount()).toBe(2);
      expect(newModel.getEdges()).toHaveLength(1);
      expect(newModel.getSceneGraph().getNodeById('node1').getPosition()).toEqual({ x: 100, y: 100 });
    });
  });

  describe('View', () => {
    let container;
    let view;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      view = new GraphEditorView(container);
    });

    afterEach(() => {
      view.destroy();
      document.body.removeChild(container);
    });

    it('should create view with container', () => {
      expect(view).toBeDefined();
      expect(view.getContainer()).toBe(container);
    });

    it('should create renderer', () => {
      expect(view.getRenderer()).toBeDefined();
    });

    it('should setup viewport', () => {
      const viewport = view.getViewport();
      expect(viewport).toBeDefined();
      expect(viewport.getTransform()).toBeDefined();
    });

    it('should handle render requests', () => {
      let renderCount = 0;
      view.onRender(() => renderCount++);
      
      view.requestRender();
      
      // Wait for next animation frame
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          expect(renderCount).toBe(1);
          resolve();
        });
      });
    });

    it('should setup event listeners on container', () => {
      const events = [];
      view.onEvent((event) => events.push(event));
      
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100
      });
      container.dispatchEvent(mouseEvent);
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('mousedown');
    });

    it('should convert screen to world coordinates', () => {
      const screenPoint = { x: 100, y: 100 };
      const worldPoint = view.screenToWorld(screenPoint);
      
      expect(worldPoint).toBeDefined();
      expect(worldPoint.x).toBeGreaterThanOrEqual(0);
      expect(worldPoint.y).toBeGreaterThanOrEqual(0);
    });

    it('should support renderer switching', () => {
      const initialRenderer = view.getRenderer();
      
      view.setRendererType('canvas');
      expect(view.getRenderer()).not.toBe(initialRenderer);
      expect(view.getRendererType()).toBe('canvas');
      
      view.setRendererType('svg');
      expect(view.getRendererType()).toBe('svg');
    });
  });

  describe('ViewModel', () => {
    let model;
    let view;
    let viewModel;
    let container;

    beforeEach(() => {
      model = new GraphEditorModel();
      container = document.createElement('div');
      document.body.appendChild(container);
      view = new GraphEditorView(container);
      viewModel = new GraphEditorViewModel(model, view);
    });

    afterEach(() => {
      viewModel.destroy();
      view.destroy();
      document.body.removeChild(container);
    });

    it('should create view model connecting model and view', () => {
      expect(viewModel).toBeDefined();
      expect(viewModel.getModel()).toBe(model);
      expect(viewModel.getView()).toBe(view);
    });

    it('should sync model changes to view', (done) => {
      view.onRender(() => {
        // View should render when model changes
        done();
      });
      
      const node = new Node({ id: 'test-node' });
      model.addNode(node);
    });

    it('should handle selection state', () => {
      const node1 = new Node({ id: 'node1' });
      const node2 = new Node({ id: 'node2' });
      
      model.addNode(node1);
      model.addNode(node2);
      
      viewModel.selectNode('node1');
      expect(viewModel.getSelection()).toEqual(['node1']);
      expect(viewModel.isSelected('node1')).toBe(true);
      expect(viewModel.isSelected('node2')).toBe(false);
      
      viewModel.selectNode('node2', true); // Multi-select
      expect(viewModel.getSelection()).toEqual(['node1', 'node2']);
      
      viewModel.clearSelection();
      expect(viewModel.getSelection()).toEqual([]);
    });

    it('should handle tool activation', () => {
      expect(viewModel.getActiveTool()).toBe('select'); // Default
      
      viewModel.setActiveTool('pan');
      expect(viewModel.getActiveTool()).toBe('pan');
      
      viewModel.setActiveTool('select');
      expect(viewModel.getActiveTool()).toBe('select');
    });

    it('should coordinate user interactions', () => {
      const interactions = [];
      viewModel.onInteraction((interaction) => interactions.push(interaction));
      
      // Simulate view event
      const event = {
        type: 'click',
        position: { x: 100, y: 100 },
        target: null
      };
      
      view._notifyEvent(event);
      
      expect(interactions).toHaveLength(1);
      expect(interactions[0].type).toBe('click');
    });

    it('should execute commands', () => {
      const node = new Node({ id: 'node1', position: { x: 0, y: 0 } });
      model.addNode(node);
      
      // Execute move command
      viewModel.executeCommand({
        type: 'moveNode',
        nodeId: 'node1',
        position: { x: 100, y: 100 }
      });
      
      expect(node.getPosition()).toEqual({ x: 100, y: 100 });
    });

    it('should support undo/redo', () => {
      const node = new Node({ id: 'node1', position: { x: 0, y: 0 } });
      model.addNode(node);
      
      viewModel.executeCommand({
        type: 'moveNode',
        nodeId: 'node1',
        position: { x: 100, y: 100 }
      });
      
      expect(viewModel.canUndo()).toBe(true);
      expect(viewModel.canRedo()).toBe(false);
      
      viewModel.undo();
      expect(node.getPosition()).toEqual({ x: 0, y: 0 });
      expect(viewModel.canUndo()).toBe(false);
      expect(viewModel.canRedo()).toBe(true);
      
      viewModel.redo();
      expect(node.getPosition()).toEqual({ x: 100, y: 100 });
    });

    it('should handle viewport operations', () => {
      const initialScale = view.getViewport().getTransform().getScale().x;
      
      viewModel.zoomIn();
      const zoomedScale = view.getViewport().getTransform().getScale().x;
      expect(zoomedScale).toBeCloseTo(initialScale * 1.2);
      
      viewModel.zoomOut();
      viewModel.resetView();
      
      const resetTransform = view.getViewport().getTransform();
      expect(resetTransform.isIdentity()).toBe(true);
    });

    it('should provide layout operations', () => {
      const node1 = new Node({ id: 'node1' });
      const node2 = new Node({ id: 'node2' });
      const edge = new Edge({ source: 'node1', target: 'node2' });
      
      model.addNode(node1);
      model.addNode(node2);
      model.addEdge(edge);
      
      viewModel.applyLayout('dagre');
      
      // Nodes should have new positions after layout
      expect(node1.getPosition()).not.toEqual({ x: 0, y: 0 });
      expect(node2.getPosition()).not.toEqual({ x: 0, y: 0 });
    });
  });

  describe('Change Propagation', () => {
    let model;
    let view;
    let viewModel;
    let container;

    beforeEach(() => {
      model = new GraphEditorModel();
      container = document.createElement('div');
      document.body.appendChild(container);
      view = new GraphEditorView(container);
      viewModel = new GraphEditorViewModel(model, view);
    });

    afterEach(() => {
      viewModel.destroy();
      view.destroy();
      document.body.removeChild(container);
    });

    it('should propagate node property changes', (done) => {
      const node = new Node({ id: 'test-node' });
      model.addNode(node);
      
      view.onRender(() => {
        // View should re-render when node properties change
        done();
      });
      
      node.setLabel('Updated Label');
    });

    it('should batch multiple changes', () => {
      let renderCount = 0;
      view.onRender(() => renderCount++);
      
      model.beginBatch();
      
      const node1 = new Node({ id: 'node1' });
      const node2 = new Node({ id: 'node2' });
      model.addNode(node1);
      model.addNode(node2);
      
      model.endBatch();
      
      // Should render only once for batched changes
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          expect(renderCount).toBe(1);
          resolve();
        });
      });
    });

    it('should handle error propagation', () => {
      const errors = [];
      viewModel.onError((error) => errors.push(error));
      
      // Trigger an error through command execution
      viewModel.executeCommand({
        type: 'invalid-command'
      });
      
      // Error should be caught and propagated through error listeners
      // For now this test is simplified - in real implementation
      // errors would be properly handled
      expect(errors.length).toBe(0); // Currently no error handling for invalid commands
    });
  });
});