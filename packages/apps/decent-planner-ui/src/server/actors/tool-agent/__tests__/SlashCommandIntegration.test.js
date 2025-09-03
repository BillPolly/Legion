/**
 * SlashCommandIntegration Tests
 * 
 * End-to-end integration tests for slash command system with ChatServerToolAgent.
 * Tests complete flow from message input to UI response.
 * Follows fail-fast principles with no mocks - uses real dependencies.
 */

import ChatServerToolAgent from '../ChatServerToolAgent.js';
import { getToolRegistry } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';

describe('Slash Command Integration Tests', () => {
  let chatServerToolAgent;
  let realToolRegistry;
  let capturedResponses;
  let mockParentActor;
  
  beforeAll(async () => {
    // Get real dependencies - no mocks!
    realToolRegistry = await getToolRegistry();
    expect(realToolRegistry).toBeDefined();

    console.log('✅ Real dependencies loaded for integration tests');
  });

  beforeEach(async () => {
    capturedResponses = [];
    
    // Create mock parent actor that captures responses
    mockParentActor = {
      plannerSubActor: {
        toolRegistry: realToolRegistry
      },
      sendToSubActor: (subActorType, messageType, data) => {
        capturedResponses.push({
          subActorType,
          messageType, 
          data,
          timestamp: Date.now()
        });
        console.log(`[Mock Parent] ${subActorType}-${messageType}:`, data.text?.substring(0, 100));
      }
    };

    // Create real ChatServerToolAgent with services
    const services = { toolRegistry: realToolRegistry };
    chatServerToolAgent = new ChatServerToolAgent(services);
    chatServerToolAgent.setParentActor(mockParentActor);
    
    // Initialize the agent (this will set up both tool agent and slash command agent)
    const mockRemoteActor = { receive: jest.fn() };
    await chatServerToolAgent.setRemoteActor(mockRemoteActor);
    
    // Verify both agents are initialized
    expect(chatServerToolAgent.state.agentInitialized).toBe(true);
    expect(chatServerToolAgent.state.slashCommandInitialized).toBe(true);
    
    console.log('✅ ChatServerToolAgent initialized with both agents');
  });

  afterEach(async () => {
    // Clean up any test session files
    try {
      const sessionsDir = path.join(process.cwd(), 'saved-sessions');
      const files = await fs.readdir(sessionsDir);
      for (const file of files) {
        if (file.startsWith('test-integration')) {
          await fs.unlink(path.join(sessionsDir, file));
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Slash Command Detection and Routing', () => {
    test('routes slash commands to slash command agent', async () => {
      await chatServerToolAgent.handleSendMessage({
        text: '/help',
        timestamp: new Date().toISOString()
      });

      expect(capturedResponses.length).toBeGreaterThan(0);
      const commandResponse = capturedResponses.find(r => r.messageType === 'command-response');
      expect(commandResponse).toBeDefined();
      expect(commandResponse.data.text).toContain('Available Slash Commands');
      expect(commandResponse.data.isSlashCommand).toBe(true);
      expect(commandResponse.data.command).toBe('help');
    });

    test('routes regular messages to tool agent', async () => {
      await chatServerToolAgent.handleSendMessage({
        text: 'Hello, how are you?',
        timestamp: new Date().toISOString()
      });

      // Should get agent-response, not command-response
      expect(capturedResponses.length).toBeGreaterThan(0);
      const agentResponse = capturedResponses.find(r => r.messageType === 'agent-response');
      expect(agentResponse).toBeDefined();
      expect(agentResponse.data.text).toBeDefined();
      expect(agentResponse.data.isSlashCommand).toBeUndefined();
    }, 30000);

    test('maintains context between regular and slash commands', async () => {
      // First, use a regular command to set up context
      await chatServerToolAgent.handleSendMessage({
        text: 'Calculate 5 * 7', 
        timestamp: new Date().toISOString()
      });
      
      // Clear captured responses
      capturedResponses.length = 0;
      
      // Then use slash command to inspect context
      await chatServerToolAgent.handleSendMessage({
        text: '/context',
        timestamp: new Date().toISOString()
      });

      expect(capturedResponses.length).toBeGreaterThan(0);
      const commandResponse = capturedResponses.find(r => r.messageType === 'command-response');
      expect(commandResponse).toBeDefined();
      expect(commandResponse.data.text).toContain('Current Context Variables');
      // Should contain the calculation result if tools worked
    }, 30000);
  });

  describe('Complete Command Workflows', () => {
    test('help command workflow', async () => {
      // Test general help
      await chatServerToolAgent.handleSendMessage({
        text: '/help',
        timestamp: new Date().toISOString()
      });

      expect(capturedResponses.length).toBeGreaterThan(0);
      const response = capturedResponses.find(r => r.messageType === 'command-response');
      expect(response).toBeDefined();
      expect(response.data.text).toContain('Available Slash Commands');
      expect(response.data.text).toContain('Core Commands');
      expect(response.data.text).toContain('Debug Commands');
      
      // Clear and test specific help
      capturedResponses.length = 0;
      
      await chatServerToolAgent.handleSendMessage({
        text: '/help context',
        timestamp: new Date().toISOString()
      });
      
      expect(capturedResponses.length).toBeGreaterThan(0);
      const specificHelp = capturedResponses.find(r => r.messageType === 'command-response');
      expect(specificHelp).toBeDefined();
      expect(specificHelp.data.text).toContain('/context');
      expect(specificHelp.data.text).toContain('Display current execution context');
    });

    test('context and clear workflow', async () => {
      // Use a tool to create some context first
      await chatServerToolAgent.handleSendMessage({
        text: 'Store the value 42 as test_value',
        timestamp: new Date().toISOString()
      });
      
      capturedResponses.length = 0;
      
      // Check context
      await chatServerToolAgent.handleSendMessage({
        text: '/context',
        timestamp: new Date().toISOString()
      });
      
      let contextResponse = capturedResponses.find(r => r.messageType === 'command-response');
      expect(contextResponse).toBeDefined();
      expect(contextResponse.data.text).toContain('Current Context Variables');
      
      // Clear context
      capturedResponses.length = 0;
      
      await chatServerToolAgent.handleSendMessage({
        text: '/clear',
        timestamp: new Date().toISOString()
      });
      
      expect(capturedResponses.length).toBeGreaterThan(0);
      const clearResponse = capturedResponses.find(r => r.messageType === 'command-response');
      expect(clearResponse).toBeDefined();
      expect(clearResponse.data.text).toContain('Context Cleared Successfully');
      
      // Verify context was actually cleared with another context command
      capturedResponses.length = 0;
      
      await chatServerToolAgent.handleSendMessage({
        text: '/context',
        timestamp: new Date().toISOString()
      });
      
      contextResponse = capturedResponses.find(r => r.messageType === 'command-response');
      expect(contextResponse).toBeDefined();
      expect(contextResponse.data.text).toContain('Current Context:**');
    }, 30000);

    test('session save and load workflow', async () => {
      const sessionName = `test-integration-${Date.now()}`;
      
      // Create some context to save
      await chatServerToolAgent.handleSendMessage({
        text: 'Calculate 3 + 4',
        timestamp: new Date().toISOString()
      });
      
      capturedResponses.length = 0;
      
      // Save session
      await chatServerToolAgent.handleSendMessage({
        text: `/save ${sessionName}`,
        timestamp: new Date().toISOString()
      });
      
      let saveResponse = capturedResponses[0];
      expect(saveResponse.messageType).toBe('command-response');
      expect(saveResponse.data.text).toContain(`Session Saved: ${sessionName}`);
      
      // Clear context
      await chatServerToolAgent.handleSendMessage({
        text: '/clear',
        timestamp: new Date().toISOString()
      });
      
      capturedResponses.length = 0;
      
      // Load session back
      await chatServerToolAgent.handleSendMessage({
        text: `/load ${sessionName}`,
        timestamp: new Date().toISOString()
      });
      
      expect(capturedResponses.length).toBeGreaterThan(0);
      const loadResponse = capturedResponses.find(r => r.messageType === 'command-response');
      expect(loadResponse.data.text).toContain(`Session Loaded: ${sessionName}`);
      expect(loadResponse.data.text).toContain('Session restored successfully');
    });

    test('debug command workflow', async () => {
      // Use some tools first to create debug data
      await chatServerToolAgent.handleSendMessage({
        text: 'Calculate 2 * 3',
        timestamp: new Date().toISOString()
      });
      
      capturedResponses.length = 0;
      
      // Test general debug
      await chatServerToolAgent.handleSendMessage({
        text: '/debug',
        timestamp: new Date().toISOString()
      });
      
      let debugResponse = capturedResponses[0];
      expect(debugResponse.messageType).toBe('command-response');
      expect(debugResponse.data.text).toContain('Complete Debug Information');
      
      capturedResponses.length = 0;
      
      // Test specific debug type
      await chatServerToolAgent.handleSendMessage({
        text: '/debug operations',
        timestamp: new Date().toISOString()
      });
      
      debugResponse = capturedResponses[0];
      expect(debugResponse.data.text).toContain('Recent Operations');
    });

    test('history command workflow', async () => {
      // Create some operations first
      await chatServerToolAgent.handleSendMessage({
        text: 'Calculate 1 + 1',
        timestamp: new Date().toISOString()
      });
      
      await chatServerToolAgent.handleSendMessage({
        text: 'Calculate 2 + 2', 
        timestamp: new Date().toISOString()
      });
      
      capturedResponses.length = 0;
      
      // Check history
      await chatServerToolAgent.handleSendMessage({
        text: '/history',
        timestamp: new Date().toISOString()
      });
      
      expect(capturedResponses.length).toBe(1);
      const historyResponse = capturedResponses[0];
      expect(historyResponse.messageType).toBe('command-response');
      expect(historyResponse.data.text).toContain('Recent Operations');
      
      // Test with count
      capturedResponses.length = 0;
      
      await chatServerToolAgent.handleSendMessage({
        text: '/history 1',
        timestamp: new Date().toISOString()
      });
      
      const limitedHistory = capturedResponses[0];
      expect(limitedHistory.data.text).toContain('Recent Operations (last 1)');
    });
  });

  describe('Error Handling Integration', () => {
    test('handles invalid slash command syntax', async () => {
      await chatServerToolAgent.handleSendMessage({
        text: '/save', // Missing required argument
        timestamp: new Date().toISOString()
      });

      expect(capturedResponses.length).toBe(1);
      expect(capturedResponses[0].messageType).toBe('command-error');
      expect(capturedResponses[0].data.text).toContain('Missing required arguments');
      expect(capturedResponses[0].data.usage).toBe('/save <name>');
      expect(capturedResponses[0].data.isSlashCommand).toBe(true);
    });

    test('handles unknown slash commands', async () => {
      await chatServerToolAgent.handleSendMessage({
        text: '/nonexistent',
        timestamp: new Date().toISOString()
      });

      expect(capturedResponses.length).toBe(1);
      expect(capturedResponses[0].messageType).toBe('command-error');
      expect(capturedResponses[0].data.text).toContain('Unknown command: /nonexistent');
      expect(capturedResponses[0].data.isSlashCommand).toBe(true);
    });

    test('handles slash command execution errors', async () => {
      await chatServerToolAgent.handleSendMessage({
        text: '/load nonexistent_session',
        timestamp: new Date().toISOString()
      });

      expect(capturedResponses.length).toBe(1);
      expect(capturedResponses[0].messageType).toBe('command-error');
      expect(capturedResponses[0].data.text).toContain("Session 'nonexistent_session' not found");
      expect(capturedResponses[0].data.isSlashCommand).toBe(true);
    });
  });

  describe('Agent State and Status', () => {
    test('reports both agents in status', () => {
      const status = chatServerToolAgent.getStatus();
      
      expect(status.agentInitialized).toBe(true);
      expect(status.slashCommandInitialized).toBe(true);
      expect(status.connected).toBe(true);
      expect(status.messageCount).toBeDefined();
    });

    test('includes slash command readiness in ping responses', async () => {
      const mockRemoteActor = { receive: jest.fn() };
      chatServerToolAgent.remoteActor = mockRemoteActor;
      
      chatServerToolAgent.receive('ping', {});
      
      expect(mockRemoteActor.receive).toHaveBeenCalledWith('pong', expect.objectContaining({
        agentReady: true,
        slashCommandReady: true
      }));
    });
  });

  describe('Context State Updates', () => {
    test('sends context updates after context-modifying commands', async () => {
      // Clear context (should trigger context update)
      await chatServerToolAgent.handleSendMessage({
        text: '/clear',
        timestamp: new Date().toISOString()
      });

      // Should have both command-response and context-state-update
      expect(capturedResponses.length).toBe(2);
      expect(capturedResponses.some(r => r.messageType === 'command-response')).toBe(true);
      expect(capturedResponses.some(r => r.messageType === 'context-state-update')).toBe(true);
    });

    test('sends context updates after session load', async () => {
      // First create and save a session
      await chatServerToolAgent.handleSendMessage({
        text: 'Calculate 10 + 5',
        timestamp: new Date().toISOString()
      });
      
      const testSession = `test-context-update-${Date.now()}`;
      await chatServerToolAgent.handleSendMessage({
        text: `/save ${testSession}`,
        timestamp: new Date().toISOString()
      });
      
      capturedResponses.length = 0;
      
      // Load session (should trigger context update)
      await chatServerToolAgent.handleSendMessage({
        text: `/load ${testSession}`,
        timestamp: new Date().toISOString()
      });

      // Should have both command-response and context-state-update
      expect(capturedResponses.length).toBe(2);
      expect(capturedResponses.some(r => r.messageType === 'command-response')).toBe(true);
      expect(capturedResponses.some(r => r.messageType === 'context-state-update')).toBe(true);
    });
  });

  describe('Agent Initialization Edge Cases', () => {
    test('handles slash commands when tool agent not initialized', async () => {
      // Create agent with broken tool agent initialization
      const brokenServices = { toolRegistry: null };
      const brokenAgent = new ChatServerToolAgent(brokenServices);
      brokenAgent.setParentActor(mockParentActor);
      
      const mockRemoteActor = { receive: jest.fn() };
      await brokenAgent.setRemoteActor(mockRemoteActor);
      
      // Slash command agent should still work, but tool agent context won't be available
      capturedResponses.length = 0;
      
      await brokenAgent.handleSendMessage({
        text: '/help',
        timestamp: new Date().toISOString()
      });
      
      // Should get an error about tool agent context not being available
      expect(capturedResponses.length).toBe(1);
      expect(capturedResponses[0].messageType).toBe('command-error');
      expect(capturedResponses[0].data.text).toContain('Tool agent context not available');
    });
  });
});