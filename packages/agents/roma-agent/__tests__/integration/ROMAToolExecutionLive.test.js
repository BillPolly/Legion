/**
 * ROMA Agent Live Tool Execution Tests
 * Tests tool selection and execution with real LLM
 * NO MOCKS - uses real ANTHROPIC_API_KEY for comprehensive testing
 * 
 * Focus areas:
 * 1. SimplePromptClient tool call detection and parsing
 * 2. Tool registry integration
 * 3. Actual tool execution with real parameters
 * 4. AtomicExecutionStrategy vs RecursiveExecutionStrategy comparison
 * 5. File system operations with verification
 */

import { jest } from '@jest/globals';
import { ROMAAgent } from '../../src/ROMAAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';
import { SimplePromptClient } from '@legion/llm-client';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize singletons once at file level as global values
const resourceManager = await ResourceManager.getInstance();
const toolRegistry = await ToolRegistry.getInstance();

describe('ROMA Agent Live Tool Execution', () => {
  let romaAgent;
  let simplePromptClient;
  let testTmpDir;

  beforeAll(async () => {
    // Verify singletons are available
    expect(resourceManager).toBeDefined();
    expect(toolRegistry).toBeDefined();
    
    // Check for required API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in .env - required for live LLM testing');
    }

    // Create test tmp directory
    testTmpDir = path.join(__dirname, '..', 'tmp', 'tool-execution-tests');
    await fs.mkdir(testTmpDir, { recursive: true });

    console.log('✅ Live tool execution test initialized with Anthropic API');
    console.log('📁 Test tmp directory:', testTmpDir);
  });

  beforeEach(async () => {
    // Create new ROMA agent for each test
    romaAgent = new ROMAAgent({
      executionTimeout: 45000
    });
    
    await romaAgent.initialize();
    
    // Get SimplePromptClient for direct testing
    simplePromptClient = await resourceManager.get('simplePromptClient');
    
    // Clean test directory
    await fs.rm(testTmpDir, { recursive: true, force: true });
    await fs.mkdir(testTmpDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.rm(testTmpDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('SimplePromptClient Tool Detection', () => {
    it('should detect and return tool calls when tools are available', async () => {
      console.log('🔧 Testing SimplePromptClient tool call detection...');
      
      // Use ToolRegistry singleton that was initialized at file level
      const tools = await toolRegistry.listTools();
      
      // Find file_write tool
      const fileWriteTool = tools.find(t => t.name === 'file_write');
      expect(fileWriteTool).toBeDefined();
      console.log('✅ Found file_write tool:', fileWriteTool.name);
      
      // Convert to SimplePromptClient format
      const toolsForLLM = [{
        name: fileWriteTool.name,
        description: fileWriteTool.description || 'Write content to a file',
        inputSchema: fileWriteTool.inputSchema || {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to the file' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['filePath', 'content']
        }
      }];
      
      // Direct SimplePromptClient test
      const response = await simplePromptClient.request({
        prompt: `Write a simple hello world message to a file at ${testTmpDir}/hello.txt`,
        systemPrompt: 'You are a helpful assistant. Use tools when appropriate to complete tasks.',
        tools: toolsForLLM,
        maxTokens: 1000,
        temperature: 0.1
      });
      
      console.log('📊 SimplePromptClient response structure:');
      console.log('  content:', response.content?.substring(0, 100) + '...');
      console.log('  toolCalls:', response.toolCalls?.length || 0);
      console.log('  metadata:', response.metadata?.provider);
      
      // CRITICAL: Check what SimplePromptClient returns
      expect(response).toHaveProperty('content');
      
      // Tool calls can be in toolCalls property OR embedded in content as XML
      const hasToolCallsProperty = response.toolCalls && response.toolCalls.length > 0;
      const hasToolCallsInContent = response.content && response.content.includes('<tool_use');
      
      console.log('  hasToolCallsProperty:', hasToolCallsProperty);
      console.log('  hasToolCallsInContent:', hasToolCallsInContent);
      
      expect(hasToolCallsProperty || hasToolCallsInContent).toBe(true);
      
      if (hasToolCallsProperty) {
        console.log('✅ Tool calls in response.toolCalls property');
        expect(response.toolCalls[0]).toHaveProperty('name');
        expect(response.toolCalls[0]).toHaveProperty('args');
        expect(response.toolCalls[0].name).toBe('file_write');
      }
      
      if (hasToolCallsInContent) {
        console.log('✅ Tool calls embedded in response content');
        expect(response.content).toMatch(/<tool_use name="file_write"/);
      }
    }, 30000);

    it('should parse tool calls from XML format correctly', () => {
      console.log('🔧 Testing XML tool call parsing...');
      
      // Test the exact XML format that Anthropic might return
      const xmlResponse = `I'll write a hello world message to the file for you.

<tool_use name="file_write" parameters='{"filepath": "${testTmpDir}/test.txt", "content": "Hello World!"}'>
</tool_use>

The file has been created successfully.`;

      // Use the parsing logic from RecursiveExecutionStrategy
      const toolCalls = parseToolCallsFromXML(xmlResponse);
      
      console.log('🔧 Parsed tool calls:', toolCalls);
      
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].name).toBe('file_write');
      expect(toolCalls[0].args.filepath).toBe(`${testTmpDir}/test.txt`);
      expect(toolCalls[0].args.content).toBe('Hello World!');
      
      console.log('✅ XML parsing works correctly');
    });
  });

  describe('AtomicExecutionStrategy Tool Execution', () => {
    it('should execute tools directly with AtomicExecutionStrategy', async () => {
      console.log('🔧 Testing AtomicExecutionStrategy tool execution...');
      
      const testFile = path.join(testTmpDir, 'atomic-test.txt');
      const testContent = 'Content created by AtomicExecutionStrategy';
      
      const atomicTask = {
        id: 'atomic-file-write-test',
        description: 'Write content to file using atomic strategy',
        atomic: true,
        tool: 'file_write',
        params: {
          filePath: testFile,
          content: testContent
        }
      };
      
      const result = await romaAgent.execute(atomicTask);
      
      console.log('📊 Atomic execution result:');
      console.log('  success:', result.success);
      console.log('  strategy:', result.metadata?.strategy);
      console.log('  duration:', result.metadata?.duration + 'ms');
      
      expect(result.success).toBe(true);
      
      // Verify file was actually created
      const fileExists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      if (fileExists) {
        const actualContent = await fs.readFile(testFile, 'utf-8');
        expect(actualContent).toBe(testContent);
        console.log('✅ File created successfully with correct content');
      }
    }, 30000);

    it('should handle tool execution errors gracefully', async () => {
      console.log('🔧 Testing AtomicExecutionStrategy error handling...');
      
      const atomicTask = {
        id: 'atomic-error-test',
        description: 'Try to write to invalid path',
        atomic: true,
        tool: 'file_write',
        params: {
          filePath: '/invalid/path/that/does/not/exist.txt',
          content: 'This should fail'
        }
      };
      
      const result = await romaAgent.execute(atomicTask);
      
      console.log('📊 Error handling result:');
      console.log('  success:', result.success);
      console.log('  error message:', result.error?.substring(0, 100));
      
      // Should handle error gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 30000);
  });

  describe('RecursiveExecutionStrategy Tool Execution', () => {
    it('should decompose tasks and execute tools with RecursiveExecutionStrategy', async () => {
      console.log('🔧 Testing RecursiveExecutionStrategy with LLM decomposition...');
      
      const recursiveTask = {
        id: 'recursive-file-creation-test',
        description: `Create a simple JavaScript file at ${testTmpDir}/script.js that logs "Hello from ROMA!" to the console`,
        recursive: true
      };
      
      const result = await romaAgent.execute(recursiveTask);
      
      console.log('📊 Recursive execution result:');
      console.log('  success:', result.success);
      console.log('  strategy:', result.metadata?.strategy);
      console.log('  duration:', result.metadata?.duration + 'ms');
      
      expect(result.success).toBe(true);
      
      // Check if any files were created
      const files = await fs.readdir(testTmpDir).catch(() => []);
      console.log('📁 Files created:', files);
      
      // Look for JavaScript file
      const jsFiles = files.filter(f => f.endsWith('.js'));
      if (jsFiles.length > 0) {
        const jsFile = path.join(testTmpDir, jsFiles[0]);
        const content = await fs.readFile(jsFile, 'utf-8');
        console.log('✅ JavaScript file created with content:', content.substring(0, 100));
        expect(content).toMatch(/console\.log|Hello.*ROMA/i);
      }
      
      // Check result structure for tool execution evidence
      if (Array.isArray(result.result)) {
        const hasToolResults = result.result.some(r => 
          (typeof r === 'object' && r.toolResults) ||
          (typeof r === 'string' && !r.includes('<tool_use'))
        );
        console.log('📊 Evidence of tool execution:', hasToolResults);
      }
    }, 60000); // Longer timeout for LLM decomposition

    it('should handle complex multi-step tasks with tool execution', async () => {
      console.log('🔧 Testing complex multi-step task...');
      
      const complexTask = {
        id: 'complex-web-project-test',
        description: `Create a simple HTML file at ${testTmpDir}/index.html with basic structure and title "ROMA Test Page"`,
        recursive: true
      };
      
      const result = await romaAgent.execute(complexTask);
      
      console.log('📊 Complex task result:');
      console.log('  success:', result.success);
      console.log('  strategy:', result.metadata?.strategy);
      console.log('  duration:', result.metadata?.duration + 'ms');
      
      expect(result.success).toBe(true);
      
      // Check what files were created
      const files = await fs.readdir(testTmpDir).catch(() => []);
      console.log('📁 Files created:', files);
      
      // Verify expected files
      const expectedFiles = ['index.html'];
      const foundFiles = expectedFiles.filter(f => files.includes(f));
      
      console.log('✅ Expected files found:', foundFiles);
      console.log('📊 File creation success rate:', `${foundFiles.length}/${expectedFiles.length}`);
      
      // If files were created, verify their content
      for (const fileName of foundFiles) {
        const filePath = path.join(testTmpDir, fileName);
        const content = await fs.readFile(filePath, 'utf-8');
        console.log(`📄 ${fileName} content preview:`, content.substring(0, 100));
        
        if (fileName === 'index.html') {
          expect(content).toMatch(/<!DOCTYPE html>|<html>/i);
          expect(content).toMatch(/ROMA Test Page/i);
        }
      }
    }, 90000); // Extended timeout for complex task
  });

  describe('Tool Registry Integration', () => {
    it('should list all available tools from registry', async () => {
      console.log('🔧 Testing tool registry integration...');
      
      // Get toolRegistry from singleton directly
      const { ToolRegistry } = await import('@legion/tools-registry');
      const toolRegistry = await ToolRegistry.getInstance();
      const tools = await toolRegistry.listTools();
      
      console.log('📊 Available tools:', tools.length);
      
      expect(tools.length).toBeGreaterThan(0);
      
      // Look for essential tools
      const essentialTools = ['file_write', 'file_read', 'directory_create', 'directory_list'];
      const foundTools = essentialTools.filter(toolName => 
        tools.some(t => t.name === toolName)
      );
      
      console.log('✅ Essential tools found:', foundTools);
      expect(foundTools.length).toBeGreaterThanOrEqual(2); // At least file operations
      
      // Test getting a specific tool
      const fileWriteTool = await toolRegistry.getTool('file_write');
      expect(fileWriteTool).toBeDefined();
      expect(fileWriteTool.execute).toBeDefined();
      console.log('✅ file_write tool retrieved successfully');
    });

    it('should execute tools directly through registry', async () => {
      console.log('🔧 Testing direct tool execution through registry...');
      
      // Get toolRegistry from singleton directly
      const { ToolRegistry } = await import('@legion/tools-registry');
      const toolRegistry = await ToolRegistry.getInstance();
      const fileWriteTool = await toolRegistry.getTool('file_write');
      
      expect(fileWriteTool).toBeDefined();
      
      const testFile = path.join(testTmpDir, 'direct-tool-test.txt');
      const testContent = 'Content from direct tool execution';
      
      const result = await fileWriteTool.execute({
        filePath: testFile,
        content: testContent
      });
      
      console.log('📊 Direct tool execution result:', result);
      
      expect(result.success).toBe(true);
      
      // Verify file was created
      const fileExists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      if (fileExists) {
        const actualContent = await fs.readFile(testFile, 'utf-8');
        expect(actualContent).toBe(testContent);
        console.log('✅ Direct tool execution successful');
      }
    });
  });

  describe('Strategy Comparison', () => {
    it('should compare AtomicExecutionStrategy vs RecursiveExecutionStrategy for same task', async () => {
      console.log('🔧 Comparing execution strategies...');
      
      const baseTask = {
        description: `Write a greeting message to ${testTmpDir}/greeting.txt`
      };
      
      // Test with AtomicExecutionStrategy
      const atomicTask = {
        ...baseTask,
        id: 'atomic-comparison',
        atomic: true,
        tool: 'file_write',
        params: {
          filePath: path.join(testTmpDir, 'greeting-atomic.txt'),
          content: 'Hello from AtomicExecutionStrategy!'
        }
      };
      
      // Test with RecursiveExecutionStrategy
      const recursiveTask = {
        ...baseTask,
        id: 'recursive-comparison',
        recursive: true,
        description: `Write a greeting message "Hello from RecursiveExecutionStrategy!" to ${testTmpDir}/greeting-recursive.txt`
      };
      
      // Execute both
      const [atomicResult, recursiveResult] = await Promise.all([
        romaAgent.execute(atomicTask),
        romaAgent.execute(recursiveTask)
      ]);
      
      console.log('📊 Strategy comparison results:');
      console.log('  Atomic success:', atomicResult.success, 'duration:', atomicResult.metadata?.duration + 'ms');
      console.log('  Recursive success:', recursiveResult.success, 'duration:', recursiveResult.metadata?.duration + 'ms');
      
      // Both should succeed
      expect(atomicResult.success).toBe(true);
      expect(recursiveResult.success).toBe(true);
      
      // Check file creation
      const atomicFileExists = await fs.access(path.join(testTmpDir, 'greeting-atomic.txt')).then(() => true).catch(() => false);
      const recursiveFileExists = await fs.access(path.join(testTmpDir, 'greeting-recursive.txt')).then(() => true).catch(() => false);
      
      console.log('📁 File creation results:');
      console.log('  Atomic file created:', atomicFileExists);
      console.log('  Recursive file created:', recursiveFileExists);
      
      expect(atomicFileExists).toBe(true);
      expect(recursiveFileExists).toBe(true);
      
      if (atomicFileExists && recursiveFileExists) {
        console.log('🎉 Both strategies successfully create files!');
      }
    }, 60000);
  });
});

/**
 * Helper function to parse tool calls from XML (copied from RecursiveExecutionStrategy)
 */
function parseToolCallsFromXML(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const toolCalls = [];
  
  // Match <tool_use name="tool_name" parameters='{"param": "value"}'>
  const toolRegex = /<tool_use name="([^"]+)" parameters='([^']+)'>\s*<\/tool_use>/g;
  let match;
  
  while ((match = toolRegex.exec(content)) !== null) {
    try {
      const parameters = JSON.parse(match[2]);
      toolCalls.push({
        name: match[1],
        args: parameters,
        id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });
    } catch (e) {
      console.warn('Failed to parse tool parameters:', match[2]);
    }
  }
  
  return toolCalls;
}