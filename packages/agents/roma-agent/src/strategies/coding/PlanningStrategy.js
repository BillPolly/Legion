/**
 * PlanningStrategy - Handles project planning and structure generation
 * Refactored to use EnhancedTaskStrategy and utilities
 * 
 * This strategy directly implements all project planning functionality including:
 * - Project structure generation
 * - Phase and task creation
 * - Quality gate definition
 * - Plan validation and updates
 * 
 * Now uses the new abstractions to eliminate boilerplate:
 * - EnhancedTaskStrategy for message routing and error handling
 * - ConfigBuilder for configuration setup
 * - StrategyHelpers for common operations
 */

import { EnhancedTaskStrategy } from '@legion/tasks';
import { createFromPreset } from '../utils/ConfigBuilder.js';
import { getTaskContext } from '../utils/StrategyHelpers.js';
import { PromptExecutor } from '../../utils/PromptExecutor.js';

/**
 * Create a PlanningStrategy prototype
 * Dramatically simplified using the new abstractions
 */
export function createPlanningStrategy(context = {}, options = {}) {
  // Support legacy signature for backward compatibility
  let actualContext = context;
  let actualOptions = options;
  if (arguments.length === 3) {
    // Called with old signature: (llmClient, toolRegistry, options)
    actualContext = { llmClient: arguments[0], toolRegistry: arguments[1] };
    actualOptions = arguments[2] || {};
  } else if (arguments.length === 2 && arguments[1] && !arguments[1].llmClient && !arguments[1].toolRegistry) {
    // Second arg is options, not toolRegistry
    if (context.llmClient || context.toolRegistry) {
      actualOptions = arguments[1];
    } else {
      // Old signature: (llmClient, toolRegistry)
      actualContext = { llmClient: arguments[0], toolRegistry: arguments[1] };
      actualOptions = {};
    }
  }
  
  // Create strategy inheriting from EnhancedTaskStrategy (which has built-in patterns)
  const strategy = Object.create(EnhancedTaskStrategy);
  
  // Build configuration using ConfigBuilder preset
  const config = createFromPreset('planning', {
    context: actualContext,
    options: actualOptions
  });
  
  // Add PromptExecutor to config
  config.promptExecutor = new PromptExecutor(actualContext);
  
  // Add planning-specific templates to config
  config.templates = {
    api: getAPITemplate(),
    cli: getCLITemplate(),
    webapp: getWebAppTemplate(),
    library: getLibraryTemplate()
  };
  
  // Store dependencies in strategy for access
  strategy.config = config;
  
  /**
   * Override doWork - the only method we need to implement
   * EnhancedTaskStrategy handles all the message routing and error boundaries
   */
  strategy.doWork = async function doWork(senderTask, message) {
    // Extract task context
    const taskContext = getTaskContext(this);
    
    // Perform the planning
    const result = await performPlanning(taskContext, this, config);
    
    // Complete with artifacts using built-in helper
    this.completeWithArtifacts({
      'project-plan': {
        value: result.plan,
        description: `Project execution plan with ${result.plan.phases.length} phases`,
        type: 'plan'
      },
      'project-structure': {
        value: result.plan.structure,
        description: 'Project directory and file structure',
        type: 'structure'
      }
    }, result);
  };
  
  return strategy;
}

// Export default for backward compatibility
export default createPlanningStrategy;

// ============================================================================
// Internal implementation functions
// These work with the task instance and strategy config
// ============================================================================
  
/**
 * Perform planning using simplified approach
 * All the error handling and parent notification is handled by EnhancedTaskStrategy
 */
async function performPlanning(taskContext, task, config) {
  console.log(`📋 PlanningStrategy handling: ${taskContext.description}`);
  
  // Extract requirements from task
  const requirements = extractRequirements(task);
  if (!requirements) {
    throw new Error('No requirements found for planning');
  }
  
  // Get project context
  const projectId = getProjectId(task);
  
  // Add conversation entry
  task.addConversationEntry('system', 
    `Planning project structure for: ${JSON.stringify(requirements)}`);
  
  // Initialize if needed
  await initializePlanning(config, task);
  
  // Create project plan directly
  const plan = await createPlan.call(task, requirements, projectId, config);
  
  // Add conversation entry about completion
  task.addConversationEntry('system', 
    `Generated project plan with ${plan.phases.length} phases: ${plan.phases.map(p => p.phase).join(', ')}`);
  
  console.log(`✅ PlanningStrategy completed successfully`);
  
  return {
    success: true,
    plan: plan,
    phases: plan.phases.length
  };
}
  
/**
 * Initialize strategy if needed
 */
async function initializePlanning(config, task) {
  if (config.initialized) return;
  
  const llmClient = config.llmClient || (task.lookup ? task.lookup('llmClient') : task.llmClient);
  const toolRegistry = config.toolRegistry || (task.lookup ? task.lookup('toolRegistry') : task.toolRegistry);
  
  if (!llmClient || !toolRegistry) {
    throw new Error('PlanningStrategy requires LLM client and ToolRegistry');
  }
  
  config.initialized = true;
}

/**
 * Extract requirements from task artifacts or description
 */
function extractRequirements(task) {
    // First try to get requirements from artifacts
    const artifacts = task.getAllArtifacts ? task.getAllArtifacts() : {};
    
    // Look for requirements analysis artifact
    if (artifacts['requirements-analysis']) {
      return artifacts['requirements-analysis'].content;
    }
    
    // Look for other requirement artifacts
    if (artifacts['requirements']) {
      return artifacts['requirements'].content;
    }
    
    // Look for project-requirements
    if (artifacts['project-requirements']) {
      return artifacts['project-requirements'].content;
    }
    
    // Fallback to task description if no specific requirements found
    if (task.description && task.description.trim()) {
      // Try to parse description as requirements object
      try {
        return JSON.parse(task.description);
      } catch {
        // Return basic requirements structure from description
        return {
          type: 'api', // Default type
          description: task.description,
          features: [],
          constraints: [],
          technologies: []
        };
      }
    }
    
    return null;
  }
  
/**
 * Extract project ID from task context
 */
function getProjectId(task) {
    // Try to get from task
    if (task.projectId) {
      return task.projectId;
    }
    
    // Try to get from task ID
    if (task.id) {
      return `project-for-${task.id}`;
    }
    
    // Generate unique project ID
    return `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
/**
 * Get context information from task for planning
 */
function getContextFromTask(task) {
    const context = {
      taskId: task.id,
      description: task.description,
      workspaceDir: task.workspaceDir
    };
    
    // Add any existing artifacts as context
    if (task.getAllArtifacts) {
      const artifacts = task.getAllArtifacts();
      context.existingArtifacts = Object.keys(artifacts);
    }
    
    // Add conversation history for context
    if (task.getConversationContext) {
      context.conversationHistory = task.getConversationContext();
    }
    
    return context;
  }

  // ==========================================
  // Methods absorbed from ProjectStructurePlanner
  // ==========================================

/**
 * Create a comprehensive project plan
 * Called with task as 'this' context
 */
async function createPlan(requirements, projectId = null, config) {
    const projectType = requirements.type || 'api';
    const template = config.templates[projectType] || config.templates.api;
    
    // Generate structure
    const structure = await generateStructure(requirements, template);
    
    // Create execution phases
    const phases = await createPhases(requirements, structure, template);
    
    // Create the complete plan
    const plan = {
      projectId: projectId || `project-${Date.now()}`,
      name: requirements.name || 'New Project',
      description: requirements.description || '',
      type: projectType,
      structure: structure,
      phases: phases,
      technologies: requirements.technologies || [],
      dependencies: extractDependencies(requirements),
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        estimatedDuration: estimateDuration(phases),
        totalTasks: countTasks(phases)
      }
    };
    
    // Validate the plan
    const validation = validatePlan(plan);
    if (!validation.valid) {
      throw new Error(`Invalid plan: ${validation.errors.join(', ')}`);
    }
    
    return plan;
  }

/**
 * Generate project structure
 */
async function generateStructure(requirements, template) {
    // Use template as base
    const structure = JSON.parse(JSON.stringify(template.structure));
    
    // Customize based on requirements
    if (requirements.features) {
      for (const feature of requirements.features) {
        addFeatureToStructure(structure, feature);
      }
    }
    
    // Add test structure if testing is required
    if (requirements.testing !== false) {
      addTestStructure(structure);
    }
    
    // Add documentation structure
    if (requirements.documentation !== false) {
      addDocumentationStructure(structure);
    }
    
    return structure;
  }

/**
 * Create execution phases
 */
async function createPhases(requirements, structure, template) {
    const phases = [];
    
    // Phase 1: Setup
    phases.push(createSetupPhase(requirements, structure));
    
    // Phase 2: Core Implementation
    phases.push(createImplementationPhase(requirements, structure, template));
    
    // Phase 3: Testing (if required)
    if (requirements.testing !== false) {
      phases.push(createTestingPhase(requirements, structure));
    }
    
    // Phase 4: Documentation
    if (requirements.documentation !== false) {
      phases.push(createDocumentationPhase(requirements));
    }
    
    // Phase 5: Deployment (if required)
    if (requirements.deployment) {
      phases.push(createDeploymentPhase(requirements));
    }
    
    return phases;
  }

/**
 * Create setup phase
 */
function createSetupPhase(requirements, structure) {
    return {
      phase: 'Setup',
      description: 'Initialize project structure and dependencies',
      tasks: [
        {
          id: 'create-structure',
          name: 'Create directory structure',
          type: 'structure',
          data: {
            directories: structure.directories
          }
        },
        {
          id: 'init-project',
          name: 'Initialize project',
          type: 'initialization',
          data: {
            packageManager: requirements.packageManager || 'npm',
            projectName: requirements.name
          }
        },
        {
          id: 'install-dependencies',
          name: 'Install dependencies',
          type: 'dependencies',
          data: {
            dependencies: extractDependencies(requirements)
          }
        }
      ],
      qualityGates: [
        {
          name: 'Structure created',
          type: 'validation',
          criteria: 'All directories exist'
        },
        {
          name: 'Dependencies installed',
          type: 'validation',
          criteria: 'All dependencies resolved'
        }
      ]
    };
  }

/**
 * Create implementation phase
 */
function createImplementationPhase(requirements, structure, template) {
    const tasks = [];
    
    // Create tasks for each file in the structure
    for (const file of structure.files) {
      if (!file.path.includes('test') && !file.path.includes('spec')) {
        tasks.push({
          id: `impl-${sanitizeId(file.path)}`,

          name: `Implement ${file.path}`,
          type: 'implementation',
          data: {
            file: file.path,
            description: file.description,
            template: file.template
          }
        });
      }
    }
    
    return {
      phase: 'Core Implementation',
      description: 'Implement core functionality',
      tasks: tasks,
      qualityGates: [
        {
          name: 'Code quality',
          type: 'linting',
          criteria: 'No linting errors'
        },
        {
          name: 'Build successful',
          type: 'build',
          criteria: 'Project builds without errors'
        }
      ]
    };
  }

/**
 * Create testing phase
 */
function createTestingPhase(requirements, structure) {
    const tasks = [];
    
    // Create test tasks for implementation files
    for (const file of structure.files) {
      if (!file.path.includes('test') && !file.path.includes('spec') && 
          (file.path.endsWith('.js') || file.path.endsWith('.ts'))) {
        const testFile = file.path.replace(/\.(js|ts)$/, '.test.$1');
        tasks.push({
          id: `test-${sanitizeId(file.path)}`,

          name: `Create tests for ${file.path}`,
          type: 'testing',
          data: {
            sourceFile: file.path,
            testFile: testFile
          }
        });
      }
    }
    
    return {
      phase: 'Testing',
      description: 'Implement comprehensive tests',
      tasks: tasks,
      qualityGates: [
        {
          name: 'Test coverage',
          type: 'coverage',
          criteria: 'Minimum 80% coverage'
        },
        {
          name: 'All tests pass',
          type: 'testing',
          criteria: 'All tests passing'
        }
      ]
    };
  }

/**
 * Create documentation phase
 */
function createDocumentationPhase(requirements) {
    return {
      phase: 'Documentation',
      description: 'Create project documentation',
      tasks: [
        {
          id: 'create-readme',
          name: 'Create README',
          type: 'documentation',
          data: {
            sections: ['Overview', 'Installation', 'Usage', 'API', 'Contributing']
          }
        },
        {
          id: 'create-api-docs',
          name: 'Generate API documentation',
          type: 'documentation',
          data: {
            format: 'markdown'
          }
        }
      ],
      qualityGates: [
        {
          name: 'README complete',
          type: 'validation',
          criteria: 'README has all sections'
        }
      ]
    };
  }

/**
 * Create deployment phase
 */
function createDeploymentPhase(requirements) {
    return {
      phase: 'Deployment',
      description: 'Deploy to production',
      tasks: [
        {
          id: 'build-production',
          name: 'Build for production',
          type: 'build',
          data: {
            environment: 'production'
          }
        },
        {
          id: 'deploy',
          name: 'Deploy to server',
          type: 'deployment',
          data: {
            platform: requirements.deployment.platform || 'aws',
            environment: requirements.deployment.environment || 'production'
          }
        }
      ],
      qualityGates: [
        {
          name: 'Production build',
          type: 'build',
          criteria: 'Build successful'
        },
        {
          name: 'Deployment successful',
          type: 'deployment',
          criteria: 'Application accessible'
        }
      ]
    };
  }

/**
 * Add feature to structure
 */
function addFeatureToStructure(structure, feature) {
    const featureName = feature.name || feature;
    const featureDir = `src/features/${featureName}`;
    
    // Add feature directory
    if (!structure.directories.includes(featureDir)) {
      structure.directories.push(featureDir);
    }
    
    // Add feature files
    structure.files.push({
      path: `${featureDir}/index.js`,
      description: `${featureName} feature entry point`,
      template: 'feature'
    });
    
    structure.files.push({
      path: `${featureDir}/${featureName}.js`,
      description: `${featureName} implementation`,
      template: 'feature'
    });
  }

/**
 * Add test structure
 */
function addTestStructure(structure) {
    if (!structure.directories.includes('tests')) {
      structure.directories.push('tests');
      structure.directories.push('tests/unit');
      structure.directories.push('tests/integration');
    }
    
    // Add test configuration
    structure.files.push({
      path: 'jest.config.js',
      description: 'Jest configuration',
      template: 'config'
    });
  }

/**
 * Add documentation structure
 */
function addDocumentationStructure(structure) {
    if (!structure.directories.includes('docs')) {
      structure.directories.push('docs');
    }
    
    structure.files.push({
      path: 'README.md',
      description: 'Project documentation',
      template: 'documentation'
    });
    
    structure.files.push({
      path: 'docs/API.md',
      description: 'API documentation',
      template: 'documentation'
    });
  }

/**
 * Extract dependencies from requirements
 */
function extractDependencies(requirements) {
    const dependencies = requirements.dependencies || {};
    
    // Add framework dependencies based on type
    if (requirements.type === 'api') {
      dependencies.express = '^4.18.0';
      dependencies.cors = '^2.8.5';
    } else if (requirements.type === 'webapp') {
      dependencies.react = '^18.2.0';
      dependencies['react-dom'] = '^18.2.0';
    }
    
    // Add technology-specific dependencies
    if (requirements.technologies) {
      for (const tech of requirements.technologies) {
        if (tech === 'mongodb') {
          dependencies.mongoose = '^7.0.0';
        } else if (tech === 'postgres') {
          dependencies.pg = '^8.11.0';
        }
      }
    }
    
    return dependencies;
  }

/**
 * Validate plan
 */
function validatePlan(plan) {
    const errors = [];
    
    if (!plan.projectId) {
      errors.push('Missing project ID');
    }
    
    if (!plan.structure || !plan.structure.directories) {
      errors.push('Missing project structure');
    }
    
    if (!plan.phases || plan.phases.length === 0) {
      errors.push('Missing execution phases');
    }
    
    // Validate each phase
    plan.phases?.forEach((phase, index) => {
      if (!phase.phase) {
        errors.push(`Phase ${index} missing name`);
      }
      if (!phase.tasks || phase.tasks.length === 0) {
        errors.push(`Phase ${phase.phase || index} has no tasks`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

/**
 * Estimate duration
 */
function estimateDuration(phases) {
    let totalMinutes = 0;
    phases.forEach(phase => {
      totalMinutes += phase.tasks.length * 15; // 15 minutes per task estimate
    });
    return `${Math.round(totalMinutes / 60)} hours`;
  }

/**
 * Count tasks
 */
function countTasks(phases) {
    return phases.reduce((total, phase) => total + phase.tasks.length, 0);
  }

/**
 * Sanitize ID
 */
function sanitizeId(path) {
    return path.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  }

  // ==========================================
  // Project Templates
  // ==========================================

function getAPITemplate() {
    return {
      structure: {
        directories: [
          'src',
          'src/routes',
          'src/controllers',
          'src/services',
          'src/models',
          'src/middleware',
          'src/utils',
          'config'
        ],
        files: [
          {
            path: 'src/index.js',
            description: 'Main application entry point',
            template: 'api-server'
          },
          {
            path: 'src/app.js',
            description: 'Express application setup',
            template: 'express-app'
          },
          {
            path: 'src/routes/index.js',
            description: 'Route definitions',
            template: 'routes'
          },
          {
            path: 'package.json',
            description: 'Package configuration',
            template: 'package'
          },
          {
            path: '.env.example',
            description: 'Environment variables template',
            template: 'env'
          }
        ]
      }
    };
  }

function getCLITemplate() {
    return {
      structure: {
        directories: [
          'src',
          'src/commands',
          'src/utils',
          'bin'
        ],
        files: [
          {
            path: 'bin/cli.js',
            description: 'CLI entry point',
            template: 'cli-entry'
          },
          {
            path: 'src/index.js',
            description: 'Main CLI logic',
            template: 'cli-main'
          },
          {
            path: 'package.json',
            description: 'Package configuration',
            template: 'package'
          }
        ]
      }
    };
  }

function getWebAppTemplate() {
    return {
      structure: {
        directories: [
          'src',
          'src/components',
          'src/pages',
          'src/services',
          'src/utils',
          'public'
        ],
        files: [
          {
            path: 'src/index.js',
            description: 'Application entry point',
            template: 'react-entry'
          },
          {
            path: 'src/App.js',
            description: 'Main App component',
            template: 'react-app'
          },
          {
            path: 'public/index.html',
            description: 'HTML template',
            template: 'html'
          },
          {
            path: 'package.json',
            description: 'Package configuration',
            template: 'package'
          }
        ]
      }
    };
  }

function getLibraryTemplate() {
    return {
      structure: {
        directories: [
          'src',
          'src/lib',
          'examples'
        ],
        files: [
          {
            path: 'src/index.js',
            description: 'Library entry point',
            template: 'library-entry'
          },
          {
            path: 'package.json',
            description: 'Package configuration',
            template: 'package'
          },
          {
            path: 'README.md',
            description: 'Library documentation',
            template: 'documentation'
          }
        ]
      }
    };
  }