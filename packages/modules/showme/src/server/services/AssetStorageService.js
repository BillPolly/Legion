/**
 * AssetStorageService
 * 
 * Service for managing asset storage and retrieval
 * Handles different asset types and provides caching
 */

export class AssetStorageService {
  constructor(config = {}) {
    // Configuration
    this.config = {
      maxAssets: config.maxAssets || 100,
      maxAssetSize: config.maxAssetSize || 50 * 1024 * 1024, // 50MB
      ttl: config.ttl || 3600000, // 1 hour default TTL
      ...config
    };
    
    // Storage maps
    this.assets = new Map();
    this.metadata = new Map();
    this.accessTimes = new Map();
    
    // Statistics
    this.stats = {
      totalStored: 0,
      totalRetrieved: 0,
      totalDeleted: 0,
      currentSize: 0
    };
  }

  /**
   * Store an asset
   */
  store(assetId, asset, metadata = {}) {
    // Validate asset size
    const assetSize = this.calculateAssetSize(asset);
    
    if (assetSize > this.config.maxAssetSize) {
      throw new Error(`Asset size (${assetSize} bytes) exceeds maximum allowed (${this.config.maxAssetSize} bytes)`);
    }
    
    // Check storage limits
    if (this.assets.size >= this.config.maxAssets) {
      // Remove oldest asset
      this.evictOldest();
    }
    
    // Store asset and metadata
    this.assets.set(assetId, asset);
    this.metadata.set(assetId, {
      ...metadata,
      id: assetId,
      size: assetSize,
      storedAt: Date.now(),
      expiresAt: Date.now() + this.config.ttl
    });
    this.accessTimes.set(assetId, Date.now());
    
    // Update stats
    this.stats.totalStored++;
    this.stats.currentSize += assetSize;
    
    return {
      success: true,
      assetId,
      size: assetSize
    };
  }

  /**
   * Retrieve an asset
   */
  retrieve(assetId) {
    if (!this.assets.has(assetId)) {
      return null;
    }
    
    const metadata = this.metadata.get(assetId);
    
    // Check if expired
    if (metadata && metadata.expiresAt < Date.now()) {
      this.delete(assetId);
      return null;
    }
    
    // Update access time
    this.accessTimes.set(assetId, Date.now());
    
    // Update stats
    this.stats.totalRetrieved++;
    
    return {
      asset: this.assets.get(assetId),
      metadata: metadata
    };
  }

  /**
   * Delete an asset
   */
  delete(assetId) {
    if (!this.assets.has(assetId)) {
      return false;
    }
    
    const metadata = this.metadata.get(assetId);
    
    // Remove from storage
    this.assets.delete(assetId);
    this.metadata.delete(assetId);
    this.accessTimes.delete(assetId);
    
    // Update stats
    if (metadata) {
      this.stats.currentSize -= metadata.size;
    }
    this.stats.totalDeleted++;
    
    return true;
  }

  /**
   * List all stored assets
   */
  list() {
    const assets = [];
    
    for (const [assetId, metadata] of this.metadata) {
      // Check if expired
      if (metadata.expiresAt < Date.now()) {
        this.delete(assetId);
        continue;
      }
      
      assets.push({
        id: assetId,
        ...metadata,
        lastAccessed: this.accessTimes.get(assetId)
      });
    }
    
    return assets;
  }

  /**
   * Check if asset exists
   */
  has(assetId) {
    if (!this.assets.has(assetId)) {
      return false;
    }
    
    const metadata = this.metadata.get(assetId);
    
    // Check if expired
    if (metadata && metadata.expiresAt < Date.now()) {
      this.delete(assetId);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all assets
   */
  clear() {
    this.assets.clear();
    this.metadata.clear();
    this.accessTimes.clear();
    
    this.stats.currentSize = 0;
    
    return {
      success: true,
      message: 'All assets cleared'
    };
  }

  /**
   * Clean up expired assets
   */
  cleanup() {
    const now = Date.now();
    const expired = [];
    
    for (const [assetId, metadata] of this.metadata) {
      if (metadata.expiresAt < now) {
        expired.push(assetId);
      }
    }
    
    for (const assetId of expired) {
      this.delete(assetId);
    }
    
    return {
      cleaned: expired.length,
      remaining: this.assets.size
    };
  }

  /**
   * Get storage statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentAssets: this.assets.size,
      averageAssetSize: this.assets.size > 0 ? Math.round(this.stats.currentSize / this.assets.size) : 0
    };
  }

  /**
   * Calculate asset size in bytes
   */
  calculateAssetSize(asset) {
    if (Buffer.isBuffer(asset)) {
      return asset.length;
    } else if (typeof asset === 'string') {
      return Buffer.byteLength(asset, 'utf8');
    } else if (typeof asset === 'object') {
      // Estimate size for objects
      try {
        return Buffer.byteLength(JSON.stringify(asset), 'utf8');
      } catch {
        return 1024; // Default size for non-serializable objects
      }
    } else {
      return 8; // Default for primitives
    }
  }

  /**
   * Evict oldest asset (LRU)
   */
  evictOldest() {
    let oldestId = null;
    let oldestTime = Date.now();
    
    for (const [assetId, accessTime] of this.accessTimes) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestId = assetId;
      }
    }
    
    if (oldestId) {
      console.log(`Evicting oldest asset: ${oldestId}`);
      this.delete(oldestId);
    }
  }

  /**
   * Update asset metadata
   */
  updateMetadata(assetId, updates) {
    if (!this.metadata.has(assetId)) {
      return false;
    }
    
    const current = this.metadata.get(assetId);
    this.metadata.set(assetId, {
      ...current,
      ...updates,
      updatedAt: Date.now()
    });
    
    return true;
  }
}

export default AssetStorageService;