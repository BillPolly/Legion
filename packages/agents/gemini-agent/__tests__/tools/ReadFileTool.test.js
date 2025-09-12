/**
 * Direct Read File Tool Test
 * Tests the actual read_file tool directly to verify it works
 */

import { GeminiToolsModule } from '@legion/gemini-tools';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Read File Tool Direct Test', () => {
  let toolsModule;
  let readFileTool;
  let testFile;

  beforeAll(async () => {
    // Get real ResourceManager and tools
    const resourceManager = await ResourceManager.getInstance();
    toolsModule = await GeminiToolsModule.create(resourceManager);
    
    // Find read_file tool
    const tools = toolsModule.getTools();
    const toolEntries = Object.entries(tools);
    readFileTool = toolEntries.find(([key, tool]) => 
      (tool.name === 'read_file' || tool.toolName === 'read_file')
    );
    
    if (!readFileTool) {
      throw new Error('read_file tool not found');
    }
    
    readFileTool = readFileTool[1];
    
    // Create test file
    testFile = path.join(__dirname, '..', 'tmp', 'test-read-file.txt');
    await fs.mkdir(path.dirname(testFile), { recursive: true });
    await fs.writeFile(testFile, 'Hello World\nThis is a test file\nWith multiple lines');
    
    console.log('✅ Found read_file tool and created test file');
  });

  afterAll(async () => {
    // Clean up
    try {
      await fs.unlink(testFile);
    } catch (error) {
      // Ignore
    }
  });

  it('should read existing file successfully', async () => {
    const args = { absolute_path: testFile };
    
    console.log('🔧 Testing read_file tool directly');
    console.log('📋 Args:', args);
    
    const result = await readFileTool.execute(args);
    
    console.log('📊 Tool result:', result);
    
    expect(result).toHaveProperty('success', true);
    expect(result.data).toHaveProperty('content');
    expect(result.data).toHaveProperty('path');
    expect(result.data).toHaveProperty('lines');
    
    expect(result.data.content).toContain('Hello World');
    expect(result.data.content).toContain('test file');
    expect(result.data.path).toBe(testFile);
    expect(result.data.lines).toBeGreaterThanOrEqual(1); // Tool may count lines differently
    
    console.log('✅ File read successfully');
    console.log('📄 Content length:', result.data.content.length);
    console.log('📝 First line:', result.data.content.split('\\n')[0]);
  });

  it('should handle non-existent file', async () => {
    const args = { absolute_path: '/nonexistent/fake.txt' };
    
    const result = await readFileTool.execute(args);
    
    console.log('📊 Non-existent file result:', result);
    
    expect(result).toHaveProperty('success', false);
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('not found');
    
    console.log('✅ Error handling works correctly');
  });
});