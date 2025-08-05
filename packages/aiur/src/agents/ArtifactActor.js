import { Actor } from '../../../shared/actors/src/Actor.js';
import { ArtifactDetector } from './artifacts/ArtifactDetector.js';
import { ArtifactManager } from './artifacts/ArtifactManager.js';

/**
 * ArtifactActor - Manages artifact lifecycle: detection, curation, and storage
 * 
 * This actor is responsible for:
 * 1. Detecting artifacts from tool execution results
 * 2. Using LLM to curate artifacts (assign labels, descriptions, filter)
 * 3. Storing curated artifacts in the registry
 */
export class ArtifactActor extends Actor {
  constructor(config = {}) {
    super();
    
    // Actor identification
    this.id = `artifact-actor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sessionId = config.sessionId;
    
    // Components
    this.artifactDetector = new ArtifactDetector();
    this.artifactManager = config.artifactManager || new ArtifactManager({ sessionId: this.sessionId });
    
    // LLM access for curation
    this.resourceManager = config.resourceManager;
    this.llmClient = null;
    
    // Configuration
    this.curationConfig = {
      maxArtifactsPerCuration: config.maxArtifactsPerCuration || 10,
      enableCuration: config.enableCuration !== false, // Default true
      autoLabel: config.autoLabel !== false // Default true
    };
    
    // Track artifact counts for labeling
    this.artifactCounts = {
      image: 0,
      text: 0,
      code: 0,
      document: 0,
      data: 0,
      markup: 0,
      other: 0
    };
    
    console.log(`ArtifactActor ${this.id} initialized for session ${this.sessionId}`);
  }
  
  /**
   * Initialize the ArtifactActor
   */
  async initialize() {
    if (this.resourceManager && this.curationConfig.enableCuration) {
      try {
        // Initialize LLM client for curation
        this.llmClient = await this.resourceManager.createLLMClient({
          provider: 'anthropic',
          model: 'claude-3-haiku-20240307', // Use fast model for curation
          maxRetries: 2
        });
      } catch (error) {
        console.warn('ArtifactActor: Could not initialize LLM client for curation:', error);
        this.curationConfig.enableCuration = false;
      }
    }
  }
  
  /**
   * Process tool results to detect, curate, and store artifacts
   * @param {Object} params - Processing parameters
   * @param {string} params.toolName - Name of the tool that was executed
   * @param {Object} params.toolResult - Result from tool execution
   * @param {Object} params.context - Additional context (user message, etc.)
   * @returns {Promise<Object>} Processing result with artifact info
   */
  async processToolResult(params) {
    const { toolName, toolResult, context = {} } = params;
    
    try {
      // Step 1: Detect potential artifacts
      const potentialArtifacts = await this.artifactDetector.detectArtifacts(toolName, toolResult);
      
      if (potentialArtifacts.length === 0) {
        return {
          success: true,
          artifactsDetected: 0,
          artifactsStored: 0,
          artifacts: []
        };
      }
      
      console.log(`ArtifactActor: Detected ${potentialArtifacts.length} potential artifacts from ${toolName}`);
      
      // Step 2: Curate artifacts (label, describe, filter)
      let curatedArtifacts;
      if (this.curationConfig.enableCuration && this.llmClient) {
        curatedArtifacts = await this.curateArtifacts(potentialArtifacts, context);
      } else {
        // Fallback to auto-labeling
        curatedArtifacts = this.autoLabelArtifacts(potentialArtifacts);
      }
      
      // Step 3: Store curated artifacts
      const storedArtifacts = [];
      for (const artifact of curatedArtifacts) {
        const stored = this.artifactManager.registerArtifact(artifact);
        storedArtifacts.push(stored);
      }
      
      console.log(`ArtifactActor: Stored ${storedArtifacts.length} artifacts`);
      
      return {
        success: true,
        artifactsDetected: potentialArtifacts.length,
        artifactsStored: storedArtifacts.length,
        artifacts: storedArtifacts
      };
      
    } catch (error) {
      console.error('ArtifactActor: Error processing tool result:', error);
      return {
        success: false,
        error: error.message,
        artifactsDetected: 0,
        artifactsStored: 0,
        artifacts: []
      };
    }
  }
  
  /**
   * Use LLM to curate artifacts - assign labels, descriptions, and filter
   * @param {Array} artifacts - Potential artifacts to curate
   * @param {Object} context - Additional context
   * @returns {Promise<Array>} Curated artifacts
   */
  async curateArtifacts(artifacts, context) {
    // Prepare artifact summaries for LLM
    const artifactSummaries = artifacts.map((artifact, index) => {
      const preview = this.getArtifactPreview(artifact);
      return {
        index,
        type: artifact.type,
        subtype: artifact.subtype,
        title: artifact.title,
        size: artifact.size,
        preview
      };
    });
    
    // Build curation prompt
    const curationPrompt = `You are curating artifacts from tool execution. Review these artifacts and:
1. Decide which are worth keeping for future reference
2. Assign a short, memorable label (like @cat-image, @analysis-1) 
3. Write a brief description for each kept artifact

Context: ${context.userMessage || 'Tool execution'}

Artifacts to review:
${JSON.stringify(artifactSummaries, null, 2)}

Respond with JSON only:
{
  "keep": [
    {
      "index": 0,
      "label": "@example-label",
      "description": "Brief description of what this artifact contains"
    }
  ],
  "discard": [1, 2]
}`;

    try {
      const response = await this.llmClient.complete(curationPrompt, 1000);
      const curation = JSON.parse(response);
      
      // Apply curation decisions
      const curatedArtifacts = [];
      for (const keepItem of curation.keep || []) {
        const artifact = artifacts[keepItem.index];
        if (artifact) {
          artifact.label = keepItem.label;
          artifact.description = keepItem.description;
          artifact.curated = true;
          curatedArtifacts.push(artifact);
        }
      }
      
      console.log(`ArtifactActor: LLM curated ${curatedArtifacts.length} of ${artifacts.length} artifacts`);
      return curatedArtifacts;
      
    } catch (error) {
      console.warn('ArtifactActor: Curation failed, falling back to auto-label:', error);
      return this.autoLabelArtifacts(artifacts);
    }
  }
  
  /**
   * Auto-label artifacts when LLM curation is not available
   * @param {Array} artifacts - Artifacts to label
   * @returns {Array} Labeled artifacts
   */
  autoLabelArtifacts(artifacts) {
    return artifacts.map(artifact => {
      const type = artifact.type || 'other';
      const count = ++this.artifactCounts[type] || 1;
      
      artifact.label = `@${type}${count}`;
      artifact.description = artifact.title || `${type} artifact #${count}`;
      artifact.curated = false;
      
      return artifact;
    });
  }
  
  /**
   * Get a preview of artifact content for LLM
   * @param {Object} artifact - Artifact to preview
   * @returns {string} Preview text
   */
  getArtifactPreview(artifact) {
    if (artifact.preview) {
      return artifact.preview;
    }
    
    if (artifact.content) {
      const maxLength = 200;
      if (typeof artifact.content === 'string') {
        return artifact.content.substring(0, maxLength) + 
               (artifact.content.length > maxLength ? '...' : '');
      }
    }
    
    return `[${artifact.type} artifact]`;
  }
  
  /**
   * Actor receive method - handles incoming messages
   */
  async receive(payload, envelope) {
    console.log('ArtifactActor: Received message:', payload.type);
    
    switch (payload.type) {
      case 'process_tool_result':
        const result = await this.processToolResult(payload);
        // Could emit result back if needed
        break;
        
      case 'get_stats':
        const stats = this.artifactManager.getStatistics();
        // Could emit stats back
        break;
        
      default:
        console.log(`ArtifactActor: Unknown message type ${payload.type}`);
    }
  }
  
  /**
   * Get the artifact manager (registry)
   * @returns {ArtifactManager} The artifact manager instance
   */
  getArtifactManager() {
    return this.artifactManager;
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    this.llmClient = null;
    console.log(`ArtifactActor ${this.id} destroyed`);
  }
}