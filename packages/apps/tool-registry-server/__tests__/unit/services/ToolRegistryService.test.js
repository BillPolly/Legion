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
        getTool: jest.fn(),
        searchTools: jest.fn(),
        searchModules: jest.fn(),
        getStatistics: jest.fn(),
        generatePerspectives: jest.fn()
      };
      
      // Replace the registry reference
      service.registry = mockRegistry;
    });
    
    it('should delegate getTool to registry', async () => {
      const mockTool = { name: 'test_tool', execute: jest.fn() };
      mockRegistry.getTool.mockResolvedValue(mockTool);
      
      const tool = await service.getTool('test_tool');
      
      expect(tool).toBe(mockTool);
      expect(mockRegistry.getTool).toHaveBeenCalledWith('test_tool');
    });
    
    it('should delegate searchTools to registry', async () => {
      const mockResults = [{ name: 'calculator', score: 0.9 }];
      mockRegistry.searchTools.mockResolvedValue(mockResults);
      
      const results = await service.searchTools('calc', { limit: 5 });
      
      expect(results).toEqual(mockResults);
      expect(mockRegistry.searchTools).toHaveBeenCalledWith('calc', { limit: 5 });
    });
    
    it('should delegate searchModules to registry', async () => {
      const mockModules = [{ name: 'file-module', type: 'class' }];
      mockRegistry.searchModules.mockResolvedValue(mockModules);
      
      const modules = await service.searchModules('file', { limit: 10 });
      
      expect(modules).toEqual(mockModules);
      expect(mockRegistry.searchModules).toHaveBeenCalledWith('file', { limit: 10 });
    });
    
    it('should delegate getStats to registry', async () => {
      const mockStats = { toolsRegistered: 10 };
      mockRegistry.getStatistics.mockResolvedValue(mockStats);
      
      const stats = await service.getStats();
      
      expect(stats).toEqual(mockStats);
      expect(mockRegistry.getStatistics).toHaveBeenCalledTimes(1);
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