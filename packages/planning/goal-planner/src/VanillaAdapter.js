import { LLMClient } from '@legion/llm-client';
import { TemplatedPrompt } from '@legion/prompt-manager';
import { VanillaPlanningError } from './errors/index.js';

export class VanillaAdapter {
  constructor({ resourceManager }) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    this.resourceManager = resourceManager;
    this.llmClient = null;
    this.initialized = false;
    
    this.promptTemplate = `Break down this goal into 3-5 simple, actionable steps.

Goal: {{goalGloss}}
{{#if domain}}Domain: {{domain}}{{/if}}

Each step should be:
- Clear and actionable
- A single focused task
- Executable by a tool or simple action

{{outputPrompt}}`;

    this.responseSchema = {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
          maxItems: 5,
          description: 'Array of step descriptions'
        }
      },
      required: ['steps']
    };
  }
  
  async initialize() {
    if (this.initialized) return;
    
    const anthropicKey = this.resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }
    
    this.llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: 'claude-3-5-sonnet-20241022'
    });
    
    this.initialized = true;
  }
  
  async decomposeGoal(goal) {
    if (!this.initialized) await this.initialize();
    
    try {
      const templatedPrompt = new TemplatedPrompt({
        prompt: this.promptTemplate,
        responseSchema: this.responseSchema,
        llmClient: this.llmClient,
        maxRetries: 3
      });
      
      const result = await templatedPrompt.execute({
        goalGloss: goal.gloss,
        domain: goal.context?.domain
      });
      
      if (!result.success) {
        throw new Error(result.errors?.join(', ') || 'Decomposition failed');
      }
      
      const subgoals = result.data.steps.map(step => ({
        gloss: step,
        pred: { name: 'execute', args: {} },
        doneWhen: [{ kind: 'hasEvidence', key: this.generateEvidenceKey(step) }]
      }));
      
      return {
        subgoals,
        decomp: 'AND',
        confidence: 0.6
      };
      
    } catch (error) {
      throw new VanillaPlanningError(
        `Failed to decompose goal: ${error.message}`,
        goal,
        error
      );
    }
  }
  
  generateEvidenceKey(stepGloss) {
    const words = stepGloss
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0);
    
    if (words.length === 0) {
      return 'result';
    }
    
    const camelCase = words[0].toLowerCase() + 
      words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    
    return camelCase;
  }
}