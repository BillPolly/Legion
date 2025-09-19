/**
 * PromptBuilder - Handles all prompt construction for SimpleROMAAgent
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class PromptBuilder {
  constructor() {
    this.templates = new Map();
    this.promptsDir = path.join(__dirname, '..', 'prompts');
  }
  
  /**
   * Initialize by loading all template files
   */
  async initialize() {
    try {
      const files = await fs.readdir(this.promptsDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      
      for (const file of mdFiles) {
        const templateName = file.replace('.md', '');
        const filePath = path.join(this.promptsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        this.templates.set(templateName, content);
      }
    } catch (error) {
      console.error('Failed to load prompt templates:', error.message);
      // Continue with empty templates rather than failing
      this.templates = new Map();
    }
  }
  
  /**
   * Build a prompt from a template with values
   * @param {string} templateName - Name of the template (without .md extension)
   * @param {Object} values - Values to replace in the template
   * @returns {string} The formatted prompt
   */
  buildPrompt(templateName, values = {}) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }
    
    let result = template;
    
    // Replace all placeholders
    for (const [key, value] of Object.entries(values)) {
      const placeholder = `{{${key}}}`;
      // Handle undefined/null values gracefully
      const replacement = value !== undefined && value !== null ? String(value) : '';
      result = result.replace(new RegExp(placeholder, 'g'), replacement);
    }
    
    // Clean up any remaining empty placeholders
    result = result.replace(/\{\{[^}]+\}\}/g, '');
    
    return result.trim();
  }

  /**
   * Build a prompt with schema-generated output instructions
   * @param {string} templateName - Name of the template (without .md extension)
   * @param {Object} values - Values to replace in the template
   * @param {ResponseValidator} responseValidator - Validator to generate output instructions
   * @param {*} exampleData - Example data for the output format
   * @param {Object} instructionOptions - Options for instruction generation
   * @returns {string} The formatted prompt with schema-based output instructions
   */
  buildPromptWithSchema(templateName, values = {}, responseValidator = null, exampleData = null, instructionOptions = {}) {
    // Build the base prompt from template
    const basePrompt = this.buildPrompt(templateName, values);
    
    // If no ResponseValidator provided, return base prompt
    if (!responseValidator) {
      return basePrompt;
    }
    
    // Generate schema-based output instructions
    const defaultInstructionOptions = {
      format: 'json',
      verbosity: 'detailed',
      includeExample: !!exampleData,
      includeConstraints: true,
      includeDescriptions: true,
      errorPrevention: true,
      ...instructionOptions
    };
    
    const formatInstructions = responseValidator.generateInstructions(
      exampleData,
      defaultInstructionOptions
    );
    
    // Combine template content with schema-generated instructions
    return `${basePrompt}\n\n${formatInstructions}`;
  }
  /**
   * Format tool inputs as comma-separated list (for test compatibility)
   * @param {Object} schema - Input schema
   * @returns {string} Comma-separated input names with optional markers
   */
  _formatInputsList(schema) {
    if (!schema || !schema.properties) {
      return '';
    }
    
    const required = schema.required || [];
    const inputs = Object.keys(schema.properties).map(name => {
      const isRequired = required.includes(name);
      return isRequired ? name : `${name}?`;
    });
    
    return inputs.join(', ');
  }

  /**
   * Format tool outputs as comma-separated list (for test compatibility) 
   * @param {Object} schema - Output schema
   * @returns {string} Comma-separated output names
   */
  _formatOutputsList(schema) {
    if (!schema || !schema.properties) {
      return '';
    }
    
    return Object.keys(schema.properties).join(', ');
  }
  /**
   * Build decomposition prompt for COMPLEX tasks
   * @param {Object} task - The task to decompose
   * @param {Object} context - Execution context with classification info
   * @returns {string} The formatted decomposition prompt
   */
  buildDecompositionPrompt(task, context) {
    const taskDescription = task.description || JSON.stringify(task);
    
    // Format classification info
    const classificationReasoning = context.classification?.reasoning 
      ? `Classification reasoning: ${context.classification.reasoning}`
      : '';
    
    const suggestedApproach = context.classification?.suggestedApproach
      ? `Suggested approach: ${context.classification.suggestedApproach}`
      : '';
    
    // Format artifacts section
    const artifactsSection = (context.artifactRegistry && context.artifactRegistry.size && context.artifactRegistry.size() > 0)
      ? this.formatArtifactsSection(context.artifactRegistry)
      : '';
    
    return this.buildPrompt('task-decomposition', {
      taskDescription,
      classificationReasoning,
      suggestedApproach,
      artifactsSection
    });
  }

  /**
   * Build execution prompt for SIMPLE tasks
   * @param {Object} task - The task to execute
   * @param {Object} context - Execution context with artifactRegistry, toolRegistry, and discoveredTools
   * @returns {Promise<string>} The formatted prompt
   */
  async buildExecutionPrompt(task, context) {
    const taskDescription = task.description || JSON.stringify(task);
    
    // Use discovered tools if available, otherwise fall back to listing all tools
    const toolsSection = context.discoveredTools && context.discoveredTools.length > 0
      ? this.formatDiscoveredToolsSection(context.discoveredTools)
      : await this.formatToolsSection(context.toolRegistry);
    
    // Format artifacts section
    const artifactsSection = this.formatArtifactsSection(context.artifactRegistry);
    
    // Prepare intro based on task type
    const taskIntro = context.isSimpleTask 
      ? `This task has been classified as SIMPLE and can be executed with a sequence of tool calls.\n\n`
      : `You are a task execution agent. Analyze this task and decide how to execute it.\n\n`;
    
    // Prepare instructions based on task type
    const instructions = context.isSimpleTask 
      ? this.getSimpleTaskInstructions()
      : this.getDecisionInstructions();
    
    return this.buildPrompt('task-execution', {
      taskIntro,
      taskDescription,
      toolsSection,
      artifactsSection,
      instructions
    });
  }

  /**
   * Get instructions for SIMPLE tasks (only tool calls)
   * @deprecated Use template file instead
   */
  getSimpleTaskInstructions() {
    return `Since this is a SIMPLE task, you should execute it using a sequence of tool calls.

Return JSON with this structure:
{
  "useTools": true,
  "toolCalls": [
    {
      "tool": "exact_tool_name",
      "inputs": {
        "arg1": "value1",
        "arg2": "@artifact_name"  // <- Use @ to reference existing artifacts
      },
      "outputs": {
        "toolOutputField": "@my_artifact_name"  // <- Optional: save tool's output field as artifact
      }
    }
  ]
}

IMPORTANT about tool calls:
- Tool names must be exact (e.g., "file_write" not "write_file")
- Inputs must match the tool's expected input schema
- Use @artifact_name to reference ANY existing artifact in inputs
- The "outputs" field maps tool output field names to artifact names for storage
- Example: "outputs": {"filepath": "@saved_path"} means take the tool's filepath output and save it as @saved_path
- You can overwrite existing artifacts by using the same name

If no tools are suitable, you can return:
{
  "response": "Explanation of why this task cannot be completed with available tools"
}`;
  }

  /**
   * Format the discovered tools section of the prompt
   * @param {Array} discoveredTools - Array of discovered tools with confidence scores
   * @returns {string} Formatted discovered tools section
   */
  formatDiscoveredToolsSection(discoveredTools) {
    if (!discoveredTools || discoveredTools.length === 0) {
      return 'AVAILABLE TOOLS: No suitable tools discovered for this task.';
    }

    const lines = ['AVAILABLE TOOLS (discovered for this task):'];
    lines.push('These are the ONLY tools you can use. Each tool has inputs and outputs.\n');
    
    for (const tool of discoveredTools) {
      lines.push(`• ${tool.name} (confidence: ${(tool.confidence * 100).toFixed(0)}%)`);
      lines.push(`  Description: ${tool.description || 'No description'}`);
      
      // Show detailed input schema with types and descriptions
      if (tool.inputSchema || tool.inputs) {
        const schema = tool.inputSchema || tool.inputs;
        if (schema.properties) {
          const required = schema.required || [];
          const inputsList = this._formatInputsList(schema);
          lines.push(`  Inputs: ${inputsList}`);
          
          Object.entries(schema.properties).forEach(([name, spec]) => {
            const isRequired = required.includes(name);
            const type = spec.type || 'any';
            const description = spec.description || 'No description';
            const requiredMarker = isRequired ? ' (required)' : ' (optional)';
            
            lines.push(`    - ${name}: ${type}${requiredMarker} - ${description}`);
          });
        } else {
          lines.push(`  Inputs: No input schema available`);
        }
      } else {
        lines.push(`  Inputs: No input schema available`);
      }
      
      // Show detailed output schema with types and descriptions
      if (tool.outputSchema || tool.outputs) {
        const schema = tool.outputSchema || tool.outputs;
        if (schema.properties) {
          const outputsList = this._formatOutputsList(schema);
          lines.push(`  Outputs: ${outputsList}`);
          
          Object.entries(schema.properties).forEach(([name, spec]) => {
            const type = spec.type || 'any';
            const description = spec.description || 'No description';
            
            lines.push(`    - ${name}: ${type} - ${description}`);
          });
        } else {
          lines.push(`  Outputs: No output schema available`);
        }
      } else {
        lines.push(`  Outputs: No output schema available`);
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * Format the tools section of the prompt
   * @param {ToolRegistry} toolRegistry - The tool registry
   * @returns {Promise<string>} Formatted tools section
   */
  async formatToolsSection(toolRegistry) {
    if (!toolRegistry) {
      return 'AVAILABLE TOOLS: None configured.';
    }

    try {
      // Get a sample of available tools
      const tools = await toolRegistry.listTools({ limit: 20 });
      
      if (!tools || tools.length === 0) {
        return 'AVAILABLE TOOLS: None found.';
      }

      const lines = ['AVAILABLE TOOLS:'];
      lines.push('These are the ONLY tools you can use. Each tool has inputs and outputs.\n');
      
      for (const tool of tools) {
        lines.push(`• ${tool.name}`);
        lines.push(`  Description: ${tool.description || 'No description'}`);
        
        // Show detailed input schema with types and descriptions
        if (tool.inputSchema || tool.inputs) {
          const schema = tool.inputSchema || tool.inputs;
          if (schema.properties) {
            const required = schema.required || [];
            const inputsList = this._formatInputsList(schema);
            lines.push(`  Inputs: ${inputsList}`);
            
            Object.entries(schema.properties).forEach(([name, spec]) => {
              const isRequired = required.includes(name);
              const type = spec.type || 'any';
              const description = spec.description || 'No description';
              const requiredMarker = isRequired ? ' (required)' : ' (optional)';
              
              lines.push(`    - ${name}: ${type}${requiredMarker} - ${description}`);
            });
          } else {
            lines.push(`  Inputs: No input schema available`);
          }
        } else {
          lines.push(`  Inputs: No input schema available`);
        }
        
        // Show detailed output schema with types and descriptions
        if (tool.outputSchema || tool.outputs) {
          const schema = tool.outputSchema || tool.outputs;
          if (schema.properties) {
            const outputsList = this._formatOutputsList(schema);
            lines.push(`  Outputs: ${outputsList}`);
            
            Object.entries(schema.properties).forEach(([name, spec]) => {
              const type = spec.type || 'any';
              const description = spec.description || 'No description';
              
              lines.push(`    - ${name}: ${type} - ${description}`);
            });
          } else {
            lines.push(`  Outputs: No output schema available`);
          }
        } else {
          lines.push(`  Outputs: No output schema available`);
        }
        
        lines.push('');
      }
      
      return lines.join('\n');
    } catch (error) {
      return `AVAILABLE TOOLS: Error loading tools - ${error.message}`;
    }
  }

  /**
   * Format the artifacts section of the prompt
   * @param {ArtifactRegistry} artifactRegistry - The artifact registry
   * @returns {string} Formatted artifacts section
   */
  formatArtifactsSection(artifactRegistry) {
    if (!artifactRegistry || !artifactRegistry.size || artifactRegistry.size() === 0) {
      return 'AVAILABLE ARTIFACTS: None available yet.'; // Show message when no artifacts exist
    }

    const lines = ['AVAILABLE ARTIFACTS:'];
    lines.push('These are values from previous steps that might be useful in your tool calls.');
    lines.push('You can reference any artifact using the @ symbol (e.g., @artifact_name).\n');
    
    for (const artifact of artifactRegistry.getAll()) {
      lines.push(`• @${artifact.name}`);
      lines.push(`  Type: ${artifact.type}`);
      lines.push(`  Description: ${artifact.description}`);
    }
    
    lines.push(''); // Add blank line for readability
    lines.push(this.getArtifactUsageInstructions());
    lines.push(this.getToolCallExample(artifactRegistry));
    
    return lines.join('\n');
  }

  /**
   * Get the decision instructions portion of the prompt
   * @returns {string} Decision instructions
   * @deprecated Use template file instead
   */
  getDecisionInstructions() {
    return `You MUST choose ONE of these three options:
1. USE TOOLS - If this task can be completed with available tools
2. DECOMPOSE - If this task is complex and needs to be broken into simpler subtasks  
3. RESPOND - If this is a question or analysis that just needs a direct response

CRITICAL: Your response MUST be a valid JSON object in EXACTLY one of these formats:

OPTION 1 - USING TOOLS (when you can directly use a tool):
{
  "useTools": true,
  "toolCalls": [
    {
      "tool": "exact_tool_name",
      "inputs": {
        "arg1": "value1",
        "arg2": "@artifact_name"  // <- Use @ to reference existing artifacts
      },
      "outputs": {
        "toolOutputField": "@my_artifact_name"  // <- Optional: save tool's output field as artifact
      }
    }
  ]
}

IMPORTANT about outputs:
- The tool defines what output fields it produces (e.g., filepath, content, result)
- In "outputs", you map those tool output fields to artifact names (with @)
- Example: "outputs": {"filepath": "@saved_path"} means take the tool's filepath output and save it as @saved_path
- You can overwrite existing artifacts by using the same name (e.g., "@current_data" will replace the old @current_data)
- Only include outputs if you need to use that value later with @artifact_name

OPTION 2 - DECOMPOSING (when task is too complex for a single tool):
{
  "decompose": true,
  "subtasks": [
    {
      "description": "First subtask description",
      "outputs": "@subtask1_result"  // <- Optional: save this subtask's result as artifact
    },
    {
      "description": "Second subtask using @subtask1_result from first step",
      "outputs": "@final_result"
    }
  ]
}

OPTION 3 - DIRECT RESPONSE (for questions/analysis/explanations):
{
  "response": "Your direct answer or explanation here"
}

REMEMBER:
- Tool names must be exact (e.g., "file_write" not "write_file")  
- Inputs must match the tool's expected input schema
- Use @artifact_name to reference ANY existing artifact in inputs
- The "outputs" field maps tool output field names to artifact names for storage
- Only include outputs when you need to reference that value later`;
  }

  /**
   * Get artifact usage instructions
   * @returns {string} Artifact usage instructions
   */
  getArtifactUsageInstructions() {
    return `IMPORTANT: When using artifacts in tool calls:
- You MUST use the @ symbol followed by the artifact name
- DO NOT include the actual value - just the reference
- The reference will be automatically replaced with the actual value`;
  }

  /**
   * Get a complete tool call example with artifacts
   * @param {ArtifactRegistry} artifactRegistry - The artifact registry
   * @returns {string} Tool call example
   */
  getToolCallExample(artifactRegistry) {
    const firstArtifact = artifactRegistry.list()[0] || 'example_artifact';
    
    return `
COMPLETE EXAMPLE OF A TOOL CALL WITH ARTIFACT:
{
  "useTools": true,
  "toolCalls": [
    {
      "tool": "file_write",
      "inputs": {
        "filePath": "/tmp/output.html",
        "content": "@${firstArtifact}"  // <- This uses the ${firstArtifact} artifact
      },
      "outputs": {
        "path": "@saved_file_path"  // <- Maps the tool's 'path' output to artifact @saved_file_path
      }
    }
  ]
}`;
  }

  /**
   * Build the system message for the LLM
   * @returns {string} System message
   */
  getSystemMessage() {
    return 'You are a task decomposition agent. Always respond with valid JSON.';
  }

  /**
   * Format an error message for the user
   * @param {string} error - The error message
   * @param {Object} context - Additional context
   * @returns {string} Formatted error message
   */
  formatError(error, context = {}) {
    let message = `Error: ${error}`;
    
    if (context.tool) {
      message += `\nTool: ${context.tool}`;
    }
    
    if (context.suggestion) {
      message += `\nSuggestion: ${context.suggestion}`;
    }
    
    return message;
  }

  /**
   * Format a progress message
   * @param {string} action - What's happening
   * @param {Object} details - Additional details
   * @returns {string} Formatted progress message
   */
  formatProgress(action, details = {}) {
    let message = action;
    
    if (details.depth !== undefined) {
      message = `[Depth ${details.depth}] ${message}`;
    }
    
    if (details.subtask) {
      message += `: ${details.subtask}`;
    }
    
    if (details.artifact) {
      message += ` (saving as @${details.artifact})`;
    }
    
    return message;
  }
}