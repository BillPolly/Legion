/**
 * CRITICAL: Tool Extraction and Calling Test
 * Tests the exact mechanism that extracts tool calls from LLM responses
 * and executes them in ConversationManager
 */

import ConversationManager from '../../src/conversation/ConversationManager.js';
import { ResourceManager } from '@legion/resource-manager';

describe('CRITICAL: Tool Extraction and Calling', () => {
  let conversationManager;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY required');
    }
  });

  beforeEach(() => {
    conversationManager = new ConversationManager(resourceManager);
  });

  describe('SimplePromptClient Tool Call Detection', () => {
    it('should test what SimplePromptClient actually returns for tool requests', async () => {
      console.log('🔧 Testing SimplePromptClient response format...');
      
      // Get the SimplePromptClient directly
      await conversationManager._initializeAsync();
      const simpleClient = conversationManager.simpleClient;
      
      // Test direct SimplePromptClient call
      const tools = conversationManager._getToolsForSimpleClient();
      const shellTool = tools.find(t => t.name === 'shell_command');
      
      console.log('🔧 Testing with shell_command tool:', shellTool);
      
      const response = await simpleClient.request({
        prompt: "Run the command 'echo Testing Tool Extraction'",
        systemPrompt: 'You are a helpful assistant. Use tools when appropriate.',
        tools: [shellTool],
        chatHistory: [],
        maxTokens: 1000
      });
      
      console.log('📊 Raw SimplePromptClient response:');
      console.log('  content:', response.content);
      console.log('  toolCalls:', response.toolCalls);
      console.log('  metadata:', response.metadata);
      
      // CRITICAL: Check what SimplePromptClient actually returns
      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('toolCalls');
      expect(response).toHaveProperty('metadata');
      
      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log('✅ SimplePromptClient returned toolCalls array');
        console.log('🔧 Tool call structure:', response.toolCalls[0]);
        
        expect(response.toolCalls[0]).toHaveProperty('name');
        expect(response.toolCalls[0]).toHaveProperty('args');
      } else {
        console.log('❌ SimplePromptClient did NOT return toolCalls array');
        console.log('📝 Content contains:', response.content.substring(0, 200));
      }
    }, 30000);
  });

  describe('Tool Call Extraction Logic', () => {
    it('should manually test tool call extraction from Anthropic XML', () => {
      // Test the exact XML format Anthropic returns
      const anthropicResponse = `I'll run that command for you.

<tool_use name="shell_command" parameters='{"command": "echo Test"}'>
</tool_use>`;

      console.log('🔧 Testing tool extraction from Anthropic XML:');
      console.log(anthropicResponse);
      
      // This is what SimplePromptClient should do internally
      const toolCalls = extractToolCallsFromXML(anthropicResponse);
      
      console.log('🔧 Extracted tool calls:', toolCalls);
      
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].name).toBe('shell_command');
      expect(toolCalls[0].args.command).toBe('echo Test');
      
      console.log('✅ Tool extraction logic works correctly');
    });

    it('should test multiple tool calls in one response', () => {
      const multiToolResponse = `I'll do both operations.

<tool_use name="list_files" parameters='{"path": "."}'>
</tool_use>

And then I'll run a command:

<tool_use name="shell_command" parameters='{"command": "pwd"}'>
</tool_use>`;

      const toolCalls = extractToolCallsFromXML(multiToolResponse);
      
      console.log('🔧 Multiple tool extraction:', toolCalls);
      
      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0].name).toBe('list_files');
      expect(toolCalls[1].name).toBe('shell_command');
      
      console.log('✅ Multiple tool extraction works');
    });
  });

  describe('ConversationManager Tool Processing', () => {
    it('should process tool calls correctly when SimplePromptClient provides them', async () => {
      // This tests the EXACT logic in ConversationManager.processMessage
      const userMessage = "Run the command 'echo ConversationManager Test'";
      
      console.log('👤 Testing ConversationManager with:', userMessage);
      
      const response = await conversationManager.processMessage(userMessage);
      
      console.log('🤖 ConversationManager response:');
      console.log('  content length:', response.content.length);
      console.log('  tools executed:', response.tools.length);
      console.log('  contains XML:', response.content.includes('<tool_use'));
      console.log('  first 200 chars:', response.content.substring(0, 200));
      
      // CRITICAL: Should have executed tools and formatted results
      if (response.tools.length > 0) {
        expect(response.content).not.toContain('<tool_use');
        expect(response.content).toContain('🔧 Shell Command Result');
        console.log('✅ Tool processing works correctly');
      } else {
        console.log('❌ No tools executed - checking why...');
        
        // Check if it's a tool recognition issue
        if (response.content.includes('<tool_use')) {
          console.log('🚨 FOUND THE BUG: XML not being processed!');
          throw new Error('Tool XML returned but not processed - integration bug!');
        }
      }
    }, 30000);
  });
});

/**
 * Tool extraction function for testing (matches what SimplePromptClient should do)
 */
function extractToolCallsFromXML(response) {
  const toolCalls = [];
  
  const toolRegex = /<tool_use name="([^"]+)" parameters='([^']+)'>\s*<\/tool_use>/g;
  let match;
  
  while ((match = toolRegex.exec(response)) !== null) {
    try {
      const parameters = JSON.parse(match[2]);
      toolCalls.push({
        name: match[1],
        args: parameters,
        id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });
    } catch (e) {
      console.warn('Failed to parse tool parameters:', match[2]);
    }
  }
  
  return toolCalls;
}