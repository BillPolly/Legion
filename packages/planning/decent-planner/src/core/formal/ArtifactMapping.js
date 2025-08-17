/**
 * ArtifactMapping - Manages artifact translation between levels
 */

export class ArtifactMapping {
  constructor(config = {}) {
    // Bidirectional mappings
    this.childToParent = config.childToParent || new Map();
    this.parentToChild = config.parentToChild || new Map();
    
    // Metadata for each artifact
    this.artifactMetadata = config.artifactMetadata || new Map();
  }

  /**
   * Add a bidirectional mapping
   */
  addMapping(childName, parentName, metadata = {}) {
    this.childToParent.set(childName, parentName);
    this.parentToChild.set(parentName, childName);
    
    if (metadata && Object.keys(metadata).length > 0) {
      this.artifactMetadata.set(childName, metadata);
    }
  }

  /**
   * Translate child artifact name to parent
   */
  translateToParent(childName) {
    return this.childToParent.get(childName) || null;
  }

  /**
   * Translate parent artifact name to child
   */
  translateToChild(parentName) {
    return this.parentToChild.get(parentName) || null;
  }

  /**
   * Get metadata for an artifact
   */
  getMetadata(artifactName) {
    return this.artifactMetadata.get(artifactName) || {};
  }

  /**
   * Map child outputs to parent context
   */
  mapChildOutputs(childOutputs, mappings) {
    const parentContext = {};
    
    for (const [childName, parentName] of Object.entries(mappings)) {
      if (childOutputs.hasOwnProperty(childName)) {
        parentContext[parentName] = childOutputs[childName];
        this.addMapping(childName, parentName);
      }
    }
    
    return parentContext;
  }

  /**
   * Map parent inputs to child context
   */
  mapParentInputs(parentInputs, mappings) {
    const childContext = {};
    
    for (const [parentName, childName] of Object.entries(mappings)) {
      if (parentInputs.hasOwnProperty(parentName)) {
        childContext[childName] = parentInputs[parentName];
        this.addMapping(childName, parentName);
      }
    }
    
    return childContext;
  }

  /**
   * Find naming conflicts
   */
  findConflicts() {
    const parentCounts = new Map();
    const conflicts = [];
    
    // Count how many children map to each parent
    for (const [child, parent] of this.childToParent) {
      if (!parentCounts.has(parent)) {
        parentCounts.set(parent, []);
      }
      parentCounts.get(parent).push(child);
    }
    
    // Find parents with multiple children
    for (const [parent, children] of parentCounts) {
      if (children.length > 1) {
        conflicts.push({
          parentName: parent,
          childNames: children
        });
      }
    }
    
    return conflicts;
  }

  /**
   * Resolve conflicts by adding prefixes
   */
  resolveConflictsWithPrefix() {
    const conflicts = this.findConflicts();
    
    for (const conflict of conflicts) {
      // Update mappings to use child name as parent name (self-mapping)
      for (const childName of conflict.childNames) {
        this.childToParent.set(childName, childName);
        this.parentToChild.delete(conflict.parentName);
        this.parentToChild.set(childName, childName);
      }
    }
  }

  /**
   * Resolve conflicts by adding suffixes
   */
  resolveConflictsWithSuffix() {
    const conflicts = this.findConflicts();
    
    for (const conflict of conflicts) {
      let counter = 1;
      for (const childName of conflict.childNames) {
        const newParentName = `${conflict.parentName}_${counter}`;
        this.childToParent.set(childName, newParentName);
        this.parentToChild.delete(conflict.parentName);
        this.parentToChild.set(newParentName, childName);
        counter++;
      }
    }
  }

  /**
   * Create aggregate artifact from child artifacts
   */
  createAggregateArtifact(childArtifacts, metadata = {}) {
    const aggregate = {
      type: 'aggregate',
      childArtifacts: [],
      metadata: {
        ...metadata,
        timestamp: Date.now()
      }
    };
    
    // Process each child artifact
    for (const [childId, artifacts] of Object.entries(childArtifacts)) {
      if (!artifacts || typeof artifacts !== 'object') continue;
      
      // Add to aggregate
      aggregate.childArtifacts.push({
        childId,
        artifacts: artifacts
      });
      
      // Create mappings for each artifact
      for (const [artifactName, artifactValue] of Object.entries(artifacts)) {
        const parentName = `${childId}_${artifactName}`;
        this.addMapping(artifactName, parentName, {
          source: childId,
          level: metadata.level,
          originalName: artifactName
        });
      }
    }
    
    // Resolve any conflicts
    this.resolveConflictsWithSuffix();
    
    return aggregate;
  }

  /**
   * Get lineage information for an artifact
   */
  getLineage(artifactName) {
    return this.getMetadata(artifactName);
  }

  /**
   * Build complete lineage chain
   */
  getLineageChain(artifactName) {
    const chain = [];
    
    // Get metadata for this artifact (either as child or parent name)
    const childName = this.translateToChild(artifactName);
    const metadata = this.getMetadata(childName) || this.artifactMetadata.get(artifactName);
    
    if (metadata && metadata.source) {
      chain.push({
        source: metadata.source,
        level: metadata.level,
        artifact: artifactName
      });
      
      // If there's a previous mapping, get its chain
      if (metadata.previous) {
        // The artifact in the child corresponds to a parent artifact there
        // We need to find what 'connection' was in the level2 mapping
        const childArtifact = this.translateToChild(artifactName);
        if (childArtifact) {
          // Now find what this maps to in the previous level
          for (const [prevChild, prevParent] of metadata.previous.childToParent) {
            if (prevParent === childArtifact) {
              const previousChain = metadata.previous.getLineageChain(prevParent);
              chain.push(...previousChain);
              break;
            }
          }
        }
      }
    }
    
    return chain;
  }

  /**
   * Validate mapping completeness
   */
  validateCompleteness(requiredOutputs) {
    const unmapped = [];
    
    for (const output of requiredOutputs) {
      if (!this.childToParent.has(output)) {
        unmapped.push(output);
      }
    }
    
    return {
      complete: unmapped.length === 0,
      unmapped
    };
  }

  /**
   * Validate no orphaned mappings
   */
  validateNoOrphans(actualOutputs) {
    const orphaned = [];
    
    for (const childName of this.childToParent.keys()) {
      if (!actualOutputs.includes(childName)) {
        orphaned.push(childName);
      }
    }
    
    return {
      valid: orphaned.length === 0,
      orphaned
    };
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    const mappings = [];
    
    for (const [child, parent] of this.childToParent) {
      mappings.push({
        child,
        parent,
        metadata: this.getMetadata(child)
      });
    }
    
    return { mappings };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json) {
    const mapping = new ArtifactMapping();
    
    for (const item of json.mappings) {
      mapping.addMapping(item.child, item.parent, item.metadata);
    }
    
    return mapping;
  }

  /**
   * Clone the mapping
   */
  clone() {
    return new ArtifactMapping({
      childToParent: new Map(this.childToParent),
      parentToChild: new Map(this.parentToChild),
      artifactMetadata: new Map(this.artifactMetadata)
    });
  }
}