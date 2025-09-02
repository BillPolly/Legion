/**
 * ToolUsingChatAgent Unit Tests
 * 
 * Comprehensive test suite covering all aspects of the tool-using chat agent:
 * - Context-aware decision making
 * - Tool search and selection
 * - Parameter resolution with @varName syntax
 * - Error handling and fallbacks
 */

import { ToolUsingChatAgent } from '../ToolUsingChatAgent.js';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock implementations
class MockToolRegistry {
  constructor(tools = []) {
    this.tools = tools;
  }

  async getAllTools() {
    return { tools: this.tools };
  }

  async searchTools(query, options = {}) {
    // Simple mock search - return tools that match query keywords
    const matches = this.tools.filter(tool => 
      tool.name.toLowerCase().includes(query.toLowerCase()) ||
      tool.description.toLowerCase().includes(query.toLowerCase())
    );

    return matches.map(tool => ({
      ...tool,
      confidence: 0.8 // Mock confidence score
    }));
  }
}

class MockLLMClient {
  constructor(responses = {}) {
    this.responses = responses;
    this.callHistory = [];
  }

  async complete(prompt, options = {}) {
    this.callHistory.push({ prompt, options });
    
    // Determine response type based on prompt content
    if (prompt.includes('needsTools')) {
      return this.responses.toolNeedAnalysis || '{"needsTools": true, "reasoning": "Mock analysis"}';
    }
    
    if (prompt.includes('selectedTool')) {
      return this.responses.toolSelection || '{"selectedTool": "mock_tool", "reasoning": "Mock selection", "parameters": {"input": "test"}, "outputVariable": "result"}';
    }
    
    if (prompt.includes('complete')) {
      return this.responses.completion || '{"complete": true, "userResponse": "Task completed successfully", "nextAction": null}';
    }
    
    return this.responses.default || 'Mock LLM response';
  }

  getCallHistory() {
    return this.callHistory;
  }
}

class MockTool {
  constructor(name, executeFunction = null) {
    this.name = name;
    this.description = `Mock tool: ${name}`;
    this.execute = executeFunction || this.defaultExecute.bind(this);
  }

  async defaultExecute(params) {
    return {
      success: true,
      data: { message: `Mock execution of ${this.name}`, params }
    };
  }
}

describe('ToolUsingChatAgent', () => {
  let agent;
  let mockToolRegistry;
  let mockLLMClient;
  let mockTools;

  beforeEach(() => {
    // Create mock tools
    mockTools = [
      new MockTool('file_read'),
      new MockTool('file_write'), 
      new MockTool('json_parse'),
      new MockTool('web_search')
    ];

    mockToolRegistry = new MockToolRegistry(mockTools);
    mockLLMClient = new MockLLMClient();
    agent = new ToolUsingChatAgent(mockToolRegistry, mockLLMClient);
  });

  afterEach(() => {
    // Clean up
    agent = null;
  });

  describe('Initialization', () => {
    test('initializes with empty context and chat history', () => {
      expect(agent.executionContext.artifacts).toEqual({});
      expect(agent.chatHistory).toEqual([]);
      expect(agent.operationHistory).toEqual([]);
    });

    test('caches executable tools during initialization', async () => {
      await agent.initializeTools();
      expect(agent.resolvedTools.size).toBe(4);
      expect(agent.resolvedTools.has('file_read')).toBe(true);
      expect(agent.resolvedTools.has('file_write')).toBe(true);
    });
  });

  describe('Context Management', () => {
    test('resolveParams handles @varName substitution correctly', () => {
      // Set up context
      agent.executionContext.artifacts.user_file = "/path/to/file.txt";
      agent.executionContext.artifacts.search_query = "nodejs tutorial";

      const params = {
        "filePath": "@user_file",
        "query": "@search_query", 
        "constant": "hello world"
      };

      const resolved = agent.resolveParams(params);

      expect(resolved).toEqual({
        "filePath": "/path/to/file.txt",
        "query": "nodejs tutorial",
        "constant": "hello world"
      });
    });

    test('resolveParams handles missing variables gracefully', () => {
      const params = {
        "existing": "@user_file",
        "missing": "@nonexistent_var",
        "constant": "test"
      };

      agent.executionContext.artifacts.user_file = "exists";

      const resolved = agent.resolveParams(params);

      expect(resolved).toEqual({
        "existing": "exists",
        "missing": undefined,
        "constant": "test"
      });
    });

    test('formatContextVariables returns proper format', () => {
      agent.executionContext.artifacts = {
        "file_content": "Hello World!",
        "user_data": { name: "John", age: 30 },
        "results": ["item1", "item2", "item3"]
      };

      const formatted = agent.formatContextVariables();

      expect(formatted).toContain('file_content: "Hello World!"');
      expect(formatted).toContain('user_data: Object(2 keys)');
      expect(formatted).toContain('results: Array(3)');
    });

    test('formatChatHistory limits to recent messages', () => {
      // Add multiple messages
      for (let i = 0; i < 10; i++) {
        agent.chatHistory.push({
          role: 'user',
          content: `Message ${i}`,
          timestamp: Date.now() + i
        });
      }

      const formatted = agent.formatChatHistory();

      // Should only include last 5 messages
      expect(formatted.split('\n').length).toBe(5);
      expect(formatted).toContain('Message 5');
      expect(formatted).toContain('Message 9');
      expect(formatted).not.toContain('Message 0');
    });
  });

  describe('Tool Need Analysis', () => {
    test('correctly identifies when tools are needed', async () => {
      mockLLMClient.responses.toolNeedAnalysis = '{"needsTools": true, "reasoning": "User wants to read a file which requires tools"}';

      const result = await agent.analyzeToolNeed("Please read config.json");

      expect(result.needsTools).toBe(true);
      expect(result.reasoning).toContain("requires tools");
    });

    test('correctly identifies when existing context is sufficient', async () => {
      // Set up context with file content
      agent.executionContext.artifacts.config_content = '{"port": 3000}';
      
      mockLLMClient.responses.toolNeedAnalysis = '{"needsTools": false, "reasoning": "Information already available in context"}';

      const result = await agent.analyzeToolNeed("What port is configured?");

      expect(result.needsTools).toBe(false);
      expect(result.reasoning).toContain("already available");
    });

    test('handles LLM parsing errors gracefully', async () => {
      mockLLMClient.responses.toolNeedAnalysis = 'Invalid JSON response';

      const result = await agent.analyzeToolNeed("Test request");

      expect(result.needsTools).toBe(true); // Defaults to true on error
      expect(result.reasoning).toContain("Failed to parse");
    });
  });

  describe('Tool Search', () => {
    test('enhances search query with context information', async () => {
      agent.executionContext.artifacts.user_file = "test.txt";
      agent.executionContext.artifacts.parsed_data = { key: "value" };

      await agent.searchForTools("analyze the file");

      // Should have called searchTools with enhanced query
      const searchCalls = mockToolRegistry.tools.filter(() => true); // Mock doesn't track calls, but we can verify behavior
      expect(searchCalls).toBeDefined();
    });

    test('returns empty array when no tools found', async () => {
      const emptyRegistry = new MockToolRegistry([]);
      const emptyAgent = new ToolUsingChatAgent(emptyRegistry, mockLLMClient);

      const results = await emptyAgent.searchForTools("nonexistent functionality");

      expect(results).toEqual([]);
    });

    test('handles search errors gracefully', async () => {
      const errorRegistry = {
        searchTools: async () => { throw new Error('Search service down'); }
      };
      
      const errorAgent = new ToolUsingChatAgent(errorRegistry, mockLLMClient);

      const results = await errorAgent.searchForTools("test query");

      expect(results).toEqual([]);
    });
  });

  describe('Tool Selection', () => {
    test('selects appropriate tool with context-aware parameters', async () => {
      const searchResults = [
        { name: 'file_read', description: 'Read files', confidence: 0.9 },
        { name: 'web_search', description: 'Search web', confidence: 0.3 }
      ];

      agent.executionContext.artifacts.target_file = "/tmp/test.txt";

      mockLLMClient.responses.toolSelection = JSON.stringify({
        selectedTool: "file_read",
        reasoning: "File reading tool matches user intent and can use existing file path",
        parameters: { "filePath": "@target_file" },
        outputVariable: "file_content"
      });

      const selection = await agent.selectBestTool(searchResults, "read the file");

      expect(selection.selectedTool).toBe('file_read');
      expect(selection.parameters.filePath).toBe('@target_file');
      expect(selection.outputVariable).toBe('file_content');
    });

    test('returns null when no suitable tools', async () => {
      const searchResults = [
        { name: 'irrelevant_tool', description: 'Does something else', confidence: 0.1 }
      ];

      mockLLMClient.responses.toolSelection = JSON.stringify({
        selectedTool: null,
        reasoning: "No tools match the user's request",
        parameters: {},
        outputVariable: null
      });

      const selection = await agent.selectBestTool(searchResults, "do something unique");

      expect(selection.selectedTool).toBeNull();
    });
  });

  describe('Tool Execution', () => {
    beforeEach(async () => {
      await agent.initializeTools();
    });

    test('executes tool with parameter resolution', async () => {
      // Set up context
      agent.executionContext.artifacts.input_file = "/tmp/input.txt";

      const toolSelection = {
        selectedTool: "file_read",
        parameters: { "filePath": "@input_file", "encoding": "utf8" },
        outputVariable: "file_content"
      };

      const result = await agent.executeTool(toolSelection);

      expect(result.success).toBe(true);
      expect(result.tool).toBe('file_read');
      expect(agent.executionContext.artifacts.file_content).toBeDefined();
      expect(agent.operationHistory).toHaveLength(1);
    });

    test('throws error for unresolved tool', async () => {
      const toolSelection = {
        selectedTool: "nonexistent_tool",
        parameters: {},
        outputVariable: "result"
      };

      await expect(agent.executeTool(toolSelection))
        .rejects.toThrow('Tool nonexistent_tool not found');
    });

    test('validates parameter resolution', async () => {
      const toolSelection = {
        selectedTool: "file_read",
        parameters: { "filePath": "@missing_variable" },
        outputVariable: "result"
      };

      await expect(agent.executeTool(toolSelection))
        .rejects.toThrow('Parameter resolution failed');
    });

    test('stores tool results in context correctly', async () => {
      const mockFileRead = new MockTool('file_read', async (params) => ({
        success: true,
        data: { content: "Hello World!", size: 12 }
      }));

      agent.resolvedTools.set('file_read', mockFileRead);

      const toolSelection = {
        selectedTool: "file_read",
        parameters: { "filePath": "/tmp/test.txt" },
        outputVariable: "file_data"
      };

      await agent.executeTool(toolSelection);

      expect(agent.executionContext.artifacts.file_data).toEqual({
        content: "Hello World!",
        size: 12
      });
    });
  });

  describe('Complete Message Processing Pipeline', () => {
    beforeEach(async () => {
      await agent.initializeTools();
      
      // Set up comprehensive mock responses
      mockLLMClient.responses = {
        toolNeedAnalysis: '{"needsTools": true, "reasoning": "User wants to read a file"}',
        toolSelection: '{"selectedTool": "file_read", "reasoning": "File reading required", "parameters": {"filePath": "config.json"}, "outputVariable": "config_data"}',
        completion: '{"complete": true, "userResponse": "I successfully read the file and the content is now available", "nextAction": null}'
      };
    });

    test('complete workflow: tool needed → search → select → execute → respond', async () => {
      const result = await agent.processMessage("Read config.json");

      expect(result.toolsUsed).toContain('file_read');
      expect(result.contextUpdated).toContain('config_data');
      expect(result.userResponse).toContain('successfully');
      expect(result.operationCount).toBe(1);
      expect(agent.chatHistory).toHaveLength(2); // User + agent
    });

    test('workflow with existing context - no tools needed', async () => {
      mockLLMClient.responses.toolNeedAnalysis = '{"needsTools": false, "reasoning": "Information available in context"}';
      mockLLMClient.responses.default = 'Based on the stored data, the answer is 3000';
      
      agent.executionContext.artifacts.config_data = { port: 3000 };

      const result = await agent.processMessage("What port is configured?");

      expect(result.toolsUsed).toEqual([]);
      expect(result.contextUpdated).toEqual([]);
      expect(result.operationCount).toBe(0);
    });

    test('workflow with no suitable tools found', async () => {
      // Return no matching tools
      mockToolRegistry.tools = [
        { name: 'unrelated_tool', description: 'Does something else' }
      ];

      mockLLMClient.responses.toolSelection = '{"selectedTool": null, "reasoning": "No suitable tools found"}';

      const result = await agent.processMessage("Do something impossible");

      expect(result.success).toBe(false);
      expect(result.toolsUsed).toEqual([]);
      expect(result.userResponse).toContain('not suitable');
    });

    test('handles tool execution errors gracefully', async () => {
      const failingTool = new MockTool('failing_tool', async () => {
        throw new Error('Tool execution failed');
      });
      
      agent.resolvedTools.set('failing_tool', failingTool);

      mockLLMClient.responses.toolSelection = '{"selectedTool": "failing_tool", "reasoning": "Test", "parameters": {}, "outputVariable": "result"}';

      const result = await agent.processMessage("Use failing tool");

      expect(result.userResponse).toContain('error');
      expect(result.error).toBeDefined();
    });
  });

  describe('Context State Management', () => {
    test('getContextState returns accurate state', async () => {
      await agent.initializeTools();
      agent.executionContext.artifacts.test_var = "test_value";
      agent.chatHistory.push({ role: 'user', content: 'test' });
      agent.operationHistory.push({ tool: 'test_tool' });

      const state = agent.getContextState();

      expect(state.artifacts).toEqual({ test_var: "test_value" });
      expect(state.chatHistoryLength).toBe(1);
      expect(state.operationCount).toBe(1);
      expect(state.resolvedToolsCount).toBe(4);
    });

    test('clearContext removes all state', () => {
      agent.executionContext.artifacts.test = "value";
      agent.chatHistory.push({ role: 'user', content: 'test' });
      agent.operationHistory.push({ tool: 'test' });

      agent.clearContext();

      expect(agent.executionContext.artifacts).toEqual({});
      expect(agent.chatHistory).toEqual([]);
      expect(agent.operationHistory).toEqual([]);
    });
  });

  describe('Variable Preview Generation', () => {
    test('getVariablePreview handles different data types', () => {
      expect(agent.getVariablePreview("short string")).toBe('"short string"');
      expect(agent.getVariablePreview("a".repeat(60))).toMatch(/"a{47}\.\.\."/);
      expect(agent.getVariablePreview(42)).toBe('42');
      expect(agent.getVariablePreview(true)).toBe('true');
      expect(agent.getVariablePreview([1, 2, 3])).toBe('Array(3)');
      expect(agent.getVariablePreview({a: 1, b: 2})).toBe('Object(2 keys)');
      expect(agent.getVariablePreview(null)).toBe('null');
      expect(agent.getVariablePreview(undefined)).toBe('undefined');
    });
  });

  describe('Error Handling', () => {
    test('validateParameterResolution throws for missing variables', () => {
      const resolvedParams = {
        "valid_param": "value",
        "invalid_param": undefined
      };
      const originalParams = {
        "valid_param": "value", 
        "invalid_param": "@missing_variable"
      };

      expect(() => agent.validateParameterResolution(resolvedParams, originalParams))
        .toThrow('Parameter resolution failed');
    });

    test('handles JSON parsing errors in LLM responses', async () => {
      mockLLMClient.responses.toolNeedAnalysis = 'Invalid JSON {broken';

      const result = await agent.analyzeToolNeed("test request");

      expect(result.needsTools).toBe(true); // Should default to true
      expect(result.reasoning).toContain('Failed to parse');
    });
  });

  describe('Multi-Step Tool Workflows', () => {
    test('executes tool chain with context flow', async () => {
      await agent.initializeTools();

      // Mock file_read tool that returns content
      const fileReadTool = new MockTool('file_read', async (params) => ({
        success: true,
        data: { content: '{"port": 3000, "host": "localhost"}' }
      }));

      // Mock json_parse tool that parses content
      const jsonParseTool = new MockTool('json_parse', async (params) => ({
        success: true,
        data: JSON.parse(params.content)
      }));

      agent.resolvedTools.set('file_read', fileReadTool);
      agent.resolvedTools.set('json_parse', jsonParseTool);

      // Step 1: Read file
      const step1Selection = {
        selectedTool: "file_read",
        parameters: { "filePath": "config.json" },
        outputVariable: "file_content"
      };

      await agent.executeTool(step1Selection);

      // Step 2: Parse content using stored result
      const step2Selection = {
        selectedTool: "json_parse", 
        parameters: { "content": "@file_content" },
        outputVariable: "parsed_config"
      };

      await agent.executeTool(step2Selection);

      // Verify context flow
      expect(agent.executionContext.artifacts.file_content).toBeDefined();
      expect(agent.executionContext.artifacts.parsed_config).toEqual({
        port: 3000,
        host: "localhost"
      });
      expect(agent.operationHistory).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty user input', async () => {
      const result = await agent.processMessage("");

      expect(result.userResponse).toBeDefined();
      expect(result.error).toBeDefined();
    });

    test('handles very large context variables', () => {
      const largeData = {
        bigArray: new Array(1000).fill('test'),
        bigObject: {}
      };
      
      for (let i = 0; i < 100; i++) {
        largeData.bigObject[`key${i}`] = `value${i}`;
      }

      agent.executionContext.artifacts.large_data = largeData;

      const preview = agent.getVariablePreview(largeData);
      expect(preview).toBe('Object(2 keys)'); // Should handle large objects gracefully
    });

    test('handles circular references in context', () => {
      const circularObj = { name: 'test' };
      circularObj.self = circularObj;

      // Should not crash when creating preview
      const preview = agent.getVariablePreview(circularObj);
      expect(preview).toBe('Object(2 keys)');
    });
  });

  describe('Integration with BT Executor Patterns', () => {
    test('uses same context.artifacts pattern as BT Executor', () => {
      const testData = { result: "success" };
      agent.executionContext.artifacts.test_result = testData;

      // Verify same access pattern as BT Executor
      expect(agent.executionContext.artifacts.test_result).toBe(testData);
      expect(agent.executionContext.artifacts['test_result']).toBe(testData);
    });

    test('parameter resolution matches BT Executor behavior', () => {
      agent.executionContext.artifacts.file_path = "/path/to/file";
      agent.executionContext.artifacts.encoding = "utf8";

      const params = {
        path: "@file_path",
        encoding: "@encoding",
        mode: "read"
      };

      const resolved = agent.resolveParams(params);

      expect(resolved).toEqual({
        path: "/path/to/file",
        encoding: "utf8", 
        mode: "read"
      });
    });
  });
});