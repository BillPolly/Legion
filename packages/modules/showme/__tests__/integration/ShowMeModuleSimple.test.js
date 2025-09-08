/**
 * Simplified Integration Tests for ShowMeModule
 * 
 * Tests module interface without starting server
 */

import { ShowMeModule } from '../../src/ShowMeModule.js';

describe('ShowMeModule Simple Integration', () => {
  let module;

  beforeAll(() => {
    module = new ShowMeModule();
  });

  describe('module interface compliance', () => {
    test('should expose all required Legion module methods', () => {
      expect(typeof module.getName).toBe('function');
      expect(typeof module.getVersion).toBe('function');
      expect(typeof module.getDescription).toBe('function');
      expect(typeof module.getTools).toBe('function');
    });

    test('should return consistent module metadata', () => {
      expect(module.getName()).toBe('ShowMe');
      expect(module.getVersion()).toMatch(/^\d+\.\d+\.\d+$/);
      expect(module.getDescription()).toContain('Generic asset display module');
    });

    test('should provide properly structured tools', () => {
      const tools = module.getTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('execute');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('outputSchema');
        expect(typeof tool.execute).toBe('function');
      });
    });
  });

  describe('tool schema validation', () => {
    test('should have valid input schema for show_asset tool', () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      const { inputSchema } = showAssetTool;
      expect(inputSchema.type).toBe('object');
      expect(inputSchema.required).toContain('asset');
      expect(inputSchema.properties).toHaveProperty('asset');
      expect(inputSchema.properties).toHaveProperty('hint');
      expect(inputSchema.properties).toHaveProperty('title');
      expect(inputSchema.properties).toHaveProperty('options');
    });

    test('should have valid output schema for show_asset tool', () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      const { outputSchema } = showAssetTool;
      expect(outputSchema.type).toBe('object');
      expect(outputSchema.required).toContain('success');
      expect(outputSchema.properties).toHaveProperty('success');
      expect(outputSchema.properties).toHaveProperty('window_id');
      expect(outputSchema.properties).toHaveProperty('detected_type');
      expect(outputSchema.properties).toHaveProperty('title');
      expect(outputSchema.properties).toHaveProperty('error');
    });

    test('should have proper hint enum values', () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      const hintEnum = showAssetTool.inputSchema.properties.hint.enum;
      expect(hintEnum).toEqual(['image', 'code', 'json', 'data', 'web', 'text']);
    });
  });
});