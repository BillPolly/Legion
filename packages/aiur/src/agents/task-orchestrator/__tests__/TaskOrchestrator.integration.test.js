/**
 * TaskOrchestrator Integration Tests
 * 
 * Comprehensive test suite for the complete TaskOrchestrator workflow:
 * - Plan generation using ProfilePlannerModule
 * - Plan validation using PlanInspectorTool
 * - Plan execution using PlanExecutor
 * - Actor protocol communication
 * - Error handling and recovery
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { TaskOrchestratorTestActor } from './TaskOrchestratorTestActor.js';

describe('TaskOrchestrator Integration Tests', () => {
  let testActor;
  
  beforeAll(async () => {
    testActor = new TaskOrchestratorTestActor();
    // Initialize happens automatically on first use
  });
  
  afterAll(async () => {
    if (testActor) {
      testActor.destroy();
    }
  });
  
  beforeEach(() => {
    testActor.reset();
  });
  
  describe('Actor Protocol Communication', () => {
    test('should initialize TaskOrchestrator via actor protocol', async () => {
      // The test actor should initialize successfully
      await testActor.initialize();
      
      const state = testActor.getOrchestratorState();
      expect(state).toBeTruthy();
      expect(state.planningState).toBe('idle');
      expect(state.executionState).toBe('idle');
    });
    
    test('should handle unknown message types gracefully', async () => {
      await testActor.receive({
        type: 'unknown_command',
        data: 'test'
      });
      
      // Should not crash, just log warning
      const state = testActor.getOrchestratorState();
      expect(state.planningState).toBe('idle');
    });
  });
  
  describe('Complete Planning Workflow', () => {
    test('should generate and validate a plan via actor protocol', async () => {
      const taskDescription = 'create a simple node server that returns "hello world"';
      
      // Start planning task
      await testActor.startPlanningTask(taskDescription);
      
      // Wait for planning to complete (increased timeout for LLM calls)
      await testActor.waitForState('complete', 60000);
      
      // Check final state
      const state = testActor.getOrchestratorState();
      expect(state.planningState).toBe('idle'); // Returns to idle after complete
      expect(state.hasValidationResult).toBe(true);
      
      // Check messages were sent
      const messages = testActor.getMessages();
      expect(messages.length).toBeGreaterThan(0);
      
      // Should have completion message
      const completionMessage = messages.find(msg => msg.type === 'orchestrator_complete');
      expect(completionMessage).toBeTruthy();
      expect(completionMessage.message).toContain('validated successfully');
      
      // Should have created artifacts
      const artifacts = testActor.getArtifacts();
      expect(artifacts.length).toBeGreaterThan(0);
      
    }, 90000); // 90 second timeout for LLM operations
    
    test('should handle planning errors gracefully', async () => {
      // Try to start task with invalid parameters
      await testActor.receive({
        type: 'start_task',
        // Missing description
      });
      
      // Should handle error without crashing
      const state = testActor.getOrchestratorState();
      expect(state.planningState).toBe('idle');
    });
  });
  
  describe('Plan Validation', () => {
    test('should validate plan structure and tools', async () => {
      const taskDescription = 'create a simple express server with one endpoint';
      
      // Start planning
      await testActor.startPlanningTask(taskDescription);
      
      // Wait for completion
      await testActor.waitForState('complete', 60000);
      
      // Check validation results
      const state = testActor.getOrchestratorState();
      expect(state.hasValidationResult).toBe(true);
      
      // Check messages contain validation information
      const messages = testActor.getMessages();
      const validationMessage = messages.find(msg => 
        msg.message && msg.message.includes('Plan Analysis')
      );
      expect(validationMessage).toBeTruthy();
      
    }, 90000);
    
    test('should handle validation failures', async () => {
      // Create a mock plan with invalid structure
      const invalidPlan = {
        // Missing required fields like 'id' and 'steps'
        name: 'Invalid Plan'
      };
      
      // Try to execute invalid plan
      await testActor.executePlan(invalidPlan);
      
      // Should handle error gracefully
      const messages = testActor.getMessages();
      const errorMessage = messages.find(msg => msg.type === 'orchestrator_error');
      expect(errorMessage).toBeTruthy();
    });
  });
  
  describe('Plan Execution', () => {
    test('should execute a validated plan', async () => {
      // First generate a plan
      const taskDescription = 'create a simple node script that logs hello world';
      await testActor.startPlanningTask(taskDescription);
      await testActor.waitForState('complete', 60000);
      
      // Get the generated plan from artifacts
      const artifacts = testActor.getArtifacts();
      expect(artifacts.length).toBeGreaterThan(0);
      
      const planArtifact = artifacts.find(a => a.data.artifacts && a.data.artifacts[0]);
      expect(planArtifact).toBeTruthy();
      
      const plan = JSON.parse(planArtifact.data.artifacts[0].content);
      expect(plan.status).toBe('validated');
      
      // Reset for execution test
      testActor.reset();
      
      // Execute the plan
      await testActor.executePlan(plan, {
        workspaceDir: '/tmp/taskorch-test'
      });
      
      // Wait for execution to complete
      await testActor.waitForState('complete', 120000);
      
      // Check execution results
      const messages = testActor.getMessages();
      const completionMessage = messages.find(msg => 
        msg.type === 'orchestrator_complete' && 
        msg.message.includes('execution completed')
      );
      expect(completionMessage).toBeTruthy();
      
    }, 180000); // 3 minute timeout for full workflow
    
    test('should handle execution errors gracefully', async () => {
      // Create a plan with an action that will fail
      const problematicPlan = {
        id: 'test-plan',
        name: 'Test Plan',
        status: 'validated',
        steps: [{
          id: 'step1',
          name: 'Bad Step',
          actions: [{
            type: 'nonexistent_tool',
            parameters: {}
          }]
        }]
      };
      
      // Try to execute problematic plan
      await testActor.executePlan(problematicPlan);
      
      // Should handle execution errors
      const messages = testActor.getMessages();
      const errorMessage = messages.find(msg => 
        msg.message && msg.message.includes('Tool not found')
      );
      expect(errorMessage).toBeTruthy();
    });
  });
  
  describe('User Interaction During Execution', () => {
    test('should handle user commands during planning', async () => {
      // Start a planning task
      testActor.startPlanningTask('create a complex web application');
      
      // Wait a moment for planning to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send status request
      await testActor.sendUserMessage('status');
      
      // Should get status response
      const messages = testActor.getMessages();
      const statusMessage = messages.find(msg => 
        msg.message && (msg.message.includes('Planning:') || msg.message.includes('Execution:'))
      );
      expect(statusMessage).toBeTruthy();
    });
    
    test('should handle cancellation requests', async () => {
      // Start a task
      testActor.startPlanningTask('create something complex');
      
      // Wait for planning to start
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Cancel the task
      await testActor.sendUserMessage('cancel');
      
      // Should be cancelled
      const state = testActor.getOrchestratorState();
      expect(state.planningState).toBe('idle');
    });
  });
  
  describe('State Management', () => {
    test('should maintain proper state transitions during planning', async () => {
      const taskDescription = 'create a simple test application';
      
      // Initial state
      let state = testActor.getOrchestratorState();
      expect(state.planningState).toBe('idle');
      
      // Start planning
      testActor.startPlanningTask(taskDescription);
      
      // Should transition to planning
      await testActor.waitForState('planning', 5000);
      state = testActor.getOrchestratorState();
      expect(state.planningState).toBe('planning');
      
      // Wait for completion
      await testActor.waitForState('complete', 60000);
      
      // Should return to idle
      state = testActor.getOrchestratorState();
      expect(state.planningState).toBe('idle');
      
    }, 90000);
    
    test('should prevent multiple concurrent tasks', async () => {
      // Start first task
      testActor.startPlanningTask('first task');
      
      // Wait for it to start
      await testActor.waitForState('planning', 5000);
      
      // Try to start second task
      await testActor.startPlanningTask('second task');
      
      // Should reject the second task
      const messages = testActor.getMessages();
      const rejectionMessage = messages.find(msg => 
        msg.message && msg.message.includes('already working')
      );
      expect(rejectionMessage).toBeTruthy();
    });
  });
  
  describe('Error Recovery', () => {
    test('should recover from LLM errors during planning', async () => {
      // This test would require mocking LLM failures
      // For now, just ensure the system doesn't crash on errors
      
      const taskDescription = ''; // Empty description might cause issues
      
      await testActor.startPlanningTask(taskDescription);
      
      // Should handle gracefully without crashing
      const state = testActor.getOrchestratorState();
      expect(state).toBeTruthy();
    });
    
    test('should clean up resources after errors', async () => {
      // Force an error by passing invalid data
      await testActor.receive({
        type: 'execute_plan',
        plan: null // Invalid plan
      });
      
      // Should return to clean state
      const state = testActor.getOrchestratorState();
      expect(state.planningState).toBe('idle');
      expect(state.executionState).toBe('idle');
    });
  });
  
  describe('Performance and Reliability', () => {
    test('should handle rapid message sequences', async () => {
      // Send multiple rapid messages
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(testActor.sendUserMessage(`status ${i}`));
      }
      
      await Promise.all(promises);
      
      // Should handle all messages without errors
      const messages = testActor.getMessages();
      expect(messages.length).toBeGreaterThan(0);
    });
    
    test('should maintain state consistency', async () => {
      const initialState = testActor.getOrchestratorState();
      
      // Perform various operations
      await testActor.sendUserMessage('status');
      await testActor.sendUserMessage('invalid command');
      
      // State should remain consistent
      const finalState = testActor.getOrchestratorState();
      expect(finalState.planningState).toBe(initialState.planningState);
      expect(finalState.executionState).toBe(initialState.executionState);
    });
  });
});