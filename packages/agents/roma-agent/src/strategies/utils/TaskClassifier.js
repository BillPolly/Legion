/**
 * TaskClassifier - Classify tasks as SIMPLE or COMPLEX
 * 
 * Based on decent planner's approach:
 * - SIMPLE: Can be done with a sequence of tool calls
 * - COMPLEX: Needs decomposition into subtasks
 * 
 * Uses PromptLoader for declarative prompt configuration
 */

import { PromptLoader } from './PromptLoader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class TaskClassifier {
  constructor(taskOrContext) {
    // Store context for PromptLoader
    this.context = taskOrContext;
    this.initialized = false;
    // Use a more flexible base path that PromptLoader can resolve
    this.promptLoader = new PromptLoader(path.resolve(__dirname, '../../'));
    this.templatedPrompt = null;
  }

  async initialize() {
    if (this.initialized) return;
    
    // Load prompt using PromptLoader - all configuration is declarative now
    this.templatedPrompt = await this.promptLoader.loadPrompt('strategies/recursive/prompts/task-classification', this.context);
    
    this.initialized = true;
  }

  /**
   * Classify a task as SIMPLE or COMPLEX
   * @param {string|Object} task - The task to classify
   * @param {Object} context - Additional context (optional, for backward compatibility)
   * @returns {Promise<Object>} Classification result with complexity and reasoning
   */
  async classify(task, context = {}) {
    await this.initialize();
    
    const taskDescription = typeof task === 'string' ? task : (task.description || JSON.stringify(task));
    
    // Format artifacts section if available
    const artifactsSection = this._formatArtifactsSection(context.artifactRegistry);
    
    // Use TemplatedPrompt directly - all configuration is declarative
    try {
      const result = await this.templatedPrompt.execute({
        taskDescription,
        artifactsSection
      });
      
      if (!result.success) {
        console.warn('Task classification failed:', result.errors);
        return {
          complexity: 'COMPLEX',
          reasoning: `Classification error: ${result.errors?.join(', ') || 'Unknown error'}`,
          suggestedApproach: 'Break down into subtasks due to classification error',
          estimatedSteps: 5
        };
      }
      
      const data = result.data;
      
      // Validate result complexity
      if (!data.complexity || !['SIMPLE', 'COMPLEX'].includes(data.complexity)) {
        console.warn('Task classification failed: Invalid complexity value:', data.complexity);
        return {
          complexity: 'COMPLEX',
          reasoning: `Classification error: Invalid complexity value received`,
          suggestedApproach: 'Break down into subtasks due to classification error',
          estimatedSteps: 5
        };
      }
      
      return data;
    } catch (error) {
      // Handle error case - default to COMPLEX (safer to decompose)
      console.warn('Task classification failed:', error.message);
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