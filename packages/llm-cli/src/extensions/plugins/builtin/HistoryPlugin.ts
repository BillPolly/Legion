import { Plugin, PluginContext } from '../types';
import { CommandResult, CommandArgs } from '../../../core/types';
import { HistoryEntry, SessionState } from '../../../runtime/session/types';

export class HistoryPlugin implements Plugin {
  metadata = {
    name: 'history-plugin',
    version: '1.0.0',
    description: 'Provides command history management and search',
    author: 'LLM CLI Framework',
    configSchema: {
      maxHistorySize: {
        type: 'number' as const,
        default: 100,
        description: 'Maximum number of history entries to keep'
      },
      enableSearch: {
        type: 'boolean' as const,
        default: true,
        description: 'Enable history search functionality'
      }
    }
  };

  private maxHistorySize: number = 100;
  private enableSearch: boolean = true;

  async initialize(context: PluginContext): Promise<void> {
    // Load configuration
    const config = context.pluginConfig || {};
    this.maxHistorySize = config.maxHistorySize ?? 100;
    this.enableSearch = config.enableSearch ?? true;
    

    // Register history command
    context.framework.registerCommand('history', {
      handler: async (params: CommandArgs, session: SessionState) => this.handleHistoryCommand(params, context),
      description: 'View and search command history',
      parameters: [
        {
          name: 'action',
          type: 'string',
          description: 'Action to perform (list, search, clear)',
          required: false,
          enum: ['list', 'search', 'clear']
        },
        {
          name: 'query',
          type: 'string',
          description: 'Search query (for search action)',
          required: false
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Number of entries to show',
          required: false
        }
      ]
    });

    // Register history recall command
    context.framework.registerCommand('!', {
      handler: async (params: CommandArgs, session: SessionState) => this.handleHistoryRecall(params, context),
      description: 'Execute a command from history',
      parameters: [{
        name: 'index',
        type: 'number',
        description: 'History index (negative for recent)',
        required: true
      }]
    });

    context.logger?.info('HistoryPlugin initialized');
  }

  async cleanup(context: PluginContext): Promise<void> {
    context.framework.unregisterCommand('history');
    context.framework.unregisterCommand('!');
    context.logger?.info('HistoryPlugin cleaned up');
  }

  async onCommand(command: string, result: CommandResult, context: PluginContext): Promise<void> {
    const session = context.framework.getSession();
    
    // Trim history if needed - account for the command that will be added after this hook
    if (session.history.length >= this.maxHistorySize) {
      // Remove oldest entries to make room
      const toRemove = session.history.length - this.maxHistorySize + 1;
      session.history.splice(0, toRemove);
    }
  }

  private async handleHistoryCommand(params: CommandArgs, context: PluginContext): Promise<CommandResult> {
    const session = context.framework.getSession();
    const action = params.action || 'list';

    switch (action) {
      case 'list':
        return this.listHistory(session.history, params.limit);
      
      case 'search':
        if (!this.enableSearch) {
          return {
            success: false,
            error: 'History search is disabled'
          };
        }
        return this.searchHistory(session.history, params.query, params.limit);
      
      case 'clear':
        session.history = [];
        return {
          success: true,
          output: 'Command history cleared'
        };
      
      default:
        return {
          success: false,
          error: `Unknown action: ${action}`,
          suggestions: ['Use: history list, history search <query>, or history clear']
        };
    }
  }

  private listHistory(history: HistoryEntry[], limit?: number): CommandResult {
    if (history.length === 0) {
      return {
        success: true,
        output: 'No command history available'
      };
    }

    const entries = limit ? history.slice(-limit) : history.slice(-10);
    let output = '**Command History:**\n\n';

    entries.forEach((entry, index) => {
      const globalIndex = history.length - entries.length + index;
      const timestamp = entry.timestamp.toLocaleTimeString();
      const status = entry.result?.success ? '✓' : '✗';
      
      output += `[${globalIndex}] ${timestamp} ${status} ${entry.input}\n`;
    });

    output += `\nShowing ${entries.length} of ${history.length} entries`;
    
    return {
      success: true,
      output
    };
  }

  private searchHistory(history: HistoryEntry[], query?: string, limit?: number): CommandResult {
    if (!query) {
      return {
        success: false,
        error: 'Search query is required',
        suggestions: ['Use: history search <query>']
      };
    }

    const matches = history.filter((entry, index) => {
      // Search in command input
      if (entry.input.toLowerCase().includes(query.toLowerCase())) {
        return true;
      }
      
      // Search in command name
      if (entry.intent?.command.toLowerCase().includes(query.toLowerCase())) {
        return true;
      }
      
      // Search in parameters
      const paramStr = entry.intent ? JSON.stringify(entry.intent.parameters).toLowerCase() : '';
      return paramStr.includes(query.toLowerCase());
    });

    if (matches.length === 0) {
      return {
        success: true,
        output: `No history entries found matching "${query}"`
      };
    }

    const entries = limit ? matches.slice(-limit) : matches.slice(-10);
    let output = `**History Search Results for "${query}":**\n\n`;

    entries.forEach((entry) => {
      const globalIndex = history.indexOf(entry);
      const timestamp = entry.timestamp.toLocaleTimeString();
      const status = entry.result?.success ? '✓' : '✗';
      
      output += `[${globalIndex}] ${timestamp} ${status} ${entry.input}\n`;
    });

    output += `\nFound ${matches.length} matches, showing ${entries.length}`;

    return {
      success: true,
      output
    };
  }

  private async handleHistoryRecall(params: CommandArgs, context: PluginContext): Promise<CommandResult> {
    const session = context.framework.getSession();
    const index = params.index;

    if (typeof index !== 'number') {
      return {
        success: false,
        error: 'Invalid history index',
        suggestions: ['Use !n where n is the history index (e.g., !5 or !-1 for last command)']
      };
    }

    let entry: HistoryEntry | undefined;

    if (index < 0) {
      // Negative index (from end)
      entry = session.history[session.history.length + index];
    } else {
      // Positive index
      entry = session.history[index];
    }

    if (!entry) {
      return {
        success: false,
        error: `No history entry at index ${index}`,
        suggestions: [`Valid range: 0 to ${session.history.length - 1} (or negative for recent)`]
      };
    }

    // Re-execute the command
    return {
      success: true,
      output: `Re-executing: ${entry.input}`,
      data: {
        command: entry.intent?.command,
        parameters: entry.intent?.parameters
      },
      stateUpdates: entry.intent ? new Map([['__reexecute', entry.intent]]) : undefined
    };
  }
}