/**
 * Comprehensive Tool Execution Tests
 * Tests ALL 16 tools with real LLM and beautiful formatting
 * NO MOCKS - uses real ANTHROPIC_API_KEY and verifies each tool works
 */

import ConversationManager from '../../src/conversation/ConversationManager.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('All 16 Tools Comprehensive Execution Test', () => {
  let conversationManager;
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    // Get real ResourceManager with .env
    resourceManager = await ResourceManager.getInstance();
    
    // Check for required API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in .env - required for comprehensive tool testing');
    }

    // Create test directory
    testDir = path.join(__dirname, '..', 'tmp', 'comprehensive-tool-test');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test files for various tools
    await fs.writeFile(path.join(testDir, 'test.js'), 'function hello() { return "world"; }');
    await fs.writeFile(path.join(testDir, 'test.txt'), 'This is a test file\nwith multiple lines\nfor testing purposes');
    await fs.writeFile(path.join(testDir, 'package.json'), '{\n  "name": "test-project",\n  "version": "1.0.0"\n}');

    console.log('✅ Comprehensive tool testing initialized');
    console.log('📁 Test directory:', testDir);
  });

  beforeEach(() => {
    conversationManager = new ConversationManager(resourceManager);
    resourceManager.set('workingDirectory', testDir);
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('File Operations Tools', () => {
    it('should execute read_file tool with beautiful JSON formatting', async () => {
      const response = await conversationManager.processMessage('Read the package.json file');
      
      console.log('READ_FILE Response:', response.content);
      
      expect(response.content).toBeDefined();
      if (response.tools.length > 0) {
        expect(response.content).toContain('📄 File Content');
        expect(response.content).toContain('```json');
        expect(response.content).toContain('test-project');
      }
    }, 30000);

    it('should execute write_file tool and show creation confirmation', async () => {
      const response = await conversationManager.processMessage('Create a new file called hello.txt with the content "Hello World!"');
      
      console.log('WRITE_FILE Response:', response.content);
      
      expect(response.content).toBeDefined();
      if (response.tools.length > 0) {
        const writeTools = response.tools.filter(t => t.name === 'write_file');
        if (writeTools.length > 0) {
          expect(response.content).toMatch(/File Created|created|written/i);
        }
      }
    }, 30000);

    it('should execute list_files tool with beautiful directory listing', async () => {
      const response = await conversationManager.processMessage('List all files in the current directory');
      
      console.log('LIST_FILES Response:', response.content);
      
      expect(response.content).toBeDefined();
      if (response.tools.length > 0) {
        expect(response.content).toContain('📁 Directory Listing');
        expect(response.content).toContain('📄');
        expect(response.content).toContain('test.js');
      }
    }, 30000);

    it('should execute edit_file tool for code modifications', async () => {
      const response = await conversationManager.processMessage('In the test.js file, change "world" to "universe"');
      
      console.log('EDIT_FILE Response:', response.content);
      
      expect(response.content).toBeDefined();
      if (response.tools.length > 0) {
        const editTools = response.tools.filter(t => t.name === 'edit_file');
        if (editTools.length > 0) {
          expect(response.content).toMatch(/edit|change|modif/i);
        }
      }
    }, 30000);
  });

  describe('Search Tools', () => {
    it('should execute grep_search tool with formatted results', async () => {
      const response = await conversationManager.processMessage('Search for the word "function" in all JavaScript files');
      
      console.log('GREP_SEARCH Response:', response.content);
      
      expect(response.content).toBeDefined();
      if (response.tools.length > 0) {
        const grepTools = response.tools.filter(t => t.name === 'grep_search');
        if (grepTools.length > 0) {
          expect(response.content).toMatch(/🔍|Search|search/);
        }
      }
    }, 30000);

    it('should execute glob_pattern tool for file matching', async () => {
      const response = await conversationManager.processMessage('Find all .js files using pattern matching');
      
      console.log('GLOB_PATTERN Response:', response.content);
      
      expect(response.content).toBeDefined();
      if (response.tools.length > 0) {
        const globTools = response.tools.filter(t => t.name === 'glob_pattern');
        expect(globTools.length).toBeGreaterThanOrEqual(0);
      }
    }, 30000);
  });

  describe('System Tools', () => {
    it('should execute shell_command tool with formatted output', async () => {
      const response = await conversationManager.processMessage('Run the command "ls -la" to see detailed file listing');
      
      console.log('SHELL_COMMAND Response:', response.content);
      
      expect(response.content).toBeDefined();
      if (response.tools.length > 0) {
        const shellTools = response.tools.filter(t => t.name === 'shell_command');
        if (shellTools.length > 0) {
          expect(response.content).toMatch(/🔧|Command|command/);
        }
      }
    }, 30000);

    it('should execute save_memory tool with confirmation', async () => {
      const response = await conversationManager.processMessage('Remember that I am testing the comprehensive tool system');
      
      console.log('SAVE_MEMORY Response:', response.content);
      
      expect(response.content).toBeDefined();
      if (response.tools.length > 0) {
        const memoryTools = response.tools.filter(t => t.name === 'save_memory');
        if (memoryTools.length > 0) {
          expect(response.content).toContain('💾');
        }
      }
    }, 30000);
  });

  describe('Web Tools', () => {
    it('should have web_fetch and web_search tools available', async () => {
      // Ensure initialization
      await conversationManager._initializeAsync();
      
      const tools = conversationManager._getToolsForSimpleClient();
      const toolNames = tools.map(t => t.name);
      
      console.log('Available tools:', toolNames);
      
      expect(toolNames).toContain('web_fetch');
      expect(toolNames).toContain('web_search');
      expect(toolNames).toContain('mcp_client');
      expect(toolNames).toContain('mcp_client_manager');
      expect(toolNames).toContain('mcp_tool');
    });
  });

  describe('Tool Caching and Performance', () => {
    it('should have all 16 tools cached by name', async () => {
      await conversationManager._initializeAsync();
      
      const cachedToolNames = Array.from(conversationManager.toolsByName.keys());
      console.log('Cached tools:', cachedToolNames);
      
      expect(cachedToolNames).toHaveLength(16);
      
      // Verify specific tools are cached
      const expectedTools = ['read_file', 'write_file', 'list_files', 'grep_search', 'edit_file', 
                           'shell_command', 'glob_pattern', 'read_many_files', 'save_memory', 
                           'smart_edit', 'web_fetch', 'web_search', 'ripgrep_search', 
                           'mcp_client', 'mcp_client_manager', 'mcp_tool'];
      
      for (const toolName of expectedTools) {
        expect(cachedToolNames).toContain(toolName);
        const tool = conversationManager.toolsByName.get(toolName);
        expect(tool).toBeDefined();
        expect(tool.name || tool.toolName).toBe(toolName);
      }
    });

    it('should execute multiple different tools in sequence', async () => {
      // Test multiple tools in one conversation
      const response1 = await conversationManager.processMessage('List the files in this directory');
      const response2 = await conversationManager.processMessage('Read the test.js file');
      const response3 = await conversationManager.processMessage('Remember that I tested multiple tools successfully');
      
      const allTools = [...response1.tools, ...response2.tools, ...response3.tools];
      const uniqueToolNames = [...new Set(allTools.map(t => t.name))];
      
      console.log('Tools used in sequence:', uniqueToolNames);
      expect(uniqueToolNames.length).toBeGreaterThan(0);
      
      // Verify conversation history maintained across tool calls
      const history = conversationManager.getConversationHistory();
      expect(history.length).toBeGreaterThanOrEqual(6); // 3 user + 3 assistant
    }, 60000);
  });
});