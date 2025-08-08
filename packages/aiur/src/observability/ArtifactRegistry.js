/**
 * ArtifactRegistry - Central registry for tracking all artifacts produced by agents
 * 
 * Features:
 * - Automatic artifact detection from tool results
 * - Artifact metadata and lineage tracking
 * - Query API for artifact discovery
 * - Integration with TraceCollector for context
 * - Support for various artifact types (files, code, data, reports)
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import path from 'path';

/**
 * Artifact types
 */
export const ArtifactType = {
  FILE: 'file',
  CODE: 'code',
  DATA: 'data',
  REPORT: 'report',
  CONFIG: 'config',
  LOG: 'log',
  IMAGE: 'image',
  MODEL: 'model',
  DOCUMENT: 'document',
  API_RESPONSE: 'api_response'
};

/**
 * Artifact class representing a produced artifact
 */
export class Artifact {
  constructor(options = {}) {
    this.id = options.id || randomUUID();
    this.type = options.type || ArtifactType.FILE;
    this.subtype = options.subtype || null;
    this.name = options.name || 'unnamed';
    this.path = options.path || null;
    this.content = options.content || null;
    this.size = options.size || this.calculateSize();
    this.hash = options.hash || null;
    this.mimeType = options.mimeType || this.detectMimeType();
    
    // Metadata
    this.createdAt = options.createdAt || Date.now();
    this.modifiedAt = options.modifiedAt || this.createdAt;
    this.createdBy = options.createdBy || null; // Tool or agent that created it
    this.traceId = options.traceId || null;
    this.spanId = options.spanId || null;
    
    // Lineage
    this.parentId = options.parentId || null; // Parent artifact if derived
    this.childIds = options.childIds || [];
    this.dependencies = options.dependencies || [];
    
    // Additional metadata
    this.metadata = options.metadata || {};
    this.tags = options.tags || [];
    this.annotations = options.annotations || {};
  }

  /**
   * Calculate size if content is provided
   */
  calculateSize() {
    if (!this.content) return 0;
    if (typeof this.content === 'string') {
      return Buffer.byteLength(this.content, 'utf8');
    }
    if (Buffer.isBuffer(this.content)) {
      return this.content.length;
    }
    if (typeof this.content === 'object') {
      return Buffer.byteLength(JSON.stringify(this.content), 'utf8');
    }
    return 0;
  }

  /**
   * Detect MIME type from path or content
   */
  detectMimeType() {
    if (this.path) {
      const ext = path.extname(this.path).toLowerCase();
      const mimeMap = {
        '.js': 'application/javascript',
        '.ts': 'application/typescript',
        '.json': 'application/json',
        '.html': 'text/html',
        '.css': 'text/css',
        '.md': 'text/markdown',
        '.txt': 'text/plain',
        '.yaml': 'text/yaml',
        '.yml': 'text/yaml',
        '.xml': 'text/xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.zip': 'application/zip'
      };
      return mimeMap[ext] || 'application/octet-stream';
    }
    return 'application/octet-stream';
  }

  /**
   * Convert to JSON for storage/export
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      subtype: this.subtype,
      name: this.name,
      path: this.path,
      size: this.size,
      hash: this.hash,
      mimeType: this.mimeType,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
      createdBy: this.createdBy,
      traceId: this.traceId,
      spanId: this.spanId,
      parentId: this.parentId,
      childIds: this.childIds,
      dependencies: this.dependencies,
      metadata: this.metadata,
      tags: this.tags,
      annotations: this.annotations,
      // Optionally include content (can be large)
      content: this.content ? 
        (typeof this.content === 'string' ? 
          this.content.substring(0, 1000) + (this.content.length > 1000 ? '...' : '') :
          '[Binary content]') : null
    };
  }

  /**
   * Get summary for display
   */
  getSummary() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      path: this.path,
      size: this.size,
      createdAt: new Date(this.createdAt).toISOString(),
      createdBy: this.createdBy
    };
  }
}

/**
 * ArtifactRegistry - Main registry service
 */
export class ArtifactRegistry extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Configuration
    this.maxArtifacts = config.maxArtifacts || 10000;
    this.maxContentSize = config.maxContentSize || 10 * 1024 * 1024; // 10MB
    this.storeContent = config.storeContent !== false;
    this.autoDetect = config.autoDetect !== false;
    
    // Storage
    this.artifacts = new Map(); // id -> Artifact
    this.artifactsByTrace = new Map(); // traceId -> Set of artifact IDs
    this.artifactsByPath = new Map(); // path -> artifact ID
    this.artifactsByType = new Map(); // type -> Set of artifact IDs
    this.artifactsByCreator = new Map(); // createdBy -> Set of artifact IDs
    
    // Metrics
    this.metrics = {
      totalArtifacts: 0,
      totalSize: 0,
      byType: {}
    };
    
    // Singleton
    if (!ArtifactRegistry.instance) {
      ArtifactRegistry.instance = this;
    }
    return ArtifactRegistry.instance;
  }

  /**
   * Get singleton instance
   */
  static getInstance(config = {}) {
    if (!ArtifactRegistry.instance) {
      ArtifactRegistry.instance = new ArtifactRegistry(config);
    }
    return ArtifactRegistry.instance;
  }

  /**
   * Register an artifact
   */
  register(options = {}) {
    // Auto-detect artifact from tool result
    if (options.toolResult && this.autoDetect) {
      options = this.detectArtifactFromResult(options.toolResult, options);
    }
    
    // Create artifact
    const artifact = new Artifact(options);
    
    // Check size limits
    if (this.artifacts.size >= this.maxArtifacts) {
      // Remove oldest artifact
      const oldest = Array.from(this.artifacts.values())
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      this.remove(oldest.id);
    }
    
    // Store artifact
    this.artifacts.set(artifact.id, artifact);
    
    // Update indices
    if (artifact.traceId) {
      if (!this.artifactsByTrace.has(artifact.traceId)) {
        this.artifactsByTrace.set(artifact.traceId, new Set());
      }
      this.artifactsByTrace.get(artifact.traceId).add(artifact.id);
    }
    
    if (artifact.path) {
      this.artifactsByPath.set(artifact.path, artifact.id);
    }
    
    if (!this.artifactsByType.has(artifact.type)) {
      this.artifactsByType.set(artifact.type, new Set());
    }
    this.artifactsByType.get(artifact.type).add(artifact.id);
    
    if (artifact.createdBy) {
      if (!this.artifactsByCreator.has(artifact.createdBy)) {
        this.artifactsByCreator.set(artifact.createdBy, new Set());
      }
      this.artifactsByCreator.get(artifact.createdBy).add(artifact.id);
    }
    
    // Update metrics
    this.metrics.totalArtifacts++;
    this.metrics.totalSize += artifact.size;
    this.metrics.byType[artifact.type] = (this.metrics.byType[artifact.type] || 0) + 1;
    
    // Emit event
    this.emit('artifact:registered', artifact);
    
    return artifact;
  }

  /**
   * Auto-detect artifact from tool result
   */
  detectArtifactFromResult(result, baseOptions = {}) {
    const options = { ...baseOptions };
    
    // Detect file artifacts
    if (result.path || result.filePath || result.file) {
      options.type = ArtifactType.FILE;
      options.path = result.path || result.filePath || result.file;
      options.name = path.basename(options.path);
      
      // Detect subtype from extension
      const ext = path.extname(options.path).toLowerCase();
      if (['.js', '.ts', '.py', '.java', '.cpp'].includes(ext)) {
        options.type = ArtifactType.CODE;
        options.subtype = ext.substring(1);
      } else if (['.json', '.yaml', '.yml', '.xml', '.toml'].includes(ext)) {
        options.type = ArtifactType.CONFIG;
        options.subtype = ext.substring(1);
      } else if (['.md', '.txt', '.doc', '.pdf'].includes(ext)) {
        options.type = ArtifactType.DOCUMENT;
        options.subtype = ext.substring(1);
      }
    }
    
    // Detect content
    if (result.content || result.data || result.output) {
      options.content = result.content || result.data || result.output;
      
      // Store content if within size limits
      if (!this.storeContent || options.content.length > this.maxContentSize) {
        options.content = null; // Don't store large content
        options.metadata.contentTruncated = true;
      }
    }
    
    // Detect generated code
    if (result.generatedCode || result.code) {
      options.type = ArtifactType.CODE;
      options.content = result.generatedCode || result.code;
      options.name = result.fileName || 'generated-code';
    }
    
    // Detect test results
    if (result.testResults || result.coverage) {
      options.type = ArtifactType.REPORT;
      options.subtype = 'test-results';
      options.content = result.testResults || result.coverage;
    }
    
    // Detect API responses
    if (result.response || result.apiResponse) {
      options.type = ArtifactType.API_RESPONSE;
      options.content = result.response || result.apiResponse;
      options.metadata.statusCode = result.statusCode;
      options.metadata.headers = result.headers;
    }
    
    // Detect logs
    if (result.logs || result.stdout || result.stderr) {
      options.type = ArtifactType.LOG;
      options.content = result.logs || result.stdout || result.stderr;
    }
    
    // Extract metadata
    if (result.metadata) {
      options.metadata = { ...options.metadata, ...result.metadata };
    }
    
    return options;
  }

  /**
   * Get artifact by ID
   */
  get(id) {
    return this.artifacts.get(id);
  }

  /**
   * Get artifacts by trace ID
   */
  getByTrace(traceId) {
    const ids = this.artifactsByTrace.get(traceId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.artifacts.get(id)).filter(Boolean);
  }

  /**
   * Get artifact by path
   */
  getByPath(path) {
    const id = this.artifactsByPath.get(path);
    return id ? this.artifacts.get(id) : null;
  }

  /**
   * Get artifacts by type
   */
  getByType(type) {
    const ids = this.artifactsByType.get(type);
    if (!ids) return [];
    return Array.from(ids).map(id => this.artifacts.get(id)).filter(Boolean);
  }

  /**
   * Get artifacts by creator
   */
  getByCreator(createdBy) {
    const ids = this.artifactsByCreator.get(createdBy);
    if (!ids) return [];
    return Array.from(ids).map(id => this.artifacts.get(id)).filter(Boolean);
  }

  /**
   * Query artifacts with filters
   */
  query(filters = {}) {
    let results = Array.from(this.artifacts.values());
    
    // Apply filters
    if (filters.type) {
      results = results.filter(a => a.type === filters.type);
    }
    
    if (filters.subtype) {
      results = results.filter(a => a.subtype === filters.subtype);
    }
    
    if (filters.createdBy) {
      results = results.filter(a => a.createdBy === filters.createdBy);
    }
    
    if (filters.traceId) {
      results = results.filter(a => a.traceId === filters.traceId);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(a => 
        filters.tags.some(tag => a.tags.includes(tag))
      );
    }
    
    if (filters.since) {
      const sinceTime = typeof filters.since === 'number' ? filters.since : Date.parse(filters.since);
      results = results.filter(a => a.createdAt >= sinceTime);
    }
    
    if (filters.before) {
      const beforeTime = typeof filters.before === 'number' ? filters.before : Date.parse(filters.before);
      results = results.filter(a => a.createdAt < beforeTime);
    }
    
    // Sort
    if (filters.sortBy) {
      const sortField = filters.sortBy;
      const sortOrder = filters.sortOrder || 'asc';
      results.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        return sortOrder === 'asc' ? 
          (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) :
          (aVal > bVal ? -1 : aVal < bVal ? 1 : 0);
      });
    }
    
    // Limit
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  }

  /**
   * Update artifact metadata
   */
  update(id, updates = {}) {
    const artifact = this.artifacts.get(id);
    if (!artifact) return null;
    
    // Update allowed fields
    if (updates.metadata) {
      Object.assign(artifact.metadata, updates.metadata);
    }
    
    if (updates.tags) {
      artifact.tags = [...new Set([...artifact.tags, ...updates.tags])];
    }
    
    if (updates.annotations) {
      Object.assign(artifact.annotations, updates.annotations);
    }
    
    artifact.modifiedAt = Date.now();
    
    // Emit event
    this.emit('artifact:updated', artifact);
    
    return artifact;
  }

  /**
   * Add child artifact relationship
   */
  addChild(parentId, childId) {
    const parent = this.artifacts.get(parentId);
    const child = this.artifacts.get(childId);
    
    if (!parent || !child) return false;
    
    if (!parent.childIds.includes(childId)) {
      parent.childIds.push(childId);
    }
    
    child.parentId = parentId;
    
    return true;
  }

  /**
   * Add dependency relationship
   */
  addDependency(artifactId, dependencyId) {
    const artifact = this.artifacts.get(artifactId);
    const dependency = this.artifacts.get(dependencyId);
    
    if (!artifact || !dependency) return false;
    
    if (!artifact.dependencies.includes(dependencyId)) {
      artifact.dependencies.push(dependencyId);
    }
    
    return true;
  }

  /**
   * Get artifact lineage (parents and children)
   */
  getLineage(id, depth = -1) {
    const artifact = this.artifacts.get(id);
    if (!artifact) return null;
    
    const lineage = {
      artifact: artifact,
      parents: [],
      children: []
    };
    
    // Get parents
    let currentParent = artifact.parentId;
    let currentDepth = 0;
    while (currentParent && (depth === -1 || currentDepth < depth)) {
      const parent = this.artifacts.get(currentParent);
      if (!parent) break;
      lineage.parents.push(parent);
      currentParent = parent.parentId;
      currentDepth++;
    }
    
    // Get children recursively
    const getChildren = (parentId, currentDepth) => {
      if (depth !== -1 && currentDepth >= depth) return [];
      
      const parent = this.artifacts.get(parentId);
      if (!parent) return [];
      
      return parent.childIds.flatMap(childId => {
        const child = this.artifacts.get(childId);
        if (!child) return [];
        
        return [{
          ...child,
          children: getChildren(childId, currentDepth + 1)
        }];
      });
    };
    
    lineage.children = getChildren(id, 0);
    
    return lineage;
  }

  /**
   * Remove artifact
   */
  remove(id) {
    const artifact = this.artifacts.get(id);
    if (!artifact) return false;
    
    // Remove from indices
    if (artifact.traceId) {
      const traceArtifacts = this.artifactsByTrace.get(artifact.traceId);
      if (traceArtifacts) {
        traceArtifacts.delete(id);
        if (traceArtifacts.size === 0) {
          this.artifactsByTrace.delete(artifact.traceId);
        }
      }
    }
    
    if (artifact.path) {
      this.artifactsByPath.delete(artifact.path);
    }
    
    const typeArtifacts = this.artifactsByType.get(artifact.type);
    if (typeArtifacts) {
      typeArtifacts.delete(id);
      if (typeArtifacts.size === 0) {
        this.artifactsByType.delete(artifact.type);
      }
    }
    
    if (artifact.createdBy) {
      const creatorArtifacts = this.artifactsByCreator.get(artifact.createdBy);
      if (creatorArtifacts) {
        creatorArtifacts.delete(id);
        if (creatorArtifacts.size === 0) {
          this.artifactsByCreator.delete(artifact.createdBy);
        }
      }
    }
    
    // Update metrics
    this.metrics.totalArtifacts--;
    this.metrics.totalSize -= artifact.size;
    this.metrics.byType[artifact.type]--;
    
    // Remove artifact
    this.artifacts.delete(id);
    
    // Emit event
    this.emit('artifact:removed', artifact);
    
    return true;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      averageSize: this.metrics.totalArtifacts > 0 ? 
        Math.round(this.metrics.totalSize / this.metrics.totalArtifacts) : 0
    };
  }

  /**
   * Export artifacts
   */
  export(options = {}) {
    const artifacts = this.query(options);
    
    if (options.format === 'summary') {
      return artifacts.map(a => a.getSummary());
    }
    
    return artifacts.map(a => a.toJSON());
  }

  /**
   * Clear all artifacts
   */
  clear() {
    this.artifacts.clear();
    this.artifactsByTrace.clear();
    this.artifactsByPath.clear();
    this.artifactsByType.clear();
    this.artifactsByCreator.clear();
    
    this.metrics = {
      totalArtifacts: 0,
      totalSize: 0,
      byType: {}
    };
    
    this.emit('artifacts:cleared');
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const stats = {
      total: this.artifacts.size,
      byType: {},
      byCreator: {},
      recentArtifacts: [],
      largestArtifacts: [],
      totalSize: this.metrics.totalSize
    };
    
    // Count by type
    for (const [type, ids] of this.artifactsByType) {
      stats.byType[type] = ids.size;
    }
    
    // Count by creator
    for (const [creator, ids] of this.artifactsByCreator) {
      stats.byCreator[creator] = ids.size;
    }
    
    // Get recent artifacts
    stats.recentArtifacts = Array.from(this.artifacts.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10)
      .map(a => a.getSummary());
    
    // Get largest artifacts
    stats.largestArtifacts = Array.from(this.artifacts.values())
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .map(a => ({ ...a.getSummary(), size: a.size }));
    
    return stats;
  }
}

// Export singleton getter
export const getArtifactRegistry = ArtifactRegistry.getInstance;