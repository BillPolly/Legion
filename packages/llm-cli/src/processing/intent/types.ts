import { LLMCLIConfig, CommandRegistry, CommandDefinition } from '../../core/types';
import { SessionState } from '../../runtime/session/types';

export interface Intent {
  command: string;
  parameters: Record<string, any>;
  confidence: number;
  rawQuery: string;
  reasoning?: string;
  alternatives?: AlternativeIntent[];
}

// Alias for backward compatibility
export type RecognizedIntent = Intent;

export interface AlternativeIntent {
  command: string;
  parameters: Record<string, any>;
  confidence: number;
  reasoning?: string;
}

export interface CommandSuggestion {
  command: string;
  similarity: number;
  description: string;
}

export interface ParameterValidationResult {
  isValid: boolean;
  errors: string[];
  parameters: Record<string, any>;
}

export interface IntentRecognitionResult {
  intent: Intent;
  suggestions?: CommandSuggestion[];
  needsClarification?: boolean;
  clarificationPrompt?: string;
}

export interface IntentRecognizer {
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

export interface StructuredIntentResponse {
  command: string;
  parameters: Record<string, any>;
  confidence: number;
  reasoning?: string;
  alternatives?: {
    command: string;
    parameters: Record<string, any>;
    confidence: number;
  }[];
}