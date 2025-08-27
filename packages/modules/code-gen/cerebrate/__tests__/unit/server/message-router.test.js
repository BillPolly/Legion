import { MessageRouter } from '../../../src/server/message-router.js';
import { WebSocketProtocol } from '../../../src/shared/protocol/WebSocketProtocol.js';
import { MessageProtocol } from '../../../src/shared/protocol/MessageProtocol.js';

describe('MessageRouter', () => {
  let messageRouter;
  let mockAgentController;
  let mockConnectionManager;

  beforeEach(() => {
    mockAgentController = {
      executeCommand: jest.fn().mockResolvedValue({ success: true, data: 'test result' }),
      isAvailable: jest.fn().mockReturnValue(true),
      getStatus: jest.fn().mockReturnValue({ status: 'ready' })
    };

    mockConnectionManager = {
      sendToSession: jest.fn(),
      broadcast: jest.fn(),
      getConnectionBySession: jest.fn().mockReturnValue({ sessionId: 'test-session-001' })
    };

    messageRouter = new MessageRouter({
      agentController: mockAgentController,
      connectionManager: mockConnectionManager
    });
  });

  afterEach(() => {
    messageRouter.destroy();
  });

  describe('Command Message Routing to Agent', () => {
    test('should route valid command message to agent', async () => {
      const commandMessage = MessageProtocol.createCommandMessage(
        'inspect_element',
        { selector: '.test-element' },
        'test-session-001'
      );

      await messageRouter.routeMessage(commandMessage, 'test-session-001');

      expect(mockAgentController.executeCommand).toHaveBeenCalledWith(
        'inspect_element',
        { selector: '.test-element' },
        expect.objectContaining({ sessionId: 'test-session-001' })
      );
    });

    test('should handle agent execution success', async () => {
      const commandMessage = MessageProtocol.createCommandMessage(
        'inspect_element',
        { selector: '.test-element' },
        'test-session-001'
      );

      const agentResult = { success: true, data: { element: { tag: 'div' } } };
      mockAgentController.executeCommand.mockResolvedValue(agentResult);

      await messageRouter.routeMessage(commandMessage, 'test-session-001');

      expect(mockConnectionManager.sendToSession).toHaveBeenCalledWith(
        'test-session-001',
        expect.objectContaining({
          type: 'response',
          payload: expect.objectContaining({
            status: 'success',
            command: 'inspect_element',
            data: agentResult.data
          })
        })
      );
    });

    test('should handle agent execution error', async () => {
      const commandMessage = MessageProtocol.createCommandMessage(
        'inspect_element',
        { selector: '.invalid' },
        'test-session-001'
      );

      const agentError = new Error('Invalid selector');
      mockAgentController.executeCommand.mockRejectedValue(agentError);

      await messageRouter.routeMessage(commandMessage, 'test-session-001');

      expect(mockConnectionManager.sendToSession).toHaveBeenCalledWith(
        'test-session-001',
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            error_code: 'AGENT_EXECUTION_ERROR',
            error_message: 'Invalid selector'
          })
        })
      );
    });

    test('should validate command before routing', async () => {
      const invalidMessage = {
        id: 'invalid-001',
        type: 'command',
        timestamp: new Date().toISOString(),
        session: 'test-session-001',
        payload: { /* missing command field */ }
      };

      await messageRouter.routeMessage(invalidMessage, 'test-session-001');

      expect(mockAgentController.executeCommand).not.toHaveBeenCalled();
      expect(mockConnectionManager.sendToSession).toHaveBeenCalledWith(
        'test-session-001',
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            error_code: 'INVALID_COMMAND_MESSAGE'
          })
        })
      );
    });
  });

  describe('Response Message Routing to Client', () => {
    test('should route response message to correct session', () => {
      const responseMessage = WebSocketProtocol.formatSuccessResponse(
        'cmd-001',
        'inspect_element',
        { element: { tag: 'div' } },
        { execution_time: 100 },
        'test-session-001'
      );

      messageRouter.routeResponse(responseMessage);

      expect(mockConnectionManager.sendToSession).toHaveBeenCalledWith(
        'test-session-001',
        responseMessage
      );
    });

    test('should handle invalid session for response', () => {
      mockConnectionManager.getConnectionBySession.mockReturnValue(null);
      
      const responseMessage = WebSocketProtocol.formatSuccessResponse(
        'cmd-001',
        'inspect_element',
        { element: { tag: 'div' } },
        { execution_time: 100 },
        'invalid-session'
      );

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      messageRouter.routeResponse(responseMessage);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No active connection found for session')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Event Message Broadcasting', () => {
    test('should broadcast event to all connections', () => {
      const eventMessage = WebSocketProtocol.formatProgressEvent(
        {
          command_id: 'cmd-001',
          progress: { current: 5, total: 10, percentage: 50 }
        },
        'broadcast'
      );

      messageRouter.broadcastEvent(eventMessage);

      expect(mockConnectionManager.broadcast).toHaveBeenCalledWith(eventMessage);
    });

    test('should send event to specific session', () => {
      const eventMessage = WebSocketProtocol.formatProgressEvent(
        {
          command_id: 'cmd-001',
          progress: { current: 3, total: 10, percentage: 30 }
        },
        'test-session-001'
      );

      messageRouter.routeEvent(eventMessage, 'test-session-001');

      expect(mockConnectionManager.sendToSession).toHaveBeenCalledWith(
        'test-session-001',
        eventMessage
      );
    });

    test('should validate event message before routing', () => {
      const invalidEvent = {
        id: 'evt-001',
        type: 'event',
        timestamp: new Date().toISOString(),
        session: 'test-session-001',
        payload: { /* missing event_type */ }
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      messageRouter.routeEvent(invalidEvent, 'test-session-001');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid event message')
      );
      expect(mockConnectionManager.sendToSession).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Message Validation and Filtering', () => {
    test('should validate message structure', () => {
      const validMessage = MessageProtocol.createCommandMessage(
        'ping',
        null,
        'test-session-001'
      );

      expect(messageRouter.validateMessage(validMessage)).toBe(true);
    });

    test('should reject malformed messages', () => {
      const malformedMessage = {
        id: 'invalid',
        /* missing required fields */
      };

      expect(messageRouter.validateMessage(malformedMessage)).toBe(false);
    });

    test('should validate message size limits', () => {
      const largePayload = {
        command: 'test',
        parameters: {
          data: 'x'.repeat(2 * 1024 * 1024) // 2MB
        }
      };
      
      const largeMessage = MessageProtocol.createCommandMessage(
        'test',
        largePayload.parameters,
        'test-session-001'
      );

      expect(messageRouter.validateMessage(largeMessage)).toBe(false);
    });

    test('should filter messages by type', () => {
      const commandMessage = MessageProtocol.createCommandMessage('ping', null, 'test-session-001');
      const responseMessage = WebSocketProtocol.formatSuccessResponse('cmd-001', 'ping', {}, {}, 'test-session-001');

      expect(messageRouter.isCommandMessage(commandMessage)).toBe(true);
      expect(messageRouter.isCommandMessage(responseMessage)).toBe(false);
      expect(messageRouter.isResponseMessage(responseMessage)).toBe(true);
      expect(messageRouter.isResponseMessage(commandMessage)).toBe(false);
    });
  });

  describe('Command Queue and Processing', () => {
    test('should queue commands when agent is busy', async () => {
      // Make agent busy
      mockAgentController.isAvailable.mockReturnValue(false);
      
      const command1 = MessageProtocol.createCommandMessage('ping', null, 'test-session-001');
      const command2 = MessageProtocol.createCommandMessage('ping', null, 'test-session-002');

      await messageRouter.routeMessage(command1, 'test-session-001');
      await messageRouter.routeMessage(command2, 'test-session-002');

      expect(messageRouter.getQueueLength()).toBe(2);
      expect(mockAgentController.executeCommand).not.toHaveBeenCalled();
    });

    test('should process queued commands when agent becomes available', async () => {
      // Start with busy agent
      mockAgentController.isAvailable.mockReturnValue(false);
      
      const command = MessageProtocol.createCommandMessage('ping', null, 'test-session-001');
      await messageRouter.routeMessage(command, 'test-session-001');

      expect(messageRouter.getQueueLength()).toBe(1);

      // Agent becomes available
      mockAgentController.isAvailable.mockReturnValue(true);
      await messageRouter.processQueue();

      expect(messageRouter.getQueueLength()).toBe(0);
      expect(mockAgentController.executeCommand).toHaveBeenCalledWith(
        'ping',
        null,
        expect.objectContaining({ sessionId: 'test-session-001' })
      );
    });

    test('should enforce queue size limits', async () => {
      messageRouter = new MessageRouter({
        agentController: mockAgentController,
        connectionManager: mockConnectionManager,
        maxQueueSize: 2
      });

      mockAgentController.isAvailable.mockReturnValue(false);

      // Add messages to fill queue
      const command1 = MessageProtocol.createCommandMessage('ping', null, 'test-session-001');
      const command2 = MessageProtocol.createCommandMessage('ping', null, 'test-session-002');
      const command3 = MessageProtocol.createCommandMessage('ping', null, 'test-session-003');

      await messageRouter.routeMessage(command1, 'test-session-001');
      await messageRouter.routeMessage(command2, 'test-session-002');
      await messageRouter.routeMessage(command3, 'test-session-003'); // Should be rejected

      expect(messageRouter.getQueueLength()).toBe(2);
      expect(mockConnectionManager.sendToSession).toHaveBeenCalledWith(
        'test-session-003',
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            error_code: 'QUEUE_FULL'
          })
        })
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle agent unavailable gracefully', async () => {
      mockAgentController.isAvailable.mockReturnValue(false);
      mockAgentController.getStatus.mockReturnValue({ status: 'offline' });

      const command = MessageProtocol.createCommandMessage('ping', null, 'test-session-001');
      await messageRouter.routeMessage(command, 'test-session-001');

      expect(mockConnectionManager.sendToSession).toHaveBeenCalledWith(
        'test-session-001',
        expect.objectContaining({
          type: 'error',
          payload: expect.objectContaining({
            error_code: 'AGENT_UNAVAILABLE'
          })
        })
      );
    });

    test('should handle routing errors gracefully', async () => {
      const command = MessageProtocol.createCommandMessage('ping', null, 'test-session-001');
      
      // Mock connection manager to throw error
      mockConnectionManager.sendToSession.mockImplementation(() => {
        throw new Error('Connection lost');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await messageRouter.routeMessage(command, 'test-session-001');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error routing message'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    test('should implement message retry logic', async () => {
      const command = MessageProtocol.createCommandMessage('ping', null, 'test-session-001');
      
      // First attempt fails, second succeeds
      mockAgentController.executeCommand
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({ success: true, data: 'retry success' });

      messageRouter = new MessageRouter({
        agentController: mockAgentController,
        connectionManager: mockConnectionManager,
        enableRetry: true,
        maxRetries: 2
      });

      await messageRouter.routeMessage(command, 'test-session-001');

      expect(mockAgentController.executeCommand).toHaveBeenCalledTimes(2);
      expect(mockConnectionManager.sendToSession).toHaveBeenCalledWith(
        'test-session-001',
        expect.objectContaining({
          type: 'response',
          payload: expect.objectContaining({
            status: 'success',
            data: 'retry success'
          })
        })
      );
    });
  });

  describe('Routing Statistics and Monitoring', () => {
    test('should track routing statistics', async () => {
      const command = MessageProtocol.createCommandMessage('ping', null, 'test-session-001');
      await messageRouter.routeMessage(command, 'test-session-001');

      const stats = messageRouter.getRoutingStatistics();

      expect(stats.total_messages_routed).toBe(1);
      expect(stats.total_commands_processed).toBe(1);
      expect(stats.total_errors).toBe(0);
      expect(stats.average_processing_time).toBeGreaterThanOrEqual(0);
    });

    test('should track error statistics', async () => {
      const invalidMessage = { invalid: 'message' };
      
      await messageRouter.routeMessage(invalidMessage, 'test-session-001');

      const stats = messageRouter.getRoutingStatistics();

      expect(stats.total_messages_routed).toBe(1);
      expect(stats.total_errors).toBe(1);
    });

    test('should provide queue status information', async () => {
      mockAgentController.isAvailable.mockReturnValue(false);
      
      const command = MessageProtocol.createCommandMessage('ping', null, 'test-session-001');
      await messageRouter.routeMessage(command, 'test-session-001');

      const queueStatus = messageRouter.getQueueStatus();

      expect(queueStatus.length).toBe(1);
      expect(queueStatus.maxSize).toBeDefined();
      expect(queueStatus.processing).toBe(false);
    });
  });

  describe('Custom Route Handlers', () => {
    test('should allow registering custom command handlers', async () => {
      const customHandler = jest.fn().mockResolvedValue({ custom: 'result' });
      messageRouter.registerCommandHandler('custom_command', customHandler);

      const command = MessageProtocol.createCommandMessage('custom_command', { param: 'value' }, 'test-session-001');
      await messageRouter.routeMessage(command, 'test-session-001');

      expect(customHandler).toHaveBeenCalledWith(
        { param: 'value' },
        expect.objectContaining({ sessionId: 'test-session-001' })
      );
      expect(mockAgentController.executeCommand).not.toHaveBeenCalled();
    });

    test('should support middleware for message processing', async () => {
      const middleware = jest.fn().mockImplementation((message, next) => {
        message.payload.preprocessed = true;
        return next(message);
      });

      messageRouter.use(middleware);

      const command = MessageProtocol.createCommandMessage('ping', null, 'test-session-001');
      await messageRouter.routeMessage(command, 'test-session-001');

      expect(middleware).toHaveBeenCalled();
    });
  });
});