/**
 * Unit tests for ServerToolRegistryActor
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ServerToolRegistryActor } from '../../../src/actors/ServerToolRegistryActor.js';

describe('ServerToolRegistryActor', () => {
  let actor;
  let mockRegistryService;
  let mockRemoteActor;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock registry service with required methods
    mockRegistryService = {
      getTool: jest.fn(),
      executeTool: jest.fn(),
      searchTools: jest.fn(),
      searchModules: jest.fn().mockResolvedValue([]),
      getStats: jest.fn(),
      generatePerspectives: jest.fn(),
      getRegistry: jest.fn().mockReturnValue({
        generatePerspectives: jest.fn(),
        loadAllModules: jest.fn(),
        clearAll: jest.fn()
      })
    };
    
    // Set up the actor's registry property to point to the mock
    actor = new ServerToolRegistryActor(mockRegistryService);
    actor.registry = mockRegistryService.getRegistry();
    
    // Create mock remote actor
    mockRemoteActor = {
      receive: jest.fn()
    };
    
    // Actor instance created above with proper mock registry
    actor.setRemoteActor(mockRemoteActor);
  });
  
  describe('receive method', () => {
    it('should handle tools:search message', async () => {
      const mockTools = [
        { name: 'tool1', description: 'Tool 1' },
        { name: 'tool2', description: 'Tool 2' }
      ];
      mockRegistryService.searchTools.mockResolvedValue(mockTools);
      
      await actor.receive({ 
        type: 'tools:search',
        data: { query: 'calculator', options: { limit: 10 } }
      });
      
      expect(mockRegistryService.searchTools).toHaveBeenCalledWith('calculator', { limit: 10 });
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'tools:searchResult',
        data: { query: 'calculator', tools: mockTools, count: 2 }
      });
    });
    
    it('should handle modules:search message', async () => {
      const mockModules = [
        { name: 'module1', type: 'class' },
        { name: 'module2', type: 'function' }
      ];
      mockRegistryService.searchModules.mockResolvedValue(mockModules);
      
      await actor.receive({ 
        type: 'modules:search',
        data: { query: 'file', options: { limit: 50 } }
      });
      
      expect(mockRegistryService.searchModules).toHaveBeenCalledWith('file', { limit: 50 });
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'modules:searchResult',
        data: { query: 'file', modules: mockModules, count: 2 }
      });
    });
    
    it('should handle registry:loadAll message', async () => {
      const mockResult = {
        loaded: 2,
        failed: 0,
        total: 2,
        modules: ['module1', 'module2']
      };
      
      // Set up the mock directly on the actor's registry
      actor.registry.loadAllModules.mockResolvedValue(mockResult);
      
      await actor.receive({ type: 'registry:loadAll' });
      
      expect(actor.registry.loadAllModules).toHaveBeenCalled();
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'registry:loadAllComplete'
        })
      );
    });
    
    it('should handle registry:stats message', async () => {
      const mockStats = {
        toolsRegistered: 25,
        modulesLoaded: 5,
        executionCount: 100
      };
      
      mockRegistryService.getStats.mockResolvedValue(mockStats);
      
      await actor.receive({ type: 'registry:stats' });
      
      expect(mockRegistryService.getStats).toHaveBeenCalled();
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'registry:stats',
        data: expect.objectContaining({
          ...mockStats,
          timestamp: expect.any(String)
        })
      });
    });
    
    it('should handle tool:execute message', async () => {
      const mockResult = { success: true, data: 42 };
      mockRegistryService.executeTool.mockResolvedValue(mockResult);
      
      await actor.receive({
        type: 'tool:execute',
        data: {
          toolName: 'calculator',
          params: { expression: '2 + 2' }
        }
      });
      
      expect(mockRegistryService.executeTool).toHaveBeenCalledWith(
        'calculator',
        { expression: '2 + 2' }
      );
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'tool:executed',
        data: {
          toolName: 'calculator',
          params: { expression: '2 + 2' },
          result: mockResult
        }
      });
    });
    
    it('should handle tool:execute error', async () => {
      const error = new Error('Execution failed');
      mockRegistryService.executeTool.mockRejectedValue(error);
      
      await actor.receive({
        type: 'tool:execute',
        data: {
          toolName: 'broken',
          params: {}
        }
      });
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'tool:executed',
        data: {
          toolName: 'broken',
          params: {},
          error: 'Execution failed',
          success: false
        }
      });
    });
    
    it('should handle registry:generatePerspectives message', async () => {
      const mockResult = { generated: 10, failed: 0 };
      mockRegistryService.generatePerspectives.mockResolvedValue(mockResult);
      
      await actor.receive({ type: 'registry:generatePerspectives' });
      
      expect(mockRegistryService.generatePerspectives).toHaveBeenCalled();
      expect(mockRemoteActor.receive).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'registry:perspectivesComplete'
        })
      );
    });
    
    it('should handle registry:clear message', async () => {
      // Use the already set up mock registry on the actor
      actor.registry.clearAll.mockResolvedValue(undefined);
      
      await actor.receive({ type: 'registry:clear' });
      
      expect(actor.registry.clearAll).toHaveBeenCalled();
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'registry:clearStarted',
        data: {}
      });
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'registry:clearComplete',
        data: {}
      });
    });
    
    // NOTE: module:load test removed - single module loading not supported
    
    // NOTE: tool perspectives test removed - not applicable to modules
    
    it('should log unknown message types', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await actor.receive({ type: 'unknownType' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unknown tool registry message:',
        'unknownType'
      );
      expect(mockRemoteActor.receive).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
    
    it('should handle errors and send error response', async () => {
      const error = new Error('Search failed');
      mockRegistryService.searchTools.mockRejectedValue(error);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await actor.receive({ 
        type: 'tools:search',
        data: { query: 'test' }
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error handling message:',
        error
      );
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'error',
        data: {
          error: 'Search failed',
          stack: error.stack,
          originalType: 'tools:search'
        }
      });
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('setRemoteActor', () => {
    it('should set remote actor', () => {
      const newRemoteActor = { receive: jest.fn() };
      actor.setRemoteActor(newRemoteActor);
      
      // Verify the remote actor is set
      expect(actor.remoteActor).toBe(newRemoteActor);
    });
  });
});