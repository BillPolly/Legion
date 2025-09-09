/**
 * Simple tool calling integration test
 * Tests tool calling logic without complex imports
 * NO MOCKS - uses real LLM for tool call generation
 */

import { ResourceManager } from '@legion/resource-manager';

describe('Simple Tool Calling Integration', () => {
  let resourceManager;
  let llmClient;

  beforeAll(async () => {
    // Get real ResourceManager and LLM client (NO MOCKS)
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
  });

  test('should get tool calling response from real LLM', async () => {
    const toolCallingPrompt = `You are a helpful assistant that can use tools.

User Request: Create a file called "test.txt" with content "hello world"

Please respond with JSON in this exact format:
{
  "response": "I'll create that file for you",
  "use_tool": {
    "name": "write_file", 
    "args": {"absolute_path": "/tmp/test.txt", "content": "hello world"}
  }
}

If tools are needed, include the use_tool section.`;

    const response = await llmClient.complete(toolCallingPrompt);
    
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
    
    console.log('LLM Tool Call Response:', response);
    
    // Should contain tool call structure
    expect(response).toMatch(/use_tool|write_file|test\.txt/);
  }, 60000);

  test('should parse tool calls from LLM response', () => {
    const mockResponse = `I'll help you create that file.

{
  "response": "Creating the file now",
  "use_tool": {
    "name": "write_file",
    "args": {"absolute_path": "/tmp/test.txt", "content": "hello world"}
  }
}

The file has been created successfully.`;

    // Test the parsing logic directly
    const toolCalls = [];
    const jsonMatches = mockResponse.match(/\{[\s\S]*?"use_tool"[\s\S]*?\}/g) || [];
    
    for (const match of jsonMatches) {
      try {
        const parsed = JSON.parse(match);
        if (parsed.use_tool && parsed.use_tool.name && parsed.use_tool.args) {
          toolCalls.push({
            name: parsed.use_tool.name,
            args: parsed.use_tool.args
          });
        }
      } catch (error) {
        // Skip invalid JSON
      }
    }

    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].name).toBe('write_file');
    expect(toolCalls[0].args.absolute_path).toBe('/tmp/test.txt');
    expect(toolCalls[0].args.content).toBe('hello world');
  });

  test('should request structured tool calling from real LLM', async () => {
    const prompt = `User wants to: List files in /tmp directory

Respond with JSON tool call:
{
  "response": "I'll list the files for you",
  "use_tool": {
    "name": "list_files",
    "args": {"path": "/tmp"}
  }
}`;

    const response = await llmClient.complete(prompt);
    
    expect(typeof response).toBe('string');
    console.log('Structured tool call response:', response);
    
    // Should contain list_files tool call
    expect(response).toMatch(/list_files|path.*tmp/);
  }, 60000);
});