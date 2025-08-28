import { describe, it, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
/**
 * @jest-environment jsdom
 */

import { RecoveryManager } from '../../../src/error/RecoveryManager.js';

describe('Recovery and Retry Logic', () => {
  let recoveryManager;
  let mockErrorHandler;
  let mockWebSocketClient;
  let mockSessionManager;

  beforeEach(() => {
    mockErrorHandler = {
      handleError: jest.fn().mockResolvedValue({ handled: true }),
      categorizeError: jest.fn().mockReturnValue({ retryable: true, severity: 'medium' })
    };

    mockWebSocketClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: jest.fn().mockReturnValue(false),
      getConnectionState: jest.fn().mockReturnValue('disconnected')
    };

    mockSessionManager = {
      saveSession: jest.fn(),
      restoreSession: jest.fn().mockResolvedValue(null),
      clearSession: jest.fn()
    };

    recoveryManager = new RecoveryManager({
      errorHandler: mockErrorHandler,
      webSocketClient: mockWebSocketClient,
      sessionManager: mockSessionManager,
      maxRetries: 3,
      baseRetryDelay: 100
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Recovery', () => {
    test('should automatically recover WebSocket connections', async () => {
      mockWebSocketClient.connect
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Still failing'))
        .mockResolvedValueOnce(true);

      const result = await recoveryManager.recoverConnection();

      expect(result).toEqual({
        recovered: true,
        attempts: 3,
        strategy: 'connection_retry',
        duration: expect.any(Number)
      });

      expect(mockWebSocketClient.connect).toHaveBeenCalledTimes(3);
    });

    test('should implement exponential backoff for connection retries', async () => {
      const startTime = Date.now();
      mockWebSocketClient.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await recoveryManager.recoverConnection({
        maxRetries: 2,
        exponentialBackoff: true
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(300); // Should have delays
      expect(result.recovered).toBe(false);
      expect(result.attempts).toBe(3); // Initial + 2 retries
    });

    test('should handle connection state synchronization', async () => {
      mockWebSocketClient.connect.mockResolvedValue(true);
      mockWebSocketClient.isConnected.mockReturnValue(true);

      const result = await recoveryManager.synchronizeConnectionState();

      expect(result).toEqual({
        synchronized: true,
        previousState: 'disconnected',
        currentState: 'connected',
        actions: expect.arrayContaining(['state_updated'])
      });
    });

    test('should implement connection health monitoring', async () => {
      const healthCheck = jest.fn()
        .mockResolvedValueOnce({ healthy: false })
        .mockResolvedValueOnce({ healthy: true });

      recoveryManager.setHealthChecker(healthCheck);

      const result = await recoveryManager.monitorConnectionHealth();

      expect(result).toEqual({
        healthy: true,
        checks: 2,
        recovery: expect.objectContaining({
          attempted: true,
          successful: true
        })
      });
    });
  });

  describe('Session Restoration', () => {
    test('should restore session after reconnection', async () => {
      const mockSession = {
        id: 'session123',
        commands: [
          { id: 'cmd1', status: 'pending' },
          { id: 'cmd2', status: 'completed' }
        ],
        timestamp: Date.now() - 5000
      };

      mockSessionManager.restoreSession.mockResolvedValue(mockSession);

      const result = await recoveryManager.restoreSession();

      expect(result).toEqual({
        restored: true,
        session: mockSession,
        pendingCommands: [
          expect.objectContaining({ id: 'cmd1', status: 'pending' })
        ],
        completedCommands: [
          expect.objectContaining({ id: 'cmd2', status: 'completed' })
        ]
      });
    });

    test('should handle session state synchronization', async () => {
      const currentState = {
        commands: new Map([
          ['cmd1', { status: 'executing' }],
          ['cmd2', { status: 'completed' }]
        ])
      };

      const sessionState = {
        commands: [
          { id: 'cmd1', status: 'pending' },
          { id: 'cmd3', status: 'pending' }
        ]
      };

      const result = await recoveryManager.synchronizeSessionState(currentState, sessionState);

      expect(result).toEqual({
        synchronized: true,
        conflicts: expect.arrayContaining([
          expect.objectContaining({
            commandId: 'cmd1',
            currentStatus: 'executing',
            sessionStatus: 'pending',
            resolution: expect.any(String)
          })
        ]),
        merged: expect.objectContaining({
          commands: expect.any(Map)
        })
      });
    });

    test('should validate session integrity before restoration', async () => {
      const corruptedSession = {
        id: null,
        commands: 'invalid',
        timestamp: 'not-a-number'
      };

      mockSessionManager.restoreSession.mockResolvedValue(corruptedSession);

      const result = await recoveryManager.restoreSession();

      expect(result).toEqual({
        restored: false,
        error: 'Session validation failed',
        issues: expect.arrayContaining([
          'Invalid session ID',
          'Invalid commands structure',
          'Invalid timestamp'
        ])
      });
    });

    test('should handle session expiration', async () => {
      const expiredSession = {
        id: 'session123',
        commands: [],
        timestamp: Date.now() - (2 * 60 * 60 * 1000) // 2 hours ago
      };

      mockSessionManager.restoreSession.mockResolvedValue(expiredSession);

      const result = await recoveryManager.restoreSession({
        maxAge: 60 * 60 * 1000 // 1 hour
      });

      expect(result).toEqual({
        restored: false,
        error: 'Session expired',
        expiredAt: expect.any(Number),
        maxAge: 60 * 60 * 1000
      });
    });
  });

  describe('Command Recovery', () => {
    test('should retry failed commands with backoff', async () => {
      const failedCommand = {
        id: 'cmd1',
        type: 'inspect_element',
        parameters: { selector: '#test' },
        attempts: 1,
        lastError: 'Execution failed'
      };

      const executeCommand = jest.fn()
        .mockRejectedValueOnce(new Error('Still failing'))
        .mockResolvedValueOnce({ success: true, result: 'Success' });

      const result = await recoveryManager.retryCommand(failedCommand, executeCommand);

      expect(result).toEqual({
        recovered: true,
        attempts: 3,
        finalResult: { success: true, result: 'Success' },
        totalRetries: 1
      });
    });

    test('should respect maximum retry limits', async () => {
      const failedCommand = {
        id: 'cmd1',
        type: 'inspect_element',
        parameters: { selector: '#test' },
        attempts: 0
      };

      const executeCommand = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      const result = await recoveryManager.retryCommand(failedCommand, executeCommand, {
        maxRetries: 2
      });

      expect(result).toEqual({
        recovered: false,
        attempts: 3, // Initial + 2 retries
        finalError: expect.objectContaining({
          message: 'Persistent failure'
        }),
        exhausted: true
      });
    });

    test('should handle command timeouts during retry', async () => {
      const timeoutCommand = {
        id: 'cmd1',
        type: 'analyze_performance',
        parameters: {},
        attempts: 0
      };

      const executeCommand = jest.fn().mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 150);
        });
      });

      const result = await recoveryManager.retryCommand(timeoutCommand, executeCommand, {
        timeout: 100,
        maxRetries: 1
      });

      expect(result.recovered).toBe(false);
      expect(result.finalError.message).toBe('Timeout');
    });

    test('should batch retry multiple failed commands', async () => {
      const failedCommands = [
        { id: 'cmd1', type: 'inspect', attempts: 1 },
        { id: 'cmd2', type: 'analyze', attempts: 2 },
        { id: 'cmd3', type: 'audit', attempts: 0 }
      ];

      const executeCommand = jest.fn((command) => {
        if (command.id === 'cmd2') {
          return Promise.reject(new Error('Failed'));
        }
        return Promise.resolve({ success: true });
      });

      const result = await recoveryManager.retryFailedCommands(failedCommands, executeCommand);

      expect(result).toEqual({
        totalCommands: 3,
        recovered: 2,
        failed: 1,
        results: expect.arrayContaining([
          expect.objectContaining({ id: 'cmd1', recovered: true }),
          expect.objectContaining({ id: 'cmd2', recovered: false }),
          expect.objectContaining({ id: 'cmd3', recovered: true })
        ])
      });
    });
  });

  describe('Progressive Recovery', () => {
    test('should implement progressive recovery strategy', async () => {
      const recoverySteps = [
        { name: 'reconnect', fn: jest.fn().mockResolvedValue({ success: true }) },
        { name: 'restore_session', fn: jest.fn().mockResolvedValue({ success: true }) },
        { name: 'sync_state', fn: jest.fn().mockResolvedValue({ success: true }) }
      ];

      recoveryManager.setRecoverySteps(recoverySteps);

      const result = await recoveryManager.executeProgressiveRecovery();

      expect(result).toEqual({
        completed: true,
        steps: expect.arrayContaining([
          expect.objectContaining({ name: 'reconnect', success: true }),
          expect.objectContaining({ name: 'restore_session', success: true }),
          expect.objectContaining({ name: 'sync_state', success: true })
        ]),
        duration: expect.any(Number)
      });
    });

    test('should handle partial recovery failures', async () => {
      const recoverySteps = [
        { name: 'reconnect', fn: jest.fn().mockResolvedValue({ success: true }) },
        { name: 'restore_session', fn: jest.fn().mockRejectedValue(new Error('Restore failed')) },
        { name: 'sync_state', fn: jest.fn().mockResolvedValue({ success: true }) }
      ];

      recoveryManager.setRecoverySteps(recoverySteps);

      const result = await recoveryManager.executeProgressiveRecovery({
        continueOnFailure: true
      });

      expect(result).toEqual({
        completed: false,
        duration: expect.any(Number),
        steps: expect.arrayContaining([
          expect.objectContaining({ name: 'reconnect', success: true }),
          expect.objectContaining({ name: 'restore_session', success: false }),
          expect.objectContaining({ name: 'sync_state', success: true })
        ]),
        partialSuccess: true,
        failedSteps: ['restore_session']
      });
    });

    test('should provide recovery progress feedback', async () => {
      const progressCallback = jest.fn();
      
      const recoverySteps = [
        { name: 'step1', fn: jest.fn().mockResolvedValue({ success: true }) },
        { name: 'step2', fn: jest.fn().mockResolvedValue({ success: true }) }
      ];

      recoveryManager.setRecoverySteps(recoverySteps);

      await recoveryManager.executeProgressiveRecovery({
        onProgress: progressCallback
      });

      expect(progressCallback).toHaveBeenCalledWith({
        step: 'step1',
        progress: 50,
        message: 'Executing step1...'
      });

      expect(progressCallback).toHaveBeenCalledWith({
        step: 'step2',
        progress: 100,
        message: 'Executing step2...'
      });
    });
  });

  describe('Recovery Monitoring', () => {
    test('should track recovery metrics', async () => {
      await recoveryManager.recoverConnection();
      
      const mockSession = { id: 'test', commands: [], timestamp: Date.now() };
      mockSessionManager.restoreSession.mockResolvedValue(mockSession);
      await recoveryManager.restoreSession();

      const metrics = recoveryManager.getRecoveryMetrics();

      expect(metrics).toEqual({
        totalRecoveries: 2,
        connectionRecoveries: 1,
        sessionRecoveries: 1,
        commandRecoveries: 0,
        successRate: expect.any(Number),
        averageRecoveryTime: expect.any(Number)
      });
    });

    test('should generate recovery reports', async () => {
      // Simulate some recovery activities
      await recoveryManager.recoverConnection();

      const report = recoveryManager.generateRecoveryReport();

      expect(report).toEqual({
        summary: {
          totalAttempts: expect.any(Number),
          successfulRecoveries: expect.any(Number),
          failedRecoveries: expect.any(Number),
          averageTime: expect.any(Number)
        },
        breakdown: {
          connection: expect.any(Object),
          session: expect.any(Object),
          commands: expect.any(Object)
        },
        recommendations: expect.any(Array)
      });
    });

    test('should identify recovery patterns', async () => {
      // Simulate multiple connection failures
      mockWebSocketClient.connect.mockRejectedValue(new Error('Network error'));
      
      for (let i = 0; i < 3; i++) {
        try {
          await recoveryManager.recoverConnection();
        } catch (e) {
          // Expected failures
        }
      }

      const patterns = recoveryManager.analyzeRecoveryPatterns();

      expect(patterns).toEqual(expect.arrayContaining([
        expect.objectContaining({
          pattern: 'repeated_connection_failure',
          count: 3,
          recommendation: expect.stringContaining('connection')
        })
      ]));
    });
  });

  describe('Configuration and Integration', () => {
    test('should accept custom recovery configuration', () => {
      const customManager = new RecoveryManager({
        maxRetries: 5,
        baseRetryDelay: 200,
        exponentialBackoff: false,
        sessionTimeout: 300000
      });

      expect(customManager.config).toEqual(expect.objectContaining({
        maxRetries: 5,
        baseRetryDelay: 200,
        exponentialBackoff: false,
        sessionTimeout: 300000
      }));
    });

    test('should integrate with error handling system', async () => {
      const error = new Error('Test error');
      
      const result = await recoveryManager.handleRecoveryError(error, {
        operation: 'connection_recovery',
        attempt: 2
      });

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          component: 'recovery',
          operation: 'connection_recovery',
          attempt: 2
        })
      );

      expect(result).toEqual({
        handled: true,
        shouldRetry: true,
        waitTime: expect.any(Number)
      });
    });

    test('should provide recovery state notifications', async () => {
      const onStateChange = jest.fn();
      recoveryManager.onRecoveryStateChange(onStateChange);

      await recoveryManager.recoverConnection();

      expect(onStateChange).toHaveBeenCalledWith({
        state: 'recovering',
        operation: 'connection',
        progress: 50,
        success: undefined
      });

      expect(onStateChange).toHaveBeenCalledWith({
        state: 'recovered',
        operation: 'connection',
        progress: 100,
        success: true
      });
    });
  });
});