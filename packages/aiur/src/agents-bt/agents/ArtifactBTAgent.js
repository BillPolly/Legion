/**
 * ArtifactBTAgent - Behavior Tree-based Artifact Agent
 * 
 * A next-generation artifact agent built on the BT framework, providing
 * reactive artifact processing and synchronization workflows.
 */

import { BTAgentBase } from '../core/BTAgentBase.js';

export class ArtifactBTAgent extends BTAgentBase {
  constructor(config = {}) {
    super({
      ...config,
      agentType: 'artifact',
      configPath: config.configPath || 'artifact-agent.json'
    });
    
    // Artifact tracking
    this.artifacts = new Map();
    this.artifactsByLabel = new Map();
    
    // Reference to ChatAgent for internal communication
    this.chatAgent = null;
    
    console.log(`ArtifactBTAgent ${this.agentId} initialized`);
  }
  
  /**
   * Agent-specific initialization
   */
  async initializeAgent() {
    console.log(`ArtifactBTAgent ${this.agentId} initialized`);
  }
  
  /**
   * Override receive to handle common artifact requests directly
   */
  async receive(payload, envelope) {
    // Handle get_artifacts request directly
    if (payload?.type === 'get_artifacts') {
      const sessionId = payload.sessionId || payload.messageData?.sessionId;
      const artifacts = this.getAllArtifacts();
      
      return {
        type: 'artifacts_list',
        artifacts: artifacts,
        sessionId: sessionId,
        agentId: this.agentId,
        timestamp: Date.now()
      };
    }
    
    // Handle update_artifact request
    if (payload?.type === 'update_artifact') {
      const artifactId = payload.artifactId || payload.messageData?.artifactId;
      const updates = payload.updates || payload.messageData?.updates || {};
      
      const artifact = this.getArtifact(artifactId);
      if (artifact) {
        Object.assign(artifact, updates);
        this.storeArtifact(artifact);
      }
      
      return {
        type: 'artifact_updated',
        artifactId: artifactId,
        success: !!artifact,
        artifact: artifact,
        agentId: this.agentId,
        timestamp: Date.now()
      };
    }
    
    // Otherwise use parent implementation
    return super.receive(payload, envelope);
  }
  
  /**
   * Get agent-specific context for BT execution
   */
  getAgentSpecificContext(payload) {
    return {
      // Artifact storage
      artifacts: this.artifacts,
      artifactsByLabel: this.artifactsByLabel,
      
      // Artifact operations
      storeArtifact: this.storeArtifact.bind(this),
      getArtifact: this.getArtifact.bind(this),
      getAllArtifacts: this.getAllArtifacts.bind(this),
      clearArtifacts: this.clearArtifacts.bind(this),
      
      // Chat agent reference
      chatAgent: this.chatAgent,
      
      // Agent metadata
      agentType: 'artifact'
    };
  }
  
  /**
   * Store artifact
   */
  storeArtifact(artifact) {
    this.artifacts.set(artifact.id, artifact);
    if (artifact.label) {
      this.artifactsByLabel.set(artifact.label, artifact.id);
    }
    
    console.log(`ArtifactBTAgent: Stored artifact ${artifact.id} (${artifact.label || 'no label'})`);
  }
  
  /**
   * Get artifact by ID
   */
  getArtifact(id) {
    return this.artifacts.get(id);
  }
  
  /**
   * Get all artifacts
   */
  getAllArtifacts() {
    return Array.from(this.artifacts.values());
  }
  
  /**
   * Clear all artifacts
   */
  clearArtifacts() {
    const count = this.artifacts.size;
    this.artifacts.clear();
    this.artifactsByLabel.clear();
    
    console.log(`ArtifactBTAgent: Cleared ${count} artifacts`);
    return count;
  }
  
  /**
   * Set the ChatAgent reference for internal communication
   */
  setChatAgent(chatAgent) {
    this.chatAgent = chatAgent;
  }
  
  /**
   * Get default configuration for artifact agent
   */
  getDefaultConfiguration() {
    return {
      type: 'message_handler',
      name: 'ArtifactBTAgent_Workflow',
      debugMode: this.debugMode,
      routes: {
        // Artifact retrieval
        'get_artifacts': {
          type: 'sequence',
          name: 'get_artifacts_workflow',
          children: [
            {
              type: 'artifact_storage',
              action: 'get_all'
            },
            {
              type: 'response_sender',
              type: 'artifacts_list'
            }
          ]
        },
        
        'request_artifacts': {
          type: 'get_artifacts' // Alias
        },
        
        // Artifact management
        'clear_artifacts': {
          type: 'sequence',
          name: 'clear_artifacts_workflow',
          children: [
            {
              type: 'artifact_storage',
              action: 'clear_all'
            },
            {
              type: 'artifact_sync',
              action: 'notify_cleared'
            },
            {
              type: 'response_sender',
              type: 'artifacts_cleared'
            }
          ]
        },
        
        // Artifact events (from ChatAgent)
        'artifact_created': {
          type: 'sequence',
          name: 'handle_artifact_created',
          children: [
            {
              type: 'artifact_storage',
              action: 'store_multiple',
              artifacts: '{{message.artifacts}}'
            },
            {
              type: 'artifact_sync',
              action: 'notify_frontend',
              eventType: 'artifact_created'
            }
          ]
        },
        
        'artifact_updated': {
          type: 'sequence',
          name: 'handle_artifact_updated',
          children: [
            {
              type: 'artifact_storage',
              action: 'update',
              artifact: '{{message.artifact}}'
            },
            {
              type: 'artifact_sync',
              action: 'notify_frontend',
              eventType: 'artifact_updated'
            }
          ]
        }
      },
      
      // Default route
      defaultRoute: {
        type: 'sequence',
        children: [
          {
            type: 'error_handler',
            strategy: 'report'
          },
          {
            type: 'response_sender',
            type: 'error',
            content: 'Unknown artifact message type: {{messageType}}'
          }
        ]
      },
      
      // Configuration
      fallbackBehavior: 'error',
      logUnroutedMessages: true,
      
      // Artifact-specific settings
      maxArtifacts: 1000,
      enableAutoCleanup: true,
      cleanupInterval: 3600000, // 1 hour
      enableSyncNotifications: true
    };
  }
  
  /**
   * Get current agent status
   */
  getStatus() {
    const baseStatus = super.getStatus();
    
    return {
      ...baseStatus,
      artifactCount: this.artifacts.size,
      labeledArtifactCount: this.artifactsByLabel.size,
      chatAgentConnected: !!this.chatAgent
    };
  }
  
  /**
   * Get metadata about this agent
   */
  getMetadata() {
    return {
      type: 'ArtifactBTAgent',
      provides: 'artifacts',
      version: '1.0.0',
      capabilities: [
        'artifact_storage',
        'artifact_retrieval',
        'artifact_synchronization',
        'reactive_processing'
      ]
    };
  }
  
  /**
   * Clean up resources
   */
  async destroy() {
    this.clearArtifacts();
    this.chatAgent = null;
    
    await super.destroy();
    
    console.log(`ArtifactBTAgent ${this.agentId} destroyed`);
  }
}