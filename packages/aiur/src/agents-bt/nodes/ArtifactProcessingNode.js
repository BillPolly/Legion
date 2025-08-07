/**
 * ArtifactProcessingNode - Handles artifact detection, processing, and storage
 * 
 * Processes tool results to detect and extract artifacts for storage
 * and synchronization with frontend actors.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class ArtifactProcessingNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'artifact_processor';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.action = config.action || 'process_from_tool_result';
    this.enableAutoDetection = config.enableAutoDetection !== false;
    this.enableStorage = config.enableStorage !== false;
    this.enableSyncNotification = config.enableSyncNotification !== false;
  }

  async executeNode(context) {
    try {
      switch (this.action) {
        case 'process_from_tool_result':
          return await this.processFromToolResult(context);
        case 'detect_artifacts':
          return await this.detectArtifacts(context);
        case 'store_artifacts':
          return await this.storeArtifacts(context);
        case 'sync_with_frontend':
          return await this.syncWithFrontend(context);
        default:
          return {
            status: NodeStatus.FAILURE,
            data: { error: `Unknown artifact action: ${this.action}` }
          };
      }
    } catch (error) {
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: error.message,
          stackTrace: error.stack
        }
      };
    }
  }
  
  /**
   * Process artifacts from tool execution result
   */
  async processFromToolResult(context) {
    const toolResult = context.toolResult;
    const toolName = context.toolName;
    
    if (!toolResult || !toolName) {
      return {
        status: NodeStatus.SUCCESS,
        data: { message: 'No tool result to process' }
      };
    }
    
    // Skip processing if tool was not successful
    if (toolResult.success === false) {
      return {
        status: NodeStatus.SUCCESS,
        data: { message: 'Tool failed, skipping artifact processing' }
      };
    }
    
    try {
      // Use ArtifactActor if available
      if (context.artifactActor && context.artifactActor.processToolResult) {
        const result = await context.artifactActor.processToolResult({
          toolName: toolName,
          toolResult: toolResult,
          context: {
            userMessage: context.message?.content
          }
        });
        
        if (result.success && result.artifacts.length > 0) {
          // Store artifacts in context for other nodes
          context.artifacts = context.artifacts || {};
          for (const artifact of result.artifacts) {
            context.artifacts[artifact.id] = artifact;
          }
          
          // Send notification events
          if (this.enableSyncNotification) {
            this.emitArtifactEvents(context, 'artifacts_detected', {
              toolName: toolName,
              artifacts: result.artifacts,
              artifactsStored: result.artifactsStored
            });
          }
          
          return {
            status: NodeStatus.SUCCESS,
            data: {
              artifactsProcessed: result.artifacts.length,
              artifacts: result.artifacts,
              toolName: toolName
            }
          };
        }
      }
      
      // Fallback: basic artifact detection
      return await this.detectArtifactsBasic(context, toolResult, toolName);
      
    } catch (error) {
      console.warn(`ArtifactProcessingNode: Error processing artifacts for ${toolName}:`, error);
      
      return {
        status: NodeStatus.SUCCESS, // Don't fail the workflow for artifact errors
        data: {
          error: `Artifact processing failed: ${error.message}`,
          artifactsProcessed: 0
        }
      };
    }
  }
  
  /**
   * Basic artifact detection when ArtifactActor is not available
   */
  async detectArtifactsBasic(context, toolResult, toolName) {
    const artifacts = [];
    
    // Detect common artifact patterns
    if (toolResult.filename || toolResult.filePath) {
      // File-based artifact
      artifacts.push({
        id: `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: this.detectFileType(toolResult.filename || toolResult.filePath),
        label: this.generateLabel(toolResult.filename || toolResult.filePath),
        path: toolResult.filePath,
        filename: toolResult.filename,
        toolName: toolName,
        createdAt: new Date().toISOString()
      });
    }
    
    if (toolResult.imageData && toolName === 'generate_image') {
      // Image artifact
      artifacts.push({
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        label: `@generated_image_${artifacts.length + 1}`,
        content: toolResult.imageData,
        filename: toolResult.filename,
        toolName: toolName,
        createdAt: new Date().toISOString()
      });
    }
    
    if (artifacts.length > 0) {
      // Store in context
      context.artifacts = context.artifacts || {};
      for (const artifact of artifacts) {
        context.artifacts[artifact.id] = artifact;
      }
      
      // Send notification
      if (this.enableSyncNotification) {
        this.emitArtifactEvents(context, 'artifacts_detected', {
          toolName: toolName,
          artifacts: artifacts
        });
      }
    }
    
    return {
      status: NodeStatus.SUCCESS,
      data: {
        artifactsProcessed: artifacts.length,
        artifacts: artifacts,
        detectionMethod: 'basic'
      }
    };
  }
  
  /**
   * Detect file type from filename or path
   */
  detectFileType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return 'image';
    } else if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'rb'].includes(ext)) {
      return 'code';
    } else if (['md', 'txt', 'rtf'].includes(ext)) {
      return 'text';
    } else if (['json', 'xml', 'yaml', 'yml'].includes(ext)) {
      return 'data';
    } else if (['html', 'css'].includes(ext)) {
      return 'web';
    } else {
      return 'file';
    }
  }
  
  /**
   * Generate artifact label from filename
   */
  generateLabel(filename) {
    const baseName = filename.split('/').pop().split('.')[0];
    return `@${baseName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }
  
  /**
   * Store artifacts
   */
  async storeArtifacts(context) {
    const artifacts = context.artifacts || context.artifactsToStore;
    
    if (!artifacts || Object.keys(artifacts).length === 0) {
      return {
        status: NodeStatus.SUCCESS,
        data: { message: 'No artifacts to store' }
      };
    }
    
    // Store via artifact manager if available
    if (context.artifactManager) {
      let storedCount = 0;
      
      for (const artifact of Object.values(artifacts)) {
        try {
          context.artifactManager.storeArtifact(artifact);
          storedCount++;
        } catch (error) {
          console.warn('ArtifactProcessingNode: Failed to store artifact:', error);
        }
      }
      
      return {
        status: NodeStatus.SUCCESS,
        data: {
          artifactsStored: storedCount,
          totalArtifacts: Object.keys(artifacts).length
        }
      };
    }
    
    return {
      status: NodeStatus.SUCCESS,
      data: { message: 'No artifact manager available' }
    };
  }
  
  /**
   * Sync artifacts with frontend
   */
  async syncWithFrontend(context) {
    const artifacts = context.artifacts;
    const eventType = context.artifactEventType || 'artifact_created';
    
    if (!artifacts) {
      return {
        status: NodeStatus.SUCCESS,
        data: { message: 'No artifacts to sync' }
      };
    }
    
    this.emitArtifactEvents(context, eventType, {
      artifacts: Object.values(artifacts)
    });
    
    return {
      status: NodeStatus.SUCCESS,
      data: {
        artifactsSynced: Object.keys(artifacts).length,
        eventType: eventType
      }
    };
  }
  
  /**
   * Emit artifact-related events
   */
  emitArtifactEvents(context, eventType, data) {
    if (context.remoteActor && context.remoteActor.receive) {
      context.remoteActor.receive({
        type: eventType,
        ...data,
        sessionId: context.sessionId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Also notify artifact agent if available
    if (context.artifactAgent && context.artifactAgent.receive) {
      context.artifactAgent.receive({
        type: eventType,
        eventName: eventType,
        ...data,
        sessionId: context.sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Get metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      coordinationPattern: 'artifact_processing',
      action: this.action,
      enableAutoDetection: this.enableAutoDetection,
      enableStorage: this.enableStorage,
      enableSyncNotification: this.enableSyncNotification,
      supportsActions: [
        'process_from_tool_result',
        'detect_artifacts',
        'store_artifacts',
        'sync_with_frontend'
      ]
    };
  }
}