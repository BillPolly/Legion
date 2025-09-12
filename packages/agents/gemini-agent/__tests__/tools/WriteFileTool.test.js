/**
 * Direct Write File Tool Test
 * Tests the actual write_file tool with real file operations
 */

import { GeminiToolsModule } from '@legion/gemini-tools';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Write File Tool Direct Test', () => {
  let writeFileTool;
  let testDir;
  let testFile;

  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    const toolsModule = await GeminiToolsModule.create(resourceManager);
    
    // Find write_file tool
    const tools = toolsModule.getTools();
    const toolEntries = Object.entries(tools);
    writeFileTool = toolEntries.find(([key, tool]) => 
      (tool.name === 'write_file' || tool.toolName === 'write_file')
    )[1];
    
    if (!writeFileTool) {
      throw new Error('write_file tool not found');
    }
    
    // Set up test directory
    testDir = path.join(__dirname, '..', 'tmp', 'write-test');
    await fs.mkdir(testDir, { recursive: true });
    testFile = path.join(testDir, 'test-output.txt');
    
    console.log('✅ Found write_file tool');
    console.log('📁 Test directory:', testDir);
  });

  afterAll(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should SUCCESS write new file with content', async () => {
    const testContent = 'Hello from write_file tool!\nThis is line 2\nAnd this is line 3';
    const args = { 
      absolute_path: testFile,
      content: testContent
    };
    
    console.log('🔧 Testing write_file tool directly');
    console.log('📋 Args:', args);
    
    const result = await writeFileTool.execute(args);
    
    console.log('📊 Write result:', result);
    
    // Should succeed
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('path');
    expect(result.data.path).toBe(testFile);
    
    // Verify file actually exists and has correct content
    const writtenContent = await fs.readFile(testFile, 'utf-8');
    expect(writtenContent).toBe(testContent);
    
    console.log('✅ File written successfully');
    console.log('📄 Written content length:', writtenContent.length);
    console.log('📝 First line:', writtenContent.split('\n')[0]);
  });

  it('should FAIL to write to invalid directory', async () => {
    const invalidPath = '/root/invalid/cannot-write-here.txt';
    const args = { 
      absolute_path: invalidPath,
      content: 'This should fail'
    };
    
    console.log('🔧 Testing write to invalid directory');
    
    const result = await writeFileTool.execute(args);
    
    console.log('📊 Invalid write result:', result);
    
    // Should fail
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    
    console.log('✅ Correctly failed for invalid path');
  });

  it('should overwrite existing file', async () => {
    const newContent = 'This is NEW content that replaces the old content';
    const args = { 
      absolute_path: testFile,
      content: newContent
    };
    
    console.log('🔧 Testing file overwrite');
    
    const result = await writeFileTool.execute(args);
    
    expect(result.success).toBe(true);
    
    // Verify content was overwritten
    const overwrittenContent = await fs.readFile(testFile, 'utf-8');
    expect(overwrittenContent).toBe(newContent);
    expect(overwrittenContent).not.toContain('Hello from write_file');
    
    console.log('✅ File overwritten successfully');
    console.log('📝 New content:', overwrittenContent);
  });
});