/**
 * Unit tests for Transform class
 */

import { Transform } from '../../../../../src/components/graph-editor/model/Transform.js';

describe('Transform', () => {
  describe('Construction', () => {
    it('should create identity transform by default', () => {
      const transform = new Transform();
      
      expect(transform.getMatrix()).toEqual([1, 0, 0, 1, 0, 0]);
      expect(transform.getPosition()).toEqual({ x: 0, y: 0 });
      expect(transform.getScale()).toEqual({ x: 1, y: 1 });
      expect(transform.getRotation()).toBe(0);
    });

    it('should create transform with initial values', () => {
      const transform = new Transform({
        position: { x: 100, y: 200 },
        scale: { x: 2, y: 2 },
        rotation: 45
      });
      
      expect(transform.getPosition()).toEqual({ x: 100, y: 200 });
      expect(transform.getScale()).toEqual({ x: 2, y: 2 });
      expect(transform.getRotation()).toBe(45);
    });
  });

  describe('Position', () => {
    let transform;

    beforeEach(() => {
      transform = new Transform();
    });

    it('should set position', () => {
      transform.setPosition(100, 200);
      
      expect(transform.getPosition()).toEqual({ x: 100, y: 200 });
      
      const matrix = transform.getMatrix();
      expect(matrix[4]).toBe(100); // tx
      expect(matrix[5]).toBe(200); // ty
    });

    it('should translate by delta', () => {
      transform.setPosition(100, 100);
      transform.translate(50, -50);
      
      expect(transform.getPosition()).toEqual({ x: 150, y: 50 });
    });
  });

  describe('Scale', () => {
    let transform;

    beforeEach(() => {
      transform = new Transform();
    });

    it('should set scale', () => {
      transform.setScale(2, 3);
      
      expect(transform.getScale()).toEqual({ x: 2, y: 3 });
    });

    it('should scale uniformly', () => {
      transform.scale(2);
      
      expect(transform.getScale()).toEqual({ x: 2, y: 2 });
    });

    it('should scale non-uniformly', () => {
      transform.scale(2, 3);
      
      expect(transform.getScale()).toEqual({ x: 2, y: 3 });
    });

    it('should accumulate scale', () => {
      transform.setScale(2, 2);
      transform.scale(1.5);
      
      expect(transform.getScale()).toEqual({ x: 3, y: 3 });
    });
  });

  describe('Rotation', () => {
    let transform;

    beforeEach(() => {
      transform = new Transform();
    });

    it('should set rotation in degrees', () => {
      transform.setRotation(45);
      
      expect(transform.getRotation()).toBe(45);
    });

    it('should rotate by delta', () => {
      transform.setRotation(30);
      transform.rotate(15);
      
      expect(transform.getRotation()).toBe(45);
    });

    it('should normalize rotation to 0-360 range', () => {
      transform.setRotation(370);
      expect(transform.getRotation()).toBe(10);
      
      transform.setRotation(-10);
      expect(transform.getRotation()).toBe(350);
    });
  });

  describe('Matrix Operations', () => {
    let transform;

    beforeEach(() => {
      transform = new Transform();
    });

    it('should calculate correct matrix for translation', () => {
      transform.setPosition(100, 200);
      
      const matrix = transform.getMatrix();
      expect(matrix).toEqual([1, 0, 0, 1, 100, 200]);
    });

    it('should calculate correct matrix for scale', () => {
      transform.setScale(2, 3);
      
      const matrix = transform.getMatrix();
      expect(matrix).toEqual([2, 0, 0, 3, 0, 0]);
    });

    it('should calculate correct matrix for rotation', () => {
      transform.setRotation(90);
      
      const matrix = transform.getMatrix();
      // For 90 degrees: cos(90) = 0, sin(90) = 1
      expect(matrix[0]).toBeCloseTo(0);
      expect(matrix[1]).toBeCloseTo(1);
      expect(matrix[2]).toBeCloseTo(-1);
      expect(matrix[3]).toBeCloseTo(0);
    });

    it('should combine transformations in correct order', () => {
      // Order: Scale -> Rotate -> Translate
      transform.setPosition(100, 100);
      transform.setScale(2, 2);
      transform.setRotation(45);
      
      const point = transform.transformPoint({ x: 10, y: 0 });
      
      // Point (10,0) scaled by 2 = (20,0)
      // Rotated 45 degrees = (14.14, 14.14)
      // Translated by (100,100) = (114.14, 114.14)
      expect(point.x).toBeCloseTo(114.14, 1);
      expect(point.y).toBeCloseTo(114.14, 1);
    });

    it('should set matrix directly', () => {
      const customMatrix = [2, 0, 0, 2, 50, 100];
      transform.setMatrix(customMatrix);
      
      expect(transform.getMatrix()).toEqual(customMatrix);
      
      // Should extract position and scale
      expect(transform.getPosition()).toEqual({ x: 50, y: 100 });
      expect(transform.getScale().x).toBeCloseTo(2);
      expect(transform.getScale().y).toBeCloseTo(2);
    });
  });

  describe('Point Transformation', () => {
    let transform;

    beforeEach(() => {
      transform = new Transform();
    });

    it('should transform point', () => {
      transform.setPosition(100, 100);
      
      const point = { x: 50, y: 50 };
      const transformed = transform.transformPoint(point);
      
      expect(transformed).toEqual({ x: 150, y: 150 });
    });

    it('should inverse transform point', () => {
      transform.setPosition(100, 100);
      transform.setScale(2, 2);
      
      const worldPoint = { x: 300, y: 300 };
      const localPoint = transform.inverseTransformPoint(worldPoint);
      
      // (300,300) - (100,100) = (200,200)
      // (200,200) / 2 = (100,100)
      expect(localPoint).toEqual({ x: 100, y: 100 });
    });

    it('should handle transform and inverse as identity', () => {
      transform.setPosition(100, 100);
      transform.setScale(2, 2);
      transform.setRotation(45);
      
      const original = { x: 50, y: 50 };
      const transformed = transform.transformPoint(original);
      const back = transform.inverseTransformPoint(transformed);
      
      expect(back.x).toBeCloseTo(original.x);
      expect(back.y).toBeCloseTo(original.y);
    });
  });

  describe('Bounds Transformation', () => {
    let transform;

    beforeEach(() => {
      transform = new Transform();
    });

    it('should transform bounds', () => {
      transform.setPosition(100, 100);
      transform.setScale(2, 2);
      
      const bounds = {
        x: 0,
        y: 0,
        width: 50,
        height: 50
      };
      
      const transformed = transform.transformBounds(bounds);
      
      expect(transformed).toEqual({
        x: 100,
        y: 100,
        width: 100,
        height: 100
      });
    });

    it('should handle rotation in bounds transformation', () => {
      transform.setRotation(45);
      
      const bounds = {
        x: 0,
        y: 0,
        width: 100,
        height: 100
      };
      
      const transformed = transform.transformBounds(bounds);
      
      // After 45 degree rotation, the bounding box should be larger
      expect(transformed.width).toBeCloseTo(141.42, 1);
      expect(transformed.height).toBeCloseTo(141.42, 1);
    });
  });

  describe('Transform Composition', () => {
    it('should multiply transforms', () => {
      const parent = new Transform({ position: { x: 100, y: 100 } });
      const child = new Transform({ position: { x: 50, y: 50 } });
      
      const combined = Transform.multiply(parent, child);
      
      expect(combined.getPosition()).toEqual({ x: 150, y: 150 });
    });

    it('should compose complex transforms', () => {
      const parent = new Transform({
        position: { x: 100, y: 100 },
        scale: { x: 2, y: 2 },
        rotation: 45
      });
      
      const child = new Transform({
        position: { x: 50, y: 0 },
        scale: { x: 0.5, y: 0.5 }
      });
      
      const combined = Transform.multiply(parent, child);
      
      // Child's position transformed by parent
      const worldPos = parent.transformPoint({ x: 50, y: 0 });
      expect(combined.getPosition().x).toBeCloseTo(worldPos.x, 1);
      expect(combined.getPosition().y).toBeCloseTo(worldPos.y, 1);
      
      // Scales multiply
      expect(combined.getScale()).toEqual({ x: 1, y: 1 });
    });
  });

  describe('Utility Methods', () => {
    let transform;

    beforeEach(() => {
      transform = new Transform();
    });

    it('should reset to identity', () => {
      transform.setPosition(100, 100);
      transform.setScale(2, 2);
      transform.setRotation(45);
      
      transform.reset();
      
      expect(transform.getMatrix()).toEqual([1, 0, 0, 1, 0, 0]);
      expect(transform.getPosition()).toEqual({ x: 0, y: 0 });
      expect(transform.getScale()).toEqual({ x: 1, y: 1 });
      expect(transform.getRotation()).toBe(0);
    });

    it('should clone transform', () => {
      transform.setPosition(100, 100);
      transform.setScale(2, 2);
      transform.setRotation(45);
      
      const clone = transform.clone();
      
      expect(clone).not.toBe(transform);
      expect(clone.getPosition()).toEqual(transform.getPosition());
      expect(clone.getScale()).toEqual(transform.getScale());
      expect(clone.getRotation()).toBe(transform.getRotation());
    });

    it('should check if transform is identity', () => {
      expect(transform.isIdentity()).toBe(true);
      
      transform.setPosition(100, 0);
      expect(transform.isIdentity()).toBe(false);
      
      transform.reset();
      transform.setScale(2, 2);
      expect(transform.isIdentity()).toBe(false);
    });

    it('should interpolate between transforms', () => {
      const from = new Transform({ position: { x: 0, y: 0 } });
      const to = new Transform({ position: { x: 100, y: 100 } });
      
      const mid = Transform.interpolate(from, to, 0.5);
      
      expect(mid.getPosition()).toEqual({ x: 50, y: 50 });
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      const transform = new Transform({
        position: { x: 100, y: 200 },
        scale: { x: 2, y: 3 },
        rotation: 45
      });
      
      const json = transform.toJSON();
      
      expect(json).toEqual({
        position: { x: 100, y: 200 },
        scale: { x: 2, y: 3 },
        rotation: 45
      });
    });

    it('should deserialize from JSON', () => {
      const json = {
        position: { x: 100, y: 200 },
        scale: { x: 2, y: 3 },
        rotation: 45
      };
      
      const transform = Transform.fromJSON(json);
      
      expect(transform.getPosition()).toEqual({ x: 100, y: 200 });
      expect(transform.getScale()).toEqual({ x: 2, y: 3 });
      expect(transform.getRotation()).toBe(45);
    });
  });
});