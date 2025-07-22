/**
 * StateCaptureSystem - Comprehensive state capture and serialization
 * 
 * Provides handle state serialization, plan state capture, validation result storage,
 * and incremental state capture functionality
 */

import { createHash } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';

export class StateCaptureSystem {
  constructor(plan, handleRegistry, toolRegistry, options = {}) {
    this.plan = plan;
    this.handleRegistry = handleRegistry;
    this.toolRegistry = toolRegistry;
    
    this.options = {
      includeHandleData: options.includeHandleData !== false,
      includeMetadata: options.includeMetadata !== false,
      compressData: options.compressData || false,
      validateOnCapture: options.validateOnCapture !== false,
      maxDepth: options.maxDepth || 10,
      ...options
    };

    this.statistics = {
      totalCaptures: 0,
      totalSize: 0,
      averageSize: 0,
      lastCaptureTime: null,
      captureTypes: {}
    };

    this.performanceMetrics = {
      totalCaptureTime: 0,
      averageCaptureTime: 0,
      lastCaptureTime: 0
    };

    this.validationResults = new Map();
    this.validationHistory = new Map();
    this.captures = new Map();
  }

  /**
   * Serialize handle state
   */
  serializeHandleState() {
    const serialized = {};
    const handles = this.handleRegistry.listHandles();
    
    for (const handle of handles) {
      const handleMetadata = handle.metadata || {};
      serialized[handle.name] = {
        id: handle.id,
        name: handle.name,
        metadata: this._deepCopy(handleMetadata),
        createdAt: handleMetadata.createdAt,
        accessedAt: handleMetadata.accessedAt
      };

      if (this.options.includeHandleData) {
        serialized[handle.name].data = this._serializeData(handle.data);
      }
    }
    
    return serialized;
  }

  /**
   * Capture current plan state
   */
  capturePlanState() {
    const planState = {
      id: this.plan.id,
      title: this.plan.title,
      description: this.plan.description,
      steps: this._deepCopy(this.plan.steps),
      status: this.plan.state.status,
      currentStep: this.plan.state.currentStep,
      completedSteps: [...this.plan.state.completedSteps],
      failedSteps: [...this.plan.state.failedSteps],
      stepStates: this._deepCopy(this.plan.state.stepStates),
      handles: this._deepCopy(this.plan.state.handles),
      statusHistory: this._deepCopy(this.plan.state.statusHistory)
    };

    // Include validation if requested
    if (this.options.validateOnCapture) {
      planState.validation = this.plan.validateState();
    }

    // Include metadata if enabled
    if (this.options.includeMetadata) {
      planState.metadata = this._deepCopy(this.plan.metadata);
      planState.captureMetadata = {
        capturedAt: new Date(),
        captureVersion: '1.0.0',
        capturerId: 'StateCaptureSystem'
      };
    }

    return planState;
  }

  /**
   * Store validation result
   */
  storeValidationResult(type, validation) {
    const result = {
      ...validation,
      timestamp: new Date(),
      type
    };

    this.validationResults.set(type, result);
    
    // Store in history
    if (!this.validationHistory.has(type)) {
      this.validationHistory.set(type, []);
    }
    this.validationHistory.get(type).push(result);

    // Keep only last 10 results in history
    const history = this.validationHistory.get(type);
    if (history.length > 10) {
      this.validationHistory.set(type, history.slice(-10));
    }
  }

  /**
   * Get validation result
   */
  getValidationResult(type) {
    return this.validationResults.get(type) || null;
  }

  /**
   * Get all validation results
   */
  getAllValidationResults() {
    const results = {};
    for (const [type, result] of this.validationResults) {
      results[type] = result;
    }
    return results;
  }

  /**
   * Get validation history
   */
  getValidationHistory(type) {
    return this.validationHistory.get(type) || [];
  }

  /**
   * Clean up old validation results
   */
  cleanupValidationResults(maxAge) {
    const cutoffTime = new Date(Date.now() - maxAge);
    let cleaned = 0;

    for (const [type, result] of this.validationResults) {
      if (result.timestamp < cutoffTime) {
        this.validationResults.delete(type);
        cleaned++;
      }
    }

    // Clean history as well
    for (const [type, history] of this.validationHistory) {
      const filteredHistory = history.filter(result => result.timestamp >= cutoffTime);
      this.validationHistory.set(type, filteredHistory);
    }

    return cleaned;
  }

  /**
   * Create full state capture
   */
  createFullCapture(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error('Invalid capture name');
    }

    const startTime = performance.now();
    const captureId = `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const planState = this.capturePlanState();
      const handles = this.serializeHandleState();

      let capture = {
        id: captureId,
        name,
        type: 'full',
        createdAt: new Date(),
        planState,
        handles,
        metadata: {
          captureSize: 0,
          handleCount: Object.keys(handles).length,
          stepCount: this.plan.steps.length,
          captureTime: 0,
          compressed: false
        }
      };

      // Calculate size before potential compression
      const captureData = JSON.stringify(capture);
      const originalSize = captureData.length;
      capture.metadata.originalSize = originalSize;

      if (this.options.compressData) {
        const compressed = gzipSync(captureData);
        capture = {
          ...capture,
          _compressed: compressed.toString('base64'),
          metadata: {
            ...capture.metadata,
            compressed: true,
            compressedSize: compressed.length
          }
        };
        // Remove uncompressed data
        delete capture.planState;
        delete capture.handles;
      }

      const endTime = performance.now();
      const captureTime = Math.max(1, Math.round(endTime - startTime)); // Ensure at least 1ms
      
      capture.metadata.captureTime = captureTime;
      capture.metadata.captureSize = this.options.compressData ? 
        capture.metadata.compressedSize : originalSize;

      // Update statistics
      this.statistics.totalCaptures++;
      this.statistics.totalSize += capture.metadata.captureSize;
      this.statistics.averageSize = this.statistics.totalSize / this.statistics.totalCaptures;
      this.statistics.lastCaptureTime = new Date();
      this.statistics.captureTypes.full = (this.statistics.captureTypes.full || 0) + 1;

      // Update performance metrics
      this.performanceMetrics.totalCaptureTime += captureTime;
      this.performanceMetrics.averageCaptureTime = 
        this.performanceMetrics.totalCaptureTime / this.statistics.totalCaptures;
      this.performanceMetrics.lastCaptureTime = captureTime;

      this.captures.set(captureId, capture);
      return capture;

    } catch (error) {
      throw new Error(`Failed to create full capture: ${error.message}`);
    }
  }

  /**
   * Create incremental state capture
   */
  createIncremental(name, baseCapture) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error('Invalid capture name');
    }

    if (!baseCapture || !baseCapture.id) {
      throw new Error('Invalid base capture');
    }

    const captureId = `inc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const currentState = {
        planState: this.capturePlanState(),
        handles: this.serializeHandleState()
      };

      // Get base state (decompress if needed)
      const baseState = this._getDecompressedCapture(baseCapture);

      // Calculate changes
      const changes = {
        planState: this._diffPlanState(baseState.planState, currentState.planState),
        handles: this._diffHandles(baseState.handles, currentState.handles)
      };

      const endTime = Date.now();
      const capture = {
        id: captureId,
        name,
        type: 'incremental',
        basedOn: baseCapture.id,
        createdAt: new Date(),
        changes,
        metadata: {
          captureSize: JSON.stringify(changes).length,
          captureTime: endTime - startTime,
          changeCount: this._countChanges(changes)
        }
      };

      this.statistics.totalCaptures++;
      this.statistics.captureTypes.incremental = (this.statistics.captureTypes.incremental || 0) + 1;
      
      this.captures.set(captureId, capture);
      return capture;

    } catch (error) {
      throw new Error(`Failed to create incremental capture: ${error.message}`);
    }
  }

  /**
   * Apply incremental changes to base capture
   */
  applyIncremental(baseCapture, incrementalCapture) {
    const baseState = this._getDecompressedCapture(baseCapture);
    const changes = incrementalCapture.changes;

    // Apply plan state changes
    const planState = this._applyPlanStateChanges(baseState.planState, changes.planState);
    
    // Apply handle changes
    const handles = this._applyHandleChanges(baseState.handles, changes.handles);

    return {
      id: `applied-${Date.now()}`,
      type: 'applied',
      createdAt: new Date(),
      planState,
      handles,
      metadata: {
        appliedFrom: [baseCapture.id, incrementalCapture.id]
      }
    };
  }

  /**
   * Optimize incremental chain
   */
  optimizeIncrementalChain(captures) {
    if (captures.length <= 2) return captures;

    // Find base capture
    const base = captures.find(c => c.type === 'full');
    if (!base) return captures;

    // Combine all incremental changes
    const incrementals = captures.filter(c => c.type === 'incremental');
    const combinedChanges = this._combineIncrementalChanges(incrementals);

    // Create optimized incremental
    const optimized = {
      id: `opt-${Date.now()}`,
      name: 'optimized-chain',
      type: 'incremental',
      basedOn: base.id,
      createdAt: new Date(),
      changes: combinedChanges,
      metadata: {
        optimizedFrom: captures.map(c => c.id),
        originalCount: captures.length
      }
    };

    return [base, optimized];
  }

  /**
   * Compare two state captures
   */
  compareCaptures(capture1, capture2) {
    const state1 = this._getDecompressedCapture(capture1);
    const state2 = this._getDecompressedCapture(capture2);

    const planStateDiff = this._diffPlanState(state1.planState, state2.planState);
    const handlesDiff = this._diffHandles(state1.handles, state2.handles);

    return {
      planState: {
        changed: this._hasChanges(planStateDiff),
        changes: planStateDiff
      },
      handles: {
        added: Object.keys(handlesDiff.added || {}),
        removed: Object.keys(handlesDiff.removed || {}),
        modified: Object.keys(handlesDiff.modified || {}),
        changes: handlesDiff
      },
      summary: {
        totalChanges: this._countChanges({ planState: planStateDiff, handles: handlesDiff }),
        planStateChanges: this._countChanges(planStateDiff),
        handleChanges: this._countChanges(handlesDiff)
      }
    };
  }

  /**
   * Validate captured state
   */
  validateCapture(capture) {
    const validation = {
      valid: true,
      errors: [],
      integrity: 'valid'
    };

    try {
      // Check basic structure
      if (!capture.id || !capture.type || !capture.createdAt) {
        validation.valid = false;
        validation.errors.push('Missing required capture fields');
      }

      // Check plan state
      if (capture.planState === null || capture.planState === undefined) {
        validation.valid = false;
        validation.errors.push('Plan state is missing or null');
        validation.integrity = 'corrupted';
      }

      // Check handles
      if (capture.handles === null || capture.handles === undefined) {
        validation.valid = false;
        validation.errors.push('Handle state is missing or null');
        validation.integrity = 'corrupted';
      }

      // Validate compressed data
      if (capture.metadata?.compressed && !capture._compressed) {
        validation.valid = false;
        validation.errors.push('Compressed capture missing compressed data');
        validation.integrity = 'corrupted';
      }

    } catch (error) {
      validation.valid = false;
      validation.errors.push(`Validation error: ${error.message}`);
      validation.integrity = 'corrupted';
    }

    return validation;
  }

  /**
   * Get capture statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Serialize data with circular reference handling
   * @private
   */
  _serializeData(data, depth = 0, seen = new WeakSet()) {
    if (data === null || typeof data !== 'object') {
      return data;
    }

    if (data instanceof Date) {
      return data;
    }

    if (depth >= this.options.maxDepth) {
      return '[Max Depth Exceeded]';
    }

    if (seen.has(data)) {
      return '[Circular Reference]';
    }

    try {
      seen.add(data);

      if (Array.isArray(data)) {
        return data.map(item => this._serializeData(item, depth + 1, seen));
      }

      const serialized = {};
      for (const [key, value] of Object.entries(data)) {
        serialized[key] = this._serializeData(value, depth + 1, seen);
      }
      
      return serialized;

    } catch (error) {
      return '[Serialization Error]';
    }
  }

  /**
   * Deep copy with date preservation
   * @private
   */
  _deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (Array.isArray(obj)) return obj.map(item => this._deepCopy(item));
    
    const copied = {};
    for (const [key, value] of Object.entries(obj)) {
      copied[key] = this._deepCopy(value);
    }
    return copied;
  }

  /**
   * Get decompressed capture
   * @private
   */
  _getDecompressedCapture(capture) {
    if (!capture.metadata?.compressed) {
      return capture;
    }

    try {
      const compressed = Buffer.from(capture._compressed, 'base64');
      const decompressed = gunzipSync(compressed);
      return JSON.parse(decompressed.toString());
    } catch (error) {
      throw new Error(`Failed to decompress capture: ${error.message}`);
    }
  }

  /**
   * Diff plan states
   * @private
   */
  _diffPlanState(oldState, newState) {
    const changes = {};

    // Compare simple properties
    const simpleProps = ['status', 'currentStep'];
    for (const prop of simpleProps) {
      if (oldState[prop] !== newState[prop]) {
        changes[prop] = { from: oldState[prop], to: newState[prop] };
      }
    }

    // Compare arrays
    const arrayProps = ['completedSteps', 'failedSteps'];
    for (const prop of arrayProps) {
      const oldSet = new Set(oldState[prop] || []);
      const newSet = new Set(newState[prop] || []);
      
      const added = [...newSet].filter(item => !oldSet.has(item));
      const removed = [...oldSet].filter(item => !newSet.has(item));
      
      if (added.length > 0 || removed.length > 0) {
        changes[prop] = { added, removed };
      }
    }

    // Compare step states
    const oldStepStates = oldState.stepStates || {};
    const newStepStates = newState.stepStates || {};
    const allSteps = new Set([...Object.keys(oldStepStates), ...Object.keys(newStepStates)]);
    
    const stepStateChanges = {};
    for (const stepId of allSteps) {
      const oldStep = oldStepStates[stepId];
      const newStep = newStepStates[stepId];
      
      if (!oldStep && newStep) {
        stepStateChanges[stepId] = { type: 'added', state: newStep };
      } else if (oldStep && !newStep) {
        stepStateChanges[stepId] = { type: 'removed', state: oldStep };
      } else if (JSON.stringify(oldStep) !== JSON.stringify(newStep)) {
        stepStateChanges[stepId] = { type: 'modified', from: oldStep, to: newStep };
      }
    }
    
    if (Object.keys(stepStateChanges).length > 0) {
      changes.stepStates = stepStateChanges;
    }

    return changes;
  }

  /**
   * Diff handle states
   * @private
   */
  _diffHandles(oldHandles, newHandles) {
    const changes = {
      added: {},
      removed: {},
      modified: {}
    };

    const allHandles = new Set([...Object.keys(oldHandles), ...Object.keys(newHandles)]);
    
    for (const handleName of allHandles) {
      const oldHandle = oldHandles[handleName];
      const newHandle = newHandles[handleName];
      
      if (!oldHandle && newHandle) {
        changes.added[handleName] = newHandle;
      } else if (oldHandle && !newHandle) {
        changes.removed[handleName] = oldHandle;
      } else if (JSON.stringify(oldHandle) !== JSON.stringify(newHandle)) {
        changes.modified[handleName] = { from: oldHandle, to: newHandle };
      }
    }

    return changes;
  }

  /**
   * Apply plan state changes
   * @private
   */
  _applyPlanStateChanges(baseState, changes) {
    const newState = this._deepCopy(baseState);

    // Apply simple property changes
    for (const [prop, change] of Object.entries(changes)) {
      if (change.to !== undefined) {
        newState[prop] = change.to;
      }
    }

    // Apply array changes
    if (changes.completedSteps) {
      const current = new Set(newState.completedSteps || []);
      changes.completedSteps.added?.forEach(step => current.add(step));
      changes.completedSteps.removed?.forEach(step => current.delete(step));
      newState.completedSteps = [...current];
    }

    if (changes.failedSteps) {
      const current = new Set(newState.failedSteps || []);
      changes.failedSteps.added?.forEach(step => current.add(step));
      changes.failedSteps.removed?.forEach(step => current.delete(step));
      newState.failedSteps = [...current];
    }

    // Apply step state changes
    if (changes.stepStates) {
      newState.stepStates = newState.stepStates || {};
      for (const [stepId, change] of Object.entries(changes.stepStates)) {
        if (change.type === 'added') {
          newState.stepStates[stepId] = change.state;
        } else if (change.type === 'removed') {
          delete newState.stepStates[stepId];
        } else if (change.type === 'modified') {
          newState.stepStates[stepId] = change.to;
        }
      }
    }

    return newState;
  }

  /**
   * Apply handle changes
   * @private
   */
  _applyHandleChanges(baseHandles, changes) {
    const newHandles = this._deepCopy(baseHandles);

    // Apply added handles
    Object.assign(newHandles, changes.added || {});

    // Remove deleted handles
    for (const handleName of Object.keys(changes.removed || {})) {
      delete newHandles[handleName];
    }

    // Apply modified handles
    for (const [handleName, change] of Object.entries(changes.modified || {})) {
      newHandles[handleName] = change.to;
    }

    return newHandles;
  }

  /**
   * Combine incremental changes
   * @private
   */
  _combineIncrementalChanges(incrementals) {
    // This is a simplified combination - in practice would need more sophisticated merging
    const combined = {
      planState: {},
      handles: { added: {}, removed: {}, modified: {} }
    };

    for (const incremental of incrementals) {
      const changes = incremental.changes;
      
      // Combine plan state changes
      Object.assign(combined.planState, changes.planState);
      
      // Combine handle changes
      Object.assign(combined.handles.added, changes.handles.added || {});
      Object.assign(combined.handles.removed, changes.handles.removed || {});
      Object.assign(combined.handles.modified, changes.handles.modified || {});
    }

    return combined;
  }

  /**
   * Count changes in diff
   * @private
   */
  _countChanges(changes) {
    let count = 0;
    
    const countObject = (obj) => {
      if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          count += obj.length;
        } else {
          for (const value of Object.values(obj)) {
            if (value && typeof value === 'object') {
              countObject(value);
            } else {
              count++;
            }
          }
        }
      } else {
        count++;
      }
    };

    countObject(changes);
    return count;
  }

  /**
   * Check if changes exist
   * @private
   */
  _hasChanges(changes) {
    return Object.keys(changes).length > 0;
  }
}