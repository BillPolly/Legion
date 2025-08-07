import { Actor } from '/Legion/shared/actors/src/Actor.js';

/**
 * ArtifactDebugActor - Frontend actor for monitoring artifacts
 * 
 * Receives artifact events from the backend and maintains a local
 * view of all artifacts for debugging purposes.
 */
export class ArtifactDebugActor extends Actor {
  constructor() {
    super();
    this.remoteAgent = null; // Reference to backend ChatAgent
    
    // Local artifact storage
    this.artifacts = new Map(); // artifactId -> artifact
    this.artifactsByLabel = new Map(); // label -> artifactId
    
    // Event handlers
    this.onArtifactCreated = null;
    this.onArtifactUpdated = null;
    this.onArtifactsCleared = null;
    
    console.log('ArtifactDebugActor: Initialized');
  }
  
  /**
   * Set the remote agent reference
   */
  setRemoteAgent(remoteAgent) {
    this.remoteAgent = remoteAgent;
    console.log('ArtifactDebugActor: Connected to remote agent');
  }
  
  /**
   * Receive messages from the backend
   * This is called by the actor system when messages arrive
   */
  async receive(payload, envelope) {
    console.log('ArtifactDebugActor: Received message:', payload.type || payload.eventName);
    
    // Handle different message types
    switch (payload.type || payload.eventName) {
      case 'artifact_created':
      case 'artifacts_detected':
        await this.handleArtifactCreated(payload);
        break;
        
      case 'artifact_updated':
        await this.handleArtifactUpdated(payload);
        break;
        
      case 'artifacts_cleared':
        await this.handleArtifactsCleared(payload);
        break;
        
      case 'artifact_list':
        await this.handleArtifactList(payload);
        break;
        
      default:
        console.log('ArtifactDebugActor: Unknown message type:', payload.type);
    }
  }
  
  /**
   * Handle artifact created event
   */
  async handleArtifactCreated(payload) {
    const artifacts = payload.artifacts || [];
    
    for (const artifact of artifacts) {
      // Store in local maps
      this.artifacts.set(artifact.id, artifact);
      
      if (artifact.label) {
        this.artifactsByLabel.set(artifact.label, artifact.id);
      }
      
      console.log(`ArtifactDebugActor: New artifact - ${artifact.label || artifact.id}: ${artifact.title}`);
    }
    
    // Notify UI
    if (this.onArtifactCreated) {
      this.onArtifactCreated(artifacts);
    }
  }
  
  /**
   * Handle artifact updated event
   */
  async handleArtifactUpdated(payload) {
    const { artifactId, updates } = payload;
    
    const artifact = this.artifacts.get(artifactId);
    if (artifact) {
      // Update local copy
      Object.assign(artifact, updates);
      
      // Update label mapping if label changed
      if (updates.label && updates.label !== artifact.label) {
        // Remove old label mapping
        if (artifact.label) {
          this.artifactsByLabel.delete(artifact.label);
        }
        // Add new label mapping
        this.artifactsByLabel.set(updates.label, artifactId);
      }
      
      console.log(`ArtifactDebugActor: Updated artifact ${artifactId}`);
      
      // Notify UI
      if (this.onArtifactUpdated) {
        this.onArtifactUpdated(artifact);
      }
    }
  }
  
  /**
   * Handle artifacts cleared event
   */
  async handleArtifactsCleared(payload) {
    this.artifacts.clear();
    this.artifactsByLabel.clear();
    
    console.log('ArtifactDebugActor: All artifacts cleared');
    
    // Notify UI
    if (this.onArtifactsCleared) {
      this.onArtifactsCleared();
    }
  }
  
  /**
   * Handle artifact list (initial sync)
   */
  async handleArtifactList(payload) {
    const artifacts = payload.artifacts || [];
    
    // Clear and rebuild local storage
    this.artifacts.clear();
    this.artifactsByLabel.clear();
    
    for (const artifact of artifacts) {
      this.artifacts.set(artifact.id, artifact);
      
      if (artifact.label) {
        this.artifactsByLabel.set(artifact.label, artifact.id);
      }
    }
    
    console.log(`ArtifactDebugActor: Synced ${artifacts.length} artifacts`);
    
    // Notify UI
    if (this.onArtifactCreated) {
      this.onArtifactCreated(artifacts);
    }
  }
  
  /**
   * Request current artifacts from backend
   */
  async requestArtifacts() {
    if (this.remoteAgent) {
      this.remoteAgent.receive({
        type: 'request_artifacts',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Get all artifacts
   */
  getAllArtifacts() {
    return Array.from(this.artifacts.values());
  }
  
  /**
   * Get artifact by ID
   */
  getArtifact(id) {
    return this.artifacts.get(id);
  }
  
  /**
   * Get artifact by label
   */
  getArtifactByLabel(label) {
    const id = this.artifactsByLabel.get(label);
    return id ? this.artifacts.get(id) : null;
  }
  
  /**
   * Clean up
   */
  destroy() {
    this.artifacts.clear();
    this.artifactsByLabel.clear();
    this.remoteAgent = null;
    this.onArtifactCreated = null;
    this.onArtifactUpdated = null;
    this.onArtifactsCleared = null;
    
    console.log('ArtifactDebugActor: Destroyed');
  }
}