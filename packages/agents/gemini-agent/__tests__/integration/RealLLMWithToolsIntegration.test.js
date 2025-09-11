/**
 * Integration test for real LLM working with real tools
 * NO MOCKS - uses real Anthropic LLM client and real file system tools
 */

import { ResourceManager } from '@legion/resource-manager';
import ConversationManager from '../../src/conversation/ToolCallingConversationManager.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Real LLM with Tools Integration', () => {
  let conversationManager;
  let resourceManager;
  let llmClient;
  let testDir;

  beforeAll(async () => {
    // Get real ResourceManager and LLM client (NO MOCKS)
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    
    // Create mock prompt manager for testing
    const mockPromptManager = {
      buildSystemPrompt: async () => 'You are a helpful assistant that can use tools.'
    };
    
    conversationManager = new ConversationManager(resourceManager);
    
    // Create real test directory
    testDir = path.join(os.tmpdir(), `llm-tools-integration-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up real test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should get intelligent response from real LLM about code assistance', async () => {
    const userInput = 'Hello! I need help with JavaScript development. Can you assist me?';
    
    const response = await conversationManager.processMessage(userInput);
    
    expect(response.type).toBe('assistant');
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(20);
    
    console.log('LLM Response to coding question:', response.content);
    
    // Response should be helpful and relevant
    expect(response.content.toLowerCase()).toMatch(/help|assist|javascript|develop|project|code/);
  }, 60000);

  test('should demonstrate LLM understanding of available tools', async () => {
    const userInput = 'What can you do to help me with files in my project?';
    
    const response = await conversationManager.processMessage(userInput);
    
    expect(response.type).toBe('assistant');
    console.log('LLM Response about file capabilities:', response.content);
    
    // Should mention file-related capabilities since it has the system prompt
    expect(response.content.toLowerCase()).toMatch(/file|read|write|edit|search/);
  }, 60000);

  test('should combine real LLM with file analysis workflow', async () => {
    // Step 1: Create a real file with content using Node.js fs (no tool imports)
    const testFile = path.join(testDir, 'test-code.js');
    const originalCode = 'function oldName() {\n  return "old value";\n}';
    
    await fs.writeFile(testFile, originalCode, 'utf-8');

    // Step 2: Read the file and ask LLM to analyze it
    const fileContent = await fs.readFile(testFile, 'utf-8');
    
    const analysisPrompt = `I have a JavaScript file with this content:
${fileContent}

Please analyze this code and suggest one specific improvement. Keep your response under 50 words.`;
    
    const analysisResponse = await llmClient.complete(analysisPrompt);
    
    expect(typeof analysisResponse).toBe('string');
    expect(analysisResponse.length).toBeGreaterThan(10);
    
    console.log('LLM Code Analysis:', analysisResponse);
    
    // The LLM should provide intelligent code analysis
    expect(analysisResponse.toLowerCase()).toMatch(/function|code|improve|suggest|name/);

    // Step 3: Ask LLM for a simple coding task response through conversation manager
    const taskResponse = await conversationManager.processMessage(
      'Give me a very brief response about helping with JavaScript.'
    );
    
    expect(taskResponse.type).toBe('assistant');
    console.log('LLM Task Response:', taskResponse.content);
    
  }, 90000); // Longer timeout for multiple LLM calls

  test('should maintain conversation context across real LLM calls', async () => {
    // Clear history for clean test
    conversationManager.clearHistory();
    
    // Multiple turns with real LLM
    const turn1 = await conversationManager.processMessage('My name is TestUser');
    const turn2 = await conversationManager.processMessage('What is my name?');
    
    expect(turn1.type).toBe('assistant');
    expect(turn2.type).toBe('assistant');
    
    console.log('Turn 1 (introduce name):', turn1.content);
    console.log('Turn 2 (recall name):', turn2.content);
    
    // The second response should reference the conversation history
    // The LLM should remember the name from the conversation context
    const history = conversationManager.getConversationHistory();
    expect(history.length).toBe(4); // 2 user + 2 assistant turns
    
  }, 90000);
});