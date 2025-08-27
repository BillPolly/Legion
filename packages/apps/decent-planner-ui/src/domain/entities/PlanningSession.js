/**
 * PlanningSession Entity
 * Core domain entity representing a planning session
 */

import { PlanningGoal } from '../value-objects/PlanningGoal.js';
import { PlanningMode } from '../value-objects/PlanningMode.js';
import { PlanningSessionId } from '../value-objects/PlanningSessionId.js';

export class PlanningSession {
  constructor(goal) {
    this.id = new PlanningSessionId();
    this.goal = new PlanningGoal(goal);
    this.mode = PlanningMode.IDLE;
    this.startedAt = new Date();
    this.completedAt = null;
    
    // Results from different planning phases
    this.informalResult = null;
    this.formalResult = null;
    this.toolDiscoveryResult = null;
    
    // Execution state
    this.behaviorTree = null;
    this.executionState = null;
    
    // Error tracking
    this.error = null;
    
    // Progress tracking
    this.progressMessages = [];
  }
  
  startInformalPlanning() {
    if (this.mode !== PlanningMode.IDLE) {
      throw new Error(`Cannot start informal planning in mode: ${this.mode}`);
    }
    this.mode = PlanningMode.INFORMAL;
    this.error = null;
  }
  
  completeInformalPlanning(result) {
    if (this.mode !== PlanningMode.INFORMAL) {
      throw new Error(`Cannot complete informal planning in mode: ${this.mode}`);
    }
    this.informalResult = result;
    this.mode = PlanningMode.INFORMAL_COMPLETE;
  }
  
  startFormalPlanning() {
    if (this.mode !== PlanningMode.INFORMAL_COMPLETE && 
        this.mode !== PlanningMode.TOOLS_DISCOVERED) {
      throw new Error(`Cannot start formal planning in mode: ${this.mode}`);
    }
    this.mode = PlanningMode.FORMAL;
    this.error = null;
  }
  
  completeFormalPlanning(result) {
    if (this.mode !== PlanningMode.FORMAL) {
      throw new Error(`Cannot complete formal planning in mode: ${this.mode}`);
    }
    this.formalResult = result;
    this.mode = PlanningMode.COMPLETE;
    this.completedAt = new Date();
  }
  
  startToolDiscovery() {
    if (this.mode !== PlanningMode.INFORMAL_COMPLETE) {
      throw new Error(`Cannot start tool discovery in mode: ${this.mode}`);
    }
    this.mode = PlanningMode.DISCOVERING_TOOLS;
    this.error = null;
  }
  
  completeToolDiscovery(result) {
    if (this.mode !== PlanningMode.DISCOVERING_TOOLS) {
      throw new Error(`Cannot complete tool discovery in mode: ${this.mode}`);
    }
    this.toolDiscoveryResult = result;
    this.mode = PlanningMode.TOOLS_DISCOVERED;
  }
  
  setBehaviorTree(tree) {
    if (!this.formalResult) {
      throw new Error('Cannot set behavior tree without formal planning result');
    }
    this.behaviorTree = tree;
  }
  
  setError(error) {
    this.error = error;
    this.mode = PlanningMode.ERROR;
  }
  
  cancel() {
    this.mode = PlanningMode.CANCELLED;
    this.completedAt = new Date();
  }
  
  addProgressMessage(message) {
    this.progressMessages.push({
      message,
      timestamp: new Date()
    });
  }
  
  getDuration() {
    const endTime = this.completedAt || new Date();
    return endTime - this.startedAt;
  }
  
  isComplete() {
    return this.mode === PlanningMode.COMPLETE || 
           this.mode === PlanningMode.CANCELLED ||
           this.mode === PlanningMode.ERROR;
  }
  
  canStartFormalPlanning() {
    return this.mode === PlanningMode.INFORMAL_COMPLETE || 
           this.mode === PlanningMode.TOOLS_DISCOVERED;
  }
  
  canDiscoverTools() {
    return this.mode === PlanningMode.INFORMAL_COMPLETE;
  }
  
  toJSON() {
    return {
      id: this.id.toString(),
      goal: this.goal.toString(),
      mode: this.mode,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      informalResult: this.informalResult,
      formalResult: this.formalResult,
      toolDiscoveryResult: this.toolDiscoveryResult,
      behaviorTree: this.behaviorTree,
      error: this.error,
      progressMessages: this.progressMessages,
      duration: this.getDuration()
    };
  }
}