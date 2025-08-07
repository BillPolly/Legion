/**
 * Domain Filtering with Live LLM Integration Test
 * 
 * Tests the domain-based tool filtering system with live LLM planning
 * to demonstrate the complete workflow and efficiency improvements.
 * 
 * Run with: NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tests/e2e/domain-filtering-with-llm.test.js --verbose
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { createPlanningAgent, createLLMProvider } from '../../src/factories/AgentFactory.js';
import { LLMPlanningStrategy } from '../../src/core/execution/planning/index.js';
import { ToolRegistry, ModuleProvider } from '../../tools/src/integration/ToolRegistry.js';
import { FileSystemModuleDefinition } from '@legion/tool-architecture/src/modules/FileSystemModule.js';
import { HTTPModuleDefinition } from '@legion/tool-architecture/src/modules/HTTPModule.js';
import { GitModuleDefinition } from '@legion/tool-architecture/src/modules/GitModule.js';
import { config } from '../../src/runtime/config/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Skip if no LLM provider available
const skipLiveLLMTests = !config.getAvailableLLMProviders().length;

// Test workspace
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testWorkspace = path.join(__dirname, '../../domain-filter-test-workspace');

describe('Domain Filtering with Live LLM Integration', () => {
  let llmProvider;
  let toolRegistry;

  beforeAll(async () => {
    if (skipLiveLLMTests) {
      console.log('⚠️  Skipping domain filtering LLM tests - no API keys configured');
      return;
    }
    
    console.log('\n🚀 Starting Domain Filtering + LLM Integration Test');
    console.log(`   Provider: ${config.get('llm.provider')}`);
    
    // Create test workspace
    try {
      await fs.mkdir(testWorkspace, { recursive: true });
      console.log(`   Test workspace: ${testWorkspace}`);
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
        basePath: testWorkspace,
        allowWrite: true,
        allowDelete: true
      },
      lazy: false
    }));

    await toolRegistry.registerProvider(new ModuleProvider({
      name: 'HTTPModule', 
      definition: HTTPModuleDefinition,
      config: {
        timeout: 10000
      },
      lazy: false
    }));

    await toolRegistry.registerProvider(new ModuleProvider({
      name: 'GitModule',
      definition: GitModuleDefinition,
      config: {
        timeout: 30000
      },
      lazy: false
    }));

    console.log('✅ Tool registry initialized with domain filtering');
  });

  beforeEach(() => {
    if (!skipLiveLLMTests && llmProvider) {
      llmProvider.resetTokenUsage();
    }
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

  /**
   * Helper function to create agent with domain-filtered tools
   */
  async function createAgentWithDomainFiltering(name, goal) {
    // Get domain-filtered tools instead of all tools
    const relevantTools = await toolRegistry.getRelevantToolsForGoal(goal);
    
    const agent = createPlanningAgent({
      name,
      description: `Agent for ${name.toLowerCase()}`,
      planningStrategy: new LLMPlanningStrategy(llmProvider, {
        maxRetries: 2,
        temperature: 0.3,
        examples: []
      }),
      debugMode: true,
      maxRetries: 2
    });

    return { agent, tools: relevantTools };
  }

  (skipLiveLLMTests ? test.skip : test)('should demonstrate efficiency improvement with domain filtering', async () => {
    const goal = 'Create a simple HTML file called "hello.html" with basic content';
    
    console.log('\n📊 Comparing tool selection approaches...');
    
    // Approach 1: All available tools (traditional)
    const allTools = [];
    const allToolNames = await toolRegistry.listTools();
    for (const toolName of allToolNames) {
      try {
        const tool = await toolRegistry.getTool(toolName);
        if (tool) allTools.push(tool);
      } catch (error) {
        // Skip tools that can't be loaded
      }
    }
    
    // Approach 2: Domain-filtered tools (new)
    const { agent, tools: filteredTools } = await createAgentWithDomainFiltering('DomainFilteredAgent', goal);
    
    console.log(`   All available tools: ${allTools.length}`);
    console.log(`   Domain-filtered tools: ${filteredTools.length}`);
    console.log(`   Reduction: ${Math.round((1 - filteredTools.length / allTools.length) * 100)}%`);
    
    // Test the domain-filtered approach
    const startTime = Date.now();
    const result = await agent.run(goal, filteredTools, { timeout: 60000 });
    const endTime = Date.now();
    
    const tokens = llmProvider.getTokenUsage();
    
    expect(result.success).toBe(true);
    expect(filteredTools.length).toBeLessThan(allTools.length * 0.5); // At least 50% reduction
    
    // Verify the file was actually created
    const expectedFilePath = path.join(testWorkspace, 'hello.html');
    const fileExists = await fs.access(expectedFilePath).then(() => true).catch(() => false);
    
    console.log(`   ✅ Planning completed with domain filtering:`);
    console.log(`      Success: ${result.success}`);
    console.log(`      Steps: ${result.result.completedSteps}/${result.result.totalSteps}`);
    console.log(`      Time: ${endTime - startTime}ms`);
    console.log(`      Tokens used: ${tokens.total}`);
    console.log(`      File created: ${fileExists}`);
    
    if (fileExists) {
      const content = await fs.readFile(expectedFilePath, 'utf-8');
      console.log(`      File content: "${content.substring(0, 50)}..."`);
      expect(content.toLowerCase()).toContain('html');
    }

  }, 90000);

  (skipLiveLLMTests ? test.skip : test)('should handle web development goal with appropriate tools', async () => {
    const goal = 'Create a simple portfolio website with index.html, styles.css, and a basic structure';
    
    const { agent, tools } = await createAgentWithDomainFiltering('WebDeveloperAgent', goal);
    
    console.log('\n🌐 Testing web development workflow...');
    console.log(`   Goal: "${goal}"`);
    console.log(`   Selected tools: ${tools.map(t => t.name).join(', ')}`);
    
    const result = await agent.run(goal, tools, { timeout: 120000 });
    const tokens = llmProvider.getTokenUsage();
    
    expect(result.success).toBe(true);
    
    // Check if appropriate files were created
    const expectedFiles = ['index.html', 'styles.css'];
    let filesCreated = 0;
    
    for (const filename of expectedFiles) {
      const filePath = path.join(testWorkspace, filename);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (exists) filesCreated++;
    }
    
    console.log(`   ✅ Web development completed:`);
    console.log(`      Steps: ${result.result.completedSteps}/${result.result.totalSteps}`);
    console.log(`      Files created: ${filesCreated}/${expectedFiles.length}`);
    console.log(`      Token usage: ${tokens.total}`);
    
    // Should have created at least one web file
    expect(filesCreated).toBeGreaterThan(0);
    
    // Should primarily use file operation tools (not git/api tools for simple website)
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('writeFile');
    expect(toolNames).toContain('mkdir');

  }, 150000);

  (skipLiveLLMTests ? test.skip : test)('should adapt tool selection for different goal types', async () => {
    const testCases = [
      {
        goal: 'Read a configuration file and display its contents',
        expectedDomains: ['files'],
        mustHaveTools: ['readFile'],
        shouldNotHaveTools: ['push', 'clone'] // No git tools needed
      },
      {
        goal: 'Create a git repository and make initial commit',
        expectedDomains: ['git', 'development'],
        mustHaveTools: ['commit'],
        shouldNotHaveTools: ['get', 'post'] // No HTTP tools needed
      },
      {
        goal: 'Build a web API endpoint with documentation',
        expectedDomains: ['api', 'web'],
        mustHaveTools: ['writeFile'], // For documentation
        shouldNotHaveTools: [] // Flexible for API development
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n🎯 Testing goal: "${testCase.goal}"`);
      
      // Analyze goal to check domain detection
      const detectedDomains = toolRegistry.extractDomainsFromGoal(testCase.goal);
      console.log(`   Detected domains: ${detectedDomains.join(', ')}`);
      
      // Check if expected domains are detected
      for (const expectedDomain of testCase.expectedDomains) {
        expect(detectedDomains).toContain(expectedDomain);
      }
      
      // Get tools for this goal
      const tools = await toolRegistry.getRelevantToolsForGoal(testCase.goal);
      const toolNames = tools.map(t => t.name);
      
      console.log(`   Selected tools: ${toolNames.join(', ')}`);
      
      // Check required tools are present
      for (const mustHaveTool of testCase.mustHaveTools) {
        expect(toolNames).toContain(mustHaveTool);
      }
      
      // Check unwanted tools are not present
      for (const shouldNotHaveTool of testCase.shouldNotHaveTools) {
        expect(toolNames).not.toContain(shouldNotHaveTool);
      }
      
      console.log(`   ✅ Tool selection validated for goal type`);
    }

  }, 30000);

  (skipLiveLLMTests ? test.skip : test)('should demonstrate token efficiency in planning', async () => {
    const goal = 'Create a markdown document with project information';
    
    // Get filtered tools
    const relevantTools = await toolRegistry.getRelevantToolsForGoal(goal);
    
    console.log('\n💰 Testing token efficiency...');
    console.log(`   Goal requires file operations`);
    console.log(`   Domain-filtered tools: ${relevantTools.length}`);
    console.log(`   Tool names: ${relevantTools.map(t => t.name).join(', ')}`);
    
    const agent = createPlanningAgent({
      name: 'EfficientAgent',
      planningStrategy: new LLMPlanningStrategy(llmProvider, {
        maxRetries: 1,
        temperature: 0.3
      }),
      debugMode: true
    });

    const startTokens = llmProvider.getTokenUsage().total;
    const result = await agent.run(goal, relevantTools, { timeout: 60000 });
    const endTokens = llmProvider.getTokenUsage().total;
    
    const tokensUsed = endTokens - startTokens;
    
    expect(result.success).toBe(true);
    
    console.log(`   ✅ Planning completed efficiently:`);
    console.log(`      Success: ${result.success}`);
    console.log(`      Tokens used for planning: ${tokensUsed}`);
    console.log(`      Tools in prompt: ${relevantTools.length} (instead of 46+)`);
    
    // With fewer tools, should use fewer tokens for planning
    // This is a rough estimate - exact tokens depend on tool descriptions
    expect(tokensUsed).toBeLessThan(3000); // Reasonable upper bound for simple task

  }, 90000);
});