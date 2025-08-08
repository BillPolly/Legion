/**
 * RequirementsAgent - BT Agent for requirements analysis
 * 
 * Extends SDAgentBase to perform requirements analysis using the
 * Requirements Analysis phase of the SD methodology
 */

import { SDAgentBase } from './SDAgentBase.js';

export class RequirementsAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'RequirementsAgent',
      description: 'Analyzes requirements and generates user stories with acceptance criteria',
      methodologyRules: {
        requirement: {
          mustHaveDescription: (artifact) => artifact.description && artifact.description.length > 0,
          mustHaveId: (artifact) => artifact.id && artifact.id.startsWith('FR-') || artifact.id.startsWith('NFR-'),
          mustHavePriority: (artifact) => ['high', 'medium', 'low'].includes(artifact.priority)
        },
        userStory: {
          mustFollowFormat: (artifact) => artifact.story && artifact.story.includes('As a'),
          mustHaveAcceptanceCriteria: (artifact) => artifact.acceptanceCriteria && artifact.acceptanceCriteria.length > 0
        }
      }
    });
    
    // Requirements-specific workflow configuration
    this.workflowConfig = this.createWorkflowConfig();
  }

  /**
   * Get current methodology phase
   * @returns {string} Current phase name
   */
  getCurrentPhase() {
    return 'requirements-analysis';
  }

  /**
   * Create BT workflow configuration for requirements analysis
   * @returns {Object} BT workflow configuration
   */
  createWorkflowConfig() {
    return {
      type: 'sequence',
      id: 'requirements-analysis-workflow',
      description: 'Complete requirements analysis workflow',
      children: [
        {
          type: 'action',
          id: 'parse-requirements',
          tool: 'parse_requirements',
          description: 'Parse and analyze raw requirements text',
          params: {
            requirementsText: '${input.requirementsText}',
            projectId: '${input.projectId}',
            analysisDepth: 'comprehensive'
          }
        },
        {
          type: 'action',
          id: 'generate-user-stories',
          tool: 'generate_user_stories',
          description: 'Generate user stories from parsed requirements',
          params: {
            parsedRequirements: '${results.parse-requirements.parsedRequirements}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'generate-acceptance-criteria',
          tool: 'generate_acceptance_criteria',
          description: 'Generate acceptance criteria for user stories',
          params: {
            userStories: '${results.generate-user-stories.userStories}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'validate-requirements',
          tool: 'validate_requirements',
          description: 'Validate all requirements artifacts',
          params: {
            parsedRequirements: '${results.parse-requirements.parsedRequirements}',
            userStories: '${results.generate-user-stories.userStories}',
            acceptanceCriteria: '${results.generate-acceptance-criteria.acceptanceCriteria}'
          }
        },
        {
          type: 'action',
          id: 'store-artifacts',
          tool: 'store_artifact',
          description: 'Store all requirements artifacts in design database',
          params: {
            artifact: {
              type: 'requirements-package',
              data: {
                parsedRequirements: '${results.parse-requirements.parsedRequirements}',
                userStories: '${results.generate-user-stories.userStories}',
                acceptanceCriteria: '${results.generate-acceptance-criteria.acceptanceCriteria}',
                validation: '${results.validate-requirements}'
              },
              metadata: {
                phase: 'requirements-analysis',
                agentId: '${agent.id}',
                timestamp: '${timestamp}'
              }
            },
            projectId: '${input.projectId}'
          }
        }
      ]
    };
  }

  /**
   * Process requirements (main agent entry point)
   * @param {Object} message - Input message with requirements
   * @returns {Object} Processing result
   */
  async receive(message) {
    const { type, payload } = message;
    
    if (type !== 'analyze_requirements') {
      return {
        success: false,
        error: 'RequirementsAgent only handles analyze_requirements messages'
      };
    }
    
    try {
      // Build context for requirements analysis
      const context = await this.buildContext('requirements', {
        projectId: payload.projectId
      });
      
      // Create execution context with input
      const executionContext = this.createExecutionContext({
        input: {
          requirementsText: payload.requirementsText,
          projectId: payload.projectId || `project_${Date.now()}`
        },
        context,
        agent: {
          id: this.id,
          name: this.name
        },
        timestamp: new Date().toISOString()
      });
      
      // Execute BT workflow
      const result = await this.executeBTWorkflow(this.workflowConfig, executionContext);
      
      // Validate all artifacts against methodology rules
      const validation = this.validateArtifacts(result);
      
      return {
        success: result.success,
        data: {
          ...result.data,
          validation,
          projectId: executionContext.input.projectId,
          phase: this.getCurrentPhase()
        }
      };
      
    } catch (error) {
      console.error(`[RequirementsAgent] Error processing requirements:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute BT workflow (placeholder - would use BehaviorTreeExecutor)
   * @param {Object} workflow - Workflow configuration
   * @param {Object} context - Execution context
   * @returns {Object} Execution result
   */
  async executeBTWorkflow(workflow, context) {
    // LIVE IMPLEMENTATION: Use actual tools instead of placeholders
    console.log(`[RequirementsAgent] Executing LIVE workflow:`, workflow.id);
    
    try {
      // Import and use the actual RequirementParserTool
      const { RequirementParserTool } = await import('../tools/requirements/RequirementParserTool.js');
      const { UserStoryGeneratorTool } = await import('../tools/requirements/UserStoryGeneratorTool.js');
      const { AcceptanceCriteriaGeneratorTool } = await import('../tools/requirements/AcceptanceCriteriaGeneratorTool.js');
      
      // Step 1: Parse requirements using real tool
      const parserTool = new RequirementParserTool({
        llmClient: this.llmClient,
        resourceManager: this.getResourceManager()
      });
      
      console.log('[RequirementsAgent] Executing REAL parse_requirements tool...');
      const parseResult = await parserTool.execute({
        requirementsText: context.input.requirementsText,
        projectId: context.input.projectId,
        analysisDepth: 'comprehensive'
      });
      
      if (!parseResult.success) {
        throw new Error(`Requirements parsing failed: ${parseResult.error}`);
      }
      
      console.log(`[RequirementsAgent] ✅ Parsed ${parseResult.data.parsedRequirements.functional.length} functional and ${parseResult.data.parsedRequirements.nonFunctional.length} non-functional requirements`);
      
      // Step 2: Generate user stories using real tool
      const storyTool = new UserStoryGeneratorTool({
        llmClient: this.llmClient,
        resourceManager: this.getResourceManager()
      });
      
      console.log('[RequirementsAgent] Executing REAL generate_user_stories tool...');
      const storyResult = await storyTool.execute({
        parsedRequirements: parseResult.data.parsedRequirements,
        projectId: context.input.projectId
      });
      
      if (!storyResult.success) {
        throw new Error(`User story generation failed: ${storyResult.error}`);
      }
      
      console.log(`[RequirementsAgent] ✅ Generated ${storyResult.data.userStories.length} user stories`);
      
      // Step 3: Generate acceptance criteria using real tool
      const criteriaTool = new AcceptanceCriteriaGeneratorTool({
        llmClient: this.llmClient,
        resourceManager: this.getResourceManager()
      });
      
      console.log('[RequirementsAgent] Executing REAL generate_acceptance_criteria tool...');
      const criteriaResult = await criteriaTool.execute({
        userStories: storyResult.data.userStories,
        projectId: context.input.projectId
      });
      
      if (!criteriaResult.success) {
        throw new Error(`Acceptance criteria generation failed: ${criteriaResult.error}`);
      }
      
      console.log(`[RequirementsAgent] ✅ Generated acceptance criteria for ${Object.keys(criteriaResult.data.acceptanceCriteria).length} user stories`);
      
      // Return real results
      return {
        success: true,
        data: {
          workflowId: workflow.id,
          executionTime: Date.now(),
          results: {
            'parse-requirements': {
              parsedRequirements: parseResult.data.parsedRequirements
            },
            'generate-user-stories': {
              userStories: storyResult.data.userStories
            },
            'generate-acceptance-criteria': {
              acceptanceCriteria: criteriaResult.data.acceptanceCriteria
            }
          }
        }
      };
      
    } catch (error) {
      console.error(`[RequirementsAgent] LIVE workflow failed:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate artifacts against methodology rules
   * @param {Object} result - Workflow result with artifacts
   * @returns {Object} Validation result
   */
  validateArtifacts(result) {
    const validationResults = {
      valid: true,
      violations: []
    };
    
    // Validate requirements
    if (result.data?.results?.['parse-requirements']?.parsedRequirements) {
      const requirements = result.data.results['parse-requirements'].parsedRequirements;
      
      // Validate functional requirements
      if (requirements.functional) {
        requirements.functional.forEach(req => {
          const validation = this.validateMethodology({ ...req, type: 'requirement' });
          if (!validation.valid) {
            validationResults.valid = false;
            validationResults.violations.push({
              artifact: `requirement-${req.id}`,
              violations: validation.violations
            });
          }
        });
      }
    }
    
    // Validate user stories
    if (result.data?.results?.['generate-user-stories']?.userStories) {
      const stories = result.data.results['generate-user-stories'].userStories;
      
      stories.forEach(story => {
        const validation = this.validateMethodology({ ...story, type: 'userStory' });
        if (!validation.valid) {
          validationResults.valid = false;
          validationResults.violations.push({
            artifact: `story-${story.id}`,
            violations: validation.violations
          });
        }
      });
    }
    
    return validationResults;
  }

  /**
   * Get agent metadata
   * @returns {Object} Agent metadata
   */
  getMetadata() {
    return {
      type: 'requirements',
      name: this.name,
      phase: this.getCurrentPhase(),
      capabilities: [
        'parse_requirements',
        'generate_user_stories',
        'generate_acceptance_criteria',
        'validate_requirements'
      ],
      methodologyRules: Object.keys(this.methodologyRules)
    };
  }
}