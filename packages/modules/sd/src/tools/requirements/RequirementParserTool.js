/**
 * RequirementParserTool - Fixed for current Legion patterns
 * Parses and analyzes requirements using LLM with proper methodology
 */

import { Tool } from '@legion/tools-registry';

/**
 * Tool for parsing and analyzing software requirements (following Legion patterns)
 */
export class RequirementParserTool extends Tool {
  constructor(module, toolName) {
    // ONLY ONE WAY: Tool(module, toolName) - ALL metadata from module
    super(module, toolName);
    
    // Get dependencies from module (proper Legion pattern)
    this.resourceManager = module.resourceManager;
    this.designDatabase = module.designDatabase; 
    this.llmClient = module.llmClient;
    this.shortName = 'parse_req';
  }

  /**
   * Execute requirement parsing (Legion pattern: _execute returns result or throws)
   * @param {Object} args - Tool arguments
   * @returns {Object} Parsing result
   */
  async _execute(args) {
    const { requirementsText, projectId, analysisDepth = 'detailed' } = args;
    
    // Validate inputs (fail fast)
    if (!requirementsText || typeof requirementsText !== 'string') {
      throw new Error('requirementsText is required and must be a string');
    }
    
    // Get LLM client (Legion pattern)
    const llmClient = this.llmClient || await this.resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLM client not available');
    }
    
    // Create requirements analysis prompt (professional methodology)
    const prompt = this._createAnalysisPrompt(requirementsText, analysisDepth);
    
    // Get LLM analysis
    const llmResponse = await llmClient.complete(prompt);
    
    // Parse and validate response
    const parsedRequirements = this._parseAnalysisResponse(llmResponse);
    
    // Store artifact in design database (SD methodology value)
    const artifactId = await this._storeRequirementsArtifact(parsedRequirements, projectId);
    
    // Return structured result (Legion pattern)
    return {
      parsedRequirements,
      artifactId,
      summary: {
        functionalCount: parsedRequirements.functional?.length || 0,
        nonFunctionalCount: parsedRequirements.nonFunctional?.length || 0,
        constraintCount: parsedRequirements.constraints?.length || 0,
        assumptionCount: parsedRequirements.assumptions?.length || 0
      },
      methodology: 'DDD Requirements Analysis',
      qualityGates: this._validateMethodologyCompliance(parsedRequirements)
    };
  }

  /**
   * Create professional requirements analysis prompt
   * @param {string} requirementsText - Raw requirements
   * @param {string} analysisDepth - Analysis depth
   * @returns {string} Analysis prompt
   */
  _createAnalysisPrompt(requirementsText, analysisDepth) {
    const depthInstructions = {
      basic: 'Extract main functional requirements only.',
      detailed: 'Extract functional and non-functional requirements with DDD analysis.',
      comprehensive: 'Full DDD analysis with domain rules, constraints, and architectural implications.'
    };
    
    return `You are a requirements analyst expert in Domain-Driven Design methodology.

TASK: Analyze requirements and extract structured information following DDD principles.

ANALYSIS DEPTH: ${analysisDepth}
INSTRUCTIONS: ${depthInstructions[analysisDepth]}

REQUIREMENTS TEXT:
${requirementsText}

Extract requirements in this JSON format:
{
  "functional": [
    {
      "id": "FR-001",
      "description": "Clear functional requirement description",
      "priority": "high|medium|low",
      "domainArea": "core domain area",
      "acceptanceCriteria": ["criterion 1", "criterion 2"]
    }
  ],
  "nonFunctional": [
    {
      "id": "NFR-001", 
      "description": "Non-functional requirement description",
      "type": "performance|security|usability|reliability|scalability",
      "priority": "high|medium|low",
      "metric": "measurable criteria"
    }
  ],
  "constraints": [
    {
      "id": "C-001",
      "description": "Business or technical constraint",
      "type": "technical|business|regulatory",
      "impact": "Impact on design"
    }
  ],
  "domainRules": [
    {
      "id": "DR-001",
      "description": "Business rule from DDD analysis",
      "invariant": "Rule that must always hold true"
    }
  ],
  "reasoning": "DDD analysis reasoning and domain insights"
}

Return ONLY valid JSON.`;
  }

  /**
   * Parse LLM analysis response
   * @param {string} response - LLM response
   * @returns {Object} Parsed requirements
   */
  _parseAnalysisResponse(response) {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in LLM response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Ensure required structure exists
      return {
        functional: parsed.functional || [],
        nonFunctional: parsed.nonFunctional || [],
        constraints: parsed.constraints || [],
        assumptions: parsed.assumptions || [],
        domainRules: parsed.domainRules || [],
        reasoning: parsed.reasoning || 'No reasoning provided'
      };
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }

  /**
   * Store requirements artifact in design database
   * @param {Object} requirements - Parsed requirements
   * @param {string} projectId - Project identifier
   * @returns {Promise<string>} Artifact ID
   */
  async _storeRequirementsArtifact(requirements, projectId) {
    if (!this.designDatabase) {
      // Return mock ID if database not available
      return `req_${Date.now()}`;
    }

    try {
      const artifact = {
        type: 'requirements',
        projectId: projectId || `project_${Date.now()}`,
        data: requirements,
        methodology: 'DDD Requirements Analysis',
        timestamp: new Date().toISOString(),
        phase: 'requirements'
      };
      
      const stored = await this.designDatabase.storeArtifact(artifact);
      return stored.id || stored._id || `req_${Date.now()}`;
    } catch (error) {
      throw new Error(`Failed to store requirements artifact: ${error.message}`);
    }
  }

  /**
   * Validate methodology compliance (SD value-add)
   * @param {Object} requirements - Parsed requirements
   * @returns {Object} Quality validation results
   */
  _validateMethodologyCompliance(requirements) {
    const validation = {
      hasFunctionalRequirements: (requirements.functional?.length || 0) > 0,
      hasNonFunctionalRequirements: (requirements.nonFunctional?.length || 0) > 0,
      hasDomainRules: (requirements.domainRules?.length || 0) > 0,
      hasConstraints: (requirements.constraints?.length || 0) > 0,
      methodologyScore: 0
    };
    
    // Calculate methodology compliance score
    validation.methodologyScore = 
      (validation.hasFunctionalRequirements ? 25 : 0) +
      (validation.hasNonFunctionalRequirements ? 25 : 0) +
      (validation.hasDomainRules ? 25 : 0) +
      (validation.hasConstraints ? 25 : 0);
    
    validation.compliant = validation.methodologyScore >= 75;
    
    return validation;
  }
}

export default RequirementParserTool;