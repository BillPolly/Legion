/**
 * ComplexityClassifier - Determines if a task is SIMPLE or COMPLEX
 */


export class ComplexityClassifier {
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    
    this.llmClient = llmClient;
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

    // Use the inline prompt directly since template doesn't exist
    const prompt = this.generateClassificationPrompt(taskDescription, context);
    
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

IMPORTANT: Technical difficulty does NOT determine classification. A task can be technically challenging (like implementing complex algorithms or authentication) but still be SIMPLE if it only involves a few focused steps.

SIMPLE tasks:
- Can be accomplished in a few focused steps (typically 1-10 distinct actions)
- Even if technically difficult, they don't require many separate subtasks
- Have clear, well-defined scope that can be tackled directly
- May include sequences, conditionals, loops, retries within those steps
- Examples:
  - "Implement user authentication" (technically difficult but few steps)
  - "Create database connection with connection pooling"
  - "Write a sorting algorithm"
  - "Parse and validate JSON data"
  - "Configure webpack with custom plugins"
  - "Implement JWT token validation"
  - "Create encrypted password storage"
  - "Write recursive function"
  - "Set up OAuth integration"
  - "Implement caching layer"

COMPLEX tasks (needs decomposition):
- Require MANY separate subtasks (typically 10+ distinct operations)
- Too broad to tackle directly - needs breaking down
- Involve coordinating multiple separate components or subsystems
- Would result in an overwhelming number of individual steps if done directly
- Examples:
  - "Build entire web application from scratch"
  - "Create complete e-commerce platform"
  - "Set up full CI/CD pipeline with multiple environments"
  - "Build entire microservices architecture"

CRITICAL RULE: If this task is already a subtask from a previous decomposition, it should almost always be SIMPLE. Only mark subtasks as COMPLEX if they truly require 10+ separate operations.

Key question: Can this be done in a few focused steps (even if difficult), or does it need to be broken into many separate subtasks?

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