/**
 * SemanticEquivalenceEvaluator - LLM-based semantic equivalence checker
 *
 * Compares original text with DRS paraphrase to determine semantic equivalence.
 * Uses LLM to judge if two texts convey the same meaning.
 */

import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TemplatedPrompt } from '@legion/prompting-manager';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SemanticEquivalenceEvaluator {
  constructor(llmClient) {
    this.llmClient = llmClient;

    // Load schema
    const schemaPath = join(__dirname, '../../schemas/SemanticEvaluationSchema.json');
    this.evaluationSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

    // Template will be loaded on first use
    this.evaluationPromptTemplate = null;
  }

  /**
   * Evaluate semantic equivalence between original text and paraphrase
   * @param {string} originalText - The original text
   * @param {string} paraphrase - The DRS-generated paraphrase
   * @returns {Promise<{equivalent: boolean, confidence: number, explanation: string}>}
   */
  async evaluate(originalText, paraphrase) {
    // Prepare prompt data
    const promptData = {
      originalText,
      paraphrase,
      schema: this.evaluationSchema
    };

    // Call LLM with prompt
    const evaluationData = await this._callLLM(promptData);

    return {
      equivalent: evaluationData.equivalent,
      confidence: evaluationData.confidence,
      explanation: evaluationData.explanation
    };
  }

  /**
   * Call LLM with prompt data
   * @private
   */
  async _callLLM(promptData) {
    // Load template if not already loaded
    if (!this.evaluationPromptTemplate) {
      const templatePath = join(__dirname, '../../prompts/semantic-evaluation.hbs');
      this.evaluationPromptTemplate = await readFile(templatePath, 'utf-8');
    }

    // Create TemplatedPrompt
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.evaluationPromptTemplate,
      responseSchema: this.evaluationSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    // Execute with variables
    const result = await templatedPrompt.execute(promptData);

    if (!result.success) {
      throw new Error(`Semantic evaluation failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return result.data;
  }
}
