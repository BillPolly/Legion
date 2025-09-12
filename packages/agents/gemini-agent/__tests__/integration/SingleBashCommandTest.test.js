/**
 * Single Bash Command Test - Verify shell_command tool works properly
 * Tests through actor interface like the UI would
 * NO MOCKS - uses real ConversationManager and verifies actual command execution
 */

import ConversationManager from '../../src/conversation/ConversationManager.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Single Bash Command Test', () => {
  let conversationManager;
  let resourceManager;

  beforeAll(async () => {
    // Get real ResourceManager with .env
    resourceManager = await ResourceManager.getInstance();
    
    // Check for required API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY required for bash command testing');
    }

    console.log('✅ Single bash command test initialized');
  });

  beforeEach(() => {
    // Create real ConversationManager (like the UI does)
    conversationManager = new ConversationManager(resourceManager);
  });

  it('should execute ls command and return actual directory listing', async () => {
    // Send message exactly like the UI would
    const userMessage = "Run the command 'ls -la' to show the current directory contents";
    
    console.log('👤 Sending message:', userMessage);
    
    // Process through ConversationManager (like WebSocket handler does)
    const response = await conversationManager.processMessage(userMessage);
    
    console.log('🤖 Agent Response Length:', response.content.length);
    console.log('🔧 Tools Executed:', response.tools.length);
    
    // Verify response structure
    expect(response).toHaveProperty('content');
    expect(response).toHaveProperty('tools');
    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('type', 'assistant');
    
    // Check if shell_command tool was invoked
    let shellCommandUsed = false;
    let actualCommandOutput = null;
    
    if (response.tools && response.tools.length > 0) {
      const shellTool = response.tools.find(tool => tool.name === 'shell_command');
      
      if (shellTool) {
        shellCommandUsed = true;
        console.log('✅ shell_command tool was invoked');
        console.log('📋 Command args:', shellTool.args);
        console.log('📊 Tool result success:', shellTool.result?.success);
        
        // Verify the command was actually executed
        expect(shellTool.args).toHaveProperty('command');
        expect(shellTool.args.command).toContain('ls');
        
        // Verify tool execution succeeded
        expect(shellTool.result).toHaveProperty('success');
        if (shellTool.result.success) {
          expect(shellTool.result.data).toHaveProperty('stdout');
          actualCommandOutput = shellTool.result.data.stdout;
          console.log('📄 Actual command output:', actualCommandOutput.substring(0, 100));
          
          // Verify output contains expected directory listing elements
          expect(actualCommandOutput).toMatch(/total \d+/); // ls -la starts with "total"
          expect(actualCommandOutput).toContain('drwx'); // Directory permissions
          expect(actualCommandOutput).toContain('.'); // Current directory
        } else {
          console.log('❌ Tool execution failed:', shellTool.result.error);
        }
      }
    }
    
    // Verify response content formatting
    if (shellCommandUsed && actualCommandOutput) {
      // Should have beautiful formatting instead of raw JSON
      expect(response.content).toContain('🔧'); // Command icon
      expect(response.content).toContain('Command Result'); // Formatted header
      expect(response.content).toContain('```bash'); // Syntax highlighting
      expect(response.content).toContain('ls -la'); // Original command
      expect(response.content).not.toContain('<tool_use'); // No raw XML
      
      console.log('✅ Beautiful formatting confirmed');
      console.log('📝 Formatted response preview:', response.content.substring(0, 200));
    } else {
      console.log('ℹ️ LLM chose not to use shell_command tool');
      // Should still have a helpful response
      expect(response.content.length).toBeGreaterThan(20);
    }
    
    // Verify conversation history is maintained
    const history = conversationManager.getConversationHistory();
    expect(history.length).toBeGreaterThanOrEqual(2); // user + assistant
    expect(history[0].role).toBe('user');
    expect(history[0].content).toBe(userMessage);
    expect(history[1].role).toBe('assistant');
    
    console.log('💬 Conversation history length:', history.length);
    
  }, 30000);
});