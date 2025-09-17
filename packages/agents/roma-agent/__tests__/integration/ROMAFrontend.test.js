/**
 * Integration test for ROMA Agent Frontend
 * Tests the web server, WebSocket communication, and UI functionality
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ROMAAgent } from '../../src/ROMAAgent.js';
import ROMAServerActor from '../../src/actors/server/ROMAServerActor.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ROMA Frontend Integration', () => {
  let resourceManager;
  let romaServerActor;
  let mockClientActor;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(() => {
    // Create mock client actor to simulate WebSocket client
    mockClientActor = {
      messages: [],
      receive: function(messageType, data) {
        this.messages.push({ type: messageType, data, timestamp: new Date() });
        console.log('📨 [MOCK CLIENT] Received:', messageType);
      },
      getLastMessage: function(type) {
        return this.messages.filter(m => m.type === type).pop();
      },
      clearMessages: function() {
        this.messages = [];
      }
    };

    // Create server actor
    romaServerActor = new ROMAServerActor({ resourceManager });
  });

  afterAll(async () => {
    if (romaServerActor && romaServerActor.isReady) {
      await romaServerActor.shutdown();
    }
  });

  describe('Server Actor Functionality', () => {
    it('should initialize server actor correctly', async () => {
      expect(romaServerActor).toBeDefined();
      expect(romaServerActor.isReady).toBe(false);
      
      // Connect mock client
      await romaServerActor.setRemoteActor(mockClientActor);
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      expect(romaServerActor.isReady).toBe(true);
      expect(romaServerActor.romaAgent).toBeDefined();
      expect(romaServerActor.romaAgent.isInitialized).toBe(true);
    });

    it('should send ready signal to client on connection', async () => {
      await romaServerActor.setRemoteActor(mockClientActor);
      
      // Wait for ready signal
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const readyMessage = mockClientActor.getLastMessage('ready');
      expect(readyMessage).toBeDefined();
      expect(readyMessage.data.timestamp).toBeDefined();
      expect(readyMessage.data.agentStatus).toBeDefined();
      expect(readyMessage.data.statistics).toBeDefined();
    });

    it('should handle task execution requests', async () => {
      await romaServerActor.setRemoteActor(mockClientActor);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const executionId = 'test-exec-123';
      const task = {
        id: 'test-task',
        description: 'Calculate 10 + 15',
        tool: 'calculator',
        params: { expression: '10 + 15' }
      };

      // Send execute task message
      await romaServerActor.receive('execute_task', {
        executionId,
        task
      });

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check for execution started message
      const startedMessage = mockClientActor.getLastMessage('execution_started');
      expect(startedMessage).toBeDefined();
      expect(startedMessage.data.executionId).toBe(executionId);
      expect(startedMessage.data.task).toEqual(task);

      // Check for execution complete message
      const completeMessage = mockClientActor.getLastMessage('execution_complete');
      expect(completeMessage).toBeDefined();
      expect(completeMessage.data.executionId).toBe(executionId);
      expect(completeMessage.data.result).toBeDefined();
      expect(completeMessage.data.result.success).toBe(true);
    });

    it('should handle status requests', async () => {
      await romaServerActor.setRemoteActor(mockClientActor);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const requestId = 'status-req-123';
      
      await romaServerActor.receive('get_status', { requestId });

      const statusResponse = mockClientActor.getLastMessage('status_response');
      expect(statusResponse).toBeDefined();
      expect(statusResponse.data.requestId).toBe(requestId);
      expect(statusResponse.data.status).toBeDefined();
      expect(statusResponse.data.status.agent).toBeDefined();
    });

    it('should handle statistics requests', async () => {
      await romaServerActor.setRemoteActor(mockClientActor);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const requestId = 'stats-req-123';
      
      await romaServerActor.receive('get_statistics', { requestId });

      const statsResponse = mockClientActor.getLastMessage('statistics_response');
      expect(statsResponse).toBeDefined();
      expect(statsResponse.data.requestId).toBe(requestId);
      expect(statsResponse.data.statistics).toBeDefined();
    });

    it('should handle error conditions gracefully', async () => {
      await romaServerActor.setRemoteActor(mockClientActor);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const executionId = 'error-test-123';
      const task = {
        id: 'error-task',
        description: 'This will fail',
        tool: 'non-existent-tool'
      };

      await romaServerActor.receive('execute_task', {
        executionId,
        task
      });

      // Wait for error
      await new Promise(resolve => setTimeout(resolve, 2000));

      const errorMessage = mockClientActor.getLastMessage('execution_error');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.data.executionId).toBe(executionId);
      expect(errorMessage.data.error).toBeDefined();
    });
  });

  describe('Actor Framework Integration', () => {
    it('should maintain proper actor communication patterns', async () => {
      await romaServerActor.setRemoteActor(mockClientActor);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // All messages should follow actor framework patterns
      const allMessages = mockClientActor.messages;
      expect(allMessages.length).toBeGreaterThan(0);

      // Each message should have type and data
      allMessages.forEach(message => {
        expect(message.type).toBeDefined();
        expect(message.data).toBeDefined();
        expect(message.timestamp).toBeDefined();
      });
    });

    it('should handle rapid message sequences', async () => {
      await romaServerActor.setRemoteActor(mockClientActor);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Send multiple requests rapidly
      const requests = [
        { type: 'get_status', data: { requestId: 'req1' } },
        { type: 'get_statistics', data: { requestId: 'req2' } },
        { type: 'get_status', data: { requestId: 'req3' } }
      ];

      // Send all requests
      for (const request of requests) {
        await romaServerActor.receive(request.type, request.data);
      }

      // Wait for responses
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should have responses for all requests
      const responses = mockClientActor.messages.filter(m => 
        m.type.includes('_response')
      );
      expect(responses.length).toBe(3);
    });
  });

  describe('Actor Status and Health', () => {
    it('should provide accurate status information', async () => {
      await romaServerActor.setRemoteActor(mockClientActor);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const status = romaServerActor.getStatus();
      
      expect(status.isReady).toBe(true);
      expect(status.romaAgentReady).toBe(true);
      expect(status.activeExecutionsCount).toBe(0);
      expect(status.agentStatistics).toBeDefined();
    });

    it('should track active executions properly', async () => {
      await romaServerActor.setRemoteActor(mockClientActor);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const status1 = romaServerActor.getStatus();
      expect(status1.activeExecutionsCount).toBe(0);

      // Start an execution
      const executionId = 'track-test-123';
      const task = {
        id: 'track-task',
        description: 'Calculate 5 * 5',
        tool: 'calculator',
        params: { expression: '5 * 5' }
      };

      romaServerActor.receive('execute_task', { executionId, task });

      // Check active executions increased
      const status2 = romaServerActor.getStatus();
      expect(status2.activeExecutionsCount).toBe(1);

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should return to 0 active executions
      const status3 = romaServerActor.getStatus();
      expect(status3.activeExecutionsCount).toBe(0);
    });
  });
});