/**
 * Unit tests for Edge class
 */

import { Edge } from '../../../../../src/components/graph-editor/model/Edge.js';
import { Node } from '../../../../../src/components/graph-editor/model/Node.js';

describe('Edge', () => {
  let sourceNode;
  let targetNode;

  beforeEach(() => {
    sourceNode = new Node({ id: 'source' });
    targetNode = new Node({ id: 'target' });
  });

  describe('Construction', () => {
    it('should create an edge with default values', () => {
      const edge = new Edge({ source: 'source', target: 'target' });
      
      expect(edge).toBeDefined();
      expect(edge.getId()).toMatch(/^edge-\d+$/); // Auto-generated ID
      expect(edge.getSource()).toBe('source');
      expect(edge.getTarget()).toBe('target');
      expect(edge.getType()).toBe('default');
      expect(edge.getLabel()).toBe('');
      expect(edge.getData()).toEqual({});
      expect(edge.isDirected()).toBe(true);
    });

    it('should create an edge with provided config', () => {
      const config = {
        id: 'custom-edge',
        source: 'source',
        target: 'target',
        type: 'custom',
        label: 'My Edge',
        data: { weight: 1.5 },
        directed: false
      };
      
      const edge = new Edge(config);
      
      expect(edge.getId()).toBe('custom-edge');
      expect(edge.getSource()).toBe('source');
      expect(edge.getTarget()).toBe('target');
      expect(edge.getType()).toBe('custom');
      expect(edge.getLabel()).toBe('My Edge');
      expect(edge.getData()).toEqual({ weight: 1.5 });
      expect(edge.isDirected()).toBe(false);
    });

    it('should throw error without source', () => {
      expect(() => new Edge({ target: 'target' })).toThrow('Edge requires source and target');
    });

    it('should throw error without target', () => {
      expect(() => new Edge({ source: 'source' })).toThrow('Edge requires source and target');
    });
  });

  describe('Properties', () => {
    let edge;

    beforeEach(() => {
      edge = new Edge({ 
        id: 'test-edge',
        source: 'source',
        target: 'target'
      });
    });

    it('should get and set type', () => {
      expect(edge.getType()).toBe('default');
      
      edge.setType('custom');
      expect(edge.getType()).toBe('custom');
    });

    it('should get and set label', () => {
      expect(edge.getLabel()).toBe('');
      
      edge.setLabel('Test Label');
      expect(edge.getLabel()).toBe('Test Label');
    });

    it('should get and set data', () => {
      expect(edge.getData()).toEqual({});
      
      edge.setData({ key: 'value' });
      expect(edge.getData()).toEqual({ key: 'value' });
      
      // Should merge data
      edge.setData({ another: 'prop' }, true);
      expect(edge.getData()).toEqual({ key: 'value', another: 'prop' });
    });

    it('should get and set directed property', () => {
      expect(edge.isDirected()).toBe(true);
      
      edge.setDirected(false);
      expect(edge.isDirected()).toBe(false);
    });
  });

  describe('Path Management', () => {
    let edge;

    beforeEach(() => {
      edge = new Edge({ 
        id: 'test-edge',
        source: 'source',
        target: 'target'
      });
    });

    it('should have empty control points by default', () => {
      expect(edge.getControlPoints()).toEqual([]);
    });

    it('should set control points for curved edges', () => {
      const points = [
        { x: 100, y: 100 },
        { x: 150, y: 150 }
      ];
      
      edge.setControlPoints(points);
      expect(edge.getControlPoints()).toEqual(points);
    });

    it('should clear control points', () => {
      edge.setControlPoints([{ x: 100, y: 100 }]);
      edge.clearControlPoints();
      
      expect(edge.getControlPoints()).toEqual([]);
    });

    it('should calculate path with nodes', () => {
      sourceNode.setPosition(0, 0);
      sourceNode.setSize(100, 50);
      targetNode.setPosition(200, 100);
      targetNode.setSize(100, 50);
      
      const path = edge.calculatePath(sourceNode, targetNode);
      
      expect(path).toEqual({
        start: { x: 50, y: 25 },    // Center of source
        end: { x: 250, y: 125 },    // Center of target
        controlPoints: []
      });
    });

    it('should calculate path with control points', () => {
      sourceNode.setPosition(0, 0);
      targetNode.setPosition(200, 0);
      
      const controlPoints = [{ x: 100, y: 50 }];
      edge.setControlPoints(controlPoints);
      
      const path = edge.calculatePath(sourceNode, targetNode);
      
      expect(path.controlPoints).toEqual(controlPoints);
    });

    it('should calculate edge intersection with node bounds', () => {
      sourceNode.setPosition(0, 0);
      sourceNode.setSize(100, 100);
      
      const intersection = edge.getIntersectionPoint(
        { x: 50, y: 50 },     // Center
        { x: 150, y: 50 },    // External point
        sourceNode
      );
      
      expect(intersection).toEqual({ x: 100, y: 50 }); // Right edge
    });
  });

  describe('Style', () => {
    let edge;

    beforeEach(() => {
      edge = new Edge({ 
        id: 'test-edge',
        source: 'source',
        target: 'target'
      });
    });

    it('should have default style', () => {
      const style = edge.getStyle();
      
      expect(style).toEqual({
        stroke: '#999999',
        strokeWidth: 2,
        strokeDasharray: '',
        opacity: 1,
        markerEnd: 'arrow',
        markerStart: ''
      });
    });

    it('should set individual style properties', () => {
      edge.setStyle('stroke', '#ff0000');
      edge.setStyle('strokeWidth', 3);
      
      expect(edge.getStyle()).toMatchObject({
        stroke: '#ff0000',
        strokeWidth: 3
      });
    });

    it('should set dashed style', () => {
      edge.setStyle('strokeDasharray', '5,5');
      
      expect(edge.getStyle().strokeDasharray).toBe('5,5');
    });

    it('should set markers for directed edges', () => {
      edge.setDirected(true);
      edge.setStyle('markerEnd', 'arrow-filled');
      
      expect(edge.getStyle().markerEnd).toBe('arrow-filled');
    });

    it('should set markers for undirected edges', () => {
      edge.setDirected(false);
      edge.setStyle('markerEnd', '');
      edge.setStyle('markerStart', '');
      
      expect(edge.getStyle().markerEnd).toBe('');
      expect(edge.getStyle().markerStart).toBe('');
    });
  });

  describe('Validation', () => {
    let edge;

    beforeEach(() => {
      edge = new Edge({ 
        id: 'test-edge',
        source: 'source',
        target: 'target'
      });
    });

    it('should validate connection between nodes', () => {
      expect(edge.isValidConnection(sourceNode, targetNode)).toBe(true);
    });

    it('should prevent self-loops by default', () => {
      expect(edge.isValidConnection(sourceNode, sourceNode)).toBe(false);
    });

    it('should allow self-loops when configured', () => {
      edge.setData({ allowSelfLoop: true }, true);
      expect(edge.isValidConnection(sourceNode, sourceNode)).toBe(true);
    });

    it('should check if connects specific nodes', () => {
      expect(edge.connects('source', 'target')).toBe(true);
      expect(edge.connects('target', 'source')).toBe(true); // Either direction
      expect(edge.connects('source', 'other')).toBe(false);
      expect(edge.connects('other', 'target')).toBe(false);
    });

    it('should check if connected to a node', () => {
      expect(edge.isConnectedTo('source')).toBe(true);
      expect(edge.isConnectedTo('target')).toBe(true);
      expect(edge.isConnectedTo('other')).toBe(false);
    });
  });

  describe('Change Tracking', () => {
    let edge;
    let changes;

    beforeEach(() => {
      edge = new Edge({ 
        id: 'test-edge',
        source: 'source',
        target: 'target'
      });
      changes = [];
      edge.onChange((change) => changes.push(change));
    });

    it('should emit change when properties change', () => {
      edge.setLabel('New Label');
      
      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        type: 'propertyChanged',
        property: 'label',
        oldValue: '',
        newValue: 'New Label'
      });
    });

    it('should emit change when style changes', () => {
      edge.setStyle('stroke', '#ff0000');
      
      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        type: 'styleChanged',
        property: 'stroke',
        oldValue: '#999999',
        newValue: '#ff0000'
      });
    });

    it('should emit change when control points change', () => {
      const points = [{ x: 100, y: 100 }];
      edge.setControlPoints(points);
      
      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        type: 'pathChanged',
        controlPoints: points
      });
    });

    it('should track dirty state', () => {
      expect(edge.isDirty()).toBe(false);
      
      edge.setLabel('Changed');
      expect(edge.isDirty()).toBe(true);
      
      edge.clearDirty();
      expect(edge.isDirty()).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      const edge = new Edge({
        id: 'test-edge',
        source: 'source',
        target: 'target',
        type: 'custom',
        label: 'Test Edge',
        data: { weight: 1.5 },
        directed: false
      });
      
      edge.setControlPoints([{ x: 100, y: 100 }]);
      edge.setStyle('stroke', '#ff0000');
      
      const json = edge.toJSON();
      
      expect(json).toEqual({
        id: 'test-edge',
        source: 'source',
        target: 'target',
        type: 'custom',
        label: 'Test Edge',
        directed: false,
        controlPoints: [{ x: 100, y: 100 }],
        style: {
          stroke: '#ff0000',
          strokeWidth: 2,
          strokeDasharray: '',
          opacity: 1,
          markerEnd: 'arrow',
          markerStart: ''
        },
        data: { weight: 1.5 }
      });
    });

    it('should deserialize from JSON', () => {
      const json = {
        id: 'test-edge',
        source: 'source',
        target: 'target',
        type: 'custom',
        label: 'Test Edge',
        directed: false,
        controlPoints: [{ x: 100, y: 100 }],
        style: { stroke: '#ff0000' },
        data: { weight: 1.5 }
      };
      
      const edge = Edge.fromJSON(json);
      
      expect(edge.getId()).toBe('test-edge');
      expect(edge.getSource()).toBe('source');
      expect(edge.getTarget()).toBe('target');
      expect(edge.getType()).toBe('custom');
      expect(edge.getLabel()).toBe('Test Edge');
      expect(edge.isDirected()).toBe(false);
      expect(edge.getControlPoints()).toEqual([{ x: 100, y: 100 }]);
      expect(edge.getStyle().stroke).toBe('#ff0000');
      expect(edge.getData()).toEqual({ weight: 1.5 });
    });
  });
});