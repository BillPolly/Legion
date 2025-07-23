/**
 * Unit tests for ModuleLoader
 */

import { ModuleLoader } from '../../core/ModuleLoader.js';

describe('ModuleLoader', () => {
  let mockModuleFactory;
  let loader;

  beforeEach(() => {
    mockModuleFactory = {
      createModule: jest.fn()
    };
    
    loader = new ModuleLoader(mockModuleFactory);
  });

  describe('constructor', () => {
    it('should create instance with moduleFactory', () => {
      expect(loader).toBeInstanceOf(ModuleLoader);
      expect(loader.moduleFactory).toBe(mockModuleFactory);
      expect(loader.loadedModules).toBeInstanceOf(Map);
      expect(loader.toolRegistry).toBeInstanceOf(Map);
    });
  });

  describe('loadModulesForPlan', () => {
    it('should load modules for empty plan', async () => {
      const plan = { steps: [] };
      
      await loader.loadModulesForPlan(plan);
      
      // Should have loaded mock tools
      expect(loader.toolRegistry.size).toBeGreaterThan(0);
    });

    it('should load modules for plan with actions', async () => {
      const plan = {
        steps: [
          {
            id: 'step1',
            actions: [
              { type: 'file_read', parameters: {} },
              { type: 'web_search', parameters: {} }
            ]
          }
        ]
      };
      
      await loader.loadModulesForPlan(plan);
      
      // Should have loaded required tools
      expect(loader.toolRegistry.has('file_read')).toBe(true);
      expect(loader.toolRegistry.has('web_search')).toBe(true);
    });

    it('should handle nested steps', async () => {
      const plan = {
        steps: [
          {
            id: 'parent',
            steps: [
              {
                id: 'child',
                actions: [
                  { type: 'api_call', parameters: {} }
                ]
              }
            ]
          }
        ]
      };
      
      await loader.loadModulesForPlan(plan);
      
      expect(loader.toolRegistry.has('api_call')).toBe(true);
    });

    it('should throw error for unknown tools', async () => {
      const plan = {
        steps: [
          {
            id: 'step1',
            actions: [
              { type: 'unknown_tool', parameters: {} }
            ]
          }
        ]
      };
      
      await expect(loader.loadModulesForPlan(plan)).rejects.toThrow('Required tools not found: unknown_tool');
    });
  });

  describe('getTool', () => {
    beforeEach(async () => {
      const plan = { steps: [] };
      await loader.loadModulesForPlan(plan);
    });

    it('should return tool for valid name', () => {
      const tool = loader.getTool('file_read');
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('file_read');
      expect(tool.execute).toBeInstanceOf(Function);
    });

    it('should throw error for unknown tool', () => {
      expect(() => loader.getTool('unknown_tool')).toThrow('Tool not found: unknown_tool');
    });
  });

  describe('_extractToolsFromPlan', () => {
    it('should extract tools from flat plan', () => {
      const plan = {
        steps: [
          {
            id: 'step1',
            actions: [
              { type: 'file_read' },
              { type: 'file_write' }
            ]
          }
        ]
      };
      
      const tools = loader._extractToolsFromPlan(plan);
      
      expect(tools).toEqual(['file_read', 'file_write']);
    });

    it('should extract tools from nested plan', () => {
      const plan = {
        steps: [
          {
            id: 'parent',
            steps: [
              {
                id: 'child1',
                actions: [{ type: 'tool1' }]
              },
              {
                id: 'child2',
                actions: [{ type: 'tool2' }]
              }
            ]
          }
        ]
      };
      
      const tools = loader._extractToolsFromPlan(plan);
      
      expect(tools).toEqual(['tool1', 'tool2']);
    });

    it('should deduplicate tool names', () => {
      const plan = {
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'tool1' }, { type: 'tool1' }]
          },
          {
            id: 'step2', 
            actions: [{ type: 'tool1' }]
          }
        ]
      };
      
      const tools = loader._extractToolsFromPlan(plan);
      
      expect(tools).toEqual(['tool1']);
    });

    it('should handle empty plan', () => {
      const plan = { steps: [] };
      
      const tools = loader._extractToolsFromPlan(plan);
      
      expect(tools).toEqual([]);
    });
  });
});