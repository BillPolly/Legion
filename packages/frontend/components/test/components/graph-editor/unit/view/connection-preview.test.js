/**
 * Connection Preview Tests
 * 
 * Tests for visual feedback when creating edges between nodes.
 */

import { GraphEditorViewModel } from '../../../../../src/components/graph-editor/viewmodel/GraphEditorViewModel.js';
import { GraphEditorModel } from '../../../../../src/components/graph-editor/model/GraphEditorModel.js';
import { GraphEditorView } from '../../../../../src/components/graph-editor/view/GraphEditorView.js';
import { SVGRenderer } from '../../../../../src/components/graph-editor/view/SVGRenderer.js';
import { EventCoordinator } from '../../../../../src/components/graph-editor/interaction/EventCoordinator.js';
import { ConnectTool } from '../../../../../src/components/graph-editor/tools/ConnectTool.js';

describe('Connection Preview', () => {
  let container;
  let model;
  let viewModel;
  let view;
  let coordinator;
  
  beforeEach(async () => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    model = new GraphEditorModel();
    view = new GraphEditorView(container);
    viewModel = new GraphEditorViewModel(model, view);
    
    // Wait for renderer to be initialized
    await new Promise(resolve => setTimeout(resolve, 0));
    
    coordinator = viewModel.getEventCoordinator();
    coordinator.registerTool('connect', new ConnectTool());
  });
  
  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  describe('Connection Preview State', () => {
    test('should show connection preview during edge creation', () => {
      // Add source node
      model.addNode({ id: 'node1', position: { x: 100, y: 100 } });
      viewModel.render();
      
      // Activate connect tool
      coordinator.setActiveTool('connect');
      
      // Start connection from node1
      const mockEvent = {
        type: 'pointerdown',
        position: { x: 100, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      };
      
      coordinator.handleEvent(mockEvent);
      
      // Connection preview should be created
      const svg = container.querySelector('svg');
      const preview = svg.querySelector('.connection-preview');
      expect(preview).toBeTruthy();
      expect(preview.tagName).toBe('line');
      expect(preview.getAttribute('stroke-dasharray')).toBe('5,5');
    });
    
    test('should update connection preview on mouse move', () => {
      // Add source node
      model.addNode({ id: 'node1', position: { x: 100, y: 100 } });
      viewModel.render();
      
      coordinator.setActiveTool('connect');
      
      // Start connection
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 100, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      // Move mouse
      coordinator.handleEvent({
        type: 'pointermove',
        position: { x: 300, y: 200 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      const preview = container.querySelector('.connection-preview');
      expect(preview.getAttribute('x2')).toBe('300');
      expect(preview.getAttribute('y2')).toBe('200');
    });
    
    test('should remove connection preview on escape', () => {
      // Add source node
      model.addNode({ id: 'node1', position: { x: 100, y: 100 } });
      viewModel.render();
      
      coordinator.setActiveTool('connect');
      
      // Start connection
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 100, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      expect(container.querySelector('.connection-preview')).toBeTruthy();
      
      // Press escape
      coordinator.handleEvent({
        type: 'keydown',
        key: 'Escape',
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      expect(container.querySelector('.connection-preview')).toBeFalsy();
    });
    
    test('should complete connection when clicking target node', () => {
      // Add nodes
      model.addNode({ id: 'node1', position: { x: 100, y: 100 } });
      model.addNode({ id: 'node2', position: { x: 300, y: 100 } });
      viewModel.render();
      
      coordinator.setActiveTool('connect');
      
      // Start connection from node1
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 100, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      expect(container.querySelector('.connection-preview')).toBeTruthy();
      
      // Click on node2
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 300, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      // Preview should be removed
      expect(container.querySelector('.connection-preview')).toBeFalsy();
      
      // Edge should be created
      const edges = model.getEdges();
      expect(edges).toHaveLength(1);
      expect(edges[0].getSource()).toBe('node1');
      expect(edges[0].getTarget()).toBe('node2');
    });
    
    test('should cancel connection when clicking empty space', () => {
      // Add source node
      model.addNode({ id: 'node1', position: { x: 100, y: 100 } });
      viewModel.render();
      
      coordinator.setActiveTool('connect');
      
      // Start connection
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 100, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      expect(container.querySelector('.connection-preview')).toBeTruthy();
      
      // Click on empty space
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 500, y: 500 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      // Preview should be removed
      expect(container.querySelector('.connection-preview')).toBeFalsy();
      
      // No edge should be created
      expect(model.getEdges()).toHaveLength(0);
    });
  });
  
  describe('Connection Preview Styling', () => {
    test('should style connection preview differently from regular edges', () => {
      // Add node and edge
      model.addNode({ id: 'node1', position: { x: 100, y: 100 } });
      model.addNode({ id: 'node2', position: { x: 300, y: 100 } });
      model.addEdge({ source: 'node1', target: 'node2' });
      viewModel.render();
      
      coordinator.setActiveTool('connect');
      
      // Start new connection
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 100, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      const preview = container.querySelector('.connection-preview');
      const regularEdge = container.querySelector('.edge');
      
      // Preview should be dashed
      expect(preview.getAttribute('stroke-dasharray')).toBe('5,5');
      expect(regularEdge.getAttribute('stroke-dasharray')).toBeNull();
      
      // Preview should be semi-transparent
      expect(preview.getAttribute('opacity')).toBe('0.7');
    });
    
    test('should show arrowhead preview for directed edges', () => {
      // Add source node
      model.addNode({ id: 'node1', position: { x: 100, y: 100 } });
      viewModel.render();
      
      coordinator.setActiveTool('connect');
      
      // Start connection
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 100, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      // Move to show preview
      coordinator.handleEvent({
        type: 'pointermove',
        position: { x: 300, y: 200 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      const svg = container.querySelector('svg');
      const markerDefs = svg.querySelector('defs');
      expect(markerDefs).toBeTruthy();
      
      const arrowMarker = markerDefs.querySelector('#arrow-preview');
      expect(arrowMarker).toBeTruthy();
      
      const preview = svg.querySelector('.connection-preview');
      expect(preview.getAttribute('marker-end')).toContain('arrow-preview');
    });
  });
  
  describe('Connection Validation', () => {
    test('should not allow self-connections', () => {
      // Add node
      model.addNode({ id: 'node1', position: { x: 100, y: 100 } });
      viewModel.render();
      
      coordinator.setActiveTool('connect');
      
      // Start connection from node1
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 100, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      // Try to connect to itself
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 100, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      // No edge should be created
      expect(model.getEdges()).toHaveLength(0);
    });
    
    test('should not create duplicate edges', () => {
      // Add nodes and existing edge
      model.addNode({ id: 'node1', position: { x: 100, y: 100 } });
      model.addNode({ id: 'node2', position: { x: 300, y: 100 } });
      model.addEdge({ source: 'node1', target: 'node2' });
      viewModel.render();
      
      coordinator.setActiveTool('connect');
      
      // Try to create duplicate edge
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 100, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 300, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      // Should still have only one edge
      expect(model.getEdges()).toHaveLength(1);
    });
  });
  
  describe('Connection Preview with Commands', () => {
    test('should create ConnectNodesCommand when completing connection', () => {
      // Add nodes
      model.addNode({ id: 'node1', position: { x: 100, y: 100 } });
      model.addNode({ id: 'node2', position: { x: 300, y: 100 } });
      viewModel.render();
      
      coordinator.setActiveTool('connect');
      
      // Track command execution
      let executedCommand = null;
      const originalExecute = viewModel.executeCommand.bind(viewModel);
      viewModel.executeCommand = (command) => {
        executedCommand = command;
        return originalExecute(command);
      };
      
      // Create connection
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 100, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 300, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      expect(executedCommand).toBeTruthy();
      expect(executedCommand.constructor.name).toBe('ConnectNodesCommand');
      expect(executedCommand.sourceNodeId).toBe('node1');
      expect(executedCommand.targetNodeId).toBe('node2');
    });
    
    test('should support undo/redo of edge creation', () => {
      // Add nodes
      model.addNode({ id: 'node1', position: { x: 100, y: 100 } });
      model.addNode({ id: 'node2', position: { x: 300, y: 100 } });
      viewModel.render();
      
      coordinator.setActiveTool('connect');
      
      // Create connection
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 100, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      coordinator.handleEvent({
        type: 'pointerdown',
        position: { x: 300, y: 100 },
        stopPropagation: () => {},
        preventDefault: () => {}
      });
      
      expect(model.getEdges()).toHaveLength(1);
      
      // Undo
      viewModel.undo();
      expect(model.getEdges()).toHaveLength(0);
      
      // Redo
      viewModel.redo();
      expect(model.getEdges()).toHaveLength(1);
    });
  });
});