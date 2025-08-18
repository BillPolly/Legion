/**
 * ToolFeasibilityChecker - Discovers and validates tools for SIMPLE tasks
 */

import { EventEmitter } from 'events';

export class ToolFeasibilityChecker extends EventEmitter {
  constructor(toolRegistry, llmClient, options = {}) {
    super(); // Call EventEmitter constructor
    
    if (!toolRegistry) {
      throw new Error('ToolRegistry is required');
    }
    
    if (!llmClient) {
      throw new Error('LLM client is required for tool description generation');
    }
    
    this.toolRegistry = toolRegistry;
    this.llmClient = llmClient;
    this.confidenceThreshold = options.confidenceThreshold || 0.3; // Lower threshold for semantic search
    this.maxTools = options.maxTools || 20; // Allow more tools for curated sets
    this.maxDescriptions = options.maxDescriptions || 8; // Max tool descriptions (both general and specific)
    this.minDescriptions = options.minDescriptions || 5; // Min tool descriptions to generate
  }

  /**
   * Generate tool descriptions for a task using LLM
   * @param {string} taskDescription - The task to generate descriptions for
   * @returns {Promise<Array<string>>} Array of tool descriptions
   */
  async generateToolDescriptions(taskDescription) {
    const prompt = `
Given this task: "${taskDescription}"

Generate tool descriptions at TWO levels:

1. GENERAL/HIGH-LEVEL descriptions (2-3):
   - Code generation tools: "write JavaScript code", "generate Node.js program", "create TypeScript file"
   - File creation tools: "write file to disk", "create new file"
   - Think of tools that would GENERATE CODE or CREATE FILES

2. SPECIFIC/DETAILED descriptions (3-5):
   - Concrete action tools (e.g., "hash password", "read file", "parse JSON")
   - Step-by-step operation tools
   - Think of tools that would PERFORM SPECIFIC OPERATIONS

Total: ${this.minDescriptions}-${this.maxDescriptions + 2} descriptions mixing both levels.

Each description should:
- Be 1-2 sentences describing a tool capability
- Focus on the ACTION the tool performs
- Be searchable (avoid vague terms like "process" or "handle")

Format as a JSON array of strings:
["description1", "description2", ...]

Example for task "Create REST API endpoint for user authentication":
[
  "Write JavaScript code to implement the solution",
  "Generate Node.js program file with the required logic",
  "Create new file on disk with the endpoint code",
  "Hash passwords using bcrypt algorithm",
  "Generate and validate JWT tokens",
  "Query database for user credentials",
  "Validate request payload structure"
]

IMPORTANT: Include descriptions for BOTH code/file generation AND specific operations.`;

    try {
      const response = await this.llmClient.complete(prompt);
      
      // Parse JSON response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('LLM response does not contain valid JSON array');
      }
      
      const descriptions = JSON.parse(jsonMatch[0]);
      
      // Validate and filter descriptions
      if (!Array.isArray(descriptions)) {
        throw new Error('LLM response is not an array');
      }
      
      const validDescriptions = descriptions
        .filter(desc => typeof desc === 'string' && desc.trim().length > 10)
        .slice(0, this.maxDescriptions);
      
      if (validDescriptions.length < this.minDescriptions) {
        console.warn(`Only generated ${validDescriptions.length} descriptions, expected at least ${this.minDescriptions}`);
      }
      
      // Emit event with generated descriptions
      this.emit('toolDescriptionsGenerated', { descriptions: validDescriptions });
      
      return validDescriptions;
      
    } catch (error) {
      console.warn(`Failed to generate tool descriptions: ${error.message}`);
      // Fallback: use the task description itself
      return [taskDescription];
    }
  }

  /**
   * Discover tools from tool descriptions using semantic search
   * @param {Array<string>} descriptions - Tool descriptions to search for
   * @returns {Promise<Array>} Unified array of tools with confidence scores
   */
  async discoverToolsFromDescriptions(descriptions) {
    const allToolsFound = new Map(); // name -> best tool data
    
    for (const description of descriptions) {
      try {
        // Emit search started event
        this.emit('searchStarted', description);
        
        // Use semantic search for better matching
        const searchResult = await this.toolRegistry.semanticToolSearch(description, {
          limit: 5, // Get top 5 per description
          minConfidence: this.confidenceThreshold,
          includeExecutable: true
        });
        
        // Emit search completed event
        const maxConfidence = searchResult.tools.length > 0 ? 
          Math.max(...searchResult.tools.map(t => t.confidence || 0)) : 0;
        this.emit('searchCompleted', {
          query: description,
          tools: searchResult.tools,
          maxConfidence
        });
        
        // Add found tools to the collection
        for (const toolResult of searchResult.tools) {
          const toolName = toolResult.name;
          
          // Only include executable tools
          if (!toolResult.available || !toolResult.executable) {
            continue;
          }
          
          // Keep the best confidence score if we see this tool multiple times
          if (!allToolsFound.has(toolName) || 
              toolResult.confidence > allToolsFound.get(toolName).confidence) {
            allToolsFound.set(toolName, {
              name: toolResult.name,
              description: toolResult.description,
              confidence: toolResult.confidence,
              executable: toolResult.executable,
              category: toolResult.category,
              tags: toolResult.tags,
              searchedFor: description
            });
          }
        }
        
      } catch (error) {
        console.warn(`Failed to search for tools matching "${description}": ${error.message}`);
        // Continue with other descriptions
      }
    }
    
    // Convert to array and sort by confidence
    const unifiedTools = Array.from(allToolsFound.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.maxTools);
    
    // Emit unification completed event
    this.emit('unificationCompleted', { unifiedTools });
    
    return unifiedTools;
  }

  /**
   * Check if a task is feasible by discovering appropriate tools using tool description bridge
   * @param {TaskNode} task - The task to check
   * @returns {Promise<Object>} Feasibility result with tools
   */
  async checkTaskFeasibility(task) {
    if (!task) {
      throw new Error('Task is required');
    }
    
    if (!task.description) {
      throw new Error('Invalid task: missing description');
    }
    
    // COMPLEX tasks don't need tools directly
    if (task.complexity === 'COMPLEX') {
      return {
        feasible: true,
        tools: [],
        reason: 'COMPLEX tasks do not require tools directly'
      };
    }
    
    try {
      // Step 1: Generate tool descriptions from the task
      const toolDescriptions = await this.generateToolDescriptions(task.description);
      
      // Step 2: Discover tools using semantic search on descriptions
      const qualifiedTools = await this.discoverToolsFromDescriptions(toolDescriptions);
      
      // Determine feasibility
      const feasible = qualifiedTools.length > 0;
      
      // Annotate task with tool information
      task.tools = qualifiedTools;
      task.feasible = feasible;
      
      return {
        feasible,
        tools: qualifiedTools,
        reason: feasible 
          ? `Found ${qualifiedTools.length} suitable tools via tool description bridge`
          : 'No suitable tools found through semantic search'
      };
      
    } catch (error) {
      console.warn(`Tool discovery failed for task "${task.description}": ${error.message}`);
      
      // Annotate task as infeasible
      task.tools = [];
      task.feasible = false;
      
      return {
        feasible: false,
        tools: [],
        reason: `Tool discovery error: ${error.message}`
      };
    }
  }

  /**
   * Judge if discovered tools are relevant for the task
   * @param {string} taskDescription - The original task
   * @param {Array} tools - The discovered tools
   * @returns {Promise<Object>} Judgment result with relevant tools and feedback
   */
  async judgeToolRelevance(taskDescription, tools) {
    if (!tools || tools.length === 0) {
      return {
        relevant: [],
        irrelevant: [],
        feedback: 'No tools to evaluate',
        suggestedApproach: null
      };
    }
    
    const prompt = `
Task: "${taskDescription}"

Discovered tools:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Evaluate if these tools are actually relevant for completing the task.

For each tool, determine:
1. Is it directly useful for this task?
2. If not, why not?

Also suggest if a different approach would be better (e.g., "write code using libraries" instead of using these tools).

Format response as JSON:
{
  "relevant": ["tool1", "tool2"],
  "irrelevant": {
    "tool_name": "reason why not relevant"
  },
  "suggestedApproach": "null or description of better approach",
  "needsCodeGeneration": true/false
}`;

    try {
      const response = await this.llmClient.complete(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('LLM response does not contain valid JSON');
      }
      
      const judgment = JSON.parse(jsonMatch[0]);
      
      // Filter tools based on judgment
      const relevantTools = tools.filter(t => 
        judgment.relevant && judgment.relevant.includes(t.name)
      );
      
      const irrelevantTools = tools.filter(t => 
        !judgment.relevant || !judgment.relevant.includes(t.name)
      );
      
      // Emit judgment event
      this.emit('toolsJudged', {
        relevant: relevantTools,
        irrelevant: irrelevantTools,
        judgment
      });
      
      return {
        relevant: relevantTools,
        irrelevant: irrelevantTools,
        feedback: judgment.irrelevant || {},
        suggestedApproach: judgment.suggestedApproach,
        needsCodeGeneration: judgment.needsCodeGeneration || false
      };
      
    } catch (error) {
      console.warn(`Failed to judge tool relevance: ${error.message}`);
      // Return all tools as potentially relevant if judgment fails
      return {
        relevant: tools,
        irrelevant: [],
        feedback: {},
        suggestedApproach: null,
        needsCodeGeneration: false
      };
    }
  }

  /**
   * Discover tools for a task using the tool description bridge
   * This is a convenience method that combines description generation and tool discovery
   * @param {string} taskDescription - The task description
   * @param {boolean} withJudgment - Whether to include relevance judgment
   * @returns {Promise<Object|Array>} Array of discovered tools or judgment result
   */
  async discoverToolsWithDescriptions(taskDescription, withJudgment = false) {
    // Step 1: Generate tool descriptions
    const descriptions = await this.generateToolDescriptions(taskDescription);
    
    // Step 2: Discover tools from descriptions
    const tools = await this.discoverToolsFromDescriptions(descriptions);
    
    // Step 3 (optional): Judge relevance
    if (withJudgment) {
      const judgment = await this.judgeToolRelevance(taskDescription, tools);
      return {
        allTools: tools,
        ...judgment
      };
    }
    
    return tools;
  }

  /**
   * Check feasibility of an entire task hierarchy
   * @param {TaskNode} root - Root of the task hierarchy
   * @returns {Promise<Object>} Aggregated feasibility result
   */
  async checkHierarchyFeasibility(root) {
    const results = {
      feasible: true,
      totalTasks: 0,
      simpleTasks: 0,
      feasibleTasks: 0,
      infeasibleTasks: [],
      toolCoverage: {}
    };
    
    // Traverse hierarchy and check each task
    await this.traverseAndCheck(root, results);
    
    // Overall feasibility: all SIMPLE tasks must be feasible
    results.feasible = results.infeasibleTasks.length === 0;
    
    return results;
  }

  /**
   * Recursively traverse and check tasks
   * @private
   */
  async traverseAndCheck(node, results) {
    results.totalTasks++;
    
    if (node.complexity === 'SIMPLE') {
      results.simpleTasks++;
      
      const feasibility = await this.checkTaskFeasibility(node);
      
      if (feasibility.feasible) {
        results.feasibleTasks++;
        
        // Track tool coverage
        feasibility.tools.forEach(tool => {
          results.toolCoverage[tool.name] = (results.toolCoverage[tool.name] || 0) + 1;
        });
      } else {
        results.infeasibleTasks.push({
          task: node.description,
          reason: feasibility.reason,
          path: this.getTaskPath(node)
        });
      }
    }
    
    // Check subtasks
    if (node.subtasks && node.subtasks.length > 0) {
      for (const subtask of node.subtasks) {
        await this.traverseAndCheck(subtask, results);
      }
    }
  }

  /**
   * Build search query from task information
   * @private
   */
  buildSearchQuery(task) {
    const parts = [task.description];
    
    // Add I/O hints if available
    if (task.suggestedInputs && task.suggestedInputs.length > 0) {
      parts.push(`inputs: ${task.suggestedInputs.join(', ')}`);
    }
    
    if (task.suggestedOutputs && task.suggestedOutputs.length > 0) {
      parts.push(`outputs: ${task.suggestedOutputs.join(', ')}`);
    }
    
    return parts.join(' ');
  }

  /**
   * Get the path to a task in the hierarchy
   * @private
   */
  getTaskPath(node) {
    // Simple implementation - could be enhanced to track actual path
    return node.id || node.description;
  }

  /**
   * Generate a feasibility report
   * @param {Object} results - Results from checkHierarchyFeasibility
   * @returns {string} Human-readable report
   */
  generateReport(results) {
    const lines = [
      '=== Tool Feasibility Report ===',
      '',
      `Total Tasks: ${results.totalTasks}`,
      `Simple Tasks: ${results.simpleTasks}`,
      `Feasible Tasks: ${results.feasibleTasks}`,
      `Overall Feasible: ${results.feasible ? 'YES' : 'NO'}`,
      ''
    ];
    
    if (results.infeasibleTasks.length > 0) {
      lines.push('Infeasible Tasks:');
      results.infeasibleTasks.forEach(task => {
        lines.push(`  - ${task.task}`);
        lines.push(`    Reason: ${task.reason}`);
      });
      lines.push('');
    }
    
    if (Object.keys(results.toolCoverage).length > 0) {
      lines.push('Tool Coverage:');
      Object.entries(results.toolCoverage)
        .sort((a, b) => b[1] - a[1])
        .forEach(([tool, count]) => {
          lines.push(`  - ${tool}: ${count} task(s)`);
        });
    }
    
    return lines.join('\n');
  }
}