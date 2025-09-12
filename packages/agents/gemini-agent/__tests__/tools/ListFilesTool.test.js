/**
 * Direct List Files Tool Test
 * Tests the actual list_files tool with real directories
 */

import { GeminiToolsModule } from '@legion/gemini-tools';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('List Files Tool Direct Test', () => {
  let listFilesTool;
  let testDir;

  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    const toolsModule = await GeminiToolsModule.create(resourceManager);
    
    // Find list_files tool
    const tools = toolsModule.getTools();
    const toolEntries = Object.entries(tools);
    listFilesTool = toolEntries.find(([key, tool]) => 
      (tool.name === 'list_files' || tool.toolName === 'list_files')
    )[1];
    
    if (!listFilesTool) {
      throw new Error('list_files tool not found');
    }
    
    // Create test directory with known files
    testDir = path.join(__dirname, '..', 'tmp', 'list-test');
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, 'subdir'));
    await fs.writeFile(path.join(testDir, 'file1.js'), 'console.log("test1");');
    await fs.writeFile(path.join(testDir, 'file2.txt'), 'test content');
    await fs.writeFile(path.join(testDir, 'subdir', 'nested.md'), '# Nested file');
    
    console.log('✅ Found list_files tool and created test directory');
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should SUCCESS list files in test directory', async () => {
    const args = { path: testDir };
    
    console.log('🔧 Testing list_files tool directly');
    console.log('📋 Args:', args);
    
    const result = await listFilesTool.execute(args);
    
    console.log('📊 List result:', result);
    
    // Should succeed
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('path');
    expect(result.data).toHaveProperty('entries');
    expect(Array.isArray(result.data.entries)).toBe(true);
    
    // Should find our test files
    const entryNames = result.data.entries.map(e => e.name);
    expect(entryNames).toContain('file1.js');
    expect(entryNames).toContain('file2.txt');
    expect(entryNames).toContain('subdir');
    
    // Verify entry structure
    const jsFile = result.data.entries.find(e => e.name === 'file1.js');
    expect(jsFile.type).toBe('file');
    expect(jsFile.size).toBeGreaterThan(0);
    expect(jsFile.path).toContain('file1.js');
    
    console.log('✅ Directory listing successful');
    console.log('📁 Found entries:', entryNames);
    console.log('📄 JS file size:', jsFile.size);
  });

  it('should FAIL for non-existent directory', async () => {
    const args = { path: '/nonexistent/directory' };
    
    console.log('🔧 Testing non-existent directory');
    
    const result = await listFilesTool.execute(args);
    
    console.log('📊 Non-existent directory result:', result);
    
    // Should fail
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    
    console.log('✅ Correctly failed for non-existent directory');
  });

  it('should list current gemini-agent directory', async () => {
    // Test with actual project directory
    const projectDir = path.join(__dirname, '..', '..');
    const args = { path: projectDir };
    
    console.log('🔧 Testing real project directory');
    
    const result = await listFilesTool.execute(args);
    
    expect(result.success).toBe(true);
    
    const entryNames = result.data.entries.map(e => e.name);
    expect(entryNames).toContain('package.json');
    expect(entryNames).toContain('src');
    expect(entryNames).toContain('__tests__');
    
    console.log('✅ Project directory listing successful');
    console.log('📁 Project entries:', entryNames);
  });
});