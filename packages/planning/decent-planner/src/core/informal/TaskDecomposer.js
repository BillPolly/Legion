/**
 * TaskDecomposer - Recursively decomposes complex tasks into simple ones
 */

import { TaskNode } from './types/TaskNode.js';
import { ComplexityClassifier } from './ComplexityClassifier.js';

export class TaskDecomposer {
  constructor(llmClient, complexityClassifier) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    
    if (!complexityClassifier) {
      throw new Error('Complexity classifier is required');
    }
    
    this.llmClient = llmClient;
    this.classifier = complexityClassifier;
  }

  /**
   * Decompose a task into subtasks (single level)
   * @param {string} taskDescription - The task to decompose
   * @param {Object} context - Optional context
   * @returns {Promise<Object>} Decomposition result with classified subtasks
   */
  async decompose(taskDescription, context = {}) {
    if (!taskDescription || taskDescription.trim() === '') {
      throw new Error('Task description is required');
    }

    // Use inline prompt directly since template doesn't exist
    const prompt = this.generateDecompositionPrompt(taskDescription, context);
    
    const response = await this.llmClient.complete(prompt);
    const decomposition = this.parseDecompositionResponse(response);
    
    // Classify each subtask
    for (const subtask of decomposition.subtasks) {
      const classification = await this.classifier.classify(
        subtask.description,
        { 
          parentTask: taskDescription,
          domain: context.domain 
        }
      );
      
      subtask.complexity = classification.complexity;
      subtask.reasoning = subtask.reasoning || classification.reasoning;
    }
    
    return decomposition;
  }

  /**
   * Recursively decompose until all tasks are SIMPLE
   * @param {string} taskDescription - The task to decompose
   * @param {Object} context - Optional context
   * @param {Object} options - Options including maxDepth
   * @returns {Promise<TaskNode>} Complete hierarchy as TaskNode tree
   */
  async decomposeRecursively(taskDescription, context = {}, options = {}) {
    const { maxDepth = 5, progressCallback = null, cancellationChecker = null } = options;
    
    return this._decomposeNode(taskDescription, context, 0, maxDepth, progressCallback, cancellationChecker);
  }

  /**
   * Private: Recursively decompose a single node
   */
  async _decomposeNode(taskDescription, context, currentDepth, maxDepth, progressCallback = null, cancellationChecker = null) {
    // Check for cancellation at start of each decomposition
    if (cancellationChecker) cancellationChecker();
    
    // At max depth, force everything to be SIMPLE
    if (currentDepth >= maxDepth) {
      return new TaskNode({
        description: taskDescription,
        complexity: 'SIMPLE',
        reasoning: 'Maximum decomposition depth reached',
        suggestedInputs: context.parentOutputs || [],
        suggestedOutputs: []
      });
    }
    
    // First, classify this task
    if (progressCallback) {
      progressCallback(`🔍 Analyzing: "${taskDescription}"`);
    }
    const classification = await this.classifier.classify(taskDescription, context);
    
    // Check for cancellation after classification
    if (cancellationChecker) cancellationChecker();
    
    // If SIMPLE, return as leaf node
    if (classification.complexity === 'SIMPLE') {
      if (progressCallback) {
        progressCallback(`✅ Simple task identified: "${taskDescription}"`);
      }
      return new TaskNode({
        description: taskDescription,
        complexity: 'SIMPLE',
        reasoning: classification.reasoning,
        suggestedInputs: context.parentOutputs || [],
        suggestedOutputs: []
      });
    }
    
    // If COMPLEX, decompose and recurse
    if (progressCallback) {
      progressCallback(`🌳 Breaking down complex task: "${taskDescription}"`);
    }
    
    // Check for cancellation before decomposing
    if (cancellationChecker) cancellationChecker();
    
    const decomposition = await this.decompose(taskDescription, context);
    
    // Check for cancellation after decomposition
    if (cancellationChecker) cancellationChecker();
    
    if (progressCallback) {
      progressCallback(`📝 Found ${decomposition.subtasks.length} subtasks for: "${taskDescription}"`);
    }
    
    // Create the parent node
    const parentNode = new TaskNode({
      description: taskDescription,
      complexity: 'COMPLEX',
      reasoning: classification.reasoning,
      suggestedInputs: context.parentOutputs || [],
      suggestedOutputs: []
    });
    
    // Process each subtask
    for (let i = 0; i < decomposition.subtasks.length; i++) {
      const subtask = decomposition.subtasks[i];
      if (progressCallback) {
        progressCallback(`🔄 Processing subtask ${i + 1}/${decomposition.subtasks.length}: "${subtask.description}"`);
      }
      const childContext = {
        ...context,
        parentTask: taskDescription,
        parentOutputs: subtask.suggestedInputs || []
      };
      
      let childNode;
      
      // At max depth - 1, force children to be SIMPLE
      if (currentDepth >= maxDepth - 1) {
        childNode = new TaskNode({
          id: subtask.id,
          description: subtask.description,
          complexity: 'SIMPLE',
          reasoning: 'Maximum decomposition depth reached',
          suggestedInputs: subtask.suggestedInputs || [],
          suggestedOutputs: subtask.suggestedOutputs || []
        });
      } else if (subtask.complexity === 'SIMPLE') {
        childNode = new TaskNode({
          id: subtask.id,
          description: subtask.description,
          complexity: 'SIMPLE',
          reasoning: subtask.reasoning,
          suggestedInputs: subtask.suggestedInputs || [],
          suggestedOutputs: subtask.suggestedOutputs || []
        });
      } else {
        // Recurse for COMPLEX subtasks
        childNode = await this._decomposeNode(
          subtask.description,
          childContext,
          currentDepth + 1,
          maxDepth,
          progressCallback,
          cancellationChecker
        );
        // Preserve the ID and I/O hints from decomposition
        if (subtask.id) childNode.id = subtask.id;
        childNode.suggestedInputs = subtask.suggestedInputs || childNode.suggestedInputs;
        childNode.suggestedOutputs = subtask.suggestedOutputs || childNode.suggestedOutputs;
      }
      
      parentNode.addSubtask(childNode);
      
      // Aggregate outputs from children for parent
      if (childNode.suggestedOutputs) {
        parentNode.suggestedOutputs.push(...childNode.suggestedOutputs);
      }
    }
    
    return parentNode;
  }

  /**
   * Generate decomposition prompt for the LLM
   */
  generateDecompositionPrompt(taskDescription, context = {}) {
    let prompt = `Decompose the following task into subtasks.

Task to decompose: ${taskDescription}`;

    if (context.domain) {
      prompt += `\nDomain: ${context.domain}`;
    }

    if (context.parentOutputs && context.parentOutputs.length > 0) {
      prompt += `\nAvailable from parent: ${context.parentOutputs.join(', ')}`;
    }

    prompt += `

Break this task down into 2-5 subtasks that together accomplish the goal.
For each subtask, provide:
1. A clear description
2. Suggested inputs (what data/artifacts it needs)
3. Suggested outputs (what it produces)
4. Brief reasoning for why this subtask is needed

The inputs and outputs should be concrete file types and artifacts like:
- Files: "HTML file", "CSS stylesheet", "JavaScript module", "JSON config", "README file"
- Data: "User credentials", "Form data", "API response", "Database schema"
- Components: "React component", "Vue template", "Express route", "Database table"
- Assets: "Logo image", "Icon set", "Font files", "Color palette"

Examples of good inputs/outputs:
- Input: "User requirements document", Output: "HTML wireframe"
- Input: "Design mockup", Output: "CSS stylesheet" 
- Input: "API specification", Output: "JavaScript fetch functions"

Return the decomposition as JSON:
{
  "task": "Original task description",
  "subtasks": [
    {
      "id": "unique-id",
      "description": "Clear subtask description",
      "suggestedInputs": ["input1", "input2"],
      "suggestedOutputs": ["output1", "output2"],
      "reasoning": "Why this subtask is needed"
    }
  ]
}

Return ONLY the JSON object, no additional text.`;

    return prompt;
  }

  /**
   * Parse decomposition response from LLM
   */
  parseDecompositionResponse(response) {
    try {
      // Extract JSON from response
      let jsonStr = response.trim();
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      const parsed = JSON.parse(jsonStr);
      
      // Validate structure
      if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) {
        throw new Error('Invalid decomposition response: missing subtasks');
      }
      
      // Ensure each subtask has required fields
      parsed.subtasks = parsed.subtasks.map((subtask, index) => ({
        id: subtask.id || `subtask-${Date.now()}-${index}`,
        description: subtask.description || 'Unnamed subtask',
        suggestedInputs: subtask.suggestedInputs || [],
        suggestedOutputs: subtask.suggestedOutputs || [],
        reasoning: subtask.reasoning || 'No reasoning provided'
      }));
      
      return {
        task: parsed.task || 'Unknown task',
        subtasks: parsed.subtasks
      };
      
    } catch (error) {
      if (error.message.includes('Invalid decomposition response')) {
        throw error;
      }
      throw new Error(`Failed to parse decomposition response: ${error.message}`);
    }
  }
}