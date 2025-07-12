import { CommandResult, LLMCLIConfig } from '../../../core/types';
import { ExecutionContext } from '../../processing/execution/types';
import { GeneratedResponse } from '../types';

export interface ResponseGenerator {
  /**
   * Generate a complete response from command execution
   */
  generateResponse(context: ExecutionContext, result: CommandResult, config: LLMCLIConfig): Promise<GeneratedResponse>;

  /**
   * Format success message from command result
   */
  formatSuccessMessage(result: CommandResult, context: ExecutionContext): string;

  /**
   * Format error message from command result
   */
  formatErrorMessage(result: CommandResult, context: ExecutionContext): string;

  /**
   * Determine if natural language response should be generated
   */
  shouldGenerateNaturalLanguage(config: LLMCLIConfig, context: ExecutionContext, result: CommandResult): boolean;

  /**
   * Generate natural language response using LLM
   */
  generateNaturalLanguageResponse(context: ExecutionContext, result: CommandResult, config: LLMCLIConfig): Promise<string>;

  /**
   * Build prompt for natural language response generation
   */
  buildResponsePrompt(context: ExecutionContext, result: CommandResult, config: LLMCLIConfig): string;

  /**
   * Extract summary from command result data
   */
  extractDataSummary(data: any): string;
}