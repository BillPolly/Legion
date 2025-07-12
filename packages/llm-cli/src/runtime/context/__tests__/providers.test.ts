import { StateContextProvider } from '../providers/StateContextProvider';
import { HistoryContextProvider } from '../providers/HistoryContextProvider';
import { SessionState } from '../../../runtime/session/types';

describe('Built-in Context Providers', () => {
  const createMockSession = (
    state?: Map<string, any>,
    history?: any[]
  ): SessionState => ({
    sessionId: 'test',
    state: state || new Map(),
    history: history || [],
    contextProviders: [],
    startTime: new Date(),
    lastActivityTime: new Date()
  });

  describe('StateContextProvider', () => {
    let provider: StateContextProvider;

    beforeEach(() => {
      provider = new StateContextProvider();
    });

    it('should provide context for empty state', async () => {
      const session = createMockSession();
      const context = await provider.getContext(session);

      expect(context.summary).toBe('Session state is empty');
      expect(context.details).toEqual({ stateSize: 0 });
    });

    it('should provide context for populated state', async () => {
      const state = new Map<string, any>([
        ['user', 'John'],
        ['count', 5],
        ['isActive', true]
      ]);
      const session = createMockSession(state);
      const context = await provider.getContext(session);

      expect(context.summary).toBe('Session has 3 state entries');
      expect(context.details?.stateSize).toBe(3);
      expect(context.details?.keys).toEqual(['user', 'count', 'isActive']);
    });

    it('should provide state preview for small states', async () => {
      const state = new Map<string, any>([
        ['name', 'Test'],
        ['value', 123]
      ]);
      const session = createMockSession(state);
      const context = await provider.getContext(session);

      expect(context.details?.preview).toEqual({
        name: 'Test',
        value: 123
      });
    });

    it('should limit preview for large states', async () => {
      const state = new Map();
      for (let i = 0; i < 10; i++) {
        state.set(`key${i}`, `value${i}`);
      }
      const session = createMockSession(state);
      const context = await provider.getContext(session);

      const previewKeys = Object.keys(context.details?.preview || {});
      expect(previewKeys.length).toBe(5); // Limited to 5
    });

    it('should always be relevant', async () => {
      const session = createMockSession();
      expect(await provider.isRelevant?.(session)).toBe(true);
    });
  });

  describe('HistoryContextProvider', () => {
    let provider: HistoryContextProvider;

    beforeEach(() => {
      provider = new HistoryContextProvider();
    });

    it('should provide context for empty history', async () => {
      const session = createMockSession();
      const context = await provider.getContext(session);

      expect(context.summary).toBe('No command history');
      expect(context.details).toEqual({ historyLength: 0 });
    });

    it('should provide context for populated history', async () => {
      const history = [
        {
          id: '1',
          timestamp: new Date(),
          input: 'search test',
          intent: {
            command: 'search',
            parameters: { query: 'test' },
            confidence: 0.9,
            rawQuery: 'search test'
          },
          result: { success: true, output: 'Found 5 results' }
        },
        {
          id: '2',
          timestamp: new Date(),
          input: 'show stats',
          intent: {
            command: 'stats',
            parameters: {},
            confidence: 0.95,
            rawQuery: 'show stats'
          },
          result: { success: true }
        }
      ];
      const session = createMockSession(undefined, history);
      const context = await provider.getContext(session);

      expect(context.summary).toContain('2 commands in history');
      expect(context.summary).toContain('Last: stats');
      expect(context.details?.historyLength).toBe(2);
      expect(context.details?.recentCommands).toEqual(['search', 'stats']);
    });

    it('should provide suggestions based on last command', async () => {
      const history = [{
        id: '1',
        timestamp: new Date(),
        input: 'search test',
        intent: {
          command: 'search',
          parameters: { query: 'test' },
          confidence: 0.9,
          rawQuery: 'search test'
        },
        result: { 
          success: true,
          suggestions: ['Try refining your search', 'Filter results']
        }
      }];
      const session = createMockSession(undefined, history);
      const context = await provider.getContext(session);

      expect(context.suggestions).toEqual(['Try refining your search', 'Filter results']);
    });

    it('should handle failed commands', async () => {
      const history = [{
        id: '1',
        timestamp: new Date(),
        input: 'invalid command',
        intent: {
          command: 'invalid',
          parameters: {},
          confidence: 0.3,
          rawQuery: 'invalid command'
        },
        result: { 
          success: false,
          error: 'Command not found'
        }
      }];
      const session = createMockSession(undefined, history);
      const context = await provider.getContext(session);

      expect(context.warnings).toContain('Last command failed: Command not found');
    });

    it('should provide command frequency', async () => {
      const history = [
        {
          id: '1',
          timestamp: new Date(),
          input: 'search 1',
          intent: { command: 'search', parameters: {}, confidence: 0.9, rawQuery: 'search 1' }
        },
        {
          id: '2',
          timestamp: new Date(),
          input: 'search 2',
          intent: { command: 'search', parameters: {}, confidence: 0.9, rawQuery: 'search 2' }
        },
        {
          id: '3',
          timestamp: new Date(),
          input: 'stats',
          intent: { command: 'stats', parameters: {}, confidence: 0.9, rawQuery: 'stats' }
        }
      ];
      const session = createMockSession(undefined, history);
      const context = await provider.getContext(session);

      expect(context.details?.commandFrequency).toEqual({
        search: 2,
        stats: 1
      });
      expect(context.relevantCommands).toContain('search'); // Most used
    });

    it('should be relevant only with history', async () => {
      const emptySession = createMockSession();
      expect(await provider.isRelevant?.(emptySession)).toBe(false);

      const sessionWithHistory = createMockSession(undefined, [{ id: '1', timestamp: new Date(), input: 'test' }]);
      expect(await provider.isRelevant?.(sessionWithHistory)).toBe(true);
    });
  });
});