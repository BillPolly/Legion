/**
 * SpecializationDecisionService - Decide whether to reuse or specialize inherited concepts
 *
 * Uses LLM to make intelligent decisions about when to:
 * - REUSE: Inherited concept is sufficient
 * - SPECIALIZE: Need domain-specific semantics via rdfs:subPropertyOf
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SpecializationDecisionService {
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }

    this.llmClient = llmClient;
    this.specializationDecisionTemplate = null;
  }

  /**
   * Decide whether to reuse or specialize an inherited concept
   *
   * @param {Object} candidate - Candidate for specialization
   * @param {string} candidate.sentence - The original sentence
   * @param {Object} candidate.implied - Implied property/relationship
   * @param {Object} candidate.existing - Existing concept in hierarchy
   * @param {string} candidate.type - 'property' or 'relationship'
   * @returns {Promise<Object>} - Decision result
   * @returns {string} return.action - 'REUSE' or 'SPECIALIZE'
   * @returns {string} return.reasoning - Explanation of decision
   */
  async decide(candidate) {
    // Load template if not already loaded
    if (!this.specializationDecisionTemplate) {
      const templatePath = join(__dirname, '../prompts/specialization-decision.hbs');
      this.specializationDecisionTemplate = await readFile(templatePath, 'utf-8');
    }

    // Define response schema
    const responseSchema = {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['REUSE', 'SPECIALIZE']
        },
        reasoning: {
          type: 'string'
        }
      },
      required: ['action', 'reasoning']
    };

    // Create TemplatedPrompt
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.specializationDecisionTemplate,
      responseSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    // Execute with variables
    const result = await templatedPrompt.execute({
      sentence: candidate.sentence,
      type: candidate.type,
      impliedName: candidate.implied.name,
      existingLabel: candidate.existing.label || candidate.existing.property || candidate.existing.relationship,
      definedIn: candidate.existing.definedIn?.domain || candidate.existing.definedIn,
      inheritanceDistance: candidate.existing.inheritanceDistance
    });

    if (!result.success) {
      throw new Error(`Specialization decision failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return result.data;
  }
}
