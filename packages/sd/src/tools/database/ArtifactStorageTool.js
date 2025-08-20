/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * ArtifactStorageTool - Stores artifacts in the design database
 */

import { Tool, ToolResult } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const artifactStorageToolInputSchema = {
  type: 'object',
  properties: {
    artifact: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Artifact type'
        },
        data: {
          description: 'Artifact data'
        },
        metadata: {
          description: 'Artifact metadata'
        }
      },
      required: ['type', 'data'],
      description: 'Artifact to store'
    },
    projectId: {
      type: 'string',
      description: 'Project ID'
    }
  },
  required: ['artifact', 'projectId']
};

// Output schema as plain JSON Schema
const artifactStorageToolOutputSchema = {
  type: 'object',
  properties: {
    storedArtifact: {
      type: 'object',
      description: 'The stored artifact with metadata'
    },
    id: {
      type: 'string',
      description: 'Unique artifact ID'
    }
  },
  required: ['storedArtifact', 'id']
};

export class ArtifactStorageTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'store_artifact',
      description: 'Store artifact in design database',
      inputSchema: artifactStorageToolInputSchema,
      outputSchema: artifactStorageToolOutputSchema
    });
    
    this.designDatabase = dependencies.designDatabase;
  }

  async execute(args) {
    const { artifact, projectId } = args;
    
    try {
      this.emit('progress', { percentage: 0, status: 'Storing artifact...' });
      
      const storedArtifact = {
        ...artifact,
        id: `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        projectId,
        timestamp: new Date().toISOString(),
        version: 1
      };
      
      // In production, this would store to MongoDB
      // For now, just return the artifact with ID
      
      this.emit('progress', { percentage: 100, status: 'Artifact stored' });
      
      return ToolResult.success({
        storedArtifact,
        id: storedArtifact.id
      });
      
    } catch (error) {
      return ToolResult.failure(`Failed to store artifact: ${error.message}`);
    }
  }
}