/**
 * ToolFeasibilityChecker - Discovers and validates tools for SIMPLE tasks
 */

import { SimpleEmitter } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';

export class ToolFeasibilityChecker extends SimpleEmitter {
  constructor(toolRegistry, llmClientOrOptions, options = {}) {
    super(); // Call SimpleEmitter constructor
    
    if (!toolRegistry) {
      throw new Error('ToolRegistry is required');
    }
    
    // Handle overloaded constructor signature for backward compatibility
    let llmClient = null;
    let actualOptions = options;
    
    if (llmClientOrOptions && typeof llmClientOrOptions === 'object') {
      // Check if it's an options object or an LLM client
      if (llmClientOrOptions.complete && typeof llmClientOrOptions.complete === 'function') {
        // It's an LLM client
        llmClient = llmClientOrOptions;
      } else {
        // It's an options object
        actualOptions = llmClientOrOptions;
        // LLM client will be initialized on first use
        llmClient = null;
      }
    } else {
      // No second parameter or it's not an object
      actualOptions = llmClientOrOptions || {};
      // LLM client will be initialized on first use
      llmClient = null;
    }
    
    this.toolRegistry = toolRegistry;
    this.llmClient = llmClient;
    this.confidenceThreshold = actualOptions.confidenceThreshold || 0.6; // Set to 60% to catch JavaScript tools
    this.maxTools = actualOptions.maxTools || 20; // Allow more tools for curated sets
    this.maxDescriptions = actualOptions.maxDescriptions || 8; // Max tool descriptions (both general and specific)
    this.minDescriptions = actualOptions.minDescriptions || 5; // Min tool descriptions to generate
  }
  
  /**
   * Get LLM client, creating it if necessary
   * @returns {Promise<Object>} LLM client
   */
  async getLLMClient() {
    if (!this.llmClient) {
      const resourceManager = await ResourceManager.getInstance();
      const llmClientOrPromise = resourceManager.get('llmClient');
      
      if (!llmClientOrPromise) {
        throw new Error('LLM client is required but not available from ResourceManager');
      }
      
      // If it's a promise, await it
      if (llmClientOrPromise && typeof llmClientOrPromise.then === 'function') {
        this.llmClient = await llmClientOrPromise;
      } else {
        this.llmClient = llmClientOrPromise;
      }
      
      if (!this.llmClient) {
        throw new Error('Failed to get LLM client from ResourceManager');
      }
    }
    return this.llmClient;
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
      const llmClient = await this.getLLMClient();
      const response = await llmClient.complete(prompt);
      
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
      // No fallback - LLM is required
      throw new Error(`Failed to generate tool descriptions: ${error.message}`);
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
        const tools = await this.toolRegistry.searchTools(description, {
          limit: 5, // Get top 5 per description
          threshold: this.confidenceThreshold
        });
        
        // Load full tool instances to get execute functions
        const fullTools = await Promise.all(
          tools.map(async (tool) => {
            try {
              const fullTool = await this.toolRegistry.getTool(tool.name);
              if (fullTool) {
                return {
                  ...tool,
                  ...fullTool,
                  confidence: tool.score || tool.confidence || 0.5,
                  available: true,
                  executable: typeof fullTool.execute === 'function'
                };
              }
            } catch (error) {
              console.warn(`Failed to load tool ${tool.name}:`, error.message);
            }
            // Return original tool if loading fails
            return {
              ...tool,
              confidence: tool.score || tool.confidence || 0.5,
              available: false,
              executable: false
            };
          })
        );
        
        // Convert to expected format
        const searchResult = {
          tools: fullTools
        };
        
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
          const toolId = toolResult._id || toolResult.id;
          
          // Only include executable tools
          if (!toolResult.available || !toolResult.executable) {
            continue;
          }
          
          // Keep the best confidence score if we see this tool multiple times
          if (!allToolsFound.has(toolId) || 
              toolResult.confidence > allToolsFound.get(toolId).confidence) {
            allToolsFound.set(toolId, toolResult);
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
        reason: 'COMPLEX tasks do not require tools directly',
        debug: {
          taskDescription: task.description,
          taskComplexity: 'COMPLEX',
          step1_descriptions: [],
          step2_discoveries: [],
          step3_merged: [],
          final_feasible: true
        }
      };
    }
    
    const debug = {
      taskDescription: task.description,
      taskComplexity: task.complexity,
      step1_descriptions: [],
      step2_discoveries: [],
      step3_merged: [],
      final_feasible: false,
      error: null
    };
    
    try {
      // Step 1: Generate tool descriptions from the task
      console.log(`🔍 Step 1: Generating tool descriptions for: "${task.description}"`);
      const toolDescriptions = await this.generateToolDescriptions(task.description);
      debug.step1_descriptions = toolDescriptions;
      console.log(`📝 Generated ${toolDescriptions.length} tool descriptions:`, toolDescriptions);
      
      // Step 2: Discover tools using semantic search on descriptions
      console.log(`🔍 Step 2: Discovering tools for each description...`);
      const discoveryResults = [];
      
      for (const description of toolDescriptions) {
        console.log(`  🔎 Searching for: "${description}"`);
        
        try {
          // First get all tools without threshold filtering to show what was found
          const allTools = await this.toolRegistry.searchTools(description, {
            limit: 5
            // No threshold - get everything
          });
          
          // Then filter by our confidence threshold
          const filteredTools = allTools.filter(tool => 
            (tool.score || tool.confidence || 0) >= this.confidenceThreshold
          );
          
          // Load full tool instances for the filtered tools
          const fullTools = await Promise.all(
            filteredTools.map(async (tool) => {
              try {
                const fullTool = await this.toolRegistry.getTool(tool.name);
                if (fullTool) {
                  return {
                    ...tool,
                    ...fullTool,
                    confidence: tool.score || tool.confidence || 0.5,
                    available: true,
                    executable: typeof fullTool.execute === 'function'
                  };
                }
                return null;
              } catch (error) {
                console.warn(`Failed to load tool ${tool.name}:`, error.message);
                return null;
              }
            })
          );
          
          const validTools = fullTools.filter(tool => tool !== null);
          
          // Create detailed discovery result with all information
          discoveryResults.push({
            description,
            toolsFound: allTools.length,
            toolsFiltered: filteredTools.length,
            tools: allTools.map(tool => ({
              name: tool.name,
              confidence: tool.score || tool.confidence || 0,
              filtered: (tool.score || tool.confidence || 0) < this.confidenceThreshold
            })),
            validTools,
            threshold: this.confidenceThreshold
          });
          
          console.log(`    ✅ Found ${allTools.length} tools, ${filteredTools.length} after filtering:`, validTools.map(t => `${t.name} (${t.confidence})`));
          
        } catch (error) {
          console.warn(`  ❌ Search failed for "${description}":`, error.message);
          discoveryResults.push({
            description,
            toolsFound: 0,
            tools: [],
            error: error.message
          });
        }
      }
      
      debug.step2_discoveries = discoveryResults;
      
      // Step 3: Merge and deduplicate tools from all descriptions
      console.log(`🔍 Step 3: Merging and deduplicating tools...`);
      const allToolsFound = new Map(); // name -> best tool data
      
      for (const result of discoveryResults) {
        for (const tool of result.tools || []) {
          const existing = allToolsFound.get(tool.name);
          if (!existing || tool.confidence > existing.confidence) {
            allToolsFound.set(tool.name, tool);
          }
        }
      }
      
      const qualifiedTools = Array.from(allToolsFound.values())
        .filter(tool => tool.confidence >= this.confidenceThreshold)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.maxTools);
      
      debug.step3_merged = qualifiedTools;
      console.log(`🔧 Final merged tools (${qualifiedTools.length}):`, 
        qualifiedTools.map(t => `${t.name} (${t.confidence})`));
      
      // Determine feasibility
      const feasible = qualifiedTools.length > 0;
      debug.final_feasible = feasible;
      
      // Annotate task with tool information
      task.tools = qualifiedTools;
      task.feasible = feasible;
      
      const result = {
        feasible,
        tools: qualifiedTools,
        reason: feasible 
          ? `Found ${qualifiedTools.length} suitable tools via tool description bridge`
          : 'No suitable tools found through semantic search',
        debug
      };
      
      console.log(`${feasible ? '✅' : '❌'} Task "${task.description}" feasibility: ${feasible}`);
      return result;
      
    } catch (error) {
      console.error(`Tool discovery failed for task "${task.description}":`, error);
      debug.error = error.message;
      
      // Annotate task as infeasible
      task.tools = [];
      task.feasible = false;
      
      return {
        feasible: false,
        tools: [],
        reason: `Tool discovery error: ${error.message}`,
        debug
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