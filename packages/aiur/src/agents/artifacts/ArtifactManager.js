import { promises as fs } from 'fs';
import path from 'path';

/**
 * ArtifactManager - Manages artifact storage, caching, and retrieval
 * 
 * This class handles the lifecycle of artifacts created by tools, including
 * storage, metadata management, caching, and cleanup.
 */
export class ArtifactManager {
  constructor(options = {}) {
    this.sessionId = options.sessionId || 'default';
    this.maxCacheSize = options.maxCacheSize || 100 * 1024 * 1024; // 100MB default
    this.maxCacheAge = options.maxCacheAge || 24 * 60 * 60 * 1000; // 24 hours
    this.cacheCleanupInterval = options.cacheCleanupInterval || 60 * 60 * 1000; // 1 hour
    
    // In-memory artifact registry
    this.artifacts = new Map();
    
    // Content cache for quick access
    this.contentCache = new Map();
    this.cacheSize = 0;
    
    // Cleanup timer
    this.cleanupTimer = null;
    
    this.startCleanupTimer();
  }

  /**
   * Register a new artifact
   * @param {Object} artifact - Artifact metadata object
   * @returns {Object} The registered artifact with assigned ID
   */
  registerArtifact(artifact) {
    if (!artifact.id) {
      artifact.id = this.generateArtifactId();
    }

    // Add session metadata
    artifact.sessionId = this.sessionId;
    artifact.registeredAt = new Date().toISOString();
    
    // Store in registry
    this.artifacts.set(artifact.id, { ...artifact });
    
    console.log(`ArtifactManager: Registered artifact ${artifact.id} (${artifact.type}/${artifact.subtype})`);
    
    return artifact;
  }

  /**
   * Get artifact by ID
   * @param {string} artifactId - ID of the artifact
   * @returns {Object|null} Artifact metadata or null if not found
   */
  getArtifact(artifactId) {
    return this.artifacts.get(artifactId) || null;
  }

  /**
   * Get all artifacts for the current session
   * @returns {Array} Array of all artifacts
   */
  getAllArtifacts() {
    return Array.from(this.artifacts.values())
      .filter(artifact => artifact.sessionId === this.sessionId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Get artifacts by type
   * @param {string} type - Artifact type (code, document, image, etc.)
   * @returns {Array} Array of artifacts matching the type
   */
  getArtifactsByType(type) {
    return Array.from(this.artifacts.values())
      .filter(artifact => 
        artifact.sessionId === this.sessionId && 
        artifact.type === type
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Get artifact content (with caching)
   * @param {string} artifactId - ID of the artifact
   * @param {Object} options - Options for content retrieval
   * @returns {Promise<string|null>} Artifact content or null
   */
  async getArtifactContent(artifactId, options = {}) {
    const artifact = this.getArtifact(artifactId);
    if (!artifact) {
      return null;
    }

    // Check cache first
    const cacheKey = `content:${artifactId}`;
    const cached = this.contentCache.get(cacheKey);
    
    if (cached && !this.isCacheExpired(cached)) {
      console.debug(`ArtifactManager: Cache hit for ${artifactId}`);
      return cached.content;
    }

    try {
      let content = null;

      if (artifact.content) {
        // Content stored directly in artifact
        content = artifact.content;
      } else if (artifact.path && artifact.exists) {
        // Read content from file
        const stats = await fs.stat(artifact.path);
        
        // Check if file is too large
        const maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
        if (stats.size > maxSize) {
          throw new Error(`File too large: ${stats.size} bytes (max: ${maxSize})`);
        }

        // Determine encoding based on artifact type
        const encoding = this.getEncodingForType(artifact.type);
        content = await fs.readFile(artifact.path, encoding);
        
        // Update artifact metadata
        artifact.size = stats.size;
        artifact.lastAccessed = new Date().toISOString();
      } else {
        throw new Error(`No content available for artifact ${artifactId}`);
      }

      // Cache the content
      this.cacheContent(cacheKey, content);
      
      return content;
    } catch (error) {
      console.warn(`ArtifactManager: Failed to get content for ${artifactId}:`, error.message);
      return null;
    }
  }

  /**
   * Update artifact metadata
   * @param {string} artifactId - ID of the artifact
   * @param {Object} updates - Fields to update
   * @returns {Object|null} Updated artifact or null if not found
   */
  updateArtifact(artifactId, updates) {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      return null;
    }

    // Merge updates
    const updated = {
      ...artifact,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.artifacts.set(artifactId, updated);
    
    // Invalidate cache if content-related updates
    if (updates.content || updates.path) {
      this.invalidateContentCache(artifactId);
    }
    
    return updated;
  }

  /**
   * Remove artifact from registry
   * @param {string} artifactId - ID of the artifact to remove
   * @returns {boolean} True if removed, false if not found
   */
  removeArtifact(artifactId) {
    const removed = this.artifacts.delete(artifactId);
    
    if (removed) {
      this.invalidateContentCache(artifactId);
      console.log(`ArtifactManager: Removed artifact ${artifactId}`);
    }
    
    return removed;
  }

  /**
   * Clear all artifacts for the current session
   */
  clearArtifacts() {
    const sessionArtifacts = Array.from(this.artifacts.values())
      .filter(artifact => artifact.sessionId === this.sessionId);
    
    sessionArtifacts.forEach(artifact => {
      this.artifacts.delete(artifact.id);
      this.invalidateContentCache(artifact.id);
    });
    
    console.log(`ArtifactManager: Cleared ${sessionArtifacts.length} artifacts for session ${this.sessionId}`);
  }

  /**
   * Get artifact statistics
   * @returns {Object} Statistics about artifacts
   */
  getStatistics() {
    const allArtifacts = this.getAllArtifacts();
    const typeStats = {};
    let totalSize = 0;

    allArtifacts.forEach(artifact => {
      typeStats[artifact.type] = (typeStats[artifact.type] || 0) + 1;
      totalSize += artifact.size || 0;
    });

    return {
      total: allArtifacts.length,
      byType: typeStats,
      totalSize,
      cacheSize: this.cacheSize,
      cacheEntries: this.contentCache.size
    };
  }

  /**
   * Export artifacts metadata
   * @returns {Object} Exportable artifact data
   */
  exportArtifacts() {
    return {
      sessionId: this.sessionId,
      artifacts: this.getAllArtifacts(),
      exportedAt: new Date().toISOString(),
      statistics: this.getStatistics()
    };
  }

  /**
   * Generate a unique artifact ID
   * @returns {string} Unique artifact ID
   */
  generateArtifactId() {
    return `artifact-${this.sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cache content with size tracking
   * @param {string} key - Cache key
   * @param {string} content - Content to cache
   */
  cacheContent(key, content) {
    const size = Buffer.byteLength(content, 'utf8');
    
    // Check if we need to make room
    while (this.cacheSize + size > this.maxCacheSize && this.contentCache.size > 0) {
      this.evictOldestCacheEntry();
    }

    const entry = {
      content,
      size,
      cachedAt: Date.now()
    };

    this.contentCache.set(key, entry);
    this.cacheSize += size;
    
    console.debug(`ArtifactManager: Cached content for ${key} (${size} bytes)`);
  }

  /**
   * Check if cache entry is expired
   * @param {Object} cacheEntry - Cache entry to check
   * @returns {boolean} True if expired
   */
  isCacheExpired(cacheEntry) {
    return Date.now() - cacheEntry.cachedAt > this.maxCacheAge;
  }

  /**
   * Invalidate content cache for artifact
   * @param {string} artifactId - ID of the artifact
   */
  invalidateContentCache(artifactId) {
    const key = `content:${artifactId}`;
    const entry = this.contentCache.get(key);
    
    if (entry) {
      this.contentCache.delete(key);
      this.cacheSize -= entry.size;
      console.debug(`ArtifactManager: Invalidated cache for ${artifactId}`);
    }
  }

  /**
   * Evict oldest cache entry
   */
  evictOldestCacheEntry() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.contentCache.entries()) {
      if (entry.cachedAt < oldestTime) {
        oldestTime = entry.cachedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.contentCache.get(oldestKey);
      this.contentCache.delete(oldestKey);
      this.cacheSize -= entry.size;
      console.debug(`ArtifactManager: Evicted cache entry ${oldestKey}`);
    }
  }

  /**
   * Get appropriate encoding for artifact type
   * @param {string} type - Artifact type
   * @returns {string} Encoding to use
   */
  getEncodingForType(type) {
    switch (type) {
      case 'image':
      case 'archive':
      case 'executable':
        return null; // Binary
      default:
        return 'utf8'; // Text-based
    }
  }

  /**
   * Start periodic cache cleanup
   */
  startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredCache();
    }, this.cacheCleanupInterval);
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredCache() {
    let removedCount = 0;
    let removedSize = 0;

    for (const [key, entry] of this.contentCache.entries()) {
      if (this.isCacheExpired(entry)) {
        this.contentCache.delete(key);
        this.cacheSize -= entry.size;
        removedCount++;
        removedSize += entry.size;
      }
    }

    if (removedCount > 0) {
      console.log(`ArtifactManager: Cleaned up ${removedCount} expired cache entries (${removedSize} bytes)`);
    }
  }

  /**
   * Destroy the artifact manager
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.artifacts.clear();
    this.contentCache.clear();
    this.cacheSize = 0;
    
    console.log(`ArtifactManager: Destroyed (session: ${this.sessionId})`);
  }
}