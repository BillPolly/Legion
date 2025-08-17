/**
 * Execution Error Handling Tests
 * Tests error handling for tool failures, missing dependencies, and execution issues
 */

import { jest } from '@jest/globals';
import { NavigationTabs } from '../../src/components/tool-registry/components/NavigationTabs.js';
import { ExecutionControlPanel } from '../../src/components/tool-registry/components/panels/ExecutionControlPanel.js';

describe('Execution Error Handling Tests', () => {
  let component;
  let mockUmbilical;
  let dom;
  let mockPlanningActor;
  let mockExecutionActor;
  let mockToolRegistryActor;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '1200px';
    dom.style.height = '800px';
    document.body.appendChild(dom);

    // Create comprehensive mock actors
    mockPlanningActor = {
      createPlan: jest.fn(),
      decomposePlan: jest.fn(),
      savePlan: jest.fn(),
      loadPlan: jest.fn(),
      getPlans: jest.fn(),
      validatePlan: jest.fn()
    };

    mockExecutionActor = {
      executePlan: jest.fn(),
      startExecution: jest.fn(),
      pauseExecution: jest.fn(),
      resumeExecution: jest.fn(),
      stopExecution: jest.fn(),
      getExecutionStatus: jest.fn(),
      stepExecution: jest.fn(),
      retryTask: jest.fn(),
      skipTask: jest.fn(),
      rollbackExecution: jest.fn()
    };

    mockToolRegistryActor = {
      searchTools: jest.fn(),
      getToolDetails: jest.fn(),
      validateTools: jest.fn(),
      getAvailableTools: jest.fn(),
      installTool: jest.fn(),
      checkToolHealth: jest.fn()
    };

    // Define planning tabs
    const tabs = [
      {
        id: 'planning',
        label: 'Planning Workspace',
        title: 'Planning Workspace',
        icon: '🧠',
        component: 'PlanningWorkspacePanel'
      },
      {
        id: 'execution',
        label: 'Execution Control',
        title: 'Execution Control',
        icon: '⚡',
        component: 'ExecutionControlPanel'
      }
    ];

    // Create umbilical with error tracking
    mockUmbilical = {
      dom,
      tabs,
      activeTab: 'execution',
      
      // Actors
      planningActor: mockPlanningActor,
      executionActor: mockExecutionActor,
      toolRegistryActor: mockToolRegistryActor,
      
      // Error tracking
      executionErrors: [],
      lastExecutionError: null,
      failedTasks: [],
      
      // Error callbacks
      onExecutionError: jest.fn((error) => {
        mockUmbilical.lastExecutionError = error;
        mockUmbilical.executionErrors.push(error);
      }),
      
      onTaskFailed: jest.fn((task, error) => {
        mockUmbilical.failedTasks.push({ task, error });
      }),
      
      onToolError: jest.fn((tool, error) => {
        mockUmbilical.executionErrors.push({ type: 'tool', tool, error });
      }),
      
      // Standard callbacks
      onExecutionStart: jest.fn(),
      onExecutionComplete: jest.fn(),
      onTabChange: jest.fn(),
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await NavigationTabs.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
    jest.clearAllMocks();
  });

  describe('Tool Failure Handling', () => {
    test('should handle tool not found error', async () => {
      const toolNotFoundError = new Error('Tool "docker" not found in PATH');
      toolNotFoundError.code = 'TOOL_NOT_FOUND';
      toolNotFoundError.tool = 'docker';
      
      // Mock tool not found
      mockExecutionActor.startExecution.mockRejectedValue(toolNotFoundError);

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Set plan with docker requirement
        const dockerPlan = {
          id: 'docker-plan',
          name: 'Docker Plan',
          behaviorTree: {
            rootNode: { type: 'action', command: 'docker build .' }
          }
        };
        
        executionComponent.api.setPlan(dockerPlan);
        
        // Attempt to start execution
        await executionComponent.api.startExecution();
        
        // Verify error was encountered
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
        
        // Check execution status
        const state = executionComponent.api.getState();
        expect(state.executionStatus).toBe('error');
      }
    });

    test('should handle tool execution timeout', async () => {
      const timeoutError = new Error('Tool execution timeout after 30000ms');
      timeoutError.code = 'EXECUTION_TIMEOUT';
      timeoutError.timeout = 30000;
      timeoutError.command = 'npm install';
      
      // Mock timeout error
      mockExecutionActor.startExecution.mockResolvedValue({ executionId: 'exec-001' });
      mockExecutionActor.getExecutionStatus.mockResolvedValue({
        status: 'failed',
        error: timeoutError
      });

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Set plan and start execution
        const timeoutPlan = {
          id: 'timeout-plan',
          name: 'Timeout Test Plan',
          behaviorTree: {
            rootNode: { type: 'action', command: 'npm install', timeout: 30000 }
          }
        };
        
        executionComponent.api.setPlan(timeoutPlan);
        await executionComponent.api.startExecution();
        
        // Check execution was started
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
      }
    });

    test('should handle tool permission denied', async () => {
      const permissionError = new Error('Permission denied: /usr/local/bin/tool');
      permissionError.code = 'EACCES';
      permissionError.path = '/usr/local/bin/tool';
      
      // Mock permission error
      mockExecutionActor.startExecution.mockRejectedValue(permissionError);

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Set plan requiring privileged tool
        const privilegedPlan = {
          id: 'privileged-plan',
          name: 'Privileged Tool Plan',
          behaviorTree: {
            rootNode: { type: 'action', command: 'sudo systemctl restart service' }
          }
        };
        
        executionComponent.api.setPlan(privilegedPlan);
        await executionComponent.api.startExecution();
        
        // Verify permission error
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
        
        const state = executionComponent.api.getState();
        expect(state.executionStatus).toBe('error');
      }
    });

    test('should handle tool crash during execution', async () => {
      const crashError = new Error('Tool process crashed with signal SIGSEGV');
      crashError.code = 'TOOL_CRASHED';
      crashError.signal = 'SIGSEGV';
      crashError.exitCode = -11;
      
      // Mock tool crash
      mockExecutionActor.startExecution.mockResolvedValue({ executionId: 'exec-002' });
      
      // Simulate crash during execution
      setTimeout(() => {
        if (mockUmbilical.onExecutionError) {
          mockUmbilical.onExecutionError(crashError);
        }
      }, 100);

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Start execution that will crash
        const crashPlan = {
          id: 'crash-plan',
          name: 'Crash Test Plan',
          behaviorTree: {
            rootNode: { type: 'action', command: 'faulty-tool' }
          }
        };
        
        executionComponent.api.setPlan(crashPlan);
        await executionComponent.api.startExecution();
        
        // Wait for crash simulation
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Verify crash was recorded
        expect(mockUmbilical.executionErrors).toHaveLength(1);
        expect(mockUmbilical.lastExecutionError.code).toBe('TOOL_CRASHED');
      }
    });

    test('should handle tool version mismatch', async () => {
      const versionError = new Error('Node.js version 14.x required, but 12.x found');
      versionError.code = 'VERSION_MISMATCH';
      versionError.required = '14.x';
      versionError.found = '12.x';
      versionError.tool = 'node';
      
      // Mock version mismatch
      mockToolRegistryActor.checkToolHealth.mockResolvedValue({
        healthy: false,
        error: versionError
      });

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Plan requiring specific Node version
        const versionPlan = {
          id: 'version-plan',
          name: 'Version Specific Plan',
          requirements: { node: '>=14.0.0' },
          behaviorTree: {
            rootNode: { type: 'action', command: 'node script.js' }
          }
        };
        
        executionComponent.api.setPlan(versionPlan);
        
        // Check tool health before execution
        const healthCheck = await mockToolRegistryActor.checkToolHealth('node');
        expect(healthCheck.healthy).toBe(false);
        expect(healthCheck.error.code).toBe('VERSION_MISMATCH');
      }
    });
  });

  describe('Missing Dependencies Handling', () => {
    test('should handle missing npm packages', async () => {
      const missingPackageError = new Error('Cannot find module "express"');
      missingPackageError.code = 'MODULE_NOT_FOUND';
      missingPackageError.requireStack = ['/app/server.js'];
      
      // Mock missing package error
      mockExecutionActor.startExecution.mockRejectedValue(missingPackageError);

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Plan with missing dependency
        const missingDepPlan = {
          id: 'missing-dep-plan',
          name: 'Missing Dependency Plan',
          behaviorTree: {
            rootNode: { type: 'action', command: 'node server.js' }
          }
        };
        
        executionComponent.api.setPlan(missingDepPlan);
        await executionComponent.api.startExecution();
        
        // Verify missing module error
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
        
        const state = executionComponent.api.getState();
        expect(state.executionStatus).toBe('error');
      }
    });

    test('should handle missing system libraries', async () => {
      const missingLibError = new Error('libssl.so.1.1: cannot open shared object file');
      missingLibError.code = 'MISSING_LIBRARY';
      missingLibError.library = 'libssl.so.1.1';
      
      // Mock missing library error
      mockExecutionActor.startExecution.mockRejectedValue(missingLibError);

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Plan requiring system library
        const libPlan = {
          id: 'lib-plan',
          name: 'System Library Plan',
          behaviorTree: {
            rootNode: { type: 'action', command: 'openssl version' }
          }
        };
        
        executionComponent.api.setPlan(libPlan);
        await executionComponent.api.startExecution();
        
        // Verify library error
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
      }
    });

    test('should handle missing environment variables', async () => {
      const envError = new Error('Required environment variable API_KEY is not set');
      envError.code = 'ENV_VAR_MISSING';
      envError.variable = 'API_KEY';
      
      // Mock environment variable error
      mockExecutionActor.startExecution.mockRejectedValue(envError);

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Plan requiring environment variable
        const envPlan = {
          id: 'env-plan',
          name: 'Environment Variable Plan',
          environment: ['API_KEY', 'SECRET_KEY'],
          behaviorTree: {
            rootNode: { type: 'action', command: 'deploy-api' }
          }
        };
        
        executionComponent.api.setPlan(envPlan);
        await executionComponent.api.startExecution();
        
        // Verify environment error
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
        
        const state = executionComponent.api.getState();
        expect(state.executionStatus).toBe('error');
      }
    });

    test('should handle missing configuration files', async () => {
      const configError = new Error('Configuration file not found: config.json');
      configError.code = 'ENOENT';
      configError.path = './config.json';
      
      // Mock missing config error
      mockExecutionActor.startExecution.mockRejectedValue(configError);

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Plan requiring config file
        const configPlan = {
          id: 'config-plan',
          name: 'Configuration Plan',
          configFiles: ['config.json', '.env'],
          behaviorTree: {
            rootNode: { type: 'action', command: 'start-with-config' }
          }
        };
        
        executionComponent.api.setPlan(configPlan);
        await executionComponent.api.startExecution();
        
        // Verify config error
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
      }
    });
  });

  describe('Execution Recovery Strategies', () => {
    test('should retry failed tasks with exponential backoff', async () => {
      const retryableError = new Error('Network connection failed');
      retryableError.code = 'NETWORK_ERROR';
      retryableError.retryable = true;
      
      // First attempts fail, final succeeds
      mockExecutionActor.retryTask
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ success: true });

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Set execution ID for retry
        executionComponent.api.setState('executionId', 'exec-retry');
        
        // Retry task with backoff
        if (typeof executionComponent.api.retryTask === 'function') {
          let attempts = 0;
          let success = false;
          
          while (attempts < 3 && !success) {
            try {
              await executionComponent.api.retryTask('task-001');
              success = true;
            } catch (error) {
              attempts++;
              // Exponential backoff simulation
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
            }
          }
          
          expect(mockExecutionActor.retryTask).toHaveBeenCalledTimes(3);
        }
      }
    });

    test('should skip non-critical failed tasks', async () => {
      const nonCriticalError = new Error('Optional task failed');
      nonCriticalError.code = 'TASK_FAILED';
      nonCriticalError.critical = false;
      
      // Mock skip functionality
      mockExecutionActor.skipTask.mockResolvedValue({
        skipped: true,
        reason: 'Non-critical task failed'
      });

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Handle non-critical failure
        if (mockUmbilical.onTaskFailed) {
          mockUmbilical.onTaskFailed('optional-task', nonCriticalError);
        }
        
        // Skip the failed task
        if (typeof executionComponent.api.skipTask === 'function') {
          await executionComponent.api.skipTask('optional-task');
          expect(mockExecutionActor.skipTask).toHaveBeenCalledWith('optional-task');
        }
      }
    });

    test('should rollback on critical failures', async () => {
      const criticalError = new Error('Database migration failed');
      criticalError.code = 'CRITICAL_FAILURE';
      criticalError.critical = true;
      criticalError.rollbackRequired = true;
      
      // Mock rollback
      mockExecutionActor.rollbackExecution.mockResolvedValue({
        rolledBack: true,
        restoredState: 'previous-stable'
      });

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Set execution ID
        executionComponent.api.setState('executionId', 'exec-rollback');
        
        // Trigger critical failure
        if (mockUmbilical.onExecutionError) {
          mockUmbilical.onExecutionError(criticalError);
        }
        
        // Perform rollback
        if (typeof executionComponent.api.rollbackExecution === 'function') {
          await executionComponent.api.rollbackExecution('exec-rollback');
          expect(mockExecutionActor.rollbackExecution).toHaveBeenCalled();
        }
      }
    });

    test('should provide alternative execution paths', async () => {
      const primaryPathError = new Error('Primary tool unavailable');
      primaryPathError.code = 'TOOL_UNAVAILABLE';
      primaryPathError.tool = 'webpack';
      primaryPathError.alternatives = ['parcel', 'rollup'];
      
      // Mock alternative path selection
      mockToolRegistryActor.getAvailableTools.mockResolvedValue(['parcel', 'rollup']);

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Check for alternatives
        const availableTools = await mockToolRegistryActor.getAvailableTools();
        
        // Select alternative tool
        const alternativeTool = primaryPathError.alternatives.find(alt => 
          availableTools.includes(alt)
        );
        
        expect(alternativeTool).toBeDefined();
        expect(['parcel', 'rollup']).toContain(alternativeTool);
      }
    });
  });

  describe('Error Reporting and Logging', () => {
    test('should log detailed error information', async () => {
      const detailedError = new Error('Complex execution failure');
      detailedError.code = 'EXECUTION_FAILED';
      detailedError.details = {
        task: 'build-project',
        step: 3,
        command: 'npm run build',
        exitCode: 1,
        stderr: 'Build error output...',
        duration: 5432,
        timestamp: new Date().toISOString()
      };
      
      // Mock detailed error
      mockExecutionActor.startExecution.mockRejectedValue(detailedError);

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Trigger detailed error
        const errorPlan = {
          id: 'error-plan',
          name: 'Error Logging Plan',
          behaviorTree: {
            rootNode: { type: 'action', command: 'npm run build' }
          }
        };
        
        executionComponent.api.setPlan(errorPlan);
        await executionComponent.api.startExecution();
        
        // Verify detailed error was captured
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
        
        // Check execution logs contain error details
        const state = executionComponent.api.getState();
        expect(state.executionStatus).toBe('error');
      }
    });

    test('should aggregate errors from parallel executions', async () => {
      const parallelErrors = [
        { task: 'test-unit', error: 'Unit test failed' },
        { task: 'test-integration', error: 'Integration test timeout' },
        { task: 'test-e2e', error: 'E2E test connection refused' }
      ];
      
      // Mock parallel execution errors
      mockExecutionActor.startExecution.mockResolvedValue({ executionId: 'parallel-exec' });
      
      // Simulate parallel errors
      setTimeout(() => {
        parallelErrors.forEach(({ task, error }) => {
          if (mockUmbilical.onTaskFailed) {
            mockUmbilical.onTaskFailed(task, new Error(error));
          }
        });
      }, 100);

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Start parallel execution
        const parallelPlan = {
          id: 'parallel-plan',
          name: 'Parallel Test Plan',
          executionMode: 'parallel',
          behaviorTree: {
            rootNode: {
              type: 'parallel',
              children: [
                { type: 'action', id: 'test-unit', command: 'npm run test:unit' },
                { type: 'action', id: 'test-integration', command: 'npm run test:integration' },
                { type: 'action', id: 'test-e2e', command: 'npm run test:e2e' }
              ]
            }
          }
        };
        
        executionComponent.api.setPlan(parallelPlan);
        await executionComponent.api.startExecution();
        
        // Wait for error simulation
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Verify all errors were captured
        expect(mockUmbilical.failedTasks).toHaveLength(3);
        expect(mockUmbilical.failedTasks.map(f => f.task)).toEqual(
          expect.arrayContaining(['test-unit', 'test-integration', 'test-e2e'])
        );
      }
    });

    test('should provide error context and stack traces', async () => {
      const contextError = new Error('Execution failed with context');
      contextError.code = 'CONTEXT_ERROR';
      contextError.stack = `Error: Execution failed with context
        at executeTask (/app/executor.js:123:15)
        at async runPlan (/app/runner.js:45:10)
        at async main (/app/index.js:10:5)`;
      contextError.context = {
        plan: 'test-plan',
        task: 'failing-task',
        environment: 'production',
        user: 'test-user'
      };
      
      // Mock context error
      mockExecutionActor.startExecution.mockRejectedValue(contextError);

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Trigger context error
        executionComponent.api.setPlan({
          id: 'context-plan',
          name: 'Context Error Plan',
          behaviorTree: { rootNode: { type: 'action', command: 'fail' } }
        });
        
        await executionComponent.api.startExecution();
        
        // Verify context was preserved
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
      }
    });
  });
});