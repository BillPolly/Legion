/**
 * LayoutPersistenceManager - Manages saving and restoring layout states and configurations
 * 
 * Provides comprehensive layout persistence capabilities:
 * - Save/restore node positions and layout configurations
 * - Support for multiple storage backends (localStorage, sessionStorage, file, database)
 * - Layout snapshots and versioning
 * - Automatic session recovery
 * - Export/import functionality for sharing layouts
 * 
 * Enables users to maintain their preferred layouts across sessions and share them.
 */

export class LayoutPersistenceManager {
  constructor(config = {}) {
    this.config = {
      // Storage configuration
      storageType: config.storageType || 'localStorage', // localStorage, sessionStorage, file, memory
      storagePrefix: config.storagePrefix || 'showme-layout',
      autoSave: config.autoSave !== false, // Automatically save on layout changes
      autoSaveDelay: config.autoSaveDelay || 1000, // Delay before auto-saving (ms)
      
      // Versioning options
      enableVersioning: config.enableVersioning !== false, // Keep multiple versions
      maxVersions: config.maxVersions || 10, // Maximum versions to keep
      versionNaming: config.versionNaming || 'timestamp', // timestamp, sequential, custom
      
      // Snapshot options
      includeMetadata: config.includeMetadata !== false, // Save layout metadata
      includeEdgePaths: config.includeEdgePaths !== false, // Save edge routing info
      includeViewState: config.includeViewState !== false, // Save zoom/pan state
      compressData: config.compressData || false, // Compress saved data
      
      // Recovery options
      enableAutoRestore: config.enableAutoRestore !== false, // Auto-restore on load
      gracefulFallback: config.gracefulFallback !== false, // Fallback to defaults on error
      
      // Callbacks
      onSave: config.onSave || null,
      onRestore: config.onRestore || null,
      onError: config.onError || null,
      onVersionCreated: config.onVersionCreated || null,
      
      ...config
    };
    
    // State management
    this.currentSnapshot = null;
    this.layoutHistory = new Map(); // Map layout ID to versions
    this.storageInterface = null;
    this.autoSaveTimeout = null;
    this.isInitialized = false;
    
    // Statistics
    this.stats = {
      totalSaves: 0,
      totalRestores: 0,
      totalVersions: 0,
      lastSave: null,
      lastRestore: null,
      storageSize: 0
    };
  }
  
  /**
   * Initialize the persistence manager
   */
  async initialize() {
    if (this.isInitialized) return this;
    
    try {
      // Initialize storage interface
      this.storageInterface = this._createStorageInterface();
      await this.storageInterface.initialize();
      
      // Load existing layout history
      await this._loadLayoutHistory();
      
      this.isInitialized = true;
      
      return this;
      
    } catch (error) {
      console.error('Failed to initialize LayoutPersistenceManager:', error);
      if (this.config.onError) {
        this.config.onError('initialization', error);
      }
      throw error;
    }
  }
  
  /**
   * Save a layout snapshot
   */
  async saveLayout(layoutId, layoutData, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LayoutPersistenceManager not initialized');
    }
    
    try {
      const snapshot = this._createSnapshot(layoutId, layoutData, options);
      
      // Save to storage
      await this.storageInterface.save(this._getSnapshotKey(layoutId, snapshot.version), snapshot);
      
      // Update history
      this._updateLayoutHistory(layoutId, snapshot);
      
      // Update stats
      this.stats.totalSaves++;
      this.stats.lastSave = Date.now();
      this._updateStorageSize();
      
      // Clean up old versions
      await this._cleanupOldVersions(layoutId);
      
      this.currentSnapshot = snapshot;
      
      if (this.config.onSave) {
        this.config.onSave(layoutId, snapshot);
      }
      
      if (this.config.onVersionCreated) {
        this.config.onVersionCreated(layoutId, snapshot.version, snapshot);
      }
      
      return snapshot;
      
    } catch (error) {
      console.error('Failed to save layout:', error);
      if (this.config.onError) {
        this.config.onError('save', error, layoutId);
      }
      throw error;
    }
  }
  
  /**
   * Restore a layout snapshot
   */
  async restoreLayout(layoutId, options = {}) {
    if (!this.isInitialized) {
      throw new Error('LayoutPersistenceManager not initialized');
    }
    
    try {
      const version = options.version || 'latest';
      const snapshotKey = version === 'latest' 
        ? this._getLatestSnapshotKey(layoutId)
        : this._getSnapshotKey(layoutId, version);
      
      if (!snapshotKey) {
        throw new Error(`No layout found for ID: ${layoutId}`);
      }
      
      const snapshot = await this.storageInterface.load(snapshotKey);
      
      if (!snapshot) {
        throw new Error(`Failed to load snapshot: ${snapshotKey}`);
      }
      
      // Validate snapshot
      this._validateSnapshot(snapshot);
      
      // Update stats
      this.stats.totalRestores++;
      this.stats.lastRestore = Date.now();
      
      this.currentSnapshot = snapshot;
      
      if (this.config.onRestore) {
        this.config.onRestore(layoutId, snapshot);
      }
      
      return this._extractLayoutData(snapshot);
      
    } catch (error) {
      console.error('Failed to restore layout:', error);
      
      if (this.config.gracefulFallback) {
        // Return empty layout data as fallback
        return {
          positions: new Map(),
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          edges: new Map(),
          metadata: { algorithm: 'fallback', restored: false }
        };
      }
      
      if (this.config.onError) {
        this.config.onError('restore', error, layoutId);
      }
      throw error;
    }
  }
  
  /**
   * Auto-save layout with debouncing
   */
  scheduleAutoSave(layoutId, layoutData, options = {}) {
    if (!this.config.autoSave) return;
    
    // Clear existing timeout
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    // Schedule new save
    this.autoSaveTimeout = setTimeout(async () => {
      try {
        await this.saveLayout(layoutId, layoutData, { 
          ...options, 
          isAutoSave: true 
        });
      } catch (error) {
        console.warn('Auto-save failed:', error);
      }
    }, this.config.autoSaveDelay);
  }
  
  /**
   * List available layouts
   */
  listLayouts() {
    const layouts = [];
    
    for (const [layoutId, versions] of this.layoutHistory) {
      const latestVersion = versions[versions.length - 1];
      layouts.push({
        id: layoutId,
        name: latestVersion.name,
        versions: versions.length,
        lastModified: latestVersion.timestamp,
        algorithm: latestVersion.metadata?.algorithm,
        nodeCount: latestVersion.data?.positions?.size || 0
      });
    }
    
    return layouts.sort((a, b) => b.lastModified - a.lastModified);
  }
  
  /**
   * Get layout versions
   */
  getLayoutVersions(layoutId) {
    const versions = this.layoutHistory.get(layoutId) || [];
    
    return versions.map(version => ({
      version: version.version,
      name: version.name,
      timestamp: version.timestamp,
      isAutoSave: version.isAutoSave,
      algorithm: version.metadata?.algorithm,
      nodeCount: version.data?.positions?.size || 0
    }));
  }
  
  /**
   * Delete a layout
   */
  async deleteLayout(layoutId, options = {}) {
    try {
      const versions = this.layoutHistory.get(layoutId) || [];
      
      if (options.version) {
        // Delete specific version
        const versionIndex = versions.findIndex(v => v.version === options.version);
        if (versionIndex >= 0) {
          const version = versions[versionIndex];
          await this.storageInterface.delete(this._getSnapshotKey(layoutId, version.version));
          versions.splice(versionIndex, 1);
          
          if (versions.length === 0) {
            this.layoutHistory.delete(layoutId);
          }
        }
      } else {
        // Delete all versions
        for (const version of versions) {
          await this.storageInterface.delete(this._getSnapshotKey(layoutId, version.version));
        }
        this.layoutHistory.delete(layoutId);
      }
      
      this._updateStorageSize();
      return true;
      
    } catch (error) {
      console.error('Failed to delete layout:', error);
      if (this.config.onError) {
        this.config.onError('delete', error, layoutId);
      }
      return false;
    }
  }
  
  /**
   * Export layout data
   */
  async exportLayout(layoutId, options = {}) {
    try {
      const format = options.format || 'json';
      const includeVersions = options.includeVersions || false;
      const version = options.version || 'latest';
      
      let exportData;
      
      if (includeVersions) {
        // Export all versions
        const versions = this.layoutHistory.get(layoutId) || [];
        exportData = {
          layoutId,
          exportDate: Date.now(),
          format: 'multi-version',
          versions: []
        };
        
        for (const versionInfo of versions) {
          const snapshot = await this.storageInterface.load(
            this._getSnapshotKey(layoutId, versionInfo.version)
          );
          if (snapshot) {
            exportData.versions.push(snapshot);
          }
        }
      } else {
        // Export single version
        const snapshot = await this.restoreLayout(layoutId, { version });
        exportData = {
          layoutId,
          exportDate: Date.now(),
          format: 'single-version',
          snapshot: this.currentSnapshot
        };
      }
      
      // Format the export data
      switch (format) {
        case 'json':
          return JSON.stringify(exportData, null, 2);
        case 'compact':
          return JSON.stringify(exportData);
        case 'object':
        default:
          return exportData;
      }
      
    } catch (error) {
      console.error('Failed to export layout:', error);
      if (this.config.onError) {
        this.config.onError('export', error, layoutId);
      }
      throw error;
    }
  }
  
  /**
   * Import layout data
   */
  async importLayout(exportData, options = {}) {
    try {
      let data = exportData;
      
      // Parse if string
      if (typeof exportData === 'string') {
        data = JSON.parse(exportData);
      }
      
      const layoutId = options.layoutId || data.layoutId || `imported-${Date.now()}`;
      const overwrite = options.overwrite || false;
      
      // Check if layout exists
      if (!overwrite && this.layoutHistory.has(layoutId)) {
        throw new Error(`Layout ${layoutId} already exists. Use overwrite option to replace.`);
      }
      
      if (data.format === 'multi-version') {
        // Import all versions
        for (const snapshot of data.versions) {
          await this._importSnapshot(layoutId, snapshot, { preserveVersion: true });
        }
      } else {
        // Import single version
        await this._importSnapshot(layoutId, data.snapshot, options);
      }
      
      return layoutId;
      
    } catch (error) {
      console.error('Failed to import layout:', error);
      if (this.config.onError) {
        this.config.onError('import', error);
      }
      throw error;
    }
  }
  
  /**
   * Clear all saved layouts
   */
  async clearAll() {
    try {
      // Delete all stored snapshots
      for (const [layoutId, versions] of this.layoutHistory) {
        for (const version of versions) {
          await this.storageInterface.delete(this._getSnapshotKey(layoutId, version.version));
        }
      }
      
      // Clear history
      this.layoutHistory.clear();
      this.currentSnapshot = null;
      
      // Reset stats
      this.stats.totalSaves = 0;
      this.stats.totalRestores = 0;
      this.stats.totalVersions = 0;
      this.stats.storageSize = 0;
      
      return true;
      
    } catch (error) {
      console.error('Failed to clear layouts:', error);
      if (this.config.onError) {
        this.config.onError('clear', error);
      }
      return false;
    }
  }
  
  /**
   * Get storage statistics
   */
  getStats() {
    return {
      ...this.stats,
      layoutCount: this.layoutHistory.size,
      totalVersions: Array.from(this.layoutHistory.values())
        .reduce((sum, versions) => sum + versions.length, 0),
      storageType: this.config.storageType,
      autoSaveEnabled: this.config.autoSave
    };
  }
  
  /**
   * Create storage interface based on configuration
   */
  _createStorageInterface() {
    switch (this.config.storageType) {
      case 'sessionStorage':
        return new SessionStorageInterface(this.config);
      case 'memory':
        return new MemoryStorageInterface(this.config);
      case 'file':
        return new FileStorageInterface(this.config);
      case 'localStorage':
      default:
        return new LocalStorageInterface(this.config);
    }
  }
  
  /**
   * Create a layout snapshot
   */
  _createSnapshot(layoutId, layoutData, options = {}) {
    const timestamp = Date.now();
    const version = this._generateVersion(layoutId, options);
    
    const snapshot = {
      id: layoutId,
      version,
      name: options.name || `Layout ${layoutId} - ${new Date(timestamp).toLocaleString()}`,
      timestamp,
      isAutoSave: options.isAutoSave || false,
      
      // Core layout data
      data: this._serializeLayoutData(layoutData),
      
      // Configuration
      config: options.config || {},
      
      // Optional metadata
      metadata: this.config.includeMetadata ? {
        algorithm: layoutData.metadata?.algorithm,
        nodeCount: layoutData.positions?.size,
        executionTime: layoutData.metadata?.executionTime,
        bounds: layoutData.bounds,
        ...options.metadata
      } : null,
      
      // Optional view state
      viewState: this.config.includeViewState ? options.viewState : null,
      
      // Schema version for future compatibility
      schemaVersion: '1.0.0'
    };
    
    return snapshot;
  }
  
  /**
   * Serialize layout data for storage
   */
  _serializeLayoutData(layoutData) {
    const serialized = {
      positions: layoutData.positions instanceof Map 
        ? Array.from(layoutData.positions.entries())
        : layoutData.positions,
      bounds: layoutData.bounds,
      metadata: layoutData.metadata
    };
    
    if (this.config.includeEdgePaths && layoutData.edges) {
      serialized.edges = layoutData.edges instanceof Map
        ? Array.from(layoutData.edges.entries())
        : layoutData.edges;
    }
    
    return serialized;
  }
  
  /**
   * Extract layout data from snapshot
   */
  _extractLayoutData(snapshot) {
    const data = snapshot.data;
    
    return {
      positions: new Map(Array.isArray(data.positions) ? data.positions : Object.entries(data.positions || {})),
      bounds: data.bounds || { x: 0, y: 0, width: 0, height: 0 },
      edges: data.edges ? new Map(Array.isArray(data.edges) ? data.edges : Object.entries(data.edges)) : new Map(),
      metadata: {
        ...data.metadata,
        restored: true,
        restoredFrom: snapshot.version,
        restoredAt: Date.now()
      }
    };
  }
  
  /**
   * Validate snapshot data
   */
  _validateSnapshot(snapshot) {
    if (!snapshot) {
      throw new Error('Snapshot is null or undefined');
    }
    
    if (!snapshot.id || !snapshot.version || !snapshot.data) {
      throw new Error('Invalid snapshot structure');
    }
    
    if (!snapshot.data.positions) {
      throw new Error('Snapshot missing positions data');
    }
  }
  
  /**
   * Generate version identifier
   */
  _generateVersion(layoutId, options = {}) {
    if (options.version) {
      return options.version;
    }
    
    switch (this.config.versionNaming) {
      case 'sequential':
        const versions = this.layoutHistory.get(layoutId) || [];
        return `v${versions.length + 1}`;
      case 'custom':
        return options.customVersion || `custom-${Date.now()}`;
      case 'timestamp':
      default:
        return Date.now().toString();
    }
  }
  
  /**
   * Get snapshot storage key
   */
  _getSnapshotKey(layoutId, version) {
    return `${this.config.storagePrefix}:${layoutId}:${version}`;
  }
  
  /**
   * Get latest snapshot key for a layout
   */
  _getLatestSnapshotKey(layoutId) {
    const versions = this.layoutHistory.get(layoutId);
    if (!versions || versions.length === 0) {
      return null;
    }
    
    const latest = versions[versions.length - 1];
    return this._getSnapshotKey(layoutId, latest.version);
  }
  
  /**
   * Update layout history
   */
  _updateLayoutHistory(layoutId, snapshot) {
    if (!this.layoutHistory.has(layoutId)) {
      this.layoutHistory.set(layoutId, []);
    }
    
    const versions = this.layoutHistory.get(layoutId);
    versions.push({
      version: snapshot.version,
      name: snapshot.name,
      timestamp: snapshot.timestamp,
      isAutoSave: snapshot.isAutoSave
    });
    
    // Sort by timestamp
    versions.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Load layout history from storage
   */
  async _loadLayoutHistory() {
    try {
      const historyKey = `${this.config.storagePrefix}:history`;
      const historyData = await this.storageInterface.load(historyKey);
      
      if (historyData) {
        this.layoutHistory = new Map(historyData);
      }
    } catch (error) {
      console.warn('Failed to load layout history:', error);
    }
  }
  
  /**
   * Save layout history to storage
   */
  async _saveLayoutHistory() {
    try {
      const historyKey = `${this.config.storagePrefix}:history`;
      await this.storageInterface.save(historyKey, Array.from(this.layoutHistory.entries()));
    } catch (error) {
      console.warn('Failed to save layout history:', error);
    }
  }
  
  /**
   * Clean up old versions
   */
  async _cleanupOldVersions(layoutId) {
    if (!this.config.enableVersioning) return;
    
    const versions = this.layoutHistory.get(layoutId);
    if (!versions || versions.length <= this.config.maxVersions) return;
    
    // Remove oldest versions
    const toRemove = versions.splice(0, versions.length - this.config.maxVersions);
    
    for (const version of toRemove) {
      try {
        await this.storageInterface.delete(this._getSnapshotKey(layoutId, version.version));
      } catch (error) {
        console.warn('Failed to delete old version:', error);
      }
    }
  }
  
  /**
   * Import a single snapshot
   */
  async _importSnapshot(layoutId, snapshot, options = {}) {
    // Update layout ID if needed
    const updatedSnapshot = { ...snapshot, id: layoutId };
    
    if (!options.preserveVersion) {
      updatedSnapshot.version = this._generateVersion(layoutId, options);
      updatedSnapshot.timestamp = Date.now();
    }
    
    // Save snapshot
    await this.storageInterface.save(
      this._getSnapshotKey(layoutId, updatedSnapshot.version), 
      updatedSnapshot
    );
    
    // Update history
    this._updateLayoutHistory(layoutId, updatedSnapshot);
  }
  
  /**
   * Update storage size statistics
   */
  _updateStorageSize() {
    // Rough estimation - in real implementation might query actual storage usage
    let totalSize = 0;
    for (const versions of this.layoutHistory.values()) {
      totalSize += versions.length * 1024; // Rough estimate
    }
    this.stats.storageSize = totalSize;
  }
  
  /**
   * Cleanup and destroy
   */
  destroy() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
    
    if (this.storageInterface && typeof this.storageInterface.destroy === 'function') {
      this.storageInterface.destroy();
    }
    
    this.layoutHistory.clear();
    this.currentSnapshot = null;
    this.isInitialized = false;
  }
}

/**
 * LocalStorage interface
 */
class LocalStorageInterface {
  constructor(config) {
    this.config = config;
  }
  
  async initialize() {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage not available');
    }
  }
  
  async save(key, data) {
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
  }
  
  async load(key) {
    const serialized = localStorage.getItem(key);
    return serialized ? JSON.parse(serialized) : null;
  }
  
  async delete(key) {
    localStorage.removeItem(key);
  }
}

/**
 * SessionStorage interface
 */
class SessionStorageInterface {
  constructor(config) {
    this.config = config;
  }
  
  async initialize() {
    if (typeof sessionStorage === 'undefined') {
      throw new Error('sessionStorage not available');
    }
  }
  
  async save(key, data) {
    const serialized = JSON.stringify(data);
    sessionStorage.setItem(key, serialized);
  }
  
  async load(key) {
    const serialized = sessionStorage.getItem(key);
    return serialized ? JSON.parse(serialized) : null;
  }
  
  async delete(key) {
    sessionStorage.removeItem(key);
  }
}

/**
 * Memory storage interface (for testing or temporary storage)
 */
class MemoryStorageInterface {
  constructor(config) {
    this.config = config;
    this.storage = new Map();
  }
  
  async initialize() {
    // Nothing to initialize for memory storage
  }
  
  async save(key, data) {
    this.storage.set(key, JSON.parse(JSON.stringify(data))); // Deep clone
  }
  
  async load(key) {
    const data = this.storage.get(key);
    return data ? JSON.parse(JSON.stringify(data)) : null; // Deep clone
  }
  
  async delete(key) {
    this.storage.delete(key);
  }
  
  destroy() {
    this.storage.clear();
  }
}

/**
 * File storage interface (placeholder for future implementation)
 */
class FileStorageInterface {
  constructor(config) {
    this.config = config;
  }
  
  async initialize() {
    throw new Error('File storage not implemented yet');
  }
  
  async save(key, data) {
    throw new Error('File storage not implemented yet');
  }
  
  async load(key) {
    throw new Error('File storage not implemented yet');
  }
  
  async delete(key) {
    throw new Error('File storage not implemented yet');
  }
}

export default LayoutPersistenceManager;