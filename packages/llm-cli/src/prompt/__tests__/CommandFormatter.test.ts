import { CommandFormatter } from '../formatter/CommandFormatter';
import { DefaultCommandFormatter } from '../formatter/DefaultCommandFormatter';
import { CommandRegistry, CommandDefinition } from '../../core/types';
import { SessionState } from '../../runtime/session/types';

describe('CommandFormatter', () => {
  let formatter: CommandFormatter;
  let session: SessionState;

  beforeEach(() => {
    formatter = new DefaultCommandFormatter();
    session = {
      sessionId: 'test',
      state: new Map([['user', 'test']]),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };
  });

  describe('formatParameter', () => {
    it('should format required string parameter', () => {
      const param = {
        name: 'query',
        type: 'string' as const,
        description: 'Search query',
        required: true
      };

      const formatted = formatter.formatParameter(param);
      expect(formatted).toContain('query');
      expect(formatted).toContain('string');
      expect(formatted).toContain('required');
      expect(formatted).toContain('Search query');
    });

    it('should format optional parameter with default', () => {
      const param = {
        name: 'limit',
        type: 'number' as const,
        description: 'Result limit',
        required: false,
        default: 10
      };

      const formatted = formatter.formatParameter(param);
      expect(formatted).toContain('optional');
      expect(formatted).toContain('default: 10');
    });

    it('should format enum parameter', () => {
      const param = {
        name: 'format',
        type: 'enum' as const,
        description: 'Output format',
        required: true,
        enum: ['json', 'csv', 'xml']
      };

      const formatted = formatter.formatParameter(param);
      expect(formatted).toContain('enum');
      expect(formatted).toContain('json, csv, xml');
    });

    it('should format array parameter', () => {
      const param = {
        name: 'tags',
        type: 'array' as const,
        description: 'Filter tags',
        required: false,
        items: { type: 'string' as const }
      };

      const formatted = formatter.formatParameter(param);
      expect(formatted).toContain('array<string>');
    });
  });

  describe('formatExample', () => {
    it('should format simple example', () => {
      const example = {
        input: 'search for AI papers'
      };

      const formatted = formatter.formatExample(example);
      expect(formatted).toBe('"search for AI papers"');
    });

    it('should format example with output', () => {
      const example = {
        input: 'list projects',
        output: 'Found 3 projects'
      };

      const formatted = formatter.formatExample(example);
      expect(formatted).toContain('list projects');
      expect(formatted).toContain('→');
      expect(formatted).toContain('Found 3 projects');
    });

    it('should format example with description', () => {
      const example = {
        input: 'stats --verbose',
        description: 'Show detailed statistics'
      };

      const formatted = formatter.formatExample(example);
      expect(formatted).toContain('stats --verbose');
      expect(formatted).toContain('Show detailed statistics');
    });
  });

  describe('formatCommandUsage', () => {
    it('should format command with no parameters', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Show help'
      };

      const usage = formatter.formatCommandUsage('help', command);
      expect(usage).toBe('help');
    });

    it('should format command with required parameters', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Search',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'Query' },
          { name: 'type', type: 'string', required: true, description: 'Type' }
        ]
      };

      const usage = formatter.formatCommandUsage('search', command);
      expect(usage).toBe('search <query> <type>');
    });

    it('should format command with optional parameters', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'List',
        parameters: [
          { name: 'filter', type: 'string', required: false, description: 'Filter' },
          { name: 'limit', type: 'number', required: false, description: 'Limit' }
        ]
      };

      const usage = formatter.formatCommandUsage('list', command);
      expect(usage).toBe('list [filter] [limit]');
    });

    it('should format mixed parameters correctly', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Complex',
        parameters: [
          { name: 'required1', type: 'string', required: true, description: 'R1' },
          { name: 'optional1', type: 'string', required: false, description: 'O1' },
          { name: 'required2', type: 'string', required: true, description: 'R2' }
        ]
      };

      const usage = formatter.formatCommandUsage('complex', command);
      expect(usage).toBe('complex <required1> <required2> [optional1]');
    });
  });

  describe('formatRegistry', () => {
    it('should format empty registry', () => {
      const registry: CommandRegistry = {};
      const formatted = formatter.formatRegistry(registry, session);
      expect(formatted).toBe('No commands available.');
    });

    it('should format registry with multiple commands', () => {
      const registry: CommandRegistry = {
        search: {
          handler: async () => ({ success: true }),
          description: 'Search documents',
          parameters: [{
            name: 'query',
            type: 'string',
            required: true,
            description: 'Search query'
          }]
        },
        list: {
          handler: async () => ({ success: true }),
          description: 'List all items'
        }
      };

      const formatted = formatter.formatRegistry(registry, session);
      expect(formatted).toContain('search <query>');
      expect(formatted).toContain('Search documents');
      expect(formatted).toContain('list');
      expect(formatted).toContain('List all items');
    });

    it('should group commands by category', () => {
      const registry: CommandRegistry = {
        'search:documents': {
          handler: async () => ({ success: true }),
          description: 'Search documents',
          category: 'search'
        },
        'search:users': {
          handler: async () => ({ success: true }),
          description: 'Search users',
          category: 'search'
        },
        'admin:cleanup': {
          handler: async () => ({ success: true }),
          description: 'Cleanup data',
          category: 'admin'
        }
      };

      const formatted = formatter.formatRegistry(registry, session);
      // Categories should be sorted alphabetically, so admin comes before search
      expect(formatted).toContain('admin:');
      expect(formatted).toContain('search:');
      expect(formatted.indexOf('admin:')).toBeLessThan(formatted.indexOf('search:'));
    });

    it('should respect visibility requirements', () => {
      const registry: CommandRegistry = {
        public: {
          handler: async () => ({ success: true }),
          description: 'Public command'
        },
        admin: {
          handler: async () => ({ success: true }),
          description: 'Admin command',
          requirements: {
            customChecker: (session) => session.state.get('isAdmin') === true
          }
        }
      };

      const formatted = formatter.formatRegistry(registry, session);
      expect(formatted).toContain('public');
      expect(formatted).not.toContain('admin');

      // Now with admin
      session.state.set('isAdmin', true);
      const formattedAdmin = formatter.formatRegistry(registry, session);
      expect(formattedAdmin).toContain('admin');
    });
  });

  describe('formatCommandHelp', () => {
    it('should format detailed command help', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Search for documents in the database',
        parameters: [
          {
            name: 'query',
            type: 'string',
            required: true,
            description: 'The search query'
          },
          {
            name: 'limit',
            type: 'number',
            required: false,
            default: 10,
            description: 'Maximum results to return'
          }
        ],
        examples: [
          { input: 'search "machine learning"' },
          { input: 'search AI --limit 20' }
        ]
      };

      const help = formatter.formatCommandHelp('search', command, session);
      expect(help).toContain('search <query> [limit]');
      expect(help).toContain('Search for documents');
      expect(help).toContain('Parameters:');
      expect(help).toContain('query');
      expect(help).toContain('limit');
      expect(help).toContain('Examples:');
      expect(help).toContain('machine learning');
    });

    it('should include dynamic help', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Show statistics',
        helpGenerator: (session) => {
          const count = session.state.get('documentCount') || 0;
          return `Currently tracking ${count} documents`;
        }
      };

      session.state.set('documentCount', 42);
      const help = formatter.formatCommandHelp('stats', command, session);
      expect(help).toContain('Currently tracking 42 documents');
    });

    it('should show requirement errors', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Admin only command',
        requirements: {
          customChecker: () => false,
          errorMessage: 'You need admin privileges'
        }
      };

      const help = formatter.formatCommandHelp('admin', command, session);
      expect(help).toContain('You need admin privileges');
      expect(help).toContain('unavailable');
    });
  });
});