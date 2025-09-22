/**
 * QualityStrategy - Wraps QualityController as TaskStrategy
 * Phase 4.1: Migration from component orchestration to hierarchical task delegation
 * 
 * This strategy wraps the QualityController component and implements the
 * TaskStrategy interface for proper parent→child task delegation.
 */

import { TaskStrategy } from '@legion/tasks';
import QualityController from './components/QualityController.js';

export default class QualityStrategy extends TaskStrategy {
  constructor(llmClient, toolRegistry, options = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.options = {
      validateResults: true,
      qualityThreshold: 7,
      requireAllPhases: true,
      ...options
    };
    
    // Lazy initialization - component created on first use
    this.qualityController = null;
  }
  
  getName() {
    return 'Quality';
  }
  
  /**
   * Initialize the wrapped QualityController component
   */
  _ensureComponentInitialized() {
    if (!this.qualityController) {
      if (!this.llmClient || !this.toolRegistry) {
        throw new Error('QualityStrategy requires LLM client and ToolRegistry');
      }
      this.qualityController = new QualityController(this.llmClient, this.toolRegistry, this.options);
    }
  }
  
  /**
   * Handle messages from parent task
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        return await this._handleValidationRequest(message.task || parentTask);
      case 'abort':
        return await this._handleAbortRequest();
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (QualityStrategy may create children for complex validation)
   */
  async onChildMessage(childTask, message) {
    const task = childTask.parent;
    if (!task) {
      throw new Error('Child task has no parent');
    }

    switch (message.type) {
      case 'completed':
        return { acknowledged: true };
      case 'failed':
        return { acknowledged: true };
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle validation request from parent task
   */
  async _handleValidationRequest(task) {
    try {
      console.log(`🔍 QualityStrategy handling: ${task.description}`);
      
      // Extract project/execution result from task
      const project = this._extractProjectData(task);
      if (!project) {
        return {
          success: false,
          result: 'No project data found for quality validation'
        };
      }
      
      // Add conversation entry
      task.addConversationEntry('system', 
        `Validating project quality with ${project.phases?.length || 0} phases`);
      
      // Initialize component if needed
      this._ensureComponentInitialized();
      
      // Validate project using wrapped component
      const validationResult = await this._validateProject(project, task);
      
      // Store validation artifacts
      task.storeArtifact(
        'quality-validation',
        validationResult,
        `Quality validation result: ${validationResult.passed ? 'PASSED' : 'FAILED'}`,
        'validation'
      );
      
      // Store detailed quality report if available
      if (validationResult.phases && Object.keys(validationResult.phases).length > 0) {
        task.storeArtifact(
          'quality-phases-report',
          validationResult.phases,
          'Phase-by-phase quality validation report',
          'report'
        );
      }
      
      // Store issues if any found
      if (validationResult.issues && validationResult.issues.length > 0) {
        task.storeArtifact(
          'quality-issues',
          validationResult.issues,
          `${validationResult.issues.length} quality issues found`,
          'issues'
        );
      }
      
      // Add conversation entry about completion
      task.addConversationEntry('system', 
        `Quality validation completed: ${validationResult.passed ? 'PASSED' : 'FAILED'} - ${validationResult.issues?.length || 0} issues found`);
      
      console.log(`✅ QualityStrategy completed: ${validationResult.passed ? 'PASSED' : 'FAILED'}`);
      
      return {
        success: true,
        result: {
          validation: validationResult,
          passed: validationResult.passed,
          phasesValidated: Object.keys(validationResult.phases || {}).length,
          issuesFound: validationResult.issues?.length || 0
        },
        artifacts: ['quality-validation', 'quality-phases-report', 'quality-issues'].filter(artifact => {
          // Only include artifacts that were actually created
          const artifacts = task.getAllArtifacts ? task.getAllArtifacts() : {};
          return artifacts[artifact];
        })
      };
      
    } catch (error) {
      console.error(`❌ QualityStrategy failed: ${error.message}`);
      
      task.addConversationEntry('system', 
        `Quality validation failed: ${error.message}`);
      
      return {
        success: false,
        result: error.message
      };
    }
  }
  
  /**
   * Handle abort request
   */
  async _handleAbortRequest() {
    try {
      // QualityController doesn't have long-running processes to abort
      return { acknowledged: true, aborted: true };
    } catch (error) {
      console.error(`Error during abort: ${error.message}`);
      return { acknowledged: true, aborted: false, error: error.message };
    }
  }
  
  /**
   * Validate a project using the wrapped QualityController
   */
  async _validateProject(project, task) {
    try {
      // Initialize component if needed
      this._ensureComponentInitialized();
      
      // Validate project using wrapped component
      const validationResult = await this.qualityController.validateProject(project);
      
      // Add additional context-specific validation
      if (task && task.getAllArtifacts) {
        const artifacts = task.getAllArtifacts();
        
        // Check if execution artifacts are present
        if (artifacts['execution-result']) {
          const executionResult = artifacts['execution-result'].content;
          
          // Add execution-specific validation
          if (!executionResult.success) {
            validationResult.passed = false;
            validationResult.issues = validationResult.issues || [];
            validationResult.issues.push('Project execution failed');
          }
        }
        
        // Validate individual artifacts
        for (const [name, artifact] of Object.entries(artifacts)) {
          if (artifact.type === 'code' || artifact.type === 'test') {
            try {
              const artifactValidation = await this.qualityController.validateArtifact(artifact);
              if (!artifactValidation.valid) {
                validationResult.passed = false;
                validationResult.issues = validationResult.issues || [];
                validationResult.issues.push(`Artifact ${name} failed validation: ${artifactValidation.issues.join(', ')}`);
              }
            } catch (error) {
              // Continue validation even if individual artifact validation fails
              console.warn(`Failed to validate artifact ${name}: ${error.message}`);
            }
          }
        }
      }
      
      return validationResult;
      
    } catch (error) {
      console.error('Project validation failed:', error);
      return {
        passed: false,
        phases: {},
        overall: {},
        issues: [`Validation error: ${error.message}`]
      };
    }
  }
  
  /**
   * Extract project data from task artifacts or context
   */
  _extractProjectData(task) {
    // First try to get project from artifacts
    const artifacts = task.getAllArtifacts ? task.getAllArtifacts() : {};
    
    // Look for execution result artifact
    if (artifacts['execution-result']) {
      return artifacts['execution-result'].content;
    }
    
    // Look for project result
    if (artifacts['project-result']) {
      return artifacts['project-result'].content;
    }
    
    // Look for generic result artifact
    if (artifacts['result']) {
      return artifacts['result'].content;
    }
    
    // Look in task input
    if (task.input && task.input.project) {
      return task.input.project;
    }
    
    // Try to construct project from available artifacts
    if (Object.keys(artifacts).length > 0) {
      const project = {
        artifacts: [],
        phases: {}
      };
      
      // Convert artifacts to project format
      for (const [name, artifact] of Object.entries(artifacts)) {
        project.artifacts.push({
          name: name,
          path: artifact.path || name,
          content: artifact.content,
          type: artifact.type || 'unknown',
          description: artifact.description
        });
      }
      
      // Try to infer phases from artifact names
      const phaseNames = ['setup', 'core', 'features', 'testing', 'integration'];
      for (const phaseName of phaseNames) {
        const phaseArtifacts = project.artifacts.filter(a => 
          a.name.includes(phaseName) || a.description?.includes(phaseName)
        );
        
        if (phaseArtifacts.length > 0) {
          project.phases[phaseName] = {
            artifacts: phaseArtifacts,
            status: 'completed'
          };
        }
      }
      
      return project;
    }
    
    // Fallback to task description if it contains project structure
    if (task.description && task.description.trim()) {
      try {
        const parsedDescription = JSON.parse(task.description);
        if (parsedDescription.phases || parsedDescription.artifacts) {
          return parsedDescription;
        }
      } catch {
        // Not JSON, ignore
      }
    }
    
    return null;
  }
  
  /**
   * Get context information from task for validation
   */
  _getContextFromTask(task) {
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
}