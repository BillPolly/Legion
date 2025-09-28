/**
 * Integration test for basic BT task functionality
 * Tests the complete flow of creating and using BT tasks
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BTTaskStrategy } from '../../src/core/BTTaskStrategy.js';
import { createBTTask } from '../../src/factory/createBTTask.js';

describe('Basic BT Task Integration', () => {
  let rootTask;
  let childTask1;
  let childTask2;
  
  beforeEach(() => {
    // Create a simple BT task hierarchy
    rootTask = createBTTask(
      'Root Sequence',
      null,
      BTTaskStrategy,
      { type: 'sequence', id: 'root-seq' }
    );
    
    childTask1 = createBTTask(
      'First Action',
      rootTask,
      BTTaskStrategy,
      { type: 'action', id: 'action-1', tool: 'file_write' }
    );
    
    childTask2 = createBTTask(
      'Second Action',
      rootTask,
      BTTaskStrategy,
      { type: 'action', id: 'action-2', tool: 'file_read' }
    );
  });
  
  describe('Task Creation with BTTaskStrategy', () => {
    it('should create BT tasks with correct prototype', () => {
      expect(Object.getPrototypeOf(rootTask)).toBe(BTTaskStrategy);
      expect(Object.getPrototypeOf(childTask1)).toBe(BTTaskStrategy);
      expect(Object.getPrototypeOf(childTask2)).toBe(BTTaskStrategy);
    });
    
    it('should have all standard task properties', () => {
      // Task properties
      expect(rootTask.id).toBeDefined();
      expect(rootTask.description).toBe('Root Sequence');
      expect(rootTask.status).toBe('pending');
      expect(rootTask.parent).toBeNull();
      expect(Array.isArray(rootTask.children)).toBe(true);
      
      // BT-specific properties
      expect(rootTask.config.nodeType).toBe('sequence');
      expect(rootTask.config.nodeId).toBe('root-seq');
    });
    
    it('should have BT-specific methods', () => {
      // From BTTaskStrategy
      expect(typeof rootTask.executeBTNode).toBe('function');
      expect(typeof rootTask.handleChildResult).toBe('function');
      expect(typeof rootTask.getNodeStatus).toBe('function');
      expect(typeof rootTask.resolveParameters).toBe('function');
      
      // From TaskStrategy
      expect(typeof rootTask.send).toBe('function');
      expect(typeof rootTask.start).toBe('function');
      expect(typeof rootTask.complete).toBe('function');
    });
  });
  
  describe('Message Passing Between BT Tasks', () => {
    it('should handle execute messages', () => {
      // Spy on executeBTNode
      const executeSpy = jest.spyOn(rootTask, 'executeBTNode');
      const startSpy = jest.spyOn(rootTask, 'start');
      
      // Send execute message
      rootTask.onMessage(rootTask, {
        type: 'execute',
        context: { workspaceDir: '/test' }
      });
      
      expect(executeSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
    });
    
    it('should handle child-result messages', () => {
      // Spy on handleChildResult
      const handleSpy = jest.spyOn(rootTask, 'handleChildResult');
      
      // Send child result
      rootTask.onMessage(childTask1, {
        type: 'child-result',
        status: 'SUCCESS',
        data: { result: 'test' }
      });
      
      expect(handleSpy).toHaveBeenCalledWith(childTask1, expect.objectContaining({
        type: 'child-result',
        status: 'SUCCESS'
      }));
    });
    
    it('should send messages between parent and child', async () => {
      // The send method in TaskStrategy uses defer() which is asynchronous
      // So we need to wait for the deferred execution
      const childOnMessage = childTask1.onMessage;
      let receivedMessage = null;
      let receivedSender = null;
      
      childTask1.onMessage = function(sender, message) {
        receivedSender = sender;
        receivedMessage = message;
      };
      
      // Parent sends to child
      rootTask.send(childTask1, {
        type: 'execute',
        context: { test: true }
      });
      
      // Wait for deferred execution (microtask)
      await new Promise(resolve => setImmediate(resolve));
      
      expect(receivedSender).toBe(rootTask);
      expect(receivedMessage).toEqual({
        type: 'execute',
        context: { test: true }
      });
      
      // Restore original method
      childTask1.onMessage = childOnMessage;
    });
  });
  
  describe('Artifact Storage and Retrieval', () => {
    it('should store artifacts in BT tasks', () => {
      rootTask.storeArtifact('testData', { value: 42 });
      
      const artifact = rootTask.getArtifact('testData');
      // Artifacts are stored with metadata
      expect(artifact.value).toEqual({ value: 42 });
      expect(artifact.name).toBe('testData');
    });
    
    it('should resolve artifact references with @ syntax', () => {
      const context = {
        artifacts: {
          template: 'Hello {{name}}',
          config: {
            name: 'World'
          }
        }
      };
      
      const params = {
        input: '@template',
        data: '@config.name',
        literal: 'test'
      };
      
      const resolved = rootTask.resolveParameters(params, context);
      
      expect(resolved.input).toBe('Hello {{name}}');
      expect(resolved.data).toBe('World');
      expect(resolved.literal).toBe('test');
    });
    
    it('should handle artifact flow between tasks', () => {
      // Parent stores artifact
      rootTask.storeArtifact('sharedData', { count: 1 });
      
      // Get the actual artifact structure
      const sharedArtifact = rootTask.getArtifact('sharedData');
      
      // Child can access parent's artifacts through context
      const context = {
        artifacts: {
          sharedData: sharedArtifact.value  // Use the value from the artifact
        }
      };
      
      const params = {
        input: '@sharedData.count'
      };
      
      const resolved = childTask1.resolveParameters(params, context);
      expect(resolved.input).toBe(1);
    });
  });
  
  describe('Node Status Mapping', () => {
    it('should map task status to BT status correctly', () => {
      rootTask.status = 'pending';
      expect(rootTask.getNodeStatus()).toBe('PENDING');
      
      rootTask.status = 'in-progress';
      expect(rootTask.getNodeStatus()).toBe('RUNNING');
      
      rootTask.status = 'completed';
      expect(rootTask.getNodeStatus()).toBe('SUCCESS');
      
      rootTask.status = 'failed';
      expect(rootTask.getNodeStatus()).toBe('FAILURE');
    });
  });
  
  describe('BT Node Result Communication', () => {
    it('should send node results to parent', () => {
      // Spy on parent's send method
      const sendSpy = jest.spyOn(childTask1, 'send');
      
      // Child completes and sends result
      childTask1.sendNodeResult({
        status: 'SUCCESS',
        data: { output: 'test.txt' }
      });
      
      expect(sendSpy).toHaveBeenCalledWith(rootTask, {
        type: 'child-result',
        status: 'SUCCESS',
        data: { output: 'test.txt' },
        nodeId: 'action-1',
        nodeType: 'action'
      });
    });
    
    it('should complete BT node with appropriate task status', () => {
      const completeSpy = jest.spyOn(childTask1, 'complete');
      const failSpy = jest.spyOn(childTask1, 'fail');
      
      // Success case
      childTask1.completeBTNode({
        status: 'SUCCESS',
        data: { result: 'ok' }
      });
      
      expect(completeSpy).toHaveBeenCalledWith({ result: 'ok' });
      
      // Create new task for failure case
      const failTask = createBTTask(
        'Fail Task',
        rootTask,
        BTTaskStrategy,
        { type: 'action' }
      );
      
      const failTaskFailSpy = jest.spyOn(failTask, 'fail');
      
      // Failure case
      failTask.completeBTNode({
        status: 'FAILURE',
        error: 'Something went wrong'
      });
      
      expect(failTaskFailSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object)
      );
    });
  });
  
  describe('Context Propagation', () => {
    it('should propagate context through BT hierarchy', async () => {
      const context = {
        workspaceDir: '/project',
        toolRegistry: { getTool: jest.fn() },
        artifacts: {
          config: { debug: true }
        }
      };
      
      // Track what context is received by child
      let receivedContext = null;
      
      // Override executeChildren to actually send to child
      rootTask.executeChildren = function(ctx) {
        this.send(childTask1, {
          type: 'execute',
          context: ctx
        });
      };
      
      // Capture the context received by child
      const originalExecuteBTNode = childTask1.executeBTNode;
      childTask1.executeBTNode = function(sender, message) {
        receivedContext = message.context;
        originalExecuteBTNode.call(this, sender, message);
      };
      
      // Execute root with context
      rootTask.onMessage(rootTask, {
        type: 'execute',
        context: context
      });
      
      // Wait for deferred execution (microtask)
      await new Promise(resolve => setImmediate(resolve));
      
      // Verify child received the context
      expect(receivedContext).toEqual(context);
      expect(receivedContext.workspaceDir).toBe('/project');
    });
  });
});