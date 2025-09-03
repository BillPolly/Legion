/**
 * Protocol-based tests for ToolRegistryClientSubActor
 * Tests the new search-based functionality without DOM dependencies
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import ToolRegistryClientSubActor from '../../../src/client/actors/ToolRegistryClientSubActor.js';

describe('ToolRegistryClientSubActor Protocol Tests', () => {
  let actor;
  let mockRemoteActor;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock remote actor
    mockRemoteActor = {
      receive: jest.fn()
    };
    
    // Create actor
    actor = new ToolRegistryClientSubActor();
    actor.setRemoteActor(mockRemoteActor);
  });
  
  describe('New Protocol Message Handling', () => {
    test('should send modules:search message for module search', () => {
      actor.handleModuleSearch('file operations');
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith('modules:search', {
        query: 'file operations',
        options: { limit: 100 }
      });
    });
    
    test('should send empty query for listing all modules', () => {
      actor.handleModuleSearch('');
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith('modules:search', {
        query: '',
        options: { limit: 100 }
      });
    });
    
    test('should handle modules:searchResult response', () => {
      const searchResult = {
        query: 'file',
        modules: [
          {
            name: 'file-operations',
            description: 'File handling tools',
            tools: ['file_read', 'file_write'],
            status: 'loaded'
          }
        ],
        count: 1
      };
      
      actor.handleModulesSearchResult(searchResult);
      
      expect(actor.state.modules).toHaveLength(1);
      expect(actor.state.modules[0].name).toBe('file-operations');
      expect(actor.state.modules[0].tools).toEqual(['file_read', 'file_write']);
    });
    
    test('should handle tools:searchResult response', () => {
      const searchResult = {
        query: 'calc',
        tools: [
          {
            name: 'calculator',
            description: 'Mathematical calculations',
            module: 'math-tools'
          }
        ],
        count: 1
      };
      
      actor.handleToolsSearchResult(searchResult);
      
      expect(actor.state.tools).toHaveLength(1);
      expect(actor.state.tools[0].name).toBe('calculator');
    });
    
    test('should handle registry:stats response', () => {
      const stats = {
        toolsRegistered: 25,
        modulesLoaded: 8,
        perspectivesGenerated: 150,
        timestamp: '2025-09-03T07:00:00.000Z'
      };
      
      actor.handleRegistryStats(stats);
      
      expect(actor.state.registryStats).toEqual(stats);
    });
  });
  
  describe('New Load Data Protocol', () => {
    test('should use search-based data loading', () => {
      actor.loadRegistryData();
      
      // Should send new protocol messages
      expect(mockRemoteActor.receive).toHaveBeenCalledWith('registry:stats', {});
      expect(mockRemoteActor.receive).toHaveBeenCalledWith('modules:search', { 
        query: '', 
        options: { limit: 100 } 
      });
      expect(mockRemoteActor.receive).toHaveBeenCalledWith('tools:search', { 
        query: '', 
        options: { limit: 1000 } 
      });
      
      expect(mockRemoteActor.receive).toHaveBeenCalledTimes(3);
    });
    
    test('should not use old protocol messages', () => {
      actor.loadRegistryData();
      
      const sentMessages = mockRemoteActor.receive.mock.calls.map(call => call[0]);
      
      // Should NOT use old messages
      expect(sentMessages).not.toContain('list-all-modules');
      expect(sentMessages).not.toContain('list-all-tools');
      expect(sentMessages).not.toContain('get-registry-stats');
      expect(sentMessages).not.toContain('database-query');
    });
  });
  
  describe('Message Reception Protocol', () => {
    test('should handle all new message types', () => {
      const testCases = [
        ['modules:searchResult', { query: 'test', modules: [], count: 0 }],
        ['tools:searchResult', { query: 'test', tools: [], count: 0 }],
        ['registry:stats', { timestamp: '2025-09-03T07:00:00.000Z' }],
        ['tool:executed', { toolName: 'test', result: { success: true } }],
        ['error', { error: 'Test error' }]
      ];
      
      testCases.forEach(([messageType, data]) => {
        expect(() => {
          actor.receive(messageType, data);
        }).not.toThrow();
      });
    });
    
    test('should log warning for unknown messages', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      actor.receive('unknown:message', {});
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unknown message type in tool registry sub-actor:', 
        'unknown:message'
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('State Management', () => {
    test('should maintain connection state', () => {
      expect(actor.state.connected).toBe(true); // Set by setRemoteActor in beforeEach
      
      expect(actor.getState()).toEqual({
        connected: true,
        moduleCount: 0,
        toolCount: 0,
        hasStats: false
      });
    });
    
    test('should update state when receiving data', () => {
      // Add some modules
      actor.handleModulesSearchResult({
        query: '',
        modules: [{ name: 'mod1' }, { name: 'mod2' }],
        count: 2
      });
      
      // Add some tools
      actor.handleToolsSearchResult({
        query: '',
        tools: [{ name: 'tool1' }],
        count: 1
      });
      
      expect(actor.getState()).toEqual({
        connected: true,
        moduleCount: 2,
        toolCount: 1,
        hasStats: false
      });
    });
  });
  
  describe('Backward Compatibility', () => {
    test('should handle old message types gracefully', () => {
      // Old messages that might still come from server during transition
      const oldMessages = [
        'modulesListComplete',
        'toolsListComplete', 
        'registryStatsComplete'
      ];
      
      oldMessages.forEach(messageType => {
        expect(() => {
          actor.receive(messageType, {});
        }).not.toThrow();
      });
    });
  });
});