import { Plugin, PluginMetadata, PluginContext } from '../types';
import { LLMCLIConfig } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { MockLLMProvider } from '../../../core/providers/MockLLMProvider';

describe('Plugin Interface', () => {
  let mockContext: PluginContext;
  let mockConfig: LLMCLIConfig;
  let mockSession: SessionState;

  beforeEach(() => {
    mockConfig = {
      llmProvider: new MockLLMProvider(),
      commands: {}
    };

    mockSession = {
      sessionId: 'test-session',
      state: new Map(),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };

    mockContext = {
      framework: {
        getConfig: () => mockConfig,
        getSession: () => mockSession,
        registerCommand: jest.fn(),
        unregisterCommand: jest.fn(),
        addContextProvider: jest.fn(),
        removeContextProvider: jest.fn()
      }
    };
  });

  describe('Plugin Structure', () => {
    it('should define plugin metadata', () => {
      const metadata: PluginMetadata = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'Test Author',
        dependencies: []
      };

      expect(metadata.name).toBe('test-plugin');
      expect(metadata.version).toBe('1.0.0');
    });

    it('should define plugin with required methods', () => {
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async (context) => {
          // Plugin initialization
        },
        cleanup: async (context) => {
          // Plugin cleanup
        }
      };

      expect(plugin.metadata).toBeDefined();
      expect(plugin.initialize).toBeDefined();
      expect(typeof plugin.initialize).toBe('function');
    });

    it('should support optional methods', () => {
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async (context) => {},
        cleanup: async (context) => {},
        onCommand: async (command, result, context) => {},
        onError: async (error, context) => {}
      };

      expect(plugin.onCommand).toBeDefined();
      expect(plugin.onError).toBeDefined();
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should initialize plugin', async () => {
      const initializeMock = jest.fn();
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: initializeMock,
        cleanup: async () => {}
      };

      await plugin.initialize(mockContext);
      expect(initializeMock).toHaveBeenCalledWith(mockContext);
    });

    it('should cleanup plugin', async () => {
      const cleanupMock = jest.fn();
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async () => {},
        cleanup: cleanupMock
      };

      await plugin.cleanup!(mockContext);
      expect(cleanupMock).toHaveBeenCalledWith(mockContext);
    });

    it('should handle plugin without cleanup', async () => {
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async () => {}
      };

      // Should not throw
      expect(plugin.cleanup).toBeUndefined();
    });
  });

  describe('Plugin Context Access', () => {
    it('should access framework config', async () => {
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async (context) => {
          const config = context.framework.getConfig();
          expect(config).toBe(mockConfig);
        }
      };

      await plugin.initialize(mockContext);
    });

    it('should access session state', async () => {
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async (context) => {
          const session = context.framework.getSession();
          expect(session).toBe(mockSession);
        }
      };

      await plugin.initialize(mockContext);
    });

    it('should register commands', async () => {
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async (context) => {
          context.framework.registerCommand('plugin-command', {
            handler: async () => ({ success: true }),
            description: 'Plugin command'
          });
        }
      };

      await plugin.initialize(mockContext);
      expect(mockContext.framework.registerCommand).toHaveBeenCalled();
    });

    it('should add context providers', async () => {
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async (context) => {
          context.framework.addContextProvider({
            name: 'plugin-provider',
            description: 'Plugin context provider',
            getContext: async () => ({ summary: 'Plugin context' })
          });
        }
      };

      await plugin.initialize(mockContext);
      expect(mockContext.framework.addContextProvider).toHaveBeenCalled();
    });
  });

  describe('Plugin Hooks', () => {
    it('should handle command execution hook', async () => {
      const onCommandMock = jest.fn();
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async () => {},
        onCommand: onCommandMock
      };

      await plugin.onCommand!('test', { success: true }, mockContext);
      expect(onCommandMock).toHaveBeenCalledWith('test', { success: true }, mockContext);
    });

    it('should handle error hook', async () => {
      const onErrorMock = jest.fn();
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async () => {},
        onError: onErrorMock
      };

      const error = new Error('Test error');
      await plugin.onError!(error, mockContext);
      expect(onErrorMock).toHaveBeenCalledWith(error, mockContext);
    });

    it('should handle session start hook', async () => {
      const onSessionStartMock = jest.fn();
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async () => {},
        onSessionStart: onSessionStartMock
      };

      await plugin.onSessionStart!(mockSession, mockContext);
      expect(onSessionStartMock).toHaveBeenCalledWith(mockSession, mockContext);
    });

    it('should handle session end hook', async () => {
      const onSessionEndMock = jest.fn();
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async () => {},
        onSessionEnd: onSessionEndMock
      };

      await plugin.onSessionEnd!(mockSession, mockContext);
      expect(onSessionEndMock).toHaveBeenCalledWith(mockSession, mockContext);
    });
  });

  describe('Plugin Dependencies', () => {
    it('should define plugin dependencies', () => {
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin',
          dependencies: ['other-plugin@^1.0.0', 'another-plugin@~2.0.0']
        },
        initialize: async () => {}
      };

      expect(plugin.metadata.dependencies).toHaveLength(2);
      expect(plugin.metadata.dependencies![0]).toBe('other-plugin@^1.0.0');
    });

    it('should handle plugins without dependencies', () => {
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async () => {}
      };

      expect(plugin.metadata.dependencies).toBeUndefined();
    });
  });

  describe('Plugin Configuration', () => {
    it('should support plugin configuration', () => {
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin',
          configSchema: {
            enabled: { type: 'boolean', default: true },
            apiKey: { type: 'string', required: true }
          }
        },
        initialize: async () => {}
      };

      expect(plugin.metadata.configSchema).toBeDefined();
      expect(plugin.metadata.configSchema!.enabled.default).toBe(true);
    });

    it('should validate plugin configuration', async () => {
      const plugin: Plugin = {
        metadata: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'A test plugin'
        },
        initialize: async (context) => {
          const config = context.pluginConfig || {};
          if (!config.apiKey) {
            throw new Error('API key is required');
          }
        }
      };

      await expect(plugin.initialize(mockContext)).rejects.toThrow('API key is required');
    });
  });
});