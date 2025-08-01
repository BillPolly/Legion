/**
 * Tests for SessionManagerActor
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('SessionManagerActor', () => {
  let SessionManagerActor;
  let mockSessionManager;
  let sessionActor;
  
  beforeEach(async () => {
    ({ SessionManagerActor } = await import('../../../src/server/SessionManagerActor.js'));
    
    mockSessionManager = {
      createSession: jest.fn(),
      getSession: jest.fn(),
      getAllSessions: jest.fn(),
      deleteSession: jest.fn(),
      updateSession: jest.fn()
    };
    
    sessionActor = new SessionManagerActor(mockSessionManager);
  });

  test('should be a valid actor', () => {
    expect(sessionActor).toBeActor();
  });

  test('should handle create_session message', () => {
    const mockSession = {
      id: 'session-123',
      clientId: 'client-456',
      createdAt: Date.now(),
      tools: ['tool1', 'tool2'],
      variables: new Map()
    };
    
    mockSessionManager.createSession.mockReturnValue(mockSession);
    sessionActor.reply = jest.fn();
    
    const message = {
      type: 'create_session',
      clientId: 'client-456',
      requestId: 'req-create'
    };
    
    sessionActor.receive(message);
    
    expect(mockSessionManager.createSession).toHaveBeenCalledWith('client-456');
    expect(sessionActor.reply).toHaveBeenCalledWith({
      type: 'session_created',
      requestId: 'req-create',
      sessionId: 'session-123',
      tools: ['tool1', 'tool2']
    });
  });

  test('should handle restore_session message', () => {
    const mockSession = {
      id: 'session-789',
      clientId: 'client-456',
      state: { foo: 'bar' },
      variables: new Map([['var1', 'value1']])
    };
    
    mockSessionManager.getSession.mockReturnValue(mockSession);
    sessionActor.reply = jest.fn();
    
    const message = {
      type: 'restore_session',
      sessionId: 'session-789',
      requestId: 'req-restore'
    };
    
    sessionActor.receive(message);
    
    expect(mockSessionManager.getSession).toHaveBeenCalledWith('session-789');
    expect(sessionActor.reply).toHaveBeenCalledWith({
      type: 'session_restored',
      requestId: 'req-restore',
      session: {
        id: 'session-789',
        clientId: 'client-456',
        state: { foo: 'bar' },
        variables: { var1: 'value1' }
      }
    });
  });

  test('should handle session not found on restore', () => {
    mockSessionManager.getSession.mockReturnValue(null);
    sessionActor.reply = jest.fn();
    
    const message = {
      type: 'restore_session',
      sessionId: 'non-existent',
      requestId: 'req-404'
    };
    
    sessionActor.receive(message);
    
    expect(sessionActor.reply).toHaveBeenCalledWith({
      type: 'error',
      requestId: 'req-404',
      error: 'Session not found: non-existent'
    });
  });

  test('should handle get_sessions message', () => {
    const mockSessions = [
      { id: 'session-1', clientId: 'client-1' },
      { id: 'session-2', clientId: 'client-2' }
    ];
    
    mockSessionManager.getAllSessions.mockReturnValue(mockSessions);
    sessionActor.reply = jest.fn();
    
    const message = {
      type: 'get_sessions',
      requestId: 'req-list'
    };
    
    sessionActor.receive(message);
    
    expect(sessionActor.reply).toHaveBeenCalledWith({
      type: 'sessions_list',
      requestId: 'req-list',
      sessions: mockSessions
    });
  });

  test('should handle delete_session message', () => {
    mockSessionManager.deleteSession.mockReturnValue(true);
    sessionActor.reply = jest.fn();
    
    const message = {
      type: 'delete_session',
      sessionId: 'session-delete',
      requestId: 'req-delete'
    };
    
    sessionActor.receive(message);
    
    expect(mockSessionManager.deleteSession).toHaveBeenCalledWith('session-delete');
    expect(sessionActor.reply).toHaveBeenCalledWith({
      type: 'session_deleted',
      requestId: 'req-delete',
      sessionId: 'session-delete'
    });
  });

  test('should handle get_variables message', () => {
    const mockSession = {
      id: 'session-vars',
      variables: new Map([
        ['var1', 'value1'],
        ['var2', { nested: 'value' }]
      ])
    };
    
    mockSessionManager.getSession.mockReturnValue(mockSession);
    sessionActor.reply = jest.fn();
    
    const message = {
      type: 'get_variables',
      sessionId: 'session-vars',
      requestId: 'req-vars'
    };
    
    sessionActor.receive(message);
    
    expect(sessionActor.reply).toHaveBeenCalledWith({
      type: 'variables_list',
      requestId: 'req-vars',
      variables: {
        var1: 'value1',
        var2: { nested: 'value' }
      }
    });
  });

  test('should handle set_variable message', () => {
    const mockSession = {
      id: 'session-setvar',
      variables: new Map()
    };
    
    mockSessionManager.getSession.mockReturnValue(mockSession);
    sessionActor.reply = jest.fn();
    sessionActor.emit = jest.fn();
    
    const message = {
      type: 'set_variable',
      sessionId: 'session-setvar',
      name: 'newVar',
      value: 'newValue',
      requestId: 'req-setvar'
    };
    
    sessionActor.receive(message);
    
    expect(mockSession.variables.get('newVar')).toBe('newValue');
    expect(sessionActor.reply).toHaveBeenCalledWith({
      type: 'variable_set',
      requestId: 'req-setvar',
      name: 'newVar',
      value: 'newValue'
    });
    
    expect(sessionActor.emit).toHaveBeenCalledWith('variable_changed', {
      sessionId: 'session-setvar',
      name: 'newVar',
      value: 'newValue'
    });
  });

  test('should handle update_context message', () => {
    const mockSession = {
      id: 'session-context',
      context: {}
    };
    
    mockSessionManager.getSession.mockReturnValue(mockSession);
    mockSessionManager.updateSession.mockReturnValue(true);
    sessionActor.reply = jest.fn();
    
    const message = {
      type: 'update_context',
      sessionId: 'session-context',
      context: { key: 'value' },
      requestId: 'req-context'
    };
    
    sessionActor.receive(message);
    
    expect(mockSessionManager.updateSession).toHaveBeenCalledWith('session-context', {
      context: { key: 'value' }
    });
    
    expect(sessionActor.reply).toHaveBeenCalledWith({
      type: 'context_updated',
      requestId: 'req-context',
      sessionId: 'session-context'
    });
  });

  test('should emit session events', () => {
    const mockSession = {
      id: 'session-events',
      clientId: 'client-events'
    };
    
    mockSessionManager.createSession.mockReturnValue(mockSession);
    sessionActor.emit = jest.fn();
    sessionActor.reply = jest.fn();
    
    const message = {
      type: 'create_session',
      clientId: 'client-events',
      requestId: 'req-events'
    };
    
    sessionActor.receive(message);
    
    expect(sessionActor.emit).toHaveBeenCalledWith('session_created', {
      sessionId: 'session-events',
      clientId: 'client-events'
    });
  });

  test('should handle unknown message type', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    
    const message = {
      type: 'unknown',
      data: 'test'
    };
    
    sessionActor.receive(message);
    
    expect(consoleWarn).toHaveBeenCalledWith(
      'SessionManagerActor: Unknown message type',
      'unknown'
    );
    
    consoleWarn.mockRestore();
  });
});