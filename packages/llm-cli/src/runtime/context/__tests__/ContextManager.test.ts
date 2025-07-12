import { ContextManager } from '../ContextManager';
import { ContextProvider, ContextData } from '../types';
import { SessionState } from '../../../runtime/session/types';

describe('ContextManager', () => {
  let manager: ContextManager;
  
  const createMockSession = (): SessionState => ({
    sessionId: 'test',
    state: new Map([['testKey', 'testValue']]),
    history: [],
    contextProviders: [],
    startTime: new Date(),
    lastActivityTime: new Date()
  });

  const createMockProvider = (
    name: string, 
    priority: number = 0,
    isRelevant: boolean = true
  ): ContextProvider => ({
    name,
    description: `${name} provider`,
    priority,
    getContext: jest.fn().mockResolvedValue({
      summary: `Context from ${name}`,
      details: { provider: name }
    }),
    isRelevant: jest.fn().mockResolvedValue(isRelevant)
  });

  beforeEach(() => {
    manager = new ContextManager();
  });

  describe('context gathering', () => {
    it('should gather context from all providers', async () => {
      const provider1 = createMockProvider('provider1');
      const provider2 = createMockProvider('provider2');
      const session = createMockSession();
      session.contextProviders = [provider1, provider2];

      const contexts = await manager.gatherContext(session);

      expect(contexts).toHaveLength(2);
      expect(contexts[0].summary).toBe('Context from provider1');
      expect(contexts[1].summary).toBe('Context from provider2');
      expect(provider1.getContext).toHaveBeenCalledWith(session);
      expect(provider2.getContext).toHaveBeenCalledWith(session);
    });

    it('should filter irrelevant providers', async () => {
      const provider1 = createMockProvider('provider1', 0, true);
      const provider2 = createMockProvider('provider2', 0, false);
      const session = createMockSession();
      session.contextProviders = [provider1, provider2];

      const contexts = await manager.gatherContext(session);

      expect(contexts).toHaveLength(1);
      expect(contexts[0].summary).toBe('Context from provider1');
      expect(provider2.getContext).not.toHaveBeenCalled();
    });

    it('should handle providers without isRelevant method', async () => {
      const provider: ContextProvider = {
        name: 'test',
        description: 'test',
        getContext: jest.fn().mockResolvedValue({ summary: 'test context' })
      };
      const session = createMockSession();
      session.contextProviders = [provider];

      const contexts = await manager.gatherContext(session);

      expect(contexts).toHaveLength(1);
      expect(contexts[0].summary).toBe('test context');
    });

    it('should handle provider errors gracefully', async () => {
      const provider1 = createMockProvider('provider1');
      const provider2: ContextProvider = {
        name: 'provider2',
        description: 'test',
        getContext: jest.fn().mockRejectedValue(new Error('Provider error'))
      };
      const session = createMockSession();
      session.contextProviders = [provider1, provider2];

      const contexts = await manager.gatherContext(session);

      expect(contexts).toHaveLength(1);
      expect(contexts[0].summary).toBe('Context from provider1');
    });

    it('should gather contexts in parallel', async () => {
      const delays = [100, 50, 150];
      const providers = delays.map((delay, i) => ({
        name: `provider${i}`,
        description: 'test',
        getContext: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, delay));
          return { summary: `Context ${i}` };
        })
      }));
      
      const session = createMockSession();
      session.contextProviders = providers;

      const start = Date.now();
      const contexts = await manager.gatherContext(session);
      const duration = Date.now() - start;

      expect(contexts).toHaveLength(3);
      // Should take around the max delay (150ms), not the sum
      expect(duration).toBeLessThan(400);
    });
  });

  describe('context sorting', () => {
    it('should sort contexts by priority', async () => {
      const provider1 = createMockProvider('provider1', 10);
      const provider2 = createMockProvider('provider2', 30);
      const provider3 = createMockProvider('provider3', 20);
      const session = createMockSession();
      session.contextProviders = [provider1, provider2, provider3];

      const contexts = await manager.gatherContext(session);

      expect(contexts[0].summary).toBe('Context from provider2'); // highest priority
      expect(contexts[1].summary).toBe('Context from provider3');
      expect(contexts[2].summary).toBe('Context from provider1'); // lowest priority
    });

    it('should maintain order for same priority', async () => {
      const provider1 = createMockProvider('provider1', 10);
      const provider2 = createMockProvider('provider2', 10);
      const session = createMockSession();
      session.contextProviders = [provider1, provider2];

      const contexts = await manager.gatherContext(session);

      expect(contexts[0].summary).toBe('Context from provider1');
      expect(contexts[1].summary).toBe('Context from provider2');
    });
  });

  describe('context aggregation', () => {
    it('should aggregate relevant commands', async () => {
      const provider1: ContextProvider = {
        name: 'provider1',
        description: 'test',
        getContext: async () => ({
          summary: 'test',
          relevantCommands: ['cmd1', 'cmd2']
        })
      };
      const provider2: ContextProvider = {
        name: 'provider2',
        description: 'test',
        getContext: async () => ({
          summary: 'test',
          relevantCommands: ['cmd2', 'cmd3']
        })
      };
      const session = createMockSession();
      session.contextProviders = [provider1, provider2];

      const aggregated = await manager.getAggregatedContext(session);

      expect(aggregated.relevantCommands).toEqual(['cmd1', 'cmd2', 'cmd3']);
    });

    it('should aggregate warnings', async () => {
      const provider1: ContextProvider = {
        name: 'provider1',
        description: 'test',
        getContext: async () => ({
          summary: 'test',
          warnings: ['warning1']
        })
      };
      const provider2: ContextProvider = {
        name: 'provider2',
        description: 'test',
        getContext: async () => ({
          summary: 'test',
          warnings: ['warning2']
        })
      };
      const session = createMockSession();
      session.contextProviders = [provider1, provider2];

      const aggregated = await manager.getAggregatedContext(session);

      expect(aggregated.warnings).toEqual(['warning1', 'warning2']);
    });

    it('should aggregate suggestions', async () => {
      const provider1: ContextProvider = {
        name: 'provider1',
        description: 'test',
        getContext: async () => ({
          summary: 'test',
          suggestions: ['suggestion1', 'suggestion2']
        })
      };
      const provider2: ContextProvider = {
        name: 'provider2',
        description: 'test',
        getContext: async () => ({
          summary: 'test',
          suggestions: ['suggestion2', 'suggestion3'] // duplicate should be removed
        })
      };
      const session = createMockSession();
      session.contextProviders = [provider1, provider2];

      const aggregated = await manager.getAggregatedContext(session);

      expect(aggregated.suggestions).toEqual(['suggestion1', 'suggestion2', 'suggestion3']);
    });
  });

  describe('context updates', () => {
    it('should update all providers with results', async () => {
      const provider1 = createMockProvider('provider1');
      const provider2 = createMockProvider('provider2');
      provider1.updateContext = jest.fn();
      provider2.updateContext = jest.fn();
      
      const session = createMockSession();
      session.contextProviders = [provider1, provider2];
      
      const result = { success: true, output: 'test' };

      await manager.updateContext(session, result);

      expect(provider1.updateContext).toHaveBeenCalledWith(session, result);
      expect(provider2.updateContext).toHaveBeenCalledWith(session, result);
    });

    it('should handle update errors gracefully', async () => {
      const provider1 = createMockProvider('provider1');
      const provider2 = createMockProvider('provider2');
      provider1.updateContext = jest.fn();
      provider2.updateContext = jest.fn().mockRejectedValue(new Error('Update error'));
      
      const session = createMockSession();
      session.contextProviders = [provider1, provider2];
      
      const result = { success: true };

      // Should not throw
      await expect(manager.updateContext(session, result)).resolves.not.toThrow();
      expect(provider1.updateContext).toHaveBeenCalled();
    });

    it('should skip providers without updateContext', async () => {
      const provider = createMockProvider('provider1');
      const session = createMockSession();
      session.contextProviders = [provider];
      
      const result = { success: true };

      // Should not throw
      await expect(manager.updateContext(session, result)).resolves.not.toThrow();
    });
  });
});