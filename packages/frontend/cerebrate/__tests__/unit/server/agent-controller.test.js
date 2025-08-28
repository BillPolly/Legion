import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AgentController } from '../../../src/server/agent-controller.js';

describe('AgentController', () => {
  let agentController;
  let mockAgent;
  let mockResourceManager;

  beforeEach(() => {
    mockAgent = {
      execute: jest.fn().mockResolvedValue({ success: true, data: 'test result' }),
      isIdle: jest.fn().mockReturnValue(true),
      getStatus: jest.fn().mockReturnValue({ status: 'ready', tasks: 0 }),
      initialize: jest.fn().mockResolvedValue(true),
      shutdown: jest.fn().mockResolvedValue(true),
      setConfiguration: jest.fn()
    };

    mockResourceManager = {
      get: jest.fn().mockReturnValue('test-value'),
      register: jest.fn(),
      initialize: jest.fn().mockResolvedValue(true)
    };

    agentController = new AgentController({
      agent: mockAgent,
      resourceManager: mockResourceManager
    });
  });

  afterEach(() => {
    agentController.destroy();
  });

  describe('Legion Agent Initialization', () => {
    test('should initialize Legion Agent successfully', async () => {
      await agentController.initialize();

      expect(mockAgent.initialize).toHaveBeenCalled();
      expect(agentController.isInitialized()).toBe(true);
    });

    test('should handle initialization failure', async () => {
      const error = new Error('Initialization failed');
      mockAgent.initialize.mockRejectedValue(error);

      await expect(agentController.initialize()).rejects.toThrow('Initialization failed');
      expect(agentController.isInitialized()).toBe(false);
    });

    test('should configure agent with provided settings', async () => {
      const config = {
        timeout: 30000,
        retries: 3,
        debug: true
      };

      agentController = new AgentController({
        agent: mockAgent,
        resourceManager: mockResourceManager,
        config
      });

      await agentController.initialize();

      expect(mockAgent.setConfiguration).toHaveBeenCalledWith(expect.objectContaining(config));
    });

    test('should register agent resources with resource manager', async () => {
      await agentController.initialize();

      expect(mockResourceManager.register).toHaveBeenCalledWith('agent', mockAgent);
    });
  });

  describe('Command Execution Through Agent', () => {
    beforeEach(async () => {
      await agentController.initialize();
    });

    test('should execute command through Legion Agent', async () => {
      const result = await agentController.executeCommand(
        'inspect_element',
        { selector: '.test-element' },
        { sessionId: 'test-session-001' }
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'inspect_element',
        parameters: { selector: '.test-element' },
        context: { sessionId: 'test-session-001' }
      });

      expect(result).toEqual({
        success: true,
        data: 'test result'
      });
    });

    test('should handle command execution with null parameters', async () => {
      const result = await agentController.executeCommand(
        'ping',
        null,
        { sessionId: 'test-session-001' }
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'ping',
        parameters: null,
        context: { sessionId: 'test-session-001' }
      });

      expect(result.success).toBe(true);
    });

    test('should handle command execution with undefined parameters', async () => {
      const result = await agentController.executeCommand(
        'ping',
        undefined,
        { sessionId: 'test-session-001' }
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'ping',
        parameters: undefined,
        context: { sessionId: 'test-session-001' }
      });

      expect(result.success).toBe(true);
    });

    test('should handle complex command parameters', async () => {
      const parameters = {
        selector: '.complex-element',
        options: {
          includeStyles: true,
          maxDepth: 3,
          includeEvents: ['click', 'hover']
        },
        filters: ['visible', 'interactive']
      };

      await agentController.executeCommand(
        'inspect_element',
        parameters,
        { sessionId: 'test-session-001' }
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'inspect_element',
        parameters,
        context: { sessionId: 'test-session-001' }
      });
    });

    test('should reject execution when agent not initialized', async () => {
      agentController = new AgentController({
        agent: mockAgent,
        resourceManager: mockResourceManager
      });

      await expect(agentController.executeCommand(
        'ping',
        null,
        { sessionId: 'test-session-001' }
      )).rejects.toThrow('Agent controller not initialized');
    });
  });

  describe('Agent Response Handling', () => {
    beforeEach(async () => {
      await agentController.initialize();
    });

    test('should handle successful agent response', async () => {
      const agentResponse = {
        success: true,
        data: {
          element: { tag: 'div', classes: ['test'] },
          styles: { color: 'red' }
        },
        metadata: { execution_time: 150 }
      };

      mockAgent.execute.mockResolvedValue(agentResponse);

      const result = await agentController.executeCommand(
        'inspect_element',
        { selector: '.test' },
        { sessionId: 'test-session-001' }
      );

      expect(result).toEqual(agentResponse);
    });

    test('should handle agent response with warnings', async () => {
      const agentResponse = {
        success: true,
        data: { element: { tag: 'div' } },
        warnings: ['Element not visible', 'Deprecated selector']
      };

      mockAgent.execute.mockResolvedValue(agentResponse);

      const result = await agentController.executeCommand(
        'inspect_element',
        { selector: '.test' },
        { sessionId: 'test-session-001' }
      );

      expect(result.warnings).toEqual(['Element not visible', 'Deprecated selector']);
    });

    test('should handle partial success responses', async () => {
      const agentResponse = {
        success: false,
        error: 'Element not found',
        data: { similar_elements: ['.test-alt', '.test-backup'] }
      };

      mockAgent.execute.mockResolvedValue(agentResponse);

      const result = await agentController.executeCommand(
        'inspect_element',
        { selector: '.missing' },
        { sessionId: 'test-session-001' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Element not found');
      expect(result.data.similar_elements).toBeDefined();
    });
  });

  describe('Agent Error Propagation', () => {
    beforeEach(async () => {
      await agentController.initialize();
    });

    test('should propagate agent execution errors', async () => {
      const agentError = new Error('Agent processing error');
      mockAgent.execute.mockRejectedValue(agentError);

      await expect(agentController.executeCommand(
        'invalid_command',
        {},
        { sessionId: 'test-session-001' }
      )).rejects.toThrow('Agent processing error');
    });

    test('should handle agent timeout errors', async () => {
      const timeoutError = new Error('Command timed out after 30000ms');
      timeoutError.code = 'TIMEOUT';
      mockAgent.execute.mockRejectedValue(timeoutError);

      await expect(agentController.executeCommand(
        'slow_command',
        {},
        { sessionId: 'test-session-001' }
      )).rejects.toThrow('Command timed out after 30000ms');
    });

    test('should handle agent unavailable errors', async () => {
      mockAgent.isIdle.mockReturnValue(false);
      mockAgent.getStatus.mockReturnValue({ status: 'busy', tasks: 5 });

      const busyError = new Error('Agent is busy');
      busyError.code = 'AGENT_BUSY';
      mockAgent.execute.mockRejectedValue(busyError);

      await expect(agentController.executeCommand(
        'test_command',
        {},
        { sessionId: 'test-session-001' }
      )).rejects.toThrow('Agent is busy');
    });

    test('should handle network connection errors', async () => {
      const networkError = new Error('Connection refused');
      networkError.code = 'ECONNREFUSED';
      mockAgent.execute.mockRejectedValue(networkError);

      await expect(agentController.executeCommand(
        'network_command',
        {},
        { sessionId: 'test-session-001' }
      )).rejects.toThrow('Connection refused');
    });
  });

  describe('Agent Availability and Status', () => {
    beforeEach(async () => {
      await agentController.initialize();
    });

    test('should check agent availability correctly', () => {
      mockAgent.isIdle.mockReturnValue(true);
      expect(agentController.isAvailable()).toBe(true);

      mockAgent.isIdle.mockReturnValue(false);
      expect(agentController.isAvailable()).toBe(false);
    });

    test('should get agent status information', () => {
      const statusInfo = {
        status: 'ready',
        tasks: 2,
        uptime: 3600000,
        memory: { used: 128, total: 512 }
      };

      mockAgent.getStatus.mockReturnValue(statusInfo);

      const status = agentController.getStatus();
      expect(status).toEqual(statusInfo);
    });

    test('should handle agent status when not initialized', () => {
      agentController = new AgentController({
        agent: mockAgent,
        resourceManager: mockResourceManager
      });

      const status = agentController.getStatus();
      expect(status.status).toBe('not_initialized');
    });

    test('should track agent initialization state', () => {
      agentController = new AgentController({
        agent: mockAgent,
        resourceManager: mockResourceManager
      });

      expect(agentController.isInitialized()).toBe(false);
    });
  });

  describe('Agent Configuration Management', () => {
    test('should update agent configuration', async () => {
      await agentController.initialize();

      const newConfig = {
        timeout: 45000,
        debug: false,
        maxConcurrency: 5
      };

      agentController.updateConfiguration(newConfig);

      expect(mockAgent.setConfiguration).toHaveBeenCalledWith(newConfig);
    });

    test('should merge configuration updates', async () => {
      const initialConfig = {
        timeout: 30000,
        retries: 3,
        debug: true
      };

      agentController = new AgentController({
        agent: mockAgent,
        resourceManager: mockResourceManager,
        config: initialConfig
      });

      await agentController.initialize();

      const configUpdate = { timeout: 45000, maxConcurrency: 5 };
      agentController.updateConfiguration(configUpdate);

      expect(mockAgent.setConfiguration).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeout: 45000,
          maxConcurrency: 5
        })
      );
    });

    test('should get current configuration', async () => {
      const config = {
        timeout: 30000,
        retries: 3,
        debug: true
      };

      agentController = new AgentController({
        agent: mockAgent,
        resourceManager: mockResourceManager,
        config
      });

      const currentConfig = agentController.getConfiguration();
      expect(currentConfig).toEqual(expect.objectContaining(config));
    });
  });

  describe('Agent Lifecycle Management', () => {
    test('should shutdown agent gracefully', async () => {
      await agentController.initialize();
      await agentController.shutdown();

      expect(mockAgent.shutdown).toHaveBeenCalled();
      expect(agentController.isInitialized()).toBe(false);
    });

    test('should handle shutdown when not initialized', async () => {
      await expect(agentController.shutdown()).resolves.not.toThrow();
      expect(mockAgent.shutdown).not.toHaveBeenCalled();
    });

    test('should handle shutdown errors', async () => {
      await agentController.initialize();

      const shutdownError = new Error('Shutdown failed');
      mockAgent.shutdown.mockRejectedValue(shutdownError);

      await expect(agentController.shutdown()).rejects.toThrow('Shutdown failed');
    });

    test('should destroy controller and cleanup resources', async () => {
      await agentController.initialize();
      
      const cleanupSpy = jest.fn();
      agentController.on('cleanup', cleanupSpy);

      agentController.destroy();

      expect(cleanupSpy).toHaveBeenCalled();
      expect(agentController.isInitialized()).toBe(false);
    });
  });

  describe('Command Context and Metadata', () => {
    beforeEach(async () => {
      await agentController.initialize();
    });

    test('should pass session context to agent', async () => {
      const context = {
        sessionId: 'test-session-001',
        userId: 'user-123',
        requestId: 'req-456'
      };

      await agentController.executeCommand('ping', null, context);

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'ping',
        parameters: null,
        context
      });
    });

    test('should handle missing context gracefully', async () => {
      await agentController.executeCommand('ping', null);

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'ping',
        parameters: null,
        context: undefined
      });
    });

    test('should enrich context with controller metadata', async () => {
      agentController = new AgentController({
        agent: mockAgent,
        resourceManager: mockResourceManager,
        enrichContext: true
      });

      await agentController.initialize();

      await agentController.executeCommand(
        'ping',
        null,
        { sessionId: 'test-session-001' }
      );

      expect(mockAgent.execute).toHaveBeenCalledWith({
        command: 'ping',
        parameters: null,
        context: expect.objectContaining({
          sessionId: 'test-session-001',
          controllerId: expect.any(String),
          timestamp: expect.any(Date)
        })
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    beforeEach(async () => {
      await agentController.initialize();
    });

    test('should implement retry logic for transient failures', async () => {
      agentController = new AgentController({
        agent: mockAgent,
        resourceManager: mockResourceManager,
        config: { maxRetries: 2, retryDelayMs: 100 }
      });

      await agentController.initialize();

      // First two calls fail, third succeeds
      mockAgent.execute
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce({ success: true, data: 'retry success' });

      const result = await agentController.executeCommand(
        'unreliable_command',
        null,
        { sessionId: 'test-session-001' }
      );

      expect(mockAgent.execute).toHaveBeenCalledTimes(3);
      expect(result.data).toBe('retry success');
    });

    test('should fail after max retries exceeded', async () => {
      agentController = new AgentController({
        agent: mockAgent,
        resourceManager: mockResourceManager,
        config: { maxRetries: 2, retryDelayMs: 10 }
      });

      await agentController.initialize();

      const error = new Error('Persistent error');
      mockAgent.execute.mockRejectedValue(error);

      await expect(agentController.executeCommand(
        'failing_command',
        null,
        { sessionId: 'test-session-001' }
      )).rejects.toThrow('Persistent error');

      expect(mockAgent.execute).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});