/**
 * Unit tests for HandleRenderer class structure
 * Tests basic renderer instantiation and method signatures
 */

import { HandleRenderer } from '../../../src/renderers/HandleRenderer.js';

describe('HandleRenderer - Class Structure', () => {
  let renderer;

  beforeEach(() => {
    renderer = new HandleRenderer();
  });

  describe('Constructor', () => {
    test('should instantiate without errors', () => {
      expect(renderer).toBeInstanceOf(HandleRenderer);
    });

    test('should have render method', () => {
      expect(typeof renderer.render).toBe('function');
    });

    test('should have introspection helper methods', () => {
      expect(typeof renderer.renderHeader).toBe('function');
      expect(typeof renderer.renderProperties).toBe('function');
      expect(typeof renderer.renderMethods).toBe('function');
      expect(typeof renderer.renderCapabilities).toBe('function');
      expect(typeof renderer.renderActions).toBe('function');
    });

    test('should have display method', () => {
      expect(typeof renderer.displayInWindow).toBe('function');
    });
  });

  describe('render() Method Signature', () => {
    test('should accept handle and container parameters', async () => {
      const mockHandle = {
        toURI: () => 'legion://localhost/test/resource',
        resourceType: 'test'
      };
      const mockContainer = document.createElement('div');

      // Should not throw with valid parameters
      await expect(
        renderer.render(mockHandle, mockContainer)
      ).resolves.not.toThrow();
    });

    test('should throw error for missing handle', async () => {
      const mockContainer = document.createElement('div');

      await expect(
        renderer.render(null, mockContainer)
      ).rejects.toThrow(/Handle is required/);
    });

    test('should throw error for missing container', async () => {
      const mockHandle = {
        toURI: () => 'legion://localhost/test/resource',
        resourceType: 'test'
      };

      await expect(
        renderer.render(mockHandle, null)
      ).rejects.toThrow(/Container is required/);
    });

    test('should throw error for handle without toURI', async () => {
      const invalidHandle = {
        resourceType: 'test'
      };
      const mockContainer = document.createElement('div');

      await expect(
        renderer.render(invalidHandle, mockContainer)
      ).rejects.toThrow(/Handle must have toURI/);
    });

    test('should throw error for handle without resourceType', async () => {
      const invalidHandle = {
        toURI: () => 'legion://localhost/test/resource'
      };
      const mockContainer = document.createElement('div');

      await expect(
        renderer.render(invalidHandle, mockContainer)
      ).rejects.toThrow(/Handle must have resourceType/);
    });
  });

  describe('Error Validation', () => {
    test('should validate handle is not null', async () => {
      const container = document.createElement('div');

      await expect(
        renderer.render(null, container)
      ).rejects.toThrow();
    });

    test('should validate handle is not undefined', async () => {
      const container = document.createElement('div');

      await expect(
        renderer.render(undefined, container)
      ).rejects.toThrow();
    });

    test('should validate container is DOM element', async () => {
      const handle = {
        toURI: () => 'legion://localhost/test/resource',
        resourceType: 'test'
      };

      await expect(
        renderer.render(handle, {})
      ).rejects.toThrow(/Container must be a DOM element/);
    });

    test('should validate container is not string', async () => {
      const handle = {
        toURI: () => 'legion://localhost/test/resource',
        resourceType: 'test'
      };

      await expect(
        renderer.render(handle, 'not-a-dom-element')
      ).rejects.toThrow(/Container must be a DOM element/);
    });
  });
});