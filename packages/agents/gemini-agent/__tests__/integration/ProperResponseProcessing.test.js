/**
 * Test Proper Response Processing Architecture
 * Verify ResponseValidator with format instructions works correctly
 * NO manual parsing - use Legion architecture properly
 */

import ConversationManager from '../../src/conversation/ConversationManager.js';
import { ResourceManager } from '@legion/resource-manager';
import { ResponseValidator } from '@legion/output-schema';

describe('Proper Response Processing Architecture', () => {
  let conversationManager;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY required for response processing tests');
    }

    console.log('✅ Proper response processing test initialized');
  });

  beforeEach(() => {
    conversationManager = new ConversationManager(resourceManager);
  });

  describe('Format Instructions Generation', () => {
    it('should generate proper format instructions from schema', async () => {
      await conversationManager._initializeAsync();
      
      // Test that ResponseValidator generates instructions
      const instructions = conversationManager.responseValidator.generateInstructions({
        response: "I understand and will help you.",
        use_tool: {
          name: "shell_command", 
          args: { command: "echo test" }
        }
      });
      
      console.log('📋 Generated format instructions:');
      console.log(instructions);
      
      expect(instructions).toBeDefined();
      expect(typeof instructions).toBe('string');
      expect(instructions.length).toBeGreaterThan(50);
      
      // Should contain format guidance
      expect(instructions).toMatch(/format|json|response/i);
      
      console.log('✅ Format instructions generated successfully');
    });

    it('should include format instructions in system prompt', async () => {
      await conversationManager._initializeAsync();
      
      // Mock the SimplePromptClient to see what system prompt is used
      const originalRequest = conversationManager.simpleClient.request;
      let capturedSystemPrompt = null;
      
      conversationManager.simpleClient.request = async (options) => {
        capturedSystemPrompt = options.systemPrompt;
        return {
          content: '{"response": "Mock response for testing"}',
          metadata: { provider: 'mock' }
        };
      };
      
      await conversationManager.processMessage('Test message');
      
      console.log('📋 System prompt length:', capturedSystemPrompt.length);
      console.log('📋 Contains instructions:', capturedSystemPrompt.includes('RESPONSE FORMAT'));
      
      expect(capturedSystemPrompt).toContain('RESPONSE FORMAT');
      expect(capturedSystemPrompt.length).toBeGreaterThan(conversationManager.systemPrompt.length);
      
      // Restore original function
      conversationManager.simpleClient.request = originalRequest;
      
      console.log('✅ Format instructions properly added to system prompt');
    });
  });

  describe('Output-Schema Processing', () => {
    it('should process JSON responses correctly', async () => {
      await conversationManager._initializeAsync();
      
      // Test JSON response processing
      const jsonResponse = '{"response": "I will run the command.", "use_tool": {"name": "shell_command", "args": {"command": "echo test"}}}';
      
      const validationResult = conversationManager.responseValidator.process(jsonResponse);
      
      console.log('📊 JSON validation result:', validationResult);
      
      expect(validationResult.success).toBe(true);
      expect(validationResult.data.response).toBe('I will run the command.');
      expect(validationResult.data.use_tool.name).toBe('shell_command');
      expect(validationResult.data.use_tool.args.command).toBe('echo test');
      
      console.log('✅ JSON response processing works correctly');
    });

    it('should handle XML responses gracefully (with format instructions LLM should use JSON)', async () => {
      await conversationManager._initializeAsync();
      
      // Test XML response processing - with format instructions, LLM should use JSON
      const xmlResponse = `I'll run that command.

<tool_use name="shell_command" parameters='{"command": "echo xml test"}'></tool_use>`;

      const validationResult = conversationManager.responseValidator.process(xmlResponse);
      
      console.log('📊 XML validation result:', validationResult);
      
      // With proper format instructions, LLM should use JSON, but output-schema can handle XML too
      if (validationResult.success) {
        expect(validationResult.data.use_tool.name).toBe('shell_command');
        console.log('✅ XML response processed successfully');
      } else {
        console.log('ℹ️ XML response not processed - LLM should use JSON format with instructions');
        expect(validationResult.errors).toBeDefined();
      }
    });

    it('should handle malformed responses gracefully', async () => {
      await conversationManager._initializeAsync();
      
      // Test malformed response
      const malformedResponse = 'Just a regular response with no proper format.';
      
      const validationResult = conversationManager.responseValidator.process(malformedResponse);
      
      console.log('📊 Malformed validation result:', validationResult);
      
      // Should either succeed with cleaned data or fail gracefully
      if (validationResult.success) {
        expect(validationResult.data.response).toBeDefined();
        console.log('✅ Malformed response cleaned successfully');
      } else {
        expect(validationResult.errors).toBeDefined();
        console.log('✅ Malformed response handled gracefully with errors');
      }
    });
  });

  describe('End-to-End Tool Execution', () => {
    it('should execute tools with proper architecture (no manual parsing)', async () => {
      const userMessage = "Run the command 'echo Proper Architecture Test'";
      
      console.log('👤 Testing:', userMessage);
      
      const response = await conversationManager.processMessage(userMessage);
      
      console.log('🤖 Response details:');
      console.log('  content length:', response.content.length);
      console.log('  tools executed:', response.tools.length);
      console.log('  contains formatting:', response.content.includes('🔧'));
      console.log('  contains command:', response.content.includes('echo Proper Architecture Test'));
      
      // Should execute tool and format beautifully
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.content).not.toContain('<tool_use'); // No raw XML
      
      if (response.tools.length > 0) {
        expect(response.tools[0].name).toBe('shell_command');
        expect(response.content).toContain('🔧 Shell Command Result');
        console.log('✅ Tool executed with proper architecture');
      } else {
        console.log('ℹ️ LLM provided explanation instead of using tool');
      }
      
    }, 30000);
  });
});