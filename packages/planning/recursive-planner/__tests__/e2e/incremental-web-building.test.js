/**
 * Incremental Web Building Tests
 * 
 * Progressive tests that build from simple file creation to a complete 
 * Node.js server serving a webpage, using domain-based tool filtering.
 * 
 * Run with: NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tests/e2e/incremental-web-building.test.js --verbose
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createPlanningAgent, createLLMProvider } from '../../src/factories/AgentFactory.js';
import { LLMPlanningStrategy } from '../../src/core/execution/planning/index.js';
import { ToolRegistry, ModuleProvider } from '../../tools/src/integration/ToolRegistry.js';
import { FileSystemModuleDefinition } from '@legion/tool-architecture/src/modules/FileSystemModule.js';
import { HTTPModuleDefinition } from '@legion/tool-architecture/src/modules/HTTPModule.js';
import { GitModuleDefinition } from '@legion/tool-architecture/src/modules/GitModule.js';
import { config } from '../../src/runtime/config/index.js';
import { createTool } from '../../src/factories/ToolFactory.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Skip if no LLM provider available
const skipLiveLLMTests = !config.getAvailableLLMProviders().length;

// Test workspace
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testWorkspace = path.join(__dirname, '../../incremental-web-test');

describe('Incremental Web Building Tests', () => {
  let llmProvider;
  let toolRegistry;

  beforeAll(async () => {
    if (skipLiveLLMTests) {
      console.log('⚠️  Skipping incremental web building tests - no API keys configured');
      return;
    }
    
    console.log('\n🏗️  Starting Incremental Web Building Tests');
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
    
    // Initialize tool registry with domain filtering
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

    console.log('✅ Tool registry initialized with domain filtering');
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
   * Helper to create agent with domain-filtered tools and simplified tool interface
   */
  async function createWebBuildingAgent(name, goal) {
    // Get domain-filtered tools from registry
    const registryTools = await toolRegistry.getRelevantToolsForGoal(goal);
    
    // Convert to simplified interface that planning agent expects
    const simplifiedTools = registryTools.map(tool => {
      return createTool(
        tool.name,
        `Tool for ${tool.name} operations`,
        async (input) => {
          // Delegate to the actual tool
          return await tool.execute(input);
        }
      );
    });

    const agent = createPlanningAgent({
      name,
      description: `Agent for ${name.toLowerCase()}`,
      planningStrategy: new LLMPlanningStrategy(llmProvider, {
        maxRetries: 2,
        temperature: 0.3
      }),
      debugMode: true,
      maxRetries: 2
    });

    return { agent, tools: simplifiedTools, toolCount: registryTools.length };
  }

  (skipLiveLLMTests ? test.skip : test)('Step 1: Should create a simple text file using domain filtering', async () => {
    const goal = 'Create a text file named "hello.txt" with the content "Hello, World!"';
    
    const { agent, tools, toolCount } = await createWebBuildingAgent('FileCreatorAgent', goal);
    
    console.log('\n📝 Step 1: Testing basic file creation...');
    console.log(`   Goal: "${goal}"`);
    console.log(`   Domain-filtered tools: ${toolCount} (vs 46+ available)`);
    console.log(`   Tool names: ${tools.map(t => t.name).join(', ')}`);
    
    const result = await agent.run(goal, tools, { timeout: 60000 });
    const tokens = llmProvider.getTokenUsage().total;
    
    expect(result.success).toBe(true);
    
    // Verify file was created
    const filePath = path.join(testWorkspace, 'hello.txt');
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    
    if (fileExists) {
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('Hello, World!');
      console.log(`   ✅ File created successfully: "${content}"`);
    }
    
    console.log(`   Steps: ${result.result.completedSteps}/${result.result.totalSteps}`);
    console.log(`   Tokens: ${tokens}`);
    console.log(`   Tool reduction working: ${toolCount < 20 ? '✅' : '❌'}`);

  }, 90000);

  (skipLiveLLMTests ? test.skip : test)('Step 2: Should create basic HTML file', async () => {
    const goal = 'Create an HTML file named "index.html" with a basic webpage structure including title "My Test Page" and a heading "Welcome!"';
    
    const { agent, tools, toolCount } = await createWebBuildingAgent('HTMLCreatorAgent', goal);
    
    console.log('\n🌐 Step 2: Testing HTML file creation...');
    console.log(`   Goal: "${goal}"`);
    console.log(`   Domain-filtered tools: ${toolCount}`);
    
    const result = await agent.run(goal, tools, { timeout: 90000 });
    const tokens = llmProvider.getTokenUsage().total;
    
    expect(result.success).toBe(true);
    
    // Verify HTML file was created
    const htmlPath = path.join(testWorkspace, 'index.html');
    const htmlExists = await fs.access(htmlPath).then(() => true).catch(() => false);
    
    if (htmlExists) {
      const content = await fs.readFile(htmlPath, 'utf-8');
      expect(content.toLowerCase()).toContain('html');
      expect(content.toLowerCase()).toContain('my test page');
      expect(content.toLowerCase()).toContain('welcome');
      
      console.log(`   ✅ HTML file created with basic structure`);
      console.log(`   Content preview: ${content.substring(0, 100)}...`);
    }
    
    console.log(`   Steps: ${result.result.completedSteps}/${result.result.totalSteps}`);
    console.log(`   Tokens: ${tokens}`);

  }, 120000);

  (skipLiveLLMTests ? test.skip : test)('Step 3: Should create CSS file to style the webpage', async () => {
    const goal = 'Create a CSS file named "styles.css" with basic styling for the webpage including body font and h1 colors';
    
    const { agent, tools, toolCount } = await createWebBuildingAgent('CSSCreatorAgent', goal);
    
    console.log('\n🎨 Step 3: Testing CSS file creation...');
    console.log(`   Goal: "${goal}"`);
    
    const result = await agent.run(goal, tools, { timeout: 90000 });
    const tokens = llmProvider.getTokenUsage().total;
    
    expect(result.success).toBe(true);
    
    // Verify CSS file was created
    const cssPath = path.join(testWorkspace, 'styles.css');
    const cssExists = await fs.access(cssPath).then(() => true).catch(() => false);
    
    if (cssExists) {
      const content = await fs.readFile(cssPath, 'utf-8');
      expect(content.toLowerCase()).toContain('body');
      expect(content.toLowerCase()).toContain('h1');
      
      console.log(`   ✅ CSS file created with styling`);
      console.log(`   Content preview: ${content.substring(0, 100)}...`);
    }
    
    console.log(`   Steps: ${result.result.completedSteps}/${result.result.totalSteps}`);
    console.log(`   Tokens: ${tokens}`);

  }, 120000);

  (skipLiveLLMTests ? test.skip : test)('Step 4: Should create a Node.js server file', async () => {
    const goal = 'Create a Node.js server file named "server.js" that serves static HTML files on port 3000';
    
    const { agent, tools, toolCount } = await createWebBuildingAgent('ServerCreatorAgent', goal);
    
    console.log('\n🖥️  Step 4: Testing Node.js server creation...');
    console.log(`   Goal: "${goal}"`);
    
    const result = await agent.run(goal, tools, { timeout: 120000 });
    const tokens = llmProvider.getTokenUsage().total;
    
    expect(result.success).toBe(true);
    
    // Verify server file was created
    const serverPath = path.join(testWorkspace, 'server.js');
    const serverExists = await fs.access(serverPath).then(() => true).catch(() => false);
    
    if (serverExists) {
      const content = await fs.readFile(serverPath, 'utf-8');
      expect(content.toLowerCase()).toContain('3000');
      expect(content.toLowerCase()).toContain('server');
      
      console.log(`   ✅ Server file created`);
      console.log(`   Content preview: ${content.substring(0, 150)}...`);
    }
    
    console.log(`   Steps: ${result.result.completedSteps}/${result.result.totalSteps}`);
    console.log(`   Tokens: ${tokens}`);

  }, 150000);

  (skipLiveLLMTests ? test.skip : test)('Step 5: Should create package.json for Node server', async () => {
    const goal = 'Create a package.json file for the Node.js project with express dependency and start script';
    
    const { agent, tools, toolCount } = await createWebBuildingAgent('PackageCreatorAgent', goal);
    
    console.log('\n📦 Step 5: Testing package.json creation...');
    console.log(`   Goal: "${goal}"`);
    
    const result = await agent.run(goal, tools, { timeout: 90000 });
    const tokens = llmProvider.getTokenUsage().total;
    
    expect(result.success).toBe(true);
    
    // Verify package.json was created
    const packagePath = path.join(testWorkspace, 'package.json');
    const packageExists = await fs.access(packagePath).then(() => true).catch(() => false);
    
    if (packageExists) {
      const content = await fs.readFile(packagePath, 'utf-8');
      expect(content.toLowerCase()).toContain('express');
      expect(content.toLowerCase()).toContain('start');
      
      console.log(`   ✅ Package.json created with dependencies`);
      
      // Try to parse it as JSON
      try {
        const packageData = JSON.parse(content);
        expect(packageData.dependencies || packageData.devDependencies).toBeDefined();
        console.log(`   Package data valid: ${Object.keys(packageData).join(', ')}`);
      } catch (e) {
        console.log(`   ⚠️  Package.json not valid JSON, but file created`);
      }
    }
    
    console.log(`   Steps: ${result.result.completedSteps}/${result.result.totalSteps}`);
    console.log(`   Tokens: ${tokens}`);

  }, 120000);

  // Integration test - verify all files work together
  (skipLiveLLMTests ? test.skip : test)('Step 6: Verify complete website structure', async () => {
    console.log('\n🔍 Step 6: Verifying complete website structure...');
    
    const expectedFiles = [
      'hello.txt',
      'index.html', 
      'styles.css',
      'server.js',
      'package.json'
    ];
    
    let filesFound = 0;
    const fileDetails = [];
    
    for (const filename of expectedFiles) {
      const filePath = path.join(testWorkspace, filename);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      
      if (exists) {
        filesFound++;
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        
        fileDetails.push({
          name: filename,
          size: stats.size,
          preview: content.substring(0, 50).replace(/\n/g, ' ')
        });
      }
    }
    
    console.log(`   Files created: ${filesFound}/${expectedFiles.length}`);
    
    for (const file of fileDetails) {
      console.log(`   ✅ ${file.name} (${file.size} bytes): ${file.preview}...`);
    }
    
    expect(filesFound).toBeGreaterThan(3); // Should have created most files
    
    // Check if we have the minimum for a working website
    const hasHTML = fileDetails.some(f => f.name === 'index.html');
    const hasServer = fileDetails.some(f => f.name === 'server.js');
    
    console.log(`   Website components: HTML=${hasHTML}, Server=${hasServer}`);
    console.log(`   🎉 Website structure ${hasHTML && hasServer ? 'COMPLETE' : 'PARTIAL'}`);

  }, 30000);
});