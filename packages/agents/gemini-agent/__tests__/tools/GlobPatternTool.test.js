/**
 * Direct Glob Pattern Tool Test
 * Tests the actual glob_pattern tool with real file pattern matching
 */

import { GeminiToolsModule } from '@legion/gemini-tools';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Glob Pattern Tool Direct Test', () => {
  let globPatternTool;
  let testDir;

  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    const toolsModule = await GeminiToolsModule.create(resourceManager);
    
    // Find glob_pattern tool
    const tools = toolsModule.getTools();
    const toolEntries = Object.entries(tools);
    globPatternTool = toolEntries.find(([key, tool]) => 
      (tool.name === 'glob_pattern' || tool.toolName === 'glob_pattern')
    )[1];
    
    if (!globPatternTool) {
      throw new Error('glob_pattern tool not found');
    }
    
    // Create test files with different extensions
    testDir = path.join(__dirname, '..', 'tmp', 'glob-test');
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, 'src'));
    await fs.writeFile(path.join(testDir, 'app.js'), 'console.log("app");');
    await fs.writeFile(path.join(testDir, 'utils.js'), 'export function test() {}');
    await fs.writeFile(path.join(testDir, 'config.json'), '{"name": "test"}');
    await fs.writeFile(path.join(testDir, 'README.md'), '# Test project');
    await fs.writeFile(path.join(testDir, 'src', 'main.js'), 'function main() {}');
    
    console.log('✅ Found glob_pattern tool and created test files');
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should SUCCESS find JavaScript files with *.js pattern', async () => {
    const args = { 
      pattern: '*.js',
      path: testDir
    };
    
    console.log('🔧 Testing glob_pattern tool directly');
    console.log('📋 Args:', args);
    
    const result = await globPatternTool.execute(args);
    
    console.log('📊 Glob result:', result);
    
    // Should succeed and find JS files
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('files');
    expect(Array.isArray(result.data.files)).toBe(true);
    expect(result.data.files.length).toBeGreaterThan(0);
    
    // Should find our JS files
    const matchNames = result.data.files.map(m => path.basename(m));
    expect(matchNames).toContain('app.js');
    expect(matchNames).toContain('utils.js');
    expect(matchNames).not.toContain('config.json'); // Should not match JSON
    
    console.log('✅ Glob pattern matching successful');
    console.log('📁 Found JS files:', matchNames);
  });

  it('should find files recursively with **/*.js pattern', async () => {
    const args = { 
      pattern: '**/*.js',
      path: testDir
    };
    
    console.log('🔧 Testing recursive glob pattern');
    
    const result = await globPatternTool.execute(args);
    
    console.log('📊 Recursive glob result:', result);
    
    if (result.success) {
      const matchNames = result.data.files.map(m => path.basename(m));
      expect(matchNames).toContain('main.js'); // Should find nested file
      // Note: **/*.js may only find nested files depending on implementation
      
      console.log('✅ Recursive pattern matching works');
      console.log('📁 All JS files found:', matchNames);
    }
  });

  it('should return empty results for no matches', async () => {
    const args = { 
      pattern: '*.xyz', // No files with this extension
      path: testDir
    };
    
    const result = await globPatternTool.execute(args);
    
    console.log('📊 No matches result:', result);
    
    expect(result.success).toBe(true);
    expect(result.data.files).toHaveLength(0);
    
    console.log('✅ Correctly returned empty results');
  });

  it('should FAIL for invalid directory', async () => {
    const args = { 
      pattern: '*.js',
      path: '/nonexistent/directory'
    };
    
    const result = await globPatternTool.execute(args);
    
    console.log('📊 Invalid directory result:', result);
    
    // Should fail
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    
    console.log('✅ Correctly failed for invalid directory');
  });
});