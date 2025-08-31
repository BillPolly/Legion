/**
 * CancelPlanningUseCase
 * Cancels an active planning session
 */

import { PlanningOrchestrationService } from '../../domain/services/PlanningOrchestrationService.js';
import { ApplicationError } from '../errors/ApplicationError.js';

export class CancelPlanningUseCase {
  constructor({ plannerService, uiRenderer }) {
    this.plannerService = plannerService;
    this.uiRenderer = uiRenderer;
  }
  
  async execute({ session }) {
    try {
      if (!session) {
        throw new ApplicationError('No active session to cancel', 'NO_ACTIVE_SESSION');
      }
      
      // Check if cancellation is allowed
      if (!PlanningOrchestrationService.canCancel(session.mode)) {
        throw new ApplicationError(
          `Cannot cancel in mode: ${session.mode}`,
          'CANCEL_NOT_ALLOWED'
        );
      }
      
      // Cancel the planner
      this.plannerService.cancel();
      
      // Update session
      session.cancel();
      
      // Update UI
      this.uiRenderer.updateComponent('planning', {
        session: session.toJSON(),
        cancelled: true
      });
      
      this.uiRenderer.setElementEnabled('plan-button', true);
      this.uiRenderer.setElementEnabled('cancel-button', false);
      
      return {
        success: true,
        session
      };
      
    } catch (error) {
      const appError = error instanceof ApplicationError ? error :
        new ApplicationError(
          `Failed to cancel planning: ${error.message}`,
          'CANCEL_FAILED'
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