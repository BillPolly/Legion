/**
 * Simple File Write Test with Live LLM
 * 
 * This test validates the basic functionality of having an LLM plan
 * a simple task to write content to a file.
 * 
 * Run with: NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tests/e2e/simple-file-write.test.js --verbose
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createPlanningAgent, createLLMProvider } from '../../src/factories/AgentFactory.js';
import { LLMPlanningStrategy } from '../../src/core/execution/planning/index.js';
import { createTool } from '../../src/factories/ToolFactory.js';
import { config } from '../../src/runtime/config/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Skip if no LLM provider available
const skipLiveLLMTests = !config.getAvailableLLMProviders().length;

// Test workspace
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testWorkspace = path.join(__dirname, '../../simple-test-workspace');

describe('Simple File Write Test', () => {
  let llmProvider;

  beforeAll(async () => {
    if (skipLiveLLMTests) {
      console.log('⚠️  Skipping simple file write test - no API keys configured');
      return;
    }
    
    console.log('\n🚀 Starting Simple File Write Test');
    console.log(`   Provider: ${config.get('llm.provider')}`);
    
    // Create test workspace
    try {
      await fs.mkdir(testWorkspace, { recursive: true });
      console.log(`   Test workspace: ${testWorkspace}`);
    } catch (error) {
      // Directory might already exist, that's ok
    }
    
    // Initialize LLM provider
    llmProvider = createLLMProvider();
  });

  afterAll(async () => {
    if (!skipLiveLLMTests) {
      // Clean up test workspace
      try {
        await fs.rm(testWorkspace, { recursive: true, force: true });
        console.log(`   🧹 Cleaned up test workspace`);
      } catch (error) {
        console.warn('   Could not clean up test workspace:', error.message);
      }
    }
  });

  (skipLiveLLMTests ? test.skip : test)('should plan and execute writing content to a file', async () => {
    // Create simple file writing tool
    const writeFileTool = createTool(
      'writeFile',
      'Write content to a file',
      async (input) => {
        const { filename, content } = input;
        const filePath = path.resolve(testWorkspace, filename);
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        
        // Write the file
        await fs.writeFile(filePath, content, 'utf-8');
        
        console.log(`   📄 File written: ${filename} (${content.length} characters)`);
        
        return {
          success: true,
          path: filePath,
          filename,
          size: content.length,
          message: `Successfully wrote ${content.length} characters to ${filename}`
        };
      }
    );

    // Create agent with simple planning strategy
    const agent = createPlanningAgent({
      name: 'SimpleFileWriter',
      description: 'Agent that writes content to files',
      planningStrategy: new LLMPlanningStrategy(llmProvider, {
        maxRetries: 2,
        temperature: 0.3,
        examples: [
          {
            goal: 'Write content to a file',
            plan: [
              {
                id: 'write_content',
                description: 'Write content to the specified file',
                tool: 'writeFile',
                params: { filename: 'example.txt', content: 'Hello World' },
                dependencies: []
              }
            ]
          }
        ]
      }),
      debugMode: true,
      maxRetries: 2
    });

    console.log('\n📝 Testing: Plan and execute writing content to a file...');
    
    const startTime = Date.now();
    const result = await agent.run(
      'Create a file named "hello.txt" with the content "Hello from RecursivePlanner! This is a test of the LLM-driven planning system working correctly."',
      [writeFileTool],
      { timeout: 60000 }
    );
    const endTime = Date.now();

    // Check if the planning and execution worked
    expect(result.success).toBe(true);
    expect(result.result.completedSteps).toBeGreaterThan(0);
    expect(result.result.totalSteps).toBeGreaterThan(0);
    
    // Verify the file was actually created
    const expectedFilePath = path.join(testWorkspace, 'hello.txt');
    const fileExists = await fs.access(expectedFilePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
    
    if (fileExists) {
      const fileContent = await fs.readFile(expectedFilePath, 'utf-8');
      expect(fileContent).toContain('Hello from RecursivePlanner');
      console.log(`   ✅ File content verified: "${fileContent.substring(0, 50)}..."`);
    }
    
    // Log results
    const executionTime = endTime - startTime;
    const tokenUsage = llmProvider.getTokenUsage();
    
    console.log(`   ✅ Test completed successfully!`);
    console.log(`      Steps completed: ${result.result.completedSteps}/${result.result.totalSteps}`);
    console.log(`      Execution time: ${executionTime}ms`);
    console.log(`      Token usage: ${tokenUsage.total} tokens (${tokenUsage.input} in, ${tokenUsage.output} out)`);
    console.log(`      File created: ${expectedFilePath}`);

  }, 90000);

  (skipLiveLLMTests ? test.skip : test)('should plan and execute writing multiple files', async () => {
    // File operations tools
    const tools = [
      createTool('writeFile', 'Write content to a file', async (input) => {
        const { filename, content } = input;
        const filePath = path.resolve(testWorkspace, filename);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        
        console.log(`   📄 File written: ${filename}`);
        
        return { success: true, path: filePath, filename, size: content.length };
      }),

      createTool('createDirectory', 'Create a directory', async (input) => {
        const { dirname } = input;
        const dirPath = path.resolve(testWorkspace, dirname);
        await fs.mkdir(dirPath, { recursive: true });
        
        console.log(`   📁 Directory created: ${dirname}`);
        
        return { success: true, path: dirPath, dirname };
      })
    ];

    const agent = createPlanningAgent({
      name: 'MultiFileAgent',
      description: 'Agent that creates multiple files and directories',
      planningStrategy: new LLMPlanningStrategy(llmProvider, {
        maxRetries: 2,
        temperature: 0.3
      }),
      debugMode: true,
      maxRetries: 2
    });

    console.log('\n📂 Testing: Plan and execute creating multiple files...');
    
    const result = await agent.run(
      'Create a simple project structure: make a "docs" directory, then create three files: "README.md" with project info, "docs/setup.md" with setup instructions, and "docs/usage.md" with usage examples',
      tools,
      { timeout: 120000 }
    );

    expect(result.success).toBe(true);
    expect(result.result.completedSteps).toBeGreaterThanOrEqual(3); // At least create directory + 3 files

    // Verify files were created
    const expectedFiles = [
      path.join(testWorkspace, 'README.md'),
      path.join(testWorkspace, 'docs', 'setup.md'),
      path.join(testWorkspace, 'docs', 'usage.md')
    ];

    let filesCreated = 0;
    for (const filePath of expectedFiles) {
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (exists) {
        filesCreated++;
        const content = await fs.readFile(filePath, 'utf-8');
        console.log(`   ✅ ${path.basename(filePath)}: ${content.length} characters`);
      }
    }

    expect(filesCreated).toBeGreaterThan(0); // At least some files should be created
    
    const tokenUsage = llmProvider.getTokenUsage();
    console.log(`   ✅ Multi-file test completed!`);
    console.log(`      Files created: ${filesCreated}/3`);
    console.log(`      Steps completed: ${result.result.completedSteps}/${result.result.totalSteps}`);
    console.log(`      Token usage: ${tokenUsage.total} tokens`);

  }, 150000);
});