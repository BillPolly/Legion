/**
 * Save/Load Integration Tests
 * 
 * Tests graph serialization and deserialization functionality.
 */

import { GraphEditor } from '../../../../src/components/graph-editor/index.js';

describe('Graph Editor Save/Load', () => {
  let container;
  let editor;
  
  beforeEach(async () => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    editor = GraphEditor.create({
      dom: container,
      onModelChange: () => {}
    });
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  
  afterEach(() => {
    if (editor) {
      editor.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  describe('Graph Serialization', () => {
    test('should serialize empty graph', () => {
      const data = editor.getModel().toJSON();
      
      expect(data).toBeDefined();
      expect(data.nodes).toBeInstanceOf(Array);
      expect(data.edges).toBeInstanceOf(Array);
      expect(data.nodes).toHaveLength(1); // Just root node
      expect(data.edges).toHaveLength(0);
    });
    
    test('should serialize nodes with all properties', () => {
      const model = editor.getModel();
      
      // Add nodes with various properties
      model.addNode({
        id: 'node1',
        position: { x: 100, y: 200 },
        size: { width: 120, height: 80 },
        label: 'Test Node',
        style: { fill: '#ff0000', stroke: '#000000' },
        data: { custom: 'value', number: 42 }
      });
      
      model.addNode({
        id: 'node2',
        position: { x: 300, y: 200 },
        parentId: 'node1'
      });
      
      const data = model.toJSON();
      
      expect(data.nodes).toHaveLength(3); // root + 2 nodes
      
      const node1Data = data.nodes.find(n => n.id === 'node1');
      expect(node1Data).toBeDefined();
      expect(node1Data.position).toEqual({ x: 100, y: 200 });
      expect(node1Data.size).toEqual({ width: 120, height: 80 });
      expect(node1Data.label).toBe('Test Node');
      expect(node1Data.style.fill).toBe('#ff0000');
      expect(node1Data.style.stroke).toBe('#000000');
      expect(node1Data.data).toEqual({ custom: 'value', number: 42 });
      
      const node2Data = data.nodes.find(n => n.id === 'node2');
      expect(node2Data).toBeDefined();
      expect(node2Data.parentId).toBe('node1');
    });
    
    test('should serialize edges with all properties', () => {
      const model = editor.getModel();
      
      // Add nodes and edges
      model.addNode({ id: 'n1', position: { x: 0, y: 0 } });
      model.addNode({ id: 'n2', position: { x: 100, y: 0 } });
      model.addNode({ id: 'n3', position: { x: 200, y: 0 } });
      
      model.addEdge({
        id: 'e1',
        source: 'n1',
        target: 'n2',
        label: 'Connection',
        directed: true,
        style: { stroke: '#0000ff', strokeWidth: 2 },
        data: { weight: 0.5 }
      });
      
      model.addEdge({
        source: 'n2',
        target: 'n3',
        directed: false
      });
      
      const data = model.toJSON();
      
      expect(data.edges).toHaveLength(2);
      
      const edge1Data = data.edges.find(e => e.id === 'e1');
      expect(edge1Data).toBeDefined();
      expect(edge1Data.source).toBe('n1');
      expect(edge1Data.target).toBe('n2');
      expect(edge1Data.label).toBe('Connection');
      expect(edge1Data.directed).toBe(true);
      expect(edge1Data.style.stroke).toBe('#0000ff');
      expect(edge1Data.style.strokeWidth).toBe(2);
      expect(edge1Data.data).toEqual({ weight: 0.5 });
    });
    
    test('should include metadata in serialization', () => {
      const model = editor.getModel();
      model.addNode({ id: 'test', position: { x: 0, y: 0 } });
      
      const data = model.toJSON();
      
      expect(data.metadata).toBeDefined();
      expect(data.metadata.version).toBeDefined();
      expect(data.metadata.timestamp).toBeDefined();
      expect(new Date(data.metadata.timestamp)).toBeInstanceOf(Date);
    });
  });
  
  describe('Graph Deserialization', () => {
    test('should load empty graph', () => {
      const model = editor.getModel();
      
      const emptyData = {
        nodes: [{ id: 'root', position: { x: 0, y: 0 } }],
        edges: []
      };
      
      model.fromJSON(emptyData);
      
      expect(model.getSceneGraph().getAllNodes()).toHaveLength(1);
      expect(model.getEdges()).toHaveLength(0);
    });
    
    test('should load nodes with all properties', () => {
      const model = editor.getModel();
      
      const data = {
        nodes: [
          { id: 'root', position: { x: 0, y: 0 } },
          {
            id: 'node1',
            position: { x: 100, y: 200 },
            size: { width: 150, height: 100 },
            label: 'Loaded Node',
            style: { fill: '#00ff00' },
            data: { loaded: true }
          }
        ],
        edges: []
      };
      
      model.fromJSON(data);
      
      const node = model.getSceneGraph().getNodeById('node1');
      expect(node).toBeDefined();
      expect(node.getPosition()).toEqual({ x: 100, y: 200 });
      expect(node.getSize()).toEqual({ width: 150, height: 100 });
      expect(node.getLabel()).toBe('Loaded Node');
      expect(node.getStyle().fill).toBe('#00ff00');
      expect(node.getData()).toEqual({ loaded: true });
    });
    
    test('should load edges with all properties', () => {
      const model = editor.getModel();
      
      const data = {
        nodes: [
          { id: 'root', position: { x: 0, y: 0 } },
          { id: 'n1', position: { x: 0, y: 0 } },
          { id: 'n2', position: { x: 100, y: 0 } }
        ],
        edges: [
          {
            id: 'e1',
            source: 'n1',
            target: 'n2',
            label: 'Test Edge',
            directed: true,
            style: { strokeWidth: 3 }
          }
        ]
      };
      
      model.fromJSON(data);
      
      const edges = model.getEdges();
      expect(edges).toHaveLength(1);
      
      const edge = edges[0];
      expect(edge.getId()).toBe('e1');
      expect(edge.getSource()).toBe('n1');
      expect(edge.getTarget()).toBe('n2');
      expect(edge.getLabel()).toBe('Test Edge');
      expect(edge.isDirected()).toBe(true);
      expect(edge.getStyle().strokeWidth).toBe(3);
    });
    
    test('should restore node hierarchy', () => {
      const model = editor.getModel();
      
      const data = {
        nodes: [
          { id: 'root', position: { x: 0, y: 0 } },
          { id: 'parent', position: { x: 100, y: 100 } },
          { id: 'child1', position: { x: 50, y: 50 }, parentId: 'parent' },
          { id: 'child2', position: { x: 150, y: 50 }, parentId: 'parent' }
        ],
        edges: []
      };
      
      model.fromJSON(data);
      
      const parent = model.getSceneGraph().getNodeById('parent');
      const child1 = model.getSceneGraph().getNodeById('child1');
      const child2 = model.getSceneGraph().getNodeById('child2');
      
      expect(parent).toBeDefined();
      expect(child1).toBeDefined();
      expect(child2).toBeDefined();
      
      expect(child1.getParent()).toBe(parent);
      expect(child2.getParent()).toBe(parent);
      expect(parent.getChildren()).toContain(child1);
      expect(parent.getChildren()).toContain(child2);
    });
    
    test('should clear existing graph before loading', () => {
      const model = editor.getModel();
      
      // Add initial content
      model.addNode({ id: 'existing', position: { x: 0, y: 0 } });
      model.addEdge({ source: 'root', target: 'existing' });
      
      expect(model.getSceneGraph().getAllNodes()).toHaveLength(2);
      expect(model.getEdges()).toHaveLength(1);
      
      // Load new content
      const data = {
        nodes: [
          { id: 'root', position: { x: 0, y: 0 } },
          { id: 'new', position: { x: 100, y: 100 } }
        ],
        edges: []
      };
      
      model.fromJSON(data);
      
      // Old content should be gone
      expect(model.getSceneGraph().getNodeById('existing')).toBeUndefined();
      expect(model.getSceneGraph().getNodeById('new')).toBeDefined();
      expect(model.getEdges()).toHaveLength(0);
    });
  });
  
  describe('Round-trip Save/Load', () => {
    test('should preserve graph structure through save/load cycle', () => {
      const model = editor.getModel();
      
      // Create complex graph
      model.addNode({ id: 'n1', position: { x: 0, y: 0 }, label: 'Node 1' });
      model.addNode({ id: 'n2', position: { x: 100, y: 0 }, label: 'Node 2' });
      model.addNode({ id: 'n3', position: { x: 200, y: 0 }, label: 'Node 3' });
      model.addNode({ id: 'n4', position: { x: 150, y: 100 }, parentId: 'n3' });
      
      model.addEdge({ id: 'e1', source: 'n1', target: 'n2' });
      model.addEdge({ id: 'e2', source: 'n2', target: 'n3', directed: true });
      model.addEdge({ id: 'e3', source: 'n3', target: 'n4' });
      
      // Save
      const savedData = model.toJSON();
      
      // Clear and reload
      model.clear();
      expect(model.getSceneGraph().getAllNodes()).toHaveLength(1); // Just root
      
      model.fromJSON(savedData);
      
      // Verify structure is restored
      expect(model.getSceneGraph().getAllNodes()).toHaveLength(5); // root + 4 nodes
      expect(model.getEdges()).toHaveLength(3);
      
      const n3 = model.getSceneGraph().getNodeById('n3');
      const n4 = model.getSceneGraph().getNodeById('n4');
      expect(n4.getParent()).toBe(n3);
      
      const e2 = model.getEdges().find(e => e.getId() === 'e2');
      expect(e2.isDirected()).toBe(true);
    });
    
    test('should preserve custom data through save/load', () => {
      const model = editor.getModel();
      
      // Create nodes with custom data
      const customData = {
        type: 'process',
        metadata: {
          author: 'test',
          created: new Date().toISOString(),
          tags: ['important', 'verified']
        },
        properties: {
          color: 'blue',
          priority: 1
        }
      };
      
      model.addNode({
        id: 'custom',
        position: { x: 0, y: 0 },
        data: customData
      });
      
      // Save and reload
      const saved = model.toJSON();
      model.clear();
      model.fromJSON(saved);
      
      // Verify custom data is preserved
      const node = model.getSceneGraph().getNodeById('custom');
      const loadedData = node.getData();
      
      expect(loadedData).toEqual(customData);
      expect(loadedData.metadata.tags).toEqual(['important', 'verified']);
    });
  });
  
  describe('Error Handling', () => {
    test('should handle invalid JSON gracefully', () => {
      const model = editor.getModel();
      
      // Add some content
      model.addNode({ id: 'test', position: { x: 0, y: 0 } });
      
      // Try to load invalid data
      expect(() => {
        model.fromJSON(null);
      }).toThrow();
      
      expect(() => {
        model.fromJSON('not an object');
      }).toThrow();
      
      expect(() => {
        model.fromJSON({ nodes: 'not an array' });
      }).toThrow();
      
      // Original content should still be there
      expect(model.getSceneGraph().getNodeById('test')).toBeDefined();
    });
    
    test('should skip invalid nodes and edges', () => {
      const model = editor.getModel();
      
      const data = {
        nodes: [
          { id: 'root', position: { x: 0, y: 0 } },
          { id: 'valid', position: { x: 100, y: 100 } },
          { id: 'invalid' }, // Missing position
          { position: { x: 200, y: 200 } } // Missing id
        ],
        edges: [
          { id: 'e1', source: 'valid', target: 'nonexistent' }, // Invalid target
          { id: 'e2', source: 'root', target: 'valid' } // Valid
        ]
      };
      
      // Should not throw
      model.fromJSON(data);
      
      // Valid content should be loaded
      expect(model.getSceneGraph().getNodeById('valid')).toBeDefined();
      expect(model.getSceneGraph().getNodeById('invalid')).toBeUndefined();
      
      // Only valid edge should be loaded
      expect(model.getEdges()).toHaveLength(1);
      expect(model.getEdges()[0].getId()).toBe('e2');
    });
  });
  
  describe('Integration with Commands', () => {
    test('should support undo after load', () => {
      const viewModel = editor.getViewModel();
      const model = editor.getModel();
      
      // Create initial state
      viewModel.executeCommandType('addNode', {
        nodeData: { id: 'n1', position: { x: 0, y: 0 } }
      });
      
      // Save state
      const saved = model.toJSON();
      
      // Make changes
      viewModel.executeCommandType('addNode', {
        nodeData: { id: 'n2', position: { x: 100, y: 0 } }
      });
      
      expect(model.getSceneGraph().getAllNodes()).toHaveLength(3); // root + 2
      
      // Load saved state
      model.fromJSON(saved);
      expect(model.getSceneGraph().getAllNodes()).toHaveLength(2); // root + 1
      
      // Should still be able to execute new commands
      viewModel.executeCommandType('addNode', {
        nodeData: { id: 'n3', position: { x: 200, y: 0 } }
      });
      
      expect(model.getSceneGraph().getAllNodes()).toHaveLength(3);
      
      // And undo them
      viewModel.undo();
      expect(model.getSceneGraph().getAllNodes()).toHaveLength(2);
    });
  });
});