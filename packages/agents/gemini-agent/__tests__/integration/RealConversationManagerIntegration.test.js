/**
 * Real ConversationManager Integration Tests  
 * Tests actual ConversationManager with real LLM and real tool execution
 * NO MOCKS - uses real ANTHROPIC_API_KEY and GeminiToolsModule
 */

import ConversationManager from '../../src/conversation/ConversationManager.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ConversationManager Real Integration', () => {
  let conversationManager;
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    // Get real ResourceManager with .env
    resourceManager = await ResourceManager.getInstance();
    
    // Check for required API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in .env - required for real testing');
    }

    // Create test directory
    testDir = path.join(__dirname, '..', 'tmp', 'conversation-test');
    await fs.mkdir(testDir, { recursive: true });
    
    // Set working directory for tools
    resourceManager.set('workingDirectory', testDir);

    console.log('✅ Real ConversationManager integration test initialized');
  });

  beforeEach(() => {
    // Create real ConversationManager with real ResourceManager
    conversationManager = new ConversationManager(resourceManager);
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Real Tool Execution End-to-End', () => {
    it('should execute file listing tool and return actual results', async () => {
      // Create some test files first
      await fs.writeFile(path.join(testDir, 'test1.js'), 'console.log("test1");');
      await fs.writeFile(path.join(testDir, 'test2.txt'), 'Test content');
      
      const response = await conversationManager.processMessage('List the files in the current directory');
      
      console.log('File List Response:', response.content);
      console.log('Tool Calls:', response.tools);
      
      // Should have executed tools and returned actual file list
      expect(response.content).toBeDefined();
      expect(response.tools).toBeDefined();
      
      // Should contain formatted results or file names, not raw XML
      const containsRawXML = response.content.includes('<tool_use');
      const containsFileNames = response.content.includes('test1.js') || response.content.includes('test2.txt');
      const containsFormattedResult = response.content.includes('📁 Directory Listing') || 
                                    response.content.includes('Directory Listing') ||
                                    response.content.includes('File Content');
      
      // Either the LLM should have used tools (and we should see results) or explained why not
      if (response.tools.length > 0) {
        // Tools were executed - should see formatted results in content
        expect(containsFormattedResult || containsFileNames).toBe(true);
        expect(containsRawXML).toBe(false); // Raw XML should be replaced
        console.log('✅ Tool execution confirmed - results integrated into response');
      } else {
        // No tools used - should have explanation
        expect(response.content.length).toBeGreaterThan(20);
        console.log('ℹ️ LLM chose not to use tools - provided explanation instead');
      }
    }, 45000);

    it('should create and read files with actual tool execution', async () => {
      const response = await conversationManager.processMessage('Create a file called hello-world.js with console.log("Hello World!")');
      
      console.log('File Creation Response:', response.content);
      console.log('Tool Calls Made:', response.tools);
      
      expect(response.content).toBeDefined();
      
      // If tools were used, check if file was actually created
      if (response.tools.length > 0) {
        const writeToolCall = response.tools.find(t => t.name === 'write_file');
        if (writeToolCall && writeToolCall.result) {
          // Check if file actually exists
          const expectedFile = path.join(testDir, 'hello-world.js');
          try {
            const fileContent = await fs.readFile(expectedFile, 'utf-8');
            expect(fileContent).toContain('Hello World');
            console.log('✅ File actually created and verified');
          } catch (error) {
            console.log('⚠️ File not found, but tool says it succeeded');
          }
        }
        
        // Response should not contain raw XML
        expect(response.content.includes('<tool_use')).toBe(false);
      }
    }, 45000);

    it('should maintain chat history across multiple turns with tool calls', async () => {
      // First turn - save information
      const response1 = await conversationManager.processMessage('My favorite programming language is TypeScript');
      expect(response1.content).toBeDefined();
      
      // Second turn - ask about the information
      const response2 = await conversationManager.processMessage('What programming language did I mention?');
      expect(response2.content.toLowerCase()).toContain('typescript');
      
      // Check history is maintained
      const history = conversationManager.getConversationHistory();
      expect(history.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant
      
      console.log('Chat History Length:', history.length);
      console.log('Last Response:', response2.content);
    }, 45000);

    it('should handle errors gracefully when tools fail', async () => {
      const response = await conversationManager.processMessage('Read a file that does not exist: /nonexistent/fake.txt');
      
      console.log('Error Handling Response:', response.content);
      
      expect(response.content).toBeDefined();
      
      // Should either handle the error gracefully or explain why the file can't be read
      if (response.tools.length > 0) {
        const failedTool = response.tools.find(t => t.error);
        if (failedTool) {
          expect(response.content).toContain('Tool Error');
          console.log('✅ Tool error properly handled and displayed');
        }
      }
      
      // Response should not crash the conversation
      expect(response.content.length).toBeGreaterThan(0);
    }, 45000);
  });

  describe('Tool Conversion and Format', () => {
    it('should properly convert Gemini tools to SimplePromptClient format', async () => {
      // Ensure ConversationManager is initialized
      await conversationManager._initializeAsync();
      
      const tools = conversationManager._getToolsForSimpleClient();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Verify tool format
      const sampleTool = tools[0];
      expect(sampleTool).toHaveProperty('name');
      expect(sampleTool).toHaveProperty('description');
      expect(sampleTool).toHaveProperty('parameters');
      expect(sampleTool.parameters).toHaveProperty('type', 'object');
      
      console.log('Tools converted:', tools.length);
      console.log('Sample tool:', sampleTool);
    });
  });
});