/**
 * SDAgentBase - Base class for all SD agents
 * 
 * Extends Legion's BTAgentBase to provide SD-specific functionality
 * including design database context, LLM integration, and methodology enforcement
 */

import { BTAgentBase } from '@legion/actor-BT';

export class SDAgentBase extends BTAgentBase {
  constructor(config) {
    super(config);
    
    // SD-specific properties
    this.designDatabase = config.designDatabase;
    this.methodologyRules = config.methodologyRules || {};
    this.llmClient = null;
    this.contextBuilder = new ContextBuilder(this.designDatabase);
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    await super.initialize();
    
    // Get LLM client from ResourceManager
    this.llmClient = await this.getLLMClient();
  }

  /**
   * Get LLM client from ResourceManager
   * @returns {LLMClient} LLM client instance
   */
  async getLLMClient() {
    if (this.llmClient) {
      return this.llmClient;
    }

    // Access through ResourceManager (inherited from BTAgentBase)
    const resourceManager = this.getResourceManager();
    
    // Try to get existing client
    try {
      const existingClient = resourceManager.get('llmClient');
      if (existingClient) {
        this.llmClient = existingClient;
        return existingClient;
      }
    } catch (error) {
      // Client doesn't exist, will be created by SDModule
    }

    // Get from module's initialization
    const sdModule = resourceManager.get('sdModule');
    if (sdModule && sdModule.llmClient) {
      this.llmClient = sdModule.llmClient;
      return this.llmClient;
    }

    throw new Error('LLM client not available. Ensure SDModule is initialized.');
  }

  /**
   * Build context for LLM decisions
   * @param {string} contextType - Type of context to build
   * @param {Object} params - Parameters for context building
   * @returns {Object} Built context for LLM
   */
  async buildContext(contextType, params = {}) {
    return this.contextBuilder.build(contextType, params);
  }

  /**
   * Create execution context for BT workflow (override)
   * @param {Object} baseContext - Base context from BTAgentBase
   * @returns {Object} Enhanced context with SD-specific additions
   */
  createExecutionContext(baseContext) {
    const sdContext = {
      ...baseContext,
      designDatabase: this.designDatabase,
      methodologyRules: this.methodologyRules,
      llmClient: this.llmClient,
      
      // SD-specific context methods
      retrieveArtifact: async (type, query) => {
        return this.retrieveArtifact(type, query);
      },
      storeArtifact: async (artifact) => {
        return this.storeArtifact(artifact);
      },
      buildLLMContext: async (type, params) => {
        return this.buildContext(type, params);
      },
      makeLLMDecision: async (prompt, context) => {
        return this.makeLLMDecision(prompt, context);
      }
    };

    return sdContext;
  }

  /**
   * Make an LLM decision with context
   * @param {string} prompt - Decision prompt
   * @param {Object} context - Context for decision
   * @returns {Object} LLM decision with reasoning
   */
  async makeLLMDecision(prompt, context) {
    const llmClient = await this.getLLMClient();
    
    // Build full prompt with context
    const fullPrompt = this.buildPromptWithContext(prompt, context);
    
    // Make LLM call
    const response = await llmClient.complete(fullPrompt, {
      temperature: 0.3,
      maxTokens: 2000
    });
    
    // Parse and store decision with reasoning
    const decision = this.parseDecision(response);
    
    // Store decision reasoning with artifact
    if (context.artifactId) {
      await this.storeDecisionReasoning(context.artifactId, decision);
    }
    
    return decision;
  }

  /**
   * Build prompt with full context
   * @param {string} basePrompt - Base prompt
   * @param {Object} context - Context object
   * @returns {string} Full prompt with context
   */
  buildPromptWithContext(basePrompt, context) {
    const contextSections = [];
    
    // Add methodology context
    if (this.methodologyRules) {
      contextSections.push(`Methodology Rules:\n${JSON.stringify(this.methodologyRules, null, 2)}`);
    }
    
    // Add artifact context
    if (context.artifacts) {
      contextSections.push(`Related Artifacts:\n${JSON.stringify(context.artifacts, null, 2)}`);
    }
    
    // Add project context
    if (context.projectContext) {
      contextSections.push(`Project Context:\n${JSON.stringify(context.projectContext, null, 2)}`);
    }
    
    // Combine all context
    const fullContext = contextSections.join('\n\n');
    
    return `${fullContext}\n\n${basePrompt}`;
  }

  /**
   * Parse LLM decision response
   * @param {string} response - LLM response
   * @returns {Object} Parsed decision
   */
  parseDecision(response) {
    try {
      // Try to parse as JSON first
      if (response.trim().startsWith('{')) {
        return JSON.parse(response);
      }
    } catch (error) {
      // Not JSON, parse as text
    }
    
    return {
      decision: response,
      reasoning: response,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Store artifact in design database
   * @param {Object} artifact - Artifact to store
   * @returns {Object} Stored artifact with ID
   */
  async storeArtifact(artifact) {
    // This will use ArtifactStorageTool when implemented
    const enrichedArtifact = {
      ...artifact,
      agentId: this.id,
      agentType: this.constructor.name,
      timestamp: new Date().toISOString(),
      methodologyPhase: this.getCurrentPhase()
    };
    
    // Store in database (placeholder for now)
    console.log(`[${this.constructor.name}] Storing artifact:`, enrichedArtifact.type);
    
    return {
      ...enrichedArtifact,
      id: `artifact_${Date.now()}`
    };
  }

  /**
   * Retrieve artifact from design database
   * @param {string} type - Artifact type
   * @param {Object} query - Query parameters
   * @returns {Object|Array} Retrieved artifact(s)
   */
  async retrieveArtifact(type, query) {
    // This will use ContextRetrievalTool when implemented
    console.log(`[${this.constructor.name}] Retrieving ${type} with query:`, query);
    
    // Placeholder return
    return {
      type,
      query,
      results: []
    };
  }

  /**
   * Store LLM decision reasoning with artifact
   * @param {string} artifactId - Artifact ID
   * @param {Object} decision - Decision with reasoning
   */
  async storeDecisionReasoning(artifactId, decision) {
    const reasoningArtifact = {
      type: 'llm_reasoning',
      artifactId,
      decision: decision.decision,
      reasoning: decision.reasoning,
      timestamp: decision.timestamp,
      agentId: this.id
    };
    
    await this.storeArtifact(reasoningArtifact);
  }

  /**
   * Get current methodology phase
   * @returns {string} Current phase name
   */
  getCurrentPhase() {
    // Override in specific agents
    return 'unknown';
  }

  /**
   * Validate methodology compliance
   * @param {Object} artifact - Artifact to validate
   * @returns {Object} Validation result
   */
  validateMethodology(artifact) {
    const rules = this.methodologyRules[artifact.type] || {};
    const violations = [];
    
    // Check each rule
    for (const [rule, validator] of Object.entries(rules)) {
      if (typeof validator === 'function' && !validator(artifact)) {
        violations.push(rule);
      }
    }
    
    return {
      valid: violations.length === 0,
      violations,
      artifact: artifact.type
    };
  }
}

/**
 * ContextBuilder - Builds context for LLM decisions
 */
class ContextBuilder {
  constructor(designDatabase) {
    this.designDatabase = designDatabase;
  }

  /**
   * Build context based on type
   * @param {string} type - Context type
   * @param {Object} params - Parameters
   * @returns {Object} Built context
   */
  async build(type, params) {
    switch (type) {
      case 'requirements':
        return this.buildRequirementsContext(params);
      case 'domain':
        return this.buildDomainContext(params);
      case 'architecture':
        return this.buildArchitectureContext(params);
      case 'implementation':
        return this.buildImplementationContext(params);
      case 'testing':
        return this.buildTestingContext(params);
      default:
        return this.buildGenericContext(params);
    }
  }

  async buildRequirementsContext(params) {
    return {
      type: 'requirements',
      projectId: params.projectId,
      artifacts: {
        requirements: await this.getArtifacts('requirement', params.projectId),
        userStories: await this.getArtifacts('user_story', params.projectId)
      },
      methodology: 'Requirements Analysis Phase'
    };
  }

  async buildDomainContext(params) {
    return {
      type: 'domain',
      projectId: params.projectId,
      artifacts: {
        requirements: await this.getArtifacts('requirement', params.projectId),
        boundedContexts: await this.getArtifacts('bounded_context', params.projectId),
        entities: await this.getArtifacts('entity', params.projectId)
      },
      methodology: 'Domain-Driven Design Phase'
    };
  }

  async buildArchitectureContext(params) {
    return {
      type: 'architecture',
      projectId: params.projectId,
      artifacts: {
        domain: await this.getArtifacts('entity', params.projectId),
        layers: await this.getArtifacts('layer', params.projectId),
        useCases: await this.getArtifacts('use_case', params.projectId)
      },
      methodology: 'Clean Architecture Phase'
    };
  }

  async buildImplementationContext(params) {
    return {
      type: 'implementation',
      projectId: params.projectId,
      artifacts: {
        architecture: await this.getArtifacts('use_case', params.projectId),
        tests: await this.getArtifacts('test', params.projectId),
        code: await this.getArtifacts('code', params.projectId)
      },
      methodology: 'Clean Code Implementation Phase'
    };
  }

  async buildTestingContext(params) {
    return {
      type: 'testing',
      projectId: params.projectId,
      artifacts: {
        requirements: await this.getArtifacts('acceptance_criteria', params.projectId),
        implementation: await this.getArtifacts('code', params.projectId),
        tests: await this.getArtifacts('test', params.projectId)
      },
      methodology: 'Test-Driven Development Phase'
    };
  }

  async buildGenericContext(params) {
    return {
      type: 'generic',
      projectId: params.projectId,
      artifacts: {},
      methodology: 'General Context'
    };
  }

  /**
   * Get artifacts from database (placeholder)
   * @param {string} type - Artifact type
   * @param {string} projectId - Project ID
   * @returns {Array} Artifacts
   */
  async getArtifacts(type, projectId) {
    // This will query the design database when implemented
    return [];
  }
}