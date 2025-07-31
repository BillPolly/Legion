/**
 * PlanExecutorTool - Legion tool interface for plan execution
 */

// TODO: Temporarily not extending Tool for MVP testing
export class PlanExecutorTool {
  constructor(executor, module = null) {
    this.executor = executor;
    this.module = module; // Reference to PlanExecutorModule for logging setup
  }
  
  get name() {
    return 'plan_execute';
  }
  
  get description() {
    return 'Execute a plan using available Legion tools';
  }
  
  get inputSchema() {
    return {
      type: 'object',
      properties: {
        plan: {
          description: 'The llm-planner Plan object to execute'
        },
        options: {
          type: 'object',
          properties: {
            emitProgress: { 
              type: 'boolean', 
              default: true,
              description: 'Emit progress events during execution'
            },
            stopOnError: { 
              type: 'boolean', 
              default: true,
              description: 'Stop execution on first error'
            },
            timeout: { 
              type: 'number', 
              default: 300000,
              description: 'Step execution timeout in milliseconds'
            },
            retries: { 
              type: 'number', 
              default: 3,
              description: 'Number of retry attempts for failed steps'
            }
          }
        }
      },
      required: ['plan']
    };
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