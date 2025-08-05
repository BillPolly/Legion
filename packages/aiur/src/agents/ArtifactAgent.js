import { Actor } from '../../../shared/actors/src/Actor.js';

/**
 * ArtifactAgent - Backend actor that handles artifact-related events
 * 
 * This actor provides the 'artifacts' interface and communicates with
 * the frontend ArtifactDebugActor for monitoring artifact creation and updates.
 */
export class ArtifactAgent extends Actor {
  constructor(config = {}) {
    super();
    
    this.sessionId = config.sessionId;
    this.artifactManager = config.artifactManager || null;
    
    // Track artifacts
    this.artifacts = new Map();
    this.artifactsByLabel = new Map();
    
    // Reference to ChatAgent for internal communication
    this.chatAgent = null;
  }
  
  /**
   * Set the ChatAgent reference for internal artifact event communication
   */
  setChatAgent(chatAgent) {
    this.chatAgent = chatAgent;
  }
  
  /**
   * Receive messages from the actor system
   */
  async receive(payload, envelope) {
    console.log('ArtifactAgent: Received message:', payload);
    
    if (payload && typeof payload === 'object') {
      switch (payload.type) {
        case 'get_artifacts':
          this.sendArtifacts();
          break;
          
        case 'clear_artifacts':
          this.clearArtifacts();
          break;
          
        case 'artifact_created':
          // Internal event from ChatAgent
          this.handleArtifactCreated(payload);
          break;
          
        case 'artifact_updated':
          // Internal event from ChatAgent
          this.handleArtifactUpdated(payload);
          break;
          
        default:
          console.warn('ArtifactAgent: Unknown message type:', payload.type);
      }
    }
  }
  
  /**
   * Handle artifact created event (from ChatAgent)
   */
  handleArtifactCreated(event) {
    const artifacts = event.artifacts || [];
    
    for (const artifact of artifacts) {
      this.artifacts.set(artifact.id, artifact);
      if (artifact.label) {
        this.artifactsByLabel.set(artifact.label, artifact.id);
      }
    }
    
    // Forward to frontend
    if (this.remoteActor) {
      this.remoteActor.receive({
        type: 'artifact_created',
        eventName: 'artifact_created',
        artifacts: artifacts,
        toolName: event.toolName,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle artifact updated event (from ChatAgent)
   */
  handleArtifactUpdated(event) {
    const artifact = event.artifact;
    
    if (artifact && artifact.id) {
      const existing = this.artifacts.get(artifact.id);
      if (existing) {
        // Update the artifact
        const updated = { ...existing, ...artifact };
        this.artifacts.set(artifact.id, updated);
        
        // Update label mapping if needed
        if (artifact.label && artifact.label !== existing.label) {
          // Remove old label mapping
          if (existing.label) {
            this.artifactsByLabel.delete(existing.label);
          }
          // Add new label mapping
          this.artifactsByLabel.set(artifact.label, artifact.id);
        }
        
        // Forward to frontend
        if (this.remoteActor) {
          this.remoteActor.receive({
            type: 'artifact_updated',
            eventName: 'artifact_updated',
            artifact: updated,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }
  
  /**
   * Send all artifacts to frontend
   */
  sendArtifacts() {
    if (this.remoteActor) {
      const artifactList = Array.from(this.artifacts.values());
      this.remoteActor.receive({
        type: 'artifacts_list',
        eventName: 'artifacts_list',
        artifacts: artifactList,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Clear all artifacts
   */
  clearArtifacts() {
    this.artifacts.clear();
    this.artifactsByLabel.clear();
    
    if (this.remoteActor) {
      this.remoteActor.receive({
        type: 'artifacts_cleared',
        eventName: 'artifacts_cleared',
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Get metadata about this actor
   */
  getMetadata() {
    return {
      type: 'ArtifactAgent',
      provides: 'artifacts',
      version: '1.0.0'
    };
  }
  
  /**
   * Clean up
   */
  destroy() {
    this.artifacts.clear();
    this.artifactsByLabel.clear();
    this.chatAgent = null;
    this.remoteActor = null;
  }
}