/**
 * UserStoryGeneratorTool - Fixed for current Legion patterns
 * Generates professional user stories from requirements using DDD methodology
 */

import { Tool } from '@legion/tools-registry';

/**
 * Tool for generating user stories with professional methodology (following Legion patterns)
 */
export class UserStoryGeneratorTool extends Tool {
  constructor(module, toolName) {
    // ONLY ONE WAY: Tool(module, toolName) - ALL metadata from module
    super(module, toolName);
    
    // Get dependencies from module (proper Legion pattern)
    this.resourceManager = module.resourceManager;
    this.designDatabase = module.designDatabase; 
    this.llmClient = module.llmClient;
    this.shortName = 'gen_stories';
  }

  /**
   * Execute user story generation (Legion pattern: _execute returns result or throws)
   * @param {Object} args - Tool arguments
   * @returns {Object} Generated user stories
   */
  async _execute(args) {
    const { parsedRequirements, projectId, persona = 'default' } = args;
    
    // Validate inputs (fail fast)
    if (!parsedRequirements || !parsedRequirements.functional) {
      throw new Error('parsedRequirements with functional requirements is required');
    }
    
    // Get LLM client (Legion pattern)
    const llmClient = this.llmClient || await this.resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLM client not available');
    }
    
    // Create user story generation prompt (professional methodology)
    const prompt = this._createUserStoryPrompt(parsedRequirements, persona);
    
    // Get LLM analysis
    const llmResponse = await llmClient.complete(prompt);
    
    // Parse and validate response
    const userStories = this._parseUserStoriesResponse(llmResponse);
    
    // Store artifact in design database (SD methodology value)
    const artifactId = await this._storeUserStoriesArtifact(userStories, projectId);
    
    // Return structured result (Legion pattern)
    return {
      userStories,
      artifactId,
      summary: {
        storyCount: userStories.length,
        highPriorityCount: userStories.filter(s => s.priority === 'high').length,
        mediumPriorityCount: userStories.filter(s => s.priority === 'medium').length,
        lowPriorityCount: userStories.filter(s => s.priority === 'low').length
      },
      methodology: 'DDD User Story Generation',
      qualityGates: this._validateStoryQuality(userStories)
    };
  }

  /**
   * Create professional user story generation prompt
   * @param {Object} requirements - Parsed requirements
   * @param {string} persona - User persona
   * @returns {string} Generation prompt
   */
  _createUserStoryPrompt(requirements, persona) {
    const functionalReqs = requirements.functional || [];
    
    return `You are an expert product analyst specializing in user story creation using agile and DDD methodologies.

TASK: Generate professional user stories from functional requirements.

PERSONA: ${persona}
METHODOLOGY: Domain-Driven Design + Agile User Stories

FUNCTIONAL REQUIREMENTS:
${JSON.stringify(functionalReqs, null, 2)}

Generate user stories in this JSON format:
{
  "userStories": [
    {
      "id": "US-001",
      "title": "Concise story title",
      "story": "As a [user type], I want to [goal] so that [benefit]",
      "priority": "high|medium|low",
      "estimatedEffort": "small|medium|large",
      "domainArea": "core domain area from DDD analysis",
      "acceptanceCriteria": [
        "Given [context] when [action] then [outcome]",
        "Given [context] when [action] then [outcome]"
      ],
      "businessValue": "Clear business value description",
      "dependencies": ["US-002", "US-003"]
    }
  ]
}

Return ONLY valid JSON with professional user stories following agile and DDD principles.`;
  }

  /**
   * Parse user stories response
   * @param {string} response - LLM response
   * @returns {Array} Generated user stories
   */
  _parseUserStoriesResponse(response) {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in LLM response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.userStories || [];
    } catch (error) {
      throw new Error(`Failed to parse user stories response: ${error.message}`);
    }
  }

  /**
   * Store user stories artifact in design database
   * @param {Array} userStories - Generated stories
   * @param {string} projectId - Project identifier
   * @returns {Promise<string>} Artifact ID
   */
  async _storeUserStoriesArtifact(userStories, projectId) {
    if (!this.designDatabase) {
      return `stories_${Date.now()}`;
    }

    try {
      const artifact = {
        type: 'user_stories',
        projectId: projectId || `project_${Date.now()}`,
        data: { userStories },
        methodology: 'DDD + Agile User Stories',
        timestamp: new Date().toISOString(),
        phase: 'requirements'
      };
      
      const stored = await this.designDatabase.storeArtifact(artifact);
      return stored.id || stored._id || `stories_${Date.now()}`;
    } catch (error) {
      throw new Error(`Failed to store user stories artifact: ${error.message}`);
    }
  }

  /**
   * Validate user story quality (SD methodology value)
   * @param {Array} userStories - Generated stories
   * @returns {Object} Quality validation
   */
  _validateStoryQuality(userStories) {
    const validation = {
      hasProperFormat: true,
      hasAcceptanceCriteria: true,
      hasPriorities: true,
      hasBusinessValue: true,
      qualityScore: 0
    };
    
    // Validate each story
    for (const story of userStories) {
      if (!story.story?.includes('As a') || !story.story?.includes('I want') || !story.story?.includes('so that')) {
        validation.hasProperFormat = false;
      }
      if (!story.acceptanceCriteria || story.acceptanceCriteria.length === 0) {
        validation.hasAcceptanceCriteria = false;
      }
      if (!story.priority) {
        validation.hasPriorities = false;
      }
      if (!story.businessValue) {
        validation.hasBusinessValue = false;
      }
    }
    
    // Calculate quality score
    validation.qualityScore = 
      (validation.hasProperFormat ? 25 : 0) +
      (validation.hasAcceptanceCriteria ? 25 : 0) +
      (validation.hasPriorities ? 25 : 0) +
      (validation.hasBusinessValue ? 25 : 0);
    
    validation.compliant = validation.qualityScore >= 75;
    
    return validation;
  }
}

export default UserStoryGeneratorTool;