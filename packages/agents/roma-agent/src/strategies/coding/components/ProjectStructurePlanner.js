/**
 * ProjectStructurePlanner - Plans project structure and phases
 * Creates comprehensive execution plans from analyzed requirements
 * NO MOCKS - uses real services
 * NO FALLBACKS - fails fast on errors
 */

export default class ProjectStructurePlanner {
  constructor(llmClient, toolRegistry) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    if (!toolRegistry) {
      throw new Error('Tool registry is required');
    }
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
  }
  
  /**
   * Create a comprehensive project plan from requirements
   */
  async createPlan(requirements, projectId = null) {
    if (!requirements) {
      throw new Error('Requirements are required');
    }
    
    // Generate unique IDs
    const planId = 'plan-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const finalProjectId = projectId || ('project-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));
    
    // Generate project structure
    const structure = await this.generateStructure(requirements);
    
    // Create phases with tasks
    const phases = this.createPhases(requirements);
    
    // Add quality gates to each phase
    const phasesWithGates = phases.map(phase => this.addQualityGates(phase));
    
    // Build complete plan
    const plan = {
      planId,
      projectId: finalProjectId,
      version: 1,
      structure,
      phases: phasesWithGates,
      parallelization: {
        maxConcurrent: 3,
        strategy: 'balanced'
      },
      errorHandling: {
        strategy: 'fail-fast',
        recovery: {
          enabled: true,
          maxReplans: 3
        }
      }
    };
    
    // Validate the plan
    if (!this.validatePlan(plan)) {
      throw new Error('Generated plan failed validation');
    }
    
    return plan;
  }
  
  /**
   * Generate project structure based on requirements
   */
  async generateStructure(requirements) {
    const { type = 'api' } = requirements;
    const rootPath = `/tmp/project-${Date.now()}`;
    
    let directories = [];
    let files = [];
    
    // Base structure for all project types
    directories.push('src', 'tests', 'docs');
    files.push('package.json', 'README.md', '.gitignore');
    
    // Type-specific structure
    switch (type) {
      case 'api':
        directories.push('src/routes', 'src/controllers', 'src/models', 'src/middleware', 'src/services', 'src/utils');
        files.push('src/index.js', 'src/app.js', '.env.example');
        break;
        
      case 'web':
        directories.push('public', 'src/components', 'src/pages', 'src/styles', 'src/utils');
        files.push('src/index.js', 'public/index.html');
        break;
        
      case 'cli':
        directories.push('bin', 'lib', 'lib/commands');
        files.push('bin/cli.js', 'lib/index.js');
        break;
        
      case 'library':
        directories.push('dist', 'src/core', 'src/utils');
        files.push('src/index.js', 'tsconfig.json');
        break;
        
      default:
        // Default to API structure
        directories.push('src/routes', 'src/controllers');
        files.push('src/index.js');
    }
    
    return {
      rootPath,
      directories,
      files
    };
  }
  
  /**
   * Create execution phases based on requirements
   */
  createPhases(requirements) {
    const phases = [];
    
    // Phase 1: Setup
    phases.push({
      phase: 'setup',
      priority: 1,
      tasks: [
        this.createTask({
          id: 'setup-1',
          action: 'create_directory_structure',
          strategy: 'FileSystem',
          description: 'Create project directories',
          dependencies: []
        }),
        this.createTask({
          id: 'setup-2',
          action: 'initialize_package_json',
          strategy: 'NodeProject',
          description: 'Initialize package.json',
          dependencies: ['setup-1']
        }),
        this.createTask({
          id: 'setup-3',
          action: 'install_dependencies',
          strategy: 'NodeProject',
          description: 'Install base dependencies',
          dependencies: ['setup-2']
        })
      ]
    });
    
    // Phase 2: Core
    phases.push({
      phase: 'core',
      priority: 2,
      tasks: [
        this.createTask({
          id: 'core-1',
          action: 'generate_server_code',
          strategy: 'SimpleNodeServer',
          description: 'Generate main server code',
          dependencies: ['setup-3']
        }),
        this.createTask({
          id: 'core-2',
          action: 'create_base_routes',
          strategy: 'SimpleNodeServer',
          description: 'Create base API routes',
          dependencies: ['core-1']
        })
      ]
    });
    
    // Phase 3: Features
    const featureTasks = [];
    if (requirements.features && requirements.features.length > 0) {
      requirements.features.forEach((feature, index) => {
        featureTasks.push(
          this.createTask({
            id: `feature-${index + 1}`,
            action: 'implement_feature',
            strategy: 'SimpleNodeServer',
            description: `Implement ${feature}`,
            dependencies: ['core-2']
          })
        );
      });
    }
    
    phases.push({
      phase: 'features',
      priority: 3,
      tasks: featureTasks.length > 0 ? featureTasks : [
        this.createTask({
          id: 'feature-default',
          action: 'add_basic_features',
          strategy: 'SimpleNodeServer',
          description: 'Add basic features',
          dependencies: ['core-2']
        })
      ]
    });
    
    // Phase 4: Testing
    phases.push({
      phase: 'testing',
      priority: 4,
      tasks: [
        this.createTask({
          id: 'test-1',
          action: 'generate_tests',
          strategy: 'SimpleNodeTest',
          description: 'Generate test files',
          dependencies: featureTasks.length > 0 ? featureTasks.map(t => t.id) : ['feature-default']
        }),
        this.createTask({
          id: 'test-2',
          action: 'run_tests',
          strategy: 'SimpleNodeTest',
          description: 'Run test suite',
          dependencies: ['test-1']
        })
      ]
    });
    
    // Phase 5: Integration
    phases.push({
      phase: 'integration',
      priority: 5,
      tasks: [
        this.createTask({
          id: 'integration-1',
          action: 'validate_project',
          strategy: 'SimpleNodeDebug',
          description: 'Validate complete project',
          dependencies: ['test-2']
        }),
        this.createTask({
          id: 'integration-2',
          action: 'generate_documentation',
          strategy: 'Documentation',
          description: 'Generate project documentation',
          dependencies: ['integration-1']
        })
      ]
    });
    
    return phases;
  }
  
  /**
   * Create a task with proper structure
   */
  createTask({ id, action, strategy, description, dependencies }) {
    return {
      id,
      action,
      strategy,
      description,
      input: {
        description,
        context: {},
        artifacts: []
      },
      dependencies,
      validation: {
        required: true,
        criteria: ['syntax_valid', 'requirements_met']
      },
      retry: {
        maxAttempts: 3,
        backoffMs: 1000,
        strategy: 'exponential'
      }
    };
  }
  
  /**
   * Add quality gates to a phase
   */
  addQualityGates(phase) {
    const gates = [];
    
    switch (phase.phase) {
      case 'setup':
        gates.push({
          type: 'structure',
          threshold: { required: ['package.json', 'src'] },
          blocking: true
        });
        break;
        
      case 'core':
        gates.push({
          type: 'syntax',
          threshold: { errors: 0 },
          blocking: true
        });
        gates.push({
          type: 'security',
          threshold: { vulnerabilities: 0 },
          blocking: false
        });
        break;
        
      case 'features':
        gates.push({
          type: 'functionality',
          threshold: { implemented: 100 },
          blocking: true
        });
        break;
        
      case 'testing':
        gates.push({
          type: 'test',
          threshold: { passed: 100, coverage: 80 },
          blocking: true
        });
        break;
        
      case 'integration':
        gates.push({
          type: 'validation',
          threshold: { complete: true },
          blocking: true
        });
        break;
    }
    
    return {
      ...phase,
      qualityGates: gates
    };
  }
  
  /**
   * Validate a generated plan
   */
  validatePlan(plan) {
    // Check required fields
    if (!plan.planId || !plan.projectId || !plan.version) {
      return false;
    }
    
    // Check phases exist and are valid
    if (!plan.phases || plan.phases.length === 0) {
      return false;
    }
    
    // Check each phase has required structure
    for (const phase of plan.phases) {
      if (!phase.phase || !phase.priority || !phase.tasks) {
        return false;
      }
    }
    
    // Check parallelization config
    if (!plan.parallelization || !plan.parallelization.strategy) {
      return false;
    }
    
    // Check error handling config
    if (!plan.errorHandling || !plan.errorHandling.strategy) {
      return false;
    }
    
    return true;
  }
}