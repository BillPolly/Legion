/**
 * ExitPlanModeTool - Exit planning mode and present plan to user
 * MVP implementation - formats and presents plan
 */

import { Tool } from '@legion/tools-registry';

export class ExitPlanModeTool extends Tool {
  constructor() {
    super({
      name: 'ExitPlanMode',
      description: 'Use when finished presenting your plan and ready to code. This will prompt the user to exit plan mode.',
      schema: {
        input: {
          type: 'object',
          properties: {
            plan: {
              type: 'string',
              minLength: 1,
              description: 'The plan you came up with, that you want to run by the user for approval. Supports markdown. The plan should be pretty concise.'
            }
          },
          required: ['plan']
        },
        output: {
          type: 'object',
          properties: {
            plan: {
              type: 'string',
              description: 'Formatted plan with proper markdown headers and structure'
            },
            message: {
              type: 'string',
              description: 'Status message about exiting plan mode'
            },
            timestamp: {
              type: 'string',
              description: 'Exit timestamp (ISO string)'
            },
            metadata: {
              type: 'object',
              description: 'Plan metadata and analysis',
              properties: {
                plan_length: {
                  type: 'integer',
                  description: 'Length of the plan in characters'
                },
                line_count: {
                  type: 'integer',
                  description: 'Number of lines in the plan'
                },
                has_markdown: {
                  type: 'boolean',
                  description: 'Whether the plan contains markdown formatting'
                }
              }
            }
          },
          required: ['plan', 'message', 'timestamp', 'metadata']
        }
      }
    });
    
    // Track planning mode state
    this.isInPlanMode = false;
  }

  async execute(input) {
    return await this.exitPlanMode(input);
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

}