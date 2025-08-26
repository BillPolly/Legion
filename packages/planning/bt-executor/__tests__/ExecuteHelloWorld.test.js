/**
 * Test that executes the hello world plan end-to-end
 */

import { Planner } from '@legion/planner';
import { LLMClient } from '@legion/llm';
import { DebugBehaviorTreeExecutor } from '../src/DebugBehaviorTreeExecutor.js';
import { BTValidator } from '@legion/bt-validator';
import toolRegistry from '@legion/tools-registry';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs/promises';

// Load environment variables from monorepo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '../../../../.env');
dotenv.config({ path: rootPath });

describe('Execute Hello World End-to-End', () => {
  let planner;
  let executor;
  let validator;
  let tools;
  let testDir;

  beforeAll(async () => {
    // Initialize real LLM client
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found');
    }

    const llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-5-sonnet-20241022'
    });

    // Register necessary modules
    const { FileModule } = await import('@legion/tools-collection/src/file/index.js');
    const fileModule = await FileModule.create();
    
    const NodeRunnerModule = (await import('@legion/node-runner')).default;
    const nodeModule = new NodeRunnerModule();
    await nodeModule.initialize();
    
    // Get the tools
    tools = [
      toolRegistry.getTool('file_writer'),
      toolRegistry.getTool('run_node')
    ];

    // Create planner
    planner = new Planner({
      llmClient: llmClient,
      tools: tools
    });

    // Create validator and executor
    validator = new BTValidator({
      strictMode: true,
      validateTools: true,
      applyDefaults: true
    });

    executor = new DebugBehaviorTreeExecutor();
  });

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(__dirname, 'test-output', `hello-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Clean up
    process.chdir(__dirname);
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('should generate, validate, and execute hello world program', async () => {
    console.log('\n=== Full Hello World Test ===\n');
    
    const goal = "please write a simple hello world program in javascript";
    
    // Step 1: Generate plan
    console.log('Step 1: Generating plan...');
    const planResult = await planner.makePlan(goal, tools);
    
    expect(planResult.success).toBe(true);
    expect(planResult.data).toBeDefined();
    expect(planResult.data.plan).toBeDefined();
    
    const plan = planResult.data.plan;
    console.log('Generated plan successfully');
    
    // Step 2: Validate plan
    console.log('\nStep 2: Validating plan...');
    const validation = await validator.validate(plan, tools);
    expect(validation.valid).toBe(true);
    console.log('Plan validation passed');
    
    // Step 3: Enrich plan with tool IDs
    console.log('\nStep 3: Enriching plan with tool IDs...');
    const enriched = await validator.enrichPlan(plan, tools);
    expect(enriched.success).toBe(true);
    console.log('Plan enriched successfully');
    
    // Step 4: Execute plan
    console.log('\nStep 4: Executing plan...');
    executor.setToolRegistry(toolRegistry);
    const executionResult = await executor.execute(enriched.plan);
    
    console.log('\nExecution result:');
    console.log('Success:', executionResult.success);
    console.log('Message:', executionResult.message);
    
    if (executionResult.artifacts) {
      console.log('\nArtifacts created:');
      Object.entries(executionResult.artifacts).forEach(([key, value]) => {
        console.log(`  ${key}:`, value);
      });
    }
    
    expect(executionResult.success).toBe(true);
    
    // Verify the file was created
    const helloFile = path.join(testDir, 'hello.js');
    const fileExists = await fs.access(helloFile).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
    
    // Verify file content
    const content = await fs.readFile(helloFile, 'utf-8');
    expect(content).toContain('console.log');
    expect(content).toContain('Hello');
    
    console.log('\n✅ All steps completed successfully!');
    console.log('- Plan generated');
    console.log('- Plan validated');
    console.log('- Plan enriched');
    console.log('- Plan executed');
    console.log('- File created');
    console.log('- Program ran successfully');
  }, 60000);
});