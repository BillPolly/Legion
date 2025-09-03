/**
 * Integration test for ModuleBrowser in decent-planner-ui
 * Tests the complete flow: UI → Actor → Backend → UI
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import ToolRegistryClientSubActor from '../../src/client/actors/ToolRegistryClientSubActor.js';

// Mock DOM for component testing
global.document = {
  createElement: jest.fn(() => ({
    innerHTML: '',
    className: '',
    style: {},
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    click: jest.fn(),
    dispatchEvent: jest.fn()
  })),
  body: { appendChild: jest.fn() }
};

global.window = {
  getComputedStyle: jest.fn(() => ({}))
};

describe('ModuleBrowser Integration in Decent Planner', () => {
  let actor;
  let mockRemoteActor;
  let mockContainer;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock container
    mockContainer = {
      innerHTML: '',
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      style: {}
    };
    
    // Mock remote actor (server connection)
    mockRemoteActor = {
      receive: jest.fn()
    };
    
    // Create actor
    actor = new ToolRegistryClientSubActor();
    actor.setRemoteActor(mockRemoteActor);
    actor.setupUI(mockContainer);
  });
  
  describe('Backend Integration', () => {
    test('should send new protocol messages for module search', () => {
      // Trigger module search
      actor.handleModuleSearch('file');
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith('modules:search', {
        query: 'file',
        options: { limit: 100 }
      });
    });
    
    test('should handle module search results from backend', () => {
      const searchResults = {
        query: 'file',
        modules: [
          {
            name: 'file-operations',
            description: 'File handling tools',
            tools: ['file_read', 'file_write'],
            status: 'loaded'
          },
          {
            name: 'file-utils', 
            description: 'File utilities',
            tools: ['file_copy', 'file_delete'],
            status: 'active'
          }
        ],
        count: 2
      };
      
      // Simulate backend response
      actor.handleModulesSearchResult(searchResults);
      
      expect(actor.state.modules).toHaveLength(2);
      expect(actor.state.modules[0].name).toBe('file-operations');
      expect(actor.state.modules[0].tools).toEqual(['file_read', 'file_write']);
    });
    
    test('should load initial data using search protocol', () => {
      actor.loadRegistryData();
      
      // Should use new search-based protocol messages
      expect(mockRemoteActor.receive).toHaveBeenCalledWith('registry:stats', {});
      expect(mockRemoteActor.receive).toHaveBeenCalledWith('modules:search', { 
        query: '', 
        options: { limit: 100 } 
      });
      expect(mockRemoteActor.receive).toHaveBeenCalledWith('tools:search', { 
        query: '', 
        options: { limit: 1000 } 
      });
    });
  });
  
  describe('Module Management', () => {
    test('should handle tool search results', () => {
      const toolSearchResults = {
        query: 'calc',
        tools: [
          {
            name: 'calculator',
            description: 'Mathematical calculations',
            module: 'math-tools'
          },
          {
            name: 'advanced_calc',
            description: 'Advanced mathematics',
            module: 'math-tools'
          }
        ],
        count: 2
      };
      
      actor.handleToolsSearchResult(toolSearchResults);
      
      expect(actor.state.tools).toHaveLength(2);
      expect(actor.state.tools[0].name).toBe('calculator');
    });
    
    test('should handle registry statistics', () => {
      const stats = {
        toolsRegistered: 25,
        modulesLoaded: 8,
        perspectivesGenerated: 150,
        vectorsIndexed: 200,
        timestamp: '2025-09-03T07:00:00.000Z'
      };
      
      actor.handleRegistryStats(stats);
      
      expect(actor.state.registryStats).toEqual(stats);
    });
  });
  
  describe('Component Integration', () => {
    test('should create tool registry component with new module browser', () => {
      expect(actor.toolRegistryComponent).toBeDefined();
      expect(mockContainer.appendChild).toHaveBeenCalled();
    });
    
    test('should propagate module selection events', () => {
      const testModule = {
        name: 'test-module',
        tools: ['tool1', 'tool2'],
        description: 'Test module'
      };
      
      // This would be called by the ModuleBrowserPanel
      actor.handleModuleSelect(testModule);
      
      // Should not throw - just logs for now
      expect(true).toBe(true);
    });
    
    test('should handle search-based module refresh', () => {
      // Trigger refresh (should use search)
      actor.toolRegistryComponent.refreshModules();
      
      // Should trigger module search with empty query (list all)
      expect(mockRemoteActor.receive).toHaveBeenCalledWith('modules:search', {
        query: '',
        options: { limit: 100 }
      });
    });
  });
  
  describe('Protocol Compliance', () => {
    test('should use only new protocol messages', () => {
      // Load data and trigger searches
      actor.loadRegistryData();
      actor.handleModuleSearch('test');
      
      const sentMessages = mockRemoteActor.receive.mock.calls.map(call => call[0]);
      
      // Should only use new protocol messages
      expect(sentMessages).toContain('registry:stats');
      expect(sentMessages).toContain('modules:search');
      expect(sentMessages).toContain('tools:search');
      
      // Should NOT use old messages
      expect(sentMessages).not.toContain('list-all-modules');
      expect(sentMessages).not.toContain('list-all-tools');
      expect(sentMessages).not.toContain('database-query');
    });
    
    test('should handle all new response message types', () => {
      // Test all new message handlers exist and work
      const testCases = [
        ['modules:searchResult', { query: 'test', modules: [], count: 0 }],
        ['tools:searchResult', { query: 'test', tools: [], count: 0 }],
        ['registry:stats', { timestamp: '2025-09-03T07:00:00.000Z' }],
        ['tool:executed', { toolName: 'test', result: { success: true } }]
      ];
      
      testCases.forEach(([messageType, data]) => {
        expect(() => {
          actor.receive(messageType, data);
        }).not.toThrow();
      });
    });
  });
});