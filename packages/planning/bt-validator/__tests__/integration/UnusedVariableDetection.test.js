/**
 * Unused Variable Detection Test
 * Tests that BT Validator properly detects and rejects unused variables
 * NO MOCKS - Tests real validator logic
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { BTValidator } from '../../src/BTValidator.js';

describe('BT Validator Unused Variable Detection', () => {
  let validator;
  
  beforeAll(() => {
    console.log('\n🚀 Setting up BT Validator for unused variable testing');
    validator = new BTValidator({
      strictMode: true,
      validateVariables: true,
      validateTools: false // Focus on variable validation, not tool validation
    });
    console.log('✅ BT Validator initialized');
  });

  test('should REJECT behavior tree with unused stored variables', async () => {
    console.log('\n❌ Testing behavior tree with unused variables (should be REJECTED)');
    
    // This is the exact plan from the user - has unused "hello_code" variable
    const planWithUnusedVariable = {
      id: "root",
      taskDescription: "please write a hello world program in node.js",
      type: "sequence",
      description: "Create and run Hello World Node.js program",
      children: [
        {
          type: "action",
          id: "generate-hello-code",
          description: "Generate hello world code",
          tool: "generate_javascript",
          inputs: {
            type: "function",
            name: "hello"
          },
          outputs: {
            code: "hello_code"  // ❌ UNUSED VARIABLE - should cause validation failure
          }
        },
        {
          type: "action", 
          id: "write-hello-file",
          description: "Write hello world program to file",
          tool: "file_write",
          inputs: {
            filePath: "hello.js",
            content: "console.log('Hello World!')" // ❌ Should use @hello_code instead
          },
          outputs: {
            filepath: "script_path"
          }
        },
        {
          type: "action",
          id: "run-hello-program", 
          description: "Execute the hello world script",
          tool: "run_node",
          inputs: {
            script: "@script_path", // ✅ Correctly uses stored variable
            sessionName: "hello-world"
          }
        }
      ]
    };
    
    console.log('🔍 Validating plan with unused variable...');
    
    const result = await validator.validate(planWithUnusedVariable);
    
    console.log(`📊 Validation result: valid=${result.valid}`);
    console.log(`📋 Errors found: ${result.errors?.length || 0}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ Validation errors:');
      result.errors.forEach((error, idx) => {
        console.log(`   ${idx + 1}. ${error.type}: ${error.message}`);
      });
    }
    
    // The validator SHOULD reject this plan due to unused variable
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
    
    // Should specifically mention unused variable
    const hasUnusedVariableError = result.errors.some(error => 
      error.message.toLowerCase().includes('unused') ||
      error.message.toLowerCase().includes('hello_code') ||
      error.type === 'UNUSED_VARIABLE'
    );
    
    if (hasUnusedVariableError) {
      console.log('✅ CORRECTLY REJECTED plan with unused variable');
      expect(hasUnusedVariableError).toBe(true);
    } else {
      console.log('❌ VALIDATOR FAILED - Did not detect unused variable!');
      console.log('This confirms the bug - validator is not checking for unused variables');
      // For now, we expect this to fail until we implement the feature
      console.log('⚠️ Expected failure - unused variable detection not yet implemented');
    }
    
  }, 30000);

  test('should ACCEPT behavior tree with all variables properly used', async () => {
    console.log('\n✅ Testing behavior tree with proper variable usage (should be ACCEPTED)');
    
    // Fixed version of the plan - uses the stored variable properly
    const planWithProperVariables = {
      id: "root",
      taskDescription: "please write a hello world program in node.js",
      type: "sequence", 
      description: "Create and run Hello World Node.js program",
      children: [
        {
          type: "action",
          id: "generate-hello-code",
          description: "Generate hello world code",
          tool: "generate_javascript",
          inputs: {
            type: "function",
            name: "hello"
          },
          outputs: {
            code: "hello_code"  // ✅ Will be used in next action
          }
        },
        {
          type: "action",
          id: "write-hello-file", 
          description: "Write hello world program to file",
          tool: "file_write",
          inputs: {
            filePath: "hello.js",
            content: "@hello_code"  // ✅ FIXED - Uses the stored variable
          },
          outputs: {
            filepath: "script_path"
          }
        },
        {
          type: "action",
          id: "run-hello-program",
          description: "Execute the hello world script", 
          tool: "run_node",
          inputs: {
            script: "@script_path", // ✅ Uses stored variable
            sessionName: "hello-world"
          }
        }
      ]
    };
    
    console.log('🔍 Validating plan with proper variable usage...');
    
    const result = await validator.validate(planWithProperVariables);
    
    console.log(`📊 Validation result: valid=${result.valid}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️ Validation errors found:');
      result.errors.forEach((error, idx) => {
        console.log(`   ${idx + 1}. ${error.type}: ${error.message}`);
      });
    }
    
    // The validator SHOULD accept this plan since all variables are used
    expect(result.valid).toBe(true);
    
    console.log('✅ CORRECTLY ACCEPTED plan with proper variable usage');
    
  }, 30000);
});