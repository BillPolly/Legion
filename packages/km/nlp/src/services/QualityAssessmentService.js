/**
 * QualityAssessmentService - Assesses extraction quality using TemplatedPrompt
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class QualityAssessmentService {
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    this.llmClient = llmClient;
    this.promptTemplate = null;
  }

  async initialize() {
    const promptPath = join(__dirname, '../../prompts/quality-assessment.hbs');
    this.promptTemplate = await readFile(promptPath, 'utf-8');
  }

  async assessQuality(originalText, extractedTriples, paraphrase = null) {
    if (!this.promptTemplate) {
      await this.initialize();
    }

    const responseSchema = {
      type: 'object',
      properties: {
        scores: {
          type: 'object',
          properties: {
            completeness: { type: 'number', minimum: 0, maximum: 1 },
            accuracy: { type: 'number', minimum: 0, maximum: 1 },
            consistency: { type: 'number', minimum: 0, maximum: 1 },
            coverage: { type: 'number', minimum: 0, maximum: 1 }
          },
          required: ['completeness', 'accuracy', 'consistency', 'coverage']
        },
        overall: { type: 'number', minimum: 0, maximum: 1 },
        issues: {
          type: 'array',
          items: { type: 'string' }
        },
        suggestions: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['scores', 'overall']
    };

    const examples = [{
      scores: {
        completeness: 0.9,
        accuracy: 0.95,
        consistency: 0.85,
        coverage: 0.88
      },
      overall: 0.90,
      issues: [],
      suggestions: []
    }];

    const templatedPrompt = new TemplatedPrompt({
      prompt: this.promptTemplate,
      responseSchema,
      examples,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    const result = await templatedPrompt.execute({
      originalText,
      triples: JSON.stringify(extractedTriples, null, 2),
      paraphrase: paraphrase || 'N/A'
    });

    if (!result.success) {
      throw new Error(`Quality assessment failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return result.data;
  }
}
