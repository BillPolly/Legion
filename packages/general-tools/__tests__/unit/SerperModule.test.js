/**
 * Test for SerperModule wrapper
 */

import { describe, test, expect } from '@jest/globals';
import SerperModule from '../../src/serper/SerperModule.js';

describe('SerperModule', () => {
  test('should create SerperModule with proper structure', () => {
    const module = new SerperModule();
    
    expect(module.name).toBe('serper');
    expect(module.description).toContain('Google search');
    expect(module.tools).toHaveLength(1);
    expect(module.tools[0].name).toBe('google_search');
    expect(module.tools[0].getToolDescription).toBeDefined();
  });

  test('should have proper tool description', () => {
    const module = new SerperModule();
    const tool = module.tools[0];
    const description = tool.getToolDescription();
    
    expect(description.type).toBe('function');
    expect(description.function.name).toBe('google_search_search');
    expect(description.function.parameters.required).toContain('query');
  });
});