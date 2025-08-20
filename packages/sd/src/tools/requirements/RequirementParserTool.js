/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * RequirementParserTool - Parses and analyzes requirements using LLM
 * 
 * Extends Legion's Tool class to parse requirements text and extract
 * structured information using LLM for intelligent analysis
 */

import { Tool, ToolResult } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const requirementParserToolInputSchema = {
  type: 'object',
  properties: {
    requirementsText: {
      type: 'string',
      description: 'Raw requirements text to parse'
    },
    projectId: {
      type: 'string',
      description: 'Project ID for context'
    },
    analysisDepth: {
      type: 'string',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'detailed',
      description: 'Level of analysis depth'
    }
  },
  required: ['requirementsText']
};

// Output schema as plain JSON Schema
const requirementParserToolOutputSchema = {
  type: 'object',
  properties: {
    parsedRequirements: {
      type: 'object',
      properties: {
        functional: { type: 'array' },
        nonFunctional: { type: 'array' },
        constraints: { type: 'array' },
        assumptions: { type: 'array' },
        dependencies: { type: 'array' },
        reasoning: { type: 'string' }
      },
      description: 'Parsed requirements structure'
    },
    artifactId: {
      type: 'string',
      description: 'ID of stored artifact'
    },
    summary: {
      type: 'object',
      properties: {
        functionalCount: { type: 'integer' },
        nonFunctionalCount: { type: 'integer' },
        constraintCount: { type: 'integer' },
        assumptionCount: { type: 'integer' }
      },
      description: 'Summary statistics'
    },
    llmReasoning: {
      type: 'string',
      description: 'LLM reasoning about the analysis'
    }
  },
  required: ['parsedRequirements', 'artifactId', 'summary']
};

export class RequirementParserTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'parse_requirements',
      description: 'Parse and analyze requirements text to extract structured information',
      inputSchema: requirementParserToolInputSchema,
      outputSchema: requirementParserToolOutputSchema
    });
    
    this.llmClient = dependencies.llmClient;
    this.designDatabase = dependencies.designDatabase;
    this.resourceManager = dependencies.resourceManager;
  }

  /**
   * Execute requirement parsing
   * @param {Object} args - Tool arguments
   * @returns {ToolResult} Parsing result
   */
  async execute(args) {
    const { requirementsText, projectId, analysisDepth } = args;
    
    try {
      this.emit('progress', { percentage: 0, status: 'Starting requirement parsing...' });
      
      // Get LLM client
      const llmClient = await this.getLLMClient();
      
      // Build context for parsing
      const context = await this.buildParsingContext(projectId);
      
      this.emit('progress', { percentage: 20, status: 'Analyzing requirements with LLM...' });
      
      // Create parsing prompt
      const prompt = this.createParsingPrompt(requirementsText, analysisDepth, context);
      
      // Call LLM for parsing
      const llmResponse = await llmClient.complete(prompt, {
        temperature: 0.3,
        maxTokens: 3000,
        system: 'You are an expert requirements analyst. Extract structured information from requirements text.'
      });
      
      this.emit('progress', { percentage: 60, status: 'Processing LLM response...' });
      
      // Parse LLM response
      const parsedRequirements = this.parseLLMResponse(llmResponse);
      
      // Validate parsed requirements
      const validation = this.validateParsedRequirements(parsedRequirements);
      if (!validation.valid) {
        return ToolResult.failure(`Invalid parsed requirements: ${validation.errors.join(', ')}`);
      }
      
      this.emit('progress', { percentage: 80, status: 'Storing parsed requirements...' });
      
      // Store in design database
      const storedArtifact = await this.storeRequirements(parsedRequirements, projectId);
      
      this.emit('progress', { percentage: 100, status: 'Requirements parsed successfully' });
      
      return ToolResult.success({
        parsedRequirements,
        artifactId: storedArtifact.id,
        summary: {
          functionalCount: parsedRequirements.functional?.length || 0,
          nonFunctionalCount: parsedRequirements.nonFunctional?.length || 0,
          constraintCount: parsedRequirements.constraints?.length || 0,
          assumptionCount: parsedRequirements.assumptions?.length || 0
        },
        llmReasoning: parsedRequirements.reasoning
      });
      
    } catch (error) {
      return ToolResult.failure(`Failed to parse requirements: ${error.message}`);
    }
  }

  /**
   * Get LLM client from dependencies
   */
  async getLLMClient() {
    // Priority 1: Direct injection
    if (this.llmClient) {
      return this.llmClient;
    }
    
    // Priority 2: Try from ResourceManager
    if (this.resourceManager) {
      try {
        this.llmClient = this.resourceManager.get('llmClient');
        if (this.llmClient) {
          return this.llmClient;
        }
      } catch (error) {
        // Continue to next option
      }

      // Try from sdModule
      try {
        const sdModule = this.resourceManager.get('sdModule');
        if (sdModule && sdModule.llmClient) {
          this.llmClient = sdModule.llmClient;
          return this.llmClient;
        }
      } catch (error) {
        // Continue
      }
    }
    
    throw new Error('LLM client not available - ensure tool is initialized with llmClient or resourceManager');
  }

  /**
   * Build context for requirement parsing
   */
  async buildParsingContext(projectId) {
    if (!projectId) {
      return { new: true };
    }
    
    // Retrieve existing project context if available
    // This would query the design database when fully implemented
    return {
      projectId,
      existingRequirements: [],
      domainContext: null
    };
  }

  /**
   * Create LLM prompt for requirement parsing
   */
  createParsingPrompt(requirementsText, analysisDepth, context) {
    const depthInstructions = {
      basic: 'Extract only the main functional requirements.',
      detailed: 'Extract functional and non-functional requirements with priorities.',
      comprehensive: 'Extract all requirements, constraints, assumptions, and dependencies with full analysis.'
    };
    
    return `Analyze the following requirements text and extract structured information.

Analysis Depth: ${analysisDepth}
Instructions: ${depthInstructions[analysisDepth]}

Requirements Text:
${requirementsText}

${context.existingRequirements?.length > 0 ? `
Existing Requirements Context:
${JSON.stringify(context.existingRequirements, null, 2)}
` : ''}

Please extract and structure the requirements in the following JSON format:
{
  "functional": [
    {
      "id": "FR-001",
      "description": "Clear description of the functional requirement",
      "priority": "high|medium|low",
      "category": "category name",
      "acceptanceCriteria": ["criterion 1", "criterion 2"]
    }
  ],
  "nonFunctional": [
    {
      "id": "NFR-001",
      "description": "Clear description of the non-functional requirement",
      "type": "performance|security|usability|reliability|scalability",
      "priority": "high|medium|low",
      "metric": "measurable metric if applicable"
    }
  ],
  "constraints": [
    {
      "id": "C-001",
      "description": "Description of the constraint",
      "type": "technical|business|regulatory",
      "impact": "Description of impact"
    }
  ],
  "assumptions": [
    {
      "id": "A-001",
      "description": "Description of the assumption",
      "risk": "Risk if assumption is invalid"
    }
  ],
  "dependencies": [
    {
      "id": "D-001",
      "description": "Description of the dependency",
      "type": "internal|external",
      "criticalPath": true
    }
  ],
  "reasoning": "Explanation of your analysis and any ambiguities found"
}

Return ONLY the JSON object, no additional text.`;
  }

  /**
   * Parse LLM response to extract structured requirements
   * FAIL FAST - no fallbacks allowed
   */
  parseLLMResponse(response) {
    try {
      // Clean response and parse JSON
      const cleanedResponse = response.trim();
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = cleanedResponse.substring(jsonStart, jsonEnd);
        return JSON.parse(jsonStr);
      }
      
      // Try direct parse if already clean JSON
      return JSON.parse(cleanedResponse);
      
    } catch (error) {
      // NO FALLBACKS - fail fast to expose real issues
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}. Response was: ${response.substring(0, 200)}...`);
    }
  }

  /**
   * Validate parsed requirements
   */
  validateParsedRequirements(parsed) {
    const errors = [];
    
    // Check required fields
    if (!parsed.functional || !Array.isArray(parsed.functional)) {
      errors.push('Functional requirements must be an array');
    }
    
    // Validate each functional requirement
    if (parsed.functional) {
      parsed.functional.forEach((req, index) => {
        if (!req.id) errors.push(`Functional requirement ${index} missing ID`);
        if (!req.description) errors.push(`Functional requirement ${index} missing description`);
      });
    }
    
    // Validate non-functional requirements
    if (parsed.nonFunctional && !Array.isArray(parsed.nonFunctional)) {
      errors.push('Non-functional requirements must be an array');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Store parsed requirements in design database
   * FAIL FAST - no fallbacks allowed
   */
  async storeRequirements(parsedRequirements, projectId) {
    // NO FALLBACKS - require real database connection
    if (!this.designDatabase || typeof this.designDatabase.storeArtifact !== 'function') {
      throw new Error('Design database not available - RequirementParserTool requires real database connection');
    }
    
    const artifact = {
      type: 'parsed_requirements',
      projectId: projectId || `project_${Date.now()}`,
      data: parsedRequirements,
      metadata: {
        toolName: this.name,
        timestamp: new Date().toISOString(),
        functionalCount: parsedRequirements.functional?.length || 0,
        nonFunctionalCount: parsedRequirements.nonFunctional?.length || 0
      },
      llmReasoning: parsedRequirements.reasoning
    };
    
    try {
      return await this.designDatabase.storeArtifact(artifact);
    } catch (error) {
      // Fail fast - don't mask database errors
      throw new Error(`Failed to store requirements artifact: ${error.message}`);
    }
  }
}