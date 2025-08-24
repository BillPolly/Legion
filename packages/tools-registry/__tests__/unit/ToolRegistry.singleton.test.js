/**
 * Simple test to verify ToolRegistry singleton behavior
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ToolRegistry } from '../../src/index.js';

describe('ToolRegistry Singleton Quick Test', () => {
  beforeEach(() => {
    // Reset singleton before each test
    ToolRegistry.reset();
  });

  it('should create singleton instance', async () => {
    const instance = await ToolRegistry.getInstance();
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(ToolRegistry);
  }, 30000); // 30 second timeout

  it('should return same instance', async () => {
    const instance1 = await ToolRegistry.getInstance();
    const instance2 = await ToolRegistry.getInstance();
    expect(instance1).toBe(instance2);
  }, 30000);

  it('should prevent direct instantiation', () => {
    expect(() => new ToolRegistry()).toThrow();
  });

  it('should reset properly', async () => {
    const instance1 = await ToolRegistry.getInstance();
    ToolRegistry.reset();
    const instance2 = await ToolRegistry.getInstance();
    expect(instance1).not.toBe(instance2);
  }, 30000);
});