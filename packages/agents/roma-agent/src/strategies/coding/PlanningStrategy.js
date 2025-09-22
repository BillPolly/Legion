/**
 * PlanningStrategy - Wraps ProjectStructurePlanner as TaskStrategy
 * Phase 2.1: Migration from component orchestration to hierarchical task delegation
 * 
 * This strategy wraps the ProjectStructurePlanner component and implements the
 * TaskStrategy interface for proper parent→child task delegation.
 */

import { TaskStrategy } from '@legion/tasks';
import ProjectStructurePlanner from './components/ProjectStructurePlanner.js';

export default class PlanningStrategy extends TaskStrategy {
  constructor(llmClient, toolRegistry, options = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.options = {
      outputFormat: 'json',
      validateResults: true,
      ...options
    };
    
    // Lazy initialization - component created on first use
    this.projectPlanner = null;
  }
  
  getName() {
    return 'Planning';
  }
  
  /**
   * Initialize the wrapped ProjectStructurePlanner component
   */
  _ensureComponentInitialized() {
    if (!this.projectPlanner) {
      if (!this.llmClient || !this.toolRegistry) {
        throw new Error('PlanningStrategy requires LLM client and ToolRegistry');
      }
      this.projectPlanner = new ProjectStructurePlanner(this.llmClient, this.toolRegistry);
    }
  }
  
  /**
   * Handle messages from parent task
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        return await this._handlePlanningRequest(message.task || parentTask);
      case 'abort':
        return { acknowledged: true, aborted: true };
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (PlanningStrategy doesn't typically create children)
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
   * Handle planning request from parent task
   */
  async _handlePlanningRequest(task) {
    try {
      console.log(`📋 PlanningStrategy handling: ${task.description}`);
      
      // Extract requirements from task
      const requirements = this._extractRequirements(task);
      if (!requirements) {
        return {
          success: false,
          result: 'No requirements found for planning'
        };
      }
      
      // Get project context
      const projectId = this._getProjectId(task);
      
      // Add conversation entry
      task.addConversationEntry('system', 
        `Planning project structure for: ${JSON.stringify(requirements)}`);
      
      // Initialize component if needed
      this._ensureComponentInitialized();
      
      // Create project plan using wrapped component
      const plan = await this.projectPlanner.createPlan(requirements, projectId);
      
      // Store planning artifacts
      task.storeArtifact(
        'project-plan',
        plan,
        `Project execution plan with ${plan.phases.length} phases`,
        'plan'
      );
      
      task.storeArtifact(
        'project-structure',
        plan.structure,
        'Project directory and file structure',
        'structure'
      );
      
      // Add conversation entry about completion
      task.addConversationEntry('system', 
        `Generated project plan with ${plan.phases.length} phases: ${plan.phases.map(p => p.phase).join(', ')}`);
      
      console.log(`✅ PlanningStrategy completed successfully`);
      
      return {
        success: true,
        result: {
          plan: plan,
          structure: plan.structure,
          phases: plan.phases.length
        },
        artifacts: ['project-plan', 'project-structure']
      };
      
    } catch (error) {
      console.error(`❌ PlanningStrategy failed: ${error.message}`);
      
      task.addConversationEntry('system', 
        `Planning failed: ${error.message}`);
      
      return {
        success: false,
        result: error.message
      };
    }
  }
  
  /**
   * Extract requirements from task artifacts or description
   */
  _extractRequirements(task) {
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
  _getProjectId(task) {
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