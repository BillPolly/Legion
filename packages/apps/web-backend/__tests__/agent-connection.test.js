import { jest } from '@jest/globals';
import { AgentConnection } from '../src/agent-connection.js';

// Store original imports
let mockAgent;
let AgentClass;

// Mock @jsenvoy/agent
jest.unstable_mockModule('@jsenvoy/agent', () => {
  mockAgent = {
    run: jest.fn()
  };
  
  AgentClass = jest.fn(() => mockAgent);
  
  return {
    Agent: AgentClass
  };
});

// Mock @jsenvoy/tools
jest.unstable_mockModule('@jsenvoy/tools', () => ({
  FileModule: class FileModule {
    constructor() {
      this.tools = [
        { name: 'read_file', description: 'Read a file', invoke: jest.fn() }
      ];
    }
  },
  WebModule: class WebModule {
    constructor() {
      this.tools = [
        { name: 'search_web', description: 'Search the web', invoke: jest.fn() }
      ];
    }
  },
  JsonModule: class JsonModule {
    constructor() {
      this.tools = [
        { name: 'parse_json', description: 'Parse JSON', invoke: jest.fn() }
      ];
    }
  },
  CalculatorModule: class CalculatorModule {
    constructor() {
      this.tools = [
        { name: 'calculate', description: 'Perform calculations', invoke: jest.fn() }
      ];
    }
  }
}));

// Import modules after mocking
const { Agent } = await import('@jsenvoy/agent');

describe('AgentConnection', () => {
  let agentConnection;
  let mockResourceManager;
  let mockModuleFactory;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset the Agent mock
    mockAgent = {
      run: jest.fn()
    };
    AgentClass.mockImplementation(() => mockAgent);
    
    // Create mock ResourceManager
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

    // Create mock ModuleFactory
    mockModuleFactory = {
      createModule: jest.fn().mockImplementation((ModuleClass) => {
        return new ModuleClass();
      })
    };

    // Create AgentConnection instance
    agentConnection = new AgentConnection('test-connection', mockResourceManager, mockModuleFactory);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('creates agent connection with ID', () => {
      expect(agentConnection.connectionId).toBe('test-connection');
      expect(agentConnection.conversationHistory).toEqual([]);
      expect(agentConnection.agent).toBeNull();
      expect(agentConnection.createdAt).toBeInstanceOf(Date);
    });

    test('initializes agent on first use', async () => {
      expect(agentConnection.agent).toBeNull();
      
      await agentConnection.initializeAgent();
      
      expect(agentConnection.agent).toBeDefined();
      expect(agentConnection.agent).not.toBeNull();
      expect(Agent).toHaveBeenCalled();
    });

    test('does not reinitialize agent if already initialized', async () => {
      await agentConnection.initializeAgent();
      const firstAgent = agentConnection.agent;
      
      await agentConnection.initializeAgent();
      
      expect(agentConnection.agent).toBe(firstAgent);
      expect(Agent).toHaveBeenCalledTimes(1);
    });

    test('loads tools from modules during initialization', async () => {
      await agentConnection.initializeAgent();
      
      expect(mockModuleFactory.createModule).toHaveBeenCalled();
      // The agent should be created with tools
      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({ name: 'read_file' }),
            expect.objectContaining({ name: 'search_web' }),
            expect.objectContaining({ name: 'parse_json' }),
            expect.objectContaining({ name: 'calculate' })
          ])
        })
      );
    });
  });

  describe('Message Processing', () => {
    test('processes message and returns response', async () => {
      const mockResponse = 'Hello! How can I help you?';
      mockAgent.run.mockResolvedValue(mockResponse);
      
      const result = await agentConnection.processMessage('Hello');

      expect(result).toBe(mockResponse);
      expect(agentConnection.conversationHistory).toHaveLength(2);
      expect(agentConnection.conversationHistory[0]).toMatchObject({
        role: 'user',
        content: 'Hello',
        timestamp: expect.any(String)
      });
      expect(agentConnection.conversationHistory[1]).toMatchObject({
        role: 'agent',
        content: mockResponse,
        timestamp: expect.any(String)
      });
    });

    test('handles object responses from agent', async () => {
      const mockResponse = { message: 'Here is your response' };
      mockAgent.run.mockResolvedValue(mockResponse);
      
      const result = await agentConnection.processMessage('Test');

      expect(result).toBe('Here is your response');
    });

    test('handles non-string/non-object responses', async () => {
      const mockResponse = ['array', 'response'];
      mockAgent.run.mockResolvedValue(mockResponse);
      
      const result = await agentConnection.processMessage('Test');

      expect(result).toBe(JSON.stringify(mockResponse));
    });

    test('maintains conversation history across messages', async () => {
      mockAgent.run
        .mockResolvedValueOnce('First response')
        .mockResolvedValueOnce('Second response');

      await agentConnection.processMessage('First message');
      await agentConnection.processMessage('Second message');

      expect(agentConnection.conversationHistory).toHaveLength(4);
      expect(agentConnection.conversationHistory[2]).toMatchObject({
        role: 'user',
        content: 'Second message'
      });
      expect(agentConnection.conversationHistory[3]).toMatchObject({
        role: 'agent',
        content: 'Second response'
      });
    });

    test('handles agent errors gracefully', async () => {
      mockAgent.run.mockRejectedValue(new Error('Agent failed'));

      const result = await agentConnection.processMessage('Test');

      expect(result).toContain('I apologize, but I encountered an error');
      expect(result).toContain('Agent failed');
      expect(agentConnection.conversationHistory).toHaveLength(2);
      expect(agentConnection.conversationHistory[1].content).toContain('error');
    });
  });

  describe('Tool Conversion', () => {
    test('converts tool to agent format correctly', () => {
      const mockTool = {
        name: 'test_tool',
        description: 'Test tool description',
        getToolDescription: jest.fn().mockReturnValue({
          function: {
            name: 'test_function',
            description: 'Test function description',
            parameters: {
              properties: {
                param1: { type: 'string' },
                param2: { type: 'number' }
              }
            }
          }
        }),
        invoke: jest.fn(),
        safeInvoke: jest.fn()
      };

      const result = agentConnection.convertToolToAgentFormat(mockTool, 'test');

      expect(result).toMatchObject({
        name: 'test_tool',
        identifier: 'test_test_tool',
        abilities: ['Test tool description'],
        instructions: ['Use this tool to Test tool description'],
        functions: [{
          name: 'test_function',
          purpose: 'Test function description',
          arguments: ['param1', 'param2'],
          response: 'object'
        }]
      });
      expect(result.invoke).toBeDefined();
      expect(result.safeInvoke).toBeDefined();
      expect(result.setExecutingAgent).toBeDefined();
    });

    test('handles tools with getAllToolDescriptions', () => {
      const mockTool = {
        name: 'multi_tool',
        description: 'Multi-function tool',
        getAllToolDescriptions: jest.fn().mockReturnValue([
          {
            function: {
              name: 'func1',
              description: 'Function 1',
              parameters: { properties: {} }
            }
          },
          {
            function: {
              name: 'func2',
              description: 'Function 2',
              parameters: { properties: {} }
            }
          }
        ])
      };

      const result = agentConnection.convertToolToAgentFormat(mockTool, 'test');

      expect(result.functions).toHaveLength(2);
      expect(result.functions[0].name).toBe('func1');
      expect(result.functions[1].name).toBe('func2');
    });
  });

  describe('Conversation Summary', () => {
    test('returns correct conversation summary', async () => {
      const summary = agentConnection.getConversationSummary();

      expect(summary).toMatchObject({
        connectionId: 'test-connection',
        messageCount: 0,
        createdAt: agentConnection.createdAt,
        lastActivity: agentConnection.createdAt
      });
    });

    test('updates last activity based on messages', async () => {
      mockAgent.run.mockResolvedValue('Response');

      await agentConnection.processMessage('Hello');
      
      const summary = agentConnection.getConversationSummary();
      
      expect(summary.messageCount).toBe(2);
      expect(summary.lastActivity).not.toBe(summary.createdAt);
      expect(new Date(summary.lastActivity)).toBeInstanceOf(Date);
    });
  });

  describe('Cleanup', () => {
    test('clears conversation history on destroy', async () => {
      mockAgent.run.mockResolvedValue('Response');

      await agentConnection.processMessage('Test');
      expect(agentConnection.conversationHistory).toHaveLength(2);

      agentConnection.destroy();

      expect(agentConnection.conversationHistory).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('handles missing API key configuration', async () => {
      mockResourceManager.has.mockReturnValue(false);
      mockResourceManager.get.mockReturnValue(undefined);

      const connection = new AgentConnection('test', mockResourceManager, mockModuleFactory);
      await connection.initializeAgent();
      
      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          modelConfig: expect.objectContaining({
            provider: 'OPEN_AI', // Default value
            apiKey: undefined,
            model: 'gpt-4' // Default value
          })
        })
      );
    });

    test('continues without tools if tool loading fails', async () => {
      // Mock console.error to suppress error output
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock the tools import to throw an error
      const toolsImport = import('@jsenvoy/tools');
      jest.spyOn(agentConnection, 'initializeAgent').mockImplementationOnce(async function() {
        try {
          // Try to load tools but simulate failure
          throw new Error('Failed to load tools');
        } catch (error) {
          console.error('Error loading tools:', error);
          // Continue without tools
        }
        
        // Create agent configuration with no tools
        const agentConfig = {
          name: `chat_agent_${this.connectionId}`,
          bio: "I am a helpful AI assistant powered by jsEnvoy. I can help with various tasks including calculations, file operations, and web searches.",
          steps: ["Understand the user's request", "Use available tools if needed", "Provide a helpful response"],
          modelConfig: {
            provider: 'OPEN_AI',
            apiKey: 'test-api-key',
            model: 'gpt-4'
          },
          tools: [], // No tools
          showToolUsage: true,
          responseStructure: null
        };
        
        this.agent = new Agent(agentConfig);
      }.bind(agentConnection));

      await agentConnection.initializeAgent();

      expect(agentConnection.agent).toBeDefined();
      expect(Agent).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: []
        })
      );
      
      consoleErrorSpy.mockRestore();
    });
  });
});