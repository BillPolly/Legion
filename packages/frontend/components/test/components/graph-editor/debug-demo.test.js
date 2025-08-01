/**
 * Debug test for graph-editor-demo.html issues
 */

import { GraphEditor } from '../../../src/components/graph-editor/index.js';
import { SelectTool } from '../../../src/components/graph-editor/tools/SelectTool.js';
import { PanTool } from '../../../src/components/graph-editor/tools/PanTool.js';

describe('Graph Editor Demo Debug', () => {
  let container;
  let editor;
  let setupComplete = false;
  
  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    if (editor && editor.destroy) {
      editor.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  test('should create editor and initialize with sample graph like demo', async () => {
    console.log('1. Creating GraphEditor exactly like demo...');
    
    let mountCalled = false;
    let editor = null;
    
    // Simulate the exact demo pattern
    function createSampleGraph(editorInstance) {
      try {
        const editorToUse = editorInstance || editor;
        if (!editorToUse) {
          console.warn('No editor available for createSampleGraph');
          return;
        }
        
        console.log('Creating sample graph...');
        const model = editorToUse.getModel();
        
        // Create nodes with better positioning (exact copy from demo)
        model.addNode({
          id: 'start',
          position: { x: 150, y: 100 },
          label: 'Start',
          size: { width: 100, height: 60 },
          style: { fill: '#e3f2fd', stroke: '#1976d2', strokeWidth: 2 }
        });
        
        model.addNode({
          id: 'process1',
          position: { x: 350, y: 100 },
          label: 'Process A',
          size: { width: 120, height: 60 },
          style: { fill: '#f3e5f5', stroke: '#7b1fa2', strokeWidth: 2 }
        });
        
        model.addNode({
          id: 'process2',
          position: { x: 350, y: 220 },
          label: 'Process B',
          size: { width: 120, height: 60 },
          style: { fill: '#e8f5e8', stroke: '#388e3c', strokeWidth: 2 }
        });
        
        model.addNode({
          id: 'decision',
          position: { x: 550, y: 160 },
          label: 'Decision',
          size: { width: 100, height: 60 },
          style: { fill: '#fff3e0', stroke: '#f57c00', strokeWidth: 2 }
        });
        
        model.addNode({
          id: 'end',
          position: { x: 700, y: 160 },
          label: 'End',
          size: { width: 100, height: 60 },
          style: { fill: '#ffebee', stroke: '#d32f2f', strokeWidth: 2 }
        });
        
        // Create edges with labels
        model.addEdge({
          id: 'edge1',
          source: 'start',
          target: 'process1',
          label: 'begin',
          directed: true
        });
        
        model.addEdge({
          id: 'edge2', 
          source: 'start',
          target: 'process2',
          label: 'alternate',
          directed: true
        });
        
        model.addEdge({
          id: 'edge3',
          source: 'process1',
          target: 'decision',
          directed: true
        });
        
        model.addEdge({
          id: 'edge4',
          source: 'process2', 
          target: 'decision',
          directed: true
        });
        
        model.addEdge({
          id: 'edge5',
          source: 'decision',
          target: 'end',
          label: 'complete',
          directed: true
        });
        
        // Trigger initial render
        editorToUse.getViewModel().render();
        console.log('Sample graph created and rendered successfully');
        
      } catch (error) {
        console.error('Error in createSampleGraph:', error);
        throw error;
      }
    }
    
    function setupTools(editorInstance) {
      try {
        console.log('Setting up tools...');
        const coordinator = editorInstance.getViewModel().getEventCoordinator();
        
        // Register tools
        coordinator.registerTool('select', new SelectTool());
        coordinator.registerTool('pan', new PanTool());
        
        // Set default tool
        coordinator.setActiveTool('select');
        console.log('Tools setup complete');
      } catch (error) {
        console.error('Error in setupTools:', error);
        throw error;
      }
    }
    
    editor = GraphEditor.create({
      dom: container,
      theme: 'light',
      onModelChange: (type, data) => {
        console.log(`Model change: ${type}`);
      },
      onSelectionChange: (selection) => {
        console.log(`Selection changed: ${selection.join(', ') || 'none'}`);
      },
      onHistoryChange: (state) => {
        console.log('History changed');
      },
      onMount: (instance) => {
        console.log('onMount called with instance:', !!instance);
        mountCalled = true;
        setupTools(instance);
        createSampleGraph(instance);
      },
      onError: (error) => {
        console.error('GraphEditor onError:', error);
      }
    });
    
    expect(editor).toBeDefined();
    console.log('✓ GraphEditor created');
    
    // Wait for mount
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mountCalled).toBe(true);
    
    // Test the graph state - should have 5 nodes + root and 5 edges
    const model = editor.getModel();
    const nodes = model.getSceneGraph().getAllNodes();
    const edges = model.getEdges();
    
    console.log(`Nodes in graph: ${nodes.length} (should be 6: root + 5 nodes)`);
    console.log(`Edges in graph: ${edges.length} (should be 5)`);
    
    expect(nodes.length).toBe(6); // root + 5 nodes
    expect(edges.length).toBe(5);
    
    // Check specific nodes
    const startNode = model.getSceneGraph().getNodeById('start');
    const processNode = model.getSceneGraph().getNodeById('process1');
    const endNode = model.getSceneGraph().getNodeById('end');
    
    expect(startNode).toBeDefined();
    expect(processNode).toBeDefined();
    expect(endNode).toBeDefined();
    expect(startNode.getLabel()).toBe('Start');
    expect(processNode.getLabel()).toBe('Process A');
    expect(endNode.getLabel()).toBe('End');
    
    console.log('✓ Demo-style sample graph verification complete');
  });
  
  test('should handle add node operation', async () => {
    console.log('Testing add node operation...');
    
    let mountCalled = false;
    
    editor = GraphEditor.create({
      dom: container,
      onModelChange: (type, data) => {
        console.log(`Model change: ${type}`, data);
      },
      onMount: (instance) => {
        mountCalled = true;
        
        // Setup minimal tools
        const coordinator = instance.getViewModel().getEventCoordinator();
        coordinator.registerTool('select', new SelectTool());
        coordinator.setActiveTool('select');
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mountCalled).toBe(true);
    
    // Test add node like the button would do
    const viewModel = editor.getViewModel();
    
    console.log('Before add: nodes =', editor.getModel().getSceneGraph().getAllNodes().length);
    
    const result = viewModel.executeCommandType('addNode', {
      nodeData: {
        id: 'test-node-1',
        position: { x: 400, y: 300 },
        label: 'Test Node 1',
        size: { width: 100, height: 60 }
      }
    });
    
    console.log('Add node result:', result);
    console.log('After add: nodes =', editor.getModel().getSceneGraph().getAllNodes().length);
    
    // Verify node was added
    const nodes = editor.getModel().getSceneGraph().getAllNodes();
    expect(nodes.length).toBe(2); // root + 1 new node
    
    const newNode = editor.getModel().getSceneGraph().getNodeById('test-node-1');
    expect(newNode).toBeDefined();
    expect(newNode.getLabel()).toBe('Test Node 1');
    
    console.log('✓ Add node operation successful');
  });
  
  test('should handle multiple add node operations', async () => {
    console.log('Testing multiple add node operations...');
    
    editor = GraphEditor.create({
      dom: container,
      onModelChange: (type, data) => {
        console.log(`Model change: ${type}`);
      },
      onMount: (instance) => {
        const coordinator = instance.getViewModel().getEventCoordinator();
        coordinator.registerTool('select', new SelectTool());
        coordinator.setActiveTool('select');
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const viewModel = editor.getViewModel();
    let nodeCounter = 1;
    
    // Add 3 nodes like clicking the button 3 times
    for (let i = 0; i < 3; i++) {
      const nodeId = `node${nodeCounter++}`;
      const center = {
        x: 400 + Math.random() * 100 - 50,
        y: 300 + Math.random() * 100 - 50
      };
      
      console.log(`Adding node ${i + 1}: ${nodeId}`);
      
      const result = viewModel.executeCommandType('addNode', {
        nodeData: {
          id: nodeId,
          position: center,
          label: `Node ${nodeCounter}`,
          size: { width: 100, height: 60 }
        }
      });
      
      console.log(`Node ${nodeId} added:`, result !== false);
    }
    
    // Verify all nodes were added
    const nodes = editor.getModel().getSceneGraph().getAllNodes();
    console.log(`Total nodes after adding 3: ${nodes.length} (should be 4: root + 3)`);
    
    expect(nodes.length).toBe(4); // root + 3 new nodes
    
    // Verify specific nodes
    expect(editor.getModel().getSceneGraph().getNodeById('node1')).toBeDefined();
    expect(editor.getModel().getSceneGraph().getNodeById('node2')).toBeDefined();
    expect(editor.getModel().getSceneGraph().getNodeById('node3')).toBeDefined();
    
    console.log('✓ Multiple add node operations successful');
  });
});