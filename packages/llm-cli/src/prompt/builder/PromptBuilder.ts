import { LLMCLIConfig, CommandDefinition } from '../../core/types';
import { SessionState } from '../../runtime/session/types';
import { ContextData } from '../../runtime/context/types';
import { HistoryEntry } from '../../runtime/session/types';

export interface PromptBuilder {
  /**
   * Build the system prompt with command information
   */
  buildSystemPrompt(config: LLMCLIConfig, session: SessionState): Promise<string>;

  /**
   * Build the user message with context
   */
  buildUserMessage(input: string, session: SessionState): Promise<string>;

  /**
   * Format a single command's information
   */
  formatCommandInfo(name: string, command: CommandDefinition, session: SessionState): string;

  /**
   * Format context data for inclusion in prompts
   */
  formatContext(contexts: ContextData[]): string;

  /**
   * Format history entries for inclusion in prompts
   */
  formatHistory(history: HistoryEntry[], limit?: number): string;
}