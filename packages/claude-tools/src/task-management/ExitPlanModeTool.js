/**
 * ExitPlanModeTool - Exit planning mode and present plan to user
 * MVP implementation - formats and presents plan
 */

import { Tool } from '@legion/tools-registry';
import { z } from 'zod';

// Input schema for validation
const exitPlanModeToolSchema = z.object({
  plan: z.string().min(1)
});

export class ExitPlanModeTool extends Tool {
  constructor() {
    super({
      name: 'ExitPlanMode',
      description: 'Exit plan mode and present implementation plan to user for approval',
      inputSchema: exitPlanModeToolSchema,
      execute: async (input) => this.exitPlanMode(input),
      getMetadata: () => this.getToolMetadata()
    });
    
    // Track planning mode state
    this.isInPlanMode = false;
  }

  /**
   * Exit plan mode and present plan
   */
  async exitPlanMode(input) {
    try {
      const { plan } = input;

      // Format the plan
      const formattedPlan = this.formatPlan(plan);
      
      // Mark as exited from plan mode
      this.isInPlanMode = false;

      return {
        success: true,
        data: {
          plan: formattedPlan,
          message: 'Plan mode exited. Plan presented for user approval.',
          timestamp: new Date().toISOString(),
          metadata: {
            plan_length: plan.length,
            line_count: plan.split('\n').length,
            has_markdown: plan.includes('#') || plan.includes('*') || plan.includes('-')
          }
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Failed to exit plan mode: ${error.message}`,
          details: error.stack
        }
      };
    }
  }

  /**
   * Format the plan for presentation
   */
  formatPlan(plan) {
    // Add header if not present
    if (!plan.startsWith('#') && !plan.startsWith('##')) {
      plan = '## Implementation Plan\n\n' + plan;
    }

    // Ensure proper line breaks
    plan = plan.replace(/\n{3,}/g, '\n\n');

    // Add footer
    if (!plan.includes('approval') && !plan.includes('proceed')) {
      plan += '\n\n---\n*Ready to proceed with implementation upon approval.*';
    }

    return plan;
  }

  /**
   * Enter plan mode (helper method)
   */
  enterPlanMode() {
    this.isInPlanMode = true;
  }

  /**
   * Check if in plan mode (helper method)
   */
  getIsInPlanMode() {
    return this.isInPlanMode;
  }

  /**
   * Get tool metadata
   */
  getToolMetadata() {
    return {
      name: 'ExitPlanMode',
      description: 'Exit plan mode and present implementation plan to user for approval',
      input: {
        plan: {
          type: 'string',
          required: true,
          description: 'The plan to present to the user (supports markdown)'
        }
      },
      output: {
        plan: {
          type: 'string',
          description: 'Formatted plan'
        },
        message: {
          type: 'string',
          description: 'Status message'
        },
        timestamp: {
          type: 'string',
          description: 'Exit timestamp'
        },
        metadata: {
          type: 'object',
          description: 'Plan metadata'
        }
      }
    };
  }
}