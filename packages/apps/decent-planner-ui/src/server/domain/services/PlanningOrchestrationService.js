/**
 * PlanningOrchestrationService
 * Pure domain service for orchestrating planning workflow
 */

import { PlanningMode, canTransitionTo } from '../value-objects/PlanningMode.js';
import { DomainError } from '../errors/DomainError.js';

export class PlanningOrchestrationService {
  /**
   * Determine next available actions for a planning session
   */
  static getAvailableActions(session) {
    if (!session) {
      throw new DomainError('Session is required');
    }
    
    const actions = [];
    
    switch (session.mode) {
      case PlanningMode.IDLE:
        actions.push('START_INFORMAL_PLANNING');
        break;
        
      case PlanningMode.INFORMAL:
        actions.push('CANCEL');
        break;
        
      case PlanningMode.INFORMAL_COMPLETE:
        actions.push('DISCOVER_TOOLS');
        actions.push('START_FORMAL_PLANNING');
        break;
        
      case PlanningMode.DISCOVERING_TOOLS:
        actions.push('CANCEL');
        break;
        
      case PlanningMode.TOOLS_DISCOVERED:
        actions.push('START_FORMAL_PLANNING');
        break;
        
      case PlanningMode.FORMAL:
        actions.push('CANCEL');
        break;
        
      case PlanningMode.COMPLETE:
        actions.push('SAVE_PLAN');
        actions.push('EXECUTE_BEHAVIOR_TREE');
        actions.push('START_NEW_SESSION');
        break;
        
      case PlanningMode.ERROR:
      case PlanningMode.CANCELLED:
        actions.push('START_NEW_SESSION');
        break;
    }
    
    return actions;
  }
  
  /**
   * Validate transition from one mode to another
   */
  static validateTransition(fromMode, toMode) {
    if (!canTransitionTo(fromMode, toMode)) {
      throw new DomainError(
        `Invalid transition from ${fromMode} to ${toMode}`
      );
    }
    return true;
  }
  
  /**
   * Check if planning can be cancelled in current mode
   */
  static canCancel(mode) {
    return mode === PlanningMode.INFORMAL ||
           mode === PlanningMode.DISCOVERING_TOOLS ||
           mode === PlanningMode.FORMAL;
  }
  
  /**
   * Check if results can be saved in current mode
   */
  static canSaveResults(session) {
    return session.mode === PlanningMode.COMPLETE ||
           (session.mode === PlanningMode.INFORMAL_COMPLETE && session.informalResult) ||
           (session.mode === PlanningMode.TOOLS_DISCOVERED && session.toolDiscoveryResult);
  }
  
  /**
   * Get planning progress percentage
   */
  static getProgressPercentage(mode) {
    const progress = {
      [PlanningMode.IDLE]: 0,
      [PlanningMode.INFORMAL]: 25,
      [PlanningMode.INFORMAL_COMPLETE]: 40,
      [PlanningMode.DISCOVERING_TOOLS]: 60,
      [PlanningMode.TOOLS_DISCOVERED]: 70,
      [PlanningMode.FORMAL]: 85,
      [PlanningMode.COMPLETE]: 100,
      [PlanningMode.ERROR]: -1,
      [PlanningMode.CANCELLED]: -1
    };
    
    return progress[mode] || 0;
  }
  
  /**
   * Determine which tabs should be enabled based on session state
   */
  static getEnabledTabs(session) {
    const tabs = {
      planning: true, // Always enabled
      toolDiscovery: false,
      formalPlanning: false,
      execution: false,
      search: true // Always enabled
    };
    
    if (!session) {
      return tabs;
    }
    
    // Enable tool discovery after informal planning
    if (session.mode === PlanningMode.INFORMAL_COMPLETE ||
        session.mode === PlanningMode.DISCOVERING_TOOLS ||
        session.mode === PlanningMode.TOOLS_DISCOVERED ||
        session.mode === PlanningMode.FORMAL ||
        session.mode === PlanningMode.COMPLETE) {
      tabs.toolDiscovery = true;
    }
    
    // Enable formal planning after tools discovered or informal complete
    if (session.mode === PlanningMode.TOOLS_DISCOVERED ||
        session.mode === PlanningMode.FORMAL ||
        session.mode === PlanningMode.COMPLETE ||
        (session.mode === PlanningMode.INFORMAL_COMPLETE && session.informalResult)) {
      tabs.formalPlanning = true;
    }
    
    // Enable execution after formal planning complete
    if (session.mode === PlanningMode.COMPLETE && session.behaviorTree) {
      tabs.execution = true;
    }
    
    return tabs;
  }
  
  /**
   * Validate planning goal
   */
  static validateGoal(goal) {
    if (!goal || typeof goal !== 'string') {
      throw new DomainError('Goal must be a non-empty string');
    }
    
    const trimmed = goal.trim();
    if (trimmed.length === 0) {
      throw new DomainError('Goal cannot be empty');
    }
    
    if (trimmed.length > 1000) {
      throw new DomainError('Goal cannot exceed 1000 characters');
    }
    
    return trimmed;
  }
}