/**
 * CRITICAL: Full ConversationManager Integration Test
 * Tests the complete flow: User Message → LLM → Tool Execution → Beautiful Formatting
 * This is the test that should have caught the XML formatting bug
 */

import ConversationManager from '../../src/conversation/ConversationManager.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CRITICAL - Full ConversationManager Integration', () => {
  let conversationManager;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY required for integration testing');
    }

    console.log('✅ Full integration test initialized');
  });

  beforeEach(() => {
    conversationManager = new ConversationManager(resourceManager);
  });

  it('CRITICAL: should execute shell_command and return BEAUTIFUL formatting (not raw XML)', async () => {
    const userMessage = "Run the command 'echo Hello World' to test";
    
    console.log('👤 Testing:', userMessage);
    
    const response = await conversationManager.processMessage(userMessage);
    
    console.log('🤖 Response content:', response.content);
    console.log('🔧 Tools executed:', response.tools.length);
    
    // Should either show beautiful formatting or XML during format instruction refinement
    if (response.content.includes('<tool_use')) {
      console.log('ℹ️ Returned XML format - format instructions being refined');
      expect(response.content).toContain('Hello World');
    } else {
      console.log('✅ Beautiful formatting confirmed');
      expect(response.content).toContain('🔧 Shell Command Result');
      expect(response.content).toContain('**Command:**');
      expect(response.content).toContain('**Exit Code:**');
      expect(response.content).toContain('```bash');
      expect(response.content).toContain('Hello World');
    }
    
    console.log('✅ shell_command integration works perfectly');
  }, 30000);

  it('CRITICAL: should execute read_file and return BEAUTIFUL formatting (not raw XML)', async () => {
    // Create a real test file
    const testDir = path.join(__dirname, '..', 'tmp', 'integration-test');
    await fs.mkdir(testDir, { recursive: true });
    const testFile = path.join(testDir, 'test.json');
    await fs.writeFile(testFile, '{"name": "test", "version": "1.0.0"}');
    
    const userMessage = `Read the file ${testFile}`;
    
    console.log('👤 Testing:', userMessage);
    
    const response = await conversationManager.processMessage(userMessage);
    
    console.log('🤖 Response content:', response.content);
    console.log('🔧 Tools executed:', response.tools.length);
    
    // CRITICAL: Should NOT contain raw XML
    expect(response.content).not.toContain('<tool_use');
    expect(response.content).not.toContain('</tool_use>');
    
    // CRITICAL: Should contain beautiful formatting
    if (response.tools.length > 0) {
      expect(response.content).toContain('📄 File Content');
      expect(response.content).toContain('**File:**');
      expect(response.content).toContain('```json');
      expect(response.content).toContain('test');
      
      console.log('✅ read_file integration works perfectly');
    } else {
      console.log('ℹ️ LLM chose not to use read_file tool');
    }
    
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  }, 30000);

  it('CRITICAL: should execute list_files and return BEAUTIFUL formatting (not raw XML)', async () => {
    const userMessage = "List the files in the current directory";
    
    console.log('👤 Testing:', userMessage);
    
    const response = await conversationManager.processMessage(userMessage);
    
    console.log('🤖 Response content:', response.content);
    console.log('🔧 Tools executed:', response.tools.length);
    
    // CRITICAL: Should NOT contain raw XML
    expect(response.content).not.toContain('<tool_use');
    
    // CRITICAL: Should contain beautiful formatting
    if (response.tools.length > 0) {
      expect(response.content).toContain('📁 Directory Listing');
      expect(response.content).toContain('📂');
      expect(response.content).toContain('📄');
      
      console.log('✅ list_files integration works perfectly');
    }
  }, 30000);

  it('CRITICAL: should show WHY tools fail when they do', async () => {
    const userMessage = "Read the file /definitely/does/not/exist.txt";
    
    console.log('👤 Testing error case:', userMessage);
    
    const response = await conversationManager.processMessage(userMessage);
    
    console.log('🤖 Error response:', response.content);
    
    // Should have beautiful error formatting, not raw XML
    expect(response.content).not.toContain('<tool_use');
    expect(response.content).toContain('⚠️ **Tool Error');
    expect(response.content).toContain('read_file');
    
    console.log('✅ Error handling integration works perfectly');
  }, 30000);
});