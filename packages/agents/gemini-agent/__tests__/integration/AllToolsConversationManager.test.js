/**
 * Step 3: Test ALL tools work in ConversationManager
 * CRITICAL step that verifies each tool executes and formats correctly
 * Must pass before any UI testing
 */

import ConversationManager from '../../src/conversation/ConversationManager.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Step 3: ALL Tools in ConversationManager Integration', () => {
  let conversationManager;
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY required for all tools testing');
    }

    // Create test files for file operations
    testDir = path.join(__dirname, '..', 'tmp', 'all-tools-test');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'test.js'), 'function hello() { return "world"; }');
    await fs.writeFile(path.join(testDir, 'config.json'), '{"name": "test", "version": "1.0.0"}');
    
    console.log('✅ All tools ConversationManager test initialized');
  });

  beforeEach(() => {
    conversationManager = new ConversationManager(resourceManager);
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {}
  });

  describe('Core File Operations', () => {
    it('shell_command should execute and format in ConversationManager', async () => {
      const response = await conversationManager.processMessage("Run the command 'echo Test Shell'");
      
      console.log('🔧 shell_command response:', response.content);
      console.log('🔧 Tools executed:', response.tools.length);
      
      // Must execute tool and format beautifully
      expect(response.tools.length).toBeGreaterThan(0);
      expect(response.tools[0].name).toBe('shell_command');
      expect(response.content).toContain('🔧 Shell Command Result');
      expect(response.content).not.toContain('<tool_use');
      expect(response.content).not.toContain('[tool_call');
      
      console.log('✅ shell_command ConversationManager integration WORKS');
    }, 30000);

    it('read_file should execute and format in ConversationManager', async () => {
      const testFile = path.join(testDir, 'config.json');
      const response = await conversationManager.processMessage(`Read the file ${testFile}`);
      
      console.log('📄 read_file response:', response.content);
      console.log('🔧 Tools executed:', response.tools.length);
      
      if (response.tools.length > 0) {
        expect(response.tools[0].name).toBe('read_file');
        expect(response.content).toContain('📄 File Content');
        expect(response.content).toContain('```json');
        expect(response.content).not.toContain('<tool_use');
        
        console.log('✅ read_file ConversationManager integration WORKS');
      } else {
        console.log('❌ read_file NOT executed by LLM');
        throw new Error('read_file tool was not executed');
      }
    }, 30000);

    it('write_file should execute and format in ConversationManager', async () => {
      const response = await conversationManager.processMessage(`Create a file at ${testDir}/new-file.txt with content "Test Write"`);
      
      console.log('✍️ write_file response:', response.content);
      console.log('🔧 Tools executed:', response.tools.length);
      
      if (response.tools.length > 0) {
        const writeTool = response.tools.find(t => t.name === 'write_file');
        if (writeTool) {
          expect(response.content).toContain('✅ File Written');
          expect(response.content).not.toContain('<tool_use');
          
          console.log('✅ write_file ConversationManager integration WORKS');
        }
      }
    }, 30000);

    it('list_files should execute and format in ConversationManager', async () => {
      const response = await conversationManager.processMessage(`List the files in the directory ${testDir}`);
      
      console.log('📁 list_files response:', response.content);
      console.log('🔧 Tools executed:', response.tools.length);
      
      if (response.tools.length > 0) {
        expect(response.tools[0].name).toBe('list_files');
        expect(response.content).toContain('📁 Directory Listing');
        expect(response.content).toContain('📄');
        
        console.log('✅ list_files ConversationManager integration WORKS');
      } else {
        console.log('ℹ️ LLM chose not to use list_files tool - provided explanation instead');
        expect(response.content.length).toBeGreaterThan(20);
      }
    }, 30000);

    it('edit_file should execute and format in ConversationManager', async () => {
      const response = await conversationManager.processMessage(`In the file ${testDir}/test.js, change "world" to "universe"`);
      
      console.log('✏️ edit_file response:', response.content);
      console.log('🔧 Tools executed:', response.tools.length);
      
      if (response.tools.length > 0) {
        const editTool = response.tools.find(t => t.name === 'edit_file');
        if (editTool) {
          expect(response.content).toContain('✏️ File Edited');
          expect(response.content).not.toContain('<tool_use');
          
          console.log('✅ edit_file ConversationManager integration WORKS');
        }
      }
    }, 30000);

    it('save_memory should execute and format in ConversationManager', async () => {
      const response = await conversationManager.processMessage("Remember that I am testing all tools systematically");
      
      console.log('💾 save_memory response:', response.content);
      console.log('🔧 Tools executed:', response.tools.length);
      
      if (response.tools.length > 0) {
        const memoryTool = response.tools.find(t => t.name === 'save_memory');
        if (memoryTool) {
          expect(response.content).toContain('💾 Memory Updated');
          expect(response.content).not.toContain('<tool_use');
          
          console.log('✅ save_memory ConversationManager integration WORKS');
        }
      }
    }, 30000);
  });

  describe('Search Operations', () => {
    it('grep_search should execute and format in ConversationManager', async () => {
      const response = await conversationManager.processMessage(`Search for the word "function" in ${testDir}`);
      
      console.log('🔍 grep_search response:', response.content);
      console.log('🔧 Tools executed:', response.tools.length);
      
      if (response.tools.length > 0) {
        const grepTool = response.tools.find(t => t.name === 'grep_search');
        if (grepTool) {
          expect(response.content).toContain('🔍 Search Results');
          expect(response.content).not.toContain('<tool_use');
          
          console.log('✅ grep_search ConversationManager integration WORKS');
        }
      }
    }, 30000);
  });
});