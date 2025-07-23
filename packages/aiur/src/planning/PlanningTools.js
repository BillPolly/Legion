/**
 * PlanningTools - Tools for plan creation, execution, and status management
 * 
 * Provides MCP-compatible tools for managing plans with handle integration
 * Now with LLM-based plan generation support
 */

import { AiurPlan } from './AiurPlan.js';
import { LLMPlanAdapter } from './LLMPlanAdapter.js';
import { GenericPlanner } from '@legion/llm-planner';
import { LLMClient } from '@legion/llm';
import { ResourceManager } from '@legion/module-loader';

export class PlanningTools {
  constructor(toolRegistry, handleRegistry, planExecutor) {
    this.toolRegistry = toolRegistry;
    this.handleRegistry = handleRegistry;
    this.planExecutor = planExecutor;
    
    // Initialize plan registry for quick access
    this.planRegistry = new Map();
    
    // LLM planner will be initialized on first use
    this.llmPlanner = null;
    this.llmClient = null;
    this.resourceManager = null;
    
    this._initializeTools();
  }

  /**
   * Initialize LLM planner with ResourceManager (lazy initialization)
   * @private
   */
  async _initializeLLMPlanner() {
    if (this.llmPlanner) {
      return; // Already initialized
    }
    
    try {
      // Initialize ResourceManager to access environment variables
      this.resourceManager = new ResourceManager();
      await this.resourceManager.initialize();
      
      // Get API key from environment
      const apiKey = this.resourceManager.get('env.ANTHROPIC_API_KEY') || 
                     this.resourceManager.get('env.OPENAI_API_KEY');
      
      if (apiKey) {
        // Initialize LLM client
        this.llmClient = new LLMClient({
          provider: this.resourceManager.get('env.ANTHROPIC_API_KEY') ? 'anthropic' : 'openai',
          apiKey: apiKey,
          model: this.resourceManager.get('env.ANTHROPIC_API_KEY') ? 'claude-3-opus-20240229' : 'gpt-4'
        });
        
        // Initialize Generic Planner
        this.llmPlanner = new GenericPlanner({
          llmClient: this.llmClient,
          maxRetries: 3,
          maxSteps: 20
        });
        
        console.error('LLM Planner initialized successfully');
      } else {
        console.error('No LLM API key found - AI planning features disabled');
      }
    } catch (error) {
      console.error('Failed to initialize LLM planner:', error);
      this.llmPlanner = null;
    }
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
      description: 'Create a new execution plan with steps and dependencies. Can either accept manual steps or generate a plan from a goal using AI.',
      inputSchema: {
        type: 'object',
        properties: {
          // For AI-generated plans
          goal: {
            type: 'string',
            description: 'High-level goal description for AI plan generation (alternative to providing steps)'
          },
          inputs: {
            type: 'array',
            description: 'Available inputs/handles for AI plan generation',
            items: { type: 'string' }
          },
          requiredOutputs: {
            type: 'array',
            description: 'Required outputs the AI plan should produce',
            items: { type: 'string' }
          },
          constraints: {
            type: 'array',
            description: 'Constraints or requirements for AI plan generation',
            items: { type: 'string' }
          },
          
          // For manual plans or both
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
            description: 'Array of steps to execute (for manual plan creation)',
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
        required: [] // Made flexible - either goal or (title + steps)
      },
      execute: async (params) => {
        try {
          let planData;
          let llmGeneratedPlan = null;
          
          // Check if this is an AI plan generation request
          if (params.goal && !params.steps) {
            // Ensure LLM planner is initialized
            if (!this.llmPlanner) {
              // Try to initialize it if not already done
              await this._initializeLLMPlanner();
              if (!this.llmPlanner) {
                return {
                  success: false,
                  error: 'LLM planner not available. Please ensure ANTHROPIC_API_KEY or OPENAI_API_KEY is set in environment.'
                };
              }
            }
            
            // Build allowable actions from available tools
            const allowableActions = this._buildAllowableActions();
            
            // Prepare inputs from handles if specified
            const inputs = params.inputs || [];
            const resolvedInputs = [];
            for (const input of inputs) {
              if (input.startsWith('@')) {
                // It's a handle reference
                const handleName = input.substring(1);
                if (this.handleRegistry.existsByName(handleName)) {
                  resolvedInputs.push(handleName);
                }
              } else {
                resolvedInputs.push(input);
              }
            }
            
            // Generate plan using LLM
            try {
              llmGeneratedPlan = await this.llmPlanner.createPlan({
                description: params.goal,
                inputs: resolvedInputs,
                requiredOutputs: params.requiredOutputs || [],
                allowableActions: allowableActions,
                maxSteps: 20
              });
            } catch (llmError) {
              return {
                success: false,
                error: `LLM plan generation failed: ${llmError.message}`
              };
            }
          } else {
            // Manual plan creation
            if (!params.steps || !params.title) {
              return {
                success: false,
                error: 'Either provide a goal for AI planning or both title and steps for manual planning'
              };
            }
            
            // Generate plan ID if not provided
            const planId = params.id || `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Build plan data
            planData = {
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
          }

          // Create plan - use adapter for LLM-generated plans
          let plan;
          if (llmGeneratedPlan) {
            // Use LLMPlanAdapter for llm-generated plans
            plan = new LLMPlanAdapter(llmGeneratedPlan, this.handleRegistry, {
              validateOnCreate: params.validateOnCreate !== false,
              ...params.options
            });
          } else {
            // Use regular AiurPlan for manual plans
            plan = new AiurPlan(planData, this.handleRegistry, {
              validateOnCreate: params.validateOnCreate !== false
            });
          }

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
          const planHandle = params.saveAs || `plan_${plan.id}`;
          
          // Save plan as handle
          this.handleRegistry.create(planHandle, plan);

          const result = {
            success: true,
            plan: {
              id: plan.id,
              title: plan.title,
              description: plan.description,
              steps: plan.steps,
              options: plan.options
            },
            planHandle,
            message: llmGeneratedPlan 
              ? `AI-generated plan '${plan.title}' created successfully from goal: "${params.goal}"`
              : `Plan '${plan.title}' created successfully`
          };
          
          // Include LLM plan structure if it was generated
          if (llmGeneratedPlan) {
            result.llmPlan = llmGeneratedPlan.toJSON();
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
            description: 'Handle name of the plan to check'
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
            description: 'Handle name of the plan to validate'
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

  /**
   * Build allowable actions from registered tools
   * @private
   */
  _buildAllowableActions() {
    const allowableActions = [];
    
    // Get all registered tools
    const tools = this.toolRegistry.getAllTools();
    
    for (const tool of tools) {
      // Skip planning tools themselves to avoid recursion
      if (tool.name.startsWith('plan_')) {
        continue;
      }
      
      // Extract inputs and outputs from tool schema
      const inputs = [];
      const outputs = [];
      
      if (tool.inputSchema && tool.inputSchema.properties) {
        inputs.push(...Object.keys(tool.inputSchema.properties));
      }
      
      // For outputs, we'll use a convention or tool metadata
      // Most tools return a 'result' or specific named outputs
      outputs.push('result'); // Default output
      
      allowableActions.push({
        type: tool.name,
        inputs: inputs,
        outputs: outputs,
        description: tool.description
      });
    }
    
    return allowableActions;
  }
}