/**
 * Quick test to verify the outputs format fix works
 * Tests only the prompt class directly
 */

import { Prompt } from '@legion/planner';

describe('Quick Outputs Format Test', () => {

  test('should generate correct outputs format in tool descriptions', () => {
    console.log('=== TESTING PROMPT OUTPUT GENERATION ===');
    
    const prompt = new Prompt();
    
    // Mock file_write tool
    const fileWriteTool = {
      name: 'file_write',
      description: 'Write content to a file'
    };
    
    // Mock directory_create tool  
    const dirCreateTool = {
      name: 'directory_create',
      description: 'Create a directory'
    };
    
    const tools = [fileWriteTool, dirCreateTool];
    const toolsText = prompt._formatTools(tools);
    
    console.log('=== GENERATED TOOLS SECTION ===');
    console.log(toolsText);
    
    // Verify it contains the correct output field names
    expect(toolsText).toContain('filepath, bytesWritten, created'); // file_write outputs
    expect(toolsText).toContain('dirpath, created'); // directory_create outputs
    
    // Verify it does NOT contain the old wrapper format
    expect(toolsText).not.toMatch(/success.*boolean.*Whether the operation succeeded/);
    expect(toolsText).not.toMatch(/message.*string.*Result or error message/);
    expect(toolsText).not.toMatch(/data.*object.*Additional result data/);
    
    console.log('✅ Tool descriptions contain correct output field names');
    console.log('✅ Tool descriptions do NOT contain old wrapper format');
    
    // Test that tools without specific mappings have no outputs shown
    const unknownTool = {
      name: 'unknown_tool',
      description: 'Unknown tool'
    };
    
    const unknownToolsText = prompt._formatTools([unknownTool]);
    console.log('=== UNKNOWN TOOL SECTION ===');
    console.log(unknownToolsText);
    
    // Should not show any outputs for tools we don't have mappings for
    expect(unknownToolsText).not.toContain('- **Outputs**:');
    
    console.log('✅ Unknown tools correctly show no outputs');
  });
});