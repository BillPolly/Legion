/**
 * Protocol-based tests for ServerToolRegistryActor
 * Auto-generated tests from protocol declaration
 */

import { ProtocolTestSuite } from '../../../src/shared/testing/ProtocolTestSuite.js';
import { ServerToolRegistryActor } from '../../../src/actors/ServerToolRegistryActor.js';

// Mock the registry service dependency
const mockRegistryService = {
  searchTools: jest.fn(),
  searchModules: jest.fn(), 
  getStats: jest.fn(),
  executeTool: jest.fn(),
  getRegistry: jest.fn().mockReturnValue({})
};

describe('ServerToolRegistryActor Protocol Tests', () => {
  // Generate comprehensive protocol compliance tests
  ProtocolTestSuite.generateTests(
    class TestServerToolRegistryActor extends ServerToolRegistryActor {
      constructor() {
        super(mockRegistryService);
      }
    },
    {
      testPostconditions: true,
      includeIntegrationTests: true
    }
  );

  // Additional custom tests specific to server tool registry functionality
  describe('Server Tool Registry Specific Tests', () => {
    let actor;
    let mockRemoteActor;
    
    beforeEach(() => {
      jest.clearAllMocks();
      
      mockRemoteActor = {
        receive: jest.fn()
      };
      
      actor = new ServerToolRegistryActor(mockRegistryService);
      actor.setRemoteActor(mockRemoteActor);
    });

    test('should handle tool search with protocol validation', async () => {
      const mockTools = [
        { name: 'calculator', description: 'Math calculations' },
        { name: 'file-reader', description: 'Read files' }
      ];
      
      mockRegistryService.searchTools.mockResolvedValue(mockTools);

      await actor.handleMessage('tools:search', { 
        query: 'calc', 
        options: { limit: 10 } 
      });

      expect(mockRegistryService.searchTools).toHaveBeenCalledWith('calc', { limit: 1000 });
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'tools:searchResult',
        data: { query: 'calc', tools: mockTools, count: 2 }
      });
      expect(actor.state.lastSearchQuery).toBe('calc');
    });

    test('should handle module search with protocol validation', async () => {
      const mockModules = [
        { name: 'file-ops', tools: ['read', 'write'], description: 'File operations' }
      ];
      
      mockRegistryService.searchModules.mockResolvedValue(mockModules);

      await actor.handleMessage('modules:search', { 
        query: 'file', 
        options: { limit: 50 } 
      });

      expect(mockRegistryService.searchModules).toHaveBeenCalledWith('file', { limit: 100 });
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'modules:searchResult',
        data: { query: 'file', modules: mockModules, count: 1 }
      });
    });

    test('should handle registry stats with protocol validation', async () => {
      const mockStats = {
        toolsCount: 15,
        modulesCount: 5,
        perspectivesCount: 45
      };
      
      mockRegistryService.getStats.mockResolvedValue(mockStats);

      await actor.handleMessage('registry:stats', {});

      expect(mockRegistryService.getStats).toHaveBeenCalled();
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'registry:stats',
        data: expect.objectContaining({
          ...mockStats,
          timestamp: expect.any(String)
        })
      });
    });

    test('should handle tool execution with protocol validation', async () => {
      const mockResult = { success: true, output: 'Tool executed successfully' };
      mockRegistryService.executeTool.mockResolvedValue(mockResult);

      await actor.handleMessage('tool:execute', {
        toolName: 'calculator',
        params: { expression: '2 + 2' }
      });

      expect(mockRegistryService.executeTool).toHaveBeenCalledWith('calculator', { expression: '2 + 2' });
      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'tool:executed',
        data: {
          toolName: 'calculator',
          params: { expression: '2 + 2' },
          result: mockResult
        }
      });
    });

    test('should handle tool execution errors gracefully', async () => {
      const error = new Error('Tool not found');
      mockRegistryService.executeTool.mockRejectedValue(error);

      await actor.handleMessage('tool:execute', {
        toolName: 'nonexistent',
        params: {}
      });

      expect(mockRemoteActor.receive).toHaveBeenCalledWith({
        type: 'tool:executed',
        data: {
          toolName: 'nonexistent',
          params: {},
          error: 'Tool not found',
          success: false
        }
      });
    });
  });
});