/**
 * Simplified tests for custom agent behavior tree nodes
 * Using minimal test structure to avoid Jest global contamination
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { ConfigurableAgent } from '../../src/core/ConfigurableAgent.js';
import { AgentChatNode } from '../../src/bt/nodes/AgentChatNode.js';
import { NodeStatus } from '@legion/bt-task';
import { generateCleanConfig, generateIsolatedConfig } from './config-generator.js';

describe('Agent BT Nodes - Simple Tests', () => {
  let resourceManager;
  let agent;

  beforeAll(async () => {
    // Get real ResourceManager instance (singleton)
    const { ResourceManager } = await import('@legion/resource-manager');
    resourceManager = await ResourceManager.getInstance();
    
    // Verify we have required resources
    const llmClient = await resourceManager.get('llmClient');
    expect(llmClient).toBeDefined();
    
    // Create agent with clean configuration from isolated function
    const cleanConfig = generateIsolatedConfig();
    console.log('Generated clean config keys:', Object.keys(cleanConfig));
    console.log('Config agent keys:', Object.keys(cleanConfig.agent));
    console.log('Config agent.llm keys:', Object.keys(cleanConfig.agent.llm));
    
    agent = new ConfigurableAgent(cleanConfig, resourceManager);
    await agent.initialize();
    
    expect(agent.initialized).toBe(true);
  });

  it('should create agent successfully without Jest contamination', () => {
    expect(agent).toBeDefined();
    expect(agent.id).toBe('simple-bt-test-agent');
    expect(agent.name).toBe('SimpleBTTestAgent');
    expect(agent.initialized).toBe(true);
  });

  it('should handle basic chat message through agent', async () => {
    const response = await agent.receive({
      type: 'chat',
      from: 'test-user',
      content: 'Hello',
      sessionId: 'simple-test-session'
    });

    expect(response.type).toBe('chat_response');
    expect(response.content).toBeDefined();
    expect(response.sessionId).toBe('simple-test-session');
  }, 10000);

  it('should create AgentChatNode without executor (testing node creation only)', () => {
    // Test node creation without full BT executor
    const nodeConfig = {
      id: 'simple-chat-test',
      agent: agent,
      message: 'Simple test message',
      sessionId: 'node-test-session'
    };

    // Create mock executor with minimal interface
    const mockExecutor = {
      messageBus: {
        emit: () => {},
        on: () => {}
      }
    };

    expect(() => {
      const chatNode = new AgentChatNode(nodeConfig, null, mockExecutor);
      return chatNode;
    }).not.toThrow();
  });

  it('should validate AgentChatNode configuration', () => {
    const validConfig = {
      agent: agent,
      message: 'Test message'
    };

    const validation = AgentChatNode.validateConfiguration(validConfig);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should accept configuration without agent (will be injected)', () => {
    const configWithoutAgent = {};
    const validation = AgentChatNode.validateConfiguration(configWithoutAgent);
    expect(validation.valid).toBe(true); // Agent is optional, will be injected by BoundNodeClass
    expect(validation.errors).toHaveLength(0);
  });

  it('should reject configuration with invalid agent', () => {
    const invalidConfig = { agent: 'not-an-agent' }; // Invalid agent type
    const validation = AgentChatNode.validateConfiguration(invalidConfig);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors[0]).toMatch(/agent must/i);
  });
});