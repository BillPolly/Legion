/**
 * JSONOnlyLLMStrategy - Specialized strategy for generating pure JSON BT structures
 * 
 * This strategy uses specialized prompting techniques to ensure the LLM
 * returns ONLY valid JSON without any additional content.
 */

import { PlanningStrategy } from './PlanningStrategy.js';
import JSON5 from 'json5';

export class JSONOnlyLLMStrategy extends PlanningStrategy {
  constructor(llmClient, options = {}) {
    super(options);
    
    if (!llmClient) {
      throw new Error('JSONOnlyLLMStrategy requires an LLM client');
    }
    
    this.llmClient = llmClient;
    this.model = options.model || 'claude-3-5-sonnet-20241022';
    this.temperature = options.temperature || 0.2; // Lower temp for more consistent JSON
    this.maxTokens = options.maxTokens || 4000;
  }

  /**
   * Generate BT structure using specialized JSON-only prompting
   */
  async generateBT(request, context = {}) {
    this.debug(`Generating JSON-only BT for: ${request.description.substring(0, 50)}...`);
    
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Build specialized JSON-only prompt with retry context
        const prompt = this.buildJSONOnlyPrompt(request, context, attempt, lastError);
        
        // Use a very specific system message
        const systemMessage = this.buildSystemMessage(attempt, lastError);
        
        // Call LLM with strict JSON instructions
        const response = await this.llmClient.complete(prompt, {
          model: this.model,
          temperature: attempt === 1 ? this.temperature : Math.min(this.temperature + 0.1 * attempt, 0.7),
          maxTokens: this.maxTokens,
          system: systemMessage
        });
        
        // Parse with robust extraction
        const bt = this.extractAndParseJSON(response);
        
        return this.applyBTDefaults(bt);
        
      } catch (error) {
        this.debug(`BT generation attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        lastError = error;
        
        if (attempt === maxRetries) {
          throw new Error(`JSON-only BT generation failed after ${maxRetries} attempts. Last error: ${error.message}`);
        }
      }
    }
  }

  /**
   * Build system message with retry context
   */
  buildSystemMessage(attempt, lastError) {
    let baseMessage = `You are a JSON formatter that ONLY outputs valid JSON.
Never include markdown, code blocks, explanations, or any text outside the JSON structure.
Your entire response must be parseable JSON starting with { and ending with }.`;

    if (attempt > 1 && lastError) {
      baseMessage += `\n\nPREVIOUS ATTEMPT FAILED: ${lastError.message}
Please fix the issue and provide valid JSON only.`;
      
      if (lastError.message.includes('JSON')) {
        baseMessage += `\nFOCUS: Ensure proper JSON syntax - check brackets, quotes, and commas.`;
      }
      if (lastError.message.includes('tool')) {
        baseMessage += `\nFOCUS: Use only the exact tool names from the AVAILABLE ACTIONS list.`;
      }
    }

    return baseMessage;
  }

  /**
   * Build specialized prompt for JSON-only generation
   */
  buildJSONOnlyPrompt(request, context = {}, attempt = 1, lastError = null) {
    const actions = this.formatActionsAsJSON(request.allowableActions);
    
    return `TASK: Generate a Behavior Tree for: ${request.description}

AVAILABLE ACTIONS (use exact names in "tool" field):
${actions}

OUTPUT FORMAT: You must return ONLY a JSON object with this exact structure:

{
  "type": "sequence",
  "id": "root-task",
  "description": "Main task description",
  "children": [
    {
      "type": "retry",
      "id": "retry-action-1",
      "maxAttempts": 3,
      "description": "Retry wrapper for critical action",
      "child": {
        "type": "sequence",
        "id": "validated-action-1",
        "children": [
          {
            "type": "action",
            "id": "unique-id-1",
            "tool": "exact_tool_name_from_available_actions",
            "description": "What this action does",
            "params": {
              "param1": "value1",
              "param2": "value2"
            }
          },
          {
            "type": "condition",
            "id": "check-action-1-result",
            "check": "context.artifacts['unique-id-1'].success === true",
            "description": "Validate action completed successfully"
          }
        ]
      }
    }
  ]
}

RULES:
1. Use ONLY tools from AVAILABLE ACTIONS list
2. Each action must have: type, id, tool, description, params
3. Composite nodes (sequence/parallel) have children array
4. ALL file content goes in params.content field as a string
5. NO markdown, NO explanations, ONLY the JSON object

RESILIENCE PATTERNS (MANDATORY):
6. ALWAYS wrap critical actions with retry nodes (maxAttempts: 3)
7. ALWAYS follow actions with condition nodes to validate success
8. Use check expressions like: "context.artifacts['action-id'].success === true"
9. For file operations, also check: "context.artifacts['action-id'].filepath !== undefined"
10. Critical actions include: file_write, npm_install, create_database_connection, build_project

DEPENDENCY & BUILD GUIDELINES:
- For React/Node projects, create package.json first with dependencies
- Use npm_install after creating package.json to install dependencies
- Include build_project action after file creation for production builds
- Use run_tests to validate the application works
- For web apps, include start_dev_server to verify dev environment

FULL-STACK APPLICATION GUIDELINES:
- Create separate backend and frontend directories (e.g., backend/, frontend/)
- Backend: Use create_express_server for API server, create_api_endpoint for routes
- Database: Use create_database_connection and create_database_schema for data layer
- Frontend: Standard React app with API integration via fetch/axios
- Docker: Use create_dockerfile for each service, create_docker_compose for orchestration
- Testing: Use create_integration_test for API tests, create_e2e_test for user flows

EXAMPLE for file creation:
{
  "type": "action",
  "id": "create-file",
  "tool": "file_write",
  "description": "Create main file",
  "params": {
    "filepath": "app.js",
    "content": "const app = require('express')();\\napp.listen(3000);"
  }
}

Now generate the BT as pure JSON:${this.buildRetryContext(attempt, lastError)}`;
  }

  /**
   * Build retry-specific context for prompt
   */
  buildRetryContext(attempt, lastError) {
    if (attempt === 1) return '';
    
    let retryText = `\n\nRETRY ATTEMPT ${attempt}:`;
    
    if (lastError) {
      retryText += ` Previous attempt failed with: ${lastError.message}`;
      
      if (lastError.message.includes('JSON')) {
        retryText += `\nEMPHASIS: Double-check all JSON syntax - brackets, quotes, commas.`;
      }
      
      if (lastError.message.includes('tool') || lastError.message.includes('not found')) {
        retryText += `\nEMPHASIS: Use EXACT tool names from the AVAILABLE ACTIONS list above.`;
      }
      
      if (lastError.message.includes('retry') || lastError.message.includes('condition')) {
        retryText += `\nEMPHASIS: Include retry nodes and condition checks for resilience.`;
      }
    }
    
    retryText += `\nGenerate a SIMPLER, more reliable plan if the previous one was too complex.`;
    return retryText;
  }

  /**
   * Format actions as JSON for clear presentation
   */
  formatActionsAsJSON(actions) {
    return JSON.stringify(
      actions.map(a => ({
        tool: a.type || a.name,
        description: a.description,
        params: a.inputs || Object.keys(a.inputSchema?.properties || {})
      })),
      null,
      2
    );
  }

  /**
   * Extract and parse JSON with multiple fallback strategies
   */
  extractAndParseJSON(response) {
    let text = response.trim();
    
    // Strategy 1: If it's already clean JSON, parse directly
    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        return JSON5.parse(text);
      } catch (e) {
        this.debug('Direct parse failed, trying extraction...');
      }
    }
    
    // Strategy 2: Extract JSON from mixed content
    const extracted = this.extractJSONFromMixed(text);
    if (extracted) {
      try {
        return JSON5.parse(extracted);
      } catch (e) {
        this.debug('Extracted JSON parse failed');
      }
    }
    
    // Strategy 3: Find JSON boundaries using regex
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON5.parse(jsonMatch[0]);
      } catch (e) {
        this.debug('Regex extraction failed');
      }
    }
    
    throw new Error('Could not extract valid JSON from response');
  }

  /**
   * Extract JSON from mixed content using brace counting
   */
  extractJSONFromMixed(text) {
    const start = text.indexOf('{');
    if (start === -1) return null;
    
    let depth = 0;
    let inString = false;
    let escape = false;
    
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      
      if (escape) {
        escape = false;
        continue;
      }
      
      if (char === '\\' && inString) {
        escape = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            return text.substring(start, i + 1);
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Generate BT with retry-specific context
   */
  async generateBTWithRetry(request, retryContext) {
    this.debug(`Generating BT with retry context (attempt ${retryContext.attempt})`);
    
    const prompt = `Previous attempt failed. Generate ONLY valid JSON for: ${request.description}

Error: ${retryContext.validationErrors[0]?.message || 'Invalid JSON structure'}

Return ONLY a complete JSON object (no markdown, no explanations):
{
  "type": "sequence",
  "id": "root",
  "description": "...",
  "children": [...]
}`;
    
    const systemMessage = "Return ONLY valid JSON. No explanations, no markdown.";
    
    const response = await this.llmClient.complete(prompt, {
      model: this.model,
      temperature: Math.min(this.temperature + 0.1, 0.4),
      maxTokens: this.maxTokens,
      system: systemMessage
    });
    
    const bt = this.extractAndParseJSON(response);
    return this.applyBTDefaults(bt);
  }

  getMetadata() {
    return {
      ...super.getMetadata(),
      name: 'JSONOnlyLLMStrategy',
      type: 'json-only-llm',
      description: 'Specialized LLM strategy for pure JSON BT generation'
    };
  }
}