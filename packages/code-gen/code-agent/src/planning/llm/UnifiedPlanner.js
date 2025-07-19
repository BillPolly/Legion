/**
 * UnifiedPlanner - A single planner that replaces all specialized planning classes
 * 
 * This class uses the GenericPlanner from llm-planner package to handle all planning
 * tasks by configuring different objectives and allowable actions for each domain.
 */

import { GenericPlanner } from '@jsenvoy/llm-planner/src/GenericPlanner.js';
import { ResourceManager } from '@jsenvoy/module-loader';

// Planning domain configurations
import { RequirementAnalyzerConfig } from './configs/RequirementAnalyzerConfig.js';
import { DirectoryPlannerConfig } from './configs/DirectoryPlannerConfig.js';
import { DependencyPlannerConfig } from './configs/DependencyPlannerConfig.js';
import { FrontendArchitecturePlannerConfig } from './configs/FrontendArchitecturePlannerConfig.js';
import { BackendArchitecturePlannerConfig } from './configs/BackendArchitecturePlannerConfig.js';
import { APIInterfacePlannerConfig } from './configs/APIInterfacePlannerConfig.js';
import { TestStrategyPlannerConfig } from './configs/TestStrategyPlannerConfig.js';

class UnifiedPlanner {
  constructor(config = {}) {
    this.config = {
      provider: 'mock', // Default to mock for testing
      ...config
    };
    
    // Accept LLM client directly or use ResourceManager
    this.llmClient = config.llmClient || null;
    this.resourceManager = config.llmClient ? null : new ResourceManager();
    this.genericPlanner = null;
    this.initialized = false;
    
    // Map planning types to their configurations
    this.plannerConfigs = {
      'requirement': RequirementAnalyzerConfig,
      'directory': DirectoryPlannerConfig,
      'dependency': DependencyPlannerConfig,
      'frontend': FrontendArchitecturePlannerConfig,
      'backend': BackendArchitecturePlannerConfig,
      'api': APIInterfacePlannerConfig,
      'test': TestStrategyPlannerConfig
    };
  }

  /**
   * Initialize the unified planner
   */
  async initialize() {
    try {
      // If LLM client provided directly, use it
      if (this.llmClient) {
        // Using provided LLM client
      } else {
        // Initialize ResourceManager and get LLM client
        await this.resourceManager.initialize();
        
        // Get LLM client from ResourceManager
        this.llmClient = this.resourceManager.get('llm-client');
        if (!this.llmClient) {
          throw new Error('LLM client not available from ResourceManager');
        }
      }
      
      // Initialize generic planner with LLM client
      this.genericPlanner = new GenericPlanner({ llmClient: this.llmClient });
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize UnifiedPlanner: ${error.message}`);
    }
  }

  /**
   * Plan requirements analysis
   * @param {Object} requirements - Project requirements
   * @returns {Promise<Object>} Requirements analysis result
   */
  async analyzeRequirements(requirements) {
    this._ensureInitialized();
    return this._executePlanning('requirement', requirements);
  }

  /**
   * Plan directory structure
   * @param {Object} analysis - Project analysis from requirement analyzer
   * @returns {Promise<Object>} Directory structure plan
   */
  async planDirectoryStructure(analysis) {
    this._ensureInitialized();
    return this._executePlanning('directory', analysis);
  }

  /**
   * Plan file dependencies
   * @param {Object} structure - Directory structure plan
   * @param {Object} analysis - Project analysis
   * @returns {Promise<Object>} Dependency plan
   */
  async planDependencies(structure, analysis) {
    this._ensureInitialized();
    return this._executePlanning('dependency', { structure, analysis });
  }

  /**
   * Plan frontend architecture
   * @param {Object} analysis - Project analysis
   * @returns {Promise<Object>} Frontend architecture plan
   */
  async planFrontendArchitecture(analysis) {
    this._ensureInitialized();
    return this._executePlanning('frontend', analysis);
  }

  /**
   * Plan backend architecture
   * @param {Object} analysis - Project analysis
   * @returns {Promise<Object>} Backend architecture plan
   */
  async planBackendArchitecture(analysis) {
    this._ensureInitialized();
    return this._executePlanning('backend', analysis);
  }

  /**
   * Plan API interfaces
   * @param {Object} frontendArchitecture - Frontend architecture plan
   * @param {Object} backendArchitecture - Backend architecture plan
   * @returns {Promise<Object>} API interface plan
   */
  async planAPIInterface(frontendArchitecture, backendArchitecture) {
    this._ensureInitialized();
    return this._executePlanning('api', { frontendArchitecture, backendArchitecture });
  }

  /**
   * Plan test strategy
   * @param {Object} analysis - Project analysis
   * @param {Object} projectPlan - Complete project plan (optional)
   * @returns {Promise<Object>} Test strategy plan
   */
  async planTestStrategy(analysis, projectPlan = null) {
    this._ensureInitialized();
    return this._executePlanning('test', { analysis, projectPlan });
  }

  /**
   * Execute planning for a specific domain
   * @private
   */
  async _executePlanning(planningType, input) {
    const config = this.plannerConfigs[planningType];
    if (!config) {
      throw new Error(`Unknown planning type: ${planningType}`);
    }

    try {
      // Generate objective based on planning type and input
      const objective = this._generateObjective(planningType, input);
      
      // Get allowable actions for this planning domain
      const allowableActions = config.allowableActions;
      
      // Extract input names based on planning type
      const inputNames = this._getInputNamesForPlanningType(planningType, input);
      
      // Create planning request for GenericPlanner
      const planningRequest = {
        description: objective,
        allowableActions,
        inputs: inputNames,
        requiredOutputs: config.requiredOutputs || [],
        maxSteps: config.maxSteps || 10
      };

      // Execute planning using GenericPlanner
      const plan = await this.genericPlanner.createPlan(planningRequest);
      
      // Transform plan to match expected output format
      const result = this._transformPlanToOutput(planningType, plan, input);
      
      return result;
    } catch (error) {
      throw new Error(`Planning failed for ${planningType}: ${error.message}`);
    }
  }

  /**
   * Get input names for GenericPlanner based on planning type
   * @private
   */
  _getInputNamesForPlanningType(planningType, input) {
    const safeInput = input || {};
    
    switch (planningType) {
      case 'requirement':
        // For requirement analysis, provide the basic inputs that actions expect
        return ['requirements_text', 'frontend_requirements', 'backend_requirements'];
      
      case 'directory':
        // For directory planning, we need project analysis
        return ['project_analysis'];
      
      case 'dependency':
        // For dependency planning, we need structure and analysis
        return ['directory_structure', 'project_analysis'];
      
      case 'frontend':
        // For frontend architecture, we need analysis
        return ['project_analysis'];
      
      case 'backend':
        // For backend architecture, we need analysis
        return ['project_analysis'];
      
      case 'api':
        // For API interface, we need architectures
        return ['frontend_architecture', 'backend_architecture'];
      
      case 'test':
        // For test strategy, we need project analysis
        return ['project_analysis'];
      
      default:
        return ['input_data'];
    }
  }

  /**
   * Generate objective description based on planning type and input
   * @private
   */
  _generateObjective(planningType, input) {
    // Handle null/undefined input
    const safeInput = input || {};
    
    switch (planningType) {
      case 'requirement':
        return `Analyze the following project requirements and determine the project type, complexity, components, and architecture suggestions: ${safeInput.task || 'No task specified'}`;
      
      case 'directory':
        return `Create an optimal directory structure for a ${safeInput.projectType || 'general'} project with ${safeInput.complexity || 'medium'} complexity, including all necessary files and folders.`;
      
      case 'dependency':
        return `Determine the optimal creation order for files based on their dependencies, ensuring proper dependency resolution and avoiding circular dependencies.`;
      
      case 'frontend':
        return `Design a comprehensive frontend architecture for a ${safeInput.projectType || 'frontend'} project, including component hierarchy, state management, and styling organization.`;
      
      case 'backend':
        return `Design a comprehensive backend architecture including API design, data layer, services, middleware, and security for a ${safeInput.projectType || 'backend'} project.`;
      
      case 'api':
        return `Design complete API interfaces and contracts between frontend and backend, including DTOs, communication patterns, and error handling.`;
      
      case 'test':
        const analysisInfo = safeInput.analysis || safeInput;
        return `Design a comprehensive test strategy for a ${analysisInfo.projectType || 'general'} project with ${analysisInfo.complexity || 'medium'} complexity, including unit tests, integration tests, e2e tests, coverage targets, and test data management.`;
      
      default:
        return `Plan and organize the architecture for ${planningType} domain.`;
    }
  }

  /**
   * Build context for planning request
   * @private
   */
  _buildContext(planningType, input) {
    const context = {
      planningType,
      input,
      timestamp: Date.now()
    };

    // Add domain-specific context
    switch (planningType) {
      case 'requirement':
        context.availableProjectTypes = ['frontend', 'backend', 'fullstack'];
        context.complexityLevels = ['low', 'medium', 'high'];
        break;
      
      case 'directory':
        context.supportedTemplates = ['simple', 'modular', 'layered'];
        context.commonDirectories = ['src', 'tests', 'docs', 'config'];
        break;
      
      case 'dependency':
        context.fileTypes = ['configuration', 'utilities', 'models', 'services', 'controllers', 'components'];
        context.maxDependencyDepth = 20;
        break;
      
      case 'frontend':
        context.componentTypes = ['container', 'display', 'form', 'navigation', 'interactive'];
        context.stateManagementOptions = ['local', 'centralized', 'modular'];
        break;
      
      case 'backend':
        context.architecturePatterns = ['monolithic', 'layered', 'microservices'];
        context.apiStyles = ['REST', 'GraphQL'];
        break;
      
      case 'api':
        context.communicationProtocols = ['HTTP', 'WebSocket', 'Server-Sent Events'];
        context.authStrategies = ['JWT', 'OAuth', 'API Key'];
        break;
      
      case 'test':
        context.testTypes = ['unit', 'integration', 'e2e', 'performance', 'security'];
        context.coverageTargets = { unit: 80, integration: 70, e2e: 60 };
        context.testFrameworks = ['jest', 'mocha', 'cypress', 'playwright'];
        break;
    }

    return context;
  }

  /**
   * Transform hierarchical plan to expected output format
   * @private
   */
  _transformPlanToOutput(planningType, plan, input) {
    const config = this.plannerConfigs[planningType];
    
    // Extract actions from the hierarchical plan
    const actions = this._extractActionsFromPlan(plan);
    
    // Transform based on planning type
    switch (planningType) {
      case 'requirement':
        return this._transformRequirementAnalysis(actions, input);
      
      case 'directory':
        return this._transformDirectoryStructure(actions, input);
      
      case 'dependency':
        return this._transformDependencyPlan(actions, input);
      
      case 'frontend':
        return this._transformFrontendArchitecture(actions, input);
      
      case 'backend':
        return this._transformBackendArchitecture(actions, input);
      
      case 'api':
        return this._transformAPIInterface(actions, input);
      
      case 'test':
        return this._transformTestStrategy(actions, input);
      
      default:
        return {
          planningType,
          actions,
          metadata: {
            planner: 'UnifiedPlanner',
            plannedAt: Date.now(),
            originalPlan: plan
          }
        };
    }
  }

  /**
   * Extract actions from hierarchical plan structure
   * @private
   */
  _extractActionsFromPlan(plan) {
    const actions = [];
    
    const extractFromStep = (step) => {
      if (step.actions) {
        actions.push(...step.actions);
      }
      if (step.subSteps) {
        step.subSteps.forEach(extractFromStep);
      }
    };
    
    if (plan.steps) {
      plan.steps.forEach(extractFromStep);
    }
    
    return actions;
  }

  /**
   * Transform actions to requirement analysis format
   * @private
   */
  _transformRequirementAnalysis(actions, input) {
    const safeInput = input || {};
    const analysis = {
      task: safeInput.task || 'Unknown task',
      projectType: 'frontend',
      components: {},
      complexity: 'medium',
      timestamp: Date.now()
    };

    // Process actions to build analysis
    actions.forEach(action => {
      switch (action.type) {
        case 'determine_project_type':
          analysis.projectType = action.parameters?.projectType || 'frontend';
          break;
        case 'analyze_complexity':
          analysis.complexity = action.parameters?.complexity || 'medium';
          break;
        case 'extract_frontend_features':
          if (!analysis.components.frontend) analysis.components.frontend = {};
          analysis.components.frontend.features = action.parameters?.features || [];
          break;
        case 'extract_backend_features':
          if (!analysis.components.backend) analysis.components.backend = {};
          analysis.components.backend.features = action.parameters?.features || [];
          break;
        case 'suggest_architecture':
          analysis.suggestedArchitecture = action.parameters?.architecture || {
            pattern: 'simple',
            structure: {}
          };
          break;
      }
    });

    // Add metadata
    analysis.metadata = {
      planner: 'UnifiedPlanner',
      plannedAt: Date.now(),
      originalActions: actions.length
    };

    return analysis;
  }

  /**
   * Transform actions to directory structure format
   * @private
   */
  _transformDirectoryStructure(actions, input) {
    const structure = {
      directories: [],
      files: [],
      descriptions: {},
      warnings: [],
      isValid: true,
      metadata: {
        planner: 'UnifiedPlanner',
        plannedAt: Date.now(),
        projectType: input.projectType || 'general',
        complexity: input.complexity || 'medium'
      }
    };

    // Process actions to build structure
    actions.forEach(action => {
      switch (action.type) {
        case 'create_directory':
          const dirName = action.parameters?.name;
          if (dirName && !structure.directories.includes(dirName)) {
            structure.directories.push(dirName);
            if (action.parameters?.description) {
              structure.descriptions[dirName] = action.parameters.description;
            }
          }
          break;
        case 'create_file':
          const fileName = action.parameters?.name;
          if (fileName && !structure.files.includes(fileName)) {
            structure.files.push(fileName);
          }
          break;
        case 'apply_template':
          const template = action.parameters?.template;
          if (template && template.directories) {
            structure.directories.push(...template.directories);
          }
          if (template && template.files) {
            structure.files.push(...template.files);
          }
          break;
      }
    });

    // Remove duplicates and sort
    structure.directories = [...new Set(structure.directories)].sort();
    structure.files = [...new Set(structure.files)].sort();

    return structure;
  }

  /**
   * Transform actions to dependency plan format
   * @private
   */
  _transformDependencyPlan(actions, input) {
    const plan = {
      creationOrder: [],
      dependencies: {},
      conflicts: [],
      isValid: true,
      metadata: {
        planner: 'UnifiedPlanner',
        plannedAt: Date.now(),
        totalFiles: input.structure?.files?.length || 0
      }
    };

    // Process actions to build dependency plan
    actions.forEach(action => {
      switch (action.type) {
        case 'order_files':
          plan.creationOrder = action.parameters?.order || [];
          break;
        case 'resolve_dependency':
          const dep = action.parameters;
          if (dep?.from && dep?.to) {
            if (!plan.dependencies[dep.from]) {
              plan.dependencies[dep.from] = [];
            }
            plan.dependencies[dep.from].push(dep.to);
          }
          break;
        case 'detect_conflict':
          const conflict = action.parameters;
          if (conflict) {
            plan.conflicts.push({
              type: 'circular',
              files: conflict.files || [],
              description: conflict.description || 'Circular dependency detected'
            });
          }
          break;
      }
    });

    return plan;
  }

  /**
   * Transform actions to frontend architecture format
   * @private
   */
  _transformFrontendArchitecture(actions, input) {
    const architecture = {
      components: [],
      componentHierarchy: {},
      stateManagement: {},
      dataFlow: {},
      styling: {},
      routing: {},
      metadata: {
        planner: 'UnifiedPlanner',
        plannedAt: Date.now(),
        complexity: input.complexity || 'medium'
      }
    };

    // Process actions to build architecture
    actions.forEach(action => {
      switch (action.type) {
        case 'create_component':
          const component = action.parameters;
          if (component) {
            architecture.components.push({
              name: component.name,
              type: component.type || 'functional',
              props: component.props || [],
              state: component.state || {},
              description: component.description || ''
            });
          }
          break;
        case 'define_state_management':
          architecture.stateManagement = action.parameters || {};
          break;
        case 'plan_data_flow':
          architecture.dataFlow = action.parameters || {};
          break;
        case 'configure_styling':
          architecture.styling = action.parameters || {};
          break;
        case 'setup_routing':
          architecture.routing = action.parameters || {};
          break;
      }
    });

    return architecture;
  }

  /**
   * Transform actions to backend architecture format
   * @private
   */
  _transformBackendArchitecture(actions, input) {
    const architecture = {
      pattern: 'layered',
      apiDesign: {},
      dataLayer: {},
      services: [],
      middleware: [],
      security: {},
      performance: {},
      metadata: {
        planner: 'UnifiedPlanner',
        plannedAt: Date.now(),
        complexity: input.complexity || 'medium'
      }
    };

    // Process actions to build architecture
    actions.forEach(action => {
      switch (action.type) {
        case 'design_api':
          architecture.apiDesign = action.parameters || {};
          break;
        case 'plan_data_layer':
          architecture.dataLayer = action.parameters || {};
          break;
        case 'create_service':
          const service = action.parameters;
          if (service) {
            architecture.services.push(service);
          }
          break;
        case 'add_middleware':
          const middleware = action.parameters;
          if (middleware) {
            architecture.middleware.push(middleware);
          }
          break;
        case 'configure_security':
          architecture.security = action.parameters || {};
          break;
        case 'optimize_performance':
          architecture.performance = action.parameters || {};
          break;
      }
    });

    return architecture;
  }

  /**
   * Transform actions to API interface format
   * @private
   */
  _transformAPIInterface(actions, input) {
    const interfaces = {
      contracts: [],
      dataTransferObjects: {},
      communication: {},
      errorHandling: {},
      authentication: {},
      pagination: {},
      fileHandling: {},
      metadata: {
        planner: 'UnifiedPlanner',
        plannedAt: Date.now(),
        apiVersion: 'v1'
      }
    };

    // Process actions to build API interfaces
    actions.forEach(action => {
      switch (action.type) {
        case 'create_contract':
          const contract = action.parameters;
          if (contract) {
            interfaces.contracts.push(contract);
          }
          break;
        case 'define_dto':
          const dto = action.parameters;
          if (dto && dto.model) {
            interfaces.dataTransferObjects[dto.model] = dto.definition;
          }
          break;
        case 'configure_communication':
          interfaces.communication = action.parameters || {};
          break;
        case 'setup_error_handling':
          interfaces.errorHandling = action.parameters || {};
          break;
        case 'configure_authentication':
          interfaces.authentication = action.parameters || {};
          break;
        case 'setup_pagination':
          interfaces.pagination = action.parameters || {};
          break;
        case 'configure_file_handling':
          interfaces.fileHandling = action.parameters || {};
          break;
      }
    });

    return interfaces;
  }

  /**
   * Transform actions to test strategy format
   * @private
   */
  _transformTestStrategy(actions, input) {
    const strategy = {
      testTypes: {
        unit: { enabled: true, coverage: 80 },
        integration: { enabled: true, coverage: 70 },
        e2e: { enabled: true, coverage: 60 }
      },
      coverageTargets: {
        overall: 80,
        unit: 80,
        integration: 70,
        e2e: 60
      },
      testEnvironment: {
        framework: 'jest',
        runner: 'jest',
        browsers: ['chrome']
      },
      testData: {
        approach: 'fixtures',
        locations: ['__tests__/fixtures'],
        mocking: true
      },
      unitTestStrategy: {
        pattern: 'isolated',
        mockExternal: true,
        testDoubles: true
      },
      integrationTestStrategy: {
        pattern: 'module-boundaries',
        testAPIs: true,
        testDatabase: true
      },
      e2eTestStrategy: {
        pattern: 'user-journeys',
        browsers: ['chrome'],
        viewport: { width: 1280, height: 720 }
      },
      metadata: {
        planner: 'UnifiedPlanner',
        plannedAt: Date.now(),
        projectType: input?.analysis?.projectType || 'general'
      }
    };

    // Process actions to build test strategy
    actions.forEach(action => {
      switch (action.type) {
        case 'analyze_test_requirements':
          strategy.requirements = action.parameters || {};
          break;
        case 'determine_test_types':
          const testTypes = action.parameters?.types || [];
          testTypes.forEach(type => {
            if (strategy.testTypes[type]) {
              strategy.testTypes[type].enabled = true;
            }
          });
          break;
        case 'plan_unit_tests':
          Object.assign(strategy.unitTestStrategy, action.parameters || {});
          break;
        case 'plan_integration_tests':
          Object.assign(strategy.integrationTestStrategy, action.parameters || {});
          break;
        case 'plan_e2e_tests':
          Object.assign(strategy.e2eTestStrategy, action.parameters || {});
          break;
        case 'define_test_coverage':
          Object.assign(strategy.coverageTargets, action.parameters || {});
          break;
        case 'plan_test_data':
          Object.assign(strategy.testData, action.parameters || {});
          break;
        case 'plan_test_environment':
          Object.assign(strategy.testEnvironment, action.parameters || {});
          break;
        case 'create_test_strategy':
          // Final strategy consolidation
          if (action.parameters) {
            Object.keys(action.parameters).forEach(key => {
              if (!strategy[key]) {
                strategy[key] = action.parameters[key];
              }
            });
          }
          break;
      }
    });

    return strategy;
  }

  /**
   * Ensure planner is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('UnifiedPlanner must be initialized before use');
    }
  }

  /**
   * Get status of the unified planner
   */
  getStatus() {
    return {
      initialized: this.initialized,
      llmClientAvailable: !!this.llmClient,
      genericPlannerAvailable: !!this.genericPlanner,
      availablePlanners: Object.keys(this.plannerConfigs),
      provider: this.config.provider
    };
  }

  /**
   * Get available planning types
   */
  getAvailablePlanningTypes() {
    return Object.keys(this.plannerConfigs);
  }

  /**
   * Check if a planning type is supported
   */
  isPlanningTypeSupported(planningType) {
    return this.plannerConfigs.hasOwnProperty(planningType);
  }
}

export { UnifiedPlanner };