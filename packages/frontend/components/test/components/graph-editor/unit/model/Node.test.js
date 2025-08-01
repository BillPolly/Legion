/**
 * Unit tests for Node class
 */

import { Node } from '../../../../../src/components/graph-editor/model/Node.js';
import { Transform } from '../../../../../src/components/graph-editor/model/Transform.js';

describe('Node', () => {
  describe('Construction', () => {
    it('should create a node with default values', () => {
      const node = new Node();
      
      expect(node).toBeDefined();
      expect(node.getId()).toMatch(/^node-\d+$/); // Auto-generated ID
      expect(node.getType()).toBe('default');
      expect(node.getLabel()).toBe('');
      expect(node.getData()).toEqual({});
      expect(node.isVisible()).toBe(true);
      expect(node.isLocked()).toBe(false);
    });

    it('should create a node with provided config', () => {
      const config = {
        id: 'custom-id',
        type: 'custom-type',
        label: 'My Node',
        data: { foo: 'bar' },
        position: { x: 100, y: 200 },
        size: { width: 150, height: 50 },
        visible: false,
        locked: true
      };
      
      const node = new Node(config);
      
      expect(node.getId()).toBe('custom-id');
      expect(node.getType()).toBe('custom-type');
      expect(node.getLabel()).toBe('My Node');
      expect(node.getData()).toEqual({ foo: 'bar' });
      expect(node.getPosition()).toEqual({ x: 100, y: 200 });
      expect(node.getSize()).toEqual({ width: 150, height: 50 });
      expect(node.isVisible()).toBe(false);
      expect(node.isLocked()).toBe(true);
    });
  });

  describe('Properties', () => {
    let node;

    beforeEach(() => {
      node = new Node({ id: 'test-node' });
    });

    it('should get and set type', () => {
      expect(node.getType()).toBe('default');
      
      node.setType('custom');
      expect(node.getType()).toBe('custom');
    });

    it('should get and set label', () => {
      expect(node.getLabel()).toBe('');
      
      node.setLabel('Test Label');
      expect(node.getLabel()).toBe('Test Label');
    });

    it('should get and set data', () => {
      expect(node.getData()).toEqual({});
      
      node.setData({ key: 'value' });
      expect(node.getData()).toEqual({ key: 'value' });
      
      // Should merge data
      node.setData({ another: 'prop' }, true);
      expect(node.getData()).toEqual({ key: 'value', another: 'prop' });
      
      // Should replace data
      node.setData({ new: 'data' });
      expect(node.getData()).toEqual({ new: 'data' });
    });

    it('should get and set visibility', () => {
      expect(node.isVisible()).toBe(true);
      
      node.setVisible(false);
      expect(node.isVisible()).toBe(false);
      
      node.toggleVisibility();
      expect(node.isVisible()).toBe(true);
    });

    it('should get and set locked state', () => {
      expect(node.isLocked()).toBe(false);
      
      node.setLocked(true);
      expect(node.isLocked()).toBe(true);
      
      node.toggleLocked();
      expect(node.isLocked()).toBe(false);
    });

    it('should prevent changes when locked', () => {
      node.setLocked(true);
      
      const originalPos = node.getPosition();
      node.setPosition(100, 100);
      
      expect(node.getPosition()).toEqual(originalPos);
    });
  });

  describe('Transform', () => {
    let node;

    beforeEach(() => {
      node = new Node({ id: 'test-node' });
    });

    it('should have a transform', () => {
      const transform = node.getTransform();
      expect(transform).toBeInstanceOf(Transform);
    });

    it('should get and set position', () => {
      expect(node.getPosition()).toEqual({ x: 0, y: 0 });
      
      node.setPosition(100, 200);
      expect(node.getPosition()).toEqual({ x: 100, y: 200 });
    });

    it('should get and set size', () => {
      expect(node.getSize()).toEqual({ width: 100, height: 50 });
      
      node.setSize(200, 100);
      expect(node.getSize()).toEqual({ width: 200, height: 100 });
    });

    it('should get and set scale', () => {
      expect(node.getScale()).toEqual({ x: 1, y: 1 });
      
      node.setScale(2, 2);
      expect(node.getScale()).toEqual({ x: 2, y: 2 });
    });

    it('should get and set rotation', () => {
      expect(node.getRotation()).toBe(0);
      
      node.setRotation(45);
      expect(node.getRotation()).toBe(45);
    });

    it('should calculate bounding box', () => {
      node.setPosition(100, 100);
      node.setSize(50, 30);
      
      const bounds = node.getBounds();
      expect(bounds).toEqual({
        x: 100,
        y: 100,
        width: 50,
        height: 30,
        left: 100,
        top: 100,
        right: 150,
        bottom: 130
      });
    });

    it('should calculate world bounds with parent transform', () => {
      const parent = new Node({ id: 'parent' });
      parent.setPosition(50, 50);
      
      node.setPosition(100, 100);
      node.setSize(50, 30);
      node.setParent(parent);
      
      const worldBounds = node.getWorldBounds();
      expect(worldBounds).toEqual({
        x: 150,
        y: 150,
        width: 50,
        height: 30,
        left: 150,
        top: 150,
        right: 200,
        bottom: 180
      });
    });
  });

  describe('Hierarchy', () => {
    let parent;
    let child1;
    let child2;

    beforeEach(() => {
      parent = new Node({ id: 'parent' });
      child1 = new Node({ id: 'child1' });
      child2 = new Node({ id: 'child2' });
    });

    it('should add and remove children', () => {
      expect(parent.getChildren()).toEqual([]);
      
      parent.addChild(child1);
      parent.addChild(child2);
      
      expect(parent.getChildren()).toEqual([child1, child2]);
      expect(child1.getParent()).toBe(parent);
      expect(child2.getParent()).toBe(parent);
    });

    it('should remove child', () => {
      parent.addChild(child1);
      parent.addChild(child2);
      
      parent.removeChild(child1);
      
      expect(parent.getChildren()).toEqual([child2]);
      expect(child1.getParent()).toBeNull();
    });

    it('should remove all children', () => {
      parent.addChild(child1);
      parent.addChild(child2);
      
      parent.removeAllChildren();
      
      expect(parent.getChildren()).toEqual([]);
      expect(child1.getParent()).toBeNull();
      expect(child2.getParent()).toBeNull();
    });

    it('should prevent circular hierarchy', () => {
      parent.addChild(child1);
      child1.addChild(child2);
      
      expect(() => child2.addChild(parent)).toThrow('Circular hierarchy detected');
    });

    it('should check ancestry', () => {
      parent.addChild(child1);
      child1.addChild(child2);
      
      expect(parent.isAncestorOf(child1)).toBe(true);
      expect(parent.isAncestorOf(child2)).toBe(true);
      expect(child1.isAncestorOf(child2)).toBe(true);
      
      expect(child2.isDescendantOf(child1)).toBe(true);
      expect(child2.isDescendantOf(parent)).toBe(true);
      expect(child1.isDescendantOf(parent)).toBe(true);
      
      expect(parent.isDescendantOf(child1)).toBe(false);
    });

    it('should get depth in hierarchy', () => {
      parent.addChild(child1);
      child1.addChild(child2);
      
      expect(parent.getDepth()).toBe(0);
      expect(child1.getDepth()).toBe(1);
      expect(child2.getDepth()).toBe(2);
    });

    it('should traverse descendants', () => {
      parent.addChild(child1);
      child1.addChild(child2);
      
      const descendants = [];
      parent.traverse((node) => descendants.push(node));
      
      expect(descendants).toEqual([parent, child1, child2]);
    });
  });

  describe('Style', () => {
    let node;

    beforeEach(() => {
      node = new Node({ id: 'test-node' });
    });

    it('should have default style', () => {
      const style = node.getStyle();
      
      expect(style).toEqual({
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 1,
        opacity: 1
      });
    });

    it('should set individual style properties', () => {
      node.setStyle('fill', '#ff0000');
      node.setStyle('strokeWidth', 2);
      
      expect(node.getStyle()).toMatchObject({
        fill: '#ff0000',
        strokeWidth: 2
      });
    });

    it('should set multiple style properties', () => {
      node.setStyles({
        fill: '#00ff00',
        stroke: '#0000ff',
        opacity: 0.5
      });
      
      expect(node.getStyle()).toMatchObject({
        fill: '#00ff00',
        stroke: '#0000ff',
        opacity: 0.5
      });
    });

    it('should reset style to defaults', () => {
      node.setStyles({
        fill: '#ff0000',
        strokeWidth: 3
      });
      
      node.resetStyle();
      
      expect(node.getStyle()).toEqual({
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 1,
        opacity: 1
      });
    });
  });

  describe('Change Tracking', () => {
    let node;
    let changes;

    beforeEach(() => {
      node = new Node({ id: 'test-node' });
      changes = [];
      node.onChange((change) => changes.push(change));
    });

    it('should emit change when properties change', () => {
      node.setLabel('New Label');
      
      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        type: 'propertyChanged',
        property: 'label',
        oldValue: '',
        newValue: 'New Label'
      });
    });

    it('should emit change when transform changes', () => {
      node.setPosition(100, 200);
      
      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        type: 'transformChanged',
        property: 'position',
        oldValue: { x: 0, y: 0 },
        newValue: { x: 100, y: 200 }
      });
    });

    it('should emit change when style changes', () => {
      node.setStyle('fill', '#ff0000');
      
      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        type: 'styleChanged',
        property: 'fill',
        oldValue: '#ffffff',
        newValue: '#ff0000'
      });
    });

    it('should track dirty state', () => {
      expect(node.isDirty()).toBe(false);
      
      node.setLabel('Changed');
      expect(node.isDirty()).toBe(true);
      
      node.clearDirty();
      expect(node.isDirty()).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      const node = new Node({
        id: 'test-node',
        type: 'custom',
        label: 'Test Node',
        position: { x: 100, y: 200 },
        size: { width: 150, height: 75 },
        data: { custom: 'data' }
      });
      
      const json = node.toJSON();
      
      expect(json).toEqual({
        id: 'test-node',
        type: 'custom',
        label: 'Test Node',
        position: { x: 100, y: 200 },
        size: { width: 150, height: 75 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        visible: true,
        locked: false,
        style: {
          fill: '#ffffff',
          stroke: '#000000',
          strokeWidth: 1,
          opacity: 1
        },
        data: { custom: 'data' }
      });
    });

    it('should deserialize from JSON', () => {
      const json = {
        id: 'test-node',
        type: 'custom',
        label: 'Test Node',
        position: { x: 100, y: 200 },
        size: { width: 150, height: 75 },
        style: { fill: '#ff0000' },
        data: { custom: 'data' }
      };
      
      const node = Node.fromJSON(json);
      
      expect(node.getId()).toBe('test-node');
      expect(node.getType()).toBe('custom');
      expect(node.getLabel()).toBe('Test Node');
      expect(node.getPosition()).toEqual({ x: 100, y: 200 });
      expect(node.getSize()).toEqual({ width: 150, height: 75 });
      expect(node.getStyle().fill).toBe('#ff0000');
      expect(node.getData()).toEqual({ custom: 'data' });
    });
  });
});