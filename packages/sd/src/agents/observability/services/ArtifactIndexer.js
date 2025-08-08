/**
 * ArtifactIndexer - Indexes and queries artifacts from the SD design database
 */

export class ArtifactIndexer {
  constructor(databaseService) {
    this.databaseService = databaseService;
    this.artifactCache = new Map(); // Simple in-memory cache
  }

  /**
   * Get all artifacts for a project
   */
  async getAllArtifacts(projectId) {
    if (!this.databaseService) {
      return this.getMockArtifacts(projectId);
    }

    try {
      const artifacts = await this.databaseService.retrieveArtifacts('all', { projectId });
      return artifacts.results || [];
    } catch (error) {
      console.error('[ArtifactIndexer] Error retrieving artifacts:', error);
      return [];
    }
  }

  /**
   * Get recent artifacts
   */
  async getRecentArtifacts(projectId, limit = 10) {
    const artifacts = await this.getAllArtifacts(projectId);
    
    // Sort by timestamp and return most recent
    return artifacts
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get artifact by ID
   */
  async getArtifactById(artifactId) {
    // Check cache first
    if (this.artifactCache.has(artifactId)) {
      return this.artifactCache.get(artifactId);
    }

    if (!this.databaseService) {
      return null;
    }

    try {
      const artifact = await this.databaseService.retrieveArtifacts('byId', { id: artifactId });
      if (artifact) {
        this.artifactCache.set(artifactId, artifact);
      }
      return artifact;
    } catch (error) {
      console.error(`[ArtifactIndexer] Error retrieving artifact ${artifactId}:`, error);
      return null;
    }
  }

  /**
   * Get artifacts with filtering
   */
  async getArtifacts(projectId, filter = {}) {
    const allArtifacts = await this.getAllArtifacts(projectId);
    
    // Apply filters
    let filtered = allArtifacts;
    
    if (filter.type) {
      filtered = filtered.filter(a => a.type === filter.type);
    }
    
    if (filter.phase) {
      filtered = filtered.filter(a => a.methodologyPhase === filter.phase);
    }
    
    if (filter.agentType) {
      filtered = filtered.filter(a => a.agentType === filter.agentType);
    }
    
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(a => 
        a.name?.toLowerCase().includes(searchLower) ||
        a.description?.toLowerCase().includes(searchLower) ||
        a.type?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }

  /**
   * Get artifacts by type
   */
  async getArtifactsByType(projectId, type) {
    return this.getArtifacts(projectId, { type });
  }

  /**
   * Get artifact count
   */
  async getArtifactCount(projectId) {
    const artifacts = await this.getAllArtifacts(projectId);
    return artifacts.length;
  }

  /**
   * Get latest artifact
   */
  async getLatestArtifact(projectId) {
    const recent = await this.getRecentArtifacts(projectId, 1);
    return recent[0] || null;
  }

  /**
   * Get artifact type distribution
   */
  async getArtifactTypeDistribution(projectId) {
    const artifacts = await this.getAllArtifacts(projectId);
    
    const distribution = {};
    for (const artifact of artifacts) {
      const type = artifact.type || 'unknown';
      distribution[type] = (distribution[type] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * Build artifact tree structure
   */
  async buildArtifactTree(projectId) {
    const artifacts = await this.getAllArtifacts(projectId);
    
    const tree = {
      name: 'Project',
      children: []
    };
    
    // Group by phase
    const phases = {
      requirements: { name: 'Requirements', children: [] },
      domain: { name: 'Domain Model', children: [] },
      architecture: { name: 'Architecture', children: [] },
      state: { name: 'State Design', children: [] },
      tests: { name: 'Tests', children: [] },
      code: { name: 'Code', children: [] },
      validation: { name: 'Validation', children: [] }
    };
    
    for (const artifact of artifacts) {
      const node = {
        name: artifact.name || artifact.id,
        type: artifact.type,
        id: artifact.id,
        timestamp: artifact.timestamp
      };
      
      // Categorize by type
      if (artifact.type?.includes('requirement')) {
        phases.requirements.children.push(node);
      } else if (artifact.type?.includes('domain')) {
        phases.domain.children.push(node);
      } else if (artifact.type?.includes('architecture')) {
        phases.architecture.children.push(node);
      } else if (artifact.type?.includes('state')) {
        phases.state.children.push(node);
      } else if (artifact.type?.includes('test')) {
        phases.tests.children.push(node);
      } else if (artifact.type === 'code') {
        phases.code.children.push(node);
      } else if (artifact.type?.includes('validation')) {
        phases.validation.children.push(node);
      }
    }
    
    // Add non-empty phases to tree
    for (const phase of Object.values(phases)) {
      if (phase.children.length > 0) {
        tree.children.push(phase);
      }
    }
    
    return tree;
  }

  /**
   * Get artifact relationships
   */
  async getArtifactRelationships(artifactId) {
    // This would query the traceability matrix
    // For now, return empty relationships
    return {
      parents: [],
      children: [],
      related: []
    };
  }

  /**
   * Get mock artifacts for testing
   */
  getMockArtifacts(projectId) {
    return [
      {
        id: 'artifact_001',
        type: 'requirement',
        name: 'User Authentication',
        description: 'Users must be able to log in',
        projectId,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        methodologyPhase: 'requirements',
        agentType: 'RequirementsAgent'
      },
      {
        id: 'artifact_002',
        type: 'domain_entity',
        name: 'User',
        description: 'User entity with authentication',
        projectId,
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        methodologyPhase: 'domain-modeling',
        agentType: 'DomainModelingAgent'
      },
      {
        id: 'artifact_003',
        type: 'use_case',
        name: 'LoginUseCase',
        description: 'Handles user login logic',
        projectId,
        timestamp: new Date().toISOString(),
        methodologyPhase: 'architecture-design',
        agentType: 'ArchitectureAgent'
      }
    ];
  }
}