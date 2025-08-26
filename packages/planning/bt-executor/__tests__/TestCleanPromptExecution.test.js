/**
 * Test that the clean prompt generates an executable plan
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

describe('Clean Prompt Execution Test', () => {
  let planner;
  let executor;
  let validator;
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
    const FileModule = (await import('@legion/tools-collection/src/file/index.js')).default;
    const fileModule = await FileModule.create();
    
    const NodeRunnerModule = (await import('@legion/node-runner')).default;
    const nodeModule = new NodeRunnerModule();
    await nodeModule.initialize();
    
    // Get the actual tools from registry
    const tools = [
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
    executor.setToolRegistry(toolRegistry);
  });

  afterAll(async () => {
    // Cleanup any hanging processes
    try {
      await toolRegistry.cleanup();
    } catch (e) {
      // Ignore cleanup errors
    }
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
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  test('should generate, validate, and execute hello world program', async () => {
    console.log('\n=== Full Execution Test with Clean Prompt ===\n');
    
    const goal = "please write a simple hello world program in javascript";
    
    // Get the actual tools from registry
    const tools = [
      toolRegistry.getTool('file_writer'),
      toolRegistry.getTool('run_node')
    ];
    
    // Step 1: Generate plan
    console.log('Step 1: Generating plan...');
    const planResult = await planner.makePlan(goal, tools, {
      maxAttempts: 1,
      saveDebugFiles: true
    });
    
    expect(planResult.success).toBe(true);
    const plan = planResult.data.plan;
    console.log('Generated plan:', JSON.stringify(plan, null, 2));
    
    // Step 2: Validate plan
    console.log('\nStep 2: Validating plan...');
    const validation = await validator.validate(plan, tools);
    
    if (!validation.valid) {
      console.log('Validation errors:');
      validation.errors.forEach(err => {
        console.log(`  - ${err.type}: ${err.message}`);
        if (err.details) {
          console.log(`    Details:`, err.details);
        }
      });
    }
    
    expect(validation.valid).toBe(true);
    console.log('✅ Plan validation passed');
    
    // Step 3: Enrich plan with tool IDs
    console.log('\nStep 3: Enriching plan with tool IDs...');
    const enriched = await validator.enrichPlan(plan, tools);
    expect(enriched.success).toBe(true);
    console.log('✅ Plan enriched successfully');
    
    // Step 4: Execute plan
    console.log('\nStep 4: Executing plan...');
    console.log('Current directory:', process.cwd());
    
    const executionResult = await executor.execute(enriched.plan);
    
    console.log('\nExecution result:');
    console.log('Success:', executionResult.success);
    console.log('Message:', executionResult.message);
    
    if (!executionResult.success && executionResult.error) {
      console.log('Error:', executionResult.error);
    }
    
    if (executionResult.artifacts) {
      console.log('\nArtifacts created:');
      Object.entries(executionResult.artifacts).forEach(([key, value]) => {
        console.log(`  ${key}:`, typeof value === 'string' && value.length > 100 
          ? value.substring(0, 100) + '...' 
          : value);
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
    expect(content.toLowerCase()).toContain('hello');
    
    console.log('\n✅ All steps completed successfully!');
    console.log('- Plan generated with clean prompt');
    console.log('- Plan validated');
    console.log('- Plan enriched');
    console.log('- Plan executed');
    console.log('- File created at:', helloFile);
    console.log('- File content:', content);
    console.log('- Program ran successfully');
  }, 300000); // 5 minute timeout
});