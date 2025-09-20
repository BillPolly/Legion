/**
 * TaskClassifier - Classify tasks as SIMPLE or COMPLEX
 * 
 * Based on decent planner's approach:
 * - SIMPLE: Can be done with a sequence of tool calls
 * - COMPLEX: Needs decomposition into subtasks
 */

import { TemplatedPrompt, PromptRegistry } from '@legion/prompting-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class TaskClassifier {
  constructor(llmClient) {
    this.llmClient = llmClient;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Define classification schema
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
    
    // Create example data for better output instructions
    const examples = [{
      complexity: 'SIMPLE',
      reasoning: 'This task can be completed with a direct sequence of tool calls - file reading and JSON parsing are straightforward operations that don\'t require coordination.',
      suggestedApproach: 'Use file_read tool followed by json_parse tool',
      estimatedSteps: 2
    }];
    
    // Load prompt template from file
    const promptPath = path.join(__dirname, '..', 'prompts', 'task-classification.md');
    const promptTemplate = await fs.readFile(promptPath, 'utf-8');
    
    // Create prompt instance for task classification
    this.prompt = new TemplatedPrompt({
      prompt: promptTemplate,
      responseSchema: classificationSchema,
      examples,
      llmClient: this.llmClient,
      maxRetries: 3
    });
    
    this.initialized = true;
  }

  /**
   * Classify a task as SIMPLE or COMPLEX
   * @param {string|Object} task - The task to classify
   * @returns {Promise<Object>} Classification result with complexity and reasoning
   */
  async classify(task, sessionLogger = null, context = {}) {
    await this.initialize();
    
    const taskDescription = typeof task === 'string' ? task : (task.description || JSON.stringify(task));
    
    // Format artifacts section if available
    const artifactsSection = this._formatArtifactsSection(context.artifactRegistry);
    
    // Configure session logger for this prompt
    if (sessionLogger) {
      this.prompt.sessionLogger = sessionLogger;
    }
    
    // Execute the prompt with task variables
    const result = await this.prompt.execute({
      taskDescription,
      artifactsSection
    });
    
    if (result.success) {
      // Validate result complexity
      const data = result.data;
      if (!data.complexity || !['SIMPLE', 'COMPLEX'].includes(data.complexity)) {
        data.complexity = 'COMPLEX'; // Default to COMPLEX if unclear
      }
      
      // Log if session logger is available
      if (sessionLogger) {
        await sessionLogger.logInteraction(
          task,
          'task-classification',
          '', // Prompt is internal to TemplatedPrompt
          JSON.stringify(data),
          {
            taskDescription: taskDescription.substring(0, 100)
          }
        );
      }
      
      return data;
    } else {
      // Handle error case - default to COMPLEX (safer to decompose)
      console.warn('Task classification failed:', result.errors?.join(', '));
      return {
        complexity: 'COMPLEX',
        reasoning: `Classification error: ${result.errors?.[0] || 'Unknown error'}`,
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