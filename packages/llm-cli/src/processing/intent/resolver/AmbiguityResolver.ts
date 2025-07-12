import { Intent, CommandSuggestion } from '../types';
import { LLMCLIConfig, CommandDefinition } from '../../../core/types';
import { SessionState } from '../../runtime/session/types';

export interface AmbiguityResolver {
  /**
   * Check if an intent is ambiguous and needs clarification
   */
  isAmbiguous(intent: Intent, config: LLMCLIConfig, session: SessionState): boolean;

  /**
   * Generate a clarification question for ambiguous intent
   */
  generateClarificationQuestion(intent: Intent, config: LLMCLIConfig, session: SessionState): string;

  /**
   * Suggest alternative commands for unknown or low-confidence intents
   */
  suggestAlternatives(intent: Intent, config: LLMCLIConfig, session: SessionState, limit?: number): CommandSuggestion[];

  /**
   * Resolve ambiguity based on user's clarification response
   */
  resolveAmbiguity(
    originalIntent: Intent,
    clarificationResponse: string,
    config: LLMCLIConfig,
    session: SessionState
  ): Promise<Intent>;

  /**
   * Get dynamic confidence threshold based on session context
   */
  getConfidenceThreshold(session: SessionState): number;

  /**
   * Extract parameters from natural language text
   */
  extractParametersFromText(text: string, command: CommandDefinition): Record<string, any>;
}