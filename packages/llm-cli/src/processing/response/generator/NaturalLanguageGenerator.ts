import { CommandResult, LLMCLIConfig } from '../../../core/types';
import { ExecutionContext } from '../../processing/execution/types';

export type ResponseTone = 'professional' | 'casual' | 'friendly' | 'empathetic';

export interface NaturalLanguageGenerator {
  /**
   * Generate a natural language response for command result
   */
  generateResponse(context: ExecutionContext, result: CommandResult, config: LLMCLIConfig): Promise<string>;

  /**
   * Build prompt for natural language generation
   */
  buildPrompt(context: ExecutionContext, result: CommandResult, config: LLMCLIConfig): string;

  /**
   * Build context information for prompt
   */
  buildContextInformation(context: ExecutionContext, config: LLMCLIConfig): string;

  /**
   * Generate response variation for diversity
   */
  generateResponseVariation(context: ExecutionContext, result: CommandResult, config: LLMCLIConfig, variation: number): Promise<string>;

  /**
   * Personalize response based on user context
   */
  personalizeResponse(response: string, context: ExecutionContext): string;

  /**
   * Get appropriate response tone
   */
  getResponseTone(context: ExecutionContext, result?: CommandResult): ResponseTone;

  /**
   * Validate generated response quality
   */
  validateResponse(response: string, context: ExecutionContext): boolean;
}