/**
 * LLMTaskDecomposer - Infrastructure adapter for LLM-based task decomposition
 * Implements the TaskDecomposer port
 */

import { TaskDecomposer } from '../../application/ports/TaskDecomposer.js';

export class LLMTaskDecomposer extends TaskDecomposer {
  constructor(llmClient) {
    super();
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    this.llmClient = llmClient;
  }

  async decompose(taskDescription, context = {}) {
    if (!taskDescription || taskDescription.trim() === '') {
      throw new Error('Task description is required');
    }

    const prompt = this.generatePrompt(taskDescription, context);
    const response = await this.llmClient.complete(prompt);
    return this.parseResponse(response);
  }

  generatePrompt(taskDescription, context) {
    let prompt = `Decompose the following complex task into subtasks.

Task: ${taskDescription}`;

    if (context.parentTask) {
      prompt += `\nParent Task: ${context.parentTask}`;
    }

    if (context.domain) {
      prompt += `\nDomain: ${context.domain}`;
    }

    prompt += `

Guidelines:
1. Break down the task into 2-8 logical subtasks
2. Each subtask should be a clear, actionable step
3. Subtasks should be ordered logically (dependencies considered)
4. For each subtask, suggest informal inputs and outputs
5. Make subtasks as independent as possible

Return the decomposition as JSON:
{
  "subtasks": [
    {
      "description": "Clear description of the subtask",
      "inputs": ["informal input 1", "informal input 2"],
      "outputs": ["informal output 1", "informal output 2"],
      "reasoning": "Why this subtask is needed"
    }
  ]
}

Return ONLY the JSON object, no additional text.`;

    return prompt;
  }

  parseResponse(response) {
    try {
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) {
        throw new Error('Response must contain a subtasks array');
      }
      
      // Validate each subtask
      for (const subtask of parsed.subtasks) {
        if (!subtask.description || typeof subtask.description !== 'string') {
          throw new Error('Each subtask must have a description');
        }
      }
      
      return {
        subtasks: parsed.subtasks.map(st => ({
          description: st.description,
          inputs: st.inputs || [],
          outputs: st.outputs || [],
          reasoning: st.reasoning || ''
        }))
      };
    } catch (error) {
      throw new Error(`Failed to parse decomposition response: ${error.message}`);
    }
  }
}