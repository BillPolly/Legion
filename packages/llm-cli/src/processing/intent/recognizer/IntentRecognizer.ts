import { IntentRecognizer as IIntentRecognizer, Intent, CommandSuggestion, ParameterValidationResult } from '../types';
import { LLMCLIConfig, CommandRegistry, CommandDefinition } from '../../../core/types';
import { SessionState } from '../../runtime/session/types';

export interface IntentRecognizer extends IIntentRecognizer {
  /**
   * Recognize intent from user input
   */
  recognizeIntent(input: string, config: LLMCLIConfig, session: SessionState): Promise<Intent>;

  /**
   * Get similarity score between two commands
   */
  getCommandSimilarity(command1: string, command2: string): number;

  /**
   * Suggest similar commands for a given input
   */
  suggestCommands(input: string, commands: CommandRegistry, limit?: number): CommandSuggestion[];

  /**
   * Validate parameters for a recognized intent
   */
  validateParameters(intent: Intent, command: CommandDefinition): ParameterValidationResult;

  /**
   * Build the prompt for intent recognition
   */
  buildIntentPrompt(input: string, config: LLMCLIConfig, session: SessionState): Promise<string>;
}