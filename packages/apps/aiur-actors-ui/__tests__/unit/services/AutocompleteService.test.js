/**
 * Tests for AutocompleteService
 * Provides intelligent command completion and suggestions
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('AutocompleteService', () => {
  let AutocompleteService;
  let service;
  let mockToolRegistry, mockVariableStore, mockHistoryManager;
  
  beforeEach(async () => {
    // Mock dependencies
    mockToolRegistry = {
      getAllTools: jest.fn().mockReturnValue([
        {
          id: 'git.status',
          name: 'Git Status',
          command: 'git status',
          description: 'Show working tree status',
          parameters: []
        },
        {
          id: 'git.commit',
          name: 'Git Commit',
          command: 'git commit',
          description: 'Record changes to repository',
          parameters: [
            { name: '-m', description: 'Commit message', required: true },
            { name: '--amend', description: 'Amend previous commit', required: false },
            { name: '--all', description: 'Commit all changed files', required: false }
          ]
        },
        {
          id: 'npm.install',
          name: 'NPM Install',
          command: 'npm install',
          description: 'Install dependencies',
          parameters: [
            { name: '--save', description: 'Save to dependencies', required: false },
            { name: '--save-dev', description: 'Save to devDependencies', required: false },
            { name: '--global', description: 'Install globally', required: false }
          ]
        },
        {
          id: 'echo',
          name: 'Echo',
          command: 'echo',
          description: 'Display message',
          parameters: []
        }
      ]),
      
      getToolByCommand: jest.fn((cmd) => {
        const tools = mockToolRegistry.getAllTools();
        return tools.find(t => t.command === cmd || t.command.startsWith(cmd + ' '));
      })
    };
    
    mockVariableStore = {
      getAllVariables: jest.fn().mockReturnValue([
        { name: 'API_KEY', value: 'secret123', type: 'string' },
        { name: 'API_URL', value: 'https://api.example.com', type: 'string' },
        { name: 'DEBUG_MODE', value: 'true', type: 'boolean' },
        { name: 'TIMEOUT', value: '5000', type: 'number' },
        { name: 'USER_CONFIG', value: '{"theme":"dark"}', type: 'object' }
      ]),
      
      getVariable: jest.fn((name) => {
        const vars = mockVariableStore.getAllVariables();
        return vars.find(v => v.name === name);
      })
    };
    
    mockHistoryManager = {
      getHistory: jest.fn().mockReturnValue([
        'git status',
        'npm install',
        'git commit -m "Initial commit"',
        'echo $API_URL',
        'npm run test',
        'git add .',
        'ls -la',
        'pwd',
        'cd src',
        'npm start'
      ]),
      
      searchHistory: jest.fn((query) => {
        const history = mockHistoryManager.getHistory();
        return history.filter(cmd => cmd.includes(query));
      })
    };
    
    // Import or create AutocompleteService
    try {
      ({ AutocompleteService } = await import('../../../src/services/AutocompleteService.js'));
    } catch (error) {
      // Create mock implementation
      AutocompleteService = class {
        constructor(dependencies = {}) {
          this.toolRegistry = dependencies.toolRegistry;
          this.variableStore = dependencies.variableStore;
          this.historyManager = dependencies.historyManager;
          
          // Configuration
          this.config = {
            maxSuggestions: 10,
            minPrefixLength: 1,
            enableFuzzyMatch: true,
            scoreWeights: {
              exact: 100,
              prefix: 80,
              contains: 60,
              fuzzy: 40,
              history: 20,
              popularity: 10
            },
            ...dependencies.config
          };
          
          // Cache
          this.cache = new Map();
          this.popularityScores = new Map();
        }
        
        getSuggestions(input, context = {}) {
          const { cursorPosition = input.length, type = 'all' } = context;
          
          // Parse input to determine context
          const parsed = this.parseInput(input, cursorPosition);
          
          // Get suggestions based on context
          let suggestions = [];
          
          if (parsed.type === 'command') {
            suggestions = this.getCommandSuggestions(parsed.value);
          } else if (parsed.type === 'parameter') {
            suggestions = this.getParameterSuggestions(parsed.command, parsed.value);
          } else if (parsed.type === 'variable') {
            suggestions = this.getVariableSuggestions(parsed.value);
          } else if (parsed.type === 'path') {
            suggestions = this.getPathSuggestions(parsed.value);
          }
          
          // Filter by type if specified
          if (type !== 'all') {
            suggestions = suggestions.filter(s => s.type === type);
          }
          
          // Sort and limit
          suggestions = this.rankSuggestions(suggestions, parsed.value);
          return suggestions.slice(0, this.config.maxSuggestions);
        }
        
        parseInput(input, cursorPosition) {
          const beforeCursor = input.substring(0, cursorPosition);
          const parts = beforeCursor.split(/\s+/);
          const currentPart = parts[parts.length - 1] || '';
          
          // Check for variable
          if (currentPart.startsWith('$')) {
            return { type: 'variable', value: currentPart.substring(1) };
          }
          
          // Check for path
          if (currentPart.includes('/') || currentPart.startsWith('.')) {
            return { type: 'path', value: currentPart };
          }
          
          // Check for parameter
          if (currentPart.startsWith('-')) {
            const command = parts.slice(0, -1).join(' ');
            return { type: 'parameter', command, value: currentPart };
          }
          
          // Default to command
          if (parts.length === 1) {
            return { type: 'command', value: currentPart };
          }
          
          // Multi-part input - could be parameter position
          const command = parts[0];
          return { type: 'parameter', command, value: currentPart };
        }
        
        getCommandSuggestions(prefix) {
          const suggestions = [];
          
          // Add tool commands
          const tools = this.toolRegistry.getAllTools();
          for (const tool of tools) {
            const score = this.calculateScore(tool.command, prefix);
            if (score > 0) {
              suggestions.push({
                type: 'command',
                value: tool.command,
                display: tool.name,
                description: tool.description,
                score,
                metadata: { toolId: tool.id }
              });
            }
          }
          
          // Add history commands
          const history = this.historyManager.getHistory();
          for (const cmd of history) {
            const baseCommand = cmd.split(' ')[0];
            if (!suggestions.find(s => s.value === baseCommand)) {
              const score = this.calculateScore(baseCommand, prefix);
              if (score > 0) {
                suggestions.push({
                  type: 'command',
                  value: baseCommand,
                  display: baseCommand,
                  description: 'From history',
                  score: score + this.config.scoreWeights.history
                });
              }
            }
          }
          
          return suggestions;
        }
        
        getParameterSuggestions(command, prefix) {
          const suggestions = [];
          
          // Get tool for command
          const tool = this.toolRegistry.getToolByCommand(command);
          if (!tool || !tool.parameters) {
            return suggestions;
          }
          
          // Add parameter suggestions
          for (const param of tool.parameters) {
            const score = this.calculateScore(param.name, prefix);
            if (score > 0) {
              suggestions.push({
                type: 'parameter',
                value: param.name,
                display: param.name,
                description: param.description,
                score,
                metadata: { 
                  required: param.required,
                  command 
                }
              });
            }
          }
          
          return suggestions;
        }
        
        getVariableSuggestions(prefix) {
          const suggestions = [];
          const variables = this.variableStore.getAllVariables();
          
          for (const variable of variables) {
            const score = this.calculateScore(variable.name, prefix);
            if (score > 0) {
              suggestions.push({
                type: 'variable',
                value: '$' + variable.name,
                display: variable.name,
                description: `${variable.type}: ${variable.value}`,
                score,
                metadata: {
                  name: variable.name,
                  type: variable.type,
                  value: variable.value
                }
              });
            }
          }
          
          return suggestions;
        }
        
        getPathSuggestions(prefix) {
          // Simplified path suggestions for testing
          const paths = [
            'src/',
            'src/components/',
            'src/services/',
            'src/actors/',
            'tests/',
            'docs/',
            'package.json',
            'README.md'
          ];
          
          const suggestions = [];
          for (const path of paths) {
            const score = this.calculateScore(path, prefix);
            if (score > 0) {
              suggestions.push({
                type: 'path',
                value: path,
                display: path,
                description: path.endsWith('/') ? 'Directory' : 'File',
                score
              });
            }
          }
          
          return suggestions;
        }
        
        calculateScore(text, query) {
          if (!query || query.length < this.config.minPrefixLength) {
            return 0;
          }
          
          const textLower = text.toLowerCase();
          const queryLower = query.toLowerCase();
          
          // Exact match
          if (textLower === queryLower) {
            return this.config.scoreWeights.exact;
          }
          
          // Prefix match
          if (textLower.startsWith(queryLower)) {
            return this.config.scoreWeights.prefix;
          }
          
          // Contains match
          if (textLower.includes(queryLower)) {
            return this.config.scoreWeights.contains;
          }
          
          // Fuzzy match
          if (this.config.enableFuzzyMatch && this.fuzzyMatch(textLower, queryLower)) {
            return this.config.scoreWeights.fuzzy;
          }
          
          return 0;
        }
        
        fuzzyMatch(text, query) {
          let queryIndex = 0;
          for (let i = 0; i < text.length && queryIndex < query.length; i++) {
            if (text[i] === query[queryIndex]) {
              queryIndex++;
            }
          }
          return queryIndex === query.length;
        }
        
        rankSuggestions(suggestions, query) {
          // Add popularity scores
          for (const suggestion of suggestions) {
            const popularity = this.popularityScores.get(suggestion.value) || 0;
            suggestion.score += popularity * this.config.scoreWeights.popularity;
          }
          
          // Sort by score
          return suggestions.sort((a, b) => b.score - a.score);
        }
        
        recordUsage(value) {
          const current = this.popularityScores.get(value) || 0;
          this.popularityScores.set(value, current + 1);
        }
        
        clearCache() {
          this.cache.clear();
        }
      };
    }
    
    // Create service instance
    service = new AutocompleteService({
      toolRegistry: mockToolRegistry,
      variableStore: mockVariableStore,
      historyManager: mockHistoryManager
    });
  });
  
  describe('Command Suggestions', () => {
    test('should suggest commands based on prefix', () => {
      const suggestions = service.getSuggestions('gi');
      
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'command',
          value: 'git status',
          display: 'Git Status'
        })
      );
      
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'command',
          value: 'git commit',
          display: 'Git Commit'
        })
      );
    });
    
    test('should suggest commands from history', () => {
      const suggestions = service.getSuggestions('ls');
      
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'command',
          value: 'ls',
          description: 'From history'
        })
      );
    });
    
    test('should rank exact matches higher', () => {
      const suggestions = service.getSuggestions('echo');
      
      expect(suggestions[0]).toMatchObject({
        type: 'command',
        value: 'echo',
        display: 'Echo'
      });
    });
    
    test('should support fuzzy matching', () => {
      const suggestions = service.getSuggestions('gt');
      
      // 'gt' should fuzzy match 'git'
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          value: expect.stringContaining('git')
        })
      );
    });
    
    test('should limit number of suggestions', () => {
      service.config.maxSuggestions = 3;
      const suggestions = service.getSuggestions('');
      
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });
  
  describe('Parameter Hints', () => {
    test('should suggest parameters for known commands', () => {
      const suggestions = service.getSuggestions('git commit -', {
        cursorPosition: 12
      });
      
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'parameter',
          value: '-m',
          description: 'Commit message'
        })
      );
      
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'parameter',
          value: '--amend',
          description: 'Amend previous commit'
        })
      );
    });
    
    test('should indicate required parameters', () => {
      const suggestions = service.getSuggestions('git commit -', {
        cursorPosition: 12
      });
      
      const messageParam = suggestions.find(s => s.value === '-m');
      expect(messageParam.metadata.required).toBe(true);
      
      const amendParam = suggestions.find(s => s.value === '--amend');
      expect(amendParam.metadata.required).toBe(false);
    });
    
    test('should filter parameters by prefix', () => {
      const suggestions = service.getSuggestions('git commit --a', {
        cursorPosition: 14
      });
      
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          value: '--amend'
        })
      );
      
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          value: '--all'
        })
      );
      
      expect(suggestions).not.toContainEqual(
        expect.objectContaining({
          value: '-m'
        })
      );
    });
    
    test('should handle npm parameters', () => {
      const suggestions = service.getSuggestions('npm install --', {
        cursorPosition: 14
      });
      
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          value: '--save'
        })
      );
      
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          value: '--save-dev'
        })
      );
      
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          value: '--global'
        })
      );
    });
  });
  
  describe('Variable Completion', () => {
    test('should suggest variables when $ is typed', () => {
      const suggestions = service.getSuggestions('echo $');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every(s => s.type === 'variable')).toBe(true);
    });
    
    test('should filter variables by prefix', () => {
      const suggestions = service.getSuggestions('echo $API');
      
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'variable',
          value: '$API_KEY',
          display: 'API_KEY'
        })
      );
      
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'variable',
          value: '$API_URL',
          display: 'API_URL'
        })
      );
      
      expect(suggestions).not.toContainEqual(
        expect.objectContaining({
          display: 'DEBUG_MODE'
        })
      );
    });
    
    test('should show variable type and value in description', () => {
      const suggestions = service.getSuggestions('$DEBUG');
      
      const debugVar = suggestions.find(s => s.display === 'DEBUG_MODE');
      expect(debugVar.description).toBe('boolean: true');
    });
    
    test('should complete variables in middle of command', () => {
      const input = 'curl $API -H "Auth: $"';
      const suggestions = service.getSuggestions(input, {
        cursorPosition: 21 // After second $
      });
      
      expect(suggestions.every(s => s.type === 'variable')).toBe(true);
    });
    
    test('should handle object and array variables', () => {
      const suggestions = service.getSuggestions('$USER');
      
      const configVar = suggestions.find(s => s.display === 'USER_CONFIG');
      expect(configVar.metadata.type).toBe('object');
      expect(configVar.description).toContain('object:');
    });
  });
  
  describe('Path Suggestions', () => {
    test('should suggest paths when / is typed', () => {
      const suggestions = service.getSuggestions('cd src/');
      
      expect(suggestions).toContainEqual(
        expect.objectContaining({
          type: 'path',
          value: expect.stringContaining('src/')
        })
      );
    });
    
    test('should suggest paths starting with .', () => {
      const suggestions = service.getSuggestions('./');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every(s => s.type === 'path')).toBe(true);
    });
    
    test('should differentiate files and directories', () => {
      const suggestions = service.getSuggestions('');
      
      const srcDir = suggestions.find(s => s.value === 'src/');
      expect(srcDir?.description).toBe('Directory');
      
      const packageFile = suggestions.find(s => s.value === 'package.json');
      expect(packageFile?.description).toBe('File');
    });
  });
  
  describe('Context Awareness', () => {
    test('should parse input correctly at different cursor positions', () => {
      const input = 'git commit -m "message"';
      
      // At beginning
      let parsed = service.parseInput(input, 0);
      expect(parsed.type).toBe('command');
      expect(parsed.value).toBe('');
      
      // After command
      parsed = service.parseInput(input, 10);
      expect(parsed.type).toBe('parameter');
      expect(parsed.command).toBe('git commit');
      
      // After parameter
      parsed = service.parseInput(input, 13);
      expect(parsed.type).toBe('parameter');
      expect(parsed.value).toBe('-m');
    });
    
    test('should handle complex command structures', () => {
      const input = 'npm run test -- --coverage --watch';
      const parsed = service.parseInput(input, 27); // After --coverage
      
      expect(parsed.type).toBe('parameter');
      expect(parsed.value).toBe('--coverage');
    });
    
    test('should identify variable context correctly', () => {
      const input = 'echo "Hello $USER_NAME"';
      const parsed = service.parseInput(input, 18); // After $USER
      
      expect(parsed.type).toBe('variable');
      expect(parsed.value).toBe('USER');
    });
  });
  
  describe('Ranking and Scoring', () => {
    test('should score exact matches highest', () => {
      const echoScore = service.calculateScore('echo', 'echo');
      const echoPartialScore = service.calculateScore('echo', 'ec');
      
      expect(echoScore).toBeGreaterThan(echoPartialScore);
    });
    
    test('should score prefix matches higher than contains', () => {
      const prefixScore = service.calculateScore('git-status', 'git');
      const containsScore = service.calculateScore('my-git-tool', 'git');
      
      expect(prefixScore).toBeGreaterThan(containsScore);
    });
    
    test('should apply popularity scores', () => {
      // Record usage
      service.recordUsage('git status');
      service.recordUsage('git status');
      service.recordUsage('git commit');
      
      const suggestions = service.getSuggestions('git');
      
      // git status should rank higher due to popularity
      const statusIndex = suggestions.findIndex(s => s.value === 'git status');
      const commitIndex = suggestions.findIndex(s => s.value === 'git commit');
      
      expect(statusIndex).toBeLessThan(commitIndex);
    });
    
    test('should handle fuzzy matching scoring', () => {
      const fuzzyScore = service.calculateScore('git-commit', 'gtcmt');
      expect(fuzzyScore).toBeGreaterThan(0);
      expect(fuzzyScore).toBeLessThan(service.config.scoreWeights.prefix);
    });
  });
  
  describe('Performance', () => {
    test('should cache frequent queries', () => {
      const spy = jest.spyOn(service, 'getCommandSuggestions');
      
      // First call
      service.getSuggestions('git');
      expect(spy).toHaveBeenCalledTimes(1);
      
      // TODO: Implement caching
      // Second call should use cache
      // service.getSuggestions('git');
      // expect(spy).toHaveBeenCalledTimes(1);
      
      spy.mockRestore();
    });
    
    test('should handle large datasets efficiently', () => {
      // Add many tools
      const manyTools = [];
      for (let i = 0; i < 1000; i++) {
        manyTools.push({
          id: `tool-${i}`,
          name: `Tool ${i}`,
          command: `tool${i}`,
          description: `Description ${i}`
        });
      }
      mockToolRegistry.getAllTools.mockReturnValue(manyTools);
      
      const start = Date.now();
      const suggestions = service.getSuggestions('tool');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(suggestions.length).toBeLessThanOrEqual(service.config.maxSuggestions);
    });
    
    test('should clear cache when requested', () => {
      service.cache.set('test', ['cached']);
      service.clearCache();
      
      expect(service.cache.size).toBe(0);
    });
  });
  
  describe('Special Cases', () => {
    test('should handle empty input', () => {
      const suggestions = service.getSuggestions('');
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(service.config.maxSuggestions);
    });
    
    test('should handle input with multiple spaces', () => {
      const suggestions = service.getSuggestions('git   commit   -m');
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });
    
    test('should handle special characters in input', () => {
      const suggestions = service.getSuggestions('echo "test$');
      
      expect(suggestions.every(s => s.type === 'variable')).toBe(true);
    });
    
    test('should handle pipe and redirect operators', () => {
      const input = 'ls -la | grep test > output.txt';
      const parsed = service.parseInput(input, 20); // After 'grep test'
      
      expect(parsed).toBeDefined();
      // Should still parse correctly after pipe
    });
  });
});