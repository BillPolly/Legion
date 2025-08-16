/**
 * Unit tests for ToolRegistryService
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ToolRegistryService } from '../../../src/services/ToolRegistryService.js';

describe('ToolRegistryService', () => {
  let service;
  
  beforeEach(() => {
    jest.clearAllMocks();
    service = new ToolRegistryService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('getInstance', () => {
    it('should return a singleton instance', async () => {
      const instance1 = await ToolRegistryService.getInstance();
      const instance2 = await ToolRegistryService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ToolRegistryService);
    });
  });
  
  describe('getRegistry', () => {
    it('should return the registry singleton', () => {
      const registry = service.getRegistry();
      
      // The registry should be an object with expected methods
      expect(registry).toBeDefined();
      expect(typeof registry).toBe('object');
    });
  });
  
  describe('service methods delegation', () => {
    let mockRegistry;
    
    beforeEach(() => {
      // Spy on the singleton to test delegation
      mockRegistry = {
        initialize: jest.fn(),
        getLoader: jest.fn(),
        getTool: jest.fn(),
        listTools: jest.fn(),
        searchTools: jest.fn(),
        getUsageStats: jest.fn()
      };
      
      // Replace the registry reference
      service.registry = mockRegistry;
    });
    
    it('should delegate initialize to registry', async () => {
      mockRegistry.initialize.mockResolvedValue(undefined);
      
      await service.initialize();
      
      expect(mockRegistry.initialize).toHaveBeenCalledTimes(1);
    });
    
    it('should delegate getLoader to registry', async () => {
      const mockLoader = { loadModules: jest.fn() };
      mockRegistry.getLoader.mockResolvedValue(mockLoader);
      
      const loader = await service.getLoader();
      
      expect(loader).toBe(mockLoader);
      expect(mockRegistry.getLoader).toHaveBeenCalledTimes(1);
    });
    
    it('should delegate getTool to registry', async () => {
      const mockTool = { name: 'test_tool', execute: jest.fn() };
      mockRegistry.getTool.mockResolvedValue(mockTool);
      
      const tool = await service.getTool('test_tool');
      
      expect(tool).toBe(mockTool);
      expect(mockRegistry.getTool).toHaveBeenCalledWith('test_tool');
    });
    
    it('should delegate listTools to registry', async () => {
      const mockTools = [{ name: 'tool1' }, { name: 'tool2' }];
      mockRegistry.listTools.mockResolvedValue(mockTools);
      
      const tools = await service.listTools({ limit: 10 });
      
      expect(tools).toEqual(mockTools);
      expect(mockRegistry.listTools).toHaveBeenCalledWith({ limit: 10 });
    });
    
    it('should delegate searchTools to registry', async () => {
      const mockResults = [{ name: 'calculator', score: 0.9 }];
      mockRegistry.searchTools.mockResolvedValue(mockResults);
      
      const results = await service.searchTools('calc', { limit: 5 });
      
      expect(results).toEqual(mockResults);
      expect(mockRegistry.searchTools).toHaveBeenCalledWith('calc', { limit: 5 });
    });
    
    it('should delegate getStats to registry', async () => {
      const mockStats = { toolsRegistered: 10 };
      mockRegistry.getUsageStats.mockResolvedValue(mockStats);
      
      const stats = await service.getStats();
      
      expect(stats).toEqual(mockStats);
      expect(mockRegistry.getUsageStats).toHaveBeenCalledTimes(1);
    });
    
    it('should handle loadAllModulesFromFileSystem', async () => {
      const mockLoader = {
        loadModules: jest.fn().mockResolvedValue({
          loaded: [],
          failed: [],
          summary: { total: 5, loaded: 5, failed: 0 }
        })
      };
      mockRegistry.getLoader.mockResolvedValue(mockLoader);
      
      const result = await service.loadAllModulesFromFileSystem();
      
      expect(mockLoader.loadModules).toHaveBeenCalledTimes(1);
      expect(result.summary.total).toBe(5);
    });
    
    it('should handle executeTool', async () => {
      const mockTool = {
        name: 'test_tool',
        execute: jest.fn().mockResolvedValue({ success: true, data: 42 })
      };
      mockRegistry.getTool.mockResolvedValue(mockTool);
      
      const result = await service.executeTool('test_tool', { input: 'test' });
      
      expect(result).toEqual({ success: true, data: 42 });
      expect(mockTool.execute).toHaveBeenCalledWith({ input: 'test' });
    });
    
    it('should throw error for non-existent tool in executeTool', async () => {
      mockRegistry.getTool.mockResolvedValue(null);
      
      await expect(service.executeTool('unknown', {}))
        .rejects.toThrow('Tool not found: unknown');
    });
  });
});