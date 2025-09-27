import { LLMClient } from '@legion/llm-client';
import { TemplatedPrompt } from '@legion/prompt-manager';
import { ApplicabilityJudgmentError } from './errors/index.js';

export class ApplicabilityJudge {
  constructor({ resourceManager }) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    this.resourceManager = resourceManager;
    this.llmClient = null;
    this.initialized = false;
    
    this.promptTemplate = `Assess if this SOP is suitable for the given goal.

Goal: {{goalGloss}}
Available Evidence: {{evidenceKeys}}
Context: {{context}}

SOP:
- Title: {{sopTitle}}
- Intent: {{sopIntent}}
- Prerequisites: {{prerequisites}}
- Required Inputs: {{requiredInputs}}
- Tools Used: {{toolsMentioned}}

Evaluate:
1. Does the SOP intent match the goal?
2. Are prerequisites satisfied? List any missing.
3. Are required inputs available? List missing.
4. Confidence this SOP will work (0-1 score)

{{outputPrompt}}`;

    this.responseSchema = {
      type: 'object',
      properties: {
        suitable: { type: 'boolean' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' },
        missingPrerequisites: { type: 'array', items: { type: 'string' } },
        missingParameters: { type: 'array', items: { type: 'string' } }
      },
      required: ['suitable', 'confidence', 'reasoning', 'missingPrerequisites', 'missingParameters']
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
  
  async judge(sop, goal, context) {
    if (!this.initialized) await this.initialize();
    
    try {
      const templatedPrompt = new TemplatedPrompt({
        prompt: this.promptTemplate,
        responseSchema: this.responseSchema,
        llmClient: this.llmClient,
        maxRetries: 3
      });
      
      const evidenceKeys = Object.keys(goal.evidence || {}).join(', ') || 'None';
      const contextStr = JSON.stringify(context || {}, null, 2);
      const prerequisites = sop.prerequisites?.join(', ') || 'None';
      const requiredInputs = Object.entries(sop.inputs || {})
        .filter(([k, v]) => v.required)
        .map(([k, v]) => `${k}: ${v.description}`)
        .join(', ') || 'None';
      const tools = sop.toolsMentioned?.join(', ') || 'None';
      
      const result = await templatedPrompt.execute({
        goalGloss: goal.gloss,
        evidenceKeys,
        context: contextStr,
        sopTitle: sop.title,
        sopIntent: sop.intent,
        prerequisites,
        requiredInputs,
        toolsMentioned: tools
      });
      
      if (!result.success) {
        throw new Error(result.errors?.join(', ') || 'Judgment failed');
      }
      
      return result.data;
      
    } catch (error) {
      throw new ApplicabilityJudgmentError(
        `Failed to judge SOP applicability: ${error.message}`,
        goal,
        error
      );
    }
  }
  
  createPrompt(sop, goal, context) {
    const evidenceKeys = Object.keys(goal.evidence || {}).join(', ') || 'None';
    const contextStr = JSON.stringify(context || {}, null, 2);
    const prerequisites = sop.prerequisites?.join('\n  - ') || 'None';
    const requiredInputs = Object.entries(sop.inputs || {})
      .filter(([k, v]) => v.required)
      .map(([k, v]) => `${k}: ${v.description}`)
      .join('\n  - ') || 'None';
    const tools = sop.toolsMentioned?.join(', ') || 'None';
    
    return `Assess if this SOP is suitable for the given goal.

Goal: ${goal.gloss}
Available Evidence: ${evidenceKeys}
Context: ${contextStr}

SOP:
- Title: ${sop.title}
- Intent: ${sop.intent}
- Prerequisites:
  - ${prerequisites}
- Required Inputs:
  - ${requiredInputs}
- Tools Used: ${tools}

Evaluate:
1. Does the SOP intent match the goal?
2. Are prerequisites satisfied? List any missing.
3. Are required inputs available? List missing.
4. Confidence this SOP will work (0-1 score)`;
  }
  
  parseResponse(response) {
    return response;
  }
}