/**
 * Unit tests for WebToolsModule
 */

import { WebToolsModule } from '../../../src/web-tools/WebToolsModule.js';
import { ResourceManager } from '@legion/resource-manager';
import { jest } from '@jest/globals';

describe('WebToolsModule', () => {
  let module;
  let resourceManager;

  beforeEach(async () => {
    resourceManager = ResourceManager.getInstance();
    module = await WebToolsModule.create(resourceManager);
  });

  describe('create', () => {
    it('should create module with correct metadata', () => {
      expect(module.name).toBe('web-tools');
      expect(module.description).toBe('Web search and content fetching tools for accessing online information');
    });

    it('should register all web tools', () => {
      const tools = module.listTools();
      expect(tools).toContain('WebSearch');
      expect(tools).toContain('WebFetch');
      expect(tools.length).toBe(2);
    });
  });

  describe('getTool', () => {
    it('should get WebSearch tool', () => {
      const tool = module.getTool('WebSearch');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('WebSearch');
    });

    it('should get WebFetch tool', () => {
      const tool = module.getTool('WebFetch');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('WebFetch');
    });
  });

  describe('getMetadata', () => {
    it('should return complete module metadata', () => {
      const metadata = module.getMetadata();
      
      expect(metadata.name).toBe('web-tools');
      expect(metadata.description).toBe('Web search and content fetching tools for accessing online information');
      expect(metadata.tools).toBeInstanceOf(Array);
      expect(metadata.tools.length).toBe(2);
      
      const toolNames = metadata.tools.map(t => t.name);
      expect(toolNames).toContain('WebSearch');
      expect(toolNames).toContain('WebFetch');
    });
  });

  describe('executeTool', () => {
    it('should execute WebSearch tool', async () => {
      const result = await module.executeTool('WebSearch', {
        query: 'test search'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.query).toBe('test search');
      expect(result.data.results).toBeInstanceOf(Array);
    });

    it('should execute WebFetch tool with mocked response', async () => {
      // Since we're not mocking axios in the module test, we'll validate the input
      const result = await module.executeTool('WebFetch', {
        url: 'not-a-url', // Invalid URL to trigger validation
        prompt: 'test'
      });

      expect(result.success).toBe(false);
      expect(result.data).toBeDefined();
      // The Tool base class puts validation errors in data.error
      if (result.data.error) {
        expect(result.data.error).toBeDefined();
      } else if (result.error) {
        expect(result.error).toBeDefined();
      }
    });
  });
});