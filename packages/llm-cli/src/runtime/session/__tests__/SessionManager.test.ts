import { SessionManager } from '../SessionManager';
import { SessionState, HistoryEntry } from '../types';
import { ContextProvider } from '../../../runtime/context/types';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager({
      maxHistoryLength: 10,
      timeout: 60000
    });
  });

  describe('initialization', () => {
    it('should create session with default values', () => {
      const state = manager.getState();
      
      expect(state.sessionId).toBeDefined();
      expect(state.state).toBeInstanceOf(Map);
      expect(state.history).toEqual([]);
      expect(state.contextProviders).toEqual([]);
      expect(state.startTime).toBeInstanceOf(Date);
      expect(state.lastActivityTime).toBeInstanceOf(Date);
    });

    it('should accept initial state', () => {
      const initialState = new Map([['key', 'value']]);
      const customManager = new SessionManager({
        initialState
      });

      expect(customManager.getState().state.get('key')).toBe('value');
    });

    it('should generate unique session IDs', () => {
      const manager2 = new SessionManager();
      expect(manager.getState().sessionId).not.toBe(manager2.getState().sessionId);
    });
  });

  describe('state management', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should get state value', () => {
      manager.setState('testKey', 'testValue');
      expect(manager.getStateValue('testKey')).toBe('testValue');
    });

    it('should set state value', () => {
      manager.setState('key', 'value');
      expect(manager.getState().state.get('key')).toBe('value');
    });

    it('should delete state value', () => {
      manager.setState('key', 'value');
      manager.deleteState('key');
      expect(manager.getStateValue('key')).toBeUndefined();
    });

    it('should clear all state', () => {
      manager.setState('key1', 'value1');
      manager.setState('key2', 'value2');
      manager.clearState();
      
      expect(manager.getState().state.size).toBe(0);
    });

    it('should update last activity time on state change', () => {
      const initialTime = manager.getState().lastActivityTime;
      
      // Wait a bit to ensure time difference
      jest.advanceTimersByTime(100);
      
      manager.setState('key', 'value');
      expect(manager.getState().lastActivityTime.getTime())
        .toBeGreaterThan(initialTime.getTime());
    });
  });

  describe('history management', () => {
    it('should add history entry', () => {
      const entry: Omit<HistoryEntry, 'id' | 'timestamp'> = {
        input: 'test command',
        intent: {
          command: 'test',
          parameters: {},
          confidence: 0.9,
          rawQuery: 'test command'
        }
      };

      manager.addHistoryEntry(entry);
      const history = manager.getHistory();
      
      expect(history).toHaveLength(1);
      expect(history[0].input).toBe('test command');
      expect(history[0].id).toBeDefined();
      expect(history[0].timestamp).toBeInstanceOf(Date);
    });

    it('should limit history length', () => {
      const customManager = new SessionManager({ maxHistoryLength: 3 });
      
      for (let i = 0; i < 5; i++) {
        customManager.addHistoryEntry({ input: `command ${i}` });
      }
      
      const history = customManager.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].input).toBe('command 2'); // Oldest kept
      expect(history[2].input).toBe('command 4'); // Newest
    });

    it('should get recent history', () => {
      for (let i = 0; i < 5; i++) {
        manager.addHistoryEntry({ input: `command ${i}` });
      }
      
      const recent = manager.getRecentHistory(3);
      expect(recent).toHaveLength(3);
      expect(recent[0].input).toBe('command 2');
    });

    it('should clear history', () => {
      manager.addHistoryEntry({ input: 'test' });
      manager.clearHistory();
      
      expect(manager.getHistory()).toEqual([]);
    });

    it('should include state snapshot in history', () => {
      manager.setState('count', 5);
      manager.addHistoryEntry({
        input: 'increment',
        stateSnapshot: new Map(manager.getState().state)
      });
      
      const history = manager.getHistory();
      expect(history[0].stateSnapshot?.get('count')).toBe(5);
    });
  });

  describe('context providers', () => {
    const mockProvider: ContextProvider = {
      name: 'test',
      description: 'Test provider',
      getContext: async () => ({ summary: 'test context' })
    };

    it('should add context provider', () => {
      manager.addContextProvider(mockProvider);
      expect(manager.getContextProviders()).toContain(mockProvider);
    });

    it('should remove context provider', () => {
      manager.addContextProvider(mockProvider);
      manager.removeContextProvider('test');
      expect(manager.getContextProviders()).not.toContain(mockProvider);
    });

    it('should get context provider by name', () => {
      manager.addContextProvider(mockProvider);
      expect(manager.getContextProvider('test')).toBe(mockProvider);
    });

    it('should clear context providers', () => {
      manager.addContextProvider(mockProvider);
      manager.clearContextProviders();
      expect(manager.getContextProviders()).toEqual([]);
    });
  });

  describe('session lifecycle', () => {
    it('should check if session is expired', () => {
      jest.useFakeTimers();
      const customManager = new SessionManager({ timeout: 1000 });
      
      expect(customManager.isExpired()).toBe(false);
      
      jest.advanceTimersByTime(2000);
      expect(customManager.isExpired()).toBe(true);
      
      jest.useRealTimers();
    });

    it('should reset session', () => {
      manager.setState('key', 'value');
      manager.addHistoryEntry({ input: 'test' });
      
      const oldSessionId = manager.getState().sessionId;
      manager.reset();
      
      const newState = manager.getState();
      expect(newState.sessionId).not.toBe(oldSessionId);
      expect(newState.state.size).toBe(0);
      expect(newState.history).toEqual([]);
    });

    it('should export session state', () => {
      manager.setState('key', 'value');
      manager.addHistoryEntry({ input: 'test' });
      
      const exported = manager.export();
      expect(exported).toBe(JSON.stringify(
        manager.getState(),
        (key, value) => value instanceof Map ? Array.from(value.entries()) : value
      ));
    });

    it('should import session state', () => {
      const state: SessionState = {
        sessionId: 'test-id',
        state: new Map([['key', 'value']]),
        history: [{
          id: '1',
          timestamp: new Date(),
          input: 'test'
        }],
        contextProviders: [],
        startTime: new Date(),
        lastActivityTime: new Date()
      };
      
      const exported = JSON.stringify(
        state,
        (key, value) => value instanceof Map ? Array.from(value.entries()) : value
      );
      
      manager.import(exported);
      
      expect(manager.getState().sessionId).toBe('test-id');
      expect(manager.getStateValue('key')).toBe('value');
      expect(manager.getHistory()).toHaveLength(1);
    });
  });
});