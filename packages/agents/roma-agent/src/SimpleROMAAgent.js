/**
 * SimpleROMAAgent - A simple recursive task decomposition agent
 * 
 * Core concept: Break complex tasks into simpler ones until we can use tools,
 * with artifact management for storing and referencing results.
 */

import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

export default class SimpleROMAAgent {
  constructor() {
    this.resourceManager = null;
    this.llmClient = null;
    this.toolRegistry = null;
  }

  async initialize() {
    this.resourceManager = await ResourceManager.getInstance();
    this.llmClient = await this.resourceManager.get('llmClient');
    this.toolRegistry = await ToolRegistry.getInstance();
  }

  /**
   * Execute a task with recursive decomposition and artifact management
   */
  async execute(task, context = null) {
    // Create or use existing context
    const executionContext = context || {
      artifacts: new Map(),
      conversation: [],
      depth: 0
    };

    // Resolve any artifact references in the task
    const resolvedTask = this.resolveArtifacts(task, executionContext);

    // Ask LLM: Can this be done with tools or does it need decomposition?
    const decision = await this.getExecutionDecision(resolvedTask, executionContext);

    if (decision.useTools) {
      // Execute with tools
      return await this.executeWithTools(resolvedTask, decision.toolCalls, executionContext);
    } else if (decision.decompose) {
      // Decompose into subtasks
      return await this.executeSubtasks(resolvedTask, decision.subtasks, executionContext);
    } else {
      // Direct LLM response (for analysis, explanation, etc.)
      return {
        success: true,
        result: decision.response,
        artifacts: executionContext.artifacts
      };
    }
  }

  /**
   * Ask LLM whether to use tools or decompose the task
   */
  async getExecutionDecision(task, context) {
    const prompt = `You are a task execution agent. Analyze this task and decide how to execute it.

Task: ${task.description || JSON.stringify(task)}

Available artifacts from previous steps:
${Array.from(context.artifacts.entries()).map(([name, value]) => 
  `- @${name}: ${typeof value === 'object' ? JSON.stringify(value).substring(0, 100) + '...' : value}`
).join('\n') || 'None'}

You have three options:
1. USE TOOLS - If this task can be completed with available tools
2. DECOMPOSE - If this task is complex and needs to be broken into simpler subtasks  
3. RESPOND - If this is a question or analysis that just needs a direct response

Respond with a JSON object in one of these formats:

For tools:
{
  "useTools": true,
  "toolCalls": [
    {
      "tool": "tool_name",
      "parameters": { ... },
      "saveAs": "optional_artifact_name"
    }
  ]
}

For decomposition:
{
  "decompose": true,
  "subtasks": [
    {
      "description": "subtask description",
      "saveAs": "optional_artifact_name"
    }
  ]
}

For direct response:
{
  "response": "your analysis or answer"
}`;

    const response = await this.llmClient.complete({
      messages: [
        { role: 'system', content: 'You are a task decomposition agent. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.content);
  }

  /**
   * Execute task with tools
   */
  async executeWithTools(task, toolCalls, context) {
    const results = [];

    for (const call of toolCalls) {
      try {
        // Get the tool
        const tool = await this.toolRegistry.getTool(call.tool);
        if (!tool) {
          throw new Error(`Tool not found: ${call.tool}`);
        }

        // Resolve any artifact references in parameters
        const resolvedParams = this.resolveArtifacts(call.parameters, context);

        // Execute the tool
        const result = await tool.execute(resolvedParams);
        results.push(result);

        // Save as artifact if requested
        if (call.saveAs) {
          context.artifacts.set(call.saveAs, result.result || result);
          console.log(`Saved artifact @${call.saveAs}:`, result.result || result);
        }

      } catch (error) {
        results.push({ 
          success: false, 
          error: error.message,
          tool: call.tool 
        });
      }
    }

    return {
      success: results.every(r => r.success !== false),
      results,
      artifacts: context.artifacts
    };
  }

  /**
   * Execute subtasks recursively
   */
  async executeSubtasks(task, subtasks, context) {
    const results = [];
    
    // Create child context with incremented depth
    const childContext = {
      artifacts: context.artifacts, // Share artifacts with parent
      conversation: [...context.conversation],
      depth: context.depth + 1
    };

    // Check depth limit
    if (childContext.depth > 10) {
      throw new Error('Maximum recursion depth exceeded');
    }

    for (const subtask of subtasks) {
      console.log(`Executing subtask (depth ${childContext.depth}): ${subtask.description}`);
      
      const result = await this.execute(subtask, childContext);
      results.push(result);

      // Save result as artifact if requested
      if (subtask.saveAs && result.result) {
        context.artifacts.set(subtask.saveAs, result.result);
        console.log(`Saved artifact @${subtask.saveAs}:`, result.result);
      }
    }

    return {
      success: results.every(r => r.success),
      results,
      artifacts: context.artifacts
    };
  }

  /**
   * Resolve artifact references in task/parameters
   */
  resolveArtifacts(obj, context) {
    if (!obj || !context.artifacts.size) return obj;

    // Convert to string for processing
    let str = typeof obj === 'string' ? obj : JSON.stringify(obj);

    // Replace all @artifact_name references
    for (const [name, value] of context.artifacts.entries()) {
      const pattern = new RegExp(`@${name}\\b`, 'g');
      const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value);
      str = str.replace(pattern, replacement);
    }

    // Parse back if it was an object
    if (typeof obj !== 'string') {
      try {
        return JSON.parse(str);
      } catch {
        return str;
      }
    }

    return str;
  }
}