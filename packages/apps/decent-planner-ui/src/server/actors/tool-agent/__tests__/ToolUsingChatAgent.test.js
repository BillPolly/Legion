/**
 * ToolUsingChatAgent Tests - Updated for current API
 */

import { ToolUsingChatAgent } from '../ToolUsingChatAgent.js';

// Mock dependencies
class MockToolRegistry {
  constructor() {
    this.tools = [
      { name: 'file_read', description: 'Mock tool: file_read', execute: jest.fn().mockResolvedValue({ success: true, data: 'mock content' }) },
      { name: 'file_write', description: 'Mock tool: file_write', execute: jest.fn().mockResolvedValue({ success: true, data: 'written' }) },
      { name: 'json_parse', description: 'Mock tool: json_parse', execute: jest.fn().mockResolvedValue({ success: true, data: { parsed: true } }) },
      { name: 'web_search', description: 'Mock tool: web_search', execute: jest.fn().mockResolvedValue({ success: true, data: ['result1', 'result2'] }) }
    ];
  }

  async searchTools(query, options = {}) {
    return this.tools.map(tool => ({ ...tool, confidence: 0.8, tool }));
  }
}

class MockLLMClient {
  constructor() {
    this.callHistory = [];
    this.responses = {};
  }

  async complete(prompt, maxTokens) {
    this.callHistory.push({ prompt, maxTokens, timestamp: Date.now() });

    // Determine response based on prompt content
    if (prompt.includes('needsTools')) {
      return this.responses['tool-need-analysis'] || JSON.stringify({ needsTools: true, reasoning: "Mock analysis" });
    }
    
    if (prompt.includes('Tool Sequence Planning')) {
      return this.responses['tool-sequence-planning'] || JSON.stringify({ type: 'single', tool: 'file_read', inputs: { filePath: '/test' }, outputs: { content: 'result' } });
    }

    if (prompt.includes('user-response-generation')) {
      return this.responses['user-response-generation'] || JSON.stringify({ response: "Mock user response" });
    }

    return this.responses.default || "Mock LLM response";
  }
}

describe('ToolUsingChatAgent', () => {
  let agent;
  let mockToolRegistry;
  let mockLLMClient;

  beforeEach(() => {
    mockToolRegistry = new MockToolRegistry();
    mockLLMClient = new MockLLMClient();
    
    agent = new ToolUsingChatAgent(mockToolRegistry, mockLLMClient);
  });

  afterEach(() => {
    agent = null;
  });

  describe('Initialization', () => {
    test('initializes with default context and chat history', () => {
      expect(agent.executionContext.artifacts).toHaveProperty('output_directory');
      expect(agent.executionContext.artifacts).toHaveProperty('agent_context');
      expect(agent.executionContext.artifacts.output_directory.value).toBe('./tmp');
      expect(agent.chatHistory).toEqual([]);
      expect(agent.operationHistory).toEqual([]);
    });

    test('has proper tool registry and context setup', () => {
      expect(agent.toolRegistry).toBeDefined();
      expect(agent.llmClient).toBeDefined();
      expect(agent.contextOptimizer).toBeDefined();
      expect(agent.executionContext.artifacts.agent_context.value.toolRegistry).toBeDefined();
    });
  });

  describe('Context Management', () => {
    test('resolveParams handles @varName substitution correctly', () => {
      agent.executionContext.artifacts.user_file = "/path/to/file.txt";
      agent.executionContext.artifacts.search_query = "nodejs tutorial";

      const resolved = agent.resolveParams({
        "filePath": "@user_file",
        "query": "@search_query", 
        "constant": "hello world"
      });

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
      
      expect(resolved.existing).toBe("exists");
      expect(resolved.missing).toBeUndefined();
      expect(resolved.constant).toBe("test");
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
        agent.addAgentMessage(`Message ${i}`);
      }

      const formatted = agent.formatChatHistory();
      const lines = formatted.split('\n');

      expect(lines.length).toBeLessThanOrEqual(5);
    });

    test('sanitizeContentForPrompt filters base64 data', () => {
      // Create a longer base64 string that will trigger the regex (needs 100+ chars)
      const longBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='.repeat(3);
      const contentWithBase64 = `Here is an image: data:image/png;base64,${longBase64} and some text`;
      
      const sanitized = agent.sanitizeContentForPrompt(contentWithBase64);
      
      expect(sanitized).toContain('[IMAGE_DATA_REMOVED]');
      expect(sanitized).not.toContain('iVBORw0KGgo');
    });
  });

  describe('Tool Need Analysis', () => {
    test('correctly identifies when tools are needed', async () => {
      mockLLMClient.responses['tool-need-analysis'] = JSON.stringify({ 
        needsTools: true, 
        reasoning: "User wants to create something" 
      });

      const result = await agent.analyzeToolNeed("create a file");

      expect(result.needsTools).toBe(true);
      expect(result.reasoning).toContain("create");
    });

    test('correctly identifies when existing context is sufficient', async () => {
      mockLLMClient.responses['tool-need-analysis'] = JSON.stringify({ 
        needsTools: false, 
        reasoning: "Can answer with existing context" 
      });

      const result = await agent.analyzeToolNeed("what is in my file?");

      expect(result.needsTools).toBe(false);
    });

    test('handles LLM parsing errors gracefully', async () => {
      mockLLMClient.responses['tool-need-analysis'] = "Invalid JSON {broken";

      const result = await agent.analyzeToolNeed("test message");

      expect(result.needsTools).toBe(true);
      expect(result.reasoning).toContain("Failed to parse");
    });
  });

  describe('Tool Search', () => {
    test('enhances search query with context information', async () => {
      agent.executionContext.artifacts.user_data = "test data";
      
      const results = await agent.searchForTools("find something");
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test('returns empty array when no tools found', async () => {
      mockToolRegistry.searchTools = jest.fn().mockResolvedValue([]);
      
      const results = await agent.searchForTools("impossible task");
      
      expect(results).toEqual([]);
    });

    test('handles search errors gracefully', async () => {
      mockToolRegistry.searchTools = jest.fn().mockRejectedValue(new Error('Search failed'));
      
      const results = await agent.searchForTools("test query");
      
      expect(results).toEqual([]);
    });
  });

  describe('Complete Message Processing', () => {
    test('processes message successfully', async () => {
      mockLLMClient.responses['tool-need-analysis'] = JSON.stringify({ needsTools: false, reasoning: "Can answer directly" });
      mockLLMClient.responses['user-response-generation'] = "Direct response";

      const result = await agent.processMessage("Hello");

      expect(result.complete).toBe(true);
      expect(result.userResponse).toBeDefined();
    });

    test('handles tool execution workflow', async () => {
      mockLLMClient.responses['tool-need-analysis'] = JSON.stringify({ needsTools: true, reasoning: "Need tools" });
      mockLLMClient.responses['tool-sequence-planning'] = JSON.stringify({ 
        type: 'single', 
        tool: 'file_read', 
        inputs: { filePath: '/test' },
        outputs: { content: 'result_var' }
      });
      mockLLMClient.responses['user-response-generation'] = JSON.stringify({ response: "Tool executed successfully" });

      const result = await agent.processMessage("read a file");

      expect(result.complete).toBe(true);
      expect(result.toolsUsed.length).toBeGreaterThan(0);
    });
  });

  describe('Context State Management', () => {
    test('getContextState returns accurate state', () => {
      agent.chatHistory.push({ role: 'user', content: 'test', timestamp: Date.now() });
      agent.operationHistory.push({ tool: 'test', success: true });

      const state = agent.getContextState();

      expect(state.chatHistoryLength).toBe(1);
      expect(state.operationCount).toBe(1);
      expect(state.artifacts).toBeDefined();
    });

    test('clearContext removes all state', () => {
      agent.chatHistory.push({ role: 'user', content: 'test' });
      agent.operationHistory.push({ tool: 'test' });
      agent.executionContext.artifacts.test = 'value';

      agent.clearContext();

      expect(agent.chatHistory).toEqual([]);
      expect(agent.operationHistory).toEqual([]);
      expect(Object.keys(agent.executionContext.artifacts)).toEqual([]);
    });
  });

  describe('Variable Preview Generation', () => {
    test('getVariablePreview handles different data types', () => {
      expect(agent.getVariablePreview("short string")).toBe('"short string"');
      expect(agent.getVariablePreview("a".repeat(100))).toContain('...');
      expect(agent.getVariablePreview(123)).toBe('123');
      expect(agent.getVariablePreview(true)).toBe('true');
      expect(agent.getVariablePreview([1, 2, 3])).toBe('Array(3)');
      expect(agent.getVariablePreview({ a: 1, b: 2 })).toBe('Object(2 keys)');
    });
  });

  describe('Error Handling', () => {
    test('validateParameterResolution throws for missing variables', () => {
      const resolvedParams = { file: undefined, valid: 'test' };
      const originalParams = { file: '@missing_var', valid: 'test' };

      expect(() => {
        agent.validateParameterResolution(resolvedParams, originalParams);
      }).toThrow('Parameter resolution failed');
    });

    test('handles JSON parsing errors in LLM responses', async () => {
      mockLLMClient.responses['tool-need-analysis'] = "Invalid JSON {broken";

      const result = await agent.analyzeToolNeed("test");

      expect(result.needsTools).toBe(true);
      expect(result.reasoning).toContain('Failed to parse');
    });
  });

  describe('Integration with BT Executor Patterns', () => {
    test('uses same context.artifacts pattern as BT Executor', () => {
      expect(agent.executionContext).toHaveProperty('artifacts');
      expect(typeof agent.executionContext.artifacts).toBe('object');
    });

    test('parameter resolution matches BT Executor behavior', () => {
      agent.executionContext.artifacts.file_path = "/path/to/file";
      agent.executionContext.artifacts.encoding = "utf8";

      const resolved = agent.resolveParams({
        "filePath": "@file_path",
        "encoding": "@encoding",
        "constant": "value"
      });

      expect(resolved.filePath).toBe("/path/to/file");
      expect(resolved.encoding).toBe("utf8");
      expect(resolved.constant).toBe("value");
    });
  });
});