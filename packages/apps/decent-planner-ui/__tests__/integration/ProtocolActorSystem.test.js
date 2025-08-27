/**
 * Integration tests for the complete Protocol Actor System
 * Demonstrates protocol-based testing without server dependencies
 */

import { jest } from '@jest/globals';
import { ProtocolMockGenerator } from '../../src/testing/ProtocolMockGenerator.js';
import ClientPlannerActor from '../../src/actors/ClientPlannerActor.js';

// Mock DOM environment
global.document = {
  createElement: jest.fn(() => ({
    innerHTML: '',
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => [])
  })),
  body: {
    appendChild: jest.fn()
  }
};

// Mock schema package with more realistic behavior
const mockValidators = new Map();
const createMockValidator = (schema) => {
  const validator = jest.fn((data) => {
    // Simple validation logic for testing
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Data must be an object'] };
    }
    
    for (const [key, spec] of Object.entries(schema)) {
      if (spec.required && !(key in data)) {
        return { valid: false, errors: [`${key} is required`] };
      }
      if (key in data && spec.type && typeof data[key] !== spec.type) {
        return { valid: false, errors: [`${key} must be of type ${spec.type}`] };
      }
    }
    
    return { valid: true, errors: [] };
  });
  
  return validator;
};

jest.mock('@legion/schema', () => ({
  createValidatorFunction: jest.fn((schemaSpec) => {
    const key = JSON.stringify(schemaSpec);
    if (!mockValidators.has(key)) {
      mockValidators.set(key, createMockValidator(schemaSpec));
    }
    return mockValidators.get(key);
  })
}));

describe('Protocol Actor System Integration', () => {
  let clientActor;
  let mockServer;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidators.clear();
    
    // Create real client actor
    clientActor = new ClientPlannerActor();
    
    // Mock UI methods to prevent errors
    clientActor.updateState = jest.fn((updates) => {
      Object.assign(clientActor.state, updates);
    });
    clientActor.initializeUI = jest.fn();
    clientActor.enableToolsTab = jest.fn();
    clientActor.enableFormalTab = jest.fn();
    clientActor.enableExecutionTab = jest.fn();
    clientActor.showError = jest.fn();
    clientActor.updatePlanningDisplay = jest.fn();
    clientActor.updateToolsDisplay = jest.fn();
    clientActor.updateFormalDisplay = jest.fn();
    
    // Create mock server using protocol
    const serverProtocol = {
      name: 'ServerPlannerActor',
      version: '1.0.0',
      state: {
        schema: {
          initialized: { type: 'boolean', required: true }
        },
        initial: {
          initialized: true
        }
      },
      messages: {
        receives: {
          'plan-informal': {
            schema: {
              goal: { type: 'string', required: true }
            },
            triggers: ['informalPlanStarted', 'informalPlanProgress', 'informalPlanComplete']
          },
          'discover-tools': {
            schema: {},
            triggers: ['toolsDiscoveryStarted', 'toolsDiscoveryProgress', 'toolsDiscoveryComplete']
          },
          'plan-formal': {
            schema: {},
            triggers: ['formalPlanStarted', 'formalPlanProgress', 'formalPlanComplete']
          }
        },
        sends: {
          'ready': {
            schema: {
              timestamp: { type: 'string', required: true }
            }
          }
        }
      }
    };
    
    const MockServerClass = ProtocolMockGenerator.generateMockActor(serverProtocol);
    mockServer = new MockServerClass();
    
    // Connect client to mock server
    clientActor.remoteActor = {
      receive: (messageType, data) => {
        return mockServer.receive(messageType, data);
      }
    };
    
    // Connect mock server responses to client
    mockServer.onAnyMessage((messageType, data) => {
      clientActor.receive(messageType, data);
    });
  });
  
  describe('Complete Planning Workflow', () => {
    test('should complete informal planning workflow with protocol validation', async () => {
      // Initial state should match protocol
      expect(clientActor.state.connected).toBe(false);
      expect(clientActor.state.informalPlanning).toBe(false);
      
      // Simulate server ready
      mockServer.handleMessage('server-init', {});
      
      // This should trigger ready message to client
      setTimeout(() => {
        mockServer.sendTriggeredResponse(['ready'], 'server-init', {});
      }, 10);
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Client should now be connected
      expect(clientActor.state.connected).toBe(true);
      
      // Start informal planning
      await clientActor.send('plan-informal', { goal: 'Create a web scraper' });
      
      // Server should have received the message
      const serverMessages = mockServer.getReceivedMessages('plan-informal');
      expect(serverMessages).toHaveLength(1);
      expect(serverMessages[0].data.goal).toBe('Create a web scraper');
      
      // Wait for server response
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Client should have received informal plan completion
      expect(clientActor.state.informalPlanning).toBe(false);
      expect(clientActor.state.informalResult).toBeDefined();
    });
    
    test('should handle tool discovery after informal planning', async () => {
      // Set up initial state
      clientActor.state.connected = true;
      clientActor.state.informalResult = {
        hierarchy: { id: 'test', name: 'Test Goal' }
      };
      
      // Start tool discovery
      await clientActor.send('discover-tools', {});
      
      // Server should receive the message
      const serverMessages = mockServer.getReceivedMessages('discover-tools');
      expect(serverMessages).toHaveLength(1);
      
      // Wait for server response
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Client should have tools result
      expect(clientActor.state.toolsResult).toBeDefined();
      expect(clientActor.enableToolsTab).toHaveBeenCalled();
    });
    
    test('should complete formal planning after tool discovery', async () => {
      // Set up state for formal planning
      clientActor.state.connected = true;
      clientActor.state.informalResult = { hierarchy: { id: 'test' } };
      clientActor.state.toolsResult = { tools: [{ name: 'testTool' }] };
      
      // Start formal planning
      await clientActor.send('plan-formal', {});
      
      // Server should receive the message
      const serverMessages = mockServer.getReceivedMessages('plan-formal');
      expect(serverMessages).toHaveLength(1);
      
      // Wait for server response
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Client should have formal result
      expect(clientActor.state.formalResult).toBeDefined();
      expect(clientActor.enableFormalTab).toHaveBeenCalled();
    });
  });
  
  describe('Error Scenarios', () => {
    test('should handle validation errors for invalid messages', async () => {
      clientActor.state.connected = true;
      
      // Try to send invalid message (missing required goal)
      try {
        await clientActor.send('plan-informal', {});
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('goal is required');
      }
    });
    
    test('should handle precondition violations', async () => {
      // Try to send message when not connected
      clientActor.state.connected = false;
      
      try {
        await clientActor.send('plan-informal', { goal: 'Test goal' });
        fail('Should have thrown precondition error');
      } catch (error) {
        expect(error.message).toContain('state.connected === true');
      }
    });
    
    test('should handle server error responses', async () => {
      clientActor.state.connected = true;
      
      // Configure mock server to return error
      mockServer.setCustomResponse('plan-informal', {
        type: 'informalPlanError',
        data: { error: 'Planning failed' }
      });
      
      await clientActor.send('plan-informal', { goal: 'Test goal' });
      
      // Wait for error response
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(clientActor.showError).toHaveBeenCalledWith('Planning failed');
      expect(clientActor.state.error).toBe('Planning failed');
    });
  });
  
  describe('Protocol Compliance Verification', () => {
    test('should maintain protocol state consistency throughout workflow', async () => {
      const protocol = clientActor.getProtocol();
      
      // Verify initial state matches protocol
      expect(clientActor.state).toMatchObject(protocol.state.initial);
      
      // Simulate complete workflow and verify state at each step
      const stateHistory = [];
      
      // Track state changes
      const originalUpdateState = clientActor.updateState;
      clientActor.updateState = jest.fn((updates) => {
        originalUpdateState.call(clientActor, updates);
        stateHistory.push({ ...clientActor.state });
      });
      
      // Connection
      clientActor.handleMessage('ready', { timestamp: new Date().toISOString() });
      expect(clientActor.state.connected).toBe(true);
      
      // Informal planning
      clientActor.handleMessage('informalPlanStarted', { goal: 'Test goal' });
      expect(clientActor.state.informalPlanning).toBe(true);
      
      clientActor.handleMessage('informalPlanComplete', {
        result: { hierarchy: { id: 'test' } },
        goal: 'Test goal'
      });
      expect(clientActor.state.informalPlanning).toBe(false);
      expect(clientActor.state.informalResult).toBeDefined();
      
      // Verify all state transitions were valid
      expect(stateHistory.length).toBeGreaterThan(0);
      stateHistory.forEach((state, index) => {
        // Each state should be valid according to protocol schema
        const stateKeys = Object.keys(protocol.state.schema);
        stateKeys.forEach(key => {
          expect(state).toHaveProperty(key);
        });
      });
    });
    
    test('should validate all message schemas correctly', () => {
      const protocol = clientActor.getProtocol();
      
      // Test each receive message schema
      Object.entries(protocol.messages.receives).forEach(([messageType, spec]) => {
        if (spec.schema) {
          const validator = clientActor.messageValidators.get(messageType);
          expect(validator).toBeDefined();
          
          // Valid data should pass
          const validData = this.generateValidDataForMessage(messageType, spec.schema);
          if (validData) {
            const result = validator(validData);
            expect(result.valid).toBe(true);
          }
        }
      });
    });
  });
  
  describe('Mock Actor Verification', () => {
    test('should track all actor interactions', async () => {
      clientActor.state.connected = true;
      
      // Send multiple messages
      await clientActor.send('plan-informal', { goal: 'Goal 1' });
      await clientActor.send('discover-tools', {});
      
      // Verify mock server recorded all interactions
      const allReceived = mockServer.getReceivedMessages();
      expect(allReceived).toHaveLength(2);
      
      const stats = mockServer.getStats();
      expect(stats.messagesReceived).toBe(2);
      expect(stats.protocol.name).toBe('ServerPlannerActor');
    });
    
    test('should simulate realistic response timing', async () => {
      jest.useFakeTimers();
      
      clientActor.state.connected = true;
      
      // Configure response delay
      mockServer.responseDelay = 100;
      
      const responsePromise = new Promise(resolve => {
        clientActor.updatePlanningDisplay = jest.fn(resolve);
      });
      
      await clientActor.send('plan-informal', { goal: 'Test goal' });
      
      // Response shouldn't come immediately
      jest.advanceTimersByTime(50);
      expect(clientActor.updatePlanningDisplay).not.toHaveBeenCalled();
      
      // Should come after delay
      jest.advanceTimersByTime(60);
      await responsePromise;
      expect(clientActor.updatePlanningDisplay).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });
  
  // Helper method for generating valid test data
  generateValidDataForMessage(messageType, schema) {
    const data = {};
    
    for (const [key, spec] of Object.entries(schema)) {
      if (spec.required) {
        switch (spec.type) {
          case 'string':
            data[key] = `test-${key}`;
            break;
          case 'number':
            data[key] = 42;
            break;
          case 'boolean':
            data[key] = true;
            break;
          case 'object':
            data[key] = { test: 'value' };
            break;
          case 'array':
            data[key] = ['test'];
            break;
        }
      }
    }
    
    return Object.keys(data).length > 0 ? data : null;
  }
});