/**
 * Test basic module exports and imports
 */
import { describe, test, expect } from '@jest/globals';

describe('Module Exports', () => {
  test('should export main entry point', async () => {
    const module = await import('../../src/index.js');
    expect(module).toBeDefined();
  });

  test('should export createApplication function', async () => {
    const { createApplication } = await import('../../src/index.js');
    expect(createApplication).toBeDefined();
    expect(typeof createApplication).toBe('function');
  });

  test('should export component factories', async () => {
    const { components } = await import('../../src/index.js');
    expect(components).toBeDefined();
    expect(typeof components).toBe('object');
  });

  test('should export actor utilities', async () => {
    const { actors } = await import('../../src/index.js');
    expect(actors).toBeDefined();
    expect(typeof actors).toBe('object');
  });

  test('should export version information', async () => {
    const { version } = await import('../../src/index.js');
    expect(version).toBeDefined();
    expect(typeof version).toBe('string');
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});