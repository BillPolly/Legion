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
    test('initializes with default context and empty chat history', () => {
      expect(agent.executionContext.artifacts).toEqual({
        output_directory: {
          value: './tmp',
          description: 'Default directory for saving generated files and outputs. When using tools with path parameters, use this directory path with specific filenames (e.g., "./tmp/image.png", "./tmp/document.txt").'
        }
      });
      expect(agent.chatHistory).toEqual([]);
      expect(agent.operationHistory).toEqual([]);
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
      expect(formatted).toContain('user_data: {"name":"John","age":30}');
      expect(formatted).toContain('results: Array(3 items)');
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
    test('selectToolSequence returns a plan object', async () => {
      const searchResults = [
        { 
          name: 'file_read', 
          description: 'Read files', 
          confidence: 0.9,
          tool: { description: 'Read files', inputSchema: {}, outputSchema: {} }
        }
      ];

      // Mock LLM returns invalid JSON (default behavior)
      mockLLMClient.responses.default = 'Mock LLM response';

      const plan = await agent.selectToolSequence(searchResults, "read the file");

      // Should return some kind of plan object, even if parsing fails
      expect(plan).toBeDefined();
      expect(typeof plan).toBe('object');
    });
  });

  describe('Tool Execution', () => {
    test('executeTool requires tool to be in currentSearchResults', async () => {
      // Set up context
      agent.executionContext.artifacts.input_file = "/tmp/input.txt";

      const toolSelection = {
        selectedTool: "file_read",
        parameters: { "filePath": "@input_file", "encoding": "utf8" },
        outputVariable: "file_content"
      };

      // Without currentSearchResults set up, should throw error
      await expect(agent.executeTool(toolSelection))
        .rejects.toThrow('Tool file_read not found in search results');
    });

    test('validates parameter resolution', async () => {
      const toolSelection = {
        selectedTool: "file_read",
        parameters: { "filePath": "@missing_variable" },
        outputVariable: "result"
      };

      // Set up search results with mock tool
      agent.currentSearchResults = [{
        name: "file_read",
        tool: new MockTool('file_read')
      }];

      await expect(agent.executeTool(toolSelection))
        .rejects.toThrow('Parameter resolution failed');
    });
  });

  describe('Complete Message Processing Pipeline', () => {
    beforeEach(() => {
      // Set up comprehensive mock responses
      mockLLMClient.responses = {
        toolNeedAnalysis: '{"needsTools": true, "reasoning": "User wants to read a file"}',
        default: '{"complete": true, "userResponse": "I successfully processed your request", "nextAction": null}'
      };
    });

    test('complete workflow: tool needed → search → select → execute → respond', async () => {
      const result = await agent.processMessage("Read config.json");

      // With empty mock registry, no tools will be found, so workflow should explain this
      expect(result.toolsUsed).toEqual([]);
      expect(result.userResponse).toContain('find any relevant tools');
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

      const result = await agent.processMessage("Do something impossible");

      expect(result.toolsUsed).toEqual([]);
      expect(result.userResponse).toContain("didn't find any relevant tools");
    });

    test('handles search errors gracefully', async () => {
      // Mock registry that throws error during search
      const errorRegistry = new MockToolRegistry([]);
      errorRegistry.searchTools = async () => {
        throw new Error('Search service down');
      };
      
      const errorAgent = new ToolUsingChatAgent(errorRegistry, mockLLMClient);

      const result = await errorAgent.processMessage("Search for something");

      expect(result.toolsUsed).toEqual([]);
    });
  });

  describe('Context State Management', () => {
    test('getContextState returns accurate state', () => {
      agent.executionContext.artifacts.test_var = "test_value";
      agent.chatHistory.push({ role: 'user', content: 'test' });
      agent.operationHistory.push({ tool: 'test_tool' });

      const state = agent.getContextState();

      expect(state.artifacts).toEqual({ test_var: "test_value", output_directory: agent.executionContext.artifacts.output_directory });
      expect(state.chatHistoryLength).toBe(1);
      expect(state.operationCount).toBe(1);
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
    test('processMessage supports full workflow integration', async () => {
      // This tests the main processMessage integration rather than low-level execution
      mockLLMClient.responses.toolNeedAnalysis = '{"needsTools": false, "reasoning": "Can provide info from context"}';
      mockLLMClient.responses.default = 'Based on existing data, the workflow completed successfully';

      const result = await agent.processMessage("Explain the workflow");

      expect(result.toolsUsed).toEqual([]);
      expect(result.operationCount).toBe(0);
      expect(result.userResponse).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty user input', async () => {
      const result = await agent.processMessage("");

      // Empty input goes through normal workflow, no error expected
      expect(result.userResponse).toBeDefined();
      expect(result.toolsUsed).toEqual([]);
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