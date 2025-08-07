/**
 * End-to-end test for Planner with validation and fixing using live LLM
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { createLLMProvider } from '../../src/factories/AgentFactory.js';
import { LLMPlanningStrategy } from '../../src/core/execution/planning/strategies/index.js';
import { Planner } from '../../src/core/planning/Planner.js';
import { PlanValidator } from '../../src/core/planning/validation/PlanValidator.js';
import { SchemaValidator } from '../../src/core/planning/validation/SchemaValidator.js';
import { PlanStep } from '../../src/foundation/types/interfaces/interfaces.js';
import { config } from '../../src/runtime/config/index.js';

const skipTests = !config.getAvailableLLMProviders().length;

describe('Planner Validation with Live LLM', () => {
  let llmProvider = null;
  let planner;
  let tools;

  beforeAll(() => {
    if (skipTests) {
      console.log('⚠️  Skipping Planner validation tests - no API keys configured');
      return;
    }
    
    console.log('🎯 Testing Planner validation and fixing with live LLM...');
    console.log(`   Using provider: ${config.get('llm.provider')}`);
    
    llmProvider = createLLMProvider();
  });

  beforeEach(() => {
    if (skipTests) return;
    // Create tools with specific parameter names to test validation
    tools = [
      {
        name: 'createTextFile',
        description: 'Create a text file with content',
        getMetadata: () => ({
          name: 'createTextFile',
          description: 'Create a text file with content',
          input: { 
            filePath: 'string',      // Note: NOT 'path' or 'filename'
            textContent: 'string',   // Note: NOT 'content' or 'data'
            encoding: 'string?'
          },
          output: { 
            savedPath: 'string',     // Note: NOT 'path'
            bytesWritten: 'number'
          }
        })
      },
      {
        name: 'readTextFile',
        description: 'Read content from a text file',
        getMetadata: () => ({
          name: 'readTextFile',
          description: 'Read content from a text file',
          input: { 
            filePath: 'string'       // Note: NOT 'path'
          },
          output: { 
            fileContent: 'string',   // Note: NOT 'content'
            filePath: 'string'
          }
        })
      },
      {
        name: 'appendToFile',
        description: 'Append content to an existing file',
        getMetadata: () => ({
          name: 'appendToFile',
          description: 'Append content to an existing file',
          input: { 
            targetFile: 'string',    // Note: NOT 'path' or 'file'
            additionalContent: 'string' // Note: NOT 'content'
          },
          output: { 
            updatedPath: 'string',
            totalSize: 'number'
          }
        })
      }
    ];

    // Create validator with strict checking
    const schemaValidator = new SchemaValidator({
      strictTypes: true,
      allowExtraProperties: false
    });
    
    const validator = new PlanValidator({
      schemaValidator,
      strictMode: true,
      validateArtifacts: true,
      debugMode: true
    });

    // Create planner
    const strategy = new LLMPlanningStrategy(llmProvider, {
      maxRetries: 2
    });
    
    planner = new Planner(strategy, validator, {
      maxAttempts: 3,
      debugMode: true
    });
  });

  (skipTests ? test.skip : test)('should generate a valid plan on first attempt', async () => {
    console.log('\n📝 Testing valid plan generation...');
    
    // Simple goal that should work
    const goal = 'Create a text file called test.txt with the content "Hello World"';

    const plan = await planner.createPlan(goal, tools);

    expect(plan).toBeDefined();
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].tool).toBe('createTextFile');
    
    console.log(`✅ Generated valid plan with ${plan.length} steps`);
    console.log(`   First step: ${plan[0].description}`);
    console.log(`   Parameters: ${JSON.stringify(plan[0].params)}`);
    
    // Verify the parameters are correct
    expect(plan[0].params.filePath).toBeDefined();
    expect(plan[0].params.textContent).toBeDefined();
  }, 60000);

  (skipTests ? test.skip : test)('should fix an invalid plan using fixPlan', async () => {
    console.log('\n🔧 Testing plan fixing...');
    
    // Create an invalid plan with common mistakes
    const invalidPlan = [
      new PlanStep('step1', 'Create a file', 'createTextFile',
        { 
          path: 'test.txt',        // WRONG: should be 'filePath'
          content: 'Hello World'   // WRONG: should be 'textContent'
        }, 
        []
      ),
      new PlanStep('step2', 'Read the file', 'readTextFile',
        { 
          file: '@testFile'        // WRONG: should be 'filePath' and artifact doesn't exist
        }, 
        ['step1']
      ),
      new PlanStep('step3', 'Append to file', 'appendToFile',
        { 
          path: 'test.txt',        // WRONG: should be 'targetFile'
          content: 'More text'     // WRONG: should be 'additionalContent'
        }, 
        ['step2']
      )
    ];

    console.log('   Invalid plan has:');
    console.log('   - Wrong parameter names (path instead of filePath)');
    console.log('   - Wrong parameter names (content instead of textContent)');
    console.log('   - Invalid artifact reference (@testFile)');

    // Validate to get errors
    const validation = await planner.validatePlan(invalidPlan, tools);
    
    expect(validation.valid).toBe(false);
    console.log(`   Found ${validation.errors.length} validation errors`);
    
    // Fix the plan
    const fixedPlan = await planner.fixPlan(
      'Create a file, read it, and append to it',
      invalidPlan,
      validation.errors,
      tools
    );

    expect(fixedPlan).toBeDefined();
    expect(fixedPlan.length).toBeGreaterThan(0);
    
    // Validate the fixed plan
    const fixedValidation = await planner.validatePlan(fixedPlan, tools);
    
    expect(fixedValidation.valid).toBe(true);
    expect(fixedValidation.errors).toHaveLength(0);
    
    console.log(`✅ Fixed plan is valid with ${fixedPlan.length} steps`);
    console.log(`   Step 1 params: ${JSON.stringify(fixedPlan[0].params)}`);
    
    // Check that parameters were corrected
    expect(fixedPlan[0].params.filePath).toBeDefined();
    expect(fixedPlan[0].params.textContent).toBeDefined();
    expect(fixedPlan[0].params.path).toBeUndefined(); // Old param should be gone
    expect(fixedPlan[0].params.content).toBeUndefined(); // Old param should be gone
  }, 90000);

  (skipTests ? test.skip : test)('should handle artifact validation and fixing', async () => {
    console.log('\n🔗 Testing artifact validation and fixing...');
    
    // Create a plan with artifact issues
    const invalidPlan = [
      new PlanStep('create', 'Create file', 'createTextFile',
        { filePath: 'data.txt', textContent: 'Data' },
        [],
        { wrongField: { name: 'dataFile', description: 'Data file' } } // Wrong output field
      ),
      new PlanStep('read', 'Read file', 'readTextFile',
        { filePath: '@nonExistent' }, // Reference to non-existent artifact
        ['create']
      ),
      new PlanStep('append', 'Append to file', 'appendToFile',
        { targetFile: '@dataFile', additionalContent: 'More' }, // This would fail if dataFile wasn't saved properly
        ['read']
      )
    ];

    console.log('   Invalid plan has:');
    console.log('   - saveOutputs with wrong field name');
    console.log('   - Reference to non-existent artifact');

    const validation = await planner.validatePlan(invalidPlan, tools);
    
    expect(validation.valid).toBe(false);
    
    const errors = validation.errors.filter(e => 
      e.type === 'INVALID_OUTPUT_FIELD' || e.type === 'ARTIFACT_NOT_FOUND'
    );
    expect(errors.length).toBeGreaterThan(0);
    
    console.log(`   Found artifact-related errors: ${errors.map(e => e.type).join(', ')}`);

    // Fix the plan
    const fixedPlan = await planner.fixPlan(
      'Create a file and process it with proper artifact tracking',
      invalidPlan,
      validation.errors,
      tools
    );

    const fixedValidation = await planner.validatePlan(fixedPlan, tools);
    
    expect(fixedValidation.valid).toBe(true);
    
    console.log('✅ Fixed plan with proper artifact handling');
    
    // Check if artifacts are properly saved and referenced
    if (fixedPlan[0].saveOutputs) {
      console.log(`   Step 1 saves: ${Object.keys(fixedPlan[0].saveOutputs).join(', ')}`);
      expect(fixedPlan[0].saveOutputs.savedPath).toBeDefined(); // Correct output field
    }
  }, 90000);

  (skipTests ? test.skip : test)('should demonstrate retry loop through createPlan', async () => {
    console.log('\n🔄 Testing retry loop in createPlan...');
    
    // Goal that might cause the LLM to use wrong parameter names
    const goal = `Create a file named "report.txt" with some content, 
                  then read it back, and finally append additional text to it.
                  Track the file path as an artifact for reuse.`;

    console.log('   This goal may cause LLM to use common parameter names like "path" and "content"');
    console.log('   The validator will catch these and trigger retries with feedback');

    const startTime = Date.now();
    const plan = await planner.createPlan(goal, tools);
    const elapsed = Date.now() - startTime;

    expect(plan).toBeDefined();
    expect(plan.length).toBeGreaterThanOrEqual(2);
    
    // Validate the final plan
    const validation = await planner.validatePlan(plan, tools);
    expect(validation.valid).toBe(true);
    
    console.log(`✅ Created valid plan in ${elapsed}ms`);
    console.log(`   Final plan has ${plan.length} steps`);
    console.log(`   All parameters use correct names (filePath, textContent, etc.)`);
    
    // Check for artifacts if any
    const stepsWithArtifacts = plan.filter(s => s.saveOutputs);
    if (stepsWithArtifacts.length > 0) {
      console.log(`   ${stepsWithArtifacts.length} steps save artifacts for reuse`);
    }
  }, 120000);
});

// Summary
afterAll(() => {
  if (!skipTests) {
    const provider = createLLMProvider();
    const usage = provider.getTokenUsage();
    console.log('\n📊 Planner Validation Test Summary:');
    console.log(`   Total tokens used: ${usage.total}`);
    console.log(`   Tests demonstrated:`);
    console.log('   • Planner generates valid plans with correct parameters');
    console.log('   • fixPlan corrects parameter name errors');
    console.log('   • Artifact validation and correction works');
    console.log('   • Retry loop handles validation failures automatically');
    console.log('   • All validation happens before tool execution');
  }
});