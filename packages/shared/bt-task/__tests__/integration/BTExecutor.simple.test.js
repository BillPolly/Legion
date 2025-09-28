/**
 * Simple BTExecutor tests without external dependencies
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BTExecutor } from '../../src/core/BTExecutor.js';

describe('BTExecutor Simple Tests', () => {
  let executor;
  
  beforeEach(() => {
    // Create executor with mock toolRegistry
    const mockToolRegistry = {
      getTool: async (name) => {
        // Return mock tools
        if (name === 'mock_success') {
          return {
            execute: async (params) => ({
              success: true,
              data: { result: 'success', params }
            })
          };
        }
        if (name === 'mock_failure') {
          return {
            execute: async (params) => ({
              success: false,
              error: 'Mock failure'
            })
          };
        }
        return null;
      }
    };
    
    executor = new BTExecutor(mockToolRegistry);
  });
  
  it('should execute a single action node', async () => {
    const tree = {
      type: 'action',
      name: 'Test Action',
      tool: 'mock_success',
      params: { test: 'value' }
    };
    
    const result = await executor.executeTree(tree, {});
    
    expect(result.status).toBe('SUCCESS');
    expect(result.data.result).toBe('success');
  });
  
  it('should execute a sequence', async () => {
    const tree = {
      type: 'sequence',
      name: 'Test Sequence',
      children: [
        {
          type: 'action',
          tool: 'mock_success',
          params: { step: 1 },
          outputVariable: 'step1'
        },
        {
          type: 'action',
          tool: 'mock_success',
          params: { step: 2 },
          outputVariable: 'step2'
        }
      ]
    };
    
    const result = await executor.executeTree(tree, { artifacts: {} });
    
    expect(result.status).toBe('SUCCESS');
    expect(result.context.artifacts.step1).toBeDefined();
    expect(result.context.artifacts.step2).toBeDefined();
  });
  
  it('should fail sequence on child failure', async () => {
    const tree = {
      type: 'sequence',
      name: 'Failing Sequence',
      children: [
        {
          type: 'action',
          tool: 'mock_success',
          params: { step: 1 }
        },
        {
          type: 'action',
          tool: 'mock_failure',
          params: { step: 2 }
        },
        {
          type: 'action',
          tool: 'mock_success',
          params: { step: 3 }
        }
      ]
    };
    
    const result = await executor.executeTree(tree, {});
    
    expect(result.status).toBe('FAILURE');
  });
  
  it('should try alternatives in selector', async () => {
    const tree = {
      type: 'selector',
      name: 'Test Selector',
      children: [
        {
          type: 'action',
          tool: 'mock_failure',
          params: { attempt: 1 }
        },
        {
          type: 'action',
          tool: 'mock_success',
          params: { attempt: 2 },
          outputVariable: 'success'
        }
      ]
    };
    
    const result = await executor.executeTree(tree, { artifacts: {} });
    
    expect(result.status).toBe('SUCCESS');
    expect(result.context.artifacts.success).toBeDefined();
  });
  
  it('should handle conditions', async () => {
    const tree = {
      type: 'sequence',
      children: [
        {
          type: 'action',
          tool: 'mock_success',
          params: { value: true },
          outputVariable: 'flag'
        },
        {
          type: 'condition',
          condition: '@flag',
          children: [
            {
              type: 'action',
              tool: 'mock_success',
              params: { executed: 'yes' },
              outputVariable: 'conditional'
            }
          ]
        }
      ]
    };
    
    const result = await executor.executeTree(tree, { artifacts: {} });
    
    expect(result.status).toBe('SUCCESS');
    expect(result.context.artifacts.conditional).toBeDefined();
  });
  
  it('should handle artifact references with @ syntax', async () => {
    const tree = {
      type: 'sequence',
      children: [
        {
          type: 'action',
          tool: 'mock_success',
          params: { data: 'test-data' },
          outputVariable: 'source'
        },
        {
          type: 'action',
          tool: 'mock_success',
          params: { input: '@source.result' },
          outputVariable: 'target'
        }
      ]
    };
    
    const result = await executor.executeTree(tree, { artifacts: {} });
    
    expect(result.status).toBe('SUCCESS');
    expect(result.context.artifacts.target).toBeDefined();
    expect(result.context.artifacts.target.value.params.input).toBe('success');
  });
});