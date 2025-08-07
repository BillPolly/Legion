/**
 * ArtifactStorageNode - Manages artifact storage and retrieval operations
 * 
 * Handles storing, retrieving, updating, and deleting artifacts
 * with support for metadata, versioning, and search capabilities.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class ArtifactStorageNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'artifact_storage';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.operation = config.operation || 'store'; // store, retrieve, update, delete, list
    this.artifactId = config.artifactId || config.id;
    this.artifactType = config.artifactType || config.type;
    this.content = config.content;
    this.label = config.label;
    this.metadata = config.metadata || {};
    this.overwrite = config.overwrite !== false;
    this.includeContent = config.includeContent !== false;
  }

  async executeNode(context) {
    try {
      // Get artifact manager from context
      const artifactManager = context.artifactManager;
      if (!artifactManager) {
        return this.createFailureResult('ArtifactManager not available in context');
      }

      // Determine operation to perform
      const operation = this.operation || context.operation || context.message?.operation;
      
      switch (operation) {
        case 'store':
          return await this.handleArtifactStore(artifactManager, context);
          
        case 'retrieve':
          return await this.handleArtifactRetrieve(artifactManager, context);
          
        case 'update':
          return await this.handleArtifactUpdate(artifactManager, context);
          
        case 'delete':
          return await this.handleArtifactDelete(artifactManager, context);
          
        case 'list':
          return await this.handleArtifactList(artifactManager, context);
          
        case 'search':
          return await this.handleArtifactSearch(artifactManager, context);
          
        default:
          return this.createFailureResult(`Unknown artifact operation: ${operation}`);
      }
      
    } catch (error) {
      return this.createFailureResult(`Artifact storage operation failed: ${error.message}`, error);
    }
  }

  /**
   * Handle artifact storage
   */
  async handleArtifactStore(artifactManager, context) {
    const artifactData = this.getArtifactData(context);
    
    if (!artifactData.content) {
      return this.createFailureResult('No content provided for artifact storage');
    }

    try {
      // Generate ID if not provided
      const artifactId = artifactData.id || this.generateArtifactId(artifactData);
      
      // Check if artifact already exists
      const existingArtifact = await this.getExistingArtifact(artifactManager, artifactId);
      if (existingArtifact && !this.overwrite) {
        return this.createFailureResult(`Artifact ${artifactId} already exists and overwrite is disabled`);
      }

      // Store the artifact
      const storedArtifact = await artifactManager.storeArtifact(artifactId, {
        type: artifactData.type || 'text',
        content: artifactData.content,
        label: artifactData.label || artifactId,
        metadata: {
          ...artifactData.metadata,
          storedAt: new Date().toISOString(),
          source: 'ArtifactStorageNode',
          version: existingArtifact ? (existingArtifact.metadata?.version || 0) + 1 : 1
        }
      });

      return this.createSuccessResult({
        operation: 'store',
        artifactId,
        artifactType: storedArtifact.type,
        size: storedArtifact.content?.length || 0,
        wasUpdate: !!existingArtifact,
        version: storedArtifact.metadata?.version
      });

    } catch (error) {
      return this.createFailureResult(`Failed to store artifact: ${error.message}`, error);
    }
  }

  /**
   * Handle artifact retrieval
   */
  async handleArtifactRetrieve(artifactManager, context) {
    const artifactId = this.artifactId || context.artifactId || context.message?.artifactId;
    
    if (!artifactId) {
      return this.createFailureResult('No artifact ID provided for retrieval');
    }

    try {
      const artifact = await artifactManager.getArtifact(artifactId);
      
      if (!artifact) {
        return this.createFailureResult(`Artifact ${artifactId} not found`);
      }

      const result = {
        operation: 'retrieve',
        artifactId,
        artifact: {
          id: artifactId,
          type: artifact.type,
          label: artifact.label,
          metadata: artifact.metadata
        }
      };

      // Include content if requested
      if (this.includeContent) {
        result.artifact.content = artifact.content;
        result.contentSize = artifact.content?.length || 0;
      }

      return this.createSuccessResult(result);

    } catch (error) {
      return this.createFailureResult(`Failed to retrieve artifact ${artifactId}: ${error.message}`, error);
    }
  }

  /**
   * Handle artifact update
   */
  async handleArtifactUpdate(artifactManager, context) {
    const artifactId = this.artifactId || context.artifactId || context.message?.artifactId;
    
    if (!artifactId) {
      return this.createFailureResult('No artifact ID provided for update');
    }

    try {
      // Get existing artifact
      const existingArtifact = await artifactManager.getArtifact(artifactId);
      if (!existingArtifact) {
        return this.createFailureResult(`Artifact ${artifactId} not found for update`);
      }

      // Prepare update data
      const updates = this.getArtifactData(context);
      const updatedArtifact = {
        type: updates.type || existingArtifact.type,
        content: updates.content !== undefined ? updates.content : existingArtifact.content,
        label: updates.label || existingArtifact.label,
        metadata: {
          ...existingArtifact.metadata,
          ...updates.metadata,
          updatedAt: new Date().toISOString(),
          version: (existingArtifact.metadata?.version || 0) + 1
        }
      };

      // Update the artifact
      await artifactManager.updateArtifact(artifactId, updatedArtifact);

      return this.createSuccessResult({
        operation: 'update',
        artifactId,
        version: updatedArtifact.metadata.version,
        updatedFields: Object.keys(updates).filter(key => updates[key] !== undefined)
      });

    } catch (error) {
      return this.createFailureResult(`Failed to update artifact ${artifactId}: ${error.message}`, error);
    }
  }

  /**
   * Handle artifact deletion
   */
  async handleArtifactDelete(artifactManager, context) {
    const artifactId = this.artifactId || context.artifactId || context.message?.artifactId;
    
    if (!artifactId) {
      return this.createFailureResult('No artifact ID provided for deletion');
    }

    try {
      // Check if artifact exists
      const artifact = await artifactManager.getArtifact(artifactId);
      if (!artifact) {
        return this.createFailureResult(`Artifact ${artifactId} not found for deletion`);
      }

      // Delete the artifact
      await artifactManager.deleteArtifact(artifactId);

      return this.createSuccessResult({
        operation: 'delete',
        artifactId,
        deletedArtifact: {
          type: artifact.type,
          label: artifact.label,
          size: artifact.content?.length || 0
        }
      });

    } catch (error) {
      return this.createFailureResult(`Failed to delete artifact ${artifactId}: ${error.message}`, error);
    }
  }

  /**
   * Handle artifact listing
   */
  async handleArtifactList(artifactManager, context) {
    try {
      const artifacts = await artifactManager.getAllArtifacts();
      
      const artifactList = artifacts.map(artifact => ({
        id: artifact.id,
        type: artifact.type,
        label: artifact.label,
        size: artifact.content?.length || 0,
        createdAt: artifact.metadata?.storedAt,
        updatedAt: artifact.metadata?.updatedAt,
        version: artifact.metadata?.version || 1
      }));

      // Apply type filter if specified
      let filteredArtifacts = artifactList;
      if (this.artifactType) {
        filteredArtifacts = artifactList.filter(a => a.type === this.artifactType);
      }

      return this.createSuccessResult({
        operation: 'list',
        artifacts: filteredArtifacts,
        totalCount: artifactList.length,
        filteredCount: filteredArtifacts.length,
        typeFilter: this.artifactType
      });

    } catch (error) {
      return this.createFailureResult(`Failed to list artifacts: ${error.message}`, error);
    }
  }

  /**
   * Handle artifact search
   */
  async handleArtifactSearch(artifactManager, context) {
    const searchQuery = context.query || context.message?.query || context.searchQuery;
    
    if (!searchQuery) {
      return this.createFailureResult('No search query provided');
    }

    try {
      const artifacts = await artifactManager.getAllArtifacts();
      
      // Perform search
      const searchResults = artifacts.filter(artifact => {
        const searchableText = [
          artifact.label,
          artifact.type,
          artifact.content,
          JSON.stringify(artifact.metadata)
        ].join(' ').toLowerCase();
        
        return searchableText.includes(searchQuery.toLowerCase());
      });

      const formattedResults = searchResults.map(artifact => ({
        id: artifact.id,
        type: artifact.type,
        label: artifact.label,
        relevance: this.calculateRelevance(artifact, searchQuery),
        snippet: this.extractSnippet(artifact.content, searchQuery)
      }));

      // Sort by relevance
      formattedResults.sort((a, b) => b.relevance - a.relevance);

      return this.createSuccessResult({
        operation: 'search',
        query: searchQuery,
        results: formattedResults,
        totalResults: formattedResults.length,
        totalArtifacts: artifacts.length
      });

    } catch (error) {
      return this.createFailureResult(`Artifact search failed: ${error.message}`, error);
    }
  }

  /**
   * Get artifact data from context and config
   */
  getArtifactData(context) {
    return {
      id: this.artifactId || context.artifactId || context.message?.artifactId,
      type: this.artifactType || context.artifactType || context.message?.type || 'text',
      content: this.content || context.content || context.message?.content,
      label: this.label || context.label || context.message?.label,
      metadata: {
        ...this.metadata,
        ...(context.metadata || {}),
        ...(context.message?.metadata || {})
      }
    };
  }

  /**
   * Get existing artifact safely
   */
  async getExistingArtifact(artifactManager, artifactId) {
    try {
      return await artifactManager.getArtifact(artifactId);
    } catch (error) {
      return null; // Artifact doesn't exist
    }
  }

  /**
   * Generate unique artifact ID
   */
  generateArtifactId(artifactData) {
    const timestamp = Date.now();
    const type = artifactData.type || 'artifact';
    const random = Math.random().toString(36).substr(2, 6);
    return `${type}_${timestamp}_${random}`;
  }

  /**
   * Calculate search relevance score
   */
  calculateRelevance(artifact, query) {
    let score = 0;
    const queryLower = query.toLowerCase();
    
    // Label matches (highest weight)
    if (artifact.label?.toLowerCase().includes(queryLower)) {
      score += 10;
    }
    
    // Type matches
    if (artifact.type?.toLowerCase().includes(queryLower)) {
      score += 5;
    }
    
    // Content matches (lower weight due to potential size)
    const contentMatches = (artifact.content?.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
    score += Math.min(contentMatches, 5); // Cap content score
    
    return score;
  }

  /**
   * Extract content snippet around search term
   */
  extractSnippet(content, query, maxLength = 150) {
    if (!content) return '';
    
    const queryIndex = content.toLowerCase().indexOf(query.toLowerCase());
    if (queryIndex === -1) {
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }
    
    const start = Math.max(0, queryIndex - 50);
    const end = Math.min(content.length, queryIndex + query.length + 100);
    
    let snippet = content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  }

  /**
   * Create success result
   */
  createSuccessResult(data) {
    return {
      status: NodeStatus.SUCCESS,
      data: {
        artifactStorage: true,
        ...data
      }
    };
  }

  /**
   * Create failure result
   */
  createFailureResult(message, error = null) {
    return {
      status: NodeStatus.FAILURE,
      data: {
        artifactStorage: false,
        error: message,
        details: error ? {
          message: error.message,
          stack: error.stack
        } : undefined
      }
    };
  }

  /**
   * Get node metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      nodeType: 'artifact_storage',
      purpose: 'Artifact lifecycle management',
      operations: ['store', 'retrieve', 'update', 'delete', 'list', 'search'],
      capabilities: [
        'artifact_storage',
        'artifact_retrieval', 
        'artifact_versioning',
        'artifact_search',
        'metadata_management'
      ]
    };
  }
}