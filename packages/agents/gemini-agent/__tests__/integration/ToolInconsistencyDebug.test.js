/**
 * Debug Tool Execution Inconsistency
 * Find why list_files works but write_file doesn't
 */

import ConversationManager from '../../src/conversation/ConversationManager.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Tool Execution Inconsistency Debug', () => {
  let conversationManager;

  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY required');
    }
    
    conversationManager = new ConversationManager(resourceManager);
    await conversationManager._initializeAsync();
  });

  it('should debug why list_files works but write_file returns XML', async () => {
    console.log('=== TESTING WORKING CASE: list_files ===');
    
    // Test the working case first
    const listResponse = await conversationManager.processMessage("List files in /tmp/webapp");
    
    console.log('LIST_FILES Results:');
    console.log('  toolCalls extracted:', !!listResponse.toolCalls);
    console.log('  tools executed:', listResponse.tools.length);
    console.log('  contains XML:', listResponse.content.includes('<tool_use'));
    console.log('  execution logs shown:', listResponse.content.includes('🔧'));
    
    // This should work
    expect(listResponse.tools.length).toBeGreaterThan(0);
    expect(listResponse.content).not.toContain('<tool_use');
    
    console.log('✅ list_files works correctly');
    
    console.log('\\n=== TESTING FAILING CASE: write_file ===');
    
    // Test the failing case
    const writeResponse = await conversationManager.processMessage("Create a file at /tmp/webapp/debug-test.txt with content 'Debug test'");
    
    console.log('WRITE_FILE Results:');
    console.log('  toolCalls extracted:', !!writeResponse.toolCalls);
    console.log('  tools executed:', writeResponse.tools.length);
    console.log('  contains XML:', writeResponse.content.includes('<tool_use'));
    console.log('  execution logs shown:', writeResponse.content.includes('🔧'));
    console.log('  response preview:', writeResponse.content.substring(0, 200));
    
    // Debug the difference
    if (writeResponse.content.includes('<tool_use')) {
      console.log('🚨 BUG: write_file returns raw XML');
      
      // Check if tools were extracted but not executed
      if (writeResponse.toolCalls && writeResponse.toolCalls.length > 0) {
        console.log('🔧 Tools were extracted but not executed:', writeResponse.toolCalls);
      } else {
        console.log('❌ Tools were not extracted at all');
      }
    } else {
      console.log('✅ write_file works correctly');
      expect(writeResponse.tools.length).toBeGreaterThan(0);
    }
    
    console.log('\\n=== COMPARISON ANALYSIS ===');
    console.log('Working case (list_files):');
    console.log('  - Tools executed:', listResponse.tools.length);
    console.log('  - Beautiful formatting:', !listResponse.content.includes('<tool_use'));
    
    console.log('Failing case (write_file):');
    console.log('  - Tools executed:', writeResponse.tools.length);
    console.log('  - Beautiful formatting:', !writeResponse.content.includes('<tool_use'));
    
  }, 60000);
});