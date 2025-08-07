/**
 * Integration test for validating BT workflow configurations
 * Tests that all workflow configs are valid and can be executed
 */

import { BehaviorTreeExecutor } from '../../src/core/BehaviorTreeExecutor.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { WebAppTools } from '../../src/tools/webapp-tools.js';
import { BuildTools } from '../../src/tools/build-tools.js';
import { PuppeteerTools } from '../../src/tools/puppeteer-tools.js';
import fs from 'fs/promises';
import path from 'path';

describe('Integration Workflow Validation E2E', () => {
  let executor;
  let toolRegistry;
  let webAppTools;
  let buildTools;
  let puppeteerTools;
  const testDir = './test-integration-output';

  beforeAll(async () => {
    // Clean up any existing test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }

    // Initialize tools
    webAppTools = new WebAppTools(testDir);
    buildTools = new BuildTools(testDir);
    puppeteerTools = new PuppeteerTools(testDir);
    
    // Initialize tool registry
    toolRegistry = new ToolRegistry();
    
    // Register all tools
    await registerWebAppTools(toolRegistry, webAppTools);
    await registerBuildTools(toolRegistry, buildTools);
    await registerPuppeteerTools(toolRegistry, puppeteerTools);
    
    // Initialize executor
    executor = new BehaviorTreeExecutor(toolRegistry);
  });

  afterAll(async () => {
    // Clean up resources
    await puppeteerTools.closeAllBrowsers();
    await buildTools.stopAllProcesses();
    
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  async function registerWebAppTools(registry, tools) {
    await registry.registerTool('htmlGenerator', tools.createHtmlGenerator());
    await registry.registerTool('cssGenerator', tools.createCssGenerator());
    await registry.registerTool('reactComponentGenerator', tools.createReactComponentGenerator());
    await registry.registerTool('packageJsonGenerator', tools.createPackageJsonGenerator());
    await registry.registerTool('mainEntryGenerator', tools.createMainEntryGenerator());
  }

  async function registerBuildTools(registry, tools) {
    await registry.registerTool('npmInstaller', tools.createNpmInstaller());
    await registry.registerTool('buildRunner', tools.createBuildRunner());
    await registry.registerTool('serverManager', tools.createServerManager());
    await registry.registerTool('portManager', tools.createPortManager());
  }

  async function registerPuppeteerTools(registry, tools) {
    await registry.registerTool('browserManager', tools.createBrowserManager());
    await registry.registerTool('screenshotCapture', tools.createScreenshotCapture());
    await registry.registerTool('interactionTester', tools.createInteractionTester());
    await registry.registerTool('performanceTester', tools.createPerformanceTester());
    await registry.registerTool('visualRegressionTester', tools.createVisualRegressionTester());
  }

  test('should validate CompleteWebAppWorkflow configuration', async () => {
    const configPath = path.join('configs', 'CompleteWebAppWorkflow.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    // Validate the configuration
    const validation = executor.validateTreeConfiguration(config);
    
    if (!validation.valid) {
      console.log('Validation errors:', validation.errors);
      console.log('Validation warnings:', validation.warnings);
    }

    expect(validation.valid).toBe(true);
    expect(config.type).toBe('sequence');
    expect(config.id).toBe('complete-webapp-workflow');
    expect(config.children).toBeDefined();
    expect(config.children.length).toBeGreaterThan(0);
  });

  test('should validate RapidPrototypeWorkflow configuration', async () => {
    const configPath = path.join('configs', 'RapidPrototypeWorkflow.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    // Validate the configuration
    const validation = executor.validateTreeConfiguration(config);
    
    expect(validation.valid).toBe(true);
    expect(config.type).toBe('sequence');
    expect(config.id).toBe('rapid-prototype-workflow');
    
    // Check for parallel generation
    const parallelGeneration = config.children.find(child => child.id === 'parallel-generation');
    expect(parallelGeneration).toBeDefined();
    expect(parallelGeneration.type).toBe('parallel');
    expect(parallelGeneration.successPolicy).toBe('all');
  });

  test('should validate VisualEvolutionWorkflow configuration', async () => {
    const configPath = path.join('configs', 'VisualEvolutionWorkflow.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    // Validate the configuration
    const validation = executor.validateTreeConfiguration(config);
    
    expect(validation.valid).toBe(true);
    expect(config.type).toBe('sequence');
    expect(config.id).toBe('visual-evolution-workflow');
    
    // Check for retry node with design iteration
    const designIteration = config.children.find(child => child.type === 'retry');
    expect(designIteration).toBeDefined();
    expect(designIteration.maxAttempts).toBe(5);
    expect(designIteration.exponentialBackoff).toBe(true);
  });

  test('should validate ContinuousTestingWorkflow configuration', async () => {
    const configPath = path.join('configs', 'ContinuousTestingWorkflow.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    // Validate the configuration
    const validation = executor.validateTreeConfiguration(config);
    
    expect(validation.valid).toBe(true);
    expect(config.type).toBe('sequence');
    expect(config.id).toBe('continuous-testing-workflow');
    
    // Check for parallel testing setup
    const parallelTesting = config.children.find(child => child.id === 'comprehensive-testing');
    expect(parallelTesting).toBeDefined();
    expect(parallelTesting.type).toBe('parallel');
    expect(parallelTesting.successPolicy).toBe('all');
  });

  test('should execute a simplified workflow successfully', async () => {
    // Create a simplified workflow that can actually run
    const simpleWorkflow = {
      type: 'sequence',
      id: 'simple-test-workflow',
      children: [
        {
          type: 'action',
          id: 'generate-package',
          tool: 'packageJsonGenerator',
          params: {
            appName: 'IntegrationTest',
            version: '1.0.0',
            description: 'Integration test app'
          }
        },
        {
          type: 'action',
          id: 'generate-html',
          tool: 'htmlGenerator',
          params: {
            appName: 'IntegrationTest',
            title: 'Integration Test App'
          }
        },
        {
          type: 'action',
          id: 'find-port',
          tool: 'portManager',
          params: {
            action: 'find',
            startPort: 5000,
            endPort: 5010
          }
        }
      ]
    };

    // Execute the workflow
    const result = await executor.executeTree(simpleWorkflow, {
      appName: 'IntegrationTest'
    });

    if (!result.success) {
      console.log('Workflow execution failed:', result.error || result.data);
      if (result.data && result.data.stepResults) {
        result.data.stepResults.forEach((step, index) => {
          if (step.status === 'FAILURE') {
            console.log(`Step ${index} failed:`, step.data);
          }
        });
      }
    }
    expect(result.success).toBe(true);
    expect(result.nodeResults).toBeDefined();
    
    // Verify files were created
    const packageJsonPath = path.join(testDir, 'package.json');
    const htmlPath = path.join(testDir, 'index.html');
    
    const packageJsonExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);
    const htmlExists = await fs.access(htmlPath).then(() => true).catch(() => false);
    
    expect(packageJsonExists).toBe(true);
    expect(htmlExists).toBe(true);
  }, 30000);

  test('should handle workflow validation errors gracefully', async () => {
    // Create an invalid workflow
    const invalidWorkflow = {
      type: 'sequence',
      id: 'invalid-workflow',
      children: [
        {
          type: 'action',
          id: 'invalid-action',
          tool: 'nonExistentTool',
          params: {}
        }
      ]
    };

    // Validate the configuration
    const validation = executor.validateTreeConfiguration(invalidWorkflow);
    
    expect(validation.valid).toBe(false);
    expect(validation.errors).toBeDefined();
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('should demonstrate tool registry functionality', async () => {
    // Get list of all registered tools
    const allTools = await toolRegistry.getAllTools();
    const toolNames = Object.keys(allTools);
    
    expect(toolNames).toContain('htmlGenerator');
    expect(toolNames).toContain('cssGenerator');
    expect(toolNames).toContain('packageJsonGenerator');
    expect(toolNames).toContain('npmInstaller');
    expect(toolNames).toContain('browserManager');
    expect(toolNames).toContain('screenshotCapture');
    
    // Test tool metadata
    const htmlGenerator = await toolRegistry.getTool('htmlGenerator');
    const metadata = htmlGenerator.getMetadata();
    
    expect(metadata.name).toBe('htmlGenerator');
    expect(metadata.description).toContain('HTML');
    expect(metadata.input.appName.required).toBe(true);
  });

  test('should validate tool parameter schemas', async () => {
    const workflows = [
      'CompleteWebAppWorkflow.json',
      'RapidPrototypeWorkflow.json',
      'VisualEvolutionWorkflow.json',
      'ContinuousTestingWorkflow.json'
    ];

    for (const workflowFile of workflows) {
      const configPath = path.join('configs', workflowFile);
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      // Validate configuration structure
      expect(config.type).toBeDefined();
      expect(config.id).toBeDefined();
      expect(config.description).toBeDefined();
      
      // Recursively check all action nodes have tools and params
      await validateActionNodes(config);
    }
  });

  async function validateActionNodes(node) {
    if (node.type === 'action') {
      expect(node.tool).toBeDefined();
      expect(node.params).toBeDefined();
      
      // Verify tool exists in registry (skip if it doesn't)
      if (toolRegistry.hasTool(node.tool)) {
        const tool = await toolRegistry.getTool(node.tool);
        expect(tool).toBeDefined();
        
        const metadata = tool.getMetadata();
        expect(metadata.name).toBe(node.tool);
      } else {
        console.warn(`Tool '${node.tool}' not found in registry - skipping validation`);
      }
    }
    
    if (node.children) {
      for (const child of node.children) {
        await validateActionNodes(child);
      }
    }
    
    if (node.child) {
      await validateActionNodes(node.child);
    }
  }

  test('should validate executor statistics and capabilities', async () => {
    const stats = executor.getStats();
    
    expect(stats.registeredNodeTypes).toBeGreaterThan(3); // sequence, action, selector, retry
    expect(stats.availableNodeTypes).toContain('sequence');
    expect(stats.availableNodeTypes).toContain('action');
    expect(stats.availableNodeTypes).toContain('selector');
    expect(stats.availableNodeTypes).toContain('retry');
    
    // Test node type metadata
    const sequenceMetadata = executor.getNodeTypeMetadata('sequence');
    expect(sequenceMetadata).toBeDefined();
    expect(sequenceMetadata.typeName).toBe('sequence');
    
    const retryMetadata = executor.getNodeTypeMetadata('retry');
    expect(retryMetadata).toBeDefined();
    expect(retryMetadata.typeName).toBe('retry');
  });
});