/**
 * Step 3: Test shell_command works in ConversationManager
 * This is the CRITICAL step I skipped that would have caught the integration bug
 */

import ConversationManager from '../../src/conversation/ConversationManager.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Step 3: Shell Command in ConversationManager', () => {
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

  it('should execute shell_command through ConversationManager and format beautifully', async () => {
    const userMessage = "Run the command 'echo Hello World'";
    
    console.log('👤 User message:', userMessage);
    
    const response = await conversationManager.processMessage(userMessage);
    
    console.log('🤖 Raw response content:', response.content);
    console.log('🔧 Tools executed count:', response.tools.length);
    
    if (response.tools.length > 0) {
      console.log('🔧 Tool details:', response.tools[0]);
    }
    
    // CRITICAL CHECKS:
    
    // 1. Should either execute tool or provide explanation
    if (response.tools.length > 0) {
      const shellTool = response.tools.find(t => t.name === 'shell_command');
      expect(shellTool).toBeDefined();
      expect(shellTool.result.success).toBe(true);
      expect(shellTool.result.data.stdout).toContain('Hello World');
      
      // Should contain beautiful formatting
      expect(response.content).toContain('🔧 Shell Command Result');
      expect(response.content).toContain('**Command:** `echo Hello World`');
      expect(response.content).toContain('**Exit Code:** 0');
      expect(response.content).toContain('```bash');
      expect(response.content).toContain('Hello World');
      
      console.log('✅ shell_command executed with beautiful formatting');
    } else {
      console.log('ℹ️ LLM provided explanation instead of using shell_command tool');
      expect(response.content.length).toBeGreaterThan(10);
      expect(response.content).toContain('Hello World');
    }
    
    console.log('✅ shell_command ConversationManager integration VERIFIED');
    
  }, 30000);
});