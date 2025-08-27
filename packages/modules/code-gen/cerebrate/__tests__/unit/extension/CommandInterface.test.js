import { CommandInterface } from '../../../src/extension/CommandInterface.js';
import { MessageProtocol } from '../../../src/shared/protocol/MessageProtocol.js';

describe('Command Interface System', () => {
  let commandInterface;
  let mockWebSocketClient;

  beforeEach(() => {
    mockWebSocketClient = {
      send: jest.fn().mockReturnValue(true),
      on: jest.fn(),
      off: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      getState: jest.fn().mockReturnValue('connected')
    };
    
    commandInterface = new CommandInterface(mockWebSocketClient);
  });

  afterEach(() => {
    // Clean up any pending operations
    if (commandInterface) {
      // Clear any pending commands before destroying to avoid unhandled rejections
      commandInterface.pendingCommands.forEach((pending) => {
        clearTimeout(pending.timeout);
      });
      commandInterface.pendingCommands.clear();
      commandInterface.commandQueue = [];
      commandInterface.removeAllListeners();
    }
    jest.clearAllMocks();
  });

  describe('Command Creation and Validation', () => {
    test('should create valid command with required fields', () => {
      const command = commandInterface.createCommand('inspect_element', {
        selector: '#test-id'
      });

      expect(command).toMatchObject({
        id: expect.stringMatching(/^cmd-[a-f0-9-]+$/),
        type: 'command',
        command: 'inspect_element',
        payload: {
          selector: '#test-id'
        },
        timestamp: expect.any(Number)
      });
    });

    test('should validate command name', () => {
      expect(() => {
        commandInterface.createCommand('', { data: 'test' });
      }).toThrow('Command name is required');

      expect(() => {
        commandInterface.createCommand(123, { data: 'test' });
      }).toThrow('Command name must be a string');
    });

    test('should validate command payload', () => {
      expect(() => {
        commandInterface.createCommand('test', null);
      }).toThrow('Payload must be an object');

      expect(() => {
        commandInterface.createCommand('test', 'invalid');
      }).toThrow('Payload must be an object');
    });

    test('should accept optional metadata', () => {
      const command = commandInterface.createCommand('test', 
        { data: 'value' },
        { priority: 'high', tag: 'debug' }
      );

      expect(command.metadata).toEqual({
        priority: 'high',
        tag: 'debug'
      });
    });
  });

  describe('Command Queueing and Execution', () => {
    test('should execute command immediately when connected', async () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      commandInterface = new CommandInterface(mockWebSocketClient);

      const promise = commandInterface.execute('test_command', {
        data: 'test'
      });

      expect(mockWebSocketClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'command',
          command: 'test_command',
          payload: { data: 'test' }
        })
      );

      // Simulate immediate response
      const sentCommand = mockWebSocketClient.send.mock.calls[0][0];
      messageHandler({
        type: 'response',
        command_id: sentCommand.id,
        success: true,
        data: { result: 'success' }
      });

      const response = await promise;
      expect(response.success).toBe(true);
    });

    test('should queue commands when disconnected', async () => {
      mockWebSocketClient.isConnected.mockReturnValue(false);
      mockWebSocketClient.getState.mockReturnValue('disconnected');

      const promise = commandInterface.execute('test_command', {
        data: 'test'
      });

      expect(mockWebSocketClient.send).not.toHaveBeenCalled();
      expect(commandInterface.getQueueSize()).toBe(1);

      // Should still be pending
      const isPending = await Promise.race([
        promise.then(() => false),
        new Promise(resolve => setTimeout(() => resolve(true), 50))
      ]);
      expect(isPending).toBe(true);
    });

    test('should respect queue size limit', async () => {
      commandInterface.setMaxQueueSize(2);
      mockWebSocketClient.isConnected.mockReturnValue(false);

      // Fill the queue
      commandInterface.execute('command1', {});
      commandInterface.execute('command2', {});

      // This should throw
      await expect(commandInterface.execute('command3', {}))
        .rejects.toThrow('Command queue is full');
    });

    test('should process queued commands when connection restored', async () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      commandInterface = new CommandInterface(mockWebSocketClient);
      mockWebSocketClient.isConnected.mockReturnValue(false);

      // Queue some commands
      const promise1 = commandInterface.execute('command1', { data: 1 });
      const promise2 = commandInterface.execute('command2', { data: 2 });

      expect(commandInterface.getQueueSize()).toBe(2);

      // Simulate connection restored
      mockWebSocketClient.isConnected.mockReturnValue(true);
      
      // Mock send to return true and capture commands
      const sentCommands = [];
      mockWebSocketClient.send.mockImplementation((cmd) => {
        sentCommands.push(cmd);
        // Simulate immediate response
        setTimeout(() => {
          messageHandler({
            type: 'response',
            command_id: cmd.id,
            success: true,
            data: { result: `success-${cmd.command}` }
          });
        }, 0);
        return true;
      });

      await commandInterface.processQueue();

      // Wait for responses
      await Promise.all([promise1, promise2]);

      expect(mockWebSocketClient.send).toHaveBeenCalledTimes(2);
      expect(commandInterface.getQueueSize()).toBe(0);
    });

    test('should clear command queue', () => {
      mockWebSocketClient.isConnected.mockReturnValue(false);

      // Create promises but catch errors to avoid unhandled rejections
      commandInterface.execute('command1', {}).catch(() => {});
      commandInterface.execute('command2', {}).catch(() => {});
      
      expect(commandInterface.getQueueSize()).toBe(2);

      commandInterface.clearQueue();
      
      expect(commandInterface.getQueueSize()).toBe(0);
    });
  });

  describe('Response Correlation and Handling', () => {
    test('should correlate response with command', async () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      commandInterface = new CommandInterface(mockWebSocketClient);

      const promise = commandInterface.execute('test_command', {
        data: 'test'
      });

      // Get the sent command to extract its ID
      const sentCommand = mockWebSocketClient.send.mock.calls[0][0];

      // Simulate response
      messageHandler({
        type: 'response',
        command_id: sentCommand.id,
        success: true,
        data: { result: 'success' }
      });

      const response = await promise;
      expect(response).toEqual({
        success: true,
        data: { result: 'success' }
      });
    });

    test('should handle error responses', async () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      commandInterface = new CommandInterface(mockWebSocketClient);

      const promise = commandInterface.execute('failing_command', {});

      const sentCommand = mockWebSocketClient.send.mock.calls[0][0];

      // Simulate error response
      messageHandler({
        type: 'response',
        command_id: sentCommand.id,
        success: false,
        error: 'Command failed'
      });

      await expect(promise).rejects.toThrow('Command failed');
    });

    test('should ignore responses for unknown commands', () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      commandInterface = new CommandInterface(mockWebSocketClient);

      // Send a response for an unknown command
      expect(() => {
        messageHandler({
          type: 'response',
          command_id: 'unknown-cmd-id',
          success: true,
          data: {}
        });
      }).not.toThrow();
    });

    test('should handle concurrent commands', async () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      commandInterface = new CommandInterface(mockWebSocketClient);

      // Execute multiple commands
      const promise1 = commandInterface.execute('command1', {});
      const promise2 = commandInterface.execute('command2', {});

      const command1 = mockWebSocketClient.send.mock.calls[0][0];
      const command2 = mockWebSocketClient.send.mock.calls[1][0];

      // Respond out of order
      messageHandler({
        type: 'response',
        command_id: command2.id,
        success: true,
        data: { result: 'command2' }
      });

      messageHandler({
        type: 'response',
        command_id: command1.id,
        success: true,
        data: { result: 'command1' }
      });

      const [response1, response2] = await Promise.all([promise1, promise2]);
      
      expect(response1.data.result).toBe('command1');
      expect(response2.data.result).toBe('command2');
    });
  });

  describe('Timeout and Error Handling', () => {
    test('should timeout commands after specified duration', async () => {
      commandInterface.setDefaultTimeout(100);

      const promise = commandInterface.execute('slow_command', {});

      await expect(promise).rejects.toThrow('Command timeout');
    });

    test('should allow custom timeout per command', async () => {
      const promise = commandInterface.execute('slow_command', {}, {
        timeout: 50
      });

      await expect(promise).rejects.toThrow('Command timeout');
    });

    test('should handle connection lost during command execution', async () => {
      let disconnectHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'disconnected') {
          disconnectHandler = handler;
        }
      });

      // Create new instance to ensure clean setup
      const testInterface = new CommandInterface(mockWebSocketClient);

      const promise = testInterface.execute('test_command', {});

      // Simulate disconnection
      mockWebSocketClient.isConnected.mockReturnValue(false);
      disconnectHandler();

      await expect(promise).rejects.toThrow('Connection lost');
      
      // Clean up
      testInterface.pendingCommands.clear();
    });

    test('should cleanup pending commands on connection error', () => {
      let errorHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      });

      // Create new instance to ensure clean setup
      const testInterface = new CommandInterface(mockWebSocketClient);

      // Execute commands and catch rejections
      testInterface.execute('command1', {}).catch(() => {});
      testInterface.execute('command2', {}).catch(() => {});

      expect(testInterface.getPendingCount()).toBe(2);

      // Simulate error
      errorHandler(new Error('WebSocket error'));

      expect(testInterface.getPendingCount()).toBe(0);
      
      // Clean up
      testInterface.pendingCommands.clear();
    });

    test('should retry failed commands', async () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      // Create new instance to ensure clean setup
      const testInterface = new CommandInterface(mockWebSocketClient);
      testInterface.setRetryConfig({ maxRetries: 2, retryDelay: 50 });

      let sendCallCount = 0;
      mockWebSocketClient.send.mockImplementation((cmd) => {
        sendCallCount++;
        
        // Simulate response after a short delay
        setTimeout(() => {
          if (sendCallCount === 1) {
            // First attempt fails
            messageHandler({
              type: 'response',
              command_id: cmd.id,
              success: false,
              error: 'Temporary error'
            });
          } else {
            // Second attempt succeeds
            messageHandler({
              type: 'response',
              command_id: cmd.id,
              success: true,
              data: { result: 'success' }
            });
          }
        }, 10);
        
        return true;
      });

      const promise = testInterface.execute('flaky_command', {}, {
        retry: true
      });

      const response = await promise;
      expect(response.data.result).toBe('success');
      expect(mockWebSocketClient.send).toHaveBeenCalledTimes(2);
      
      // Clean up
      testInterface.destroy();
    });
  });

  describe('Command History and Tracking', () => {
    test('should track command history', async () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      commandInterface = new CommandInterface(mockWebSocketClient);
      commandInterface.enableHistory(10);

      const promise = commandInterface.execute('test_command', { data: 'test' });
      const sentCommand = mockWebSocketClient.send.mock.calls[0][0];

      messageHandler({
        type: 'response',
        command_id: sentCommand.id,
        success: true,
        data: { result: 'success' }
      });

      await promise;

      const history = commandInterface.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        command: 'test_command',
        payload: { data: 'test' },
        success: true,
        duration: expect.any(Number)
      });
    });

    test('should limit history size', async () => {
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      commandInterface = new CommandInterface(mockWebSocketClient);
      commandInterface.enableHistory(2);

      // Mock send to capture commands and respond immediately
      mockWebSocketClient.send.mockImplementation((cmd) => {
        setTimeout(() => {
          messageHandler({
            type: 'response',
            command_id: cmd.id,
            success: true,
            data: { result: 'success' }
          });
        }, 0);
        return true;
      });

      await commandInterface.execute('command1', {});
      await commandInterface.execute('command2', {});
      await commandInterface.execute('command3', {});

      const history = commandInterface.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].command).toBe('command2');
      expect(history[1].command).toBe('command3');
    });

    test('should provide command statistics', () => {
      commandInterface.enableHistory(100);

      // Simulate some command executions
      commandInterface._recordHistory('command1', {}, true, 100);
      commandInterface._recordHistory('command2', {}, true, 200);
      commandInterface._recordHistory('command1', {}, false, 150);
      commandInterface._recordHistory('command1', {}, true, 50);

      const stats = commandInterface.getStatistics();
      
      expect(stats).toEqual({
        totalCommands: 4,
        successCount: 3,
        failureCount: 1,
        averageDuration: 125,
        commandCounts: {
          command1: 3,
          command2: 1
        }
      });
    });
  });

  describe('Command Interface Lifecycle', () => {
    test('should cleanup resources on destroy', () => {
      // Create new instance to ensure clean setup
      const testInterface = new CommandInterface(mockWebSocketClient);
      
      // Execute a command and catch rejection
      testInterface.execute('pending_command', {}).catch(() => {});
      
      expect(testInterface.getPendingCount()).toBe(1);

      testInterface.destroy();

      expect(testInterface.getPendingCount()).toBe(0);
      expect(mockWebSocketClient.off).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocketClient.off).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockWebSocketClient.off).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should handle reconnection properly', async () => {
      let connectedHandler;
      let messageHandler;
      mockWebSocketClient.on.mockImplementation((event, handler) => {
        if (event === 'connected') {
          connectedHandler = handler;
        }
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      // Create new instance to ensure clean setup
      const testInterface = new CommandInterface(mockWebSocketClient);
      
      // Queue commands while disconnected
      mockWebSocketClient.isConnected.mockReturnValue(false);
      const promise = testInterface.execute('queued_command', {});
      
      expect(testInterface.getQueueSize()).toBe(1);

      // Simulate reconnection
      mockWebSocketClient.isConnected.mockReturnValue(true);
      
      // Mock send to respond immediately
      mockWebSocketClient.send.mockImplementation((cmd) => {
        setTimeout(() => {
          messageHandler({
            type: 'response',
            command_id: cmd.id,
            success: true,
            data: { result: 'success' }
          });
        }, 0);
        return true;
      });
      
      connectedHandler();

      // Wait for queue processing and response
      await promise;

      expect(mockWebSocketClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'queued_command'
        })
      );
      
      // Clean up
      testInterface.destroy();
    });
  });
});