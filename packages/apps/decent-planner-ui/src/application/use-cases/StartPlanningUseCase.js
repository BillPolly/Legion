/**
 * StartPlanningUseCase
 * Initiates a new planning session
 */

import { PlanningSession } from '../../domain/entities/PlanningSession.js';
import { PlanningOrchestrationService } from '../../domain/services/PlanningOrchestrationService.js';
import { ApplicationError } from '../errors/ApplicationError.js';

export class StartPlanningUseCase {
  constructor({ plannerService, uiRenderer, actorCommunication }) {
    this.plannerService = plannerService;
    this.uiRenderer = uiRenderer;
    this.actorCommunication = actorCommunication;
  }
  
  async execute({ goal, mode = 'informal' }) {
    try {
      // Validate goal
      const validatedGoal = PlanningOrchestrationService.validateGoal(goal);
      
      // Create new planning session
      const session = new PlanningSession(validatedGoal);
      
      // Update UI
      this.uiRenderer.showLoading('planning', 'Starting planning...');
      this.uiRenderer.setElementEnabled('plan-button', false);
      this.uiRenderer.setElementEnabled('cancel-button', true);
      
      // Start planning based on mode
      if (mode === 'informal') {
        session.startInformalPlanning();
        
        // Execute informal planning
        const result = await this.plannerService.planInformal(
          validatedGoal,
          {},
          (message) => {
            session.addProgressMessage(message);
            this.uiRenderer.updateProgress(
              'planning',
              PlanningOrchestrationService.getProgressPercentage(session.mode),
              message
            );
          }
        );
        
        // Update session with results
        session.completeInformalPlanning(result);
        
        // Update UI tabs
        const enabledTabs = PlanningOrchestrationService.getEnabledTabs(session);
        Object.entries(enabledTabs).forEach(([tabId, enabled]) => {
          this.uiRenderer.setElementEnabled(`tab-${tabId}`, enabled);
        });
        
        // Show results
        this.uiRenderer.updateComponent('planning', {
          session: session.toJSON(),
          result
        });
      }
      
      return {
        success: true,
        session
      };
      
    } catch (error) {
      // Handle errors
      const appError = new ApplicationError(
        `Failed to start planning: ${error.message}`,
        'START_PLANNING_FAILED'
      );
      
      // Update UI with error
      this.uiRenderer.showError('planning', appError.message);
      this.uiRenderer.setElementEnabled('plan-button', true);
      this.uiRenderer.setElementEnabled('cancel-button', false);
      
      return {
        success: false,
        error: appError
      };
    }
  }
}