/**
 * AutocompleteService - Intelligent command completion and suggestions
 * Provides context-aware suggestions for commands, parameters, variables, and paths
 */
export class AutocompleteService {
  constructor(dependencies = {}) {
    this.toolRegistry = dependencies.toolRegistry;
    this.variableStore = dependencies.variableStore;
    this.historyManager = dependencies.historyManager;
    this.fileSystem = dependencies.fileSystem;
    
    // Configuration
    this.config = {
      maxSuggestions: 10,
      minPrefixLength: 1,
      enableFuzzyMatch: true,
      enableCache: true,
      cacheTimeout: 5000, // 5 seconds
      scoreWeights: {
        exact: 100,
        prefix: 80,
        contains: 60,
        fuzzy: 40,
        history: 20,
        popularity: 10,
        recent: 15
      },
      ...dependencies.config
    };
    
    // Cache for suggestions
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    
    // Usage tracking for popularity scoring
    this.popularityScores = new Map();
    this.recentlyUsed = [];
    this.maxRecentItems = 20;
    
    // Command aliases and shortcuts
    this.aliases = new Map([
      ['g', 'git'],
      ['n', 'npm'],
      ['d', 'docker'],
      ['k', 'kubectl'],
      ['y', 'yarn']
    ]);
    
    // Common command patterns
    this.commandPatterns = {
      git: ['status', 'add', 'commit', 'push', 'pull', 'branch', 'checkout', 'merge', 'log', 'diff'],
      npm: ['install', 'run', 'test', 'start', 'build', 'publish', 'update', 'audit'],
      docker: ['run', 'build', 'ps', 'images', 'exec', 'stop', 'start', 'logs'],
      yarn: ['add', 'remove', 'install', 'run', 'build', 'test', 'upgrade']
    };
  }

  /**
   * Get suggestions for the given input
   * @param {string} input - User input
   * @param {Object} context - Additional context
   * @returns {Array} Suggestions
   */
  getSuggestions(input, context = {}) {
    const { 
      cursorPosition = input.length, 
      type = 'all',
      maxResults = this.config.maxSuggestions 
    } = context;
    
    // Check cache
    const cacheKey = `${input}:${cursorPosition}:${type}`;
    if (this.config.enableCache && this.cache.has(cacheKey)) {
      const timestamp = this.cacheTimestamps.get(cacheKey);
      if (Date.now() - timestamp < this.config.cacheTimeout) {
        return this.cache.get(cacheKey);
      }
    }
    
    // Parse input to determine context
    const parsed = this.parseInput(input, cursorPosition);
    
    // Expand aliases
    if (parsed.type === 'command' && this.aliases.has(parsed.value)) {
      parsed.value = this.aliases.get(parsed.value);
    }
    
    // Get suggestions based on context
    let suggestions = [];
    
    switch (parsed.type) {
      case 'command':
        suggestions = this.getCommandSuggestions(parsed.value);
        break;
        
      case 'parameter':
        suggestions = this.getParameterSuggestions(parsed.command, parsed.value);
        break;
        
      case 'variable':
        suggestions = this.getVariableSuggestions(parsed.value);
        break;
        
      case 'path':
        suggestions = this.getPathSuggestions(parsed.value);
        break;
        
      case 'subcommand':
        suggestions = this.getSubcommandSuggestions(parsed.command, parsed.value);
        break;
        
      default:
        suggestions = this.getAllSuggestions(parsed.value);
    }
    
    // Filter by type if specified
    if (type !== 'all') {
      suggestions = suggestions.filter(s => s.type === type);
    }
    
    // Rank and limit suggestions
    suggestions = this.rankSuggestions(suggestions, parsed.value);
    suggestions = suggestions.slice(0, maxResults);
    
    // Cache results
    if (this.config.enableCache) {
      this.cache.set(cacheKey, suggestions);
      this.cacheTimestamps.set(cacheKey, Date.now());
    }
    
    return suggestions;
  }

  /**
   * Parse input to determine suggestion context
   * @param {string} input - User input
   * @param {number} cursorPosition - Cursor position
   * @returns {Object} Parsed context
   */
  parseInput(input, cursorPosition) {
    const beforeCursor = input.substring(0, cursorPosition);
    const parts = beforeCursor.split(/\s+/);
    const currentPart = parts[parts.length - 1] || '';
    
    // Check for variable
    if (currentPart.startsWith('$')) {
      return { 
        type: 'variable', 
        value: currentPart.substring(1),
        fullInput: input
      };
    }
    
    // Check for path
    if (currentPart.includes('/') || currentPart.startsWith('.') || currentPart.startsWith('~')) {
      return { 
        type: 'path', 
        value: currentPart,
        fullInput: input
      };
    }
    
    // Check for parameter
    if (currentPart.startsWith('-')) {
      const command = parts.slice(0, -1).join(' ');
      return { 
        type: 'parameter', 
        command, 
        value: currentPart,
        fullInput: input
      };
    }
    
    // Single word - likely a command
    if (parts.length === 1) {
      return { 
        type: 'command', 
        value: currentPart,
        fullInput: input
      };
    }
    
    // Multi-part input
    const command = parts[0];
    
    // Check for known command patterns (subcommands)
    if (this.commandPatterns[command] && parts.length === 2) {
      return {
        type: 'subcommand',
        command,
        value: parts[1],
        fullInput: input
      };
    }
    
    // Default to parameter context
    return { 
      type: 'parameter', 
      command: parts.slice(0, -1).join(' '), 
      value: currentPart,
      fullInput: input
    };
  }

  /**
   * Get command suggestions
   * @param {string} prefix - Command prefix
   * @returns {Array} Command suggestions
   */
  getCommandSuggestions(prefix) {
    const suggestions = [];
    const seen = new Set();
    
    // Add tool commands
    if (this.toolRegistry) {
      const tools = this.toolRegistry.getAllTools();
      for (const tool of tools) {
        const baseCommand = tool.command.split(' ')[0];
        if (!seen.has(baseCommand)) {
          const score = this.calculateScore(baseCommand, prefix);
          if (score > 0) {
            suggestions.push({
              type: 'command',
              value: tool.command,
              display: tool.name || baseCommand,
              description: tool.description || 'Available tool',
              score,
              metadata: { 
                toolId: tool.id,
                source: 'tools'
              }
            });
            seen.add(baseCommand);
          }
        }
      }
    }
    
    // Add commands from history
    if (this.historyManager) {
      const history = this.historyManager.getHistory();
      for (const cmd of history) {
        const baseCommand = cmd.split(' ')[0];
        if (!seen.has(baseCommand)) {
          const score = this.calculateScore(baseCommand, prefix);
          if (score > 0) {
            suggestions.push({
              type: 'command',
              value: baseCommand,
              display: baseCommand,
              description: 'From history',
              score: score + this.config.scoreWeights.history,
              metadata: { source: 'history' }
            });
            seen.add(baseCommand);
          }
        }
      }
    }
    
    // Add common commands
    for (const [cmd, subcommands] of Object.entries(this.commandPatterns)) {
      if (!seen.has(cmd)) {
        const score = this.calculateScore(cmd, prefix);
        if (score > 0) {
          suggestions.push({
            type: 'command',
            value: cmd,
            display: cmd,
            description: `${subcommands.length} subcommands available`,
            score,
            metadata: { source: 'patterns' }
          });
          seen.add(cmd);
        }
      }
    }
    
    return suggestions;
  }

  /**
   * Get subcommand suggestions
   * @param {string} command - Base command
   * @param {string} prefix - Subcommand prefix
   * @returns {Array} Subcommand suggestions
   */
  getSubcommandSuggestions(command, prefix) {
    const suggestions = [];
    const patterns = this.commandPatterns[command];
    
    if (patterns) {
      for (const subcommand of patterns) {
        const score = this.calculateScore(subcommand, prefix);
        if (score > 0) {
          suggestions.push({
            type: 'subcommand',
            value: `${command} ${subcommand}`,
            display: subcommand,
            description: `${command} subcommand`,
            score,
            metadata: { command, subcommand }
          });
        }
      }
    }
    
    return suggestions;
  }

  /**
   * Get parameter suggestions
   * @param {string} command - Command
   * @param {string} prefix - Parameter prefix
   * @returns {Array} Parameter suggestions
   */
  getParameterSuggestions(command, prefix) {
    const suggestions = [];
    
    if (!this.toolRegistry) return suggestions;
    
    // Get tool for command
    const tool = this.toolRegistry.getToolByCommand(command);
    if (!tool || !tool.parameters) return suggestions;
    
    // Add parameter suggestions
    for (const param of tool.parameters) {
      const score = this.calculateScore(param.name, prefix);
      if (score > 0) {
        suggestions.push({
          type: 'parameter',
          value: param.name,
          display: param.name,
          description: param.description || 'Parameter',
          score,
          metadata: { 
            required: param.required || false,
            command,
            type: param.type || 'string'
          }
        });
      }
    }
    
    // Sort required parameters first
    suggestions.sort((a, b) => {
      if (a.metadata.required && !b.metadata.required) return -1;
      if (!a.metadata.required && b.metadata.required) return 1;
      return 0;
    });
    
    return suggestions;
  }

  /**
   * Get variable suggestions
   * @param {string} prefix - Variable prefix
   * @returns {Array} Variable suggestions
   */
  getVariableSuggestions(prefix) {
    const suggestions = [];
    
    if (!this.variableStore) return suggestions;
    
    const variables = this.variableStore.getAllVariables();
    
    for (const variable of variables) {
      const score = this.calculateScore(variable.name, prefix);
      if (score > 0) {
        let displayValue = variable.value;
        
        // Truncate long values
        if (typeof displayValue === 'string' && displayValue.length > 50) {
          displayValue = displayValue.substring(0, 47) + '...';
        } else if (typeof displayValue === 'object') {
          displayValue = JSON.stringify(displayValue).substring(0, 47) + '...';
        }
        
        suggestions.push({
          type: 'variable',
          value: '$' + variable.name,
          display: variable.name,
          description: `${variable.type}: ${displayValue}`,
          score,
          metadata: {
            name: variable.name,
            type: variable.type,
            value: variable.value,
            scope: variable.scope || 'local'
          }
        });
      }
    }
    
    // Add environment variables
    if (typeof process !== 'undefined' && process.env) {
      for (const [name, value] of Object.entries(process.env)) {
        if (!variables.find(v => v.name === name)) {
          const score = this.calculateScore(name, prefix);
          if (score > 0) {
            suggestions.push({
              type: 'variable',
              value: '$' + name,
              display: name,
              description: `env: ${value?.substring(0, 50)}`,
              score,
              metadata: {
                name,
                type: 'string',
                value,
                scope: 'environment'
              }
            });
          }
        }
      }
    }
    
    return suggestions;
  }

  /**
   * Get path suggestions
   * @param {string} prefix - Path prefix
   * @returns {Array} Path suggestions
   */
  getPathSuggestions(prefix) {
    const suggestions = [];
    
    // Common project paths
    const commonPaths = [
      'src/', 'tests/', 'docs/', 'public/', 'dist/', 'build/',
      'package.json', 'README.md', '.gitignore', '.env',
      'src/components/', 'src/services/', 'src/utils/', 'src/actors/',
      'tests/unit/', 'tests/integration/', 'tests/e2e/'
    ];
    
    // If fileSystem is available, use it
    if (this.fileSystem && this.fileSystem.listFiles) {
      try {
        const files = this.fileSystem.listFiles(prefix);
        for (const file of files) {
          suggestions.push({
            type: 'path',
            value: file.path,
            display: file.name,
            description: file.isDirectory ? 'Directory' : `File (${file.size} bytes)`,
            score: 100, // Exact file system matches get high score
            metadata: {
              isDirectory: file.isDirectory,
              size: file.size
            }
          });
        }
      } catch (error) {
        // Fall back to common paths
      }
    }
    
    // Add common paths
    for (const path of commonPaths) {
      const score = this.calculateScore(path, prefix);
      if (score > 0) {
        suggestions.push({
          type: 'path',
          value: path,
          display: path,
          description: path.endsWith('/') ? 'Directory' : 'File',
          score,
          metadata: {
            isDirectory: path.endsWith('/'),
            common: true
          }
        });
      }
    }
    
    return suggestions;
  }

  /**
   * Get all types of suggestions
   * @param {string} prefix - Input prefix
   * @returns {Array} All suggestions
   */
  getAllSuggestions(prefix) {
    const suggestions = [
      ...this.getCommandSuggestions(prefix),
      ...this.getVariableSuggestions(prefix),
      ...this.getPathSuggestions(prefix)
    ];
    
    return suggestions;
  }

  /**
   * Calculate score for matching
   * @param {string} text - Text to match
   * @param {string} query - Query string
   * @returns {number} Score
   */
  calculateScore(text, query) {
    if (!query || query.length < this.config.minPrefixLength) {
      return this.config.scoreWeights.recent; // Show recent items for empty query
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

  /**
   * Fuzzy string matching
   * @param {string} text - Text to search
   * @param {string} query - Query pattern
   * @returns {boolean} Match found
   */
  fuzzyMatch(text, query) {
    let queryIndex = 0;
    let lastMatchIndex = -1;
    
    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        // Bonus for consecutive matches
        if (lastMatchIndex === i - 1) {
          queryIndex++;
          lastMatchIndex = i;
        } else {
          queryIndex++;
          lastMatchIndex = i;
        }
      }
    }
    
    return queryIndex === query.length;
  }

  /**
   * Rank suggestions by score and other factors
   * @param {Array} suggestions - Suggestions to rank
   * @param {string} query - Original query
   * @returns {Array} Ranked suggestions
   */
  rankSuggestions(suggestions, query) {
    // Add popularity scores
    for (const suggestion of suggestions) {
      const popularity = this.popularityScores.get(suggestion.value) || 0;
      suggestion.score += popularity * this.config.scoreWeights.popularity;
      
      // Boost recently used items
      const recentIndex = this.recentlyUsed.indexOf(suggestion.value);
      if (recentIndex !== -1) {
        suggestion.score += (this.maxRecentItems - recentIndex) * this.config.scoreWeights.recent;
      }
    }
    
    // Sort by score (descending)
    suggestions.sort((a, b) => {
      // Score comparison
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      
      // Alphabetical as tiebreaker
      return a.value.localeCompare(b.value);
    });
    
    return suggestions;
  }

  /**
   * Record usage of a suggestion
   * @param {string} value - Used value
   */
  recordUsage(value) {
    // Update popularity score
    const current = this.popularityScores.get(value) || 0;
    this.popularityScores.set(value, current + 1);
    
    // Update recently used
    const index = this.recentlyUsed.indexOf(value);
    if (index !== -1) {
      this.recentlyUsed.splice(index, 1);
    }
    this.recentlyUsed.unshift(value);
    
    // Limit recently used size
    if (this.recentlyUsed.length > this.maxRecentItems) {
      this.recentlyUsed = this.recentlyUsed.slice(0, this.maxRecentItems);
    }
    
    // Clear cache as rankings have changed
    this.clearCache();
  }

  /**
   * Clear suggestion cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Update configuration
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    this.clearCache();
  }

  /**
   * Export usage statistics
   * @returns {Object} Usage stats
   */
  exportStats() {
    return {
      popularityScores: Array.from(this.popularityScores.entries()),
      recentlyUsed: [...this.recentlyUsed],
      cacheSize: this.cache.size
    };
  }

  /**
   * Import usage statistics
   * @param {Object} stats - Usage stats
   */
  importStats(stats) {
    if (stats.popularityScores) {
      this.popularityScores = new Map(stats.popularityScores);
    }
    if (stats.recentlyUsed) {
      this.recentlyUsed = stats.recentlyUsed.slice(0, this.maxRecentItems);
    }
    this.clearCache();
  }
}