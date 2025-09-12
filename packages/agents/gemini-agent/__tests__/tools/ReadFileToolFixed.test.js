/**
 * Fixed Read File Tool Test
 * Tests both failure (non-existent file) and success (real file) cases
 */

import { GeminiToolsModule } from '@legion/gemini-tools';
import { ResourceManager } from '@legion/resource-manager';

describe('Read File Tool - Real File Tests', () => {
  let readFileTool;

  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    const toolsModule = await GeminiToolsModule.create(resourceManager);
    
    const tools = toolsModule.getTools();
    const toolEntries = Object.entries(tools);
    readFileTool = toolEntries.find(([key, tool]) => 
      (tool.name === 'read_file' || tool.toolName === 'read_file')
    )[1];
    
    console.log('✅ Found read_file tool');
  });

  it('should FAIL to read non-existent file', async () => {
    const args = { absolute_path: '/nonexistent/fake.txt' };
    
    console.log('🔧 Testing non-existent file');
    const result = await readFileTool.execute(args);
    
    console.log('📊 Non-existent file result:', result);
    
    // Should fail
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    
    console.log('✅ Correctly failed for non-existent file');
  });

  it('should SUCCESS read actual package.json file', async () => {
    // Use the REAL package.json file that definitely exists
    const packageJsonPath = '/Users/williampearson/Documents/p/agents/Legion/packages/agents/gemini-agent/package.json';
    const args = { absolute_path: packageJsonPath };
    
    console.log('🔧 Testing real package.json file');
    const result = await readFileTool.execute(args);
    
    console.log('📊 Real file result:', result);
    
    // Should succeed
    expect(result.success).toBe(true);
    expect(result.data.content).toContain('@legion/gemini-agent');
    expect(result.data.content).toContain('src/server.js');
    expect(result.data.path).toBe(packageJsonPath);
    expect(result.data.lines).toBeGreaterThan(5);
    
    console.log('✅ Successfully read real file');
    console.log('📄 Content preview:', result.data.content.substring(0, 100));
    console.log('📏 Lines:', result.data.lines);
  });
});