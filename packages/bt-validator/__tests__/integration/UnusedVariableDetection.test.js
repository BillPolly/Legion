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
    
    console.log(`📊 Validation result: success=${result.success}`);
    console.log(`📋 Errors found: ${result.errors?.length || 0}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ Validation errors:');
      result.errors.forEach((error, idx) => {
        console.log(`   ${idx + 1}. ${error.type}: ${error.message}`);
      });
    }
    
    // The validator SHOULD reject this plan due to unused variable
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
    
    // Should specifically mention unused variable
    const hasUnusedVariableError = result.errors.some(error => 
      error.message.toLowerCase().includes('unused') ||
      error.message.toLowerCase().includes('hello_code') ||
      error.type === 'UNUSED_VARIABLE'
    );
    
    expect(hasUnusedVariableError).toBe(true);
    console.log('✅ CORRECTLY REJECTED plan with unused variable');
    
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
    
    console.log(`📊 Validation result: success=${result.success}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️ Validation errors found:');
      result.errors.forEach((error, idx) => {
        console.log(`   ${idx + 1}. ${error.type}: ${error.message}`);
      });
    }
    
    // The validator SHOULD accept this plan since all variables are used
    expect(result.success).toBe(true);
    
    console.log('✅ CORRECTLY ACCEPTED plan with proper variable usage');
    
  }, 30000);

  test('should detect multiple unused variables', async () => {
    console.log('\n🔍 Testing complex plan with multiple unused variables');
    
    const planWithMultipleUnusedVars = {
      id: "root",
      type: "sequence",
      description: "Complex plan with unused variables",
      children: [
        {
          type: "action",
          id: "action1",
          tool: "tool_a",
          outputs: {
            result1: "unused_var1",    // ❌ Never used
            result2: "unused_var2"     // ❌ Never used
          }
        },
        {
          type: "action",
          id: "action2", 
          tool: "tool_b",
          inputs: {
            input1: "hardcoded_value"  // ❌ Should use @unused_var1
          },
          outputs: {
            result3: "used_var"        // ✅ Will be used
          }
        },
        {
          type: "action",
          id: "action3",
          tool: "tool_c",
          inputs: {
            input2: "@used_var"        // ✅ Uses stored variable correctly
          }
        }
      ]
    };
    
    const result = await validator.validate(planWithMultipleUnusedVars);
    
    console.log(`📊 Multiple unused vars validation: success=${result.success}`);
    
    // Should be rejected due to multiple unused variables
    expect(result.success).toBe(false);
    
    // Should detect both unused variables
    const unusedVarErrors = result.errors.filter(error => 
      error.message.includes('unused_var1') || 
      error.message.includes('unused_var2') ||
      error.type === 'UNUSED_VARIABLE'
    );
    
    console.log(`📋 Found ${unusedVarErrors.length} unused variable errors`);
    expect(unusedVarErrors.length).toBeGreaterThan(0);
    
    console.log('✅ CORRECTLY DETECTED multiple unused variables');
    
  }, 30000);

  test('should detect missing variables (referenced but not stored)', async () => {
    console.log('\n🔍 Testing plan with missing variable references');
    
    const planWithMissingVars = {
      id: "root",
      type: "sequence", 
      description: "Plan with missing variable references",
      children: [
        {
          type: "action",
          id: "action1",
          tool: "tool_a",
          outputs: {
            result1: "available_var"  // ✅ This variable is stored
          }
        },
        {
          type: "action",
          id: "action2",
          tool: "tool_b", 
          inputs: {
            input1: "@available_var",   // ✅ This exists
            input2: "@missing_var"      // ❌ This was never stored
          }
        }
      ]
    };
    
    const result = await validator.validate(planWithMissingVars);
    
    console.log(`📊 Missing vars validation: success=${result.success}`);
    
    // Should be rejected due to missing variable reference
    expect(result.success).toBe(false);
    
    // Should detect missing variable
    const missingVarErrors = result.errors.filter(error =>
      error.message.includes('missing_var') ||
      error.type === 'MISSING_VARIABLE' ||
      error.type === 'UNDEFINED_VARIABLE'
    );
    
    console.log(`📋 Found ${missingVarErrors.length} missing variable errors`);
    expect(missingVarErrors.length).toBeGreaterThan(0);
    
    console.log('✅ CORRECTLY DETECTED missing variable references');
    
  }, 30000);
});