/**
 * Protocol-based tests for ClientToolRegistryActor
 * Auto-generated tests from protocol declaration
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { ProtocolTestSuite } from '../../../src/shared/testing/ProtocolTestSuite.js';
import { ClientToolRegistryActor } from '../../../src/actors/ClientToolRegistryActor.js';

// Mock the toolRegistryBrowser dependency
const mockToolRegistryBrowser = {
  setTools: jest.fn(),
  setModules: jest.fn(),
  onRegistryStats: jest.fn()
};

describe('ClientToolRegistryActor Protocol Tests', () => {
  // Generate comprehensive protocol compliance tests
  ProtocolTestSuite.generateTests(
    class TestClientToolRegistryActor extends ClientToolRegistryActor {
      constructor() {
        super(mockToolRegistryBrowser);
      }
    },
    {
      testPostconditions: true,
      includeIntegrationTests: true
    }
  );

  // Additional custom tests specific to tool registry functionality
  describe('Tool Registry Specific Tests', () => {
    let actor;
    
    beforeEach(() => {
      jest.clearAllMocks();
      actor = new ClientToolRegistryActor(mockToolRegistryBrowser);
      
      // Mock remote actor
      actor.remoteActor = {
        receive: jest.fn()
      };
      actor.state.connected = true;
    });

    test('should search tools with protocol validation', async () => {
      await actor.searchTools('calculator', { limit: 10 });
      
      expect(actor.remoteActor.receive).toHaveBeenCalledWith({
        type: 'tools:search',
        data: { query: 'calculator', options: { limit: 10 } }
      });
    });

    test('should search modules with protocol validation', async () => {
      await actor.searchModules('file', { limit: 20 });
      
      expect(actor.remoteActor.receive).toHaveBeenCalledWith({
        type: 'modules:search', 
        data: { query: 'file', options: { limit: 20 } }
      });
    });

    test('should handle search results and update UI', async () => {
      const toolsResult = {
        query: 'calc',
        tools: [{ name: 'calculator', description: 'Math tool' }],
        count: 1
      };

      await actor.handleMessage('tools:searchResult', toolsResult);

      expect(mockToolRegistryBrowser.setTools).toHaveBeenCalledWith(toolsResult.tools);
      expect(actor.state.toolsCount).toBe(1);
    });

    test('should handle module search results', async () => {
      const modulesResult = {
        query: 'file',
        modules: [{ name: 'file-ops', tools: ['read', 'write'] }],
        count: 1
      };

      await actor.handleMessage('modules:searchResult', modulesResult);

      expect(mockToolRegistryBrowser.setModules).toHaveBeenCalledWith(modulesResult.modules);
      expect(actor.state.modulesCount).toBe(1);
    });
  });
});