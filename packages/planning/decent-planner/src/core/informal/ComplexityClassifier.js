/**
 * ComplexityClassifier - Determines if a task is SIMPLE or COMPLEX
 */

import { PromptManager } from '@legion/prompt-manager';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ComplexityClassifier {
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    
    this.llmClient = llmClient;
    
    // Initialize PromptManager with templates from prompt-manager package
    const templatesDir = path.join(__dirname, '..', '..', '..', '..', 'prompt-manager', 'templates');
    this.promptManager = new PromptManager(templatesDir);
  }

  /**
   * Classify a task as SIMPLE or COMPLEX
   * @param {string} taskDescription - The task to classify
   * @param {Object} context - Optional context (domain, parent task, etc.)
   * @returns {Promise<Object>} Classification result with complexity and reasoning
   */
  async classify(taskDescription, context = {}) {
    if (!taskDescription || taskDescription.trim() === '') {
      throw new Error('Task description is required');
    }

    // Use PromptManager to generate prompt
    const prompt = await this.promptManager.render('complexity-classification', {
      taskDescription,
      context: context.domain || context.parentTask ? context : null,
      domain: context.domain,
      parentTask: context.parentTask
    });
    
    const response = await this.llmClient.complete(prompt);
    return this.parseClassificationResponse(response);
  }

  /**
   * Generate the classification prompt for the LLM
   * @param {string} taskDescription - The task to classify
   * @param {Object} context - Optional context
   * @returns {string} The formatted prompt
   */
  generateClassificationPrompt(taskDescription, context = {}) {
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
- Can be accomplished with a focused set of tools (typically 1-10)
- Have clear, well-defined scope
- Don't require architectural decisions
- May include sequences, conditionals, loops, retries
- Examples:
  - "Write content to a file"
  - "Parse JSON data"
  - "Create database connection"
  - "Install npm packages"
  - "Create a database table with validation"

COMPLEX tasks:
- Require coordination between multiple subsystems
- Too broad to plan directly with tools
- Need architectural decisions or design choices
- Involve multiple domains or areas of concern
- Examples:
  - "Build a web application"
  - "Create authentication system"
  - "Set up CI/CD pipeline"
  - "Build REST API with multiple endpoints"

Analyze the task and determine if it can be accomplished with a focused set of tools (SIMPLE) or if it needs to be broken down into smaller subtasks (COMPLEX).

Return your classification as JSON:
{
  "complexity": "SIMPLE" or "COMPLEX",
  "reasoning": "Brief explanation of why this classification was chosen"
}

Return ONLY the JSON object, no additional text.`;

    return prompt;
  }

  /**
   * Parse the classification response from the LLM
   * @param {string} response - The LLM response
   * @returns {Object} Parsed classification result
   */
  parseClassificationResponse(response) {
    try {
      // Try to extract JSON from the response
      let jsonStr = response.trim();
      
      // If response contains JSON within other text, extract it
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      const parsed = JSON.parse(jsonStr);
      
      // Validate the response structure
      if (!parsed.complexity) {
        throw new Error('Invalid classification response: missing complexity');
      }
      
      if (parsed.complexity !== 'SIMPLE' && parsed.complexity !== 'COMPLEX') {
        throw new Error(`Invalid complexity value: ${parsed.complexity}`);
      }
      
      return {
        complexity: parsed.complexity,
        reasoning: parsed.reasoning || 'No reasoning provided'
      };
      
    } catch (error) {
      if (error.message.includes('Invalid')) {
        throw error;
      }
      throw new Error(`Failed to parse classification response: ${error.message}`);
    }
  }
}