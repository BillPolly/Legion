/**
 * SemanticComparisonService - Compares semantic similarity using TemplatedPrompt
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SemanticComparisonService {
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    this.llmClient = llmClient;
    this.promptTemplate = null;
  }

  async initialize() {
    const promptPath = join(__dirname, '../../prompts/semantic-comparison.hbs');
    this.promptTemplate = await readFile(promptPath, 'utf-8');
  }

  async compareSemantics(text1, text2) {
    if (!this.promptTemplate) {
      await this.initialize();
    }

    const responseSchema = {
      type: 'object',
      properties: {
        similarity: { type: 'number', minimum: 0, maximum: 1 },
        sharedConcepts: {
          type: 'array',
          items: { type: 'string' }
        },
        differences: {
          type: 'array',
          items: { type: 'string' }
        },
        equivalent: { type: 'boolean' },
        explanation: { type: 'string' }
      },
      required: ['similarity', 'sharedConcepts', 'differences', 'equivalent']
    };

    const examples = [{
      similarity: 0.85,
      sharedConcepts: ['pump', 'manufacturer'],
      differences: ['operating pressure mentioned in one'],
      equivalent: false,
      explanation: 'Both texts discuss the same pump but with different details'
    }];

    const templatedPrompt = new TemplatedPrompt({
      prompt: this.promptTemplate,
      responseSchema,
      examples,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    const result = await templatedPrompt.execute({
      text1,
      text2
    });

    if (!result.success) {
      throw new Error(`Semantic comparison failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return result.data;
  }
}
