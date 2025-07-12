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
    const fullToolName = `${moduleName}.${toolName}`;
    
    // Check if module exists
    const modules = this.toolRegistry.moduleLoader.getModules();
    if (!modules.has(moduleName)) {
      throw new Error(`Module not found: ${moduleName}`);
    }
    
    // Check if tool exists
    const tool = this.toolRegistry.getToolByName(fullToolName);
    if (!tool) {
      throw new Error(`Tool not found: ${fullToolName}`);
    }
    
    // Validate arguments
    const validation = this.toolRegistry.validateToolArguments(fullToolName, args);
    if (!validation.valid) {
      // Find the first missing required parameter
      const missingParam = validation.errors.find(e => e.includes('Missing required'));
      if (missingParam) {
        throw new Error(missingParam);
      }
      // Handle other validation errors
      validation.errors.forEach(error => console.error(`  - ${error}`));
      throw new Error('Invalid arguments provided');
    }
    
    // Check for unknown parameters and suggest corrections
    const knownParams = Object.keys(tool.parameters?.properties || {});
    for (const argKey of Object.keys(args)) {
      if (!knownParams.includes(argKey)) {
        const suggestion = this.findBestMatch(argKey, knownParams);
        if (suggestion) {
          console.log(`\nDid you mean: --${suggestion}?`);
        } else {
          console.log('\nAvailable parameters:');
          knownParams.forEach(param => console.log(`  --${param}`));
        }
        throw new Error(`Unknown parameter: --${argKey}`);
      }
    }
    
    // Convert arguments to correct types
    const convertedArgs = this.toolRegistry.convertArguments(fullToolName, args);
    
    try {
      // Execute the tool
      const result = await this.toolRegistry.executeTool(fullToolName, convertedArgs, config);
      
      // Format and display output
      this.outputFormatter.format(result, parsedArgs.options);
    } catch (error) {
      throw error;
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