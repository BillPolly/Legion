/**
 * Direct Save Memory Tool Test
 * Tests the actual save_memory tool with real memory operations
 */

import { GeminiToolsModule } from '@legion/gemini-tools';
import { ResourceManager } from '@legion/resource-manager';

describe('Save Memory Tool Direct Test', () => {
  let saveMemoryTool;

  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    const toolsModule = await GeminiToolsModule.create(resourceManager);
    
    // Find save_memory tool
    const tools = toolsModule.getTools();
    const toolEntries = Object.entries(tools);
    saveMemoryTool = toolEntries.find(([key, tool]) => 
      (tool.name === 'save_memory' || tool.toolName === 'save_memory')
    )[1];
    
    if (!saveMemoryTool) {
      throw new Error('save_memory tool not found');
    }
    
    console.log('✅ Found save_memory tool');
  });

  it('should SUCCESS save user information to memory', async () => {
    const args = { 
      fact: 'User prefers TypeScript over JavaScript for large projects'
    };
    
    console.log('🔧 Testing save_memory tool directly');
    console.log('📋 Args:', args);
    
    const result = await saveMemoryTool.execute(args);
    
    console.log('📊 Memory save result:', result);
    
    // Should succeed
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('saved', true);
    
    if (result.data.memoryPath) {
      expect(result.data.memoryPath).toContain('GEMINI.md');
      console.log('💾 Memory saved to:', result.data.memoryPath);
    }
    
    console.log('✅ Memory saved successfully');
  });

  it('should handle empty fact gracefully', async () => {
    const args = { fact: '' };
    
    console.log('🔧 Testing empty fact');
    
    const result = await saveMemoryTool.execute(args);
    
    console.log('📊 Empty fact result:', result);
    
    // Should either succeed with warning or fail appropriately
    if (result.success) {
      console.log('✅ Tool handled empty fact gracefully');
    } else {
      expect(result.error).toBeDefined();
      console.log('✅ Tool appropriately rejected empty fact');
    }
  });

  it('should save multiple different facts', async () => {
    const facts = [
      'User works on Node.js projects',
      'User prefers clean code principles',
      'User is testing the Legion framework'
    ];
    
    console.log('🔧 Testing multiple memory saves');
    
    for (const fact of facts) {
      const result = await saveMemoryTool.execute({ fact });
      expect(result.success).toBe(true);
      console.log(`💾 Saved: ${fact.substring(0, 30)}...`);
    }
    
    console.log('✅ Multiple facts saved successfully');
  });
});