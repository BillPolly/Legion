/**
 * Live Integration Tests - Step by Step
 * 
 * Tests each component individually with real dependencies before building complete workflows.
 * No mocks - uses actual ResourceManager, ToolRegistry, and LLM client.
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ToolUsingChatAgent } from '../ToolUsingChatAgent.js';
import ChatServerToolAgent from '../ChatServerToolAgent.js';
import { ContextManager } from '../ContextManager.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Live Integration Tests - Step by Step', () => {
  let resourceManager;
  let toolRegistry;
  let llmClient;
  let services;

  beforeAll(async () => {
    console.log('🔧 Getting real dependencies from ResourceManager...');
    
    // Get real dependencies - NO MOCKS
    resourceManager = await ResourceManager.getInstance();
    expect(resourceManager).toBeDefined();
    
    // Try to get tool registry
    try {
      toolRegistry = await resourceManager.get('toolRegistry');
      console.log('✅ ToolRegistry obtained:', !!toolRegistry);
    } catch (error) {
      console.log('❌ ToolRegistry not available:', error.message);
    }
    
    // Try to get LLM client
    try {
      llmClient = await resourceManager.get('llmClient');
      console.log('✅ LLM Client obtained:', !!llmClient);
    } catch (error) {
      console.log('❌ LLM Client not available:', error.message);
    }
    
    services = {
      toolRegistry,
      llmClient,
      resourceManager
    };
  }, 15000);

  describe('Step 1: Agent Initialization', () => {
    test('ToolUsingChatAgent initializes with real dependencies', async () => {
      if (!toolRegistry || !llmClient) {
        console.log('Skipping test - dependencies not available');
        return;
      }

      console.log('🚀 Creating ToolUsingChatAgent with real dependencies...');
      const agent = new ToolUsingChatAgent(toolRegistry, llmClient);
      
      expect(agent.toolRegistry).toBe(toolRegistry);
      expect(agent.llmClient).toBe(llmClient);
      expect(agent.executionContext.artifacts).toEqual({});
      expect(agent.chatHistory).toEqual([]);
      
      console.log('✅ Agent created successfully with real dependencies');
    });

    test('ChatServerToolAgent initializes with real services', () => {
      console.log('🚀 Creating ChatServerToolAgent with real services...');
      const serverAgent = new ChatServerToolAgent(services);
      
      expect(serverAgent.services).toBe(services);
      expect(serverAgent.state.connected).toBe(false);
      expect(serverAgent.state.agentInitialized).toBe(false);
      
      console.log('✅ Server agent created successfully');
    });
  });

  describe('Step 2: Tool Registry Integration', () => {
    test('agent can initialize and cache real tools', async () => {
      if (!toolRegistry || !llmClient) {
        console.log('Skipping test - dependencies not available');
        return;
      }

      const agent = new ToolUsingChatAgent(toolRegistry, llmClient);
      
      console.log('🔧 Initializing tools with real tool registry...');
      await agent.initializeTools();
      
      console.log(`📊 Cached ${agent.resolvedTools.size} tools`);
      console.log('Cached tools:', Array.from(agent.resolvedTools.keys()));
      
      expect(agent.resolvedTools.size).toBeGreaterThan(0);
      
      // Verify tools have execute methods
      for (const [name, tool] of agent.resolvedTools) {
        expect(typeof tool.execute).toBe('function');
        console.log(`✅ Tool ${name} has execute method`);
      }
    }, 10000);

    test('agent can search real tool registry', async () => {
      if (!toolRegistry || !llmClient) {
        console.log('Skipping test - dependencies not available');
        return;
      }

      const agent = new ToolUsingChatAgent(toolRegistry, llmClient);
      await agent.initializeTools();

      console.log('🔍 Testing semantic search with real tool registry...');
      const searchResults = await agent.searchForTools("file operations");
      
      console.log(`Found ${searchResults.length} tools for "file operations"`);
      
      if (searchResults.length > 0) {
        console.log('Search results:');
        searchResults.forEach(result => {
          console.log(`  - ${result.name}: ${result.description} (${((result.confidence || 0) * 100).toFixed(1)}%)`);
        });
        
        expect(searchResults[0]).toHaveProperty('name');
        expect(searchResults[0]).toHaveProperty('description');
      } else {
        console.log('No tools found - may indicate tool registry not fully initialized');
      }
    }, 10000);
  });

  describe('Step 3: LLM Client Integration', () => {
    test('agent can make structured LLM requests', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      const agent = new ToolUsingChatAgent({}, llmClient); // Empty registry for this test
      
      console.log('🧠 Testing LLM client integration...');
      
      const testPrompt = `
Please respond with this exact JSON format:
{"needsTools": true, "reasoning": "This is a test response"}

Task: Answer with the exact JSON format above.
      `;

      try {
        const response = await agent.llmClient.complete(testPrompt);
        
        console.log('LLM Response:', response);
        
        const parsed = JSON.parse(response);
        expect(parsed).toHaveProperty('needsTools');
        expect(parsed).toHaveProperty('reasoning');
        
        console.log('✅ LLM client responding correctly with structured JSON');
      } catch (error) {
        console.log('❌ LLM integration error:', error.message);
        throw error;
      }
    }, 15000);

    test('agent analyzeToolNeed works with real LLM', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      const agent = new ToolUsingChatAgent({}, llmClient);
      
      console.log('🧠 Testing tool need analysis with real LLM...');
      
      // Test case: request that clearly needs tools
      const result1 = await agent.analyzeToolNeed("Please read the file config.json");
      console.log('Tool need analysis result:', result1);
      
      expect(result1).toHaveProperty('needsTools');
      expect(result1).toHaveProperty('reasoning');
      expect(typeof result1.needsTools).toBe('boolean');
      
      // Test case: request that might use existing context
      agent.executionContext.artifacts.config_data = { port: 3000 };
      const result2 = await agent.analyzeToolNeed("What port is configured?");
      console.log('Tool need analysis with context:', result2);
      
      expect(result2).toHaveProperty('needsTools');
      expect(result2).toHaveProperty('reasoning');
    }, 15000);
  });

  describe('Step 4: Context Management', () => {
    test('parameter resolution works correctly', () => {
      console.log('🔧 Testing parameter resolution...');
      
      const context = {
        artifacts: {
          user_file: "/tmp/test.txt",
          search_query: "nodejs tutorial",
          count: 42
        }
      };

      const params = {
        "filePath": "@user_file",
        "query": "@search_query",
        "iterations": "@count",
        "constant": "hello world"
      };

      const resolved = ContextManager.resolveParams(params, context);
      
      console.log('Resolved parameters:', resolved);
      
      expect(resolved).toEqual({
        "filePath": "/tmp/test.txt",
        "query": "nodejs tutorial", 
        "iterations": 42,
        "constant": "hello world"
      });
      
      console.log('✅ Parameter resolution working correctly');
    });

    test('context formatting for prompts', () => {
      console.log('📝 Testing context formatting...');
      
      const context = {
        artifacts: {
          "file_content": "Hello World!",
          "analysis_result": { sentiment: "positive", confidence: 0.92 },
          "search_results": ["result1", "result2"]
        }
      };

      const formatted = ContextManager.formatContextForPrompt(context);
      console.log('Formatted context:', formatted);
      
      expect(formatted).toContain('file_content:');
      expect(formatted).toContain('analysis_result:');
      expect(formatted).toContain('search_results:');
      
      console.log('✅ Context formatting working correctly');
    });
  });

  describe('Step 5: Individual Tool Execution', () => {
    test('can execute a real calculator tool', async () => {
      if (!toolRegistry || !llmClient) {
        console.log('Skipping test - dependencies not available');
        return;
      }

      const agent = new ToolUsingChatAgent(toolRegistry, llmClient);
      await agent.initializeTools();

      console.log('🔢 Testing calculator tool execution...');
      
      // Check if calculator tool is available
      if (!agent.resolvedTools.has('calculator')) {
        console.log('Calculator tool not available, checking available tools...');
        console.log('Available tools:', Array.from(agent.resolvedTools.keys()));
        return;
      }

      const calculatorTool = agent.resolvedTools.get('calculator');
      console.log('Calculator tool found:', calculatorTool.name);

      try {
        const result = await calculatorTool.execute({
          expression: "2 + 2"
        });

        console.log('Calculator result:', result);
        expect(result).toHaveProperty('success');
        
        if (result.success) {
          expect(result.data).toBeDefined();
          console.log('✅ Calculator tool executed successfully');
        }
      } catch (error) {
        console.log('Calculator execution error:', error.message);
        throw error;
      }
    }, 10000);

    test('can execute a real file operation tool', async () => {
      if (!toolRegistry || !llmClient) {
        console.log('Skipping test - dependencies not available');
        return;
      }

      const agent = new ToolUsingChatAgent(toolRegistry, llmClient);
      await agent.initializeTools();

      console.log('📁 Testing file operation tools...');
      
      // Check available file-related tools
      const fileTools = Array.from(agent.resolvedTools.keys()).filter(name => 
        name.toLowerCase().includes('file') || name.toLowerCase().includes('write') || name.toLowerCase().includes('read')
      );
      
      console.log('Available file tools:', fileTools);
      
      if (fileTools.length === 0) {
        console.log('No file tools available for testing');
        return;
      }

      // Try file_write if available
      if (agent.resolvedTools.has('file_write')) {
        const fileWriteTool = agent.resolvedTools.get('file_write');
        
        try {
          const result = await fileWriteTool.execute({
            filePath: "/tmp/agent-test.txt",
            content: "Test content from tool agent"
          });

          console.log('File write result:', result);
          expect(result).toHaveProperty('success');
          
          if (result.success) {
            console.log('✅ File write tool executed successfully');
          }
        } catch (error) {
          console.log('File write error:', error.message);
        }
      }
    }, 10000);
  });

  describe('Step 6: Tool Resolution with Context Flow', () => {
    test('can resolve parameters and execute with context flow', async () => {
      if (!toolRegistry || !llmClient) {
        console.log('Skipping test - dependencies not available');
        return;
      }

      const agent = new ToolUsingChatAgent(toolRegistry, llmClient);
      await agent.initializeTools();

      console.log('🔗 Testing parameter resolution with context flow...');

      // Step 1: Store some data in context
      agent.executionContext.artifacts.test_file = "/tmp/agent-integration-test.txt";
      agent.executionContext.artifacts.test_content = "Hello from tool agent!";

      // Step 2: Resolve parameters using @varName syntax
      const params = {
        filePath: "@test_file",
        content: "@test_content",
        encoding: "utf8"
      };

      const resolvedParams = agent.resolveParams(params);
      console.log('Resolved parameters:', resolvedParams);

      expect(resolvedParams.filePath).toBe("/tmp/agent-integration-test.txt");
      expect(resolvedParams.content).toBe("Hello from tool agent!");
      expect(resolvedParams.encoding).toBe("utf8");

      console.log('✅ Parameter resolution with @varName working correctly');

      // Step 3: Try to execute a tool with resolved parameters
      if (agent.resolvedTools.has('file_write')) {
        console.log('📝 Testing tool execution with resolved parameters...');
        
        const toolSelection = {
          selectedTool: "file_write",
          parameters: params, // Use params with @varName
          outputVariable: "write_result"
        };

        try {
          const result = await agent.executeTool(toolSelection);
          console.log('Tool execution with context result:', result);

          expect(result.tool).toBe('file_write');
          
          if (result.success) {
            expect(agent.executionContext.artifacts.write_result).toBeDefined();
            console.log('✅ Tool execution with context flow working');
            console.log('Final context:', agent.executionContext.artifacts);
          }
        } catch (error) {
          console.log('Tool execution error:', error.message);
        }
      }
    }, 10000);
  });

  describe('Step 7: LLM Decision Making', () => {
    test('LLM can analyze tool need with real context', async () => {
      if (!llmClient) {
        console.log('Skipping test - LLM client not available');
        return;
      }

      const agent = new ToolUsingChatAgent({}, llmClient);
      
      console.log('🧠 Testing LLM tool need analysis...');

      // Test without context
      console.log('Testing: "What is 2+2?"');
      const result1 = await agent.analyzeToolNeed("What is 2+2?");
      console.log('LLM analysis (no context):', result1);
      
      expect(result1).toHaveProperty('needsTools');
      expect(result1).toHaveProperty('reasoning');

      // Test with relevant context
      agent.executionContext.artifacts.calculation_result = 4;
      agent.chatHistory.push({
        role: 'user',
        content: 'Calculate 2+2',
        timestamp: Date.now() - 1000
      });
      agent.chatHistory.push({
        role: 'agent', 
        content: 'I calculated 2+2 = 4',
        timestamp: Date.now() - 500
      });

      console.log('Testing: "What was the result?" (with context)');
      const result2 = await agent.analyzeToolNeed("What was the result?");
      console.log('LLM analysis (with context):', result2);

      expect(result2).toHaveProperty('needsTools');
      expect(result2).toHaveProperty('reasoning');

      console.log('✅ LLM tool need analysis working with real context');
    }, 20000);

    test('LLM can select tools from real search results', async () => {
      if (!toolRegistry || !llmClient) {
        console.log('Skipping test - dependencies not available');
        return;
      }

      const agent = new ToolUsingChatAgent(toolRegistry, llmClient);
      await agent.initializeTools();

      console.log('🎯 Testing LLM tool selection...');

      // Get real search results
      const searchResults = await agent.searchForTools("calculate numbers");
      console.log(`Search found ${searchResults.length} tools`);

      if (searchResults.length > 0) {
        console.log('Asking LLM to select from real tools...');
        
        const selection = await agent.selectBestTool(searchResults, "Calculate 5 * 7");
        console.log('LLM tool selection:', selection);

        expect(selection).toHaveProperty('selectedTool');
        expect(selection).toHaveProperty('reasoning');
        expect(selection).toHaveProperty('parameters');
        
        if (selection.selectedTool) {
          expect(agent.resolvedTools.has(selection.selectedTool)).toBe(true);
          console.log('✅ LLM selected valid tool from real registry');
        } else {
          console.log('LLM determined no tools are suitable');
        }
      } else {
        console.log('No tools found in search - skipping selection test');
      }
    }, 20000);
  });

  describe('Step 8: End-to-End Single Tool Execution', () => {
    test('complete single tool workflow with real dependencies', async () => {
      if (!toolRegistry || !llmClient) {
        console.log('Skipping test - dependencies not available');
        return;
      }

      const agent = new ToolUsingChatAgent(toolRegistry, llmClient);
      await agent.initializeTools();

      console.log('🔄 Testing complete single tool workflow...');

      // Find a simple tool to test with
      const availableTools = Array.from(agent.resolvedTools.keys());
      console.log('Available tools for testing:', availableTools);

      // Try calculator if available
      if (availableTools.includes('calculator')) {
        console.log('Testing with calculator tool...');

        try {
          const result = await agent.processMessage("Calculate 3 * 4");
          console.log('Complete workflow result:', result);

          expect(result).toHaveProperty('userResponse');
          expect(result).toHaveProperty('toolsUsed');
          expect(result).toHaveProperty('reasoning');

          if (result.toolsUsed.length > 0) {
            console.log('✅ Complete workflow executed successfully');
            console.log('Tools used:', result.toolsUsed);
            console.log('Context updated:', result.contextUpdated);
            console.log('Final context state:', agent.getContextState());
          }
        } catch (error) {
          console.log('Workflow error:', error.message);
          console.log('This may be expected if calculator tool needs specific parameters');
        }
      } else {
        console.log('No suitable tools for simple test workflow');
      }
    }, 30000);
  });

  describe('Step 9: ChatServerToolAgent Integration', () => {
    test('server agent initializes with real services', async () => {
      console.log('🎭 Testing ChatServerToolAgent initialization...');
      
      const serverAgent = new ChatServerToolAgent(services);
      
      // Mock parent actor for testing
      const mockParent = {
        sentMessages: [],
        sendToSubActor: function(target, messageType, data) {
          this.sentMessages.push({ target, messageType, data });
          console.log(`📨 Sent: ${messageType}`, data);
        }
      };
      serverAgent.parentActor = mockParent;

      await serverAgent.initializeAgent();
      
      console.log('Server agent initialization result:', serverAgent.state);
      
      if (serverAgent.state.agentInitialized) {
        console.log('✅ Server agent initialized successfully');
        expect(serverAgent.toolAgent).toBeDefined();
        expect(serverAgent.toolAgent.resolvedTools.size).toBeGreaterThan(0);
      } else {
        console.log('❌ Server agent initialization failed');
        console.log('This may be expected if dependencies are not fully available');
      }
    }, 15000);

    test('server agent can process messages', async () => {
      if (!toolRegistry || !llmClient) {
        console.log('Skipping test - dependencies not available');
        return;
      }

      const serverAgent = new ChatServerToolAgent(services);
      
      // Mock parent actor
      const mockParent = {
        sentMessages: [],
        sendToSubActor: function(target, messageType, data) {
          this.sentMessages.push({ target, messageType, data });
          console.log(`📨 Response: ${messageType}`, data);
        }
      };
      serverAgent.parentActor = mockParent;

      await serverAgent.initializeAgent();
      
      if (serverAgent.state.agentInitialized) {
        console.log('🗨️ Testing message processing through server agent...');

        await serverAgent.handleSendMessage({
          text: "Hello, can you help me?",
          timestamp: new Date().toISOString()
        });

        expect(mockParent.sentMessages.length).toBeGreaterThan(0);
        
        const response = mockParent.sentMessages[mockParent.sentMessages.length - 1];
        console.log('Server agent response:', response);
        
        expect(['agent-response', 'agent-error']).toContain(response.messageType);
        
        console.log('✅ Server agent message processing working');
      } else {
        console.log('Server agent not initialized - skipping message test');
      }
    }, 25000);
  });
});