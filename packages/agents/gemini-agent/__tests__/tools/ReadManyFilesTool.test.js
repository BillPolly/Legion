/**
 * Direct Read Many Files Tool Test
 */

import { GeminiToolsModule } from '@legion/gemini-tools';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Read Many Files Tool Direct Test', () => {
  let readManyFilesTool;
  let testDir;

  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    const toolsModule = await GeminiToolsModule.create(resourceManager);
    
    const tools = toolsModule.getTools();
    const toolEntries = Object.entries(tools);
    readManyFilesTool = toolEntries.find(([key, tool]) => 
      (tool.name === 'read_many_files' || tool.toolName === 'read_many_files')
    )[1];
    
    if (!readManyFilesTool) {
      throw new Error('read_many_files tool not found');
    }
    
    // Create test files
    testDir = path.join(__dirname, '..', 'tmp', 'read-many-test');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'file1.js'), 'console.log("file1");');
    await fs.writeFile(path.join(testDir, 'file2.js'), 'console.log("file2");');
    
    console.log('✅ Found read_many_files tool');
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {}
  });

  it('should read multiple files with glob pattern', async () => {
    const args = { 
      paths: [`${testDir}/*.js`]
    };
    
    console.log('🔧 Testing read_many_files tool');
    console.log('📋 Args:', args);
    
    const result = await readManyFilesTool.execute(args);
    
    console.log('📊 Read many result:', result);
    
    expect(result.success).toBe(true);
    console.log('✅ Read many files tool works');
  });
});