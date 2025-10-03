/**
 * RelationshipExtractionService - Handles relationship extraction using TemplatedPrompt
 *
 * Extracts relationships between entities based on ontological schemas
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class RelationshipExtractionService {
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
    const promptPath = join(__dirname, '../../prompts/relationship-extraction.hbs');
    this.promptTemplate = await readFile(promptPath, 'utf-8');
  }

  /**
   * Extract relationships between entities
   * @param {string} text - Input text to process
   * @param {Array} entities - Previously identified entities
   * @param {Array} relationshipTypes - Available relationship types
   * @returns {Promise<Object>} - Relationship extraction result
   */
  async extractRelationships(text, entities, relationshipTypes) {
    if (!this.promptTemplate) {
      await this.initialize();
    }

    if (!entities || entities.length === 0) {
      return { relationships: [], success: true };
    }

    // Define response schema
    const responseSchema = {
      type: 'object',
      properties: {
        relationships: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              subject: { type: 'string' },
              predicate: { type: 'string' },
              object: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              evidence: { type: 'string' }
            },
            required: ['id', 'subject', 'predicate', 'object', 'confidence']
          }
        },
        metadata: {
          type: 'object',
          properties: {
            totalFound: { type: 'number' }
          }
        }
      },
      required: ['relationships', 'metadata']
    };

    // Example responses
    const examples = [
      {
        relationships: [
          {
            id: 'rel_1',
            subject: 'e1',
            predicate: 'manufactured_by',
            object: 'e2',
            confidence: 0.92,
            evidence: 'Pump P101 is manufactured by Siemens'
          }
        ],
        metadata: {
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
      entities: JSON.stringify(entities.map(e => ({ id: e.id, text: e.text, type: e.type })), null, 2),
      relationshipTypes: JSON.stringify(relationshipTypes, null, 2)
    });

    if (!result.success) {
      throw new Error(`Relationship extraction failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return {
      relationships: result.data.relationships || [],
      metadata: result.data.metadata || {},
      success: true
    };
  }
}
