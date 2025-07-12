import { Intent, StructuredIntentResponse } from '../types';
import { LLMCLIConfig, CommandDefinition } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';

export interface JsonSchema {
  type: string;
  properties: Record<string, any>;
  required: string[];
}

export interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface StructuredIntentParser {
  /**
   * Generate JSON schema for structured output
   */
  generateJsonSchema(command?: CommandDefinition): JsonSchema;

  /**
   * Build prompt for structured output
   */
  buildStructuredPrompt(input: string, config: LLMCLIConfig, session: SessionState): string;

  /**
   * Parse structured response from LLM
   */
  parseStructuredResponse(response: any, rawQuery: string): Intent;

  /**
   * Validate JSON schema structure
   */
  validateSchema(schema: JsonSchema): SchemaValidationResult;

  /**
   * Get fallback prompt for non-structured providers
   */
  getFallbackPrompt(input: string, config: LLMCLIConfig, session: SessionState): string;

  /**
   * Extract JSON from text response
   */
  extractJsonFromText(text: string): any | null;
}