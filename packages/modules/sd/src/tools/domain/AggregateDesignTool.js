/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * AggregateDesignTool - Designs aggregates and aggregate roots using LLM
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const aggregateDesignToolInputSchema = {
  type: 'object',
  properties: {
    entities: {
      type: 'array',
      items: {},
      description: 'Domain entities'
    },
    valueObjects: {
      type: 'array',
      items: {},
      description: 'Value objects'
    },
    boundedContexts: {
      type: 'array',
      items: {},
      description: 'Bounded contexts'
    },
    projectId: {
      type: 'string',
      description: 'Project ID'
    }
  },
  required: ['entities', 'boundedContexts']
};

// Output schema as plain JSON Schema
const aggregateDesignToolOutputSchema = {
  type: 'object',
  properties: {
    aggregates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          boundedContext: { type: 'string' },
          aggregateRoot: {
            type: 'object',
            properties: {
              entityId: { type: 'string' },
              entityName: { type: 'string' },
              responsibilities: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          },
          entities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                entityId: { type: 'string' },
                entityName: { type: 'string' },
                role: { type: 'string' }
              }
            }
          },
          valueObjects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                valueObjectId: { type: 'string' },
                valueObjectName: { type: 'string' },
                usage: { type: 'string' }
              }
            }
          },
          invariants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                rule: { type: 'string' },
                enforcedBy: { type: 'string' }
              }
            }
          },
          commands: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                invariantsChecked: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          },
          events: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                payload: { type: 'string' }
              }
            }
          },
          boundaries: {
            type: 'object',
            properties: {
              transactional: { type: 'string' },
              consistency: { type: 'string' },
              references: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          }
        }
      },
      description: 'Designed aggregates'
    },
    artifactId: {
      type: 'string',
      description: 'Stored artifact ID'
    },
    summary: {
      type: 'object',
      properties: {
        totalAggregates: { type: 'number' },
        byContext: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              context: { type: 'string' },
              aggregateCount: { type: 'number' }
            }
          }
        }
      },
      description: 'Summary of aggregates'
    }
  },
  required: ['aggregates', 'artifactId', 'summary']
};

export class AggregateDesignTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'design_aggregates',
      description: 'Design aggregates and identify aggregate roots following DDD principles',
      inputSchema: aggregateDesignToolInputSchema,
      outputSchema: aggregateDesignToolOutputSchema
    });
    
    this.llmClient = dependencies.llmClient;
    this.designDatabase = dependencies.designDatabase;
    this.resourceManager = dependencies.resourceManager;
  }

  async _execute(args) {
    const { entities, valueObjects = [], boundedContexts, projectId } = args;
    
    try {
      this.emit('progress', { percentage: 0, status: 'Starting aggregate design...' });
      
      // Get LLM client
      const llmClient = await this.getLLMClient();
      
      // Design aggregates for each bounded context
      const allAggregates = [];
      
      for (const context of boundedContexts) {
        this.emit('progress', { 
          percentage: Math.floor((boundedContexts.indexOf(context) / boundedContexts.length) * 70),
          status: `Designing aggregates for ${context.name}...`
        });
        
        // Get entities and value objects for this context
        const contextEntities = entities.filter(e => e.boundedContext === context.id);
        const contextValueObjects = valueObjects.filter(vo => 
          contextEntities.some(e => e.id === vo.entityId)
        );
        
        // Create aggregate design prompt
        const prompt = this.createAggregateDesignPrompt(
          context, 
          contextEntities, 
          contextValueObjects
        );
        
        // Call LLM for aggregate design
        const llmResponse = await llmClient.complete(prompt, {
          temperature: 0.3,
          maxTokens: 3000,
          system: 'You are a DDD expert. Design aggregates with clear boundaries and consistency rules.'
        });
        
        // Parse aggregates from response
        const contextAggregates = this.parseLLMResponse(llmResponse, context.id);
        
        allAggregates.push(...contextAggregates);
      }
      
      this.emit('progress', { percentage: 80, status: 'Validating aggregates...' });
      
      // Validate all aggregates
      const validation = this.validateAggregates(allAggregates);
      if (!validation.valid) {
        throw new Error(`Invalid aggregates: ${validation.errors.join(', ', {
        cause: {
          errorType: 'operation_error'
        }
      })}`);
      }
      
      // Store aggregates
      const storedArtifact = await this.storeAggregates(allAggregates, projectId);
      
      this.emit('progress', { percentage: 100, status: 'Aggregate design completed' });
      
      return {
        aggregates: allAggregates,
        artifactId: storedArtifact.id,
        summary: {
          totalAggregates: allAggregates.length,
          byContext: boundedContexts.map(c => ({
            context: c.name,
            aggregateCount: allAggregates.filter(a => a.boundedContext === c.id).length
          }))
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to design aggregates: ${error.message}`, {
        cause: {
          errorType: 'operation_error'
        }
      })
    }
  }

  async getLLMClient() {
    if (this.llmClient) return this.llmClient;
    
    if (this.resourceManager) {
      this.llmClient = this.resourceManager.get('llmClient');
      if (this.llmClient) return this.llmClient;
    }
    
    throw new Error('LLM client not available');
  }

  createAggregateDesignPrompt(context, entities, valueObjects) {
    return `Design aggregates for the bounded context following DDD principles.

Bounded Context: ${context.name}
${JSON.stringify(context, null, 2)}

Entities in this context:
${JSON.stringify(entities, null, 2)}

Value Objects in this context:
${JSON.stringify(valueObjects, null, 2)}

Design aggregates following these DDD principles:
1. Each aggregate has one aggregate root (an entity)
2. Aggregates define transactional consistency boundaries
3. References between aggregates use IDs, not object references
4. Aggregates should be small (prefer smaller aggregates)
5. Protect business invariants within aggregate boundaries
6. One aggregate per transaction

Return a JSON array of aggregates with this structure:
{
  "aggregates": [
    {
      "id": "agg-[name]",
      "name": "AggregateName",
      "description": "What this aggregate represents and protects",
      "aggregateRoot": {
        "entityId": "entity-id",
        "entityName": "EntityName",
        "responsibilities": ["Responsibility 1", "Responsibility 2"]
      },
      "entities": [
        {
          "entityId": "entity-id",
          "entityName": "EntityName",
          "role": "Role within the aggregate"
        }
      ],
      "valueObjects": [
        {
          "valueObjectId": "vo-id",
          "valueObjectName": "ValueObjectName",
          "usage": "How it's used in the aggregate"
        }
      ],
      "invariants": [
        {
          "name": "InvariantName",
          "rule": "Business rule that must be maintained",
          "enforcedBy": "How the aggregate enforces this rule"
        }
      ],
      "commands": [
        {
          "name": "CommandName",
          "description": "What this command does",
          "invariantsChecked": ["Invariant1", "Invariant2"]
        }
      ],
      "events": [
        {
          "name": "EventName",
          "description": "When this event is raised",
          "payload": "What data the event carries"
        }
      ],
      "boundaries": {
        "transactional": "What operations must be atomic",
        "consistency": "What data must be consistent",
        "references": ["Other aggregates referenced by ID"]
      }
    }
  ],
  "reasoning": "Explanation of aggregate design decisions"
}

Focus on designing cohesive aggregates that protect business invariants. Return ONLY valid JSON.`;
  }

  parseLLMResponse(response, contextId) {
    try {
      const cleanedResponse = response.trim();
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = cleanedResponse.substring(jsonStart, jsonEnd);
        const parsed = JSON.parse(jsonStr);
        
        // Add bounded context to each aggregate
        const aggregates = (parsed.aggregates || []).map(aggregate => ({
          ...aggregate,
          boundedContext: contextId
        }));
        
        return aggregates;
      }
      
      return JSON.parse(cleanedResponse).aggregates || [];
      
    } catch (error) {
      // FAIL FAST - no fallbacks allowed
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}. Response was: ${response.substring(0, 200)}...`);
    }
  }

  validateAggregates(aggregates) {
    const errors = [];
    
    aggregates.forEach((aggregate, index) => {
      if (!aggregate.id) errors.push(`Aggregate ${index} missing ID`);
      if (!aggregate.name) errors.push(`Aggregate ${index} missing name`);
      if (!aggregate.aggregateRoot) errors.push(`Aggregate ${aggregate.name} missing aggregate root`);
      if (!aggregate.boundedContext) errors.push(`Aggregate ${aggregate.name} missing bounded context`);
      
      // Validate aggregate root
      if (aggregate.aggregateRoot) {
        if (!aggregate.aggregateRoot.entityId) {
          errors.push(`Aggregate ${aggregate.name} root missing entity ID`);
        }
        if (!aggregate.aggregateRoot.entityName) {
          errors.push(`Aggregate ${aggregate.name} root missing entity name`);
        }
      }
      
      // Validate invariants
      if (!aggregate.invariants || !Array.isArray(aggregate.invariants)) {
        errors.push(`Aggregate ${aggregate.name} must have invariants array`);
      }
      
      aggregate.invariants?.forEach((invariant, invIndex) => {
        if (!invariant.rule) {
          errors.push(`Aggregate ${aggregate.name} invariant ${invIndex} missing rule`);
        }
      });
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async storeAggregates(aggregates, projectId) {
    const artifact = {
      type: 'aggregates',
      projectId: projectId || `project_${Date.now()}`,
      data: aggregates,
      metadata: {
        toolName: this.name,
        timestamp: new Date().toISOString(),
        aggregateCount: aggregates.length,
        contextsRepresented: [...new Set(aggregates.map(a => a.boundedContext))]
      }
    };
    
    console.log('[AggregateDesignTool] Storing aggregates:', artifact.metadata.aggregateCount);
    
    return {
      ...artifact,
      id: `artifact_${Date.now()}`
    };
  }
}