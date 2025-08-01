/**
 * Tests for ToolExecutorActor
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('ToolExecutorActor', () => {
  let ToolExecutorActor;
  let mockToolRegistry;
  let mockSessionManager;
  let toolExecutor;
  
  beforeEach(async () => {
    ({ ToolExecutorActor } = await import('../../../src/server/ToolExecutorActor.js'));
    
    mockToolRegistry = {
      getTool: jest.fn(),
      getAllTools: jest.fn()
    };
    
    mockSessionManager = {
      getSession: jest.fn(),
      createSession: jest.fn()
    };
    
    toolExecutor = new ToolExecutorActor(mockToolRegistry, mockSessionManager);
  });

  test('should be a valid actor', () => {
    expect(toolExecutor).toBeActor();
  });

  test('should handle tool_execution message', async () => {
    const mockTool = {
      name: 'file_read',
      execute: jest.fn().mockResolvedValue({
        success: true,
        content: 'file contents'
      })
    };
    
    mockToolRegistry.getTool.mockReturnValue(mockTool);
    mockSessionManager.getSession.mockReturnValue({
      id: 'session-123',
      context: {}
    });
    
    toolExecutor.reply = jest.fn();
    
    const message = {
      type: 'tool_execution',
      tool: 'file_read',
      args: { path: '/test.txt' },
      requestId: 'req-123',
      sessionId: 'session-123'
    };
    
    await toolExecutor.receive(message);
    
    expect(mockToolRegistry.getTool).toHaveBeenCalledWith('file_read');
    expect(mockTool.execute).toHaveBeenCalledWith(
      { path: '/test.txt' },
      { id: 'session-123', context: {} }
    );
    
    expect(toolExecutor.reply).toHaveBeenCalledWith({
      type: 'execution_result',
      requestId: 'req-123',
      success: true,
      result: {
        success: true,
        content: 'file contents'
      }
    });
  });

  test('should handle tool not found', async () => {
    mockToolRegistry.getTool.mockReturnValue(null);
    toolExecutor.reply = jest.fn();
    
    const message = {
      type: 'tool_execution',
      tool: 'non_existent',
      args: {},
      requestId: 'req-456'
    };
    
    await toolExecutor.receive(message);
    
    expect(toolExecutor.reply).toHaveBeenCalledWith({
      type: 'execution_result',
      requestId: 'req-456',
      success: false,
      error: 'Tool not found: non_existent'
    });
  });

  test('should handle tool execution error', async () => {
    const mockTool = {
      name: 'failing_tool',
      execute: jest.fn().mockRejectedValue(new Error('Execution failed'))
    };
    
    mockToolRegistry.getTool.mockReturnValue(mockTool);
    mockSessionManager.getSession.mockReturnValue({
      id: 'session-123',
      context: {}
    });
    
    toolExecutor.reply = jest.fn();
    
    const message = {
      type: 'tool_execution',
      tool: 'failing_tool',
      args: {},
      requestId: 'req-789',
      sessionId: 'session-123'
    };
    
    await toolExecutor.receive(message);
    
    expect(toolExecutor.reply).toHaveBeenCalledWith({
      type: 'execution_result',
      requestId: 'req-789',
      success: false,
      error: 'Execution failed'
    });
  });

  test('should handle get_tools message', () => {
    const mockTools = [
      { name: 'tool1', description: 'Tool 1' },
      { name: 'tool2', description: 'Tool 2' }
    ];
    
    mockToolRegistry.getAllTools.mockReturnValue(mockTools);
    toolExecutor.reply = jest.fn();
    
    const message = {
      type: 'get_tools',
      requestId: 'req-tools'
    };
    
    toolExecutor.receive(message);
    
    expect(toolExecutor.reply).toHaveBeenCalledWith({
      type: 'tools_list',
      requestId: 'req-tools',
      tools: mockTools
    });
  });

  test('should create session if not exists', async () => {
    const mockTool = {
      name: 'test_tool',
      execute: jest.fn().mockResolvedValue({ success: true })
    };
    
    mockToolRegistry.getTool.mockReturnValue(mockTool);
    mockSessionManager.getSession.mockReturnValue(null);
    mockSessionManager.createSession.mockReturnValue({
      id: 'new-session',
      context: {}
    });
    
    toolExecutor.reply = jest.fn();
    
    const message = {
      type: 'tool_execution',
      tool: 'test_tool',
      args: {},
      requestId: 'req-new',
      sessionId: 'new-session'
    };
    
    await toolExecutor.receive(message);
    
    expect(mockSessionManager.createSession).toHaveBeenCalledWith('new-session');
    expect(mockTool.execute).toHaveBeenCalled();
  });

  test('should emit execution events', async () => {
    const mockTool = {
      name: 'event_tool',
      execute: jest.fn().mockResolvedValue({ success: true })
    };
    
    mockToolRegistry.getTool.mockReturnValue(mockTool);
    mockSessionManager.getSession.mockReturnValue({
      id: 'session-123',
      context: {}
    });
    
    const emitSpy = jest.fn();
    toolExecutor.emit = emitSpy;
    toolExecutor.reply = jest.fn();
    
    const message = {
      type: 'tool_execution',
      tool: 'event_tool',
      args: { data: 'test' },
      requestId: 'req-event',
      sessionId: 'session-123'
    };
    
    await toolExecutor.receive(message);
    
    expect(emitSpy).toHaveBeenCalledWith('tool_executed', {
      tool: 'event_tool',
      args: { data: 'test' },
      sessionId: 'session-123',
      success: true
    });
  });

  test('should handle unknown message type', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    
    const message = {
      type: 'unknown',
      data: 'test'
    };
    
    toolExecutor.receive(message);
    
    expect(consoleWarn).toHaveBeenCalledWith(
      'ToolExecutorActor: Unknown message type',
      'unknown'
    );
    
    consoleWarn.mockRestore();
  });

  test('should track execution metrics', async () => {
    const mockTool = {
      name: 'metric_tool',
      execute: jest.fn().mockResolvedValue({ success: true })
    };
    
    mockToolRegistry.getTool.mockReturnValue(mockTool);
    mockSessionManager.getSession.mockReturnValue({
      id: 'session-123',
      context: {}
    });
    
    toolExecutor.reply = jest.fn();
    
    const message = {
      type: 'tool_execution',
      tool: 'metric_tool',
      args: {},
      requestId: 'req-metric',
      sessionId: 'session-123'
    };
    
    await toolExecutor.receive(message);
    
    const metrics = toolExecutor.getMetrics();
    expect(metrics.totalExecutions).toBe(1);
    expect(metrics.successfulExecutions).toBe(1);
    expect(metrics.failedExecutions).toBe(0);
    expect(metrics.toolMetrics['metric_tool']).toBeDefined();
  });
});