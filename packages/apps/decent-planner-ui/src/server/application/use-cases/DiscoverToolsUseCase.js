/**
 * DiscoverToolsUseCase
 * Discovers tools for planning tasks
 */

import { PlanningOrchestrationService } from '../../domain/services/PlanningOrchestrationService.js';
import { ApplicationError } from '../errors/ApplicationError.js';

export class DiscoverToolsUseCase {
  constructor({ plannerService, uiRenderer }) {
    this.plannerService = plannerService;
    this.uiRenderer = uiRenderer;
  }
  
  async execute({ session }) {
    try {
      if (!session) {
        throw new ApplicationError('Session is required', 'SESSION_REQUIRED');
      }
      
      if (!session.canDiscoverTools()) {
        throw new ApplicationError(
          `Cannot discover tools in mode: ${session.mode}`,
          'INVALID_MODE'
        );
      }
      
      if (!session.informalResult?.informal?.hierarchy) {
        throw new ApplicationError(
          'No task hierarchy available for tool discovery',
          'NO_HIERARCHY'
        );
      }
      
      // Start tool discovery
      session.startToolDiscovery();
      
      // Update UI
      this.uiRenderer.showLoading('toolDiscovery', 'Discovering tools...');
      this.uiRenderer.switchTab('toolDiscovery');
      
      // Execute tool discovery
      const result = await this.plannerService.discoverTools(
        session.informalResult.informal.hierarchy,
        (message) => {
          session.addProgressMessage(message);
          this.uiRenderer.updateProgress(
            'toolDiscovery',
            PlanningOrchestrationService.getProgressPercentage(session.mode),
            message
          );
        }
      );
      
      // Update session with results
      session.completeToolDiscovery(result);
      
      // Update UI with results
      this.uiRenderer.updateComponent('toolDiscovery', {
        result,
        statistics: result.statistics || {}
      });
      
      // Enable formal planning tab
      const enabledTabs = PlanningOrchestrationService.getEnabledTabs(session);
      Object.entries(enabledTabs).forEach(([tabId, enabled]) => {
        this.uiRenderer.setElementEnabled(`tab-${tabId}`, enabled);
      });
      
      return {
        success: true,
        session,
        toolDiscoveryResult: result
      };
      
    } catch (error) {
      const appError = error instanceof ApplicationError ? error :
        new ApplicationError(
          `Tool discovery failed: ${error.message}`,
          'TOOL_DISCOVERY_FAILED'
        );
      
      // Update session
      if (session) {
        session.setError(appError.message);
      }
      
      // Update UI with error
      this.uiRenderer.showError('toolDiscovery', appError.message);
      
      return {
        success: false,
        error: appError
      };
    }
  }
}