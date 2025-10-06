/**
 * UnderstandingPhase - Semantic understanding of financial questions
 *
 * Uses TemplatedPrompt with Handlebars template to understand:
 * - Ontology concepts mentioned
 * - Named entities
 * - Relations/operations
 * - Temporal/categorical scope
 * - Output format requirements
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { semanticUnderstandingSchema } from '../../schemas/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class UnderstandingPhase {
  constructor({ llmClient, ontologyIndexer, logger }) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }

    this.llmClient = llmClient;
    this.ontologyIndexer = ontologyIndexer;
    this.logger = logger || console;
    this.promptTemplate = null;
  }

  /**
   * Initialize by loading the prompt template
   */
  async initialize() {
    const promptPath = join(__dirname, '../../prompts/semantic-understanding.hbs');
    this.promptTemplate = await readFile(promptPath, 'utf-8');
    this.logger.info('understanding_phase_initialized');
  }

  /**
   * Execute the understanding phase
   *
   * @param {string} question - The question to understand
   * @param {Object} context - Context data (concepts, labels, years, categories, tableMetadata)
   * @returns {Promise<Object>} Semantic understanding result
   */
  async execute(question, context = {}) {
    if (!this.promptTemplate) {
      await this.initialize();
    }

    this.logger.debug('understanding_phase_start', { question });

    try {
      // Create TemplatedPrompt
      const templatedPrompt = new TemplatedPrompt({
        prompt: this.promptTemplate,
        responseSchema: semanticUnderstandingSchema,
        llmClient: this.llmClient,
        maxRetries: 3
      });

      // Prepare template variables
      const variables = {
        question,
        relevantConcepts: context.relevantConcepts || [],
        sampleLabels: context.sampleLabels || [],
        years: context.years ? context.years.join(', ') : null,
        categories: context.categories ? context.categories.join(', ') : null,
        tableMetadata: context.tableMetadata || null
      };

      // Execute the prompt
      const result = await templatedPrompt.execute(variables);

      if (!result.success) {
        throw new Error(`Understanding phase failed: ${result.errors?.join(', ') || 'Unknown error'}`);
      }

      this.logger.info('understanding_phase_complete', {
        concepts: result.data.concepts,
        entities: result.data.entities,
        outputFormat: result.data.outputFormat
      });

      return {
        success: true,
        understanding: result.data
      };

    } catch (error) {
      this.logger.error('understanding_phase_error', {
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Get relevant ontology concepts for a question
   * @private
   */
  async _getRelevantConcepts(question) {
    if (!this.ontologyIndexer) {
      return [];
    }

    try {
      // Use semantic search to find relevant concepts
      const results = await this.ontologyIndexer.search(question, { limit: 5 });
      return results.map(r => ({
        label: r.label,
        classURI: r.uri,
        similarity: (r.similarity * 100).toFixed(0)
      }));
    } catch (error) {
      this.logger.warn('concept_search_failed', { error: error.message });
      return [];
    }
  }
}
