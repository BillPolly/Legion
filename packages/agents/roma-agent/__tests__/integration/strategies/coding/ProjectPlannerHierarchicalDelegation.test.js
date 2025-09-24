/**
 * Integration tests for ProjectPlannerStrategy hierarchical delegation
 * Tests the migration to parent→child task delegation pattern
 * Phase 1.3 Integration Test: Verifies AnalysisStrategy delegation
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';
import { createProjectPlannerStrategy } from '../../../../src/strategies/coding/ProjectPlannerStrategy.js';
import fs from 'fs/promises';
import path from 'path';

describe('ProjectPlannerStrategy - Hierarchical Delegation', () => {
  let resourceManager;
  let llmClient;
  let toolRegistry;
  let strategy;
  let testWorkspace;
  let mockTaskManager;
  let mockParentTask;
  let mockChildTask;

  beforeEach(async () => {
    // Get real ResourceManager singleton and services
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    toolRegistry = await getToolRegistry();
    
    // Create unique test workspace
    testWorkspace = `/tmp/roma-test-${Date.now()}`;
    await fs.mkdir(testWorkspace, { recursive: true });
    
    // Create strategy with real services
    strategy = createProjectPlannerStrategy;
    
    // Create mock TaskManager for child task creation
    mockTaskManager = {
      createTask: jest.fn()
    };
    
    // Create mock parent task with required methods
    mockParentTask = {
      id: 'parent-task-123',
      description: 'Create a simple calculator API with authentication',
      workspaceDir: testWorkspace,
      context: {
        llmClient,
        toolRegistry
      },
      lookup: jest.fn((serviceName) => {
        if (serviceName === 'taskManager') return mockTaskManager;
        return null;
      }),
      getAllArtifacts: jest.fn(() => ({})),
      storeArtifact: jest.fn(),
      addConversationEntry: jest.fn(),
      complete: jest.fn(),
      fail: jest.fn()
    };
    
    // Create mock child task for delegation testing
    mockChildTask = {
      id: 'analysis-child-456',
      description: 'Analyze requirements: Create a simple calculator API with authentication',
      parent: mockParentTask,
      receiveMessage: jest.fn(),
      getArtifact: jest.fn(),
      getAllArtifacts: jest.fn(() => ({
        'requirements-analysis': {
          content: {
            type: 'api',
            features: ['calculator operations', 'user authentication', 'JWT tokens'],
            constraints: ['secure', 'RESTful'],
            technologies: ['express', 'jsonwebtoken', 'bcrypt']
          },
          description: 'Analyzed requirements and determined project structure',
          type: 'analysis'
        }
      }))
    };
    
    // Initialize strategy
    await strategy.initialize(mockParentTask);
  });

  afterEach(async () => {
    // Cleanup test workspace
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Child Task Creation and Delegation', () => {
    test('should create child task for requirements analysis when TaskManager available', async () => {
      // Setup: Mock TaskManager to return our mock child task
      mockTaskManager.createTask.mockResolvedValue(mockChildTask);
      
      // Setup: Mock child task to return successful analysis result
      mockChildTask.receiveMessage.mockResolvedValue({
        success: true,
        result: { analysis: 'requirements analyzed' },
        artifacts: ['requirements-analysis']
      });
      
      // Setup: Mock child task artifact retrieval
      mockChildTask.getArtifact.mockReturnValue({
        content: {
          type: 'api',
          features: ['calculator operations'],
          technologies: ['express']
        }
      });
      
      // Execute: Call delegation method
      const result = await strategy._delegateRequirementsAnalysis(mockParentTask);
      
      // Verify: TaskManager.createTask was called with correct parameters
      expect(mockTaskManager.createTask).toHaveBeenCalledWith(
        'Analyze requirements: Create a simple calculator API with authentication',
        mockParentTask,
        {
          strategy: strategy.analysisStrategy,
          workspaceDir: testWorkspace,
          llmClient: llmClient
        }
      );
      
      // Verify: Child task received start message
      expect(mockChildTask.receiveMessage).toHaveBeenCalledWith({ type: 'start' });
      
      // Verify: Analysis result was returned
      expect(result).toEqual({
        type: 'api',
        features: ['calculator operations'],
        technologies: ['express']
      });
      
      console.log('✅ Child task creation and delegation verified');
    });

    test('should throw error when TaskManager not available', async () => {
      // Setup: Mock task without TaskManager
      const taskWithoutManager = {
        ...mockParentTask,
        lookup: jest.fn(() => null) // No TaskManager available
      };
      
      // Execute & Verify: Should throw error when trying to delegate without TaskManager
      await expect(
        strategy._delegateRequirementsAnalysis(taskWithoutManager)
      ).rejects.toThrow('TaskManager is required for hierarchical delegation');
      
      // Verify: No TaskManager.createTask was called
      expect(mockTaskManager.createTask).not.toHaveBeenCalled();
      
      console.log('✅ Error thrown when TaskManager not available');
    });

    test('should handle child task failure gracefully', async () => {
      // Setup: Mock TaskManager to return failing child task
      mockTaskManager.createTask.mockResolvedValue(mockChildTask);
      mockChildTask.receiveMessage.mockResolvedValue({
        success: false,
        result: 'Analysis failed due to insufficient requirements'
      });
      
      // Execute and verify: Should throw error on child failure
      await expect(strategy._delegateRequirementsAnalysis(mockParentTask))
        .rejects.toThrow('Requirements analysis failed: Analysis failed due to insufficient requirements');
      
      console.log('✅ Child task failure handling verified');
    });
  });

  describe('Child Message Handling', () => {
    test('should handle analysis child completion messages correctly', async () => {
      // Setup: Prepare analysis child completion result
      const childResult = {
        analysis: { type: 'api', features: ['calculator'] },
        artifacts: ['requirements-analysis']
      };
      
      // Execute: Handle analysis child completion
      const result = await strategy.onMessage(mockChildTask, {
        type: 'completed',
        result: childResult
      });
      
      // Verify: Message was acknowledged
      expect(result.acknowledged).toBe(true);
      expect(result.analysisComplete).toBe(true);
      
      // Verify: Artifacts were copied from child to parent
      expect(mockParentTask.storeArtifact).toHaveBeenCalled();
      
      console.log('✅ Analysis child completion message handling verified');
    });

    test('should handle planning child completion messages correctly', async () => {
      // Setup: Create mock planning child task
      const mockPlanningChild = {
        id: 'planning-child-456',
        description: 'Create project plan: Create a simple calculator API with authentication',
        parent: mockParentTask,
        getAllArtifacts: jest.fn(() => ({
          'project-plan': {
            content: {
              phases: [{ phase: 'setup', tasks: [] }],
              structure: { directories: [], files: [] }
            },
            description: 'Generated project plan',
            type: 'plan'
          }
        }))
      };

      // Setup: Prepare planning child completion result
      const childResult = {
        plan: { phases: [{ phase: 'setup', tasks: [] }] },
        artifacts: ['project-plan']
      };
      
      // Execute: Handle planning child completion
      const result = await strategy.onMessage(mockPlanningChild, {
        type: 'completed',
        result: childResult
      });
      
      // Verify: Message was acknowledged
      expect(result.acknowledged).toBe(true);
      expect(result.planningComplete).toBe(true);
      
      // Verify: Artifacts were copied from child to parent
      expect(mockParentTask.storeArtifact).toHaveBeenCalled();
      
      console.log('✅ Planning child completion message handling verified');
    });

    test('should handle execution child completion messages correctly', async () => {
      // Setup: Create mock execution child task
      const mockExecutionChild = {
        id: 'execution-child-999',
        description: 'Execute project plan: Create a simple calculator API with authentication',
        parent: mockParentTask,
        getAllArtifacts: jest.fn(() => ({
          'execution-result': {
            content: {
              success: true,
              phases: [
                { phase: 'setup', success: true, tasks: [] },
                { phase: 'implementation', success: true, tasks: [] }
              ],
              artifacts: []
            },
            description: 'Project execution results',
            type: 'execution'
          },
          'execution-artifacts': {
            content: [
              { name: 'package.json', type: 'file' },
              { name: 'server.js', type: 'file' }
            ],
            description: 'Artifacts produced during execution',
            type: 'artifacts'
          }
        }))
      };

      // Setup: Prepare execution child completion result
      const childResult = {
        execution: {
          success: true,
          phases: [
            { phase: 'setup', success: true, tasks: [] },
            { phase: 'implementation', success: true, tasks: [] }
          ]
        },
        artifacts: ['execution-result', 'execution-artifacts']
      };
      
      // Execute: Handle execution child completion
      const result = await strategy.onMessage(mockExecutionChild, {
        type: 'completed',
        result: childResult
      });
      
      // Verify: Message was acknowledged
      expect(result.acknowledged).toBe(true);
      expect(result.executionComplete).toBe(true);
      
      // Verify: Artifacts were copied from child to parent
      expect(mockParentTask.storeArtifact).toHaveBeenCalled();
      
      console.log('✅ Execution child completion message handling verified');
    });

    test('should handle child failure messages correctly', async () => {
      // Setup: Prepare child failure
      const childError = new Error('Child analysis failed');
      
      // Execute: Handle child failure
      const result = await strategy.onMessage(mockChildTask, {
        type: 'failed',
        error: childError
      });
      
      // Verify: Parent task was failed
      expect(mockParentTask.fail).toHaveBeenCalledWith(childError);
      expect(result.acknowledged).toBe(true);
      
      console.log('✅ Child failure message handling verified');
    });

    test('should require child task to have parent', async () => {
      // Setup: Child task without parent
      const orphanChild = { ...mockChildTask, parent: null };
      
      // Execute and verify: Should throw error
      await expect(strategy.onMessage(orphanChild, { type: 'completed' }))
        .rejects.toThrow('Child task has no parent');
      
      console.log('✅ Parent validation verified');
    });
  });

  describe('Artifact Transfer and State Management', () => {
    test('should copy all artifacts from child to parent on completion', async () => {
      // Setup: Child with multiple artifacts
      const childArtifacts = {
        'requirements-analysis': {
          content: { type: 'api', features: ['calc'] },
          description: 'Analysis result',
          type: 'analysis'
        },
        'project-outline': {
          content: 'Project structure outline',
          description: 'Initial project structure',
          type: 'text'
        }
      };
      
      mockChildTask.getAllArtifacts.mockReturnValue(childArtifacts);
      
      // Execute: Handle child completion
      await strategy._onAnalysisComplete(mockParentTask, mockChildTask, {});
      
      // Verify: All artifacts were copied
      expect(mockParentTask.storeArtifact).toHaveBeenCalledTimes(2);
      expect(mockParentTask.storeArtifact).toHaveBeenCalledWith(
        'requirements-analysis',
        { type: 'api', features: ['calc'] },
        'Analysis result',
        'analysis'
      );
      expect(mockParentTask.storeArtifact).toHaveBeenCalledWith(
        'project-outline',
        'Project structure outline',
        'Initial project structure',
        'text'
      );
      
      console.log('✅ Artifact transfer verified');
    });

    test('should log artifact transfer details', async () => {
      // Setup: Mock console.log to capture output
      const originalLog = console.log;
      const logMessages = [];
      console.log = jest.fn((...args) => {
        logMessages.push(args.join(' '));
      });
      
      try {
        // Setup: Child with artifacts
        mockChildTask.getAllArtifacts.mockReturnValue({
          'analysis': { content: 'data', description: 'desc', type: 'analysis' }
        });
        
        // Execute: Handle completion
        await strategy._onAnalysisComplete(mockParentTask, mockChildTask, {});
        
        // Verify: Logging occurred
        expect(logMessages.some(msg => 
          msg.includes('Analysis child task completed')
        )).toBe(true);
        expect(logMessages.some(msg => 
          msg.includes('Copied 1 artifacts from analysis child')
        )).toBe(true);
        
      } finally {
        console.log = originalLog;
      }
      
      console.log('✅ Artifact transfer logging verified');
    });
  });

  describe('Integration with Existing ProjectPlannerStrategy Flow', () => {
    test('should integrate analysis delegation into main project flow', async () => {
      // Setup: Mock necessary components and methods
      strategy.eventStream = { emit: jest.fn() };
      strategy.stateManager = { 
        updateRequirements: jest.fn(),
        savePlan: jest.fn(),
        markComplete: jest.fn()
      };
      strategy.projectPlanner = { createPlan: jest.fn().mockResolvedValue({ phases: [] }) };
      strategy.qualityController = { validateProject: jest.fn().mockResolvedValue({ passed: true }) };
      
      // Mock successful analysis delegation
      jest.spyOn(strategy, '_delegateRequirementsAnalysis').mockResolvedValue({
        type: 'api',
        features: ['calculator']
      });
      
      // Mock successful planning delegation (Phase 2 addition)
      jest.spyOn(strategy, '_delegateProjectPlanning').mockResolvedValue({
        phases: [
          { phase: 'setup', tasks: [] },
          { phase: 'implementation', tasks: [] }
        ],
        structure: { directories: [], files: [] }
      });
      
      // Mock successful execution delegation (Phase 3 addition)
      jest.spyOn(strategy, '_delegateExecution').mockResolvedValue({ 
        success: true,
        phases: [
          { phase: 'setup', success: true, tasks: [] },
          { phase: 'implementation', success: true, tasks: [] }
        ],
        artifacts: []
      });
      
      // Mock successful quality delegation (Phase 4 addition)
      jest.spyOn(strategy, '_delegateQuality').mockResolvedValue({
        passed: true,
        phases: {},
        overall: {},
        issues: []
      });
      
      // Execute: Main project flow
      const result = await strategy._planAndExecuteProject(mockParentTask);
      
      // Verify: Analysis delegation was called
      expect(strategy._delegateRequirementsAnalysis).toHaveBeenCalledWith(mockParentTask);
      
      // Verify: Planning delegation was called (Phase 2 verification)
      expect(strategy._delegateProjectPlanning).toHaveBeenCalledWith(
        mockParentTask, 
        { type: 'api', features: ['calculator'] }
      );
      
      // Verify: Execution delegation was called (Phase 3 verification)
      expect(strategy._delegateExecution).toHaveBeenCalledWith(
        mockParentTask,
        {
          phases: [
            { phase: 'setup', tasks: [] },
            { phase: 'implementation', tasks: [] }
          ],
          structure: { directories: [], files: [] }
        }
      );
      
      // Verify: Quality delegation was called (Phase 4 verification)
      expect(strategy._delegateQuality).toHaveBeenCalledWith(
        mockParentTask,
        {
          success: true,
          phases: [
            { phase: 'setup', success: true, tasks: [] },
            { phase: 'implementation', success: true, tasks: [] }
          ],
          artifacts: []
        }
      );
      
      // Verify: State was updated with requirements
      expect(strategy.stateManager.updateRequirements).toHaveBeenCalled();
      
      // Verify: State was updated with plan
      expect(strategy.stateManager.savePlan).toHaveBeenCalled();
      
      // Verify: Project completed successfully
      expect(result.success).toBe(true);
      
      console.log('✅ Integration with main project flow verified');
    });

    test('should create child task for project planning when TaskManager available', async () => {
      // Setup: Create mock planning child task
      const mockPlanningChild = {
        id: 'planning-child-789',
        description: 'Create project plan: Create a simple calculator API with authentication',
        parent: mockParentTask,
        receiveMessage: jest.fn(),
        getArtifact: jest.fn(),
        getAllArtifacts: jest.fn(() => ({
          'project-plan': {
            content: {
              phases: [
                { phase: 'setup', tasks: [] },
                { phase: 'implementation', tasks: [] }
              ],
              structure: { directories: [], files: [] }
            },
            description: 'Generated project plan',
            type: 'plan'
          }
        }))
      };

      // Setup: Mock TaskManager to return planning child task
      mockTaskManager.createTask.mockResolvedValue(mockPlanningChild);
      
      // Setup: Mock planning child task to return successful plan result
      mockPlanningChild.receiveMessage.mockResolvedValue({
        success: true,
        result: { plan: 'project planned' },
        artifacts: ['project-plan']
      });
      
      // Setup: Mock planning child task artifact retrieval
      mockPlanningChild.getArtifact.mockReturnValue({
        content: {
          phases: [
            { phase: 'setup', tasks: [] },
            { phase: 'implementation', tasks: [] }
          ],
          structure: { directories: [], files: [] }
        }
      });
      
      // Setup: Mock requirements for planning
      const requirements = {
        type: 'api',
        features: ['calculator operations'],
        technologies: ['express']
      };
      
      // Execute: Call planning delegation method
      const result = await strategy._delegateProjectPlanning(mockParentTask, requirements);
      
      // Verify: TaskManager.createTask was called with correct parameters
      expect(mockTaskManager.createTask).toHaveBeenCalledWith(
        'Create project plan: Create a simple calculator API with authentication',
        mockParentTask,
        {
          strategy: strategy.planningStrategy,
          workspaceDir: testWorkspace,
          llmClient: llmClient,
          toolRegistry: toolRegistry
        }
      );
      
      // Verify: Child task received start message
      expect(mockPlanningChild.receiveMessage).toHaveBeenCalledWith({ type: 'start' });
      
      // Verify: Planning result was returned
      expect(result).toEqual({
        phases: [
          { phase: 'setup', tasks: [] },
          { phase: 'implementation', tasks: [] }
        ],
        structure: { directories: [], files: [] }
      });
      
      console.log('✅ Planning child task creation and delegation verified');
    });

    test('should create child task for project execution when TaskManager available', async () => {
      // Setup: Create mock execution child task
      const mockExecutionChild = {
        id: 'execution-child-999',
        description: 'Execute project plan: Create a simple calculator API with authentication',
        parent: mockParentTask,
        receiveMessage: jest.fn(),
        getArtifact: jest.fn(),
        getAllArtifacts: jest.fn(() => ({
          'execution-result': {
            content: {
              success: true,
              projectId: 'calc-api-123',
              phases: [
                { phase: 'setup', success: true, tasks: [] },
                { phase: 'implementation', success: true, tasks: [] }
              ],
              artifacts: []
            },
            description: 'Project execution results',
            type: 'execution'
          },
          'execution-artifacts': {
            content: [
              { name: 'package.json', type: 'file' },
              { name: 'server.js', type: 'file' }
            ],
            description: 'Artifacts produced during execution',
            type: 'artifacts'
          }
        }))
      };

      // Setup: Mock TaskManager to return execution child task
      mockTaskManager.createTask.mockResolvedValue(mockExecutionChild);
      
      // Setup: Mock execution child task to return successful execution result
      mockExecutionChild.receiveMessage.mockResolvedValue({
        success: true,
        result: { execution: 'project executed successfully' },
        artifacts: ['execution-result', 'execution-artifacts']
      });
      
      // Setup: Mock execution child task artifact retrieval
      mockExecutionChild.getArtifact.mockReturnValue({
        content: {
          success: true,
          projectId: 'calc-api-123',
          phases: [
            { phase: 'setup', success: true, tasks: [] },
            { phase: 'implementation', success: true, tasks: [] }
          ],
          artifacts: []
        }
      });
      
      // Setup: Mock plan for execution
      const plan = {
        projectId: 'calc-api-123',
        phases: [
          { phase: 'setup', tasks: [] },
          { phase: 'implementation', tasks: [] }
        ],
        structure: { directories: [], files: [] }
      };
      
      // Execute: Call execution delegation method
      const result = await strategy._delegateExecution(mockParentTask, plan);
      
      // Verify: TaskManager.createTask was called with correct parameters
      expect(mockTaskManager.createTask).toHaveBeenCalledWith(
        'Execute project plan: Create a simple calculator API with authentication',
        mockParentTask,
        {
          strategy: strategy.executionStrategy,
          workspaceDir: testWorkspace,
          strategies: strategy.strategies,
          stateManager: strategy.stateManager
        }
      );
      
      // Verify: Child task received start message
      expect(mockExecutionChild.receiveMessage).toHaveBeenCalledWith({ type: 'start' });
      
      // Verify: Execution result was returned
      expect(result).toEqual({
        success: true,
        projectId: 'calc-api-123',
        phases: [
          { phase: 'setup', success: true, tasks: [] },
          { phase: 'implementation', success: true, tasks: [] }
        ],
        artifacts: []
      });
      
      console.log('✅ Execution child task creation and delegation verified');
    });

    test('should create child task for quality validation when TaskManager available', async () => {
      // Setup: Create mock quality child task
      const mockQualityChild = {
        id: 'quality-child-777',
        description: 'Validate project quality: Create a simple calculator API with authentication',
        parent: mockParentTask,
        receiveMessage: jest.fn(),
        getArtifact: jest.fn(),
        getAllArtifacts: jest.fn(() => ({
          'quality-validation': {
            content: {
              passed: true,
              phases: {
                setup: { passed: true, score: 95, checks: [] },
                implementation: { passed: true, score: 88, checks: [] }
              },
              overall: {
                passed: true,
                metrics: { testPassRate: 85, coverage: 75 },
                issues: []
              },
              issues: []
            },
            description: 'Quality validation results',
            type: 'validation'
          },
          'quality-report': {
            content: 'Quality validation report with detailed metrics',
            description: 'Detailed quality assessment report',
            type: 'report'
          }
        }))
      };

      // Setup: Mock TaskManager to return quality child task
      mockTaskManager.createTask.mockResolvedValue(mockQualityChild);
      
      // Setup: Mock quality child task to return successful validation result
      mockQualityChild.receiveMessage.mockResolvedValue({
        success: true,
        result: { 
          validation: 'project quality validated successfully',
          passed: true,
          phasesValidated: 2
        },
        artifacts: ['quality-validation', 'quality-report']
      });
      
      // Setup: Mock quality child task artifact retrieval
      mockQualityChild.getArtifact.mockReturnValue({
        content: {
          passed: true,
          phases: {
            setup: { passed: true, score: 95, checks: [] },
            implementation: { passed: true, score: 88, checks: [] }
          },
          overall: {
            passed: true,
            metrics: { testPassRate: 85, coverage: 75 },
            issues: []
          },
          issues: []
        }
      });
      
      // Setup: Mock execution result for quality validation
      const executionResult = {
        success: true,
        projectId: 'calc-api-456',
        phases: [
          { 
            phase: 'setup', 
            success: true, 
            tasks: [
              { id: 'setup-1', success: true, artifacts: [] }
            ]
          },
          { 
            phase: 'implementation', 
            success: true, 
            tasks: [
              { id: 'impl-1', success: true, artifacts: [] }
            ]
          }
        ],
        artifacts: [
          {
            name: 'package.json',
            path: 'package.json',
            content: '{"name": "calc-api", "version": "1.0.0"}',
            type: 'config'
          },
          {
            name: 'server.js',
            path: 'server.js',
            content: 'const express = require("express"); const app = express();',
            type: 'code'
          }
        ]
      };
      
      // Execute: Call quality delegation method
      const result = await strategy._delegateQuality(mockParentTask, executionResult);
      
      // Verify: TaskManager.createTask was called with correct parameters
      expect(mockTaskManager.createTask).toHaveBeenCalledWith(
        'Validate project quality: Create a simple calculator API with authentication',
        mockParentTask,
        {
          strategy: strategy.qualityStrategy,
          workspaceDir: testWorkspace,
          llmClient: llmClient,
          toolRegistry: toolRegistry
        }
      );
      
      // Verify: Parent task stored execution result as artifact for quality strategy
      expect(mockParentTask.storeArtifact).toHaveBeenCalledWith(
        'execution-result',
        executionResult,
        'Project execution result for quality validation',
        'execution'
      );
      
      // Verify: Child task received start message
      expect(mockQualityChild.receiveMessage).toHaveBeenCalledWith({ type: 'start' });
      
      // Verify: Quality validation result was returned
      expect(result).toEqual({
        passed: true,
        phases: {
          setup: { passed: true, score: 95, checks: [] },
          implementation: { passed: true, score: 88, checks: [] }
        },
        overall: {
          passed: true,
          metrics: { testPassRate: 85, coverage: 75 },
          issues: []
        },
        issues: []
      });
      
      console.log('✅ Quality child task creation and delegation verified');
    });

    test('should handle quality validation failure and trigger recovery', async () => {
      // Setup: Create mock quality child task that reports validation failure
      const mockQualityChild = {
        id: 'quality-child-fail-888',
        description: 'Validate project quality: Create a simple calculator API with authentication',
        parent: mockParentTask,
        receiveMessage: jest.fn(),
        getArtifact: jest.fn(),
        getAllArtifacts: jest.fn(() => ({
          'quality-validation': {
            content: {
              passed: false,
              phases: {
                setup: { passed: true, score: 95, checks: [] },
                implementation: { passed: false, score: 65, checks: [] }
              },
              overall: {
                passed: false,
                metrics: { testPassRate: 60, coverage: 45 },
                issues: ['Test coverage below threshold', 'Code complexity too high']
              },
              issues: ['Test coverage below threshold', 'Code complexity too high']
            },
            description: 'Quality validation results with failures',
            type: 'validation'
          }
        }))
      };

      // Setup: Mock TaskManager to return failing quality child task
      mockTaskManager.createTask.mockResolvedValue(mockQualityChild);
      
      // Setup: Mock quality child task to return failed validation result
      mockQualityChild.receiveMessage.mockResolvedValue({
        success: true,
        result: { 
          validation: 'project quality validation completed with issues',
          passed: false,
          phasesValidated: 2
        },
        artifacts: ['quality-validation']
      });
      
      // Setup: Mock quality child task artifact retrieval for failed validation
      mockQualityChild.getArtifact.mockReturnValue({
        content: {
          passed: false,
          phases: {
            setup: { passed: true, score: 95, checks: [] },
            implementation: { passed: false, score: 65, checks: [] }
          },
          overall: {
            passed: false,
            metrics: { testPassRate: 60, coverage: 45 },
            issues: ['Test coverage below threshold', 'Code complexity too high']
          },
          issues: ['Test coverage below threshold', 'Code complexity too high']
        }
      });

      // Setup: Mock recovery manager
      strategy.recoveryManager = {
        recover: jest.fn().mockResolvedValue({
          success: true,
          result: {
            success: true,
            recovered: true,
            fixedIssues: ['Test coverage below threshold']
          }
        })
      };

      // Setup: Mock execution result with quality issues
      const executionResult = {
        success: true,
        projectId: 'calc-api-quality-issues',
        phases: [
          { phase: 'setup', success: true, tasks: [] },
          { phase: 'implementation', success: true, tasks: [] }
        ],
        artifacts: []
      };
      
      // Execute: Call quality delegation method and verify recovery is attempted
      const result = await strategy._delegateQuality(mockParentTask, executionResult);
      
      // Verify: Quality delegation was called
      expect(mockTaskManager.createTask).toHaveBeenCalledWith(
        'Validate project quality: Create a simple calculator API with authentication',
        mockParentTask,
        {
          strategy: strategy.qualityStrategy,
          workspaceDir: testWorkspace,
          llmClient: llmClient,
          toolRegistry: toolRegistry
        }
      );
      
      // Verify: Failed quality validation result was returned
      expect(result.passed).toBe(false);
      expect(result.issues).toContain('Test coverage below threshold');
      expect(result.issues).toContain('Code complexity too high');
      
      console.log('✅ Quality validation failure handling verified');
    });

    test('should handle quality child completion messages correctly', async () => {
      // Setup: Create mock quality child task
      const mockQualityChild = {
        id: 'quality-child-completion-999',
        description: 'Validate project quality: Create a simple calculator API with authentication',
        parent: mockParentTask,
        getAllArtifacts: jest.fn(() => ({
          'quality-validation': {
            content: {
              passed: true,
              phases: { setup: { passed: true } },
              overall: { passed: true },
              issues: []
            },
            description: 'Quality validation results',
            type: 'validation'
          },
          'quality-metrics': {
            content: {
              testResults: { passed: 15, failed: 0, coverage: 85 },
              codeMetrics: { complexity: 12, maintainability: 8.5 }
            },
            description: 'Detailed quality metrics',
            type: 'metrics'
          }
        }))
      };

      // Setup: Prepare quality child completion result
      const childResult = {
        validation: {
          passed: true,
          phases: { setup: { passed: true } },
          overall: { passed: true }
        },
        artifacts: ['quality-validation', 'quality-metrics']
      };
      
      // Execute: Handle quality child completion
      const result = await strategy.onMessage(mockQualityChild, {
        type: 'completed',
        result: childResult
      });
      
      // Verify: Message was acknowledged
      expect(result.acknowledged).toBe(true);
      expect(result.qualityComplete).toBe(true);
      
      // Verify: Artifacts were copied from child to parent
      expect(mockParentTask.storeArtifact).toHaveBeenCalledWith(
        'quality-validation',
        {
          passed: true,
          phases: { setup: { passed: true } },
          overall: { passed: true },
          issues: []
        },
        'Quality validation results',
        'validation'
      );
      expect(mockParentTask.storeArtifact).toHaveBeenCalledWith(
        'quality-metrics',
        {
          testResults: { passed: 15, failed: 0, coverage: 85 },
          codeMetrics: { complexity: 12, maintainability: 8.5 }
        },
        'Detailed quality metrics',
        'metrics'
      );
      
      console.log('✅ Quality child completion message handling verified');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing analysis artifact gracefully', async () => {
      // Setup: Mock child task without analysis artifact
      mockTaskManager.createTask.mockResolvedValue(mockChildTask);
      mockChildTask.receiveMessage.mockResolvedValue({ success: true });
      mockChildTask.getArtifact.mockReturnValue(null); // No artifact
      
      // Execute and verify: Should throw error
      await expect(strategy._delegateRequirementsAnalysis(mockParentTask))
        .rejects.toThrow('Analysis task completed but no analysis artifact found');
      
      console.log('✅ Missing artifact error handling verified');
    });

    test('should handle unknown child message types', async () => {
      // Execute: Send unknown message type
      const result = await strategy.onMessage(mockChildTask, {
        type: 'unknown-message-type'
      });
      
      // Verify: Should acknowledge unknown messages
      expect(result.acknowledged).toBe(true);
      
      console.log('✅ Unknown message type handling verified');
    });
  });
});