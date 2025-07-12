import { ContextProvider, ContextData } from '../types';
import { SessionState } from '../../session/types';
import { CommandResult } from '../../../core/types';

export class HistoryContextProvider implements ContextProvider {
  name = 'history';
  description = 'Provides context about command history';
  priority = 15;

  async getContext(session: SessionState): Promise<ContextData> {
    const history = session.history;
    
    if (history.length === 0) {
      return {
        summary: 'No command history',
        details: { historyLength: 0 }
      };
    }

    // Get recent commands
    const recentCommands = history
      .slice(-10)
      .filter(entry => entry.intent)
      .map(entry => entry.intent!.command);

    // Get last command info
    const lastEntry = history[history.length - 1];
    const lastCommand = lastEntry.intent?.command || 'unknown';
    
    // Calculate command frequency
    const commandFrequency: Record<string, number> = {};
    history.forEach(entry => {
      if (entry.intent) {
        commandFrequency[entry.intent.command] = 
          (commandFrequency[entry.intent.command] || 0) + 1;
      }
    });

    // Find most used commands
    const mostUsedCommands = Object.entries(commandFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([command]) => command);

    const summary = `${history.length} commands in history. Last: ${lastCommand}`;

    const contextData: ContextData = {
      summary,
      details: {
        historyLength: history.length,
        recentCommands,
        lastCommand,
        commandFrequency
      },
      relevantCommands: mostUsedCommands
    };

    // Add warnings for failed commands
    if (lastEntry.result && !lastEntry.result.success) {
      contextData.warnings = [`Last command failed: ${lastEntry.result.error || 'Unknown error'}`];
    }

    // Add suggestions from last command
    if (lastEntry.result?.suggestions) {
      contextData.suggestions = lastEntry.result.suggestions;
    }

    return contextData;
  }

  async isRelevant(session: SessionState): Promise<boolean> {
    // Only relevant if there's history
    return session.history.length > 0;
  }

  async updateContext(session: SessionState, result: CommandResult): Promise<void> {
    // History is automatically updated by SessionManager, nothing to do here
  }
}