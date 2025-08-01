/**
 * Integration tests for event handling in graph editor
 */

import { GraphEditor } from '../../../../src/components/graph-editor/index.js';
import { SelectTool } from '../../../../src/components/graph-editor/tools/SelectTool.js';
import { PanTool } from '../../../../src/components/graph-editor/tools/PanTool.js';

// Mock DOM environment
const createMockContainer = () => {
  const container = {
    offsetWidth: 800,
    offsetHeight: 600,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600
    }),
    addEventListener: function() {},
    removeEventListener: function() {},
    appendChild: function() {},
    removeChild: function() {},
    classList: {
      add: function() {},
      remove: function() {}
    },
    style: {},
    ownerDocument: {
      defaultView: global.window
    }
  };
  return container;
};

// Create mouse event
const createMouseEvent = (type, options = {}) => {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: options.x || 0,
    clientY: options.y || 0,
    button: options.button || 0,
    buttons: options.buttons || 1,
    shiftKey: options.shift || false,
    ctrlKey: options.ctrl || false,
    metaKey: options.meta || false,
    ...options
  });
};

describe('GraphEditor Event Handling Integration', () => {
  let container;
  let editor;
  let model;
  let viewModel;
  let view;
  let coordinator;
  
  beforeEach(async () => {
    // Mock document.elementFromPoint for jsdom
    if (!document.elementFromPoint) {
      document.elementFromPoint = function() { return null; };
    }
    container = createMockContainer();
    
    // Create editor
    editor = GraphEditor.create({
      dom: container,
      width: 800,
      height: 600,
      onModelChange: () => {} // Required callback
    });
    
    // Get components
    model = editor.getModel();
    viewModel = editor.getViewModel();
    view = editor.getView();
    coordinator = viewModel.getEventCoordinator();
    
    // Wait for renderer initialization
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  
  afterEach(() => {
    if (editor && editor.destroy) {
      editor.destroy();
    }
  });
  
  describe('Event Coordinator Setup', () => {
    it('should initialize event coordinator', () => {
      expect(coordinator).toBeDefined();
      expect(coordinator.getStateMachine()).toBeDefined();
    });
    
    it('should have no active tool initially', () => {
      expect(coordinator.getActiveTool()).toBeNull();
    });
    
    it('should register and activate tools', () => {
      const selectTool = new SelectTool();
      coordinator.registerTool('select', selectTool);
      
      coordinator.setActiveTool('select');
      expect(coordinator.getActiveTool()).toBe(selectTool);
      expect(selectTool.isActive()).toBe(true);
    });
    
    it('should deactivate previous tool when switching', () => {
      const selectTool = new SelectTool();
      const panTool = new PanTool();
      
      coordinator.registerTool('select', selectTool);
      coordinator.registerTool('pan', panTool);
      
      coordinator.setActiveTool('select');
      expect(selectTool.isActive()).toBe(true);
      
      coordinator.setActiveTool('pan');
      expect(selectTool.isActive()).toBe(false);
      expect(panTool.isActive()).toBe(true);
    });
  });
  
  describe('Mouse Event Handling', () => {
    let selectTool;
    
    beforeEach(() => {
      // Setup select tool
      selectTool = new SelectTool();
      coordinator.registerTool('select', selectTool);
      coordinator.setActiveTool('select');
      
      // Add a test node
      const node = model.addNode({
        x: 100,
        y: 100,
        width: 50,
        height: 50
      });
    });
    
    it('should handle click on node', () => {
      // Simulate view event
      const viewEvent = {
        type: 'mousedown',
        position: { x: 100, y: 100 },
        screenPosition: { x: 100, y: 100 },
        button: 0,
        buttons: 1,
        modifiers: {
          shift: false,
          ctrl: false,
          alt: false,
          meta: false
        }
      };
      
      // Mock hit test to return node
      const nodes = model.getSceneGraph().getAllNodes().filter(n => n.getId() !== 'root');
      const node = nodes[0];
      const mockHitResult = {
        element: node,
        type: 'node'
      };
      
      // Mock renderer getElementAt
      const renderer = view.getRenderer();
      renderer.getElementAt = function() { return mockHitResult; };
      
      // Trigger event through view
      view._notifyEvent(viewEvent);
      
      // Simulate mouseup
      view._notifyEvent({
        type: 'mouseup',
        position: { x: 100, y: 100 },
        screenPosition: { x: 100, y: 100 }
      });
      
      // Check selection
      expect(selectTool.getSelectedNodes()).toContain(node);
    });
    
    it('should handle drag to move nodes', () => {
      const nodes = model.getSceneGraph().getAllNodes().filter(n => n.getId() !== 'root');
      const node = nodes[0];
      const originalPos = node.getPosition();
      
      // Mock hit test
      const renderer = view.getRenderer();
      renderer.getElementAt = function() { 
        return { element: node, type: 'node' }; 
      };
      
      // Start drag
      view._notifyEvent({
        type: 'mousedown',
        position: { x: 100, y: 100 },
        screenPosition: { x: 100, y: 100 },
        button: 0,
        modifiers: {
          shift: false,
          ctrl: false,
          alt: false,
          meta: false
        }
      });
      
      // Move mouse
      view._notifyEvent({
        type: 'mousemove',
        position: { x: 110, y: 110 },
        screenPosition: { x: 110, y: 110 }
      });
      
      // Continue dragging
      view._notifyEvent({
        type: 'mousemove',
        position: { x: 150, y: 150 },
        screenPosition: { x: 150, y: 150 }
      });
      
      // End drag
      view._notifyEvent({
        type: 'mouseup',
        position: { x: 150, y: 150 },
        screenPosition: { x: 150, y: 150 }
      });
      
      // Check node moved
      const newPos = node.getPosition();
      expect(newPos.x).toBeCloseTo(originalPos.x + 50);
      expect(newPos.y).toBeCloseTo(originalPos.y + 50);
    });
    
    it('should handle selection box', () => {
      // Add more nodes
      const node1 = model.addNode({ x: 50, y: 50, width: 30, height: 30 });
      const node2 = model.addNode({ x: 150, y: 150, width: 30, height: 30 });
      
      // Mock hit test for background
      const renderer = view.getRenderer();
      renderer.getElementAt = function() { return null; };
      
      // Start selection box
      view._notifyEvent({
        type: 'mousedown',
        position: { x: 20, y: 20 },
        screenPosition: { x: 20, y: 20 },
        button: 0,
        modifiers: {}
      });
      
      // Drag to create selection box
      view._notifyEvent({
        type: 'mousemove',
        position: { x: 180, y: 180 },
        screenPosition: { x: 180, y: 180 }
      });
      
      // End selection
      view._notifyEvent({
        type: 'mouseup',
        position: { x: 180, y: 180 },
        screenPosition: { x: 180, y: 180 }
      });
      
      // Both nodes should be selected
      const selected = selectTool.getSelectedNodes();
      expect(selected).toContain(node1);
      expect(selected).toContain(node2);
    });
  });
  
  describe('Pan Tool', () => {
    let panTool;
    
    beforeEach(() => {
      panTool = new PanTool();
      coordinator.registerTool('pan', panTool);
      coordinator.setActiveTool('pan');
    });
    
    it('should pan viewport on drag', () => {
      const initialViewport = JSON.parse(JSON.stringify(viewModel.getViewport()));
      
      // Start pan
      view._notifyEvent({
        type: 'mousedown',
        position: { x: 100, y: 100 },
        screenPosition: { x: 100, y: 100 },
        button: 0,
        modifiers: {
          shift: false,
          ctrl: false,
          alt: false,
          meta: false
        }
      });
      
      // Drag
      view._notifyEvent({
        type: 'mousemove',
        position: { x: 150, y: 120 },
        screenPosition: { x: 150, y: 120 }
      });
      
      // End drag
      view._notifyEvent({
        type: 'mouseup',
        position: { x: 150, y: 120 },
        screenPosition: { x: 150, y: 120 }
      });
      
      // Check viewport moved
      const newViewport = viewModel.getViewport();
      expect(newViewport.pan.x).toBeCloseTo(initialViewport.pan.x + 50);
      expect(newViewport.pan.y).toBeCloseTo(initialViewport.pan.y + 20);
    });
  });
  
  describe('Tool Change Events', () => {
    it('should notify tool changes', () => {
      const selectTool = new SelectTool();
      const panTool = new PanTool();
      
      coordinator.registerTool('select', selectTool);
      coordinator.registerTool('pan', panTool);
      
      let toolChangeCalls = [];
      const toolChangeHandler = function(name, tool) {
        toolChangeCalls.push({ name, tool });
      };
      coordinator.onToolChange(toolChangeHandler);
      
      coordinator.setActiveTool('select');
      expect(toolChangeCalls.length).toBe(1);
      expect(toolChangeCalls[0].name).toBe('select');
      expect(toolChangeCalls[0].tool).toBe(selectTool);
      
      coordinator.setActiveTool('pan');
      expect(toolChangeCalls.length).toBe(2);
      expect(toolChangeCalls[1].name).toBe('pan');
      expect(toolChangeCalls[1].tool).toBe(panTool);
    });
  });
  
  describe('Interaction State Machine', () => {
    it('should track interaction states', () => {
      const stateMachine = coordinator.getStateMachine();
      
      // Initially idle
      expect(stateMachine.getState()).toBe('idle');
      
      // Simulate mouse down
      stateMachine.handleMouseDown({ x: 100, y: 100 }, 0, null, {});
      expect(stateMachine.getState()).toBe('mouseDown');
      
      // Simulate mouse up (click)
      stateMachine.handleMouseUp({ x: 100, y: 100 });
      expect(stateMachine.getState()).toBe('idle');
      expect(stateMachine.getLastAction()).toBe('backgroundClick');
    });
    
    it('should detect drag operations', () => {
      const stateMachine = coordinator.getStateMachine();
      
      // Start interaction
      stateMachine.handleMouseDown({ x: 100, y: 100 }, 0, null, {});
      
      // Move beyond drag threshold
      stateMachine.handleMouseMove({ x: 110, y: 110 });
      expect(stateMachine.getState()).toBe('dragging');
      expect(stateMachine.getLastAction()).toBe('dragStart');
      
      // Continue dragging
      stateMachine.handleMouseMove({ x: 120, y: 120 });
      expect(stateMachine.getLastAction()).toBe('drag');
      
      // End drag
      stateMachine.handleMouseUp({ x: 120, y: 120 });
      expect(stateMachine.getLastAction()).toBe('dragEnd');
    });
  });
});

// Helper to wait for next tick
const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));