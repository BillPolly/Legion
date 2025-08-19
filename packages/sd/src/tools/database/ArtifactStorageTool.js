/**
 * ArtifactStorageTool - Stores artifacts in the design database
 */

import { Tool, ToolResult } from '@legion/tools-registry';
import { z } from 'zod';

export class ArtifactStorageTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'store_artifact',
      description: 'Store artifact in design database using MongoDB integration',
      inputSchema: z.object({
        artifact: z.object({
          type: z.string().describe('Artifact type (e.g., parsed_requirements, domain_model, code)'),
          data: z.any().describe('Artifact data'),
          metadata: z.any().optional().describe('Additional metadata')
        }).describe('Artifact to store'),
        projectId: z.string().describe('Project ID for organizing artifacts'),
        agentId: z.string().optional().describe('ID of agent that created this artifact'),
        toolName: z.string().optional().describe('Name of tool that generated this artifact')
      })
    });
    
    this.designDatabase = dependencies.designDatabase;
    this.resourceManager = dependencies.resourceManager;
  }

  async execute(args) {
    const { artifact, projectId, agentId, toolName } = args;
    
    try {
      this.emit('progress', { percentage: 0, status: 'Preparing artifact for storage...' });
      
      // Get database service
      const databaseService = await this.getDesignDatabase();
      
      // Enrich artifact with metadata
      const enrichedArtifact = {
        ...artifact,
        projectId,
        agentId: agentId || 'unknown-agent',
        timestamp: new Date().toISOString(),
        version: 1,
        metadata: {
          ...artifact.metadata,
          toolName: toolName || this.name,
          storedBy: 'ArtifactStorageTool',
          storageTimestamp: new Date().toISOString()
        }
      };
      
      this.emit('progress', { percentage: 30, status: 'Storing artifact in MongoDB...' });
      
      // Store using DesignDatabaseService
      const storedArtifact = await databaseService.storeArtifact(enrichedArtifact);
      
      this.emit('progress', { percentage: 80, status: 'Verifying storage...' });
      
      // Verify storage by retrieving
      const verification = await databaseService.getArtifactById(storedArtifact.id);
      if (!verification) {
        throw new Error('Artifact storage verification failed');
      }
      
      this.emit('progress', { percentage: 100, status: 'Artifact stored successfully' });
      
      return ToolResult.success({
        storedArtifact,
        id: storedArtifact.id,
        projectId,
        type: artifact.type,
        storageInfo: {
          database: 'mongodb',
          collection: 'sd_artifacts',
          verified: true,
          storageTimestamp: storedArtifact.createdAt
        }
      });
      
    } catch (error) {
      this.emit('error', { error: error.message });
      return ToolResult.failure(`Failed to store artifact: ${error.message}`);
    }
  }
  
  /**
   * Get design database service
   */
  async getDesignDatabase() {
    // Priority 1: Direct injection
    if (this.designDatabase) {
      return this.designDatabase;
    }
    
    // Priority 2: From ResourceManager
    if (this.resourceManager) {
      try {
        const sdModule = this.resourceManager.get('sdModule');
        if (sdModule && sdModule.designDatabase) {
          this.designDatabase = sdModule.designDatabase;
          return this.designDatabase;
        }
      } catch (error) {
        // Continue to error
      }
    }
    
    throw new Error('Design database not available - ensure tool is initialized with designDatabase or resourceManager');
  }
  
  /**
   * Get artifact storage statistics for a project
   */
  async getStorageStats(projectId) {
    try {
      const databaseService = await this.getDesignDatabase();
      return await databaseService.getProjectStats(projectId);
    } catch (error) {
      throw new Error(`Failed to get storage stats: ${error.message}`);
    }
  }
}