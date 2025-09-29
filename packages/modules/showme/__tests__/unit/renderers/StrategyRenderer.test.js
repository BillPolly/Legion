/**
 * Unit tests for StrategyRenderer class structure
 * Tests that StrategyRenderer extends HandleRenderer with strategy-specific features
 */

import { StrategyRenderer } from '../../../src/renderers/StrategyRenderer.js';
import { HandleRenderer } from '../../../src/renderers/HandleRenderer.js';

describe('StrategyRenderer - Class Structure', () => {
  let renderer;

  beforeEach(() => {
    renderer = new StrategyRenderer();
  });

  describe('Inheritance', () => {
    test('should extend HandleRenderer', () => {
      expect(renderer).toBeInstanceOf(HandleRenderer);
      expect(renderer).toBeInstanceOf(StrategyRenderer);
    });

    test('should inherit HandleRenderer methods', () => {
      expect(typeof renderer.renderHeader).toBe('function');
      expect(typeof renderer.renderProperties).toBe('function');
      expect(typeof renderer.renderMethods).toBe('function');
      expect(typeof renderer.renderCapabilities).toBe('function');
      expect(typeof renderer.renderActions).toBe('function');
    });

    test('should have render method', () => {
      expect(typeof renderer.render).toBe('function');
    });
  });

  describe('Strategy-Specific Methods', () => {
    test('should have buildStrategyView method', () => {
      expect(typeof renderer.buildStrategyView).toBe('function');
    });

    test('should have renderRequirements method', () => {
      expect(typeof renderer.renderRequirements).toBe('function');
    });

    test('should have renderFileInfo method', () => {
      expect(typeof renderer.renderFileInfo).toBe('function');
    });

    test('should have renderStrategyActions method', () => {
      expect(typeof renderer.renderStrategyActions).toBe('function');
    });

    test('should have displayStrategyView method', () => {
      expect(typeof renderer.displayStrategyView).toBe('function');
    });
  });

  describe('Validation', () => {
    test('should reject non-strategy Handle', async () => {
      const nonStrategyHandle = {
        toURI: () => 'legion://localhost/datastore/users/123',
        resourceType: 'datastore'
      };
      const container = document.createElement('div');

      await expect(
        renderer.render(nonStrategyHandle, container)
      ).rejects.toThrow(/must be a strategy Handle/);
    });

    test('should accept strategy Handle', async () => {
      const strategyHandle = {
        toURI: () => 'legion://localhost/strategy/test.js',
        resourceType: 'strategy',
        getMetadata: async () => ({
          strategyName: 'Test Strategy',
          strategyType: 'test',
          requiredTools: [],
          promptSchemas: []
        })
      };
      const container = document.createElement('div');

      // Should not throw
      await expect(
        renderer.render(strategyHandle, container)
      ).resolves.not.toThrow();
    });

    test('should validate Handle has toURI', async () => {
      const invalidHandle = {
        resourceType: 'strategy'
      };
      const container = document.createElement('div');

      await expect(
        renderer.render(invalidHandle, container)
      ).rejects.toThrow(/must have toURI/);
    });

    test('should validate Handle has resourceType', async () => {
      const invalidHandle = {
        toURI: () => 'legion://localhost/strategy/test.js'
      };
      const container = document.createElement('div');

      await expect(
        renderer.render(invalidHandle, container)
      ).rejects.toThrow(/must have resourceType/);
    });
  });

  describe('Constructor', () => {
    test('should instantiate without errors', () => {
      expect(renderer).toBeDefined();
      expect(renderer.name).toBe('StrategyRenderer');
    });

    test('should accept options', () => {
      const customRenderer = new StrategyRenderer({ testMode: true });
      expect(customRenderer).toBeDefined();
    });
  });
});