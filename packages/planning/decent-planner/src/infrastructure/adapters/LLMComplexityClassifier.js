/**
 * LLMComplexityClassifier - Infrastructure adapter for LLM-based classification
 * Implements the ComplexityClassifier port
 */

import { ComplexityClassifier } from '../../application/ports/ComplexityClassifier.js';

export class LLMComplexityClassifier extends ComplexityClassifier {
  constructor(llmClient) {
    super();
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    this.llmClient = llmClient;
  }

  async classify(taskDescription, context = {}) {
    if (!taskDescription || taskDescription.trim() === '') {
      throw new Error('Task description is required');
    }

    const prompt = this.generatePrompt(taskDescription, context);
    const response = await this.llmClient.complete(prompt);
    return this.parseResponse(response);
  }

  generatePrompt(taskDescription, context) {
    let prompt = `Classify the following task as either SIMPLE or COMPLEX.

Task: ${taskDescription}`;

    if (context.domain) {
      prompt += `\nDomain: ${context.domain}`;
    }

    if (context.parentTask) {
      prompt += `\nParent Task: ${context.parentTask}`;
    }

    prompt += `

Classification Guidelines:

SIMPLE tasks:
- Can be accomplished in a few focused steps (typically 1-10 distinct actions)
- Have clear, well-defined scope that can be tackled directly
- May include sequences, conditionals, loops, retries within those steps

COMPLEX tasks:
- Require MANY separate subtasks (typically 10+ distinct operations)
- Too broad to tackle directly - needs breaking down
- Involve coordinating multiple separate components or subsystems

Return your classification as JSON:
{
  "complexity": "SIMPLE" or "COMPLEX",
  "reasoning": "Brief explanation of why this classification was chosen"
}

Return ONLY the JSON object, no additional text.`;

    return prompt;
  }

  parseResponse(response) {
    try {
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      if (!parsed.complexity || !['SIMPLE', 'COMPLEX'].includes(parsed.complexity)) {
        throw new Error('Invalid complexity value in response');
      }
      
      return {
        complexity: parsed.complexity,
        reasoning: parsed.reasoning || ''
      };
    } catch (error) {
      throw new Error(`Failed to parse classification response: ${error.message}`);
    }
  }
}