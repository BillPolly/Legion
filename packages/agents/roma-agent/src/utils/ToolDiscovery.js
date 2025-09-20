/**
 * ToolDiscovery - Discover tools using LLM-generated descriptions and semantic search
 * 
 * Based on decent planner's approach:
 * 1. Task description → LLM generates tool descriptions
 * 2. Tool descriptions → semantic search → unified tools
 * 3. Better semantic matching than direct task-to-tool search
 */

export default class ToolDiscovery {
  constructor(llmClient, toolRegistry) {
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.confidenceThreshold = 0.6;
    this.maxTools = 20;
    this.minDescriptions = 5;
    this.maxDescriptions = 8;
    this.toolCache = new Map(); // Cache discovered tools by name
  }

  /**
   * Discover tools for a task using the tool description bridge
   * @param {string} taskDescription - The task description
   * @returns {Promise<Array>} Array of discovered tools with confidence scores and execute functions
   */
  async discoverTools(taskDescription) {
    try {
      // Step 1: Generate tool descriptions from the task
      console.log(`🔍 Generating tool descriptions for: "${taskDescription}"`);
      const toolDescriptions = await this.generateToolDescriptions(taskDescription);
      console.log(`📝 Generated ${toolDescriptions.length} tool descriptions`);
      
      // Step 2: Discover tools from descriptions using semantic search
      console.log(`🔍 Discovering tools from descriptions...`);
      const tools = await this.discoverToolsFromDescriptions(toolDescriptions);
      console.log(`🔧 Found ${tools.length} tools`);
      
      // Step 3: Cache all discovered tools for later lookup
      tools.forEach(tool => {
        if (tool.name && tool.execute) {
          this.toolCache.set(tool.name, tool);
        }
      });
      
      return tools;
    } catch (error) {
      console.error(`Tool discovery failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Get a cached tool by name
   * @param {string} name - Tool name
   * @returns {Object|null} The cached tool or null
   */
  getCachedTool(name) {
    return this.toolCache.get(name) || null;
  }

  /**
   * Clear the tool cache
   */
  clearCache() {
    this.toolCache.clear();
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
      // Use the exact format from decent planner - just pass the prompt string
      const response = await this.llmClient.complete(prompt);

      // Parse JSON response using the exact regex from decent planner
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

      return validDescriptions;

    } catch (error) {
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
        console.log(`  🔎 Searching for: "${description}"`);

        // Use semantic search if available, otherwise fall back to listTools
        let tools = [];
        
        if (this.toolRegistry.searchTools) {
          // Use semantic search for better matching
          tools = await this.toolRegistry.searchTools(description, {
            limit: 5, // Get top 5 per description
            threshold: this.confidenceThreshold
          });
        } else {
          // Fall back to listing all tools and filtering by description
          console.log(`  ⚠️ Semantic search not available, using fallback`);
          const allTools = await this.toolRegistry.listTools({ limit: 100 });
          
          // Simple text matching fallback
          tools = allTools
            .filter(tool => {
              const toolDesc = (tool.description || '').toLowerCase();
              const searchDesc = description.toLowerCase();
              const words = searchDesc.split(' ');
              return words.some(word => toolDesc.includes(word));
            })
            .slice(0, 5)
            .map(tool => ({
              ...tool,
              score: 0.5, // Default confidence for fallback matches
              confidence: 0.5
            }));
        }

        // Load full tool instances to get execute functions
        const fullTools = await Promise.all(
          tools.map(async (searchResult) => {
            try {
              // Handle different result formats
              const actualTool = searchResult.tool || searchResult;
              const toolName = actualTool.name || searchResult.name;

              // ALWAYS get the full tool from ToolRegistry to ensure execute function
              // Search results only contain metadata, not the actual executable tool
              const fullTool = await this.toolRegistry.getTool(toolName);

              if (fullTool) {
                // CRITICAL FIX: Don't use spread operator as it doesn't copy prototype methods!
                // Instead, create a new object and explicitly copy the execute function
                const result = Object.assign({}, fullTool);
                result.confidence = searchResult.score || searchResult.confidence || 0.5;
                result.available = true;
                result.executable = typeof fullTool.execute === 'function';
                result.searchedFor = description; // Track what description found this tool
                
                // Explicitly ensure execute function is preserved
                if (typeof fullTool.execute === 'function') {
                  result.execute = fullTool.execute.bind(fullTool);
                }
                
                return result;
              }
            } catch (error) {
              console.warn(`Failed to load tool ${searchResult.name}: ${error.message}`);
            }
            
            // Return original tool if loading fails
            return {
              ...(searchResult.tool || searchResult),
              confidence: searchResult.score || searchResult.confidence || 0.5,
              available: false,
              executable: false,
              searchedFor: description
            };
          })
        );

        // Add found tools to the collection
        for (const toolResult of fullTools) {
          // Use tool name as the unique key
          const toolId = toolResult.name || toolResult._id || toolResult.id;

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

    return unifiedTools;
  }

  /**
   * Format discovered tools for prompt inclusion
   * @param {Array} tools - Array of discovered tools
   * @returns {string} Formatted tools section for prompt
   */
  static formatDiscoveredTools(tools) {
    if (!tools || tools.length === 0) {
      return 'No suitable tools discovered for this task.';
    }

    const lines = ['DISCOVERED TOOLS:'];
    lines.push('These tools were found based on the task requirements:\n');

    for (const tool of tools) {
      lines.push(`• ${tool.name} (confidence: ${(tool.confidence * 100).toFixed(0)}%)`);
      lines.push(`  Description: ${tool.description || 'No description'}`);

      // Show input schema if available
      if (tool.inputSchema || tool.inputs) {
        const schema = tool.inputSchema || tool.inputs;
        if (schema.properties) {
          const required = schema.required || [];
          const inputs = Object.entries(schema.properties)
            .map(([name]) => `${name}${required.includes(name) ? '' : '?'}`)
            .join(', ');
          lines.push(`  Inputs: ${inputs}`);
        }
      }

      // Show output schema if available
      if (tool.outputSchema || tool.outputs) {
        const schema = tool.outputSchema || tool.outputs;
        if (schema.properties) {
          const outputs = Object.keys(schema.properties).join(', ');
          lines.push(`  Outputs: ${outputs}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}