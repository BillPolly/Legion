/**
 * ExecutionStatusTool - Real-time execution state inspection tool
 */

import { Tool } from '@legion/module-loader';
import { z } from 'zod';

export class ExecutionStatusTool extends Tool {
  constructor(options = {}) {
    super({
      name: 'plan_status',
      description: 'Inspect execution state and monitor active plan executions',
      inputSchema: z.object({
        sessionId: z.string().optional().describe('Specific session to inspect, or "all" for all active sessions'),
        includeContext: z.boolean().optional().default(false).describe('Whether to include execution context details'),
        includeResults: z.boolean().optional().default(false).describe('Whether to include step results in response')
      })
    });
    this.options = options;
    // Reference to global execution context registry (would be injected in real implementation)
    this._executionContextRegistry = options.executionContextRegistry || null;
  }
  
  async execute(params) {
    try {
      const { sessionId, includeContext = false, includeResults = false } = params;
      
      // Get the execution context (this would be injected via dependency injection)
      const executionContext = this._getExecutionContext();
      if (!executionContext) {
        return {
          success: false,
          error: 'No execution context available'
        };
      }

      const timestamp = new Date().toISOString();

      // Handle specific session inspection
      if (sessionId && sessionId !== 'all') {
        return await this._inspectSession(executionContext, sessionId, includeContext, includeResults, timestamp);
      }

      // Handle "all" sessions request
      if (sessionId === 'all') {
        return await this._inspectAllSessions(executionContext, includeContext, includeResults, timestamp);
      }

      // Handle general active sessions listing
      return await this._listActiveSessions(executionContext, timestamp);

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async _inspectSession(executionContext, sessionId, includeContext, includeResults, timestamp) {
    if (!executionContext.hasSession(sessionId)) {
      return {
        success: false,
        error: `Session not found: ${sessionId}`
      };
    }

    const sessionState = executionContext.getSessionState(sessionId);
    const executionState = {
      status: executionContext.state.status,
      completedSteps: [...executionContext.state.completedSteps],
      failedSteps: [...executionContext.state.failedSteps],
      skippedSteps: [...executionContext.state.skippedSteps]
    };

    const result = {
      success: true,
      timestamp,
      sessionInfo: {
        id: sessionId,
        createdAt: sessionState.createdAt,
        isPaused: sessionState.isPaused,
        pausePoint: sessionState.pausePoint,
        breakpoints: [...sessionState.breakpoints]
      },
      executionState
    };

    // Include execution context details if requested
    if (includeContext) {
      const variableSnapshot = executionContext.captureVariableSnapshot();
      result.contextDetails = {
        currentPath: [...executionContext.currentPath],
        executionStack: executionContext.executionStack.map(context => ({
          stepId: context.stepId,
          step: context.step,
          startTime: context.startTime
        })),
        variables: variableSnapshot
      };
    }

    // Include step results if requested
    if (includeResults) {
      result.stepResults = {};
      for (const [stepId, result_] of executionContext.state.stepResults) {
        result.stepResults[stepId] = result_;
      }
    }

    return result;
  }

  async _inspectAllSessions(executionContext, includeContext, includeResults, timestamp) {
    const activeSessions = executionContext.getActiveSessions();
    const allSessions = [];

    for (const sessionId of activeSessions) {
      const sessionInfo = await this._inspectSession(executionContext, sessionId, includeContext, includeResults, timestamp);
      if (sessionInfo.success) {
        allSessions.push(sessionInfo);
      }
    }

    return {
      success: true,
      timestamp,
      allSessions,
      totalSessions: allSessions.length
    };
  }

  async _listActiveSessions(executionContext, timestamp) {
    const activeSessions = executionContext.getActiveSessions();
    
    return {
      success: true,
      timestamp,
      activeSessions,
      sessionCount: activeSessions.length
    };
  }

  // This method would be replaced by proper dependency injection in the real implementation
  _getExecutionContext() {
    // This is a mock implementation for testing
    // In real usage, this would get the context from a registry or be injected
    return this._executionContextRegistry;
  }
}