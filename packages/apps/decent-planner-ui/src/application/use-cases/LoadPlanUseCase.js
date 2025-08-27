/**
 * LoadPlanUseCase
 * Loads a saved planning session
 */

import { PlanningSession } from '../../domain/entities/PlanningSession.js';
import { PlanningOrchestrationService } from '../../domain/services/PlanningOrchestrationService.js';
import { ApplicationError } from '../errors/ApplicationError.js';

export class LoadPlanUseCase {
  constructor({ planStorage, uiRenderer }) {
    this.planStorage = planStorage;
    this.uiRenderer = uiRenderer;
  }
  
  async execute({ identifier }) {
    try {
      if (!identifier) {
        throw new ApplicationError('Plan identifier is required', 'IDENTIFIER_REQUIRED');
      }
      
      // Load the plan
      const planData = await this.planStorage.load(identifier);
      
      if (!planData) {
        throw new ApplicationError('Plan not found', 'PLAN_NOT_FOUND');
      }
      
      // Reconstruct session from saved data
      const session = this.reconstructSession(planData.session);
      
      // Update UI with loaded plan
      this.uiRenderer.updateComponent('planning', {
        loaded: true,
        planName: planData.name,
        session: session.toJSON()
      });
      
      // Enable appropriate tabs based on loaded session state
      const enabledTabs = PlanningOrchestrationService.getEnabledTabs(session);
      Object.entries(enabledTabs).forEach(([tabId, enabled]) => {
        this.uiRenderer.setElementEnabled(`tab-${tabId}`, enabled);
      });
      
      // If has tool discovery results, update that tab
      if (session.toolDiscoveryResult) {
        this.uiRenderer.updateComponent('toolDiscovery', {
          result: session.toolDiscoveryResult
        });
      }
      
      // If has formal planning results, update that tab
      if (session.formalResult) {
        this.uiRenderer.updateComponent('formalPlanning', {
          result: session.formalResult
        });
      }
      
      return {
        success: true,
        session,
        planName: planData.name
      };
      
    } catch (error) {
      const appError = error instanceof ApplicationError ? error :
        new ApplicationError(
          `Failed to load plan: ${error.message}`,
          'LOAD_FAILED'
        );
      
      // Update UI with error
      this.uiRenderer.showError('planning', appError.message);
      
      return {
        success: false,
        error: appError
      };
    }
  }
  
  reconstructSession(sessionData) {
    // Create new session with original goal
    const session = new PlanningSession(sessionData.goal);
    
    // Restore state
    session.mode = sessionData.mode;
    session.startedAt = new Date(sessionData.startedAt);
    session.completedAt = sessionData.completedAt ? new Date(sessionData.completedAt) : null;
    session.informalResult = sessionData.informalResult;
    session.formalResult = sessionData.formalResult;
    session.toolDiscoveryResult = sessionData.toolDiscoveryResult;
    session.behaviorTree = sessionData.behaviorTree;
    session.error = sessionData.error;
    session.progressMessages = sessionData.progressMessages || [];
    
    return session;
  }
  
  async listSavedPlans() {
    try {
      // Get list of saved plans
      const plans = await this.planStorage.list();
      
      // Update UI with list
      this.uiRenderer.updateComponent('planning', {
        savedPlans: plans
      });
      
      return {
        success: true,
        plans
      };
      
    } catch (error) {
      const appError = error instanceof ApplicationError ? error :
        new ApplicationError(
          `Failed to list saved plans: ${error.message}`,
          'LIST_PLANS_FAILED'
        );
      
      // Update UI with error
      this.uiRenderer.showError('planning', appError.message);
      
      return {
        success: false,
        error: appError
      };
    }
  }
}