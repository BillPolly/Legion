/**
 * EntityExtractionService - Handles entity extraction using TemplatedPrompt
 *
 * Proper separation of concerns:
 * - Uses TemplatedPrompt for LLM interactions
 * - Stores prompts as templates (not hardcoded)
 * - Returns structured results
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class EntityExtractionService {
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    this.llmClient = llmClient;
    this.promptTemplate = null;
  }

  /**
   * Initialize the service by loading the prompt template
   */
  async initialize() {
    const promptPath = join(__dirname, '../../prompts/entity-extraction.hbs');
    this.promptTemplate = await readFile(promptPath, 'utf-8');
  }

  /**
   * Extract entities from text with schema guidance
   * @param {string} text - Input text to process
   * @param {Object} schema - Entity schema for guidance
   * @param {Object} context - Processing context
   * @returns {Promise<Object>} - Entity extraction result
   */
  async extractEntities(text, schema, context = {}) {
    if (!this.promptTemplate) {
      await this.initialize();
    }

    // Define response schema
    const responseSchema = {
      type: 'object',
      properties: {
        entities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              text: { type: 'string' },
              type: { type: 'string' },
              properties: { type: 'object' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              span: {
                type: 'object',
                properties: {
                  start: { type: 'number' },
                  end: { type: 'number' }
                }
              }
            },
            required: ['id', 'text', 'type', 'confidence']
          }
        },
        metadata: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            totalFound: { type: 'number' }
          }
        }
      },
      required: ['entities', 'metadata']
    };

    // Example responses for guidance
    const examples = [
      {
        entities: [
          {
            id: 'e1',
            text: 'Pump P101',
            type: 'Pump',
            properties: {
              identifier: 'P101',
              name: 'Pump P101'
            },
            confidence: 0.95,
            span: { start: 0, end: 9 }
          }
        ],
        metadata: {
          domain: 'industrial',
          totalFound: 1
        }
      }
    ];

    // Create TemplatedPrompt
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.promptTemplate,
      responseSchema,
      examples,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    // Execute with variables
    const result = await templatedPrompt.execute({
      text,
      schema: JSON.stringify(schema, null, 2),
      domain: context.domain || 'general'
    });

    if (!result.success) {
      throw new Error(`Entity extraction failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return {
      entities: result.data.entities || [],
      metadata: result.data.metadata || {},
      success: true
    };
  }
}
