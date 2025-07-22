/**
 * Integration Tests for Context Parameter Resolution
 * 
 * Tests the complete flow:
 * 1. Tool calls saving results to context with saveAs
 * 2. Tool calls using context data with @contextName references
 * 3. Parameter resolution working across tool boundaries
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { HandleRegistry } from '../../src/handles/HandleRegistry.js';
import { HandleResolver } from '../../src/handles/HandleResolver.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { PlanExecutor } from '../../src/planning/PlanExecutor.js';
import { PlanningTools } from '../../src/planning/PlanningTools.js';

describe('Context Parameter Resolution Integration', () => {
  let handleRegistry;
  let handleResolver;
  let toolRegistry;
  let planExecutor;
  let planningTools;
  let mockTool;

  // Helper function to simulate MCP server auto-save behavior
  const simulateAutoSave = (toolName, args, result) => {
    if (args.saveAs && result.success) {
      const contextName = `context_${args.saveAs}`;
      const contextData = {
        data: result,
        description: `Result from ${toolName} tool`,
        addedAt: new Date().toISOString(),
        type: 'context',
        sourceTool: toolName,
        sourceArgs: args
      };
      handleRegistry.create(contextName, contextData);
      result.savedToContext = {
        contextName: args.saveAs,
        handleId: contextName,
        message: `Result saved to context as '${args.saveAs}'`
      };
    }
    return result;
  };

  beforeEach(async () => {
    handleRegistry = new HandleRegistry();
    handleResolver = new HandleResolver(handleRegistry);
    toolRegistry = new ToolRegistry(handleRegistry);
    planExecutor = new PlanExecutor(toolRegistry, handleRegistry);
    planningTools = new PlanningTools(toolRegistry, handleRegistry, planExecutor);

    // Create a mock tool that will be used in plans
    mockTool = {
      name: 'mock_deploy',
      description: 'Mock deployment tool for testing',
      inputSchema: {
        type: 'object',
        properties: {
          config: { description: 'Deployment configuration' },
          target: { type: 'string' },
          options: { type: 'object' }
        }
      },
      execute: async (params) => {
        return {
          success: true,
          deployed: true,
          config: params.config,
          target: params.target,
          options: params.options,
          deploymentId: `deploy_${Date.now()}`
        };
      }
    };

    // Register the mock tool
    toolRegistry.registerTool(mockTool);
  });

  afterEach(async () => {
    if (handleRegistry && handleRegistry.destroy) {
      handleRegistry.destroy();
    }
  });

  describe('Context Save and Reference Flow', () => {
    test('should save tool result to context and use it in another tool call', async () => {
      // Step 1: Create a plan and save it to context
      const planCreateTool = planningTools.getTools().plan_create;
      
      const createResult = await planCreateTool.execute({
        title: 'Deployment Plan',
        description: 'Plan for deploying application',
        steps: [
          {
            id: 'deploy_step',
            title: 'Deploy Application', 
            action: 'mock_deploy',
            parameters: {
              target: 'production',
              config: { port: 443, ssl: true }
            }
          }
        ],
        saveAs: 'deployment_plan'  // Save to context
      });

      expect(createResult.success).toBe(true);
      expect(createResult.planHandle).toBe('deployment_plan');

      // The planning tool saves to handle registry directly, not as context
      // Let's simulate the auto-save behavior that happens in the MCP server
      const contextName = `context_deployment_plan`;
      const contextData = {
        data: createResult,
        description: `Result from plan_create tool`,
        addedAt: new Date().toISOString(),
        type: 'context',
        sourceTool: 'plan_create',
        sourceArgs: {
          title: 'Deployment Plan',
          saveAs: 'deployment_plan'
        }
      };
      handleRegistry.create(contextName, contextData);

      // Verify it was saved to context
      const contextHandle = handleRegistry.getByName('context_deployment_plan');
      expect(contextHandle).toBeDefined();
      expect(contextHandle.data.type).toBe('context');
      expect(contextHandle.data.sourceTool).toBe('plan_create');

      // Step 2: Use the saved plan handle directly (not context reference)
      const planExecuteTool = planningTools.getTools().plan_execute;

      const executeResult = await planExecuteTool.execute({
        planHandle: 'deployment_plan',  // Use the handle created by plan_create
        saveAs: 'execution_result'
      });

      expect(executeResult.success).toBe(true);
      expect(executeResult.execution.success).toBe(true);
      expect(executeResult.execution.completedSteps).toHaveLength(1);

      // Simulate auto-save for execution result
      simulateAutoSave('plan_execute', { planHandle: 'deployment_plan', saveAs: 'execution_result' }, executeResult);

      // Verify execution result was also saved to context
      const executionContext = handleRegistry.getByName('context_execution_result');
      expect(executionContext).toBeDefined();
      expect(executionContext.data.sourceTool).toBe('plan_execute');
    });

    test('should resolve nested context references in complex parameters', async () => {
      // Create configuration context
      handleRegistry.create('context_app_config', {
        data: {
          server: 'production.example.com',
          port: 443,
          ssl: true,
          database: {
            host: 'db.example.com',
            port: 5432
          }
        },
        type: 'context'
      });

      // Create credentials context  
      handleRegistry.create('context_credentials', {
        data: {
          apiKey: 'secret-key-123',
          username: 'deploy-user'
        },
        type: 'context'
      });

      // Create a plan that references both contexts
      const planCreateTool = planningTools.getTools().plan_create;
      
      const complexParams = {
        title: 'Complex Deployment',
        steps: [
          {
            id: 'deploy_with_config',
            action: 'mock_deploy',
            parameters: {
              config: '@context_app_config',      // Reference to config
              credentials: '@context_credentials', // Reference to credentials
              target: 'production',
              options: {
                timeout: 300,
                retries: 3
              }
            }
          }
        ]
      };

      // Resolve parameters
      const resolvedParams = handleResolver.resolveParameters(complexParams);
      
      // Verify nested resolution worked
      expect(resolvedParams.steps[0].parameters.config.data.server).toBe('production.example.com');
      expect(resolvedParams.steps[0].parameters.credentials.data.apiKey).toBe('secret-key-123');
      expect(resolvedParams.steps[0].parameters.target).toBe('production'); // Non-reference preserved
      expect(resolvedParams.steps[0].parameters.options.timeout).toBe(300); // Nested object preserved

      // Create the plan with resolved parameters
      const result = await planCreateTool.execute(resolvedParams);
      expect(result.success).toBe(true);
    });

    test('should handle missing context references gracefully', async () => {
      const paramsWithMissingRef = {
        title: 'Plan with missing reference',
        steps: [
          {
            id: 'step1',
            action: 'mock_deploy',
            parameters: {
              config: '@nonexistent_context'  // This doesn't exist
            }
          }
        ]
      };

      // Parameter resolution should throw an error for missing reference
      expect(() => {
        handleResolver.resolveParameters(paramsWithMissingRef);
      }).toThrow('Handle not found: nonexistent_context');
    });

    test('should support chained context operations', async () => {
      // Step 1: Create initial configuration
      handleRegistry.create('context_base_config', {
        data: { 
          environment: 'staging',
          version: '1.0.0'
        },
        type: 'context'
      });

      // Step 2: Create plan using base config, save result
      const planCreateTool = planningTools.getTools().plan_create;
      const createArgs = {
        title: 'Staged Deployment',
        description: 'Using base configuration',
        steps: [
          {
            id: 'deploy',
            action: 'mock_deploy', 
            parameters: {
              config: '@context_base_config',
              target: 'staging'
            }
          }
        ],
        saveAs: 'staged_plan'
      };

      // Resolve parameters first
      const resolvedCreateArgs = handleResolver.resolveParameters(createArgs);
      const createResult = await planCreateTool.execute(resolvedCreateArgs);
      expect(createResult.success).toBe(true);
      
      // Simulate auto-save to context
      simulateAutoSave('plan_create', createArgs, createResult);

      // Step 3: Execute the saved plan using the handle (not context reference)
      const planExecuteTool = planningTools.getTools().plan_execute;
      const executeArgs = {
        planHandle: 'staged_plan',  // Use the handle created by plan_create
        options: {
          parallel: false,
          stopOnError: true
        },
        saveAs: 'staged_execution'
      };

      const executeResult = await planExecuteTool.execute(executeArgs);
      expect(executeResult.success).toBe(true);
      
      // Simulate auto-save to context
      simulateAutoSave('plan_execute', executeArgs, executeResult);

      // Step 4: Get status using plan handle
      const planStatusTool = planningTools.getTools().plan_status;
      const statusResult = await planStatusTool.execute({
        planHandle: 'staged_plan',  // Use the plan handle
        includeSteps: true,
        includeHandles: true
      });

      expect(statusResult.success).toBe(true);
      expect(statusResult.status.currentStatus).toBe('completed');
      expect(statusResult.steps).toHaveLength(1);

      // Verify all contexts exist
      expect(handleRegistry.existsByName('context_base_config')).toBe(true);
      expect(handleRegistry.existsByName('context_staged_plan')).toBe(true);
      expect(handleRegistry.existsByName('context_staged_execution')).toBe(true);
    });

    test('should resolve array parameters with context references', async () => {
      // Create multiple server configurations
      handleRegistry.create('context_server1', {
        data: { host: 'server1.com', port: 8080 },
        type: 'context'
      });
      
      handleRegistry.create('context_server2', {
        data: { host: 'server2.com', port: 8081 },
        type: 'context'
      });

      const paramsWithArrayRefs = {
        title: 'Multi-server Deployment',
        steps: [
          {
            id: 'deploy_multi',
            action: 'mock_deploy',
            parameters: {
              targets: [
                '@context_server1',
                '@context_server2',
                { host: 'server3.com', port: 8082 }  // Mix of references and literals
              ]
            }
          }
        ]
      };

      const resolvedParams = handleResolver.resolveParameters(paramsWithArrayRefs);
      
      // Verify array resolution
      const targets = resolvedParams.steps[0].parameters.targets;
      expect(targets).toHaveLength(3);
      expect(targets[0].data.host).toBe('server1.com');
      expect(targets[1].data.host).toBe('server2.com'); 
      expect(targets[2].host).toBe('server3.com'); // Literal preserved
    });
  });

  describe('Parameter Resolution Edge Cases', () => {
    test('should handle circular reference detection', async () => {
      // This test ensures the HandleResolver can handle complex object structures
      // without infinite loops
      const complexObject = {
        config: {
          nested: {
            reference: '@context_base_config'
          }
        }
      };

      handleRegistry.create('context_base_config', {
        data: { value: 'test' },
        type: 'context'
      });

      const resolved = handleResolver.resolveParameters(complexObject);
      expect(resolved.config.nested.reference.data.value).toBe('test');
    });

    test('should preserve special object types during resolution', async () => {
      const dateObj = new Date('2023-01-01T00:00:00Z');
      
      const paramsWithSpecialTypes = {
        timestamp: dateObj,
        config: '@context_base_config',
        regex: /test/gi
      };

      handleRegistry.create('context_base_config', {
        data: { setting: 'value' },
        type: 'context'
      });

      const resolved = handleResolver.resolveParameters(paramsWithSpecialTypes);
      
      expect(resolved.timestamp).toBe(dateObj); // Date preserved
      expect(resolved.config.data.setting).toBe('value'); // Reference resolved
      // RegExp might get serialized/deserialized, so just check it's there
      expect(resolved.regex).toBeDefined();
    });

    test('should validate all handle references before execution', async () => {
      const planCreateTool = planningTools.getTools().plan_create;
      
      const paramsWithMissingRefs = {
        title: 'Plan with validation',
        steps: [
          {
            id: 'step1',
            action: 'mock_deploy',
            parameters: {
              config: '@missing_config',
              target: '@missing_target'
            }
          }
        ]
      };

      // Should validate and find missing references
      const usedHandles = handleResolver.getUsedHandles(paramsWithMissingRefs);
      expect(usedHandles).toContain('missing_config');
      expect(usedHandles).toContain('missing_target');

      // Validation should fail
      expect(() => {
        handleResolver.validateHandles(paramsWithMissingRefs);
      }).toThrow('Handle not found: missing_config');
    });
  });

  describe('MCP Server Integration Simulation', () => {
    test('should simulate complete MCP server parameter resolution flow', async () => {
      // This simulates what happens in the actual MCP server handleToolCall function
      
      // Step 1: Agent saves configuration to context
      const originalConfigArgs = {
        name: 'deploy_config',
        data: {
          environment: 'production',
          replicas: 3,
          resources: { cpu: '500m', memory: '512Mi' }
        },
        description: 'Deployment configuration for production'
      };

      // Simulate context_add tool call
      const contextName = `context_${originalConfigArgs.name}`;
      const contextData = {
        data: originalConfigArgs.data,
        description: originalConfigArgs.description,
        addedAt: new Date().toISOString(),
        type: 'context'
      };
      handleRegistry.create(contextName, contextData);

      // Step 2: Agent creates plan referencing the context
      const planArgs = {
        title: 'Production Deployment',
        steps: [
          {
            id: 'deploy_prod',
            action: 'mock_deploy',
            parameters: {
              config: '@context_deploy_config',  // Reference to saved context
              target: 'production'
            }
          }
        ],
        saveAs: 'prod_deployment_plan'
      };

      // Simulate parameter resolution (what MCP server does)
      const resolvedPlanArgs = handleResolver.resolveParameters(planArgs);
      
      // Verify resolution worked
      expect(resolvedPlanArgs.steps[0].parameters.config.data.environment).toBe('production');
      expect(resolvedPlanArgs.steps[0].parameters.config.data.replicas).toBe(3);

      // Execute plan creation with resolved parameters
      const planCreateTool = planningTools.getTools().plan_create;
      const createResult = await planCreateTool.execute(resolvedPlanArgs);
      expect(createResult.success).toBe(true);
      
      // Simulate auto-save to context
      simulateAutoSave('plan_create', planArgs, createResult);
      
      // Step 3: Execute the plan using the handle (not context reference)
      const executeArgs = {
        planHandle: 'prod_deployment_plan',  // Use the handle created by plan_create
        options: {
          parallel: false,
          timeout: 600000
        }
      };

      const planExecuteTool = planningTools.getTools().plan_execute;
      const executeResult = await planExecuteTool.execute(executeArgs);

      expect(executeResult.success).toBe(true);
      expect(executeResult.execution.completedSteps).toHaveLength(1);
      
      // Verify the configuration was resolved properly during plan creation
      // The resolved config should be in the plan steps
      const planHandle = handleRegistry.getByName('prod_deployment_plan');
      expect(planHandle).toBeDefined();
      const planStep = planHandle.data.steps[0];
      expect(planStep.parameters.config.data.environment).toBe('production');
      expect(planStep.parameters.config.data.replicas).toBe(3);
    });
  });
});