import { createDefaultZ3Prompt } from './default-prompt.js';
import { validateZ3Program } from '../schemas/z3-program-schema.js';

/**
 * Z3 Program Generator
 * Uses LLM to generate Z3 programs from natural language questions
 */
export class ProgramGenerator {
  /**
   * Create a program generator
   * @param {object} llmClient - LLM client with complete() method
   * @param {PromptTemplate} promptTemplate - Optional custom prompt template
   */
  constructor(llmClient, promptTemplate = null) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }

    this.llmClient = llmClient;
    this.promptTemplate = promptTemplate || createDefaultZ3Prompt();
  }

  /**
   * Generate Z3 program from natural language question
   * @param {string} question - Natural language question
   * @param {object} context - Additional context for generation
   * @returns {Promise<{success: boolean, program?: object, error?: string}>}
   */
  async generate(question, context = {}) {
    if (!question || typeof question !== 'string' || question.trim() === '') {
      throw new Error('Question must be a non-empty string');
    }

    try {
      // Render prompt with question and context
      const prompt = this.promptTemplate.renderWithExamples({
        question,
        ...context
      });

      // Get LLM response
      const llmResponse = await this.llmClient.complete(prompt);

      if (!llmResponse || llmResponse.trim() === '') {
        return {
          success: false,
          error: 'LLM returned empty response'
        };
      }

      // Extract JSON from response (handles markdown code fences)
      const jsonStr = this._extractJSON(llmResponse);

      // Parse JSON
      let program;
      try {
        program = JSON.parse(jsonStr);
      } catch (error) {
        return {
          success: false,
          error: `Failed to parse JSON: ${error.message}`,
          raw: llmResponse
        };
      }

      // Validate program structure
      const validation = validateZ3Program(program);

      if (!validation.success) {
        return {
          success: false,
          error: 'Generated program failed validation',
          validationError: validation.error,
          program
        };
      }

      return {
        success: true,
        program: validation.data,
        raw: llmResponse
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Regenerate program with error feedback
   * @param {string} question - Original question
   * @param {string} error - Error from previous attempt
   * @param {object} context - Additional context
   * @returns {Promise<{success: boolean, program?: object, error?: string}>}
   */
  async regenerate(question, error, context = {}) {
    const enhancedContext = {
      ...context,
      previousError: error,
      errorFeedback: `\n\nPrevious attempt failed with error: ${error}\nPlease fix the issue and generate a valid Z3 program.`
    };

    return await this.generate(question, enhancedContext);
  }

  /**
   * Generate program with automatic retry on failure
   * @param {string} question - Natural language question
   * @param {object} context - Additional context
   * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
   * @returns {Promise<{success: boolean, program?: object, error?: string, attempts?: number, errors?: array}>}
   */
  async generateWithRetry(question, context = {}, maxRetries = 3) {
    const errors = [];
    let attempts = 0;

    for (let i = 0; i < maxRetries; i++) {
      attempts++;

      let result;
      if (i === 0) {
        // First attempt
        result = await this.generate(question, context);
      } else {
        // Retry with error feedback
        const previousError = errors[errors.length - 1];
        result = await this.regenerate(question, previousError, context);
      }

      if (result.success) {
        return {
          ...result,
          attempts
        };
      }

      // Store error for next retry
      errors.push(result.error || 'Unknown error');
    }

    // All retries failed
    return {
      success: false,
      error: `Failed after ${attempts} attempts`,
      errors,
      attempts
    };
  }

  /**
   * Extract JSON from LLM response
   * Handles markdown code fences and extra text
   * @param {string} response - LLM response
   * @returns {string} Extracted JSON string
   * @private
   */
  _extractJSON(response) {
    let jsonStr = response.trim();

    // Remove markdown code fences
    // Match: ```json\n{...}\n``` or ```\n{...}\n```
    const codeFenceMatch = jsonStr.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (codeFenceMatch) {
      jsonStr = codeFenceMatch[1].trim();
    }

    // If still has code fence prefix/suffix, try basic removal
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
    }

    return jsonStr.trim();
  }
}
