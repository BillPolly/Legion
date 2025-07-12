/**
 * ExecuteCommand - Handles tool execution
 */

export class ExecuteCommand {
  constructor(toolRegistry, outputFormatter) {
    this.toolRegistry = toolRegistry;
    this.outputFormatter = outputFormatter;
  }

  /**
   * Execute a tool command
   * @param {object} parsedArgs - Parsed command arguments
   * @param {object} config - Configuration
   */
  async execute(parsedArgs, config) {
    const { moduleName, toolName, args } = parsedArgs;
    
    // Try to resolve the tool
    let toolData = null;
    let resolvedToolName = null;
    
    if (moduleName && toolName) {
      // Traditional module.tool format
      resolvedToolName = `${moduleName}_${toolName}`;
      toolData = this.toolRegistry.resolveTool(resolvedToolName);
      
      if (!toolData) {
        resolvedToolName = toolName;
        toolData = this.toolRegistry.resolveTool(toolName);
      }
    } else if (toolName) {
      // Direct tool name
      resolvedToolName = toolName;
      toolData = this.toolRegistry.resolveTool(toolName);
    }
    
    if (!toolData) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    try {
      // Execute the tool
      const tool = toolData.tool;
      let result;
      
      // Handle different tool types
      if (typeof tool.invoke === 'function') {
        // Tool with invoke method (GitHub, PolyRepo)
        const functionName = toolData.metadata.functionName || toolName;
        result = await tool.invoke({
          function: {
            name: functionName,
            arguments: JSON.stringify(args)
          }
        });
      } else if (typeof tool.execute === 'function') {
        // ModularTool with execute method
        result = await tool.execute(args);
      } else {
        throw new Error(`Tool ${toolName} does not have a valid execution method`);
      }
      
      // Format output based on config
      if (config?.output === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result && typeof result === 'object' && result.content) {
          console.log(result.content);
        } else if (result && typeof result === 'object' && result.result !== undefined) {
          console.log(`Result: ${result.result}`);
        } else {
          console.log(result);
        }
      }
    } catch (error) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  /**
   * Find best match for a string
   * @param {string} input - Input string
   * @param {string[]} candidates - Candidate strings
   * @returns {string|null} Best match or null
   */
  findBestMatch(input, candidates) {
    if (!input || !candidates || candidates.length === 0) return null;
    
    const lowerInput = input.toLowerCase();
    let bestMatch = null;
    let bestDistance = Infinity;
    
    for (const candidate of candidates) {
      const distance = this.levenshteinDistance(lowerInput, candidate.toLowerCase());
      
      // Accept matches with distance <= 3
      if (distance <= 3 && distance < bestDistance) {
        bestDistance = distance;
        bestMatch = candidate;
      }
    }
    
    return bestMatch;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

export default ExecuteCommand;