/**
 * Phase 2: NP/VP AST Parser
 *
 * Parses canonical questions into minimal NP/VP tree structures using LLM.
 *
 * Uses LLM to deterministically parse questions into:
 * - NP (Noun Phrase): Det + Head + Mods*
 * - VP (Verb Phrase): Verb + Comps* + Mods*
 * - Supports: obj, pred, pp, ccomp, xcomp complements
 * - Supports: pp, adv, relcl, cmp, coord modifiers
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { createValidator } from '@legion/schema';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load NPVP_AST schema
const schemaPath = join(__dirname, '../../schemas/NPVP_AST.schema.json');
const npvpSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

/**
 * NP/VP AST Parser using LLM
 *
 * Converts canonical questions into minimal NP/VP tree structures.
 */
export class NPVPParser {
  /**
   * @param {Object} llmClient - LLM client for parsing
   */
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required for NPVPParser');
    }

    this.llmClient = llmClient;
    this.validator = createValidator(npvpSchema);
    this.templatedPrompt = null;
  }

  /**
   * Initialize the parser with LLM prompt
   */
  async initialize() {
    const promptPath = join(__dirname, '../../prompts/phase2-npvp-parser.txt');
    const promptTemplate = readFileSync(promptPath, 'utf-8');

    this.templatedPrompt = new TemplatedPrompt({
      prompt: promptTemplate,
      responseSchema: npvpSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });
  }

  /**
   * Parse canonical question into NP/VP AST
   *
   * @param {Object} canonicalQuestion - Output from Phase 1 (CanonicalQuestion)
   * @returns {Promise<Object>} NPVP_AST structure
   */
  async parse(canonicalQuestion) {
    if (!this.templatedPrompt) {
      throw new Error('Parser not initialized. Call initialize() first.');
    }

    if (!canonicalQuestion || !canonicalQuestion.text) {
      throw new Error('Valid CanonicalQuestion with text is required');
    }

    // Execute LLM parsing
    const result = await this.templatedPrompt.execute({
      question: canonicalQuestion.text,
      wh_role: canonicalQuestion.wh_role,
      entities: JSON.stringify(canonicalQuestion.entities || []),
      dates: JSON.stringify(canonicalQuestion.dates || []),
      lang: canonicalQuestion.lang || 'en'
    });

    // Check if LLM call succeeded
    if (!result.success) {
      throw new Error(`Failed to parse question after ${this.templatedPrompt.maxRetries} attempts: ${result.errors.join('; ')}`);
    }

    const ast = result.data;

    // Validate the output against schema
    const validation = this.validator.validate(ast);
    if (!validation.valid) {
      throw new Error(`Invalid NPVP_AST structure: ${JSON.stringify(validation.errors)}`);
    }

    return ast;
  }

  /**
   * Validate an NPVP_AST structure
   *
   * @param {Object} ast - NPVP_AST to validate
   * @returns {Object} Validation result {valid: boolean, errors: array}
   */
  validate(ast) {
    return this.validator.validate(ast);
  }

  /**
   * Get validation errors for an AST
   *
   * @param {Object} ast - NPVP_AST to check
   * @returns {Array} Array of error messages
   */
  getValidationErrors(ast) {
    const validation = this.validator.validate(ast);
    return validation.valid ? [] : validation.errors;
  }
}
