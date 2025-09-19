/**
 * TaskClassifier - Classify tasks as SIMPLE or COMPLEX
 * 
 * Based on decent planner's approach:
 * - SIMPLE: Can be done with a sequence of tool calls
 * - COMPLEX: Needs decomposition into subtasks
 */

import { ResponseValidator } from '@legion/output-schema';

export default class TaskClassifier {
  constructor(llmClient) {
    this.llmClient = llmClient;
    
    // Create response validator for classification responses
    const classificationSchema = {
      type: 'object',
      properties: {
        complexity: { 
          type: 'string', 
          enum: ['SIMPLE', 'COMPLEX'] 
        },
        reasoning: { type: 'string' },
        suggestedApproach: { type: 'string' },
        estimatedSteps: { type: 'number' }
      },
      required: ['complexity', 'reasoning'],
      format: 'json'
    };
    this.responseValidator = new ResponseValidator(classificationSchema, {
      preferredFormat: 'json',
      autoRepair: true
    });
  }

  /**
   * Classify a task as SIMPLE or COMPLEX
   * @param {string|Object} task - The task to classify
   * @returns {Promise<Object>} Classification result with complexity and reasoning
   */
  async classify(task, sessionLogger = null) {
    const taskDescription = typeof task === 'string' ? task : (task.description || JSON.stringify(task));
    
    const prompt = `Analyze this task and classify it as either SIMPLE or COMPLEX:

Task: "${taskDescription}"

Classification criteria:
- SIMPLE: Can be accomplished with a sequence of 1 or more direct tool calls
  Examples: "read a file", "parse JSON", "create a directory", "write code to a file"
  
- COMPLEX: Requires breaking down into subtasks or involves multiple coordinated operations
  Examples: "build a web application", "create a full API with authentication", "refactor a codebase"

Consider:
1. Does this task have a clear, direct solution using available tools?
2. Would this task benefit from being broken into smaller, more manageable pieces?
3. Is this a single operation or multiple related operations?`;

    try {
      // Get format instructions from ResponseValidator
      const formatInstructions = this.responseValidator.generateInstructions(null, {
        format: 'json',
        verbosity: 'concise'
      });
      
      // Combine prompt with format instructions
      const fullPrompt = prompt + '\n\n' + formatInstructions;
      
      // Call LLM with the complete prompt
      const response = await this.llmClient.complete(fullPrompt);
      
      // Log the interaction if logger is provided
      if (sessionLogger) {
        await sessionLogger.logInteraction(
          task,
          'task-classification',
          fullPrompt,
          response,
          { taskDescription: taskDescription.substring(0, 100) }
        );
      }
      
      // Use ResponseValidator to process the response
      const parseResult = this.responseValidator.process(response);
      if (!parseResult.success) {
        console.warn('Failed to parse classification response:', parseResult.errors);
        return {
          complexity: 'COMPLEX',
          reasoning: 'Could not parse LLM response',
          suggestedApproach: 'Break down into subtasks',
          estimatedSteps: 5
        };
      }
      
      const result = parseResult.data;
      
      // Validate result
      if (!result.complexity || !['SIMPLE', 'COMPLEX'].includes(result.complexity)) {
        result.complexity = 'COMPLEX'; // Default to COMPLEX if unclear
      }
      
      return result;
      
    } catch (error) {
      console.error('Task classification failed:', error.message);
      // Default to COMPLEX on error (safer to decompose)
      return {
        complexity: 'COMPLEX',
        reasoning: `Classification error: ${error.message}`,
        suggestedApproach: 'Break down into subtasks due to classification error',
        estimatedSteps: 5
      };
    }
  }

  /**
   * Batch classify multiple tasks
   * @param {Array} tasks - Array of tasks to classify
   * @returns {Promise<Array>} Array of classification results
   */
  async classifyBatch(tasks) {
    const results = [];
    
    for (const task of tasks) {
      const classification = await this.classify(task);
      results.push({
        task: task,
        ...classification
      });
    }
    
    return results;
  }

  /**
   * Generate a classification prompt for the LLM that includes context
   * @param {string} taskDescription - The task description
   * @param {Object} context - Additional context (artifacts, previous tasks, etc.)
   * @returns {string} The formatted prompt
   */
  static buildClassificationPrompt(taskDescription, context = {}) {
    let prompt = `Analyze this task and classify it as either SIMPLE or COMPLEX:\n\n`;
    prompt += `Task: "${taskDescription}"\n\n`;
    
    // Add context if available
    if (context.artifactRegistry && context.artifactRegistry.size() > 0) {
      prompt += `Available artifacts from previous steps:\n`;
      const artifacts = context.artifactRegistry.list();
      for (const artifact of artifacts) {
        prompt += `  - @${artifact.name} (${artifact.type}): ${artifact.description}\n`;
      }
      prompt += '\n';
    }
    
    prompt += `Classification criteria:
- SIMPLE: Can be accomplished with a sequence of 1 or more direct tool calls
  Examples: "read a file", "parse JSON", "create a directory", "write code to a file"
  Even tasks like "create a Node.js server" are SIMPLE if they just need code generation and file writing.
  
- COMPLEX: Requires breaking down into subtasks or involves multiple coordinated operations
  Examples: "build a complete web application", "create a full API with authentication and database", "refactor an entire codebase"

Consider:
1. Can this be done with straightforward tool calls (file operations, code generation, etc.)?
2. Does it require planning multiple distinct operations that should be handled separately?
3. Would breaking it down make it significantly easier to accomplish?`;
    
    return prompt;
  }
}