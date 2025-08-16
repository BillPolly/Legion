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
    
    // Create mock registry service with all required methods
    mockRegistryService = {
      loadAllModulesFromFileSystem: jest.fn(),
      getTool: jest.fn(),
      listTools: jest.fn(),
      loadTools: jest.fn().mockResolvedValue([]), // Return empty array for tools
      loadModules: jest.fn().mockResolvedValue([]), // Return empty array for modules
      executeTool: jest.fn(),
      searchTools: jest.fn(),
      getStats: jest.fn(),
      getRegistryStats: jest.fn(), // Add this method
      generatePerspectives: jest.fn(), // Add this method
      clearDatabase: jest.fn(), // Add this method
      getToolPerspectives: jest.fn(), // Add this method
      getProvider: jest.fn(), // Add this method for database counts
      getLoader: jest.fn(), // Add this method
      getRegistry: jest.fn().mockReturnValue({
        // Mock registry object
        generatePerspectives: jest.fn(),
        clearDatabase: jest.fn(),
        getLoader: jest.fn().mockResolvedValue({
          clearAll: jest.fn(),
          loadModule: jest.fn(),
          loadModuleByName: jest.fn()
        })
      })
    };
    
    // Create mock remote actor
    mockRemoteActor = {
      receive: jest.fn()
    };
    
    // Create actor instance
    actor = new ServerToolRegistryActor(mockRegistryService);
    actor.setRemoteActor(mockRemoteActor);
  });
  
  describe('receive method', () => {
    it('should handle tools:load message', async () => {
      const mockTools = [
        { name: 'tool1', description: 'Tool 1' },
        { name: 'tool2', description: 'Tool 2' }
      ];
      mockRegistryService.loadTools.mockResolvedValue(mockTools);
      
      await actor.receive({ type: 'tools:load' });
      
      expect(mockRegistryService.loadTools).toHaveBeenCalledWith({ limit: 1000 });
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'tools:list',
        data: { tools: mockTools }
      });
    });
    
    it('should handle modules:load message', async () => {
      const mockModules = [
        { name: 'module1', type: 'class' },
        { name: 'module2', type: 'function' }
      ];
      mockRegistryService.loadModules.mockResolvedValue(mockModules);
      
      await actor.receive({ type: 'modules:load' });
      
      expect(mockRegistryService.loadModules).toHaveBeenCalledWith({ limit: 100 });
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'modules:list',
        data: { modules: mockModules }
      });
    });
    
    it('should handle registry:loadAll message', async () => {
      const mockResult = {
        loaded: [
          { 
            config: { name: 'module1' },
            instance: { getTools: () => [{ name: 'tool1' }] }
          },
          { 
            config: { name: 'module2' },
            instance: { getTools: () => [{ name: 'tool2' }, { name: 'tool3' }] }
          }
        ],
        failed: [],
        summary: { total: 2, loaded: 2, failed: 0 }
      };
      mockRegistryService.loadAllModulesFromFileSystem.mockResolvedValue(mockResult);
      
      await actor.receive({ type: 'registry:loadAll' });
      
      expect(mockRegistryService.loadAllModulesFromFileSystem).toHaveBeenCalled();
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
      const mockProvider = {
        db: {
          collection: jest.fn().mockReturnValue({
            countDocuments: jest.fn().mockResolvedValue(10)
          })
        }
      };
      
      mockRegistryService.getRegistryStats.mockResolvedValue(mockStats);
      mockRegistryService.getProvider.mockReturnValue(mockProvider);
      
      await actor.receive({ type: 'registry:stats' });
      
      expect(mockRegistryService.getRegistryStats).toHaveBeenCalled();
      expect(mockRegistryService.getProvider).toHaveBeenCalled();
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'registry:stats',
        data: expect.objectContaining({
          ...mockStats,
          modules: 10,
          tools: 10,
          perspectives: 10,
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
      mockRegistryService.clearDatabase.mockResolvedValue(undefined);
      
      await actor.receive({ type: 'registry:clear' });
      
      expect(mockRegistryService.clearDatabase).toHaveBeenCalled();
      // The clearDatabase method sends multiple messages: started, complete, and then calls other methods
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'registry:clearStarted',
        data: {}
      });
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'registry:clearComplete',
        data: {}
      });
    });
    
    it('should handle module:load message', async () => {
      const mockResult = {
        name: 'test-module',
        tools: ['tool1', 'tool2']
      };
      
      // Mock the loader.loadModuleByName method
      const mockLoader = {
        loadModuleByName: jest.fn().mockResolvedValue(mockResult)
      };
      mockRegistryService.getLoader.mockResolvedValue(mockLoader);
      
      await actor.receive({
        type: 'module:load',
        data: { moduleName: 'test-module' }
      });
      
      expect(mockLoader.loadModuleByName).toHaveBeenCalledWith('test-module');
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'module:loaded',
        data: {
          moduleName: 'test-module',
          success: true,
          result: mockResult
        }
      });
    });
    
    it('should handle tool:get-perspectives message', async () => {
      const mockPerspectives = [
        { type: 'usage', content: 'How to use calculator' },
        { type: 'example', content: 'Example: 2 + 2' }
      ];
      
      mockRegistryService.getToolPerspectives.mockResolvedValue(mockPerspectives);
      
      await actor.receive({
        type: 'tool:get-perspectives',
        data: { toolName: 'calculator' }
      });
      
      expect(mockRegistryService.getToolPerspectives).toHaveBeenCalledWith('calculator');
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'tool:perspectives',
        data: {
          toolName: 'calculator',
          perspectives: mockPerspectives
        }
      });
    });
    
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
      const error = new Error('Database connection failed');
      mockRegistryService.loadTools.mockRejectedValue(error);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await actor.receive({ type: 'tools:load' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error handling message:',
        error
      );
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'error',
        data: {
          error: 'Database connection failed',
          stack: error.stack,
          originalType: 'tools:load'
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