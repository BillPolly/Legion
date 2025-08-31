/**
 * SavePlanUseCase
 * Saves planning session results
 */

import { PlanningOrchestrationService } from '../../domain/services/PlanningOrchestrationService.js';
import { ApplicationError } from '../errors/ApplicationError.js';

export class SavePlanUseCase {
  constructor({ planStorage, uiRenderer }) {
    this.planStorage = planStorage;
    this.uiRenderer = uiRenderer;
  }
  
  async execute({ name, session }) {
    try {
      if (!name || typeof name !== 'string') {
        throw new ApplicationError('Plan name is required', 'NAME_REQUIRED');
      }
      
      if (!session) {
        throw new ApplicationError('Session is required', 'SESSION_REQUIRED');
      }
      
      if (!PlanningOrchestrationService.canSaveResults(session)) {
        throw new ApplicationError(
          'Cannot save plan in current state',
          'CANNOT_SAVE'
        );
      }
      
      // Prepare data to save
      const planData = {
        name: name.trim(),
        session: session.toJSON(),
        savedAt: new Date()
      };
      
      // Save the plan
      const identifier = await this.planStorage.save(name.trim(), planData);
      
      // Update UI
      this.uiRenderer.updateComponent('planning', {
        saved: true,
        savedName: name.trim(),
        identifier
      });
      
      return {
        success: true,
        identifier,
        name: name.trim()
      };
      
    } catch (error) {
      const appError = error instanceof ApplicationError ? error :
        new ApplicationError(
          `Failed to save plan: ${error.message}`,
          'SAVE_FAILED'
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