/**
 * PlanningStrategy - Handles project planning and structure generation
 * Uses StandardTaskStrategy to eliminate all boilerplate
 */

import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';

/**
 * Create the strategy using the ultimate abstraction
 * ALL factory and initialization boilerplate is eliminated!
 */
export const createPlanningStrategy = createTypedStrategy(
  'coding-planning',                                     // Strategy type for prompt path resolution
  ['file_write', 'directory_create'],                    // Required tools (loaded at construction)
  {                                                      // Prompt names (schemas come from YAML frontmatter)
    analyzeRequirements: 'analyzeRequirements',
    createProjectStructure: 'createProjectStructure',
    generateTaskPlan: 'generateTaskPlan',
    validatePlan: 'validatePlan'
  },
  {
    maxPhases: 5,                                        // Additional config
    defaultQualityGates: ['tests', 'linting', 'build']
  }
);

// Export default for backward compatibility
export default createPlanningStrategy;

/**
 * Core strategy implementation - the ONLY thing we need to implement!
 * All boilerplate (error handling, message routing, tool loading, etc.) is handled automatically
 */
createPlanningStrategy.doWork = async function doWork() {
  console.log(`📋 PlanningStrategy handling: ${this.description}`);
  
  // Analyze requirements using declarative prompt (schema in YAML frontmatter)
  const requirementsPrompt = this.getPrompt('analyzeRequirements');
  const requirementsResult = await requirementsPrompt.execute({
    description: this.description,
    context: this.getAllArtifacts(),
    constraints: this.config.constraints || {}
  });
  
  if (!requirementsResult.success) {
    return this.failWithError(
      new Error(`Failed to analyze requirements: ${requirementsResult.errors?.join(', ')}`),
      'Requirements analysis failed'
    );
  }
  
  const requirements = requirementsResult.data;
  this.addConversationEntry('system', `Planning ${requirements.projectType} project with ${requirements.features?.length || 0} features`);
  
  // Create project structure using declarative prompt
  const structurePrompt = this.getPrompt('createProjectStructure');
  const structureResult = await structurePrompt.execute({
    projectType: requirements.projectType,
    features: requirements.features || [],
    technology: requirements.technology || 'node.js',
    complexity: requirements.complexity || 'medium'
  });
  
  if (!structureResult.success) {
    return this.failWithError(
      new Error(`Failed to create project structure: ${structureResult.errors?.join(', ')}`),
      'Project structure creation failed'
    );
  }
  
  const structure = structureResult.data;
  
  // Generate detailed task plan using declarative prompt
  const taskPlanPrompt = this.getPrompt('generateTaskPlan');
  const taskPlanResult = await taskPlanPrompt.execute({
    requirements: requirements,
    structure: structure,
    maxPhases: this.config.maxPhases,
    qualityGates: this.config.defaultQualityGates
  });
  
  if (!taskPlanResult.success) {
    return this.failWithError(
      new Error(`Failed to generate task plan: ${taskPlanResult.errors?.join(', ')}`),
      'Task plan generation failed'
    );
  }
  
  const taskPlan = taskPlanResult.data;
  
  // Validate the complete plan using declarative prompt
  const validatePrompt = this.getPrompt('validatePlan');
  const validationResult = await validatePrompt.execute({
    requirements: requirements,
    structure: structure,
    taskPlan: taskPlan,
    feasibilityCheck: true
  });
  
  if (!validationResult.success) {
    return this.failWithError(
      new Error(`Plan validation failed: ${validationResult.errors?.join(', ')}`),
      'Generated plan did not pass validation'
    );
  }
  
  const validation = validationResult.data;
  
  // If validation suggests improvements, apply them
  if (validation.improvements && validation.improvements.length > 0) {
    this.addConversationEntry('system', `Applying ${validation.improvements.length} plan improvements`);
    // Apply improvements to the plan (simplified for this abstraction)
    taskPlan.metadata = taskPlan.metadata || {};
    taskPlan.metadata.improvements = validation.improvements;
  }
  
  // Complete with artifacts using built-in helper (handles parent notification automatically)
  const artifacts = {
    'requirements': {
      value: JSON.stringify(requirements, null, 2),
      description: `${requirements.projectType} project requirements`,
      type: 'json'
    },
    'project-structure': {
      value: JSON.stringify(structure, null, 2),
      description: 'Project directory and file structure',
      type: 'json'
    },
    'execution-plan': {
      value: JSON.stringify(taskPlan, null, 2),
      description: `Execution plan with ${taskPlan.phases?.length || 0} phases`,
      type: 'plan'
    },
    'plan-validation': {
      value: JSON.stringify(validation, null, 2),
      description: 'Plan validation results and recommendations',
      type: 'json'
    }
  };
  
  this.completeWithArtifacts(artifacts, {
    success: true,
    message: `Created execution plan for ${requirements.projectType} project`,
    projectType: requirements.projectType,
    phases: taskPlan.phases?.length || 0,
    totalTasks: taskPlan.tasks?.length || 0,
    validationScore: validation.score || 100,
    estimatedDuration: taskPlan.estimatedDuration || 'unknown'
  });
};