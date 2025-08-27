/**
 * DomainModelingAgent - BT Agent for domain modeling using DDD
 * 
 * Extends SDAgentBase to perform domain modeling using Domain-Driven Design
 * principles, creating bounded contexts, entities, aggregates, and domain events
 */

import { SDAgentBase } from './SDAgentBase.js';

export class DomainModelingAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'DomainModelingAgent',
      description: 'Models domain using DDD principles - bounded contexts, entities, aggregates',
      methodologyRules: {
        boundedContext: {
          mustHaveName: (artifact) => artifact.name && artifact.name.length > 0,
          mustHaveDescription: (artifact) => artifact.description && artifact.description.length > 0,
          mustHaveBoundaries: (artifact) => artifact.boundaries && Array.isArray(artifact.boundaries)
        },
        entity: {
          mustHaveId: (artifact) => artifact.id && artifact.id.length > 0,
          mustHaveName: (artifact) => artifact.name && artifact.name.length > 0,
          mustHaveProperties: (artifact) => artifact.properties && Array.isArray(artifact.properties),
          mustHaveInvariants: (artifact) => artifact.invariants && Array.isArray(artifact.invariants),
          mustBelongToContext: (artifact) => artifact.boundedContext && artifact.boundedContext.length > 0
        },
        aggregate: {
          mustHaveRootEntity: (artifact) => artifact.rootEntity && artifact.rootEntity.length > 0,
          mustHaveConsistencyBoundary: (artifact) => artifact.consistencyBoundary && artifact.consistencyBoundary.length > 0,
          mustHaveInvariants: (artifact) => artifact.invariants && Array.isArray(artifact.invariants)
        },
        domainEvent: {
          mustHaveName: (artifact) => artifact.name && artifact.name.endsWith('Event'),
          mustHavePayload: (artifact) => artifact.payload && typeof artifact.payload === 'object',
          mustHaveAggregate: (artifact) => artifact.aggregate && artifact.aggregate.length > 0
        }
      }
    });
    
    this.workflowConfig = this.createWorkflowConfig();
  }

  /**
   * Get current methodology phase
   */
  getCurrentPhase() {
    return 'domain-modeling';
  }

  /**
   * Create BT workflow configuration for domain modeling
   */
  createWorkflowConfig() {
    return {
      type: 'sequence',
      id: 'domain-modeling-workflow',
      description: 'Complete domain modeling workflow using DDD',
      children: [
        {
          type: 'action',
          id: 'retrieve-requirements',
          tool: 'retrieve_context',
          description: 'Retrieve requirements context from database',
          params: {
            query: {
              type: 'parsed_requirements',
              projectId: '${input.projectId}'
            }
          }
        },
        {
          type: 'action',
          id: 'identify-bounded-contexts',
          tool: 'identify_bounded_contexts',
          description: 'Identify bounded contexts from requirements',
          params: {
            requirementsContext: '${results.retrieve-requirements.context}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'parallel',
          id: 'model-domain-components',
          description: 'Model entities, value objects, and aggregates in parallel',
          children: [
            {
              type: 'action',
              id: 'model-entities',
              tool: 'model_entities',
              description: 'Model domain entities with invariants',
              params: {
                boundedContexts: '${results.identify-bounded-contexts.boundedContexts}',
                requirementsContext: '${results.retrieve-requirements.context}',
                projectId: '${input.projectId}'
              }
            },
            {
              type: 'action',
              id: 'identify-value-objects',
              tool: 'identify_value_objects',
              description: 'Identify immutable value objects',
              params: {
                boundedContexts: '${results.identify-bounded-contexts.boundedContexts}',
                requirementsContext: '${results.retrieve-requirements.context}',
                projectId: '${input.projectId}'
              }
            }
          ]
        },
        {
          type: 'action',
          id: 'identify-aggregates',
          tool: 'identify_aggregates',
          description: 'Identify aggregate roots and boundaries',
          params: {
            entities: '${results.model-entities.entities}',
            valueObjects: '${results.identify-value-objects.valueObjects}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'extract-domain-events',
          tool: 'extract_domain_events',
          description: 'Extract domain events from entities and aggregates',
          params: {
            entities: '${results.model-entities.entities}',
            aggregates: '${results.identify-aggregates.aggregates}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'build-ubiquitous-language',
          tool: 'build_ubiquitous_language',
          description: 'Build ubiquitous language dictionary',
          params: {
            boundedContexts: '${results.identify-bounded-contexts.boundedContexts}',
            entities: '${results.model-entities.entities}',
            domainEvents: '${results.extract-domain-events.domainEvents}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'validate-domain-model',
          tool: 'validate_domain_model',
          description: 'Validate complete domain model',
          params: {
            boundedContexts: '${results.identify-bounded-contexts.boundedContexts}',
            entities: '${results.model-entities.entities}',
            aggregates: '${results.identify-aggregates.aggregates}',
            domainEvents: '${results.extract-domain-events.domainEvents}'
          }
        },
        {
          type: 'action',
          id: 'store-domain-artifacts',
          tool: 'store_artifact',
          description: 'Store all domain modeling artifacts',
          params: {
            artifact: {
              type: 'domain-model',
              data: {
                boundedContexts: '${results.identify-bounded-contexts.boundedContexts}',
                entities: '${results.model-entities.entities}',
                valueObjects: '${results.identify-value-objects.valueObjects}',
                aggregates: '${results.identify-aggregates.aggregates}',
                domainEvents: '${results.extract-domain-events.domainEvents}',
                ubiquitousLanguage: '${results.build-ubiquitous-language.ubiquitousLanguage}',
                validation: '${results.validate-domain-model}'
              },
              metadata: {
                phase: 'domain-modeling',
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

  /**
   * Process domain modeling request
   */
  async receive(message) {
    const { type, payload } = message;
    
    if (type !== 'model_domain') {
      return {
        success: false,
        error: 'DomainModelingAgent only handles model_domain messages'
      };
    }
    
    try {
      // Build context for domain modeling
      const context = await this.buildContext('domain', {
        projectId: payload.projectId
      });
      
      // Make strategic DDD decisions using LLM
      const domainStrategy = await this.decideDomainStrategy(context);
      
      // Create execution context
      const executionContext = this.createExecutionContext({
        input: {
          projectId: payload.projectId,
          domainStrategy
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
      
      // Validate all artifacts
      const validation = this.validateDomainArtifacts(result);
      
      return {
        success: result.success,
        data: {
          ...result.data,
          validation,
          domainStrategy,
          projectId: executionContext.input.projectId,
          phase: this.getCurrentPhase()
        }
      };
      
    } catch (error) {
      console.error(`[DomainModelingAgent] Error modeling domain:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Decide domain modeling strategy using LLM
   */
  async decideDomainStrategy(context) {
    const prompt = `Based on the requirements context, determine the domain modeling strategy:

Requirements Context:
${JSON.stringify(context.artifacts.requirements, null, 2)}

Please provide a domain modeling strategy including:
1. Suggested number of bounded contexts
2. Core domain vs supporting/generic subdomains
3. Key entities and their relationships
4. Aggregate boundary recommendations
5. Important domain events to capture

Return as JSON with structure:
{
  "boundedContextCount": number,
  "coreDomain": "name of core domain",
  "supportingDomains": ["domain1", "domain2"],
  "keyEntities": ["entity1", "entity2"],
  "aggregateStrategy": "description",
  "domainEventStrategy": "description",
  "reasoning": "explanation"
}`;

    const decision = await this.makeLLMDecision(prompt, context);
    return decision;
  }

  /**
   * Execute BT workflow (placeholder)
   */
  async executeBTWorkflow(workflow, context) {
    console.log(`[DomainModelingAgent] Executing workflow:`, workflow.id);
    
    // In production, this would use BehaviorTreeExecutor
    return {
      success: true,
      data: {
        workflowId: workflow.id,
        executionTime: Date.now(),
        results: {
          'identify-bounded-contexts': {
            boundedContexts: [
              {
                id: 'bc-core',
                name: 'Core Domain',
                description: 'Main business logic',
                boundaries: ['User Management', 'Order Processing'],
                entities: []
              }
            ]
          },
          'model-entities': {
            entities: [
              {
                id: 'entity-user',
                name: 'User',
                boundedContext: 'bc-core',
                properties: [],
                invariants: ['Email must be unique']
              }
            ]
          },
          'identify-aggregates': {
            aggregates: [
              {
                id: 'agg-user',
                rootEntity: 'entity-user',
                entities: ['entity-user'],
                consistencyBoundary: 'User data consistency',
                invariants: []
              }
            ]
          },
          'extract-domain-events': {
            domainEvents: [
              {
                id: 'event-user-created',
                name: 'UserCreatedEvent',
                aggregate: 'agg-user',
                payload: { userId: 'string', email: 'string' }
              }
            ]
          }
        }
      }
    };
  }

  /**
   * Validate domain artifacts against DDD rules
   */
  validateDomainArtifacts(result) {
    const validationResults = {
      valid: true,
      violations: [],
      warnings: []
    };
    
    // Validate bounded contexts
    const contexts = result.data?.results?.['identify-bounded-contexts']?.boundedContexts || [];
    contexts.forEach(context => {
      const validation = this.validateMethodology({ ...context, type: 'boundedContext' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `context-${context.id}`,
          violations: validation.violations
        });
      }
    });
    
    // Validate entities
    const entities = result.data?.results?.['model-entities']?.entities || [];
    entities.forEach(entity => {
      const validation = this.validateMethodology({ ...entity, type: 'entity' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `entity-${entity.id}`,
          violations: validation.violations
        });
      }
      
      // Check entity belongs to a context
      if (!contexts.some(c => c.id === entity.boundedContext)) {
        validationResults.warnings.push(`Entity ${entity.id} references non-existent context`);
      }
    });
    
    // Validate aggregates
    const aggregates = result.data?.results?.['identify-aggregates']?.aggregates || [];
    aggregates.forEach(aggregate => {
      const validation = this.validateMethodology({ ...aggregate, type: 'aggregate' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `aggregate-${aggregate.id}`,
          violations: validation.violations
        });
      }
    });
    
    // Validate domain events
    const events = result.data?.results?.['extract-domain-events']?.domainEvents || [];
    events.forEach(event => {
      const validation = this.validateMethodology({ ...event, type: 'domainEvent' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `event-${event.id}`,
          violations: validation.violations
        });
      }
    });
    
    return validationResults;
  }

  /**
   * Get agent metadata
   */
  getMetadata() {
    return {
      type: 'domain',
      name: this.name,
      phase: this.getCurrentPhase(),
      capabilities: [
        'identify_bounded_contexts',
        'model_entities',
        'identify_value_objects',
        'identify_aggregates',
        'extract_domain_events',
        'build_ubiquitous_language'
      ],
      methodologyRules: Object.keys(this.methodologyRules),
      dddPatterns: [
        'Bounded Context',
        'Entity',
        'Value Object',
        'Aggregate',
        'Domain Event',
        'Ubiquitous Language'
      ]
    };
  }
}