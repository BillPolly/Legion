/**
 * PlanExecutorTool - Legion tool interface for plan execution
 */

import { Tool } from '@legion/module-loader';
import { z } from 'zod';

export class PlanExecutorTool extends Tool {
  constructor(executor, module = null) {
    super({
      name: 'plan_execute',
      description: 'Execute a plan using available Legion tools',
      inputSchema: z.object({
        plan: z.any().describe('The llm-planner Plan object to execute'),
        options: z.object({
          emitProgress: z.boolean().optional().default(true).describe('Emit progress events during execution'),
          stopOnError: z.boolean().optional().default(true).describe('Stop execution on first error'),
          timeout: z.number().optional().default(300000).describe('Step execution timeout in milliseconds'),
          retries: z.number().optional().default(3).describe('Number of retry attempts for failed steps')
        }).optional()
      })
    });
    this.executor = executor;
    this.module = module; // Reference to PlanExecutorModule for logging setup
  }
  
  async execute(params) {
    try {
      // Setup plan-specific logging if module is available
      if (this.module && params.plan.id) {
        await this.module.setupPlanLogging(params.plan.id);
      }
      
      const result = await this.executor.executePlan(params.plan, params.options || {});
      
      return {
        success: result.success,
        status: result.success ? 'completed' : 'failed',
        completedSteps: result.completedSteps,
        failedSteps: result.failedSteps,
        skippedSteps: result.skippedSteps,
        results: result.stepResults,
        statistics: result.statistics,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        error: error.message,
        completedSteps: [],
        failedSteps: [],
        skippedSteps: [],
        results: {},
        statistics: {}
      };
    }
  }
}