/**
 * TaskDecomposer - LLM-based task decomposition with complexity classification
 * 
 * Breaks down tasks into subtasks and classifies each as SIMPLE or COMPLEX
 * in a single LLM call for better context and coherent reasoning
 */

export class TaskDecomposer {
  constructor(llmClient, options = {}) {
    this.llmClient = llmClient;
    this.options = {
      maxDepth: 5,
      maxWidth: 10,
      temperature: 0.3,
      model: 'claude-3-5-sonnet-20241022',
      ...options
    };
  }

  /**
   * Decompose a task into subtasks with complexity classification
   * @param {string} task - Task description
   * @param {Object} context - Available context/artifacts
   * @returns {Promise<DecompositionResult>} Decomposed subtasks with complexity labels
   */
  async decompose(task, context = {}) {
    // Validate input
    if (!task || typeof task !== 'string' || task.trim().length === 0) {
      return {
        success: false,
        error: 'Task description must be a non-empty string',
        task: task || '',
        subtasks: []
      };
    }
    
    // Check if we've hit width limit
    if (context.currentWidth && context.currentWidth >= this.options.maxWidth) {
      return {
        success: false,
        error: `Maximum width of ${this.options.maxWidth} subtasks reached`,
        task: task,
        subtasks: []
      };
    }
    
    const prompt = this._buildDecompositionPrompt(task, context);
    
    try {
      if (!this.llmClient || !this.llmClient.generateResponse) {
        throw new Error('LLM client not properly initialized');
      }
      
      const response = await this.llmClient.generateResponse({
        messages: [
          {
            role: 'system',
            content: 'You are a task decomposition expert. Break down tasks into subtasks and classify their complexity. Return ONLY valid JSON with no additional text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: this.options.model,
        temperature: this.options.temperature,
        maxTokens: 2000
      });

      const result = this._parseResponse(response);
      
      // Validate the result structure
      if (!result.subtasks || !Array.isArray(result.subtasks)) {
        throw new Error('Invalid decomposition result: missing or invalid subtasks array');
      }
      
      // Validate each subtask
      const validatedSubtasks = result.subtasks.map((subtask, index) => {
        // Ensure required fields
        if (!subtask.id) {
          subtask.id = `subtask-${Date.now()}-${index}`;
        }
        if (!subtask.description) {
          throw new Error(`Subtask ${index} missing description`);
        }
        if (!subtask.complexity || !['SIMPLE', 'COMPLEX'].includes(subtask.complexity)) {
          subtask.complexity = 'COMPLEX'; // Default to complex if unclear
        }
        if (!subtask.suggestedInputs) {
          subtask.suggestedInputs = [];
        }
        if (!subtask.suggestedOutputs) {
          subtask.suggestedOutputs = [];
        }
        if (!subtask.reasoning) {
          subtask.reasoning = 'No reasoning provided';
        }
        
        return subtask;
      });
      
      // Limit number of subtasks
      if (validatedSubtasks.length > this.options.maxWidth) {
        console.warn(`Limiting subtasks from ${validatedSubtasks.length} to ${this.options.maxWidth}`);
        validatedSubtasks.splice(this.options.maxWidth);
      }
      
      return {
        success: true,
        task: task,
        subtasks: validatedSubtasks,
        metadata: {
          parentContext: context,
          decompositionLevel: context.level || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Decomposition failed: ${error.message}`,
        task: task,
        subtasks: [],
        metadata: {
          parentContext: context,
          decompositionLevel: context.level || 0
        }
      };
    }
  }

  /**
   * Build the decomposition prompt
   * @private
   */
  _buildDecompositionPrompt(task, context) {
    const parentArtifacts = context.parentOutputs || [];
    const domain = context.domain || 'general';
    const level = context.level || 0;

    return `Given this task: "${task}"
${parentArtifacts.length > 0 ? `Parent outputs available: [${parentArtifacts.join(', ')}]` : ''}
Domain: ${domain}
Current decomposition level: ${level}

Break this down into subtasks. For each subtask:
1. Provide a clear, actionable description
2. Suggest what inputs it might need (informal, natural language)
3. Suggest what outputs it should produce (informal, natural language)
4. Classify as SIMPLE or COMPLEX
5. Provide reasoning for the classification

SIMPLE tasks:
- Can be accomplished with a focused set of tools (typically 1-10)
- Have clear, plannable structure (may include sequences, choices, loops, retries)
- Well-defined inputs and outputs
- Self-contained logic that doesn't require coordination between multiple subsystems
- Examples: "Create a database table", "Process files in directory", "Parse JSON with error handling"

COMPLEX tasks:
- Require coordination between multiple distinct subsystems
- Involve multiple domains or areas of concern
- Have interdependencies between major components
- Need architectural decisions or design choices
- Examples: "Build web application", "Set up CI/CD pipeline", "Create user management system"

The input/output suggestions should:
- Help clarify what the task actually does
- Show dependencies between tasks
- Guide further decomposition for complex tasks
- Provide hints to the planner (but planner makes final decisions)

Return ONLY this JSON structure:
{
  "task": "Original task description",
  "subtasks": [
    {
      "id": "subtask-1",
      "description": "Clear action description",
      "complexity": "SIMPLE or COMPLEX",
      "reasoning": "Why this complexity level",
      "suggestedInputs": ["input1", "input2"],
      "suggestedOutputs": ["output1", "output2"]
    }
  ]
}`;
  }

  /**
   * Parse LLM response to extract JSON
   * @private
   */
  _parseResponse(response) {
    try {
      // Handle both direct JSON and wrapped responses
      const content = response.content || response;
      
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Try direct parse
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse decomposition response: ${error.message}`);
    }
  }
}