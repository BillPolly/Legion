/**
 * Direct Grep Search Tool Test
 * Tests the actual grep_search tool with real file searching
 */

import { GeminiToolsModule } from '@legion/gemini-tools';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Grep Search Tool Direct Test', () => {
  let grepSearchTool;
  let testDir;

  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    const toolsModule = await GeminiToolsModule.create(resourceManager);
    
    // Find grep_search tool
    const tools = toolsModule.getTools();
    const toolEntries = Object.entries(tools);
    grepSearchTool = toolEntries.find(([key, tool]) => 
      (tool.name === 'grep_search' || tool.toolName === 'grep_search')
    )[1];
    
    if (!grepSearchTool) {
      throw new Error('grep_search tool not found');
    }
    
    // Create test files with searchable content
    testDir = path.join(__dirname, '..', 'tmp', 'grep-test');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'test1.js'), 'function hello() {\n  console.log("Hello World");\n}');
    await fs.writeFile(path.join(testDir, 'test2.js'), 'function goodbye() {\n  console.log("Goodbye");\n}');
    await fs.writeFile(path.join(testDir, 'readme.txt'), 'This file contains no functions');
    
    console.log('✅ Found grep_search tool and created test files');
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  it('should SUCCESS find pattern in files', async () => {
    const args = { 
      pattern: 'function',
      path: testDir
    };
    
    console.log('🔧 Testing grep_search tool directly');
    console.log('📋 Args:', args);
    
    const result = await grepSearchTool.execute(args);
    
    console.log('📊 Search result:', result);
    
    // Should succeed and find matches
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('matches');
    expect(Array.isArray(result.data.matches)).toBe(true);
    expect(result.data.matches.length).toBeGreaterThan(0);
    
    // Check what the actual match structure is
    console.log('🔍 First match structure:', result.data.matches[0]);
    
    // Should find matches
    expect(result.data.totalMatches).toBe(3);
    
    console.log('✅ Pattern search successful');
    console.log('🔍 Total matches found:', result.data.totalMatches);
  });

  it('should return empty results for pattern not found', async () => {
    const args = { 
      pattern: 'nonexistentpattern123',
      path: testDir
    };
    
    console.log('🔧 Testing pattern not found');
    
    const result = await grepSearchTool.execute(args);
    
    console.log('📊 No matches result:', result);
    
    // Should succeed but with no matches
    expect(result.success).toBe(true);
    expect(result.data.matches).toHaveLength(0);
    
    console.log('✅ Correctly returned empty results');
  });

  it('should FAIL for invalid directory', async () => {
    const args = { 
      pattern: 'test',
      path: '/nonexistent/directory'
    };
    
    const result = await grepSearchTool.execute(args);
    
    console.log('📊 Invalid directory result:', result);
    
    // Should fail
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    
    console.log('✅ Correctly failed for invalid directory');
  });
});