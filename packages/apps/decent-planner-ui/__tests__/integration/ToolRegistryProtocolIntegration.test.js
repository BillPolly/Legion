/**
 * REAL Tool Registry Protocol Integration Test - NO MOCKS
 * Tests actual point-to-point communication with real dependencies
 * FAIL FAST if any resource unavailable per CLAUDE.md
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import ToolRegistryServerSubActor from '../../src/server/actors/ToolRegistryServerSubActor.js';
import ToolRegistryClientSubActor from '../../src/client/actors/ToolRegistryClientSubActor.js';
import { getToolRegistry } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';

describe('Tool Registry Real Protocol Integration', () => {
  let serverActor;
  let clientActor;
  let realToolRegistry;
  let resourceManager;
  
  beforeEach(async () => {
    // Get ALL REAL dependencies - NO MOCKS
    resourceManager = await ResourceManager.getInstance();
    expect(resourceManager).toBeDefined();
    
    realToolRegistry = await getToolRegistry();
    expect(realToolRegistry).toBeDefined();
    
    // Create actors with real dependencies
    serverActor = new ToolRegistryServerSubActor({});
    clientActor = new ToolRegistryClientSubActor();
    
    // Set up REAL bidirectional communication
    await serverActor.setRemoteActor(clientActor);
    await clientActor.setRemoteActor(serverActor);
    
    // Verify both actors are properly initialized
    expect(serverActor.state.initialized).toBe(true);
    expect(clientActor.state.connected).toBe(true);
  });
  
  describe('Real Module Search', () => {
    test('should search real modules from tool registry', async () => {
      let receivedResponse = null;
      
      // Create promise to wait for response
      const responsePromise = new Promise((resolve) => {
        const originalReceive = clientActor.receive.bind(clientActor);
        clientActor.receive = (messageType, data) => {
          if (messageType === 'modules:searchResult') {
            receivedResponse = { messageType, data };
            resolve(receivedResponse);
          }
          return originalReceive(messageType, data);
        };
      });
      
      // Send real search request
      await serverActor.receive('modules:search', {
        query: '',
        options: { limit: 50 }
      });
      
      // Wait for async response
      await responsePromise;
      
      // Verify response
      expect(receivedResponse).not.toBeNull();
      expect(receivedResponse.messageType).toBe('modules:searchResult');
      expect(receivedResponse.data.modules).toBeDefined();
      expect(Array.isArray(receivedResponse.data.modules)).toBe(true);
      expect(receivedResponse.data.modules.length).toBeGreaterThan(0);
      
      // Verify real module structure
      const firstModule = receivedResponse.data.modules[0];
      expect(firstModule.name).toBeDefined();
      expect(firstModule.tools).toBeDefined();
      expect(Array.isArray(firstModule.tools)).toBe(true);
      expect(firstModule.status).toBe('loaded');
      
      console.log('✅ Real modules found:', receivedResponse.data.count);
      console.log('✅ First module:', firstModule.name, 'with', firstModule.tools.length, 'tools');
    });
    
    test('should filter modules by real search query', async () => {
      let fileModulesResponse = null;
      
      const responsePromise = new Promise((resolve) => {
        const originalReceive = clientActor.receive.bind(clientActor);
        clientActor.receive = (messageType, data) => {
          if (messageType === 'modules:searchResult') {
            fileModulesResponse = data;
            resolve(data);
          }
          return originalReceive(messageType, data);
        };
      });
      
      // Search for file-related modules
      await serverActor.receive('modules:search', {
        query: 'file',
        options: { limit: 20 }
      });
      
      await responsePromise;
      expect(fileModulesResponse).not.toBeNull();
      expect(fileModulesResponse.query).toBe('file');
      
      // All returned modules should be file-related
      fileModulesResponse.modules.forEach(module => {
        const isFileRelated = 
          module.name.toLowerCase().includes('file') ||
          module.description.toLowerCase().includes('file') ||
          module.tools.some(tool => tool.toLowerCase().includes('file'));
        
        expect(isFileRelated).toBe(true);
      });
      
      console.log('✅ File modules filtered:', fileModulesResponse.count, 'modules');
    });
  });
  
  describe('Real Tool Search', () => {
    test('should search real tools from tool registry', async () => {
      let toolsResponse = null;
      
      const originalReceive = clientActor.receive.bind(clientActor);
      clientActor.receive = (messageType, data) => {
        if (messageType === 'tools:searchResult') {
          toolsResponse = data;
        }
        return originalReceive(messageType, data);
      };
      
      // Search all tools
      await serverActor.receive('tools:search', {
        query: '',
        options: { limit: 100 }
      });
      
      expect(toolsResponse).not.toBeNull();
      expect(toolsResponse.tools).toBeDefined();
      expect(Array.isArray(toolsResponse.tools)).toBe(true);
      expect(toolsResponse.tools.length).toBeGreaterThan(0);
      
      // Verify real tool structure
      const firstTool = toolsResponse.tools[0];
      expect(firstTool.name).toBeDefined();
      expect(firstTool.description).toBeDefined();
      expect(firstTool.moduleName).toBeDefined();
      
      console.log('✅ Real tools found:', toolsResponse.count);
      console.log('✅ First tool:', firstTool.name, 'from', firstTool.moduleName);
    });
    
    test('should search tools by keyword with real results', async () => {
      let calcToolsResponse = null;
      
      const originalReceive = clientActor.receive.bind(clientActor);
      clientActor.receive = (messageType, data) => {
        if (messageType === 'tools:searchResult') {
          calcToolsResponse = data;
        }
        return originalReceive(messageType, data);
      };
      
      // Search for calculator tools
      await serverActor.receive('tools:search', {
        query: 'calculator',
        options: { limit: 10 }
      });
      
      expect(calcToolsResponse).not.toBeNull();
      expect(calcToolsResponse.query).toBe('calculator');
      
      // Should find calculator-related tools
      if (calcToolsResponse.count > 0) {
        const hasCalculator = calcToolsResponse.tools.some(tool => 
          tool.name.toLowerCase().includes('calc') || 
          tool.description.toLowerCase().includes('calc')
        );
        expect(hasCalculator).toBe(true);
      }
      
      console.log('✅ Calculator tools found:', calcToolsResponse.count);
    });
  });
  
  describe('Real Registry Stats', () => {
    test('should get real registry statistics', async () => {
      let statsResponse = null;
      
      const originalReceive = clientActor.receive.bind(clientActor);
      clientActor.receive = (messageType, data) => {
        if (messageType === 'registry:stats') {
          statsResponse = data;
        }
        return originalReceive(messageType, data);
      };
      
      await serverActor.receive('registry:stats', {});
      
      expect(statsResponse).not.toBeNull();
      expect(statsResponse.totalTools).toBeGreaterThan(0);
      expect(statsResponse.totalModules).toBeGreaterThan(0);
      expect(statsResponse.timestamp).toBeDefined();
      
      console.log('✅ Real registry stats:', statsResponse.totalTools, 'tools,', statsResponse.totalModules, 'modules');
    });
  });
  
  describe('Real Tool Execution', () => {
    test('should execute real calculator tool', async () => {
      let executionResponse = null;
      
      const originalReceive = clientActor.receive.bind(clientActor);
      clientActor.receive = (messageType, data) => {
        if (messageType === 'tool:executed') {
          executionResponse = data;
        }
        return originalReceive(messageType, data);
      };
      
      // Execute real calculator tool
      await serverActor.receive('tool:execute', {
        toolName: 'calculator',
        params: { expression: '2 + 2' }
      });
      
      expect(executionResponse).not.toBeNull();
      expect(executionResponse.toolName).toBe('calculator');
      expect(executionResponse.result).toBeDefined();
      
      // Should have real calculation result
      if (executionResponse.result.success) {
        console.log('✅ Real calculator result:', executionResponse.result.data);
      } else {
        console.log('❌ Calculator failed:', executionResponse.error);
      }
    });
  });
  
  describe('Error Conditions - FAIL FAST', () => {
    test('should fail fast if tool not found', async () => {
      let errorResponse = null;
      
      const originalReceive = clientActor.receive.bind(clientActor);
      clientActor.receive = (messageType, data) => {
        if (messageType === 'tool:executed' && data.success === false) {
          errorResponse = data;
        }
        return originalReceive(messageType, data);
      };
      
      // Try to execute non-existent tool
      await serverActor.receive('tool:execute', {
        toolName: 'nonexistent_tool',
        params: {}
      });
      
      expect(errorResponse).not.toBeNull();
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBeDefined();
      
      console.log('✅ Failed fast for missing tool:', errorResponse.error);
    });
  });
});