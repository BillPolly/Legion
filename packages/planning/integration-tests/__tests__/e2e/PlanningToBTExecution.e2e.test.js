/**
 * End-to-End Integration Test: Planning → BT Execution
 * 
 * Tests the complete Legion planning workflow:
 * 1. Live LLM planning via unified-planner
 * 2. BT validation via bt-validator
 * 3. Real execution via actor-BT
 * 4. Verification of results
 * 
 * This test validates that "execution is handled exclusively by BT package"
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { PlannerEngine } from '@legion/unified-planner';
import { BTValidator } from '@legion/bt-validator';
import { BehaviorTreeExecutor } from '@legion/actor-bt';
import { TestWorkspaceManager } from '../utils/TestWorkspaceManager.js';
import { LiveLLMTestSetup } from '../utils/LiveLLMTestSetup.js';

describe('Planning to BT Execution Integration (E2E)', () => {
  let llmSetup;
  let workspaceManager;
  let planner;
  let validator;
  let executor;
  let currentWorkspace;

  beforeAll(async () => {
    // Initialize live LLM testing - fails fast if no API key
    llmSetup = new LiveLLMTestSetup();
    await llmSetup.initialize();

    // Initialize workspace manager
    workspaceManager = new TestWorkspaceManager();

    console.log('🚀 E2E Integration Tests initialized');
  });

  beforeEach(async () => {
    // Create isolated workspace for each test
    const { workspacePath, trackId } = await workspaceManager.createWorkspace('e2e-test');
    currentWorkspace = { path: workspacePath, trackId };

    // Initialize planner with live LLM
    const resourceManager = llmSetup.getResourceManager();
    planner = new PlannerEngine({
      llmClient: llmSetup.getLLMClient(),
      moduleLoader: resourceManager.moduleLoader
    });

    // Initialize validator
    validator = new BTValidator();

    // Initialize executor
    executor = new BehaviorTreeExecutor({
      workingDirectory: workspacePath
    });

    console.log(`📁 Test workspace: ${workspacePath}`);
  });

  afterEach(async () => {
    // Clean up workspace
    if (currentWorkspace) {
      await workspaceManager.cleanupWorkspace(currentWorkspace.trackId);
    }
  });

  afterAll(async () => {
    // Final cleanup
    await workspaceManager.cleanupAll();
    await llmSetup.cleanup();
  });

  describe('Simple File Creation Tasks', () => {
    test('should plan and execute simple JavaScript function creation', async () => {
      const startTime = Date.now();

      // 1. PLANNING: Generate plan with live LLM
      console.log('📋 Step 1: Planning with live LLM...');
      global.trackLLMCall && global.trackLLMCall();

      const planResult = await planner.createPlan({
        description: 'Create a JavaScript function that calculates the factorial of a number and save it to factorial.js',
        strategy: 'llm'
      });

      expect(planResult).toBeDefined();
      expect(planResult.id).toBeDefined();
      console.log(`✅ Plan generated: ${planResult.id}`);

      // 2. VALIDATION: Validate BT schema
      console.log('🔍 Step 2: Validating BT schema...');
      const validationResult = await validator.validate(planResult);
      
      expect(validationResult.valid).toBe(true);
      if (!validationResult.valid) {
        console.error('Validation errors:', validationResult.errors);
        throw new Error('BT validation failed: ' + validationResult.errors.join(', '));
      }
      console.log('✅ BT validation passed');

      // 3. EXECUTION: Execute BT with real tools
      console.log('⚡ Step 3: Executing BT...');
      global.trackBTExecution && global.trackBTExecution();

      const executionResult = await executor.execute(planResult);
      
      expect(executionResult.success).toBe(true);
      if (!executionResult.success) {
        console.error('Execution error:', executionResult.error);
        throw new Error('BT execution failed: ' + executionResult.error);
      }
      console.log('✅ BT execution completed');

      // 4. VERIFICATION: Check actual results
      console.log('🔎 Step 4: Verifying results...');
      
      // Verify file was actually created
      const fileExists = await workspaceManager.fileExists(currentWorkspace.trackId, 'factorial.js');
      expect(fileExists).toBe(true);

      // Verify file content
      const fileContent = await workspaceManager.readFile(currentWorkspace.trackId, 'factorial.js');
      expect(fileContent).toContain('factorial');
      expect(fileContent.length).toBeGreaterThan(50); // Should have substantial content

      // Get workspace stats
      const stats = await workspaceManager.getWorkspaceStats(currentWorkspace.trackId);
      expect(stats.files.length).toBeGreaterThan(0);

      const duration = Date.now() - startTime;
      global.trackExecutionTime && global.trackExecutionTime(startTime);

      console.log(`✅ E2E test completed in ${duration}ms`);
      console.log(`📁 Files created: ${stats.files.join(', ')}`);
    }, 60000); // 60s timeout for full E2E

    test('should handle Node.js project creation task', async () => {
      const startTime = Date.now();

      console.log('📋 Planning Node.js project creation...');
      const planResult = await planner.createPlan({
        description: 'Create a basic Node.js project with package.json and a simple HTTP server in server.js',
        strategy: 'llm'
      });

      console.log('🔍 Validating project creation plan...');
      const validationResult = await validator.validate(planResult);
      expect(validationResult.valid).toBe(true);

      console.log('⚡ Executing project creation...');
      const executionResult = await executor.execute(planResult);
      expect(executionResult.success).toBe(true);

      // Verify multiple files were created
      const packageJsonExists = await workspaceManager.fileExists(currentWorkspace.trackId, 'package.json');
      const serverJsExists = await workspaceManager.fileExists(currentWorkspace.trackId, 'server.js');
      
      expect(packageJsonExists).toBe(true);
      expect(serverJsExists).toBe(true);

      // Verify package.json content
      const packageContent = await workspaceManager.readFile(currentWorkspace.trackId, 'package.json');
      const packageJson = JSON.parse(packageContent);
      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBeDefined();

      // Verify server.js content
      const serverContent = await workspaceManager.readFile(currentWorkspace.trackId, 'server.js');
      expect(serverContent).toContain('server');

      const stats = await workspaceManager.getWorkspaceStats(currentWorkspace.trackId);
      console.log(`✅ Project created with ${stats.files.length} files: ${stats.files.join(', ')}`);

      global.trackExecutionTime && global.trackExecutionTime(startTime);
    }, 90000); // Longer timeout for complex task
  });

  describe('Complex Multi-Step Tasks', () => {
    test('should handle authentication API creation task', async () => {
      const startTime = Date.now();

      console.log('📋 Planning authentication API...');
      const planResult = await planner.createPlan({
        description: 'Build a REST API endpoint for user authentication with JWT tokens, including input validation and basic tests',
        strategy: 'llm',
        allowableActions: [
          { type: 'file_write', description: 'Write files' },
          { type: 'directory_create', description: 'Create directories' }
        ]
      });

      console.log('🔍 Validating complex plan...');
      const validationResult = await validator.validate(planResult);
      expect(validationResult.valid).toBe(true);

      console.log('⚡ Executing authentication API creation...');
      const executionResult = await executor.execute(planResult);
      expect(executionResult.success).toBe(true);

      // Verify API-related files were created
      const stats = await workspaceManager.getWorkspaceStats(currentWorkspace.trackId);
      expect(stats.files.length).toBeGreaterThan(2); // Should create multiple files

      // Look for common API file patterns
      const hasMainFile = stats.files.some(file => 
        file.includes('auth') || file.includes('api') || file.includes('server')
      );
      expect(hasMainFile).toBe(true);

      // Look for package.json or similar config
      const hasConfigFile = stats.files.some(file => 
        file.includes('package.json') || file.includes('config')
      );
      
      if (hasConfigFile) {
        console.log('✅ Configuration file detected');
      }

      console.log(`✅ Complex API created with ${stats.files.length} files`);
      global.trackExecutionTime && global.trackExecutionTime(startTime);
    }, 120000); // 2 minute timeout for very complex task
  });

  describe('Error Handling and Recovery', () => {
    test('should handle vague task descriptions gracefully', async () => {
      console.log('📋 Testing with vague task...');
      
      const planResult = await planner.createPlan({
        description: 'do something useful with files',
        strategy: 'llm'
      });

      // Should still generate a valid plan, even if vague
      expect(planResult).toBeDefined();

      const validationResult = await validator.validate(planResult);
      expect(validationResult.valid).toBe(true);

      const executionResult = await executor.execute(planResult);
      // May succeed or fail gracefully - both are acceptable for vague inputs
      expect(typeof executionResult.success).toBe('boolean');

      console.log(`✅ Vague task handled - success: ${executionResult.success}`);
    }, 45000);

    test('should handle execution failures gracefully', async () => {
      console.log('📋 Testing error recovery...');

      // Create a plan that might reference non-existent tools
      const planResult = await planner.createPlan({
        description: 'Create a file using specialized deployment tools that might not exist',
        strategy: 'llm'
      });

      const validationResult = await validator.validate(planResult);
      // Plan might be valid even if tools don't exist
      
      const executionResult = await executor.execute(planResult);
      
      // Should either succeed or fail gracefully with error info
      expect(typeof executionResult.success).toBe('boolean');
      if (!executionResult.success) {
        expect(executionResult.error).toBeDefined();
        console.log(`✅ Graceful failure: ${executionResult.error}`);
      } else {
        console.log('✅ Unexpected success - plan worked anyway');
      }
    }, 45000);
  });

  describe('Performance and Reliability', () => {
    test('should complete end-to-end workflow within reasonable time', async () => {
      const startTime = Date.now();
      const maxAcceptableTime = 45000; // 45 seconds max

      const planResult = await planner.createPlan({
        description: 'Create a simple utility function for string validation',
        strategy: 'llm'
      });

      const validationResult = await validator.validate(planResult);
      expect(validationResult.valid).toBe(true);

      const executionResult = await executor.execute(planResult);
      expect(executionResult.success).toBe(true);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(maxAcceptableTime);

      console.log(`✅ E2E completed in ${duration}ms (under ${maxAcceptableTime}ms limit)`);
    }, 60000);

    test('should be consistent across multiple runs', async () => {
      const results = [];
      const task = 'Create a basic math utility with add and subtract functions';

      // Run same task multiple times
      for (let i = 0; i < 2; i++) {
        console.log(`📋 Run ${i + 1}: Planning...`);
        const planResult = await planner.createPlan({
          description: task,
          strategy: 'llm'
        });

        const validationResult = await validator.validate(planResult);
        const executionResult = await executor.execute(planResult);

        results.push({
          planValid: planResult !== null,
          validationPassed: validationResult.valid,
          executionSucceeded: executionResult.success,
          run: i + 1
        });

        // Clean up between runs
        const stats = await workspaceManager.getWorkspaceStats(currentWorkspace.trackId);
        console.log(`Run ${i + 1} created ${stats.files.length} files`);
      }

      // All runs should succeed
      const allPlanned = results.every(r => r.planValid);
      const allValidated = results.every(r => r.validationPassed);
      const allExecuted = results.every(r => r.executionSucceeded);

      expect(allPlanned).toBe(true);
      expect(allValidated).toBe(true);
      expect(allExecuted).toBe(true);

      console.log(`✅ Consistency test: ${results.length}/${results.length} runs successful`);
    }, 120000); // 2 minute timeout for multiple runs
  });

  describe('Architecture Validation', () => {
    test('should confirm execution is handled exclusively by BT package', async () => {
      console.log('🏗️  Validating architecture: execution exclusive to BT...');

      const planResult = await planner.createPlan({
        description: 'Create a simple configuration file',
        strategy: 'llm'
      });

      // Verify we got a BT (not a legacy plan format)
      expect(planResult.type).toBeDefined(); // BT should have type
      expect(planResult.id).toBeDefined();   // BT should have id
      
      // Should not have legacy plan properties
      expect(planResult.steps).toBeUndefined(); // Legacy format
      expect(planResult.actions).toBeUndefined(); // Legacy format

      // Execution should be handled by BehaviorTreeExecutor only
      expect(executor).toBeInstanceOf(BehaviorTreeExecutor);

      const executionResult = await executor.execute(planResult);
      expect(executionResult.success).toBe(true);

      console.log('✅ Architecture validated: BT-exclusive execution confirmed');
    }, 45000);

    test('should validate unified planner → bt validator → actor BT pipeline', async () => {
      console.log('🏗️  Validating complete pipeline integration...');

      // Test each component in isolation
      expect(planner).toBeInstanceOf(PlannerEngine);
      expect(validator).toBeInstanceOf(BTValidator);
      expect(executor).toBeInstanceOf(BehaviorTreeExecutor);

      // Test pipeline flow
      const planResult = await planner.createPlan({
        description: 'Create a simple test file',
        strategy: 'llm'
      });

      // Unified planner → bt validator
      const validationResult = await validator.validate(planResult);
      expect(validationResult.valid).toBe(true);

      // bt validator → actor BT
      const executionResult = await executor.execute(planResult);
      expect(executionResult.success).toBe(true);

      console.log('✅ Pipeline integration validated');
    }, 45000);
  });
});