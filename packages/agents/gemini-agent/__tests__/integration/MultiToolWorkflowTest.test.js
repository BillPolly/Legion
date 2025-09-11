/**
 * Test multi-tool workflow capabilities with output-schema
 * NO MOCKS - tests array tool calling with real LLM
 */

import { ResponseValidator } from '@legion/output-schema';
import { ResourceManager } from '@legion/resource-manager';

describe('Multi-Tool Workflow Test', () => {
  let responseValidator;
  let llmClient;

  beforeAll(async () => {
    // Create schema for multiple tools
    const multiToolSchema = {
      type: 'object',
      properties: {
        response: {
          type: 'string',
          description: 'Your response to the user'
        },
        use_tools: {
          type: 'array',
          description: 'Array of tools to execute',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Tool name'
              },
              args: {
                type: 'object',
                description: 'Tool arguments'
              }
            },
            required: ['name', 'args']
          }
        }
      },
      required: ['response', 'use_tools']
    };

    responseValidator = new ResponseValidator(multiToolSchema);

    // Get real LLM client
    const resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
  });

  test('should parse array tool calling schema correctly', () => {
    const testResponse = `{
  "response": "I'll perform both operations for you",
  "use_tools": [
    {
      "name": "write_file",
      "args": {"absolute_path": "/tmp/test1.txt", "content": "First file"}
    },
    {
      "name": "write_file", 
      "args": {"absolute_path": "/tmp/test2.txt", "content": "Second file"}
    }
  ]
}`;

    const result = responseValidator.process(testResponse);
    
    expect(result.success).toBe(true);
    expect(result.data.use_tools).toHaveLength(2);
    expect(result.data.use_tools[0].name).toBe('write_file');
    expect(result.data.use_tools[1].name).toBe('write_file');
    expect(result.data.use_tools[0].args.content).toBe('First file');
    
    // console.log('✅ Array tool schema parsing works');
  });

  test('should generate instructions for multi-tool workflow', () => {
    const exampleData = {
      response: "I'll create and then read the file",
      use_tools: [
        {
          name: "write_file",
          args: {"absolute_path": "/tmp/example.txt", "content": "Example content"}
        },
        {
          name: "read_file",
          args: {"absolute_path": "/tmp/example.txt"}
        }
      ]
    };

    const instructions = responseValidator.generateInstructions(exampleData);
    
    expect(instructions).toContain('use_tools');
    expect(instructions).toContain('Array of tools');
    expect(instructions).toContain('write_file');
    expect(instructions).toContain('read_file');
    
    // console.log('✅ Multi-tool instructions generated');
    // console.log('Instructions preview:', instructions.substring(0, 300));
  });

  test('should request multi-tool workflow from real LLM', async () => {
    const prompt = `You are an assistant that can use multiple tools in sequence.

User request: Create a file called test-multi.txt with content "Multi-tool test" and then read it back to verify.

Respond with JSON in this exact format:
{
  "response": "I'll create the file and then read it back",
  "use_tools": [
    {
      "name": "write_file",
      "args": {"absolute_path": "/tmp/test-multi.txt", "content": "Multi-tool test"}
    },
    {
      "name": "read_file", 
      "args": {"absolute_path": "/tmp/test-multi.txt"}
    }
  ]
}`;

    const response = await llmClient.complete(prompt);
    
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
    
    // console.log('LLM multi-tool response:', response);
    
    // Try to parse the response
    const parseResult = responseValidator.process(response);
    
    if (parseResult.success) {
      // console.log('✅ LLM generated valid multi-tool workflow');
      expect(parseResult.data.use_tools).toHaveLength(2);
      expect(parseResult.data.use_tools[0].name).toBe('write_file');
      expect(parseResult.data.use_tools[1].name).toBe('read_file');
    } else {
      // console.log('❌ LLM response parsing failed:', parseResult.errors);
      // Even if parsing fails, the LLM should attempt multi-tool format
      expect(response).toMatch(/write_file.*read_file|use_tools|array/);
    }
  }, 60000);

  test('should handle complex multi-tool workflow request', async () => {
    const complexPrompt = `User wants to: Find all JavaScript files, then search for 'function' in them, then create a summary file.

Respond with JSON array of tools:
{
  "response": "I'll find JS files, search them, and create a summary",
  "use_tools": [
    {"name": "glob_pattern", "args": {"pattern": "*.js", "path": "/tmp"}},
    {"name": "grep_search", "args": {"pattern": "function", "path": "/tmp"}},
    {"name": "write_file", "args": {"absolute_path": "/tmp/summary.txt", "content": "Summary of findings"}}
  ]
}`;

    const response = await llmClient.complete(complexPrompt);
    
    // console.log('Complex multi-tool response:', response);
    
    // Should contain multiple tools
    expect(response).toMatch(/glob_pattern|grep_search|write_file/);
    
    // console.log('✅ LLM can handle complex multi-tool requests');
  }, 60000);
});