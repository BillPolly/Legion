/**
 * Unit Tests for ShowMeModule
 * 
 * Tests the core module class that registers tools and integrates with Legion framework
 */

import { ShowMeModule } from '../../src/ShowMeModule.js';

describe('ShowMeModule', () => {
  let module;

  beforeEach(() => {
    module = new ShowMeModule({ testMode: true });
  });

  describe('constructor', () => {
    test('should initialize with correct module metadata', () => {
      expect(module.getName()).toBe('ShowMe');
      expect(module.getVersion()).toBe('1.0.0');
      expect(module.getDescription()).toContain('Generic asset display module');
    });

    test('should initialize tools array', () => {
      const tools = module.getTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('getTools', () => {
    test('should return array of tool objects', () => {
      const tools = module.getTools();
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('execute');
        expect(typeof tool.execute).toBe('function');
      });
    });

    test('should include ShowAssetTool', () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      expect(showAssetTool).toBeDefined();
      expect(showAssetTool.description).toContain('Display asset');
    });

    test('should include input and output schemas for all tools', () => {
      const tools = module.getTools();
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('outputSchema');
        expect(typeof tool.inputSchema).toBe('object');
        expect(typeof tool.outputSchema).toBe('object');
      });
    });
  });

  describe('tool integration', () => {
    test('should provide tools that accept asset and hint parameters', () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      expect(showAssetTool.inputSchema.properties).toHaveProperty('asset');
      expect(showAssetTool.inputSchema.properties).toHaveProperty('hint');
      expect(showAssetTool.inputSchema.required).toContain('asset');
    });

    test('should provide tools that return success and window_id', () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      expect(showAssetTool.outputSchema.properties).toHaveProperty('success');
      expect(showAssetTool.outputSchema.properties).toHaveProperty('window_id');
      expect(showAssetTool.outputSchema.required).toContain('success');
    });
  });

  describe('Legion framework integration', () => {
    test('should follow Legion module patterns', () => {
      // Test standard Legion module interface
      expect(typeof module.getName).toBe('function');
      expect(typeof module.getVersion).toBe('function');
      expect(typeof module.getDescription).toBe('function');
      expect(typeof module.getTools).toBe('function');
    });

    test('should provide module metadata', () => {
      const metadata = {
        name: module.getName(),
        version: module.getVersion(),
        description: module.getDescription()
      };

      expect(metadata.name).toBe('ShowMe');
      expect(metadata.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic version format
      expect(metadata.description).toBeTruthy();
      expect(metadata.description.length).toBeGreaterThan(10);
    });
  });

  describe('error handling', () => {
    test('should handle tool execution errors gracefully', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      // Test with invalid input
      const result = await showAssetTool.execute({});
      
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
    });

    test('should validate required parameters', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      // Test without required 'asset' parameter
      const result = await showAssetTool.execute({ hint: 'image' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('asset');
    });
  });

  describe('asset type detection integration', () => {
    test('should integrate AssetTypeDetector for automatic type detection', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      // Test with asset that can be auto-detected
      const result = await showAssetTool.execute({
        asset: { key: 'value' } // Should be detected as JSON
      });
      
      expect(result).toHaveProperty('detected_type');
      expect(result.detected_type).toBe('json');
    });

    test('should respect explicit hint over auto-detection when valid', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      // Test with JSON asset but text hint
      const result = await showAssetTool.execute({
        asset: { key: 'value' },
        hint: 'text' // Override auto-detection
      });
      
      expect(result.detected_type).toBe('text');
    });

    test('should ignore invalid hint and use auto-detection', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      // Test with JSON asset but incompatible hint
      const result = await showAssetTool.execute({
        asset: { key: 'value' },
        hint: 'image' // Invalid hint for JSON data
      });
      
      expect(result.detected_type).toBe('json'); // Should fallback to auto-detection
    });
  });
});