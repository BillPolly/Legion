/**
 * ProjectManagerAgent - Central project coordination and lifecycle management
 * Extends SDAgentBase to provide project management capabilities
 */

import { SDAgentBase } from '../../../../../modules/sd/src/agents/SDAgentBase.js';
import { ProjectState } from '../models/ProjectState.js';
import { Deliverable } from '../models/Deliverable.js';
import { AgentAssignment } from '../models/AgentAssignment.js';
import { ProjectMetrics } from '../models/ProjectMetrics.js';
import { ProjectPersistence } from '../models/ProjectPersistence.js';

export class ProjectManagerAgent extends SDAgentBase {
  constructor(config = {}) {
    super({
      ...config,
      name: 'ProjectManagerAgent',
      description: 'Central project coordination and lifecycle management'
    });

    // Project management state
    this.projects = new Map();
    this.currentProject = null;
    this.agentRegistry = new Map(); // Track available SD agents
    
    // Persistence layer
    this.persistence = new ProjectPersistence();
  }

  /**
   * Initialize new project with requirements
   * @param {Object} requirements - Project requirements
   * @returns {Promise<ProjectState>} Created project state
   */
  async initializeProject(requirements) {
    // Validate requirements
    if (!requirements.id) {
      throw new Error('Project ID is required');
    }
    if (!requirements.name) {
      throw new Error('Project name is required');
    }
    if (!requirements.description) {
      throw new Error('Project description is required');
    }

    // Check for duplicate project ID
    if (this.projects.has(requirements.id)) {
      throw new Error(`Project with ID ${requirements.id} already exists`);
    }

    // Create new project state
    const projectState = new ProjectState({
      id: requirements.id,
      name: requirements.name,
      description: requirements.description,
      phase: 'requirements',
      status: 'planning'
    });

    // Add to projects collection and persist
    this.projects.set(requirements.id, projectState);
    await this.persistence.save(projectState);
    
    // Set as current project
    this.currentProject = requirements.id;

    console.log(`📊 [ProjectManager] Initialized project: ${requirements.name} (${requirements.id})`);
    
    return projectState;
  }

  /**
   * Get project status by ID
   * @param {string} projectId - Project ID
   * @returns {Promise<ProjectState>} Project state
   */
  async getProjectStatus(projectId) {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    return project;
  }

  /**
   * Update project with new information
   * @param {string} projectId - Project ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<ProjectState>} Updated project state
   */
  async updateProject(projectId, updates) {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Apply updates
    if (updates.name !== undefined) project.name = updates.name;
    if (updates.description !== undefined) project.description = updates.description;
    if (updates.estimatedCompletion !== undefined) project.estimatedCompletion = updates.estimatedCompletion;
    
    // Update timestamp
    project.updatedAt = new Date();

    console.log(`📊 [ProjectManager] Updated project: ${projectId}`);
    
    return project;
  }

  /**
   * Add deliverable to project
   * @param {string} projectId - Project ID
   * @param {Deliverable} deliverable - Deliverable to add
   * @returns {Promise<Deliverable>} Added deliverable
   */
  async addDeliverable(projectId, deliverable) {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    project.addDeliverable(deliverable.id, deliverable);
    
    console.log(`📊 [ProjectManager] Added deliverable ${deliverable.id} to project ${projectId}`);
    
    return deliverable;
  }

  /**
   * Get list of all projects
   * @returns {Promise<Array<ProjectState>>} Array of project states
   */
  async getProjectList() {
    return Array.from(this.projects.values());
  }

  /**
   * Set current active project
   * @param {string} projectId - Project ID to set as current
   * @returns {Promise<void>}
   */
  async setCurrentProject(projectId) {
    if (!this.projects.has(projectId)) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    this.currentProject = projectId;
    console.log(`📊 [ProjectManager] Set current project: ${projectId}`);
  }

  /**
   * Get current project state
   * @returns {Promise<ProjectState|null>} Current project or null
   */
  async getCurrentProject() {
    if (!this.currentProject) {
      return null;
    }
    
    return this.projects.get(this.currentProject);
  }

  /**
   * Delete project
   * @param {string} projectId - Project ID to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteProject(projectId) {
    if (!this.projects.has(projectId)) {
      throw new Error(`Project ${projectId} not found`);
    }

    this.projects.delete(projectId);
    
    // Clear current project if this was the current one
    if (this.currentProject === projectId) {
      this.currentProject = null;
    }

    console.log(`📊 [ProjectManager] Deleted project: ${projectId}`);
    
    return true;
  }

  /**
   * Generate project summary for reporting
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Project summary
   */
  async generateProjectSummary(projectId) {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const deliverables = Array.from(project.deliverables.values());
    const completedDeliverables = deliverables.filter(d => d.isCompleted()).length;
    const inProgressDeliverables = deliverables.filter(d => d.isInProgress()).length;
    const blockedDeliverables = deliverables.filter(d => d.isBlocked()).length;

    return {
      projectId: project.id,
      projectName: project.name,
      projectDescription: project.description,
      currentPhase: project.phase,
      currentStatus: project.status,
      totalDeliverables: deliverables.length,
      completedDeliverables,
      inProgressDeliverables,
      blockedDeliverables,
      progressPercentage: project.getProgressSummary().progressPercentage,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      timelineEvents: project.timeline.length,
      activeAgents: Array.from(project.agents.values()).filter(a => a.status === 'busy').length
    };
  }

  /**
   * Get all deliverables for a project
   * @param {string} projectId - Project ID
   * @param {string} phase - Optional phase filter
   * @returns {Promise<Array<Deliverable>>} Array of deliverables
   */
  async getDeliverables(projectId, phase = null) {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const deliverables = Array.from(project.deliverables.values());
    
    if (phase) {
      return deliverables.filter(d => d.phase === phase);
    }
    
    return deliverables;
  }

  /**
   * Update deliverable status
   * @param {string} projectId - Project ID
   * @param {string} deliverableId - Deliverable ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Deliverable>} Updated deliverable
   */
  async updateDeliverable(projectId, deliverableId, updates) {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const deliverable = project.deliverables.get(deliverableId);
    if (!deliverable) {
      throw new Error(`Deliverable ${deliverableId} not found in project ${projectId}`);
    }

    // Apply updates
    if (updates.status !== undefined) deliverable.updateStatus(updates.status);
    if (updates.completion !== undefined) deliverable.updateCompletion(updates.completion);
    if (updates.assignedAgent !== undefined) deliverable.assignAgent(updates.assignedAgent);

    // Update project timestamp
    project.updatedAt = new Date();

    console.log(`📊 [ProjectManager] Updated deliverable ${deliverableId} in project ${projectId}`);
    
    return deliverable;
  }

  /**
   * Get agent statistics and status
   * @returns {Object} Agent statistics
   */
  getAgentStatistics() {
    return {
      totalProjects: this.projects.size,
      currentProject: this.currentProject,
      projectsInProgress: Array.from(this.projects.values()).filter(p => p.status === 'active').length,
      completedProjects: Array.from(this.projects.values()).filter(p => p.status === 'completed').length,
      registeredAgents: this.agentRegistry.size
    };
  }
}