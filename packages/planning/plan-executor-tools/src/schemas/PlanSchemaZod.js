/**
 * PlanSchemaZod.js - Zod schema for runtime plan validation
 * 
 * Provides comprehensive runtime validation with detailed error messages
 * for both new inputs/outputs format and legacy parameters format.
 */

import { z } from 'zod';

// Helper schemas
const stepIdSchema = z.string()
  .min(1, 'Step ID cannot be empty')
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/, 'Step ID must start with alphanumeric and contain only alphanumeric, hyphens, and underscores');

const actionIdSchema = z.string()
  .min(1, 'Action ID cannot be empty')
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/, 'Action ID must start with alphanumeric and contain only alphanumeric, hyphens, and underscores')
  .optional();

const variableNameSchema = z.string()
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Variable name must start with letter or underscore and contain only letters, numbers, and underscores');

const inputVariableNameSchema = z.string()
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Input variable name must start with letter or underscore and contain only letters, numbers, and underscores');

// Action schema - only the current format
const actionSchema = z.object({
  id: actionIdSchema,
  toolName: z.string().min(1, 'Action toolName is required'),
  inputs: z.record(z.any()).describe('Input parameters mapped to values or @variables'),
  outputs: z.record(z.any()).optional().describe('Output fields mapped to variable names'),
  description: z.string().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']).default('pending').optional(),
  estimatedDuration: z.number().min(0).optional(),
  result: z.any().nullable().optional()
}).describe('Action with inputs/outputs format');

// Recursive step schema
const stepSchema = z.lazy(() => z.object({
  id: stepIdSchema,
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['setup', 'implementation', 'validation', 'cleanup', 'action', 'group', 'parallel', 'conditional', 'documentation', 'testing', 'deployment']).optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']).default('pending').optional(),
  dependencies: z.array(z.string()).default([]).optional(),
  inputs: z.array(z.string()).default([]).optional().describe('Variables required by this step'),
  outputs: z.array(z.string()).default([]).optional().describe('Variables produced by this step'),
  actions: z.array(actionSchema).default([]).optional(),
  steps: z.array(stepSchema).default([]).optional(),
  estimatedDuration: z.number().min(0).optional(),
  retries: z.number().min(0).max(10).optional(),
  timeout: z.number().min(0).optional(),
  result: z.any().nullable().optional()
}).refine(
  (step) => {
    // A step should have either actions OR sub-steps, not both (but can have neither)
    const hasActions = step.actions && step.actions.length > 0;
    const hasSteps = step.steps && step.steps.length > 0;
    return !(hasActions && hasSteps);
  },
  {
    message: 'A step cannot have both actions and sub-steps. Use sub-steps for hierarchical organization.'
  }
));

// Plan input schema
const planInputSchema = z.object({
  name: inputVariableNameSchema,
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']).optional(),
  description: z.string().optional(),
  required: z.boolean().default(true).optional(),
  default: z.any().optional()
});

// Main plan schema
export const PlanSchemaZod = z.object({
  // Required fields
  id: z.string()
    .min(1, 'Plan ID is required')
    .max(100, 'Plan ID must be less than 100 characters')
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/, 'Plan ID must start with alphanumeric and contain only alphanumeric, hyphens, and underscores'),
  
  name: z.string()
    .min(1, 'Plan name is required')
    .max(200, 'Plan name must be less than 200 characters'),
  
  steps: z.array(stepSchema)
    .describe('Array of plan steps to execute'),
  
  // Recommended fields
  description: z.string().optional(),
  
  status: z.enum(['draft', 'ready', 'validated', 'executing', 'completed', 'failed', 'cancelled'])
    .default('draft')
    .optional(),
  
  version: z.string()
    .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/, 'Version must follow semantic versioning (e.g., 1.0.0)')
    .default('1.0.0')
    .optional(),
  
  // Metadata
  metadata: z.object({
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
    createdBy: z.string().optional(),
    complexity: z.enum(['low', 'medium', 'high']).optional(),
    profile: z.string().optional(),
    estimatedDuration: z.number().min(0).optional(),
    tags: z.array(z.string()).optional()
  }).passthrough().optional(),
  
  // Additional fields
  context: z.record(z.any()).optional().describe('Initial context variables'),
  
  inputs: z.array(planInputSchema).optional().describe('Input parameters required by the plan'),
  
  requiredOutputs: z.array(z.string()).optional().describe('Variables that must be defined by plan execution'),
  
  executionOrder: z.array(z.string()).optional().describe('Explicit execution order of step IDs'),
  
  successCriteria: z.array(z.string()).optional().describe('Conditions for plan success')
});

/**
 * Validate a plan against the schema
 * @param {any} plan - The plan object to validate
 * @returns {Object} Validation result with success flag and errors/data
 */
export function validatePlanSchema(plan) {
  try {
    // DEBUG: Log the plan structure we're about to validate
    console.log('🔍 [PLAN SCHEMA DEBUG] Starting schema validation');
    console.log('🔍 [PLAN SCHEMA DEBUG] Plan keys:', Object.keys(plan || {}));
    
    if (plan.steps && plan.steps.length > 0) {
      console.log('🔍 [PLAN SCHEMA DEBUG] First step keys:', Object.keys(plan.steps[0] || {}));
      if (plan.steps[0].actions && plan.steps[0].actions.length > 0) {
        console.log('🔍 [PLAN SCHEMA DEBUG] First action keys:', Object.keys(plan.steps[0].actions[0] || {}));
        console.log('🔍 [PLAN SCHEMA DEBUG] First action:', JSON.stringify(plan.steps[0].actions[0], null, 2));
      }
    }
    
    // DEBUG: Check what we're about to parse
    console.log('🔍 [PLAN SCHEMA DEBUG] About to parse plan with keys:', Object.keys(plan));
    console.log('🔍 [PLAN SCHEMA DEBUG] Plan string check:');
    const planStr = JSON.stringify(plan);
    console.log('   Contains "receive":', planStr.includes('"receive"'));
    console.log('   Contains "CREATE":', planStr.includes('"CREATE"'));
    
    const validatedPlan = PlanSchemaZod.parse(plan);
    console.log('✅ [PLAN SCHEMA DEBUG] Schema validation passed');
    return {
      success: true,
      data: validatedPlan,
      errors: []
    };
  } catch (error) {
    console.log('❌ [PLAN SCHEMA DEBUG] Schema validation failed');
    if (error instanceof z.ZodError) {
      // DEBUG: Log detailed error information
      console.log('🔍 [PLAN SCHEMA DEBUG] Zod errors:');
      error.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. Path: ${err.path.join('.')} | Code: ${err.code} | Message: ${err.message}`);
        if (err.received !== undefined) {
          console.log(`     Received: ${JSON.stringify(err.received)}`);
        }
        // More detailed debugging for union errors
        if (err.code === 'invalid_union' && err.unionErrors) {
          console.log(`     Union validation details:`);
          err.unionErrors.forEach((uerr, ui) => {
            console.log(`       Option ${ui + 1} errors:`, uerr.errors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
          });
        }
        if (err.expected !== undefined) {
          console.log(`     Expected: ${JSON.stringify(err.expected)}`);
        }
        
        // DEBUG: Check what object has the unexpected keys
        if (err.code === 'unrecognized_keys') {
          const pathParts = err.path;
          let obj = plan;
          for (const part of pathParts) {
            if (obj && obj[part] !== undefined) {
              obj = obj[part];
            }
          }
          console.log(`     Object at path ${err.path.join('.')}:`, Object.keys(obj || {}));
          console.log(`     Object type:`, Object.prototype.toString.call(obj));
          
          // Check if it's inheriting properties
          if (obj) {
            console.log(`     Own properties:`, Object.getOwnPropertyNames(obj));
            console.log(`     Prototype:`, Object.getPrototypeOf(obj));
            console.log(`     Constructor:`, obj.constructor?.name);
          }
        }
      });
      
      return {
        success: false,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      };
    }
    console.log('🔍 [PLAN SCHEMA DEBUG] Non-Zod error:', error.message);
    return {
      success: false,
      errors: [{
        path: '',
        message: error.message,
        code: 'UNKNOWN_ERROR'
      }]
    };
  }
}

/**
 * Check if a plan has valid format
 * @param {Object} plan - The plan to check
 * @returns {boolean} true if valid format
 */
export function detectPlanFormat(plan) {
  if (!plan || !plan.steps) {
    return false;
  }
  
  const checkActions = (actions) => {
    if (!actions) return true;
    
    for (const action of actions) {
      if (!action.toolName || !action.inputs) {
        return false;
      }
    }
    return true;
  };
  
  const checkSteps = (steps) => {
    if (!steps) return true;
    
    for (const step of steps) {
      if (!checkActions(step.actions)) return false;
      if (!checkSteps(step.steps)) return false;
    }
    return true;
  };
  
  return checkSteps(plan.steps);
}

/**
 * Get a human-readable summary of schema validation errors
 * @param {Array} errors - Array of validation errors
 * @returns {string} Formatted error summary
 */
export function formatSchemaErrors(errors) {
  if (!errors || errors.length === 0) {
    return 'No schema errors';
  }
  
  const summary = ['Plan Schema Validation Errors:'];
  
  for (const error of errors) {
    const location = error.path ? `at '${error.path}'` : 'at root';
    summary.push(`  - ${location}: ${error.message}`);
  }
  
  return summary.join('\n');
}

export default PlanSchemaZod;