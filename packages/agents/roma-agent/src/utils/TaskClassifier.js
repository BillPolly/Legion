/**
 * TaskClassifier - Classify tasks as SIMPLE or COMPLEX
 * 
 * Based on decent planner's approach:
 * - SIMPLE: Can be done with a sequence of tool calls
 * - COMPLEX: Needs decomposition into subtasks
 */

import { ResponseValidator } from '@legion/output-schema';
import PromptBuilder from './PromptBuilder.js';

export default class TaskClassifier {
  constructor(llmClient) {
    this.llmClient = llmClient;
    this.promptBuilder = new PromptBuilder();
    this.isInitialized = false;
    
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
   * Initialize the prompt builder
   */
  async initialize() {
    if (!this.isInitialized) {
      await this.promptBuilder.initialize();
      this.isInitialized = true;
    }
  }

  /**
   * Classify a task as SIMPLE or COMPLEX
   * @param {string|Object} task - The task to classify
   * @returns {Promise<Object>} Classification result with complexity and reasoning
   */
  async classify(task, sessionLogger = null, context = {}) {
    // Ensure prompt builder is initialized
    await this.initialize();
    
    const taskDescription = typeof task === 'string' ? task : (task.description || JSON.stringify(task));
    
    // Format artifacts section if available
    const artifactsSection = this._formatArtifactsSection(context.artifactRegistry);
    
    // Create example data for better output instructions
    const exampleData = {
      complexity: 'SIMPLE',
      reasoning: 'This task can be completed with a direct sequence of tool calls - file reading and JSON parsing are straightforward operations that don\'t require coordination.',
      suggestedApproach: 'Use file_read tool followed by json_parse tool',
      estimatedSteps: 2
    };
    
    // Build prompt with schema-generated output instructions
    const fullPrompt = this.promptBuilder.buildPromptWithSchema(
      'task-classification',
      {
        taskDescription,
        artifactsSection
      },
      this.responseValidator,
      exampleData,
      {
        verbosity: 'detailed',
        errorPrevention: true
      }
    );

    try {
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

  /**
   * Format artifacts section for the classification prompt
   * @param {ArtifactRegistry} artifactRegistry - The artifact registry
   * @returns {string} Formatted artifacts section
   */
  _formatArtifactsSection(artifactRegistry) {
    if (!artifactRegistry || !artifactRegistry.size || artifactRegistry.size() === 0) {
      return '';
    }

    const lines = ['## Available Context'];
    lines.push('The following artifacts are available from previous steps:');
    lines.push('');
    
    for (const artifact of artifactRegistry.getAll()) {
      lines.push(`- **@${artifact.name}** (${artifact.type}): ${artifact.description}`);
    }
    
    return lines.join('\n');
  }
}