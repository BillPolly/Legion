/**
 * SDMethodologyService - Professional software development methodology integration
 * Provides sophisticated development workflow vs basic tool calling
 */

/**
 * Simple SD methodology service for Gemini integration
 */
export class SDMethodologyService {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.tools = new Map();
    this.isReady = false;
    this._initializeTools();
  }

  /**
   * Initialize SD tools with working pattern
   */
  async _initializeTools() {
    try {
      // Import working SD tools
      const { default: RequirementParserTool } = await import('../../../../modules/sd/src/tools/requirements/RequirementParserTool.js');
      const { default: UserStoryGeneratorTool } = await import('../../../../modules/sd/src/tools/requirements/UserStoryGeneratorTool.js');
      
      // Create module-like object for tools
      const toolModule = {
        resourceManager: this.resourceManager,
        designDatabase: null, // Will use fallback IDs
        llmClient: null, // Tools will get from ResourceManager
        getToolMetadata: () => ({})
      };
      
      // Initialize working SD tools
      this.tools.set('requirements_analysis', new RequirementParserTool(toolModule, 'parse_requirements'));
      this.tools.set('user_story_generation', new UserStoryGeneratorTool(toolModule, 'generate_user_stories'));
      
      this.isReady = true;
      console.log('✅ SD methodology service ready with', this.tools.size, 'professional tools');
    } catch (error) {
      console.warn('SD methodology service initialization failed:', error.message);
    }
  }

  /**
   * Analyze requirements using professional DDD methodology
   * @param {string} requirementsText - Raw requirements
   * @param {string} projectId - Project identifier
   * @returns {Promise<Object>} Professional requirements analysis
   */
  async analyzeRequirements(requirementsText, projectId = null) {
    if (!this.isReady) {
      throw new Error('SD methodology service not ready');
    }

    const reqTool = this.tools.get('requirements_analysis');
    return await reqTool._execute({ 
      requirementsText, 
      projectId: projectId || `project_${Date.now()}`,
      analysisDepth: 'comprehensive' 
    });
  }

  /**
   * Generate user stories from requirements using agile + DDD methodology  
   * @param {Object} parsedRequirements - Requirements from analysis
   * @param {string} projectId - Project identifier
   * @param {string} persona - User persona
   * @returns {Promise<Object>} Professional user stories
   */
  async generateUserStories(parsedRequirements, projectId, persona = 'end-user') {
    if (!this.isReady) {
      throw new Error('SD methodology service not ready');
    }

    const storyTool = this.tools.get('user_story_generation');
    return await storyTool._execute({ parsedRequirements, projectId, persona });
  }

  /**
   * Complete professional development analysis workflow
   * @param {string} developmentRequest - User's development request  
   * @param {string} projectId - Project identifier
   * @returns {Promise<Object>} Complete methodology analysis
   */
  async performDevelopmentAnalysis(developmentRequest, projectId = null) {
    console.log('🏗️ Starting professional development methodology...');
    
    try {
      // Phase 1: Requirements Analysis with DDD
      const reqResult = await this.analyzeRequirements(developmentRequest, projectId);
      
      // Phase 2: User Story Generation with Agile + DDD
      const storyResult = await this.generateUserStories(reqResult.parsedRequirements, projectId);
      
      // Combine results with methodology summary
      return {
        success: true,
        methodology: 'DDD + Agile + Clean Architecture',
        phases: {
          requirements: {
            result: reqResult,
            qualityGate: reqResult.qualityGates.compliant ? 'PASSED' : 'FAILED',
            artifacts: [reqResult.artifactId]
          },
          userStories: {
            result: storyResult,
            qualityGate: storyResult.qualityGates.compliant ? 'PASSED' : 'FAILED', 
            artifacts: [storyResult.artifactId]
          }
        },
        summary: {
          totalRequirements: reqResult.summary.functionalCount + reqResult.summary.nonFunctionalCount,
          totalStories: storyResult.summary.storyCount,
          highPriorityStories: storyResult.summary.highPriorityCount,
          methodologyCompliant: reqResult.qualityGates.compliant && storyResult.qualityGates.compliant,
          artifactsGenerated: 2
        },
        nextPhase: 'Domain Modeling (when tools are updated)',
        professionalAdvantage: 'Systematic analysis, quality gates, artifact traceability vs ad-hoc file creation'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        fallbackRecommendation: 'Use basic Gemini tools for file operations'
      };
    }
  }

  /**
   * Check if request should use professional methodology
   * @param {string} request - User request
   * @returns {boolean} Whether to use SD methodology
   */
  shouldUseMethodology(request) {
    const lowerRequest = request.toLowerCase();
    
    // Professional methodology keywords
    const methodologyTriggers = [
      'build application', 'create system', 'develop platform',
      'design architecture', 'enterprise', 'scalable',
      'requirements analysis', 'domain modeling', 'clean architecture',
      'professional development', 'methodology', 'best practices'
    ];
    
    return methodologyTriggers.some(trigger => lowerRequest.includes(trigger));
  }

  /**
   * Get service statistics
   * @returns {Object} Service stats
   */
  getStats() {
    return {
      isReady: this.isReady,
      availableTools: this.tools.size,
      toolNames: Array.from(this.tools.keys()),
      methodology: 'DDD + Agile + Clean Architecture'
    };
  }
}

export default SDMethodologyService;