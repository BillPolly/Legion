/**
 * Unit tests for QuadTree spatial indexing
 */

import { QuadTree, Rectangle } from '../../../../../src/components/graph-editor/model/QuadTree.js';

describe('QuadTree', () => {
  describe('Construction', () => {
    it('should create a quadtree with bounds', () => {
      const bounds = new Rectangle(0, 0, 1000, 1000);
      const quadTree = new QuadTree(bounds);
      
      expect(quadTree).toBeDefined();
      expect(quadTree.getBounds()).toEqual(bounds);
      expect(quadTree.getDepth()).toBe(0);
    });

    it('should configure max objects and max depth', () => {
      const bounds = new Rectangle(0, 0, 1000, 1000);
      const quadTree = new QuadTree(bounds, { maxObjects: 8, maxDepth: 6 });
      
      expect(quadTree.getMaxObjects()).toBe(8);
      expect(quadTree.getMaxDepth()).toBe(6);
    });

    it('should use default configuration', () => {
      const bounds = new Rectangle(0, 0, 1000, 1000);
      const quadTree = new QuadTree(bounds);
      
      expect(quadTree.getMaxObjects()).toBe(4);
      expect(quadTree.getMaxDepth()).toBe(5);
    });
  });

  describe('Rectangle', () => {
    it('should create rectangle with position and size', () => {
      const rect = new Rectangle(10, 20, 100, 50);
      
      expect(rect.x).toBe(10);
      expect(rect.y).toBe(20);
      expect(rect.width).toBe(100);
      expect(rect.height).toBe(50);
    });

    it('should check if rectangle contains point', () => {
      const rect = new Rectangle(10, 20, 100, 50);
      
      expect(rect.contains(50, 40)).toBe(true);
      expect(rect.contains(10, 20)).toBe(true); // Top-left corner
      expect(rect.contains(110, 70)).toBe(true); // Bottom-right corner
      expect(rect.contains(5, 40)).toBe(false); // Outside left
      expect(rect.contains(120, 40)).toBe(false); // Outside right
    });

    it('should check if rectangles intersect', () => {
      const rect1 = new Rectangle(0, 0, 100, 100);
      const rect2 = new Rectangle(50, 50, 100, 100);
      const rect3 = new Rectangle(200, 200, 100, 100);
      
      expect(rect1.intersects(rect2)).toBe(true);
      expect(rect1.intersects(rect3)).toBe(false);
      expect(rect2.intersects(rect3)).toBe(false);
    });

    it('should handle edge case intersections', () => {
      const rect1 = new Rectangle(0, 0, 100, 100);
      const rect2 = new Rectangle(100, 0, 100, 100); // Adjacent
      
      expect(rect1.intersects(rect2)).toBe(false); // Touching edges don't count
    });

    it('should convert from node bounds', () => {
      const nodeBounds = {
        x: 10,
        y: 20,
        width: 100,
        height: 50
      };
      
      const rect = Rectangle.fromBounds(nodeBounds);
      expect(rect).toEqual(new Rectangle(10, 20, 100, 50));
    });
  });

  describe('Insertion', () => {
    let quadTree;

    beforeEach(() => {
      const bounds = new Rectangle(0, 0, 1000, 1000);
      quadTree = new QuadTree(bounds);
    });

    it('should insert objects with bounds', () => {
      const obj1 = { id: 'obj1', bounds: new Rectangle(10, 10, 50, 50) };
      const obj2 = { id: 'obj2', bounds: new Rectangle(100, 100, 50, 50) };
      
      quadTree.insert(obj1);
      quadTree.insert(obj2);
      
      const all = quadTree.retrieve(new Rectangle(0, 0, 1000, 1000));
      expect(all).toContain(obj1);
      expect(all).toContain(obj2);
    });

    it('should split when exceeding max objects', () => {
      // Insert 5 objects (more than default max of 4)
      for (let i = 0; i < 5; i++) {
        quadTree.insert({
          id: `obj${i}`,
          bounds: new Rectangle(i * 100, i * 100, 50, 50)
        });
      }
      
      expect(quadTree.hasChildren()).toBe(true);
    });

    it('should not split beyond max depth', () => {
      const smallBounds = new Rectangle(0, 0, 10, 10);
      const deepTree = new QuadTree(smallBounds, { maxObjects: 1, maxDepth: 2 });
      
      // Force deep insertion
      for (let depth = 0; depth <= 3; depth++) {
        deepTree.insert({
          id: `obj${depth}`,
          bounds: new Rectangle(1, 1, 1, 1)
        });
      }
      
      // Should stop at max depth
      expect(deepTree.getMaxDepthReached()).toBeLessThanOrEqual(2);
    });

    it('should handle objects on quadrant boundaries', () => {
      const obj = {
        id: 'boundary-obj',
        bounds: new Rectangle(450, 450, 100, 100) // Spans all quadrants
      };
      
      quadTree.insert(obj);
      
      // Object should be retrievable from center area
      const results = quadTree.retrieve(new Rectangle(475, 475, 50, 50));
      expect(results).toContain(obj);
    });
  });

  describe('Retrieval', () => {
    let quadTree;
    let objects;

    beforeEach(() => {
      const bounds = new Rectangle(0, 0, 1000, 1000);
      quadTree = new QuadTree(bounds);
      
      objects = [
        { id: 'nw', bounds: new Rectangle(100, 100, 50, 50) },    // Northwest
        { id: 'ne', bounds: new Rectangle(600, 100, 50, 50) },    // Northeast
        { id: 'sw', bounds: new Rectangle(100, 600, 50, 50) },    // Southwest
        { id: 'se', bounds: new Rectangle(600, 600, 50, 50) },    // Southeast
        { id: 'center', bounds: new Rectangle(450, 450, 100, 100) } // Center
      ];
      
      objects.forEach(obj => quadTree.insert(obj));
    });

    it('should retrieve all objects with full bounds', () => {
      const results = quadTree.retrieve(new Rectangle(0, 0, 1000, 1000));
      expect(results).toHaveLength(5);
      objects.forEach(obj => expect(results).toContain(obj));
    });

    it('should retrieve objects in specific quadrant', () => {
      const nwResults = quadTree.retrieve(new Rectangle(0, 0, 400, 400));
      expect(nwResults).toContain(objects[0]); // nw
      expect(nwResults).not.toContain(objects[1]); // ne
      expect(nwResults).not.toContain(objects[2]); // sw
      expect(nwResults).not.toContain(objects[3]); // se
    });

    it('should retrieve objects at point', () => {
      const results = quadTree.retrieveAt(125, 125);
      expect(results).toContain(objects[0]); // nw
      expect(results).toHaveLength(1);
    });

    it('should retrieve center object from multiple quadrants', () => {
      // Center object spans quadrants, should be found from any overlapping area
      const results1 = quadTree.retrieve(new Rectangle(400, 400, 100, 100));
      const results2 = quadTree.retrieve(new Rectangle(500, 500, 100, 100));
      
      expect(results1).toContain(objects[4]); // center
      expect(results2).toContain(objects[4]); // center
    });

    it('should return empty array for out-of-bounds query', () => {
      const results = quadTree.retrieve(new Rectangle(2000, 2000, 100, 100));
      expect(results).toEqual([]);
    });
  });

  describe('Updates', () => {
    let quadTree;

    beforeEach(() => {
      const bounds = new Rectangle(0, 0, 1000, 1000);
      quadTree = new QuadTree(bounds);
    });

    it('should update object position', () => {
      const obj = { id: 'movable', bounds: new Rectangle(100, 100, 50, 50) };
      quadTree.insert(obj);
      
      // Verify initial position
      let results = quadTree.retrieveAt(125, 125);
      expect(results).toContain(obj);
      
      // Move object
      const newBounds = new Rectangle(600, 600, 50, 50);
      quadTree.update(obj, newBounds);
      
      // Verify old position is empty
      results = quadTree.retrieveAt(125, 125);
      expect(results).not.toContain(obj);
      
      // Verify new position
      results = quadTree.retrieveAt(625, 625);
      expect(results).toContain(obj);
    });

    it('should handle update of non-existent object', () => {
      const obj = { id: 'new', bounds: new Rectangle(100, 100, 50, 50) };
      const newBounds = new Rectangle(200, 200, 50, 50);
      
      // Should insert if not found
      quadTree.update(obj, newBounds);
      
      const results = quadTree.retrieveAt(225, 225);
      expect(results).toContain(obj);
    });
  });

  describe('Removal', () => {
    let quadTree;

    beforeEach(() => {
      const bounds = new Rectangle(0, 0, 1000, 1000);
      quadTree = new QuadTree(bounds);
    });

    it('should remove objects', () => {
      const obj1 = { id: 'obj1', bounds: new Rectangle(100, 100, 50, 50) };
      const obj2 = { id: 'obj2', bounds: new Rectangle(200, 200, 50, 50) };
      
      quadTree.insert(obj1);
      quadTree.insert(obj2);
      
      quadTree.remove(obj1);
      
      const results = quadTree.retrieve(new Rectangle(0, 0, 1000, 1000));
      expect(results).not.toContain(obj1);
      expect(results).toContain(obj2);
    });

    it('should handle removal of non-existent object', () => {
      const obj = { id: 'ghost', bounds: new Rectangle(100, 100, 50, 50) };
      
      // Should not throw
      expect(() => quadTree.remove(obj)).not.toThrow();
    });

    it('should clear all objects', () => {
      for (let i = 0; i < 10; i++) {
        quadTree.insert({
          id: `obj${i}`,
          bounds: new Rectangle(i * 50, i * 50, 40, 40)
        });
      }
      
      quadTree.clear();
      
      const results = quadTree.retrieve(new Rectangle(0, 0, 1000, 1000));
      expect(results).toEqual([]);
      expect(quadTree.hasChildren()).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of objects efficiently', () => {
      const bounds = new Rectangle(0, 0, 10000, 10000);
      const quadTree = new QuadTree(bounds, { maxObjects: 10, maxDepth: 8 });
      
      // Insert 1000 objects
      const objects = [];
      for (let i = 0; i < 1000; i++) {
        const obj = {
          id: `obj${i}`,
          bounds: new Rectangle(
            Math.random() * 9900,
            Math.random() * 9900,
            50,
            50
          )
        };
        objects.push(obj);
        quadTree.insert(obj);
      }
      
      // Query small area should return subset
      const queryArea = new Rectangle(5000, 5000, 500, 500);
      const results = quadTree.retrieve(queryArea);
      
      // Should return significantly fewer objects than total
      expect(results.length).toBeLessThan(objects.length / 10);
      
      // All returned objects should actually intersect query area
      results.forEach(obj => {
        expect(queryArea.intersects(obj.bounds)).toBe(true);
      });
    });
  });

  describe('Statistics', () => {
    it('should provide tree statistics', () => {
      const bounds = new Rectangle(0, 0, 1000, 1000);
      const quadTree = new QuadTree(bounds);
      
      // Insert objects to create some depth
      for (let i = 0; i < 20; i++) {
        quadTree.insert({
          id: `obj${i}`,
          bounds: new Rectangle(i * 40, i * 40, 30, 30)
        });
      }
      
      const stats = quadTree.getStats();
      expect(stats).toMatchObject({
        totalObjects: 20,
        maxDepthReached: expect.any(Number),
        nodeCount: expect.any(Number)
      });
      
      expect(stats.maxDepthReached).toBeGreaterThan(0);
      expect(stats.nodeCount).toBeGreaterThan(1);
    });
  });
});