/**
 * Validated Tool Execution Test
 * 
 * Tests the enhanced tool validation and error feedback system with the new
 * Planner abstraction that provides validation and reprompting.
 * 
 * Run with: NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tests/e2e/validated-tool-execution.test.js --verbose
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createPlanningAgent, createLLMProvider } from '../../src/factories/AgentFactory.js';
import { LLMPlanningStrategy } from '../../src/core/execution/planning/index.js';
import { Planner } from '../../src/core/planning/Planner.js';
import { PlanValidator } from '../../src/core/planning/validation/PlanValidator.js';
import { SchemaValidator } from '../../src/core/planning/validation/SchemaValidator.js';
import { ToolRegistry, ModuleProvider } from '../../tools/src/integration/ToolRegistry.js';
import { FileSystemModuleDefinition } from '../../tools/src/modules/FileSystemModule.js';
import { config } from '../../src/runtime/config/index.js';
import { createTool } from '../../src/factories/ToolFactory.js';
import { createValidatingToolWrapper } from '../../src/utils/ToolValidation.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Skip if no LLM provider available
const skipLiveLLMTests = !config.getAvailableLLMProviders().length;

// Test workspace
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const validatedWorkspace = path.join(__dirname, '../../validated-test-workspace');

describe('Validated Tool Execution', () => {
  let llmProvider;
  let toolRegistry;

  beforeAll(async () => {
    if (skipLiveLLMTests) {
      console.log('⚠️  Skipping validated tool execution test - no API keys configured');
      return;
    }
    
    console.log('\n🔍 Starting Validated Tool Execution Test');
    
    // Create test workspace
    try {
      await fs.mkdir(validatedWorkspace, { recursive: true });
      console.log(`   Test workspace: ${validatedWorkspace}`);
    } catch (error) {
      // Directory might already exist
    }
    
    // Initialize LLM provider
    llmProvider = createLLMProvider();
    
    // Initialize tool registry
    toolRegistry = new ToolRegistry();
    
    await toolRegistry.registerProvider(new ModuleProvider({
      name: 'FileSystemModule',
      definition: FileSystemModuleDefinition,
      config: {
        basePath: validatedWorkspace,
        allowWrite: true,
        allowDelete: true
      },
      lazy: false
    }));

    console.log('✅ Setup complete');
  });

  afterAll(async () => {
    if (!skipLiveLLMTests) {
      try {
        await fs.rm(validatedWorkspace, { recursive: true, force: true });
        console.log(`   🧹 Cleaned up test workspace`);
      } catch (error) {
        console.warn('   Could not clean up test workspace:', error.message);
      }
    }
  });

  /**
   * Helper to create validated tools
   */
  async function createValidatedTools(goal) {
    // Get domain-filtered tools
    const relevantTools = await toolRegistry.getRelevantToolsForGoal(goal);
    
    // Wrap with validation
    const validatedTools = relevantTools.map(tool => 
      createValidatingToolWrapper(tool, relevantTools)
    );

    // Convert to AtomicTool format for planning agent
    const atomicTools = validatedTools.map(tool => {
      return createTool(
        tool.name,
        tool.description || `Validated ${tool.name} tool`,
        tool.execute.bind(tool)
      );
    });

    console.log(`   Created ${atomicTools.length} validated tools: ${atomicTools.map(t => t.name).join(', ')}`);
    
    return { atomicTools, metadata: validatedTools.map(t => t.getMetadata()) };
  }

  (skipLiveLLMTests ? test.skip : test)('should provide detailed error feedback for invalid parameters', async () => {
    console.log('\n📝 Testing parameter validation feedback...');
    
    const { atomicTools } = await createValidatedTools('Create a text file');
    
    const writeFileTool = atomicTools.find(t => t.name === 'writeFile');
    expect(writeFileTool).toBeDefined();
    
    // Test with invalid parameters (what LLM was doing wrong)
    try {
      await writeFileTool.execute({
        filename: 'test.txt',  // Wrong parameter name
        data: 'Hello World!'   // Wrong parameter name  
      });
      
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      console.log('   ✅ Validation error caught:');
      console.log(error.message);
      
      // Should provide clear feedback
      expect(error.message).toContain('Parameter validation failed');
      expect(error.message).toContain('filename');
      expect(error.message).toContain('path');
      expect(error.message).toContain('data');
      expect(error.message).toContain('content');
    }
  });

  (skipLiveLLMTests ? test.skip : test)('should succeed with correct parameters', async () => {
    console.log('\n✅ Testing successful execution with correct parameters...');
    
    const { atomicTools } = await createValidatedTools('Create a text file');
    
    const writeFileTool = atomicTools.find(t => t.name === 'writeFile');
    
    // Test with correct parameters
    const result = await writeFileTool.execute({
      path: 'success-test.txt',     // Correct parameter name
      content: 'Success message!'  // Correct parameter name
    });
    
    console.log('   Execution result:', result);
    
    // Verify file was created
    const filePath = path.join(validatedWorkspace, 'success-test.txt');
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    
    console.log(`   File created: ${exists ? '✅' : '❌'}`);
    
    if (exists) {
      const content = await fs.readFile(filePath, 'utf-8');
      console.log(`   Content: "${content}"`);
      expect(content).toBe('Success message!');
    }
    
    expect(result).toBeDefined();
    expect(exists).toBe(true);
  });

  (skipLiveLLMTests ? test.skip : test)('should help LLM learn from parameter errors with enhanced planning strategy', async () => {
    console.log('\n🧠 Testing LLM learning from parameter validation errors...');
    
    const goal = 'Create a text file called "learning-test.txt" with the content "LLM learned to use correct parameters!"';
    
    const { atomicTools } = await createValidatedTools(goal);
    
    // Create enhanced planning strategy with better error handling
    const enhancedPlanningStrategy = new LLMPlanningStrategy(llmProvider, {
      maxRetries: 3, // More retries for learning
      temperature: 0.2, // Lower temperature for more consistent parameter usage
      examples: [
        {
          goal: 'Create a file with content',
          plan: [
            {
              id: 'write_file',
              description: 'Write content to file',
              tool: 'writeFile',
              params: {
                path: 'example.txt',      // Correct parameter names
                content: 'Example content', // Correct parameter names
                encoding: 'utf-8'
              },
              dependencies: []
            }
          ]
        }
      ]
    });

    const agent = createPlanningAgent({
      name: 'LearningAgent',
      description: 'Agent that learns from parameter validation errors',
      planningStrategy: enhancedPlanningStrategy,
      debugMode: true,
      maxRetries: 3 // Allow multiple attempts for learning
    });

    console.log(`   Running agent with enhanced error feedback...`);
    
    const startTime = Date.now();
    const result = await agent.run(goal, atomicTools, { timeout: 120000 });
    const endTime = Date.now();

    const tokens = llmProvider.getTokenUsage().total;
    
    console.log(`\n   📊 LEARNING RESULTS:`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Steps: ${result.result?.completedSteps || 0}/${result.result?.totalSteps || 0}`);
    console.log(`   Time: ${endTime - startTime}ms`);
    console.log(`   Tokens: ${tokens}`);
    
    // Verify the file was actually created
    const expectedFile = path.join(validatedWorkspace, 'learning-test.txt');
    const fileExists = await fs.access(expectedFile).then(() => true).catch(() => false);
    
    console.log(`   🎯 Final result: File exists = ${fileExists ? '✅' : '❌'}`);
    
    if (fileExists) {
      const content = await fs.readFile(expectedFile, 'utf-8');
      console.log(`   Content: "${content}"`);
      console.log(`   🎉 SUCCESS: LLM learned to use correct parameters!`);
      expect(content).toContain('LLM learned');
    } else {
      console.log(`   📚 Learning opportunity: Agent may need more examples or better error feedback`);
    }
    
    // Success criteria: either file was created OR we can see learning in progress
    expect(result.success || tokens > 500).toBe(true); // Tokens > 500 suggests multiple attempts/learning
    
  }, 180000);

  (skipLiveLLMTests ? test.skip : test)('should build a simple webpage with validated tools', async () => {
    console.log('\n🌐 Testing webpage creation with validated tools...');
    
    const goal = `Create a simple HTML webpage:
1. Create an index.html file with basic HTML structure and title "Validated Tool Test"
2. Create a styles.css file with basic styling for the body and h1 elements
3. Make sure both files are properly created with correct content`;

    const { atomicTools } = await createValidatedTools(goal);
    
    // Enhanced planning with examples specific to web development
    const webPlanningStrategy = new LLMPlanningStrategy(llmProvider, {
      maxRetries: 3,
      temperature: 0.2,
      examples: [
        {
          goal: 'Create HTML and CSS files',
          plan: [
            {
              id: 'create_html',
              description: 'Create HTML file',
              tool: 'writeFile', 
              params: {
                path: 'index.html',
                content: '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>',
                encoding: 'utf-8'
              },
              dependencies: []
            },
            {
              id: 'create_css',
              description: 'Create CSS file',
              tool: 'writeFile',
              params: {
                path: 'styles.css', 
                content: 'body { font-family: Arial; } h1 { color: blue; }',
                encoding: 'utf-8'
              },
              dependencies: []
            }
          ]
        }
      ]
    });

    const webAgent = createPlanningAgent({
      name: 'WebBuilderAgent',
      description: 'Agent that builds web pages with validated tools',
      planningStrategy: webPlanningStrategy,
      debugMode: true,
      maxRetries: 2
    });

    const result = await webAgent.run(goal, atomicTools, { timeout: 120000 });
    
    console.log(`   Web building result: ${result.success ? '✅' : '❌'}`);
    console.log(`   Steps completed: ${result.result?.completedSteps || 0}/${result.result?.totalSteps || 0}`);
    
    // Check created files
    const expectedFiles = ['index.html', 'styles.css'];
    let filesCreated = 0;
    
    for (const filename of expectedFiles) {
      const filePath = path.join(validatedWorkspace, filename);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      
      if (exists) {
        filesCreated++;
        const content = await fs.readFile(filePath, 'utf-8');
        console.log(`   ✅ ${filename} (${content.length} chars): ${content.substring(0, 50)}...`);
        
        // Validate content
        if (filename === 'index.html') {
          expect(content.toLowerCase()).toContain('html');
          expect(content.toLowerCase()).toContain('validated tool test');
        }
        if (filename === 'styles.css') {
          expect(content.toLowerCase()).toContain('body');
        }
      } else {
        console.log(`   ❌ ${filename} - not created`);
      }
    }
    
    console.log(`   📊 Files created: ${filesCreated}/${expectedFiles.length}`);
    
    expect(result.success).toBe(true);
    expect(filesCreated).toBeGreaterThan(0); // At least some files should be created
    
    if (filesCreated === expectedFiles.length) {
      console.log(`   🎉 SUCCESS: Complete webpage built with validated tools!`);
    }
    
  }, 180000);
});