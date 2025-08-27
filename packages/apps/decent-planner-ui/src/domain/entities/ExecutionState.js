/**
 * ExecutionState Entity
 * Represents the state of behavior tree execution
 */

import { ExecutionStatus } from '../value-objects/ExecutionStatus.js';

export class ExecutionState {
  constructor(behaviorTree) {
    if (!behaviorTree) {
      throw new Error('Behavior tree is required');
    }
    
    this.behaviorTree = behaviorTree;
    this.status = ExecutionStatus.IDLE;
    this.currentNode = null;
    this.executionHistory = [];
    this.breakpoints = new Set();
    this.nodeStates = new Map(); // node id -> state
    this.startedAt = null;
    this.pausedAt = null;
    this.completedAt = null;
    this.error = null;
  }
  
  start() {
    if (this.status !== ExecutionStatus.IDLE && 
        this.status !== ExecutionStatus.COMPLETED) {
      throw new Error(`Cannot start execution in status: ${this.status}`);
    }
    
    this.status = ExecutionStatus.RUNNING;
    this.startedAt = new Date();
    this.completedAt = null;
    this.error = null;
    this.executionHistory = [];
    this.nodeStates.clear();
  }
  
  pause() {
    if (this.status !== ExecutionStatus.RUNNING) {
      throw new Error(`Cannot pause execution in status: ${this.status}`);
    }
    
    this.status = ExecutionStatus.PAUSED;
    this.pausedAt = new Date();
  }
  
  resume() {
    if (this.status !== ExecutionStatus.PAUSED) {
      throw new Error(`Cannot resume execution in status: ${this.status}`);
    }
    
    this.status = ExecutionStatus.RUNNING;
    this.pausedAt = null;
  }
  
  complete(success = true) {
    if (this.status !== ExecutionStatus.RUNNING) {
      throw new Error(`Cannot complete execution in status: ${this.status}`);
    }
    
    this.status = success ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED;
    this.completedAt = new Date();
  }
  
  reset() {
    this.status = ExecutionStatus.IDLE;
    this.currentNode = null;
    this.executionHistory = [];
    this.nodeStates.clear();
    this.startedAt = null;
    this.pausedAt = null;
    this.completedAt = null;
    this.error = null;
  }
  
  setCurrentNode(nodeId) {
    this.currentNode = nodeId;
    this.addToHistory({
      type: 'node_entered',
      nodeId,
      timestamp: new Date()
    });
  }
  
  setNodeState(nodeId, state) {
    this.nodeStates.set(nodeId, state);
    this.addToHistory({
      type: 'state_changed',
      nodeId,
      state,
      timestamp: new Date()
    });
  }
  
  addBreakpoint(nodeId) {
    this.breakpoints.add(nodeId);
  }
  
  removeBreakpoint(nodeId) {
    this.breakpoints.delete(nodeId);
  }
  
  hasBreakpoint(nodeId) {
    return this.breakpoints.has(nodeId);
  }
  
  addToHistory(event) {
    this.executionHistory.push(event);
    
    // Keep history size reasonable
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-500);
    }
  }
  
  setError(error) {
    this.error = error;
    this.status = ExecutionStatus.FAILED;
    this.completedAt = new Date();
  }
  
  isRunning() {
    return this.status === ExecutionStatus.RUNNING;
  }
  
  isPaused() {
    return this.status === ExecutionStatus.PAUSED;
  }
  
  isComplete() {
    return this.status === ExecutionStatus.COMPLETED || 
           this.status === ExecutionStatus.FAILED;
  }
  
  canStep() {
    return this.status === ExecutionStatus.PAUSED || 
           this.status === ExecutionStatus.IDLE;
  }
  
  getDuration() {
    if (!this.startedAt) return 0;
    const endTime = this.completedAt || new Date();
    return endTime - this.startedAt;
  }
  
  toJSON() {
    return {
      status: this.status,
      currentNode: this.currentNode,
      breakpoints: Array.from(this.breakpoints),
      nodeStates: Object.fromEntries(this.nodeStates),
      historyLength: this.executionHistory.length,
      startedAt: this.startedAt,
      pausedAt: this.pausedAt,
      completedAt: this.completedAt,
      duration: this.getDuration(),
      hasError: this.error !== null
    };
  }
}