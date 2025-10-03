/**
 * DisambiguationService - Disambiguates entity references using TemplatedPrompt
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DisambiguationService {
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    this.llmClient = llmClient;
    this.promptTemplate = null;
  }

  async initialize() {
    const promptPath = join(__dirname, '../../prompts/entity-disambiguation.hbs');
    this.promptTemplate = await readFile(promptPath, 'utf-8');
  }

  async disambiguate(entity, context, candidates) {
    if (!this.promptTemplate) {
      await this.initialize();
    }

    const responseSchema = {
      type: 'object',
      properties: {
        selectedCandidate: { type: ['string', 'null'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' },
        alternativeCandidates: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['selectedCandidate', 'confidence', 'reasoning']
    };

    const examples = [{
      selectedCandidate: 'c1',
      confidence: 0.88,
      reasoning: 'Context indicates a city rather than a person',
      alternativeCandidates: ['c2']
    }];

    const templatedPrompt = new TemplatedPrompt({
      prompt: this.promptTemplate,
      responseSchema,
      examples,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    const result = await templatedPrompt.execute({
      entity,
      context: JSON.stringify(context, null, 2),
      candidates: JSON.stringify(candidates, null, 2)
    });

    if (!result.success) {
      throw new Error(`Disambiguation failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return result.data;
  }
}
