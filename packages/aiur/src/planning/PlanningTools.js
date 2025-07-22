/**
 * PlanningTools - Tools for plan creation, execution, and status management
 * 
 * Provides MCP-compatible tools for managing plans with handle integration
 */

import { AiurPlan } from './AiurPlan.js';

export class PlanningTools {
  constructor(toolRegistry, handleRegistry, planExecutor) {
    this.toolRegistry = toolRegistry;
    this.handleRegistry = handleRegistry;
    this.planExecutor = planExecutor;
    
    // Initialize plan registry for quick access
    this.planRegistry = new Map();
    
    this._initializeTools();
  }

  /**
   * Initialize all planning tools
   * @private
   */
  _initializeTools() {
    this.tools = {
      plan_create: this._createPlanCreateTool(),
      plan_execute: this._createPlanExecuteTool(), 
      plan_status: this._createPlanStatusTool(),
      plan_validate: this._createPlanValidateTool()
    };
  }

  /**
   * Get all planning tools
   */
  getTools() {
    return this.tools;
  }

  /**
   * Register planning tools with MCP server
   */
  registerWithMCPServer(mcpServer) {
    for (const [name, tool] of Object.entries(this.tools)) {
      mcpServer.addTool(tool);
    }
  }

  /**
   * Get plan registry for quick access
   */
  getPlanRegistry() {
    return {
      listPlans: () => Array.from(this.planRegistry.values()),
      getPlan: (planId) => this.planRegistry.get(planId),
      hasPlan: (planId) => this.planRegistry.has(planId),
      addPlan: (plan) => this.planRegistry.set(plan.id, plan),
      removePlan: (planId) => this.planRegistry.delete(planId)
    };
  }

  /**
   * Create plan_create tool
   * @private
   */
  _createPlanCreateTool() {
    return {
      name: 'plan_create',
      description: 'Create a new execution plan with steps and dependencies',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title of the plan'
          },
          description: {
            type: 'string',
            description: 'Description of what the plan does'
          },
          steps: {
            type: 'array',
            description: 'Array of steps to execute',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                action: { type: 'string' },
                parameters: { type: 'object' },
                expectedOutputs: {
                  type: 'array',
                  items: { type: 'string' }
                },
                dependsOn: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: ['id', 'action']
            }
          },
          id: {
            type: 'string',
            description: 'Optional plan ID (auto-generated if not provided)'
          },
          validateOnCreate: {
            type: 'boolean',
            description: 'Whether to validate the plan during creation',
            default: true
          },
          options: {
            type: 'object',
            description: 'Plan execution options',
            properties: {
              autoCheckpoint: { type: 'boolean' },
              maxCheckpoints: { type: 'number' }
            }
          },
          saveAs: {
            type: 'string',
            description: 'Handle name to save the plan as'
          }
        },
        required: ['title', 'steps']
      },
      execute: async (params) => {
        try {
          // Generate plan ID if not provided
          const planId = params.id || `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Build plan data
          const planData = {
            id: planId,
            title: params.title,
            description: params.description || '',
            steps: params.steps,
            options: params.options || {},
            metadata: {
              createdAt: new Date(),
              createdBy: 'planning-tools'
            }
          };

          // Create plan
          const plan = new AiurPlan(planData, this.handleRegistry, {
            validateOnCreate: params.validateOnCreate !== false
          });

          // Validate if requested
          if (params.validateOnCreate !== false) {
            const validation = plan.validate();
            
            // Additional tool availability check during creation
            const toolErrors = [];
            for (const step of plan.steps) {
              if (!this.toolRegistry.hasTool(step.action)) {
                toolErrors.push(`Tool not available: ${step.action} (step: ${step.id})`);
              }
            }
            
            if (!validation.valid || toolErrors.length > 0) {
              return {
                success: false,
                error: `Plan validation failed: ${[...validation.errors, ...toolErrors].join(', ')}`
              };
            }
          }

          // Store in plan registry
          this.planRegistry.set(plan.id, plan);

          // Generate plan handle name
          const planHandle = params.saveAs || `plan_${planId}`;
          
          // Save plan as handle
          this.handleRegistry.create(planHandle, plan);

          return {
            success: true,
            plan: {
              id: plan.id,
              title: plan.title,
              description: plan.description,
              steps: plan.steps,
              options: plan.options
            },
            planHandle,
            message: `Plan '${params.title}' created successfully`
          };

        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Create plan_execute tool
   * @private
   */
  _createPlanExecuteTool() {
    return {
      name: 'plan_execute',
      description: 'Execute a plan and return the results',
      inputSchema: {
        type: 'object',
        properties: {
          planHandle: {
            type: 'string',
            description: 'Handle name of the plan to execute'
          },
          plan: {
            type: 'string',
            description: 'Plan reference (e.g., @planHandle) alternative to planHandle'
          },
          options: {
            type: 'object',
            description: 'Execution options',
            properties: {
              parallel: { type: 'boolean', default: false },
              stopOnError: { type: 'boolean', default: true },
              timeout: { type: 'number', default: 30000 }
            }
          },
          saveAs: {
            type: 'string',
            description: 'Handle name to save execution result as'
          }
        }
      },
      execute: async (params) => {
        try {
          // Get plan from handle or reference
          let plan;
          if (params.planHandle) {
            if (!this.handleRegistry.existsByName(params.planHandle)) {
              return {
                success: false,
                error: `Plan not found: ${params.planHandle}`
              };
            }
            plan = this.handleRegistry.getByName(params.planHandle).data;
          } else if (params.plan) {
            // Handle plan reference like @planHandle
            const planRef = params.plan.startsWith('@') ? params.plan.substring(1) : params.plan;
            if (!this.handleRegistry.existsByName(planRef)) {
              return {
                success: false,
                error: `Plan not found: ${planRef}`
              };
            }
            plan = this.handleRegistry.getByName(planRef).data;
          } else {
            return {
              success: false,
              error: 'Either planHandle or plan parameter is required'
            };
          }

          // Create execution options
          const executionOptions = {
            ...this.planExecutor.options,
            ...params.options
          };

          // Create executor with custom options
          const executor = new (this.planExecutor.constructor)(
            this.toolRegistry,
            this.handleRegistry,
            executionOptions
          );

          // Execute the plan
          const execution = await executor.executePlan(plan);

          // Save execution result if requested
          if (params.saveAs) {
            this.handleRegistry.create(params.saveAs, { execution, plan });
          }

          return {
            success: execution.success,
            execution,
            message: execution.success 
              ? `Plan executed successfully (${execution.completedSteps.length} steps completed)`
              : `Plan execution failed: ${execution.error || 'Unknown error'}`
          };

        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Create plan_status tool
   * @private
   */
  _createPlanStatusTool() {
    return {
      name: 'plan_status',
      description: 'Get the current status and progress of a plan',
      inputSchema: {
        type: 'object',
        properties: {
          planHandle: {
            type: 'string',
            description: 'Handle name of the plan to check',
            required: true
          },
          includeSteps: {
            type: 'boolean',
            description: 'Include detailed step information',
            default: false
          },
          includeHandles: {
            type: 'boolean', 
            description: 'Include handle information',
            default: false
          },
          includeCheckpoints: {
            type: 'boolean',
            description: 'Include checkpoint information',
            default: false
          }
        },
        required: ['planHandle']
      },
      execute: async (params) => {
        try {
          // Get plan from handle
          if (!this.handleRegistry.existsByName(params.planHandle)) {
            return {
              success: false,
              error: `Plan not found: ${params.planHandle}`
            };
          }

          const plan = this.handleRegistry.getByName(params.planHandle).data;
          const progress = plan.getProgress();

          const result = {
            success: true,
            status: {
              planId: plan.id,
              title: plan.title,
              currentStatus: plan.state.status,
              currentStep: plan.state.currentStep,
              lastUpdate: plan.state.statusHistory[plan.state.statusHistory.length - 1]?.timestamp
            },
            progress: {
              completed: progress.completed,
              total: progress.total,
              percentage: progress.percentage,
              failed: plan.state.failedSteps.length
            }
          };

          // Include additional information if requested
          if (params.includeSteps) {
            result.steps = plan.steps.map(step => ({
              id: step.id,
              title: step.title || step.id,
              status: plan.state.stepStates[step.id]?.status || 'pending',
              startedAt: plan.state.stepStates[step.id]?.startedAt,
              completedAt: plan.state.stepStates[step.id]?.completedAt,
              error: plan.state.stepStates[step.id]?.error
            }));
          }

          if (params.includeHandles) {
            result.handles = Object.entries(plan.state.handles).map(([name, info]) => ({
              name,
              stepId: info.stepId,
              createdAt: info.createdAt
            }));
          }

          if (params.includeCheckpoints) {
            result.checkpoints = plan.listCheckpoints();
          }

          return result;

        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Create plan_validate tool
   * @private
   */
  _createPlanValidateTool() {
    return {
      name: 'plan_validate',
      description: 'Validate a plan structure and dependencies',
      inputSchema: {
        type: 'object',
        properties: {
          planHandle: {
            type: 'string',
            description: 'Handle name of the plan to validate',
            required: true
          },
          checkDependencies: {
            type: 'boolean',
            description: 'Check step dependencies',
            default: true
          },
          checkToolAvailability: {
            type: 'boolean',
            description: 'Check if all required tools are available',
            default: true
          },
          checkHandleReferences: {
            type: 'boolean',
            description: 'Check handle references in parameters',
            default: false
          }
        },
        required: ['planHandle']
      },
      execute: async (params) => {
        try {
          // Get plan from handle
          if (!this.handleRegistry.existsByName(params.planHandle)) {
            return {
              success: false,
              error: `Plan not found: ${params.planHandle}`
            };
          }

          const plan = this.handleRegistry.getByName(params.planHandle).data;
          const validation = plan.validate();

          const result = {
            success: true,
            validation: {
              valid: validation.valid,
              errors: [...validation.errors],
              warnings: []
            }
          };

          // Additional validation checks
          if (params.checkToolAvailability !== false) {
            for (const step of plan.steps) {
              if (!this.toolRegistry.hasTool(step.action)) {
                result.validation.valid = false;
                result.validation.errors.push(`Tool not available: ${step.action} (step: ${step.id})`);
              }
            }
          }

          if (params.checkHandleReferences) {
            for (const step of plan.steps) {
              if (step.parameters) {
                const handleRefs = this._extractHandleReferences(step.parameters);
                for (const ref of handleRefs) {
                  if (!this.handleRegistry.existsByName(ref)) {
                    result.validation.warnings.push(`Handle reference not found: @${ref} (step: ${step.id})`);
                  }
                }
              }
            }
          }

          return result;

        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Extract handle references from parameters
   * @private
   */
  _extractHandleReferences(obj, refs = []) {
    if (typeof obj === 'string' && obj.startsWith('@')) {
      refs.push(obj.substring(1));
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        this._extractHandleReferences(item, refs);
      }
    } else if (obj && typeof obj === 'object') {
      for (const value of Object.values(obj)) {
        this._extractHandleReferences(value, refs);
      }
    }
    return refs;
  }
}