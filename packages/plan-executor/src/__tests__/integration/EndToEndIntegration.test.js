/**
 * End-to-End Integration tests for the Plan Executor
 */

import { PlanExecutorModule } from '../../PlanExecutorModule.js';

describe('End-to-End Integration', () => {
  let mockResourceManager;
  let mockModuleFactory;
  let module;
  let tool;

  beforeEach(() => {
    mockResourceManager = {
      get: jest.fn(),
      register: jest.fn()
    };

    mockModuleFactory = {
      createModule: jest.fn()
    };

    module = new PlanExecutorModule({ resourceManager: mockResourceManager, moduleFactory: mockModuleFactory });
    tool = module.getTools()[0];

    // Mock the plan tool registry to not do real loading
    module.executor.planToolRegistry.loadModulesForPlan = jest.fn().mockResolvedValue();
  });

  describe('simple plan execution', () => {
    it('should execute a simple sequential plan', async () => {
      // Mock tools for the plan
      const mockTools = {
        file_read: {
          execute: jest.fn().mockResolvedValue({ 
            success: true, 
            content: 'file content',
            path: '/test/file.txt'
          })
        },
        string_process: {
          execute: jest.fn().mockResolvedValue({
            success: true,
            result: 'PROCESSED: file content'
          })
        },
        file_write: {
          execute: jest.fn().mockResolvedValue({
            success: true,
            path: '/test/output.txt'
          })
        }
      };

      module.executor.planToolRegistry.getTool = jest.fn().mockImplementation((toolName) => {
        return mockTools[toolName] || { execute: jest.fn().mockResolvedValue({ success: true }) };
      });

      const plan = {
        id: 'simple-file-processing',
        name: 'Simple File Processing',
        description: 'Read a file, process it, and write the result',
        steps: [
          {
            id: 'read-input',
            name: 'Read Input File',
            actions: [
              {
                type: 'file_read',
                parameters: {
                  path: '/test/input.txt'
                }
              }
            ]
          },
          {
            id: 'process-content',
            name: 'Process Content',
            actions: [
              {
                type: 'string_process',
                parameters: {
                  input: '@read-input',
                  operation: 'uppercase'
                }
              }
            ]
          },
          {
            id: 'write-output',
            name: 'Write Output',
            actions: [
              {
                type: 'file_write',
                parameters: {
                  path: '/test/output.txt',
                  content: '@process-content'
                }
              }
            ]
          }
        ]
      };

      const result = await tool.execute({ plan });

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['read-input', 'process-content', 'write-output']);
      expect(result.failedSteps).toEqual([]);
      expect(result.skippedSteps).toEqual([]);

      // Verify all tools were called
      expect(mockTools.file_read.execute.mock.calls.length).toBe(1);
      expect(mockTools.string_process.execute.mock.calls.length).toBe(1);
      expect(mockTools.file_write.execute.mock.calls.length).toBe(1);
    });

    it('should handle plan with dependencies', async () => {
      const executionOrder = [];
      const dependencyTool = {
        execute: jest.fn().mockImplementation((params) => {
          executionOrder.push(params.stepId || 'unknown');
          return Promise.resolve({ success: true, result: `result-${params.stepId}` });
        })
      };

      module.executor.planToolRegistry.getTool = jest.fn().mockReturnValue(dependencyTool);

      const plan = {
        id: 'dependency-plan',
        name: 'Plan with Dependencies',
        steps: [
          {
            id: 'step-a',
            name: 'Step A',
            actions: [
              { type: 'test_tool', parameters: { stepId: 'step-a' } }
            ]
          },
          {
            id: 'step-b',
            name: 'Step B',
            dependencies: ['step-a'],
            actions: [
              { type: 'test_tool', parameters: { stepId: 'step-b' } }
            ]
          },
          {
            id: 'step-c',
            name: 'Step C', 
            dependencies: ['step-a', 'step-b'],
            actions: [
              { type: 'test_tool', parameters: { stepId: 'step-c' } }
            ]
          }
        ]
      };

      const result = await tool.execute({ plan });

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['step-a', 'step-b', 'step-c']);
      
      // Verify execution order respects dependencies
      expect(executionOrder.indexOf('step-a')).toBeLessThan(executionOrder.indexOf('step-b'));
      expect(executionOrder.indexOf('step-b')).toBeLessThan(executionOrder.indexOf('step-c'));
    });
  });

  describe('complex dependency chains', () => {
    it('should execute complex hierarchical plan with mixed dependencies', async () => {
      const executionLog = [];
      const complexTool = {
        execute: jest.fn().mockImplementation((params) => {
          executionLog.push({
            stepId: params.stepId,
            timestamp: Date.now(),
            input: params.input || 'none'
          });
          return Promise.resolve({ 
            success: true, 
            result: `output-from-${params.stepId}` 
          });
        })
      };

      module.executor.planToolRegistry.getTool = jest.fn().mockReturnValue(complexTool);

      const plan = {
        id: 'complex-hierarchy',
        name: 'Complex Hierarchical Plan',
        steps: [
          {
            id: 'initialization',
            name: 'System Initialization',
            steps: [
              {
                id: 'init-database',
                name: 'Initialize Database',
                actions: [
                  { type: 'db_tool', parameters: { stepId: 'init-database', action: 'init' } }
                ]
              },
              {
                id: 'init-cache',
                name: 'Initialize Cache',
                dependencies: ['init-database'],
                actions: [
                  { type: 'cache_tool', parameters: { stepId: 'init-cache', action: 'init' } }
                ]
              }
            ]
          },
          {
            id: 'data-processing',
            name: 'Data Processing Pipeline',
            dependencies: ['initialization'],
            steps: [
              {
                id: 'load-data',
                name: 'Load Data',
                actions: [
                  { type: 'data_tool', parameters: { stepId: 'load-data', source: 'database' } }
                ]
              },
              {
                id: 'transform-data', 
                name: 'Transform Data',
                dependencies: ['load-data'],
                actions: [
                  { type: 'transform_tool', parameters: { stepId: 'transform-data', input: '@load-data' } }
                ]
              },
              {
                id: 'validate-data',
                name: 'Validate Data',
                dependencies: ['transform-data'],
                actions: [
                  { type: 'validate_tool', parameters: { stepId: 'validate-data', input: '@transform-data' } }
                ]
              }
            ]
          },
          {
            id: 'output-generation',
            name: 'Generate Output',
            dependencies: ['data-processing'],
            actions: [
              { type: 'output_tool', parameters: { stepId: 'output-generation', input: '@validate-data' } }
            ]
          }
        ]
      };

      const result = await tool.execute({ plan });

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual([
        'init-database',
        'init-cache', 
        'initialization',
        'load-data',
        'transform-data',
        'validate-data',
        'data-processing',
        'output-generation'
      ]);

      // Verify execution order
      const stepOrder = executionLog.map(entry => entry.stepId);
      expect(stepOrder.indexOf('init-database')).toBeLessThan(stepOrder.indexOf('init-cache'));
      expect(stepOrder.indexOf('init-cache')).toBeLessThan(stepOrder.indexOf('load-data'));
      expect(stepOrder.indexOf('load-data')).toBeLessThan(stepOrder.indexOf('transform-data'));
      expect(stepOrder.indexOf('transform-data')).toBeLessThan(stepOrder.indexOf('validate-data'));
      expect(stepOrder.indexOf('validate-data')).toBeLessThan(stepOrder.indexOf('output-generation'));
    });

    it('should handle dependency failure scenarios', async () => {
      const mockTools = {
        success_tool: {
          execute: jest.fn().mockResolvedValue({ success: true, result: 'success' })
        },
        failing_tool: {
          execute: jest.fn().mockRejectedValue(new Error('Tool failed'))
        }
      };

      module.executor.planToolRegistry.getTool = jest.fn().mockImplementation((toolName) => {
        return mockTools[toolName] || mockTools.success_tool;
      });

      const plan = {
        id: 'dependency-failure-plan',
        steps: [
          {
            id: 'step-1',
            actions: [{ type: 'success_tool', parameters: {} }]
          },
          {
            id: 'step-2', 
            actions: [{ type: 'failing_tool', parameters: {} }]
          },
          {
            id: 'step-3',
            dependencies: ['step-2'], // Depends on failing step
            actions: [{ type: 'success_tool', parameters: {} }]
          },
          {
            id: 'step-4',
            dependencies: ['step-1'], // Depends on successful step
            actions: [{ type: 'success_tool', parameters: {} }]
          }
        ]
      };

      const result = await tool.execute({ 
        plan, 
        options: { stopOnError: false, retries: 0, timeout: 1000 }
      });

      expect(result.success).toBe(false);
      expect(result.completedSteps).toEqual(['step-1', 'step-4']);
      expect(result.failedSteps).toEqual(['step-2', 'step-3']); // step-3 fails due to dependency
    });
  });

  describe('error scenarios and recovery', () => {
    it('should provide detailed error information in results', async () => {
      const specificError = new Error('Database connection failed: timeout after 30s');
      const errorTool = {
        execute: jest.fn().mockRejectedValue(specificError)
      };

      module.executor.planToolRegistry.getTool = jest.fn().mockReturnValue(errorTool);

      const plan = {
        id: 'error-details-plan',
        steps: [
          {
            id: 'database-operation',
            name: 'Critical Database Operation',
            actions: [
              { type: 'db_tool', parameters: { query: 'SELECT * FROM important_table' } }
            ]
          }
        ]
      };

      const result = await tool.execute({ 
        plan,
        options: { stopOnError: false, retries: 0, timeout: 1000 }
      });

      expect(result.success).toBe(false);
      expect(result.failedSteps).toEqual(['database-operation']);
      expect(result.error).toBeUndefined(); // No plan-level error in continue mode
    });

    it('should handle partial plan execution with mixed results', async () => {
      let stepCounter = 0;
      const mixedTool = {
        execute: jest.fn().mockImplementation(() => {
          stepCounter++;
          if (stepCounter === 2 || stepCounter === 4) {
            return Promise.reject(new Error(`Step ${stepCounter} failed`));
          }
          return Promise.resolve({ success: true, result: `Step ${stepCounter} succeeded` });
        })
      };

      module.executor.planToolRegistry.getTool = jest.fn().mockReturnValue(mixedTool);

      const plan = {
        id: 'mixed-results-plan',
        steps: [
          {
            id: 'step-1',
            actions: [{ type: 'mixed_tool', parameters: {} }]
          },
          {
            id: 'step-2',
            actions: [{ type: 'mixed_tool', parameters: {} }]
          },
          {
            id: 'step-3',
            actions: [{ type: 'mixed_tool', parameters: {} }]
          },
          {
            id: 'step-4',
            actions: [{ type: 'mixed_tool', parameters: {} }]
          },
          {
            id: 'step-5',
            actions: [{ type: 'mixed_tool', parameters: {} }]
          }
        ]
      };

      const result = await tool.execute({ 
        plan,
        options: { stopOnError: false, retries: 0, timeout: 1000 }
      });

      expect(result.success).toBe(false);
      expect(result.completedSteps).toEqual(['step-1', 'step-3', 'step-5']);
      expect(result.failedSteps).toEqual(['step-2', 'step-4']);
      expect(result.skippedSteps).toEqual([]);

      expect(result.statistics.totalSteps).toBe(5);
      expect(result.statistics.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('progress event streams', () => {
    it('should emit comprehensive progress events during execution', async () => {
      const allEvents = [];
      
      // Capture all events
      module.executor.on('plan:start', (event) => allEvents.push({ type: 'plan:start', ...event }));
      module.executor.on('plan:complete', (event) => allEvents.push({ type: 'plan:complete', ...event }));
      module.executor.on('step:start', (event) => allEvents.push({ type: 'step:start', ...event }));
      module.executor.on('step:complete', (event) => allEvents.push({ type: 'step:complete', ...event }));
      module.executor.on('step:error', (event) => allEvents.push({ type: 'step:error', ...event }));

      const eventTool = {
        execute: jest.fn().mockResolvedValue({ success: true, result: 'tool result' })
      };

      module.executor.planToolRegistry.getTool = jest.fn().mockReturnValue(eventTool);

      const plan = {
        id: 'event-stream-plan',
        name: 'Event Stream Test Plan',
        steps: [
          {
            id: 'parent-step',
            name: 'Parent Step',
            steps: [
              {
                id: 'child-step-1',
                name: 'Child Step 1',
                actions: [{ type: 'event_tool', parameters: {} }]
              },
              {
                id: 'child-step-2',
                name: 'Child Step 2',
                actions: [{ type: 'event_tool', parameters: {} }]
              }
            ]
          }
        ]
      };

      const result = await tool.execute({ plan });

      expect(result.success).toBe(true);

      // Verify event sequence
      const eventTypes = allEvents.map(e => e.type);
      expect(eventTypes).toEqual([
        'plan:start',
        'step:start',    // parent-step
        'step:start',    // child-step-1
        'step:complete', // child-step-1
        'step:start',    // child-step-2
        'step:complete', // child-step-2
        'step:complete', // parent-step
        'plan:complete'
      ]);

      // Verify event data completeness
      const planStart = allEvents.find(e => e.type === 'plan:start');
      expect(planStart.planId).toBe('event-stream-plan');
      expect(planStart.planName).toBe('Event Stream Test Plan');
      expect(planStart.totalSteps).toBe(3); // parent + 2 children

      const planComplete = allEvents.find(e => e.type === 'plan:complete');
      expect(planComplete.success).toBe(true);
      expect(planComplete.completedSteps).toBe(3);
      expect(planComplete.failedSteps).toBe(0);
    });

    it('should emit events with correct timing and paths', async () => {
      const timedEvents = [];
      const startTime = Date.now();

      module.executor.on('step:start', (event) => {
        timedEvents.push({
          type: 'start',
          stepId: event.stepId,
          stepPath: event.stepPath,
          relativeTime: Date.now() - startTime
        });
      });

      module.executor.on('step:complete', (event) => {
        timedEvents.push({
          type: 'complete',
          stepId: event.stepId,
          stepPath: event.stepPath,
          relativeTime: Date.now() - startTime
        });
      });

      const timingTool = {
        execute: jest.fn().mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve({ success: true }), 50); // 50ms delay
          });
        })
      };

      module.executor.planToolRegistry.getTool = jest.fn().mockReturnValue(timingTool);

      const plan = {
        id: 'timing-plan',
        steps: [
          {
            id: 'outer',
            steps: [
              {
                id: 'inner',
                actions: [{ type: 'timing_tool', parameters: {} }]
              }
            ]
          }
        ]
      };

      await tool.execute({ plan });

      expect(timedEvents).toHaveLength(4); // 2 starts + 2 completes

      // Verify paths are correct
      expect(timedEvents.find(e => e.stepId === 'outer' && e.type === 'start').stepPath).toBe('outer');
      expect(timedEvents.find(e => e.stepId === 'inner' && e.type === 'start').stepPath).toBe('outer.inner');

      // Verify timing order
      const outerStart = timedEvents.find(e => e.stepId === 'outer' && e.type === 'start');
      const innerStart = timedEvents.find(e => e.stepId === 'inner' && e.type === 'start');
      const innerComplete = timedEvents.find(e => e.stepId === 'inner' && e.type === 'complete');
      const outerComplete = timedEvents.find(e => e.stepId === 'outer' && e.type === 'complete');

      expect(outerStart.relativeTime).toBeLessThanOrEqual(innerStart.relativeTime);
      expect(innerStart.relativeTime).toBeLessThanOrEqual(innerComplete.relativeTime);
      expect(innerComplete.relativeTime).toBeLessThanOrEqual(outerComplete.relativeTime);
    });
  });

  describe('integration as Legion module', () => {
    it('should integrate properly with Legion ecosystem patterns', () => {
      // Test module interface
      expect(PlanExecutorModule.dependencies).toEqual(['resourceManager', 'moduleFactory']);
      expect(module.getTools()).toHaveLength(6);
      
      const tool = module.getTools()[0];
      expect(tool.name).toBe('plan_execute');
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.execute).toBeInstanceOf(Function);
    });

    it('should handle dependency injection correctly', () => {
      expect(module.resourceManager).toBe(mockResourceManager);
      expect(module.moduleFactory).toBe(mockModuleFactory);
      expect(module.planToolRegistry).toBeDefined();
      expect(module.executor.planToolRegistry).toBeDefined();
    });

    it('should work as standalone executor', async () => {
      // Test that we can use the executor directly without the module wrapper
      const standaloneExecutor = module.executor;
      
      const simpleTool = {
        execute: jest.fn().mockResolvedValue({ success: true, result: 'standalone result' })
      };

      standaloneExecutor.planToolRegistry.getTool = jest.fn().mockReturnValue(simpleTool);

      const plan = {
        id: 'standalone-plan',
        steps: [
          {
            id: 'standalone-step',
            actions: [{ type: 'simple_tool', parameters: {} }]
          }
        ]
      };

      const result = await standaloneExecutor.executePlan(plan);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['standalone-step']);
    });
  });
});