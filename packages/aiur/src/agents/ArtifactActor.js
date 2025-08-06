import { Actor } from '../../../shared/actors/src/Actor.js';
import { ArtifactDetector } from './artifacts/ArtifactDetector.js';
import { ArtifactManager } from './artifacts/ArtifactManager.js';
import { promises as fs } from 'fs';
import path from 'path';

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
    
    // Reference to ArtifactAgent for UI notifications
    this.artifactAgent = null;
    
    // LLM access for curation
    this.resourceManager = config.resourceManager;
    this.llmClient = null;
    
    // Configuration
    this.curationConfig = {
      maxArtifactsPerCuration: config.maxArtifactsPerCuration || 10,
      enableCuration: config.enableCuration !== false, // Default true
      autoLabel: config.autoLabel !== false // Default true
    };
    
    // Removed artifactCounts - now using descriptive labels with uniqueness checks
    
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
          model: 'claude-3-5-sonnet-20241022', // Use Sonnet for curation (Haiku max_tokens too low)
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
      
      // Notify ArtifactAgent about new artifacts
      if (storedArtifacts.length > 0 && this.artifactAgent) {
        this.artifactAgent.handleArtifactCreated({
          type: 'artifact_created',
          artifacts: storedArtifacts,
          toolName: toolName,
          sessionId: this.sessionId
        });
      }
      
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
   * Assert artifacts directly - for plan execution mode where artifacts are pre-defined
   * @param {Object} params - Assertion parameters
   * @param {Array} params.artifacts - Array of artifact definitions to assert
   * @param {Object} params.context - Additional context (user message, etc.)
   * @returns {Promise<Object>} Processing result with artifact info
   */
  async assertArtifacts(params) {
    const { artifacts, context = {} } = params;
    
    try {
      if (!Array.isArray(artifacts) || artifacts.length === 0) {
        return {
          success: true,
          artifactsAsserted: 0,
          artifactsStored: 0,
          artifacts: []
        };
      }
      
      console.log(`ArtifactActor: Asserting ${artifacts.length} pre-defined artifacts`);
      
      // Process each artifact definition
      const storedArtifacts = [];
      for (const artifactDef of artifacts) {
        // Create full artifact object from definition
        const artifact = await this.createArtifactFromDefinition(artifactDef);
        if (artifact) {
          const stored = this.artifactManager.registerArtifact(artifact);
          storedArtifacts.push(stored);
        }
      }
      
      console.log(`ArtifactActor: Stored ${storedArtifacts.length} asserted artifacts`);
      
      // Notify ArtifactAgent about new artifacts
      if (storedArtifacts.length > 0 && this.artifactAgent) {
        this.artifactAgent.handleArtifactCreated({
          type: 'artifact_created',
          artifacts: storedArtifacts,
          toolName: 'plan_execution',
          sessionId: this.sessionId
        });
      }
      
      return {
        success: true,
        artifactsAsserted: artifacts.length,
        artifactsStored: storedArtifacts.length,
        artifacts: storedArtifacts
      };
      
    } catch (error) {
      console.error('ArtifactActor: Error asserting artifacts:', error);
      return {
        success: false,
        error: error.message,
        artifactsAsserted: 0,
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
      
      // Generate a unique, descriptive label (max 3 words)
      const label = this.generateDescriptiveLabel(artifact, type);
      
      // Ensure uniqueness by checking existing labels
      artifact.label = this.ensureUniqueLabel(label);
      artifact.description = artifact.title || this.generateDescription(artifact, type);
      artifact.curated = false;
      
      return artifact;
    });
  }

  /**
   * Generate a descriptive label from artifact properties
   * @param {Object} artifact - Artifact to label
   * @param {string} type - Artifact type
   * @returns {string} Descriptive label (without @)
   */
  generateDescriptiveLabel(artifact, type) {
    const words = [];
    
    // Extract meaningful words from title
    if (artifact.title) {
      const titleWords = artifact.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .split(/[\s-]+/)
        .filter(word => word.length > 2 && !['the', 'and', 'for', 'with', 'png', 'jpg', 'txt', 'pdf'].includes(word))
        .slice(0, 2);
      words.push(...titleWords);
    }
    
    // Add type-specific context
    if (words.length === 0) {
      switch (type) {
        case 'image':
          words.push(artifact.subtype === 'png' ? 'png' : 'image');
          break;
        case 'code':
          words.push(artifact.subtype || 'code');
          break;
        case 'document':
          words.push('doc');
          break;
        default:
          words.push(type);
      }
    }
    
    // Add a short unique suffix if needed
    if (words.length < 2) {
      const timestamp = Date.now().toString().slice(-4);
      words.push(timestamp);
    }
    
    // Limit to 3 words max, join with hyphens
    return words.slice(0, 3).join('-');
  }

  /**
   * Ensure label is unique by checking existing artifacts
   * @param {string} baseLabel - Base label to make unique
   * @returns {string} Unique label with @ prefix
   */
  ensureUniqueLabel(baseLabel) {
    let label = `@${baseLabel}`;
    let counter = 1;
    
    // Check if label already exists in manager
    while (this.artifactManager.getArtifactByLabel(label)) {
      counter++;
      label = `@${baseLabel}-${counter}`;
    }
    
    return label;
  }

  /**
   * Generate a description for the artifact
   * @param {Object} artifact - Artifact to describe
   * @param {string} type - Artifact type
   * @returns {string} Description
   */
  generateDescription(artifact, type) {
    if (artifact.title) {
      return artifact.title;
    }
    
    switch (type) {
      case 'image':
        return `Generated ${artifact.subtype || 'image'}`;
      case 'code':
        return `${artifact.subtype || 'Code'} file`;
      case 'document':
        return `${artifact.subtype || 'Document'} file`;
      default:
        return `${type} artifact`;
    }
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
   * Create artifact object from definition (for assertion mode)
   * @param {Object} artifactDef - Artifact definition
   * @returns {Promise<Object|null>} Full artifact object or null
   */
  async createArtifactFromDefinition(artifactDef) {
    try {
      // Required fields
      if (!artifactDef.label || !artifactDef.description) {
        console.warn('ArtifactActor: Artifact definition missing required fields (label, description)');
        return null;
      }
      
      // Create base artifact object
      const artifact = {
        id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        label: artifactDef.label,
        description: artifactDef.description,
        type: artifactDef.type || 'document',
        subtype: artifactDef.subtype || 'unknown',
        title: artifactDef.title || artifactDef.label.replace('@', ''),
        curated: true, // Asserted artifacts are considered curated
        createdBy: 'plan_execution',
        createdAt: new Date().toISOString(),
        metadata: {
          isAsserted: true,
          ...artifactDef.metadata
        }
      };
      
      // Handle file-based artifacts
      if (artifactDef.path) {
        artifact.path = artifactDef.path;
        artifact.directory = path.dirname(artifactDef.path);
        
        try {
          const stats = await fs.stat(artifactDef.path);
          artifact.exists = true;
          artifact.size = stats.size;
          artifact.metadata.modified = stats.mtime.toISOString();
          artifact.metadata.isFile = true;
          
          // Generate preview for small files
          if (stats.isFile() && stats.size < 10000) {
            try {
              const content = await fs.readFile(artifactDef.path, 'utf8');
              artifact.preview = this.generatePreview(content, artifact.type);
              if (artifactDef.includeContent) {
                artifact.content = content;
              }
            } catch (error) {
              console.debug(`Could not read file for preview: ${artifactDef.path}`);
            }
          }
        } catch (error) {
          artifact.exists = false;
          artifact.size = 0;
        }
      }
      
      // Handle content-based artifacts
      if (artifactDef.content) {
        artifact.content = artifactDef.content;
        artifact.size = artifactDef.content.length;
        artifact.exists = true;
        artifact.preview = this.generatePreview(artifactDef.content, artifact.type);
        artifact.metadata.isContent = true;
      }
      
      // Handle URL-based artifacts
      if (artifactDef.url) {
        artifact.url = artifactDef.url;
        artifact.exists = true;
        artifact.size = artifactDef.url.length;
        artifact.preview = artifactDef.url;
        artifact.metadata.isUrl = true;
      }
      
      return artifact;
    } catch (error) {
      console.warn('ArtifactActor: Error creating artifact from definition:', error);
      return null;
    }
  }
  
  /**
   * Actor receive method - handles incoming messages
   */
  async receive(payload, envelope) {
    console.log('ArtifactActor: Received message:', payload.type);
    
    switch (payload.type) {
      case 'process_tool_result':
        const result = await this.processToolResult(payload);
        // Send result back to remote peer
        if (this.remoteActor) {
          this.remoteActor.receive({
            type: 'artifacts_processed',
            eventName: 'artifacts_processed',
            result: result,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString()
          });
        }
        break;
        
      case 'assert_artifacts':
        const assertResult = await this.assertArtifacts(payload);
        // Send result back to remote peer
        if (this.remoteActor) {
          this.remoteActor.receive({
            type: 'artifacts_asserted',
            eventName: 'artifacts_asserted',
            result: assertResult,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString()
          });
        }
        break;
        
      case 'get_stats':
        const stats = this.artifactManager.getStatistics();
        // Send stats back to remote peer
        if (this.remoteActor) {
          this.remoteActor.receive({
            type: 'artifact_stats',
            eventName: 'artifact_stats',
            stats: stats,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString()
          });
        }
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
   * Set reference to ArtifactAgent for UI notifications
   * @param {ArtifactAgent} artifactAgent - The artifact agent instance
   */
  setArtifactAgent(artifactAgent) {
    this.artifactAgent = artifactAgent;
  }
  
  /**
   * Cleanup resources
   */
  destroy() {
    this.llmClient = null;
    console.log(`ArtifactActor ${this.id} destroyed`);
  }
}