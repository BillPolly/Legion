/**
 * Integration tests for workflow execution
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { 
  MockExecutionEnvironment, 
  TestOptions, 
  ExecutionEventType,
  createMockTool 
} from '../utils/MockExecutionEnvironment.js';
import { createPlanningAgent } from '../../src/factories/AgentFactory.js';
import { LLMPlanningStrategy, SequentialPlanningStrategy, TemplatePlanningStrategy } from '../../src/core/execution/planning/index.js';
import { PlanStep } from '../../src/foundation/types/interfaces/interfaces.js';

describe('Workflow Execution Integration Tests', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = new MockExecutionEnvironment();
  });

  describe('Sequential Workflow Execution', () => {
    test('should execute simple sequential workflow', async () => {
      // Setup mock tools
      mockEnv.registerMockTool('analyzeData', createMockTool('analyzeData', (input) => ({
        status: 'analyzed',
        dataType: 'text',
        size: input.data?.length || 0
      })));

      mockEnv.registerMockTool('processData', createMockTool('processData', (input) => ({
        status: 'processed',
        result: `processed_${input.data}`,
        timestamp: Date.now()
      })));

      mockEnv.registerMockTool('generateReport', createMockTool('generateReport', (input) => ({
        status: 'complete',
        report: `Report: ${input.summary}`,
        pages: 3
      })));

      // Create agent with sequential strategy
      const agent = createPlanningAgent({
        name: 'SequentialWorkflowAgent',
        planningStrategy: new SequentialPlanningStrategy('analyzeData'),
        suppressLLMErrors: true
      });

      // Execute workflow
      const result = await mockEnv.runAgent(
        agent, 
        'Process data and generate report',
        new TestOptions({ timeout: 5000, maxToolCalls: 5 })
      );

      // Verify execution
      expect(result.success).toBe(true);
      expect(result.toolCallCount).toBe(1); // Sequential strategy uses one tool
      
      mockEnv.assertToolCalledWith('analyzeData', {
        goal: 'Process data and generate report'
      });
    });

    test('should handle tool failures gracefully', async () => {
      // Setup failing tool
      mockEnv.registerMockTool('failingTool', createMockTool('failingTool', () => {
        throw new Error('Tool execution failed');
      }));

      const agent = createPlanningAgent({
        name: 'FailureTestAgent',
        planningStrategy: new SequentialPlanningStrategy('failingTool'),
        maxRetries: 1, // Minimal retries for this test
        suppressLLMErrors: true
      });

      const result = await mockEnv.runAgent(
        agent,
        'Execute failing operation',
        new TestOptions({ timeout: 5000 })
      );

      // Verify failure handling
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('Tool execution failed');
      
      // Check execution log (should have 2 failures: initial + 1 retry)
      const failureEvents = mockEnv.getExecutionTrace([ExecutionEventType.TOOL_FAILURE]);
      expect(failureEvents).toHaveLength(2);
      expect(failureEvents[0].toolName).toBe('failingTool');
      expect(failureEvents[1].toolName).toBe('failingTool');
    });
  });

  describe('Template-Based Workflow Execution', () => {
    test('should execute workflow from template', async () => {
      // Setup tools for template workflow
      mockEnv.registerMockTool('validateInput', createMockTool('validateInput', (input) => ({
        valid: true,
        inputType: typeof input.data
      })));

      mockEnv.registerMockTool('transformData', createMockTool('transformData', (input) => ({
        transformed: true,
        output: `transformed_${input.data}`
      })));

      mockEnv.registerMockTool('storeResults', createMockTool('storeResults', (input) => ({
        stored: true,
        location: '/tmp/results',
        id: 'result_123'
      })));

      // Create template strategy
      const templates = {
        'data transformation': [
          { 
            id: 'validate', 
            description: 'Validate input data', 
            tool: 'validateInput', 
            params: { checkType: 'strict' }
          },
          { 
            id: 'transform', 
            description: 'Transform the data', 
            tool: 'transformData', 
            params: { format: 'json' },
            dependencies: ['validate']
          },
          { 
            id: 'store', 
            description: 'Store results', 
            tool: 'storeResults', 
            params: { persistent: true },
            dependencies: ['transform']
          }
        ]
      };

      const agent = createPlanningAgent({
        name: 'TemplateWorkflowAgent',
        planningStrategy: new TemplatePlanningStrategy(templates),
        suppressLLMErrors: true
      });

      const result = await mockEnv.runAgent(
        agent,
        'Perform data transformation workflow',
        new TestOptions({ 
          timeout: 10000,
          expectedToolCalls: 3,
          strictValidation: true
        })
      );

      // Verify template execution
      expect(result.success).toBe(true);
      expect(result.toolCallCount).toBe(3);

      // Verify execution order respects dependencies
      mockEnv.assertExecutionOrder(['validateInput', 'transformData', 'storeResults']);

      // Verify tool parameters
      mockEnv.assertToolCalledWith('validateInput', { checkType: 'strict' });
      mockEnv.assertToolCalledWith('transformData', { format: 'json' });
      mockEnv.assertToolCalledWith('storeResults', { persistent: true });
    });

    test('should fail when template tool is not available', async () => {
      const templates = {
        'missing tool workflow': [
          { id: 'step1', description: 'Use missing tool', tool: 'nonExistentTool', params: {} }
        ]
      };

      const agent = createPlanningAgent({
        name: 'MissingToolAgent',
        planningStrategy: new TemplatePlanningStrategy(templates),
        suppressLLMErrors: true
      });

      const result = await mockEnv.runAgent(
        agent,
        'Execute missing tool workflow',
        new TestOptions({ timeout: 5000 })
      );

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('Required tool not available: nonExistentTool');
    });
  });

  describe('Multi-Step Complex Workflows', () => {
    test('should execute complex multi-step workflow', async () => {
      // Setup comprehensive tool suite
      const tools = [
        'fetchData',
        'validateData', 
        'enrichData',
        'analyzeData',
        'generateInsights',
        'createVisualization',
        'compileReport',
        'publishResults'
      ];

      tools.forEach(toolName => {
        mockEnv.registerMockTool(toolName, createMockTool(toolName, (input) => ({
          tool: toolName,
          status: 'success',
          processedAt: Date.now(),
          input: input,
          output: `${toolName}_output`
        })));
      });

      // Create complex template
      const complexTemplate = {
        'data analysis pipeline': [
          { id: 'fetch', description: 'Fetch raw data', tool: 'fetchData', params: { source: 'api' } },
          { id: 'validate', description: 'Validate data quality', tool: 'validateData', params: { strict: true }, dependencies: ['fetch'] },
          { id: 'enrich', description: 'Enrich with metadata', tool: 'enrichData', params: { includeMetrics: true }, dependencies: ['validate'] },
          { id: 'analyze', description: 'Perform analysis', tool: 'analyzeData', params: { algorithm: 'ml' }, dependencies: ['enrich'] },
          { id: 'insights', description: 'Generate insights', tool: 'generateInsights', params: { format: 'summary' }, dependencies: ['analyze'] },
          { id: 'visualize', description: 'Create visualizations', tool: 'createVisualization', params: { type: 'charts' }, dependencies: ['insights'] },
          { id: 'report', description: 'Compile final report', tool: 'compileReport', params: { template: 'executive' }, dependencies: ['visualize'] },
          { id: 'publish', description: 'Publish results', tool: 'publishResults', params: { distribution: 'email' }, dependencies: ['report'] }
        ]
      };

      const agent = createPlanningAgent({
        name: 'ComplexPipelineAgent',
        planningStrategy: new TemplatePlanningStrategy(complexTemplate),
        debugMode: true,
        suppressLLMErrors: true
      });

      const result = await mockEnv.runAgent(
        agent,
        'Execute comprehensive data analysis pipeline',
        new TestOptions({ 
          timeout: 15000,
          expectedToolCalls: 8,
          maxToolCalls: 10,
          strictValidation: true
        })
      );

      // Verify complex workflow execution
      expect(result.success).toBe(true);
      expect(result.toolCallCount).toBe(8);

      // Verify all tools were called
      tools.forEach(toolName => {
        const toolCalls = mockEnv.getExecutionTrace([ExecutionEventType.TOOL_CALL])
          .filter(event => event.toolName === toolName);
        expect(toolCalls).toHaveLength(1);
      });

      // Verify execution respects dependency chain
      const executionOrder = mockEnv.getExecutionTrace([ExecutionEventType.TOOL_CALL])
        .map(event => event.toolName);
      
      // Key dependencies that must be respected
      const fetchIndex = executionOrder.indexOf('fetchData');
      const validateIndex = executionOrder.indexOf('validateData');
      const publishIndex = executionOrder.indexOf('publishResults');
      
      expect(fetchIndex).toBeLessThan(validateIndex);
      expect(validateIndex).toBeLessThan(publishIndex);
    }, 15000);
  });

  describe('Resource Management and Constraints', () => {
    test('should respect tool call limits', async () => {
      // Setup tool that could be called many times
      mockEnv.registerMockTool('repeatedTool', createMockTool('repeatedTool', (input) => ({
        iteration: input.iteration || 1,
        data: 'processed'
      })));

      const agent = createPlanningAgent({
        name: 'LimitedAgent',
        planningStrategy: new SequentialPlanningStrategy('repeatedTool'),
        suppressLLMErrors: true
      });

      const result = await mockEnv.runAgent(
        agent,
        'Execute with limits',
        new TestOptions({ 
          timeout: 5000,
          maxToolCalls: 1 // Strict limit
        })
      );

      expect(result.success).toBe(true);
      expect(result.toolCallCount).toBeLessThanOrEqual(1);
      
      mockEnv.assertResourceUsage({ maxToolCalls: 1 });
    });

    test('should handle timeout constraints', async () => {
      // Setup slow tool
      mockEnv.registerMockTool('slowTool', createMockTool('slowTool', async (input) => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        return { status: 'completed', data: input };
      }));

      const agent = createPlanningAgent({
        name: 'SlowAgent',
        planningStrategy: new SequentialPlanningStrategy('slowTool'),
        suppressLLMErrors: true
      });

      const result = await mockEnv.runAgent(
        agent,
        'Execute slow operation',
        new TestOptions({ timeout: 1000 }) // 1 second timeout
      );

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('timeout');
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should retry on transient failures', async () => {
      let callCount = 0;
      
      // Tool that fails first time, succeeds second time
      mockEnv.registerMockTool('unreliableTool', createMockTool('unreliableTool', (input) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Transient failure');
        }
        return { status: 'success', attempt: callCount };
      }));

      const agent = createPlanningAgent({
        name: 'RetryAgent',
        planningStrategy: new SequentialPlanningStrategy('unreliableTool'),
        maxRetries: 2,
        suppressLLMErrors: true
      });

      const result = await mockEnv.runAgent(
        agent,
        'Execute unreliable operation',
        new TestOptions({ timeout: 10000 })
      );

      // Should succeed after retry
      expect(result.success).toBe(true);
      
      // Should have both failure and success events
      const failureEvents = mockEnv.getExecutionTrace([ExecutionEventType.TOOL_FAILURE]);
      const successEvents = mockEnv.getExecutionTrace([ExecutionEventType.TOOL_SUCCESS]);
      
      expect(failureEvents).toHaveLength(1);
      expect(successEvents).toHaveLength(1);
    });
  });

  describe('Execution Tracing and Observability', () => {
    test('should generate comprehensive execution trace', async () => {
      // Setup multiple tools
      ['toolA', 'toolB', 'toolC'].forEach(toolName => {
        mockEnv.registerMockTool(toolName, createMockTool(toolName, (input) => ({
          tool: toolName,
          processed: true
        })));
      });

      const template = {
        'traced workflow': [
          { id: 'stepA', description: 'First step', tool: 'toolA', params: {} },
          { id: 'stepB', description: 'Second step', tool: 'toolB', params: {}, dependencies: ['stepA'] },
          { id: 'stepC', description: 'Third step', tool: 'toolC', params: {}, dependencies: ['stepB'] }
        ]
      };

      const agent = createPlanningAgent({
        name: 'TracedAgent',
        planningStrategy: new TemplatePlanningStrategy(template),
        suppressLLMErrors: true
      });

      const result = await mockEnv.runAgent(
        agent,
        'Execute traced workflow',
        new TestOptions({ enableTracing: true })
      );

      expect(result.success).toBe(true);

      // Verify comprehensive trace
      const fullTrace = mockEnv.getExecutionTrace();
      
      // Should have agent start/complete events
      const agentEvents = fullTrace.filter(e => 
        e.type === ExecutionEventType.AGENT_START || 
        e.type === ExecutionEventType.AGENT_COMPLETE
      );
      expect(agentEvents).toHaveLength(2);

      // Should have tool call/success events for each tool
      const toolEvents = fullTrace.filter(e => 
        e.type === ExecutionEventType.TOOL_CALL || 
        e.type === ExecutionEventType.TOOL_SUCCESS
      );
      expect(toolEvents).toHaveLength(6); // 3 tools × 2 events each

      // Verify event ordering
      const eventTypes = fullTrace.map(e => e.type);
      expect(eventTypes[0]).toBe(ExecutionEventType.AGENT_START);
      expect(eventTypes[eventTypes.length - 1]).toBe(ExecutionEventType.AGENT_COMPLETE);
    });

    test('should provide detailed failure analysis', async () => {
      mockEnv.registerMockTool('analyticalTool', createMockTool('analyticalTool', (input) => {
        if (!input.requiredParam) {
          throw new Error('Missing required parameter: requiredParam');
        }
        return { analysis: 'complete' };
      }));

      const agent = createPlanningAgent({
        name: 'AnalyticalAgent',
        planningStrategy: new SequentialPlanningStrategy('analyticalTool'),
        maxRetries: 1, // Minimal retries for this test
        suppressLLMErrors: true
      });

      const result = await mockEnv.runAgent(
        agent,
        'Perform analysis',
        new TestOptions({ enableTracing: true })
      );

      expect(result.success).toBe(false);

      // Verify detailed failure information (should have 2 failures: initial + 1 retry)
      const failureEvents = mockEnv.getExecutionTrace([ExecutionEventType.TOOL_FAILURE]);
      expect(failureEvents).toHaveLength(2);
      
      const failureEvent = failureEvents[0];
      expect(failureEvent.error.message).toContain('Missing required parameter');
      expect(failureEvent.toolName).toBe('analyticalTool');
      expect(failureEvent.duration).toBeGreaterThanOrEqual(0);
    }, 10000);
  });
});