import { jest } from '@jest/globals';
import { AgentConnection } from '../src/agent-connection.js';

// Mock the Agent class
jest.mock('@legion/agent', () => ({
  Agent: jest.fn().mockImplementation(() => ({
    run: jest.fn().mockResolvedValue('Mock agent response')
  }))
}));

// Mock the tools
jest.mock('@legion/tools', () => ({
  FileModule: jest.fn().mockImplementation(() => ({
    tools: [{ name: 'read_file', description: 'Read a file' }]
  })),
  WebModule: jest.fn().mockImplementation(() => ({
    tools: [{ name: 'search_web', description: 'Search the web' }]
  })),
  JsonModule: jest.fn().mockImplementation(() => ({
    tools: [{ name: 'parse_json', description: 'Parse JSON' }]
  })),
  CalculatorModule: jest.fn().mockImplementation(() => ({
    tools: [{ name: 'calculate', description: 'Perform calculations' }]
  }))
}));

describe('AgentConnection Basic Tests', () => {
  let agentConnection;
  let mockResourceManager;
  let mockModuleFactory;

  beforeEach(() => {
    mockResourceManager = {
      get: jest.fn().mockImplementation((key) => {
        if (key === 'env.OPENAI_API_KEY') return 'test-api-key';
        if (key === 'env.MODEL_PROVIDER') return 'OPEN_AI';
        if (key === 'env.MODEL_NAME') return 'gpt-4';
        return undefined;
      }),
      has: jest.fn().mockReturnValue(true),
      register: jest.fn()
    };

    mockModuleFactory = {
      createModule: jest.fn().mockImplementation((ModuleClass) => new ModuleClass())
    };

    agentConnection = new AgentConnection('test-conn', mockResourceManager, mockModuleFactory);
  });

  test('AgentConnection can be instantiated', () => {
    expect(agentConnection).toBeDefined();
    expect(agentConnection.connectionId).toBe('test-conn');
    expect(agentConnection.conversationHistory).toEqual([]);
    expect(agentConnection.agent).toBeNull();
    expect(agentConnection.createdAt).toBeInstanceOf(Date);
  });

  test('getConversationSummary returns correct initial data', () => {
    const summary = agentConnection.getConversationSummary();
    
    expect(summary).toEqual({
      connectionId: 'test-conn',
      messageCount: 0,
      createdAt: agentConnection.createdAt,
      lastActivity: agentConnection.createdAt
    });
  });

  test('destroy clears conversation history', () => {
    agentConnection.conversationHistory.push({ test: 'data' });
    agentConnection.destroy();
    
    expect(agentConnection.conversationHistory).toEqual([]);
  });
});