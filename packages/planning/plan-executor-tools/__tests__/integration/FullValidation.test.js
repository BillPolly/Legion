/**
 * Integration test demonstrating full validation system
 */

import { describe, it, expect } from '@jest/globals';
import { PlanInspectorTool } from '../../src/PlanInspectorTool.js';
import { ValidatePlanTool } from '../../src/ValidatePlanTool.js';

// Mock ModuleLoader that simulates real tool registry
class MockModuleLoader {
  constructor() {
    this.tools = new Map();
    this.schemas = new Map();
    
    // Register some common tools
    this.registerTool('file_write', {
      inputSchema: {
        properties: {
          filepath: { type: 'string', description: 'Path to file' },
          content: { type: 'any', description: 'Content to write' }
        },
        required: ['filepath', 'content']
      },
      outputSchema: {
        properties: {
          filepath: { type: 'string' },
          bytesWritten: { type: 'number' },
          created: { type: 'boolean' }
        }
      }
    });
    
    this.registerTool('file_read', {
      inputSchema: {
        properties: {
          filepath: { type: 'string', description: 'Path to file' }
        },
        required: ['filepath']
      },
      outputSchema: {
        properties: {
          content: { type: 'string' },
          size: { type: 'number' }
        }
      }
    });
    
    this.registerTool('directory_create', {
      inputSchema: {
        properties: {
          dirpath: { type: 'string', description: 'Path to directory' }
        },
        required: ['dirpath']
      },
      outputSchema: {
        properties: {
          dirpath: { type: 'string' },
          created: { type: 'boolean' }
        }
      }
    });
  }
  
  registerTool(name, schema) {
    this.tools.set(name, { name, execute: () => {} });
    this.schemas.set(name, schema);
  }
  
  async getToolByNameOrAlias(name) {
    return this.tools.get(name) || null;
  }
  
  async getToolSchema(name) {
    return this.schemas.get(name) || null;
  }
}

describe('Full Validation Integration', () => {
  it('should catch all types of validation errors', async () => {
    const moduleLoader = new MockModuleLoader();
    const validator = new ValidatePlanTool(moduleLoader);
    
    const invalidPlan = {
      id: 'invalid-plan-comprehensive',
      name: 'Invalid Plan',
      version: 'bad-version', // Invalid version format
      steps: [
        {
          id: 'step-1',
          actions: [
            {
              type: 'nonexistent_tool', // Tool doesn't exist
              inputs: { param: 'value' }
            }
          ]
        },
        {
          id: 'step-2',
          dependencies: ['missing-step'], // Dependency doesn't exist
          actions: [
            {
              type: 'file_write',
              inputs: {
                filepath: '@undefinedVar/file.txt', // Variable not defined
                // Missing required 'content' field
              }
            }
          ]
        },
        {
          id: 'step-3',
          actions: [
            {
              type: 'file_read',
              inputs: {
                wrongField: 'value' // Wrong field name
              }
            }
          ]
        }
      ]
    };
    
    const result = await validator.execute({
      plan: invalidPlan,
      markAsValidated: true,
      verbose: true
    });
    
    // Plan should be invalid
    expect(result.success).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    
    // Should not mark as validated
    expect(result.validatedPlan).toBeUndefined();
    
    // Should catch various errors
    expect(result.errors.some(e => e.includes('semantic versioning'))).toBe(true);
    expect(result.errors.some(e => e.includes('nonexistent_tool'))).toBe(true);
    expect(result.errors.some(e => e.includes('missing-step'))).toBe(true);
    expect(result.errors.some(e => e.includes('undefinedVar'))).toBe(true);
    expect(result.errors.some(e => e.includes('content'))).toBe(true);
  });
});