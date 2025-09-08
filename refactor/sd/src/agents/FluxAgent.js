/**
 * FluxAgent - BT Agent for Flux Architecture Implementation
 * 
 * Extends SDAgentBase to implement Flux unidirectional data flow,
 * actions, dispatchers, stores, and views
 */

import { SDAgentBase } from './SDAgentBase.js';

export class FluxAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'FluxAgent',
      description: 'Implements Flux architecture with unidirectional data flow',
      methodologyRules: {
        action: {
          mustHaveType: (artifact) => artifact.type && typeof artifact.type === 'string',
          mustHavePayload: (artifact) => artifact.payload !== undefined,
          mustBeSerializable: (artifact) => artifact.serializable === true,
          mustFollowNamingConvention: (artifact) => {
            return artifact.type && /^[A-Z_]+$/.test(artifact.type);
          }
        },
        dispatcher: {
          mustBeSingleton: (artifact) => artifact.singleton === true,
          mustRegisterCallbacks: (artifact) => artifact.callbacks && Array.isArray(artifact.callbacks),
          mustHandleAllActions: (artifact) => artifact.handlesAllActions === true,
          mustMaintainOrder: (artifact) => artifact.maintainsOrder === true
        },
        store: {
          mustEmitChanges: (artifact) => artifact.emitsChanges === true,
          mustNotEmitDuringDispatch: (artifact) => artifact.defersEmitDuringDispatch === true,
          mustHandleOwnDomain: (artifact) => artifact.domain && artifact.domain.length > 0,
          mustBeImmutable: (artifact) => artifact.immutable === true
        },
        view: {
          mustSubscribeToStores: (artifact) => artifact.subscribedStores && artifact.subscribedStores.length > 0,
          mustNotModifyStoresDirectly: (artifact) => artifact.modifiesStoresDirectly === false,
          mustDispatchActions: (artifact) => artifact.dispatchesActions === true
        }
      }
    });
    
    this.workflowConfig = this.createWorkflowConfig();
  }

  getCurrentPhase() {
    return 'flux-architecture';
  }

  createWorkflowConfig() {
    return {
      type: 'sequence',
      id: 'flux-architecture-workflow',
      description: 'Implement Flux unidirectional data flow',
      children: [
        {
          type: 'action',
          id: 'retrieve-state-design',
          tool: 'retrieve_context',
          description: 'Retrieve state design from database',
          params: {
            query: {
              type: 'state-design',
              projectId: '${input.projectId}'
            }
          }
        },
        {
          type: 'action',
          id: 'design-action-types',
          tool: 'design_action_types',
          description: 'Design action types and creators',
          params: {
            stateContext: '${results.retrieve-state-design.context}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'design-dispatcher',
          tool: 'design_dispatcher',
          description: 'Design central dispatcher',
          params: {
            actionTypes: '${results.design-action-types.actionTypes}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'parallel',
          id: 'design-stores-and-views',
          description: 'Design stores and views in parallel',
          children: [
            {
              type: 'action',
              id: 'design-stores',
              tool: 'design_stores',
              description: 'Design Flux stores',
              params: {
                stateSchemas: '${results.retrieve-state-design.context.schemas}',
                dispatcher: '${results.design-dispatcher.dispatcher}',
                projectId: '${input.projectId}'
              }
            },
            {
              type: 'action',
              id: 'design-views',
              tool: 'design_views',
              description: 'Design view components',
              params: {
                stores: '${results.design-stores.stores}',
                actionTypes: '${results.design-action-types.actionTypes}',
                projectId: '${input.projectId}'
              }
            }
          ]
        },
        {
          type: 'action',
          id: 'design-data-flow',
          tool: 'design_data_flow',
          description: 'Design unidirectional data flow',
          params: {
            actions: '${results.design-action-types.actionTypes}',
            dispatcher: '${results.design-dispatcher.dispatcher}',
            stores: '${results.design-stores.stores}',
            views: '${results.design-views.views}'
          }
        },
        {
          type: 'action',
          id: 'validate-flux-patterns',
          tool: 'validate_flux_patterns',
          description: 'Validate Flux architecture patterns',
          params: {
            dataFlow: '${results.design-data-flow.dataFlow}',
            stores: '${results.design-stores.stores}',
            dispatcher: '${results.design-dispatcher.dispatcher}'
          }
        },
        {
          type: 'action',
          id: 'store-flux-architecture',
          tool: 'store_artifact',
          description: 'Store Flux architecture artifacts',
          params: {
            artifact: {
              type: 'flux-architecture',
              data: {
                actionTypes: '${results.design-action-types.actionTypes}',
                dispatcher: '${results.design-dispatcher.dispatcher}',
                stores: '${results.design-stores.stores}',
                views: '${results.design-views.views}',
                dataFlow: '${results.design-data-flow.dataFlow}',
                validation: '${results.validate-flux-patterns}'
              },
              metadata: {
                phase: 'flux-architecture',
                agentId: '${agent.id}',
                timestamp: '${timestamp}'
              }
            },
            projectId: '${input.projectId}'
          }
        }
      ]
    };
  }

  async receive(message) {
    const { type, payload } = message;
    
    if (type !== 'implement_flux') {
      return {
        success: false,
        error: 'FluxAgent only handles implement_flux messages'
      };
    }
    
    try {
      // Build context for Flux implementation
      const context = await this.buildContext('flux', {
        projectId: payload.projectId
      });
      
      // Determine Flux implementation strategy using LLM
      const fluxStrategy = await this.decideFluxStrategy(context);
      
      // Create execution context
      const executionContext = this.createExecutionContext({
        input: {
          projectId: payload.projectId,
          fluxStrategy
        },
        context,
        agent: {
          id: this.id,
          name: this.name
        },
        timestamp: new Date().toISOString()
      });
      
      // Execute BT workflow
      const result = await this.executeBTWorkflow(this.workflowConfig, executionContext);
      
      // Validate Flux architecture
      const validation = this.validateFluxArchitecture(result);
      
      return {
        success: result.success,
        data: {
          ...result.data,
          validation,
          fluxStrategy,
          projectId: executionContext.input.projectId,
          phase: this.getCurrentPhase()
        }
      };
      
    } catch (error) {
      console.error(`[FluxAgent] Error implementing Flux:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async decideFluxStrategy(context) {
    const prompt = `Based on the state design and architecture, determine the Flux implementation strategy:

State Design Context:
${JSON.stringify(context.artifacts.state, null, 2)}

Architecture Context:
${JSON.stringify(context.artifacts.architecture, null, 2)}

Determine the Flux strategy including:
1. Flux variant (Facebook Flux, Redux, Alt, Reflux)
2. Action organization (by feature, by type, mixed)
3. Store granularity (single store, multiple stores)
4. Middleware approach (thunks, sagas, epics)
5. Side effect handling (in actions, in middleware, in stores)
6. Error handling strategy

Return as JSON:
{
  "variant": "facebook-flux|redux|alt|reflux",
  "actionOrganization": "by-feature|by-type|mixed",
  "storeGranularity": "single|multiple|domain-based",
  "middleware": ["thunk", "saga", "epic", "custom"],
  "sideEffectHandling": "actions|middleware|stores",
  "errorHandling": {
    "approach": "try-catch|error-actions|error-state",
    "recovery": "automatic|manual|mixed"
  },
  "reasoning": "explanation"
}`;

    const decision = await this.makeLLMDecision(prompt, context);
    return decision;
  }

  async executeBTWorkflow(workflow, context) {
    console.log(`[FluxAgent] Executing workflow:`, workflow.id);
    
    // Placeholder implementation
    return {
      success: true,
      data: {
        workflowId: workflow.id,
        executionTime: Date.now(),
        results: {
          'design-action-types': {
            actionTypes: [
              {
                id: 'action-user-login',
                type: 'USER_LOGIN',
                payload: { username: 'string', password: 'string' },
                serializable: true
              },
              {
                id: 'action-data-fetch',
                type: 'FETCH_DATA',
                payload: { endpoint: 'string' },
                serializable: true
              }
            ]
          },
          'design-dispatcher': {
            dispatcher: {
              id: 'dispatcher-main',
              name: 'AppDispatcher',
              singleton: true,
              callbacks: ['store-1', 'store-2'],
              handlesAllActions: true,
              maintainsOrder: true
            }
          },
          'design-stores': {
            stores: [
              {
                id: 'store-user',
                name: 'UserStore',
                domain: ['user', 'authentication'],
                emitsChanges: true,
                defersEmitDuringDispatch: true,
                immutable: true
              },
              {
                id: 'store-data',
                name: 'DataStore',
                domain: ['data', 'cache'],
                emitsChanges: true,
                defersEmitDuringDispatch: true,
                immutable: true
              }
            ]
          },
          'design-views': {
            views: [
              {
                id: 'view-user-profile',
                name: 'UserProfileView',
                subscribedStores: ['store-user'],
                modifiesStoresDirectly: false,
                dispatchesActions: true
              }
            ]
          },
          'design-data-flow': {
            dataFlow: {
              pattern: 'unidirectional',
              flow: ['View', 'Action', 'Dispatcher', 'Store', 'View'],
              validated: true
            }
          }
        }
      }
    };
  }

  validateFluxArchitecture(result) {
    const validationResults = {
      valid: true,
      violations: [],
      warnings: []
    };
    
    // Validate actions
    const actions = result.data?.results?.['design-action-types']?.actionTypes || [];
    actions.forEach(action => {
      const validation = this.validateMethodology({ ...action, type: 'action' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `action-${action.id}`,
          violations: validation.violations
        });
      }
    });
    
    // Validate dispatcher
    const dispatcher = result.data?.results?.['design-dispatcher']?.dispatcher;
    if (dispatcher) {
      const validation = this.validateMethodology({ ...dispatcher, type: 'dispatcher' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `dispatcher-${dispatcher.id}`,
          violations: validation.violations
        });
      }
    }
    
    // Validate stores
    const stores = result.data?.results?.['design-stores']?.stores || [];
    stores.forEach(store => {
      const validation = this.validateMethodology({ ...store, type: 'store' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `store-${store.id}`,
          violations: validation.violations
        });
      }
    });
    
    // Validate views
    const views = result.data?.results?.['design-views']?.views || [];
    views.forEach(view => {
      const validation = this.validateMethodology({ ...view, type: 'view' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `view-${view.id}`,
          violations: validation.violations
        });
      }
    });
    
    // Check for unidirectional flow violations
    const flowViolations = this.checkDataFlowViolations(result.data?.results?.['design-data-flow']?.dataFlow);
    if (flowViolations.length > 0) {
      validationResults.valid = false;
      validationResults.violations.push(...flowViolations);
    }
    
    return validationResults;
  }

  checkDataFlowViolations(dataFlow) {
    const violations = [];
    
    if (!dataFlow) {
      violations.push({
        artifact: 'data-flow',
        violation: 'Data flow must be defined'
      });
      return violations;
    }
    
    if (dataFlow.pattern !== 'unidirectional') {
      violations.push({
        artifact: 'data-flow',
        violation: 'Data flow must be unidirectional'
      });
    }
    
    const expectedFlow = ['View', 'Action', 'Dispatcher', 'Store', 'View'];
    const actualFlow = dataFlow.flow || [];
    
    if (JSON.stringify(actualFlow) !== JSON.stringify(expectedFlow)) {
      violations.push({
        artifact: 'data-flow',
        violation: `Data flow must follow pattern: ${expectedFlow.join(' → ')}`
      });
    }
    
    return violations;
  }

  getMetadata() {
    return {
      type: 'flux',
      name: this.name,
      phase: this.getCurrentPhase(),
      capabilities: [
        'design_action_types',
        'design_dispatcher',
        'design_stores',
        'design_views',
        'design_data_flow',
        'validate_flux_patterns'
      ],
      methodologyRules: Object.keys(this.methodologyRules),
      fluxPatterns: [
        'Unidirectional Data Flow',
        'Action-Dispatcher-Store-View',
        'Single Source of Truth',
        'Predictable State Updates'
      ]
    };
  }
}