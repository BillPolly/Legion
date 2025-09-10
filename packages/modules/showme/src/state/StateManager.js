/**
 * StateManager
 * 
 * Manages undo/redo history, state snapshots, and dirty state tracking
 * Implements command pattern for all diagram operations
 */

export class StateManager {
  constructor(config = {}) {
    this.config = {
      maxHistorySize: 100,
      enableCompression: true,
      autoSaveInterval: 30000, // 30 seconds
      onAutoSave: null,
      ...config
    };

    // Command history
    this.undoStack = [];
    this.redoStack = [];
    
    // State snapshots
    this.snapshots = new Map();
    this.snapshotCounter = 0;
    
    // Dirty state tracking
    this.dirty = false;
    this.cleanPosition = 0;
    this.currentPosition = 0;
    
    // Auto-save
    this.autoSaveEnabled = false;
    this.autoSaveTimer = null;
  }

  /**
   * Get current configuration
   * @returns {Object} Configuration object
   */
  getConfiguration() {
    return { ...this.config };
  }

  /**
   * Execute a command and add to history
   * @param {Command} command - Command to execute
   * @param {Object} context - Context to execute command on
   * @returns {Object} Result of command execution
   */
  execute(command, context) {
    const result = command.execute(context);
    
    if (result.success) {
      // Clear redo stack when new command is executed
      this.redoStack = [];
      
      // Add to undo stack
      this.undoStack.push(command);
      
      // Enforce max history size
      if (this.undoStack.length > this.config.maxHistorySize) {
        this.undoStack.shift();
      }
      
      // Update position and dirty state
      this.currentPosition++;
      this.updateDirtyState();
      
      // Trigger auto-save if needed
      this.triggerAutoSaveIfNeeded();
    }
    
    return result;
  }

  /**
   * Undo the last command
   * @param {Object} context - Context to undo command on
   * @returns {Object} Result of undo operation
   */
  undo(context) {
    if (!this.canUndo()) {
      return { success: false, error: 'Nothing to undo' };
    }
    
    const command = this.undoStack.pop();
    const result = command.undo(context);
    
    if (result.success) {
      this.redoStack.push(command);
      this.currentPosition--;
      this.updateDirtyState();
      this.triggerAutoSaveIfNeeded();
    }
    
    return result;
  }

  /**
   * Redo the last undone command
   * @param {Object} context - Context to redo command on
   * @returns {Object} Result of redo operation
   */
  redo(context) {
    if (!this.canRedo()) {
      return { success: false, error: 'Nothing to redo' };
    }
    
    const command = this.redoStack.pop();
    const result = command.execute(context);
    
    if (result.success) {
      this.undoStack.push(command);
      this.currentPosition++;
      this.updateDirtyState();
      this.triggerAutoSaveIfNeeded();
    }
    
    return result;
  }

  /**
   * Check if undo is available
   * @returns {boolean} True if can undo
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean} True if can redo
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Get size of undo history
   * @returns {number} Number of commands in history
   */
  getHistorySize() {
    return this.undoStack.length;
  }

  /**
   * Get current position in history
   * @returns {number} Current position index
   */
  getCurrentPosition() {
    return this.currentPosition;
  }

  /**
   * Get command history descriptions
   * @returns {Array<string>} Array of command descriptions
   */
  getCommandHistory() {
    return this.undoStack.map(cmd => cmd.getDescription());
  }

  /**
   * Clear all history
   */
  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
    this.currentPosition = 0;
    this.cleanPosition = 0;
    this.dirty = false;
  }

  /**
   * Create a state snapshot
   * @param {Object} state - State to snapshot
   * @returns {Object} Snapshot object with id and timestamp
   */
  createSnapshot(state) {
    const id = `snapshot_${Date.now()}_${this.snapshotCounter++}`;
    
    let snapshotData;
    let compressed = false;
    
    if (this.config.enableCompression) {
      // Simple compression: JSON stringify and mark as compressed
      // In production, would use actual compression library
      snapshotData = JSON.stringify(state);
      compressed = true;
    } else {
      // Deep clone the state
      snapshotData = JSON.parse(JSON.stringify(state));
    }
    
    const snapshot = {
      id,
      timestamp: Date.now(),
      state: snapshotData,
      compressed,
      position: this.currentPosition
    };
    
    this.snapshots.set(id, snapshot);
    
    return {
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      state: compressed ? state : snapshot.state,
      compressed: snapshot.compressed
    };
  }

  /**
   * Restore state from snapshot
   * @param {Object} snapshot - Snapshot to restore
   * @returns {Object} Restored state
   */
  restoreSnapshot(snapshot) {
    const stored = this.snapshots.get(snapshot.id);
    
    if (!stored) {
      // Try to use the provided snapshot directly
      if (snapshot.compressed && typeof snapshot.state === 'string') {
        return JSON.parse(snapshot.state);
      }
      return JSON.parse(JSON.stringify(snapshot.state));
    }
    
    if (stored.compressed) {
      return JSON.parse(stored.state);
    }
    
    return JSON.parse(JSON.stringify(stored.state));
  }

  /**
   * Get all snapshots
   * @returns {Array} Array of snapshots
   */
  getSnapshots() {
    return Array.from(this.snapshots.values()).map(snap => ({
      id: snap.id,
      timestamp: snap.timestamp,
      state: snap.compressed ? JSON.parse(snap.state) : snap.state,
      compressed: snap.compressed
    }));
  }

  /**
   * Get snapshot by ID
   * @param {string} id - Snapshot ID
   * @returns {Object|null} Snapshot or null if not found
   */
  getSnapshot(id) {
    const snapshot = this.snapshots.get(id);
    
    if (!snapshot) {
      return null;
    }
    
    return {
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      state: snapshot.compressed ? JSON.parse(snapshot.state) : snapshot.state,
      compressed: snapshot.compressed
    };
  }

  /**
   * Delete snapshot by ID
   * @param {string} id - Snapshot ID
   * @returns {boolean} True if deleted
   */
  deleteSnapshot(id) {
    return this.snapshots.delete(id);
  }

  /**
   * Clear all snapshots
   */
  clearSnapshots() {
    this.snapshots.clear();
  }

  /**
   * Check if state is dirty (has unsaved changes)
   * @returns {boolean} True if dirty
   */
  isDirty() {
    return this.dirty;
  }

  /**
   * Mark state as clean (saved)
   */
  markClean() {
    this.cleanPosition = this.currentPosition;
    this.dirty = false;
  }

  /**
   * Update dirty state based on current position
   * @private
   */
  updateDirtyState() {
    this.dirty = this.currentPosition !== this.cleanPosition;
  }

  /**
   * Enable or disable auto-save
   * @param {boolean} enabled - Whether to enable auto-save
   */
  enableAutoSave(enabled) {
    this.autoSaveEnabled = enabled;
    
    if (!enabled && this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    } else if (enabled && !this.autoSaveTimer) {
      this.startAutoSaveTimer();
    }
  }

  /**
   * Start auto-save timer
   * @private
   */
  startAutoSaveTimer() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(() => {
      this.performAutoSave();
    }, this.config.autoSaveInterval);
  }

  /**
   * Perform auto-save
   * @private
   */
  performAutoSave() {
    if (this.isDirty() && this.config.onAutoSave) {
      this.config.onAutoSave({
        isDirty: this.isDirty(),
        historySize: this.getHistorySize(),
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      });
    }
  }

  /**
   * Trigger auto-save if needed
   * @private
   */
  triggerAutoSaveIfNeeded() {
    if (this.autoSaveEnabled && this.isDirty()) {
      // Reset timer to delay auto-save after changes
      if (this.autoSaveTimer) {
        clearInterval(this.autoSaveTimer);
        this.startAutoSaveTimer();
      }
    }
  }

  /**
   * Destroy manager and clean up resources
   */
  destroy() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    
    this.clearHistory();
    this.clearSnapshots();
  }
}