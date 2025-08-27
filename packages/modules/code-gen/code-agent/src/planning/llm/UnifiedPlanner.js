/**
 * UnifiedPlanner - A single planner that replaces all specialized planning classes
 * 
 * This class uses the GenericPlanner from llm-planner package to handle all planning
 * tasks by configuring different objectives and allowable actions for each domain.
 */

import { GenericPlanner } from '@legion/llm-planner';
import { ResourceManager } from '@legion/tools-registry';

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
      ...config
    };
    
    // Accept LLM client directly or use ResourceManager
    this.llmClient = config.llmClient || null;
    this.resourceManager = config.resourceManager || (config.llmClient ? null : new ResourceManager());
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
        this.llmClient = this.resourceManager.llm-client;
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
    
    // Return null for backend-only projects
    if (analysis.projectType === 'backend') {
      return null;
    }
    
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
    console.log(`🔍 [DEBUG] _executePlanning called with planningType: ${planningType}`);
    
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
      
      // Prepare initial input data based on planning type
      const initialInputData = this._prepareInitialInputData(planningType, input);
      
      // Create planning request for GenericPlanner
      const planningRequest = {
        description: objective,
        allowableActions,
        inputs: inputNames,
        requiredOutputs: config.requiredOutputs || [],
        maxSteps: config.maxSteps || 10,
        initialInputData
      };

      // Execute planning using GenericPlanner
      console.log(`🔍 [DEBUG] About to call genericPlanner.createPlan for ${planningType}`);
      console.log(`🔍 [DEBUG] Planning request:`, JSON.stringify(planningRequest, null, 2));
      
      const plan = await this.genericPlanner.createPlan(planningRequest);
      
      console.log(`🔍 [DEBUG] genericPlanner.createPlan completed for ${planningType}`);
      
      // Transform plan to match expected output format
      console.log(`🔍 [DEBUG] About to transform plan to output for ${planningType}`);
      const result = this._transformPlanToOutput(planningType, plan, input);
      
      console.log(`🔍 [DEBUG] _executePlanning completed successfully for ${planningType}`);
      
      return result;
    } catch (error) {
      throw new Error(`Planning failed for ${planningType}: ${error.message}`);
    }
  }

  /**
   * Prepare initial input data for GenericPlanner based on planning type
   * @private
   */
  _prepareInitialInputData(planningType, input) {
    const safeInput = input || {};
    
    switch (planningType) {
      case 'requirement':
        // For requirement analysis, provide all necessary inputs
        return {
          requirements_text: safeInput.description || '',
          frontend_requirements: safeInput.requirements?.frontend || '',
          backend_requirements: safeInput.requirements?.backend || '',
          frontend_features: [],
          backend_features: [],
          project_type: '',
          complexity_level: '',
          security_analysis: {},
          architecture_suggestion: {},
          summary_text: ''
        };
      
      case 'directory':
        // Extract required values from analysis for directory planning
        const analysis = safeInput;
        return {
          project_analysis: analysis,
          project_type: analysis.projectType || 'unknown',
          complexity_level: analysis.complexity || 'medium',
          features_list: this._extractFeaturesList(analysis),
          technologies_list: this._extractTechnologiesList(analysis),
          frontend_features: analysis.components?.frontend?.features || [],
          backend_features: analysis.components?.backend?.features || [],
          // Provide initial empty project structure
          project_structure: { directories: [], files: [] },
          // Provide directory_structure as alias for project_structure
          directory_structure: { directories: [], files: [] },
          // Provide empty requirements that can be populated by actions
          directory_requirements: [],
          file_requirements: [],
          // Provide project_requirements as alias for project_analysis
          project_requirements: analysis
        };
      
      case 'dependency':
        // Extract required values for dependency planning
        const structure = safeInput.structure || {};
        const projectAnalysis = safeInput.analysis || {};
        const fileList = structure.files || [];
        
        return {
          directory_structure: structure,
          project_analysis: projectAnalysis,
          // Provide file-related inputs for dependency actions
          file_list: fileList,
          file_name: fileList.length > 0 ? fileList[0] : '',
          file_path: fileList.length > 0 ? fileList[0] : '',
          source_file: '',
          target_file: '',
          dependency_analysis: {},
          dependency_relationships: [],
          file_constraints: [],
          dependency_conflict: null,
          resolution_strategy: 'automatic',
          project_constraints: [],
          dependency_order: [],
          parallelization_requirements: {},
          dependency_structure: { files: fileList, dependencies: [] },
          project_requirements: projectAnalysis,
          // Add conflict_analysis to satisfy suggest_resolution action
          conflict_analysis: null
        };
      
      case 'frontend':
        // Extract required values for frontend architecture planning
        const frontendAnalysis = safeInput || {};
        return {
          project_analysis: frontendAnalysis,
          features_list: frontendAnalysis.components?.frontend?.features || [],
          project_requirements: frontendAnalysis,
          component_list: [],
          feature_requirements: frontendAnalysis.components?.frontend || {},
          component_requirements: frontendAnalysis.components?.frontend || {},
          complexity_level: frontendAnalysis.complexity || 'medium',
          api_requirements: frontendAnalysis.apiInterface || {},
          design_requirements: { theme: 'modern', colors: ['blue', 'white'] },
          navigation_requirements: { type: 'single-page' },
          performance_requirements: { loadTime: 3000, bundleSize: 500 },
          component_specifications: [],
          accessibility_requirements: { wcag: '2.1', level: 'AA' },
          architecture_specification: {},
          // Add missing input for actions
          component_hierarchy: {}
        };
      
      case 'backend':
        // Extract required values for backend architecture planning  
        const backendAnalysis = safeInput || {};
        return {
          project_analysis: backendAnalysis,
          features_list: backendAnalysis.components?.backend?.features || [],
          project_requirements: backendAnalysis,
          complexity_level: backendAnalysis.complexity || 'medium',
          api_requirements: backendAnalysis.apiInterface || {},
          security_requirements: backendAnalysis.security || {},
          performance_requirements: { responseTime: 200, throughput: 1000 },
          data_requirements: backendAnalysis.components?.backend?.storage || {},
          architecture_specification: {},
          // Add missing inputs for actions
          feature_requirements: backendAnalysis.components?.backend || {},
          api_style: 'REST',
          architecture_pattern: 'layered',
          service_requirements: {},
          data_layer: {},
          middleware_requirements: [],
          authentication_method: 'JWT',
          error_requirements: {},
          monitoring_requirements: {},
          deployment_requirements: {},
          infrastructure_requirements: {}
        };
      
      case 'api':
        // Extract required values for API interface planning
        const frontendArch = safeInput.frontendArchitecture || {};
        const backendArch = safeInput.backendArchitecture || {};
        return {
          frontend_architecture: frontendArch,
          backend_architecture: backendArch,
          endpoint_requirements: {},
          data_requirements: {},
          data_model: {},
          usage_context: '',
          api_style: 'REST',
          features: [],
          error_requirements: {},
          auth_requirements: {},
          security_features: [],
          list_endpoints: [],
          pagination_strategy: 'offset',
          file_features: [],
          security_requirements: {},
          search_requirements: {},
          data_models: [],
          api_interfaces: {}
        };
      
      case 'test':
        // Extract required values for test strategy planning
        const testAnalysis = safeInput.analysis || safeInput || {};
        const testProjectPlan = safeInput.projectPlan || {};
        return {
          project_analysis: testAnalysis,
          test_requirements: {},
          test_types: ['unit', 'integration', 'e2e'],
          unit_test_strategy: {},
          integration_test_strategy: {},
          e2e_test_strategy: {},
          coverage_targets: { unit: 80, integration: 70, e2e: 60 },
          test_data_strategy: {},
          test_environment: {}
        };
      
      default:
        return {};
    }
  }

  /**
   * Extract features list from analysis
   * @private
   */
  _extractFeaturesList(analysis) {
    const features = [];
    if (analysis.components?.frontend?.features) {
      features.push(...analysis.components.frontend.features);
    }
    if (analysis.components?.backend?.features) {
      features.push(...analysis.components.backend.features);
    }
    return [...new Set(features)]; // Remove duplicates
  }

  /**
   * Extract technologies list from analysis
   * @private
   */
  _extractTechnologiesList(analysis) {
    const technologies = [];
    if (analysis.components?.frontend?.technologies) {
      technologies.push(...analysis.components.frontend.technologies);
    }
    if (analysis.components?.backend?.technologies) {
      technologies.push(...analysis.components.backend.technologies);
    }
    return [...new Set(technologies)]; // Remove duplicates
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
        // For directory planning, we need project analysis and derived values
        return [
          'project_analysis',
          'project_type',
          'complexity_level',
          'features_list',
          'technologies_list',
          'frontend_features',
          'backend_features',
          'project_structure',
          'directory_structure',
          'directory_requirements',
          'file_requirements',
          'project_requirements'
        ];
      
      case 'dependency':
        // For dependency planning, we need structure and analysis plus file-specific inputs
        return [
          'directory_structure', 
          'project_analysis',
          'file_list',
          'file_name',
          'file_path',
          'source_file',
          'target_file',
          'dependency_analysis',
          'dependency_relationships',
          'file_constraints',
          'dependency_conflict',
          'resolution_strategy',
          'project_constraints',
          'dependency_order',
          'parallelization_requirements',
          'dependency_structure',
          'project_requirements'
        ];
      
      case 'frontend':
        // For frontend architecture, we need analysis and all frontend-specific inputs
        return [
          'project_analysis',
          'features_list',
          'project_requirements',
          'component_list',
          'feature_requirements',
          'component_requirements',
          'complexity_level',
          'api_requirements',
          'design_requirements',
          'navigation_requirements',
          'performance_requirements',
          'component_specifications',
          'accessibility_requirements',
          'architecture_specification'
        ];
      
      case 'backend':
        // For backend architecture, we need analysis and all backend-specific inputs
        return [
          'project_analysis',
          'features_list',
          'project_requirements',
          'complexity_level',
          'api_requirements',
          'security_requirements',
          'performance_requirements',
          'data_requirements',
          'architecture_specification'
        ];
      
      case 'api':
        // For API interface, we need architectures and all API-specific inputs
        return [
          'frontend_architecture',
          'backend_architecture',
          'endpoint_requirements',
          'data_requirements',
          'data_model',
          'usage_context',
          'api_style',
          'features',
          'error_requirements',
          'auth_requirements',
          'security_features',
          'list_endpoints',
          'pagination_strategy',
          'file_features',
          'security_requirements',
          'search_requirements',
          'data_models',
          'api_interfaces'
        ];
      
      case 'test':
        // For test strategy, we need project analysis and all test-specific inputs
        return [
          'project_analysis',
          'test_requirements',
          'test_types',
          'unit_test_strategy',
          'integration_test_strategy',
          'e2e_test_strategy',
          'coverage_targets',
          'test_data_strategy',
          'test_environment'
        ];
      
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
        const frontendResult = this._transformFrontendArchitecture(actions, input);
        // Ensure arrays are arrays
        if (frontendResult && typeof frontendResult === 'object') {
          if (!Array.isArray(frontendResult.cssStyles)) {
            frontendResult.cssStyles = [];
          }
          if (!Array.isArray(frontendResult.jsComponents)) {
            frontendResult.jsComponents = [];
          }
        }
        return frontendResult;
      
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
    
    // Determine project type from requirements
    let projectType = 'fullstack'; // default
    if (safeInput.requirements) {
      const hasBackend = !!safeInput.requirements.backend;
      const hasFrontend = !!safeInput.requirements.frontend;
      
      if (hasBackend && !hasFrontend) {
        projectType = 'backend';
      } else if (hasFrontend && !hasBackend) {
        projectType = 'frontend';
      }
    }
    
    const analysis = {
      task: safeInput.task || 'Unknown task',
      projectName: safeInput.projectName || 'generated-project',
      description: safeInput.description || '',
      projectType: projectType,
      components: {},
      complexity: 'medium',
      timestamp: Date.now()
    };

    // Process actions to build analysis
    actions.forEach(action => {
      switch (action.type) {
        case 'determine_project_type':
          // Only override if we get a valid project type
          const llmProjectType = action.parameters?.projectType || action.result?.projectType || action.parameters?.project_type || action.result?.project_type;
          if (llmProjectType && ['frontend', 'backend', 'fullstack'].includes(llmProjectType)) {
            analysis.projectType = llmProjectType;
          }
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
    // Initialize architecture in the format expected by GenerationPhase
    const architecture = {
      htmlStructure: {
        title: input.projectName || 'Generated App',
        sections: [],
        head: {
          links: [{ rel: 'stylesheet', href: 'styles.css' }],
          scripts: []
        }
      },
      cssStyles: [],
      jsComponents: [],
      mainApp: null,
      // Keep original structure for reference
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
            // Add to original components array
            architecture.components.push({
              name: component.name,
              type: component.type || 'functional',
              props: component.props || [],
              state: component.state || {},
              description: component.description || ''
            });
            
            // Transform to jsComponents format expected by GenerationPhase
            if (component.name) {
              architecture.jsComponents.push({
                name: component.name,
                type: component.type === 'class' ? 'class' : 'function',
                filename: `${component.name.toLowerCase()}.js`,
                methods: component.methods || [],
                properties: component.props || [],
                description: component.description || ''
              });
            }
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
          // Transform to cssStyles format
          if (action.parameters?.styles) {
            architecture.cssStyles.push({
              filename: 'styles.css',
              rules: action.parameters.styles,
              description: 'Main stylesheet'
            });
          }
          break;
        case 'setup_routing':
          architecture.routing = action.parameters || {};
          break;
      }
    });

    // Always generate a basic HTML structure for frontend projects
    if (architecture.htmlStructure.sections.length === 0) {
      architecture.htmlStructure = {
        title: input.projectName || 'Welcome to Example2',
        sections: [
          {
            tag: 'header',
            content: {
              tag: 'h1',
              content: input.projectName || 'Example2'
            }
          },
          {
            tag: 'main',
            id: 'app',
            content: [
              {
                tag: 'section',
                class: 'welcome',
                content: [
                  { tag: 'h2', content: 'Welcome' },
                  { tag: 'p', content: 'Welcome to your application' },
                  { tag: 'div', id: 'datetime', content: 'Loading...' },
                  { tag: 'button', id: 'statusBtn', content: 'Check API Status' },
                  { tag: 'div', id: 'status', content: '' }
                ]
              }
            ]
          }
        ],
        head: {
          links: [{ rel: 'stylesheet', href: 'style.css' }],
          scripts: [{ src: 'script.js', defer: true }]
        }
      };
    }

    // If no CSS styles were specified, create default
    if (!architecture.cssStyles || !Array.isArray(architecture.cssStyles)) {
      architecture.cssStyles = [];
    }
    if (architecture.cssStyles.length === 0) {
      architecture.cssStyles.push({
        filename: 'public/style.css',
        rules: {
          body: { 
            margin: 0, 
            padding: 0, 
            fontFamily: 'Arial, sans-serif',
            backgroundColor: '#f5f5f5',
            color: '#333'
          },
          header: {
            backgroundColor: '#2196F3',
            color: 'white',
            padding: '20px',
            textAlign: 'center'
          },
          main: {
            maxWidth: '800px',
            margin: '0 auto',
            padding: '20px'
          },
          '.welcome': {
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          },
          button: {
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          },
          'button:hover': {
            backgroundColor: '#1976D2'
          }
        },
        description: 'Main stylesheet'
      });
    }

    // Always create main JavaScript files for frontend
    if (!architecture.jsComponents || !Array.isArray(architecture.jsComponents)) {
      architecture.jsComponents = [];
    }
    if (architecture.jsComponents.length === 0) {
      architecture.jsComponents.push({
        name: 'script',
        filename: 'public/script.js',
        type: 'module',
        content: `// Update date/time
function updateDateTime() {
  const now = new Date();
  document.getElementById('datetime').textContent = now.toLocaleString();
}

// Fetch API status
async function fetchStatus() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    document.getElementById('status').innerHTML = \`
      <h3>API Status</h3>
      <pre>\${JSON.stringify(data, null, 2)}</pre>
    \`;
  } catch (error) {
    document.getElementById('status').innerHTML = \`<p>Error: \${error.message}</p>\`;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Update time every second
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Add click handler
  document.getElementById('statusBtn').addEventListener('click', fetchStatus);
});`,
        description: 'Main frontend JavaScript'
      });
    }

    return architecture;
  }

  /**
   * Transform actions to backend architecture format
   * @private
   */
  _transformBackendArchitecture(actions, input) {
    // DEBUG: Log LLM response data at method entry
    console.log('🔍 [DEBUG] _transformBackendArchitecture called');
    console.log('🔍 [DEBUG] LLM actions received:', JSON.stringify(actions, null, 2));
    console.log('🔍 [DEBUG] Actions type:', typeof actions);
    console.log('🔍 [DEBUG] Actions is array:', Array.isArray(actions));
    console.log('🔍 [DEBUG] Actions length:', actions?.length);
    
    // Initialize architecture in the format expected by GenerationPhase
    const architecture = {
      // Expected by GenerationPhase
      server: null,
      routes: [],
      controllers: [],
      models: [],
      services: [],
      middleware: [],
      // Original structure
      pattern: 'layered',
      apiDesign: {},
      dataLayer: {},
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
          // Create routes from API design
          if (action.parameters?.endpoints) {
            action.parameters.endpoints.forEach(endpoint => {
              architecture.routes.push({
                name: endpoint.name || 'api',
                filename: 'routes/api.js',
                endpoints: [endpoint],
                description: `Route for ${endpoint.path || '/api'}`
              });
            });
          }
          break;
        case 'plan_data_layer':
          architecture.dataLayer = action.parameters || {};
          // Create models from data layer
          if (action.parameters?.models) {
            action.parameters.models.forEach(model => {
              architecture.models.push({
                name: model.name,
                filename: `models/${model.name}.js`,
                schema: model.schema || {},
                description: model.description || `${model.name} model`
              });
            });
          }
          break;
        case 'create_service':
          const service = action.parameters;
          if (service) {
            architecture.services.push({
              name: service.name || 'Service',
              filename: `services/${service.name || 'service'}.js`,
              methods: service.methods || [],
              description: service.description || 'Business logic service'
            });
          }
          break;
        case 'add_middleware':
          const middleware = action.parameters;
          if (middleware) {
            architecture.middleware.push({
              name: middleware.name || 'middleware',
              filename: `middleware/${middleware.name || 'middleware'}.js`,
              type: 'function',
              description: middleware.description || 'Express middleware'
            });
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

    // DEBUG: Log architecture state before .map() calls
    console.log('🔍 [DEBUG] Architecture state after processing actions:');
    console.log('🔍 [DEBUG] - middleware:', architecture.middleware, 'isArray:', Array.isArray(architecture.middleware));
    console.log('🔍 [DEBUG] - routes:', architecture.routes, 'isArray:', Array.isArray(architecture.routes));

    // Create default server configuration if none exists
    if (!architecture.server) {
      architecture.server = {
        name: 'server',
        filename: 'server.js',
        type: 'module',
        port: 3000,
        middleware: Array.isArray(architecture.middleware) ? architecture.middleware.map(m => m.name) : [],
        routes: Array.isArray(architecture.routes) ? architecture.routes.map(r => r.name) : [],
        description: 'Express server entry point',
        content: `import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import healthRoutes from './routes/health.js';
import apiRoutes from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/health', healthRoutes);
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Example2 server running on port \${PORT}\`);
});

export default app;`
      };
    }

    // Create default routes if none exist
    if (architecture.routes.length === 0) {
      architecture.routes.push(
        {
          name: 'health',
          filename: 'routes/health.js',
          type: 'module',
          content: `import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;`,
          description: 'Health check routes'
        },
        {
          name: 'api',
          filename: 'routes/api.js',
          type: 'module',
          content: `import { Router } from 'express';

const router = Router();

router.get('/status', (req, res) => {
  res.json({
    project: 'Example2',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

export default router;`,
          description: 'Main API routes'
        }
      );
    }

    // Create default middleware if none exist
    if (architecture.middleware.length === 0) {
      architecture.middleware.push(
        {
          name: 'cors',
          filename: 'middleware/cors.js',
          type: 'function',
          description: 'CORS middleware'
        },
        {
          name: 'errorHandler',
          filename: 'middleware/errorHandler.js',
          type: 'function',
          description: 'Error handling middleware'
        }
      );
    }

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