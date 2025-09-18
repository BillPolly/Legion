/**
 * Integration tests for ROMAServerActor with SimpleROMAAgent
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ROMAServerActor from '../../src/actors/server/ROMAServerActor.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('ROMAServerActor Integration', () => {
  let serverActor;
  let mockRemoteActor;
  let receivedMessages;

  beforeEach(async () => {
    // Initialize singletons
    await ResourceManager.getInstance();
    await ToolRegistry.getInstance();

    // Create mock remote actor
    receivedMessages = [];
    mockRemoteActor = {
      receive: jest.fn((messageType, data) => {
        receivedMessages.push({ type: messageType, data });
      })
    };

    // Create server actor
    serverActor = new ROMAServerActor();
  });

  describe('Initialization', () => {
    it('should initialize and send ready message', async () => {
      await serverActor.setRemoteActor(mockRemoteActor);

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Should have sent ready message
      const readyMessage = receivedMessages.find(m => m.type === 'ready');
      expect(readyMessage).toBeDefined();
      expect(readyMessage.data.agentStatus.isInitialized).toBe(true);
      expect(readyMessage.data.statistics).toBeDefined();
    });
  });

  describe('Task Execution', () => {
    beforeEach(async () => {
      await serverActor.setRemoteActor(mockRemoteActor);
      await new Promise(resolve => setTimeout(resolve, 1500));
      receivedMessages = []; // Clear initialization messages
    });

    it('should execute a simple task', async () => {
      const executionId = 'test-exec-1';
      const task = {
        id: 'task-1',
        description: 'Calculate 10 + 20 using calculator'
      };

      await serverActor.receive('execute_task', {
        executionId,
        task
      });

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should have sent execution_started
      const startedMessage = receivedMessages.find(m => m.type === 'execution_started');
      expect(startedMessage).toBeDefined();
      expect(startedMessage.data.executionId).toBe(executionId);

      // Should have sent execution_complete or execution_error
      const completeMessage = receivedMessages.find(m => 
        m.type === 'execution_complete' || m.type === 'execution_error'
      );
      expect(completeMessage).toBeDefined();
      
      if (completeMessage.type === 'execution_complete') {
        expect(completeMessage.data.result).toBeDefined();
        expect(completeMessage.data.statistics).toBeDefined();
      }
    }, 60000);

    it('should handle task errors gracefully', async () => {
      const executionId = 'test-exec-2';
      const task = {
        id: 'task-2',
        description: 'Use a non-existent-tool-xyz'
      };

      await serverActor.receive('execute_task', {
        executionId,
        task
      });

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should have sent execution_started
      const startedMessage = receivedMessages.find(m => m.type === 'execution_started');
      expect(startedMessage).toBeDefined();

      // Should have completed (either successfully with decomposition or with error)
      const finalMessage = receivedMessages.find(m => 
        m.type === 'execution_complete' || m.type === 'execution_error'
      );
      expect(finalMessage).toBeDefined();
    }, 60000);
  });

  describe('Status and Statistics', () => {
    beforeEach(async () => {
      await serverActor.setRemoteActor(mockRemoteActor);
      await new Promise(resolve => setTimeout(resolve, 1500));
      receivedMessages = [];
    });

    it('should respond to status requests', async () => {
      const requestId = 'req-1';
      
      await serverActor.receive('get_status', { requestId });
      
      await new Promise(resolve => setTimeout(resolve, 100));

      const statusResponse = receivedMessages.find(m => m.type === 'status_response');
      expect(statusResponse).toBeDefined();
      expect(statusResponse.data.requestId).toBe(requestId);
      expect(statusResponse.data.status).toBeDefined();
      expect(statusResponse.data.status.agent).toBeDefined();
    });

    it('should respond to statistics requests', async () => {
      const requestId = 'req-2';
      
      await serverActor.receive('get_statistics', { requestId });
      
      await new Promise(resolve => setTimeout(resolve, 100));

      const statsResponse = receivedMessages.find(m => m.type === 'statistics_response');
      expect(statsResponse).toBeDefined();
      expect(statsResponse.data.requestId).toBe(requestId);
      expect(statsResponse.data.statistics).toBeDefined();
      expect(statsResponse.data.statistics.totalExecutions).toBeDefined();
    });

    it('should track execution statistics', async () => {
      // Execute a task first
      const executionId = 'test-exec-stats';
      await serverActor.receive('execute_task', {
        executionId,
        task: { description: 'Calculate 5 * 5' }
      });

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get statistics
      const requestId = 'req-stats';
      await serverActor.receive('get_statistics', { requestId });
      
      await new Promise(resolve => setTimeout(resolve, 100));

      const statsResponse = receivedMessages.find(m => 
        m.type === 'statistics_response' && m.data.requestId === requestId
      );
      
      expect(statsResponse).toBeDefined();
      const stats = statsResponse.data.statistics;
      expect(stats.activeExecutions).toBeGreaterThanOrEqual(0);
    }, 60000);
  });

  describe('Execution History', () => {
    beforeEach(async () => {
      await serverActor.setRemoteActor(mockRemoteActor);
      await new Promise(resolve => setTimeout(resolve, 1500));
      receivedMessages = [];
    });

    it('should respond to execution history requests', async () => {
      const requestId = 'req-history';
      
      await serverActor.receive('get_execution_history', { requestId });
      
      await new Promise(resolve => setTimeout(resolve, 100));

      const historyResponse = receivedMessages.find(m => m.type === 'history_response');
      expect(historyResponse).toBeDefined();
      expect(historyResponse.data.requestId).toBe(requestId);
      expect(historyResponse.data.history).toBeDefined();
      expect(Array.isArray(historyResponse.data.history)).toBe(true);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', async () => {
      await serverActor.setRemoteActor(mockRemoteActor);
      await new Promise(resolve => setTimeout(resolve, 1500));

      await serverActor.shutdown();

      expect(serverActor.isReady).toBe(false);
      expect(serverActor.activeExecutions.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle messages when not ready', async () => {
      // Don't initialize the actor
      const result = await serverActor.receive('execute_task', {
        executionId: 'test',
        task: { description: 'Test' }
      });

      // Should not crash, just log warning
      expect(result).toBeUndefined();
    });

    it('should handle unknown message types', async () => {
      await serverActor.setRemoteActor(mockRemoteActor);
      await new Promise(resolve => setTimeout(resolve, 1500));

      await serverActor.receive('unknown_message_type', { data: 'test' });

      // Should not crash, just log warning
      expect(serverActor.isReady).toBe(true);
    });
  });

  describe('getStatus method', () => {
    it('should return current actor status', async () => {
      await serverActor.setRemoteActor(mockRemoteActor);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const status = serverActor.getStatus();

      expect(status.isReady).toBe(true);
      expect(status.romaAgentReady).toBe(true);
      expect(status.activeExecutionsCount).toBe(0);
      expect(status.agentStatistics).toBeDefined();
    });
  });
});