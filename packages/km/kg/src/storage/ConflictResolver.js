import { ValidationError, StorageError } from './StorageError.js';

/**
 * Conflict resolution strategies for GitHub storage
 * Handles merge conflicts when multiple users modify the same data
 */
export class ConflictResolver {
  constructor(strategy = 'merge') {
    this.strategy = strategy;
    this.supportedStrategies = ['merge', 'overwrite', 'fail', 'manual'];
    
    if (!this.supportedStrategies.includes(strategy)) {
      throw new ValidationError(`Unsupported conflict resolution strategy: ${strategy}. Supported: ${this.supportedStrategies.join(', ')}`);
    }
  }

  /**
   * Resolve conflicts between local and remote triple sets
   * @param {Array} localTriples - Local triples
   * @param {Array} remoteTriples - Remote triples from GitHub
   * @param {Object} metadata - Additional metadata about the conflict
   * @returns {Object} Resolution result with merged triples and conflict info
   */
  async resolveConflict(localTriples, remoteTriples, metadata = {}) {
    const conflict = this._analyzeConflict(localTriples, remoteTriples);
    
    switch (this.strategy) {
      case 'merge':
        return this._mergeTriples(localTriples, remoteTriples, conflict, metadata);
      case 'overwrite':
        return this._overwriteTriples(localTriples, remoteTriples, conflict, metadata);
      case 'fail':
        return this._failOnConflict(conflict, metadata);
      case 'manual':
        return this._requireManualResolution(localTriples, remoteTriples, conflict, metadata);
      default:
        throw new ValidationError(`Unknown conflict resolution strategy: ${this.strategy}`);
    }
  }

  /**
   * Analyze differences between local and remote triples
   */
  _analyzeConflict(localTriples, remoteTriples) {
    const localSet = new Set(localTriples.map(t => this._tripleKey(t)));
    const remoteSet = new Set(remoteTriples.map(t => this._tripleKey(t)));
    
    const localOnly = localTriples.filter(t => !remoteSet.has(this._tripleKey(t)));
    const remoteOnly = remoteTriples.filter(t => !localSet.has(this._tripleKey(t)));
    const common = localTriples.filter(t => remoteSet.has(this._tripleKey(t)));
    
    // Detect subject-level conflicts (same subject, different predicates/objects)
    const subjectConflicts = this._detectSubjectConflicts(localTriples, remoteTriples);
    
    return {
      hasConflict: localOnly.length > 0 || remoteOnly.length > 0 || subjectConflicts.length > 0,
      localOnly,
      remoteOnly,
      common,
      subjectConflicts,
      totalLocal: localTriples.length,
      totalRemote: remoteTriples.length
    };
  }

  /**
   * Detect conflicts at the subject level
   */
  _detectSubjectConflicts(localTriples, remoteTriples) {
    const localBySubject = this._groupBySubject(localTriples);
    const remoteBySubject = this._groupBySubject(remoteTriples);
    
    const conflicts = [];
    
    for (const [subject, localProps] of localBySubject) {
      const remoteProps = remoteBySubject.get(subject);
      if (remoteProps) {
        const conflict = this._analyzeSubjectConflict(subject, localProps, remoteProps);
        if (conflict.hasConflict) {
          conflicts.push(conflict);
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Analyze conflicts for a specific subject
   */
  _analyzeSubjectConflict(subject, localProps, remoteProps) {
    const localPropMap = new Map();
    const remotePropMap = new Map();
    
    // Group by predicate
    for (const [s, p, o] of localProps) {
      if (!localPropMap.has(p)) localPropMap.set(p, []);
      localPropMap.get(p).push(o);
    }
    
    for (const [s, p, o] of remoteProps) {
      if (!remotePropMap.has(p)) remotePropMap.set(p, []);
      remotePropMap.get(p).push(o);
    }
    
    const conflictingPredicates = [];
    
    for (const [predicate, localValues] of localPropMap) {
      const remoteValues = remotePropMap.get(predicate);
      if (remoteValues) {
        const localSet = new Set(localValues.map(v => JSON.stringify(v)));
        const remoteSet = new Set(remoteValues.map(v => JSON.stringify(v)));
        
        const onlyLocal = localValues.filter(v => !remoteSet.has(JSON.stringify(v)));
        const onlyRemote = remoteValues.filter(v => !localSet.has(JSON.stringify(v)));
        
        if (onlyLocal.length > 0 || onlyRemote.length > 0) {
          conflictingPredicates.push({
            predicate,
            localValues,
            remoteValues,
            onlyLocal,
            onlyRemote
          });
        }
      }
    }
    
    return {
      subject,
      hasConflict: conflictingPredicates.length > 0,
      conflictingPredicates
    };
  }

  /**
   * Merge strategy: Combine local and remote triples intelligently
   */
  _mergeTriples(localTriples, remoteTriples, conflict, metadata) {
    const merged = [...conflict.common];
    
    // Add all local-only triples
    merged.push(...conflict.localOnly);
    
    // Add all remote-only triples
    merged.push(...conflict.remoteOnly);
    
    // Handle subject-level conflicts by merging values
    for (const subjectConflict of conflict.subjectConflicts) {
      for (const predConflict of subjectConflict.conflictingPredicates) {
        // For conflicts, include both local and remote values
        // This creates a union of all values for each predicate
        const allValues = new Set([
          ...predConflict.localValues.map(v => JSON.stringify(v)),
          ...predConflict.remoteValues.map(v => JSON.stringify(v))
        ]);
        
        for (const valueStr of allValues) {
          let value;
          try {
            value = JSON.parse(valueStr);
          } catch {
            // Handle cases where JSON.parse fails (e.g., undefined)
            value = valueStr === 'undefined' ? undefined : valueStr;
          }
          merged.push([subjectConflict.subject, predConflict.predicate, value]);
        }
      }
    }
    
    return {
      strategy: 'merge',
      resolved: true,
      triples: this._deduplicateTriples(merged),
      conflict,
      resolution: {
        action: 'merged',
        addedFromLocal: conflict.localOnly.length,
        addedFromRemote: conflict.remoteOnly.length,
        mergedSubjects: conflict.subjectConflicts.length
      },
      metadata
    };
  }

  /**
   * Overwrite strategy: Local triples take precedence
   */
  _overwriteTriples(localTriples, remoteTriples, conflict, metadata) {
    return {
      strategy: 'overwrite',
      resolved: true,
      triples: [...localTriples],
      conflict,
      resolution: {
        action: 'overwritten',
        keptLocal: localTriples.length,
        discardedRemote: conflict.remoteOnly.length
      },
      metadata
    };
  }

  /**
   * Fail strategy: Throw error on any conflict
   */
  _failOnConflict(conflict, metadata) {
    if (conflict.hasConflict) {
      const details = [
        `Local-only triples: ${conflict.localOnly.length}`,
        `Remote-only triples: ${conflict.remoteOnly.length}`,
        `Subject conflicts: ${conflict.subjectConflicts.length}`
      ].join(', ');
      
      throw new StorageError(`Merge conflict detected (${details}). Manual resolution required.`, 'MERGE_CONFLICT');
    }
    
    return {
      strategy: 'fail',
      resolved: true,
      triples: conflict.common,
      conflict,
      resolution: {
        action: 'no-conflict',
        message: 'No conflicts detected'
      },
      metadata
    };
  }

  /**
   * Manual strategy: Return conflict details for manual resolution
   */
  _requireManualResolution(localTriples, remoteTriples, conflict, metadata) {
    return {
      strategy: 'manual',
      resolved: false,
      triples: null,
      conflict,
      resolution: {
        action: 'manual-required',
        message: 'Manual conflict resolution required',
        suggestions: this._generateResolutionSuggestions(conflict)
      },
      metadata
    };
  }

  /**
   * Generate suggestions for manual conflict resolution
   */
  _generateResolutionSuggestions(conflict) {
    const suggestions = [];
    
    if (conflict.localOnly.length > 0) {
      suggestions.push(`Consider keeping ${conflict.localOnly.length} local-only triples`);
    }
    
    if (conflict.remoteOnly.length > 0) {
      suggestions.push(`Consider merging ${conflict.remoteOnly.length} remote-only triples`);
    }
    
    for (const subjectConflict of conflict.subjectConflicts) {
      suggestions.push(`Resolve conflicts for subject "${subjectConflict.subject}" with ${subjectConflict.conflictingPredicates.length} conflicting predicates`);
    }
    
    return suggestions;
  }

  /**
   * Group triples by subject
   */
  _groupBySubject(triples) {
    const groups = new Map();
    
    for (const triple of triples) {
      const subject = triple[0];
      if (!groups.has(subject)) {
        groups.set(subject, []);
      }
      groups.get(subject).push(triple);
    }
    
    return groups;
  }

  /**
   * Remove duplicate triples
   */
  _deduplicateTriples(triples) {
    const seen = new Set();
    const unique = [];
    
    for (const triple of triples) {
      const key = this._tripleKey(triple);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(triple);
      }
    }
    
    return unique;
  }

  /**
   * Generate unique key for a triple
   */
  _tripleKey([s, p, o]) {
    return `${s}|${p}|${JSON.stringify(o)}`;
  }

  /**
   * Get resolver metadata
   */
  getMetadata() {
    return {
      strategy: this.strategy,
      supportedStrategies: [...this.supportedStrategies]
    };
  }

  /**
   * Change conflict resolution strategy
   */
  setStrategy(strategy) {
    if (!this.supportedStrategies.includes(strategy)) {
      throw new ValidationError(`Unsupported conflict resolution strategy: ${strategy}. Supported: ${this.supportedStrategies.join(', ')}`);
    }
    this.strategy = strategy;
  }
}

/**
 * Utility functions for conflict resolution
 */
export const ConflictUtils = {
  /**
   * Create a simple merge resolver
   */
  createMergeResolver() {
    return new ConflictResolver('merge');
  },

  /**
   * Create an overwrite resolver
   */
  createOverwriteResolver() {
    return new ConflictResolver('overwrite');
  },

  /**
   * Create a fail-on-conflict resolver
   */
  createFailResolver() {
    return new ConflictResolver('fail');
  },

  /**
   * Create a manual resolution resolver
   */
  createManualResolver() {
    return new ConflictResolver('manual');
  },

  /**
   * Analyze conflict without resolving
   */
  analyzeConflict(localTriples, remoteTriples) {
    const resolver = new ConflictResolver('manual');
    return resolver._analyzeConflict(localTriples, remoteTriples);
  }
};
