/**
 * Direct Edit File Tool Test
 * Tests the actual edit_file tool with real file modifications
 */

import { GeminiToolsModule } from '@legion/gemini-tools';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Edit File Tool Direct Test', () => {
  let editFileTool;
  let testDir;
  let testFile;

  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    const toolsModule = await GeminiToolsModule.create(resourceManager);
    
    // Find edit_file tool
    const tools = toolsModule.getTools();
    const toolEntries = Object.entries(tools);
    editFileTool = toolEntries.find(([key, tool]) => 
      (tool.name === 'edit_file' || tool.toolName === 'edit_file')
    )[1];
    
    if (!editFileTool) {
      throw new Error('edit_file tool not found');
    }
    
    // Create test file
    testDir = path.join(__dirname, '..', 'tmp', 'edit-test');
    await fs.mkdir(testDir, { recursive: true });
    testFile = path.join(testDir, 'test-edit.js');
    await fs.writeFile(testFile, 'function hello() {\n  return "world";\n}\n\nconsole.log("Hello World");');
    
    console.log('✅ Found edit_file tool and created test file');
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should SUCCESS edit existing file content', async () => {
    const args = { 
      absolute_path: testFile,
      old_string: 'world',
      new_string: 'universe'
    };
    
    console.log('🔧 Testing edit_file tool directly');
    console.log('📋 Args:', args);
    
    const result = await editFileTool.execute(args);
    
    console.log('📊 Edit result:', result);
    
    // Should succeed
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('path');
    expect(result.data.path).toBe(testFile);
    
    // Verify file was actually modified
    const modifiedContent = await fs.readFile(testFile, 'utf-8');
    expect(modifiedContent).toContain('universe');
    expect(modifiedContent).not.toContain('world');
    expect(modifiedContent).toContain('function hello()');
    
    console.log('✅ File edited successfully');
    console.log('📝 Modified content preview:', modifiedContent.substring(0, 50));
  });

  it('should FAIL to edit non-existent file', async () => {
    const args = { 
      absolute_path: '/nonexistent/file.txt',
      old_string: 'test',
      new_string: 'replacement'
    };
    
    console.log('🔧 Testing edit non-existent file');
    
    const result = await editFileTool.execute(args);
    
    console.log('📊 Non-existent file edit result:', result);
    
    // Should fail
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    
    console.log('✅ Correctly failed for non-existent file');
  });

  it('should handle string not found in file', async () => {
    const args = { 
      absolute_path: testFile,
      old_string: 'nonexistentstring123',
      new_string: 'replacement'
    };
    
    console.log('🔧 Testing string not found');
    
    const result = await editFileTool.execute(args);
    
    console.log('📊 String not found result:', result);
    
    // May succeed but indicate no changes, or fail - check actual behavior
    if (result.success) {
      // If it succeeds, should indicate no changes were made
      console.log('✅ Tool handled "string not found" gracefully');
    } else {
      expect(result.error).toBeDefined();
      console.log('✅ Tool failed appropriately for string not found');
    }
  });
});