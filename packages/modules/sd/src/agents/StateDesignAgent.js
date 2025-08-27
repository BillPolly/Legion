/**
 * StateDesignAgent - BT Agent for Immutable State Design
 * 
 * Extends SDAgentBase to design immutable state structures,
 * state transitions, and state management patterns
 */

import { SDAgentBase } from './SDAgentBase.js';

export class StateDesignAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'StateDesignAgent',
      description: 'Designs immutable state structures and transitions',
      methodologyRules: {
        state: {
          mustBeImmutable: (artifact) => artifact.immutable === true,
          mustHaveSchema: (artifact) => artifact.schema && typeof artifact.schema === 'object',
          mustDefineInitialState: (artifact) => artifact.initialState !== undefined,
          mustHaveVersion: (artifact) => artifact.version && typeof artifact.version === 'number'
        },
        transition: {
          mustBeAPureFunction: (artifact) => artifact.pure === true,
          mustNotMutateState: (artifact) => artifact.mutation === false,
          mustReturnNewState: (artifact) => artifact.returnsNewState === true,
          mustHandleAllCases: (artifact) => {
            if (!artifact.cases) return false;
            return artifact.cases.includes('default') || artifact.exhaustive === true;
          }
        },
        reducer: {
          mustBePure: (artifact) => artifact.pure === true,
          mustHandleInitialState: (artifact) => artifact.handlesInitialState === true,
          mustReturnState: (artifact) => artifact.alwaysReturnsState === true,
          mustNotHaveSideEffects: (artifact) => artifact.sideEffects === false
        }
      }
    });
    
    this.workflowConfig = this.createWorkflowConfig();
  }

  getCurrentPhase() {
    return 'state-design';
  }

  createWorkflowConfig() {
    return {
      type: 'sequence',
      id: 'state-design-workflow',
      description: 'Design immutable state and transitions',
      children: [
        {
          type: 'action',
          id: 'retrieve-architecture',
          tool: 'retrieve_context',
          description: 'Retrieve architecture from database',
          params: {
            query: {
              type: 'clean-architecture',
              projectId: '${input.projectId}'
            }
          }
        },
        {
          type: 'action',
          id: 'identify-state-containers',
          tool: 'identify_state_containers',
          description: 'Identify state containers from domain model',
          params: {
            architectureContext: '${results.retrieve-architecture.context}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'design-state-schemas',
          tool: 'design_state_schemas',
          description: 'Design immutable state schemas',
          params: {
            stateContainers: '${results.identify-state-containers.containers}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'parallel',
          id: 'design-state-management',
          description: 'Design state transitions and reducers',
          children: [
            {
              type: 'action',
              id: 'design-transitions',
              tool: 'design_transitions',
              description: 'Design state transition functions',
              params: {
                stateSchemas: '${results.design-state-schemas.schemas}',
                projectId: '${input.projectId}'
              }
            },
            {
              type: 'action',
              id: 'design-reducers',
              tool: 'design_reducers',
              description: 'Design reducer functions',
              params: {
                stateSchemas: '${results.design-state-schemas.schemas}',
                transitions: '${results.design-transitions.transitions}',
                projectId: '${input.projectId}'
              }
            }
          ]
        },
        {
          type: 'action',
          id: 'design-selectors',
          tool: 'design_selectors',
          description: 'Design state selectors for derived data',
          params: {
            stateSchemas: '${results.design-state-schemas.schemas}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'validate-immutability',
          tool: 'validate_immutability',
          description: 'Validate immutability patterns',
          params: {
            stateSchemas: '${results.design-state-schemas.schemas}',
            transitions: '${results.design-transitions.transitions}',
            reducers: '${results.design-reducers.reducers}'
          }
        },
        {
          type: 'action',
          id: 'store-state-design',
          tool: 'store_artifact',
          description: 'Store state design artifacts',
          params: {
            artifact: {
              type: 'state-design',
              data: {
                containers: '${results.identify-state-containers.containers}',
                schemas: '${results.design-state-schemas.schemas}',
                transitions: '${results.design-transitions.transitions}',
                reducers: '${results.design-reducers.reducers}',
                selectors: '${results.design-selectors.selectors}',
                validation: '${results.validate-immutability}'
              },
              metadata: {
                phase: 'state-design',
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
    
    if (type !== 'design_state') {
      return {
        success: false,
        error: 'StateDesignAgent only handles design_state messages'
      };
    }
    
    try {
      // Build context for state design
      const context = await this.buildContext('state', {
        projectId: payload.projectId
      });
      
      // Determine state design strategy using LLM
      const stateStrategy = await this.decideStateStrategy(context);
      
      // Create execution context
      const executionContext = this.createExecutionContext({
        input: {
          projectId: payload.projectId,
          stateStrategy
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
      
      // Validate state design
      const validation = this.validateStateDesign(result);
      
      return {
        success: result.success,
        data: {
          ...result.data,
          validation,
          stateStrategy,
          projectId: executionContext.input.projectId,
          phase: this.getCurrentPhase()
        }
      };
      
    } catch (error) {
      console.error(`[StateDesignAgent] Error designing state:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async decideStateStrategy(context) {
    const prompt = `Based on the architecture and domain model, determine the immutable state design strategy:

Architecture Context:
${JSON.stringify(context.artifacts.architecture, null, 2)}

Domain Context:
${JSON.stringify(context.artifacts.domain, null, 2)}

Determine the state design strategy including:
1. State container pattern (Redux, MobX, Zustand, custom)
2. State normalization approach (normalized vs denormalized)
3. Immutability enforcement (Immer, Immutable.js, manual)
4. State persistence strategy (localStorage, IndexedDB, none)
5. State hydration/rehydration approach
6. Optimistic update patterns

Return as JSON:
{
  "containerPattern": "redux|mobx|zustand|custom",
  "normalization": "normalized|denormalized|hybrid",
  "immutabilityLibrary": "immer|immutablejs|manual",
  "persistence": {
    "enabled": true/false,
    "storage": "localStorage|indexedDB|none",
    "selective": true/false
  },
  "hydration": {
    "approach": "full|partial|lazy",
    "timing": "immediate|deferred"
  },
  "optimisticUpdates": true/false,
  "reasoning": "explanation"
}`;

    const decision = await this.makeLLMDecision(prompt, context);
    return decision;
  }

  async executeBTWorkflow(workflow, context) {
    console.log(`[StateDesignAgent] Executing workflow:`, workflow.id);
    
    // Placeholder implementation
    return {
      success: true,
      data: {
        workflowId: workflow.id,
        executionTime: Date.now(),
        results: {
          'identify-state-containers': {
            containers: [
              {
                id: 'container-app-state',
                name: 'ApplicationState',
                type: 'root',
                description: 'Root application state container'
              }
            ]
          },
          'design-state-schemas': {
            schemas: [
              {
                id: 'schema-app-state',
                name: 'AppStateSchema',
                immutable: true,
                schema: {
                  user: { type: 'object', nullable: true },
                  entities: { type: 'object' },
                  ui: { type: 'object' }
                },
                initialState: {
                  user: null,
                  entities: {},
                  ui: { loading: false }
                },
                version: 1
              }
            ]
          },
          'design-transitions': {
            transitions: [
              {
                id: 'trans-update-user',
                name: 'updateUser',
                pure: true,
                mutation: false,
                returnsNewState: true,
                cases: ['update', 'clear', 'default']
              }
            ]
          },
          'design-reducers': {
            reducers: [
              {
                id: 'reducer-root',
                name: 'rootReducer',
                pure: true,
                handlesInitialState: true,
                alwaysReturnsState: true,
                sideEffects: false
              }
            ]
          },
          'design-selectors': {
            selectors: [
              {
                id: 'selector-user',
                name: 'selectUser',
                memoized: true,
                derivedFrom: ['user']
              }
            ]
          }
        }
      }
    };
  }

  validateStateDesign(result) {
    const validationResults = {
      valid: true,
      violations: [],
      warnings: []
    };
    
    // Validate state schemas
    const schemas = result.data?.results?.['design-state-schemas']?.schemas || [];
    schemas.forEach(schema => {
      const validation = this.validateMethodology({ ...schema, type: 'state' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `state-${schema.id}`,
          violations: validation.violations
        });
      }
    });
    
    // Validate transitions
    const transitions = result.data?.results?.['design-transitions']?.transitions || [];
    transitions.forEach(transition => {
      const validation = this.validateMethodology({ ...transition, type: 'transition' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `transition-${transition.id}`,
          violations: validation.violations
        });
      }
    });
    
    // Validate reducers
    const reducers = result.data?.results?.['design-reducers']?.reducers || [];
    reducers.forEach(reducer => {
      const validation = this.validateMethodology({ ...reducer, type: 'reducer' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `reducer-${reducer.id}`,
          violations: validation.violations
        });
      }
    });
    
    // Check for immutability violations
    const immutabilityViolations = this.checkImmutabilityViolations(schemas, transitions, reducers);
    if (immutabilityViolations.length > 0) {
      validationResults.valid = false;
      validationResults.violations.push(...immutabilityViolations);
    }
    
    return validationResults;
  }

  checkImmutabilityViolations(schemas, transitions, reducers) {
    const violations = [];
    
    // Check that all state schemas are marked as immutable
    schemas.forEach(schema => {
      if (!schema.immutable) {
        violations.push({
          artifact: `schema-${schema.id}`,
          violation: 'State schema must be immutable'
        });
      }
    });
    
    // Check that transitions don't mutate state
    transitions.forEach(transition => {
      if (transition.mutation === true) {
        violations.push({
          artifact: `transition-${transition.id}`,
          violation: 'Transition must not mutate state'
        });
      }
      if (!transition.returnsNewState) {
        violations.push({
          artifact: `transition-${transition.id}`,
          violation: 'Transition must return new state'
        });
      }
    });
    
    // Check that reducers are pure
    reducers.forEach(reducer => {
      if (!reducer.pure) {
        violations.push({
          artifact: `reducer-${reducer.id}`,
          violation: 'Reducer must be a pure function'
        });
      }
      if (reducer.sideEffects === true) {
        violations.push({
          artifact: `reducer-${reducer.id}`,
          violation: 'Reducer must not have side effects'
        });
      }
    });
    
    return violations;
  }

  getMetadata() {
    return {
      type: 'state-design',
      name: this.name,
      phase: this.getCurrentPhase(),
      capabilities: [
        'identify_state_containers',
        'design_state_schemas',
        'design_transitions',
        'design_reducers',
        'design_selectors',
        'validate_immutability'
      ],
      methodologyRules: Object.keys(this.methodologyRules),
      statePatterns: [
        'Redux Pattern',
        'Flux Pattern',
        'Event Sourcing',
        'CQRS',
        'Immutable State'
      ]
    };
  }
}