/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * EntityModelingTool - Models domain entities with DDD principles using LLM
 */

import { Tool, ToolResult } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const entityModelingToolInputSchema = {
  type: 'object',
  properties: {
    boundedContexts: {
      type: 'array',
      items: {},
      description: 'Bounded contexts to model entities for'
    },
    requirementsContext: {
      description: 'Requirements context'
    },
    projectId: {
      type: 'string',
      description: 'Project ID'
    }
  },
  required: ['boundedContexts', 'requirementsContext']
};

// Output schema as plain JSON Schema
const entityModelingToolOutputSchema = {
  type: 'object',
  properties: {
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          boundedContext: { type: 'string' },
          identity: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              description: { type: 'string' }
            }
          },
          properties: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                required: { type: 'boolean' },
                description: { type: 'string' },
                validation: { type: 'string' }
              }
            }
          },
          behaviors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                parameters: {
                  type: 'array',
                  items: { type: 'string' }
                },
                sideEffects: { type: 'string' },
                invariantsChecked: {
                  type: 'array',
                  items: { type: 'string' }
                }
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
                errorMessage: { type: 'string' }
              }
            }
          },
          relationships: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                target: { type: 'string' },
                description: { type: 'string' }
              }
            }
          },
          lifecycle: {
            type: 'object',
            properties: {
              creation: { type: 'string' },
              modification: { type: 'string' },
              deletion: { type: 'string' }
            }
          }
        }
      },
      description: 'Domain entities'
    },
    artifactId: {
      type: 'string',
      description: 'Stored artifact ID'
    },
    summary: {
      type: 'object',
      properties: {
        totalEntities: { type: 'number' },
        byContext: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              context: { type: 'string' },
              entityCount: { type: 'number' }
            }
          }
        }
      },
      description: 'Summary of entities'
    }
  },
  required: ['entities', 'artifactId', 'summary']
};

export class EntityModelingTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'model_entities',
      description: 'Model domain entities with invariants following DDD principles',
      inputSchema: entityModelingToolInputSchema,
      outputSchema: entityModelingToolOutputSchema
    });
    
    this.llmClient = dependencies.llmClient;
    this.designDatabase = dependencies.designDatabase;
    this.resourceManager = dependencies.resourceManager;
  }

  async execute(args) {
    const { boundedContexts, requirementsContext, projectId } = args;
    
    try {
      this.emit('progress', { percentage: 0, status: 'Starting entity modeling...' });
      
      // Get LLM client
      const llmClient = await this.getLLMClient();
      
      // Model entities for each bounded context
      const allEntities = [];
      
      for (const context of boundedContexts) {
        this.emit('progress', { 
          percentage: Math.floor((boundedContexts.indexOf(context) / boundedContexts.length) * 70),
          status: `Modeling entities for ${context.name}...`
        });
        
        // Create entity modeling prompt for this context
        const prompt = this.createEntityModelingPrompt(context, requirementsContext);
        
        // Call LLM for entity modeling
        const llmResponse = await llmClient.complete(prompt, {
          temperature: 0.3,
          maxTokens: 3000,
          system: 'You are a DDD expert. Model entities with clear identities, properties, behaviors, and invariants.'
        });
        
        // Parse entities from response
        const contextEntities = this.parseLLMResponse(llmResponse, context.id);
        
        allEntities.push(...contextEntities);
      }
      
      this.emit('progress', { percentage: 80, status: 'Validating entities...' });
      
      // Validate all entities
      const validation = this.validateEntities(allEntities);
      if (!validation.valid) {
        return ToolResult.failure(`Invalid entities: ${validation.errors.join(', ')}`);
      }
      
      // Store entities
      const storedArtifact = await this.storeEntities(allEntities, projectId);
      
      this.emit('progress', { percentage: 100, status: 'Entity modeling completed' });
      
      return ToolResult.success({
        entities: allEntities,
        artifactId: storedArtifact.id,
        summary: {
          totalEntities: allEntities.length,
          byContext: boundedContexts.map(c => ({
            context: c.name,
            entityCount: allEntities.filter(e => e.boundedContext === c.id).length
          }))
        }
      });
      
    } catch (error) {
      return ToolResult.failure(`Failed to model entities: ${error.message}`);
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

  createEntityModelingPrompt(context, requirementsContext) {
    return `Model domain entities for the bounded context: ${context.name}

Bounded Context Details:
${JSON.stringify(context, null, 2)}

Requirements Context:
${JSON.stringify(requirementsContext, null, 2)}

Model entities following DDD principles:
1. Each entity must have a unique identity
2. Define clear properties with types
3. Specify behaviors (methods) the entity can perform
4. Define invariants (business rules that must always be true)
5. Consider entity lifecycle (creation, modification, deletion)
6. Identify relationships with other entities

Return a JSON array of entities with this structure:
{
  "entities": [
    {
      "id": "entity-[name]",
      "name": "EntityName",
      "description": "Clear description of what this entity represents",
      "identity": {
        "type": "uuid|natural|composite",
        "description": "How this entity is uniquely identified"
      },
      "properties": [
        {
          "name": "propertyName",
          "type": "string|number|boolean|date|object|array",
          "required": true/false,
          "description": "What this property represents",
          "validation": "Validation rules if any"
        }
      ],
      "behaviors": [
        {
          "name": "behaviorName",
          "description": "What this behavior does",
          "parameters": ["param1", "param2"],
          "sideEffects": "Any side effects",
          "invariantsChecked": ["invariant1"]
        }
      ],
      "invariants": [
        {
          "name": "invariantName",
          "rule": "Business rule that must always be true",
          "errorMessage": "Message when invariant is violated"
        }
      ],
      "relationships": [
        {
          "type": "has-one|has-many|belongs-to",
          "target": "OtherEntityName",
          "description": "Nature of the relationship"
        }
      ],
      "lifecycle": {
        "creation": "How the entity is created",
        "modification": "How the entity can be modified",
        "deletion": "Deletion rules and constraints"
      }
    }
  ],
  "reasoning": "Explanation of entity modeling decisions"
}

Focus on modeling rich domain entities that encapsulate business logic. Return ONLY valid JSON.`;
  }

  parseLLMResponse(response, contextId) {
    try {
      const cleanedResponse = response.trim();
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = cleanedResponse.substring(jsonStart, jsonEnd);
        const parsed = JSON.parse(jsonStr);
        
        // Add bounded context to each entity
        const entities = (parsed.entities || []).map(entity => ({
          ...entity,
          boundedContext: contextId
        }));
        
        return entities;
      }
      
      return JSON.parse(cleanedResponse).entities || [];
      
    } catch (error) {
      // FAIL FAST - no fallbacks allowed
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}. Response was: ${response.substring(0, 200)}...`);
    }
  }

  validateEntities(entities) {
    const errors = [];
    
    entities.forEach((entity, index) => {
      if (!entity.id) errors.push(`Entity ${index} missing ID`);
      if (!entity.name) errors.push(`Entity ${index} missing name`);
      if (!entity.boundedContext) errors.push(`Entity ${index} missing bounded context`);
      if (!entity.identity) errors.push(`Entity ${entity.name} missing identity definition`);
      if (!entity.properties || !Array.isArray(entity.properties)) {
        errors.push(`Entity ${entity.name} must have properties array`);
      }
      if (!entity.invariants || !Array.isArray(entity.invariants)) {
        errors.push(`Entity ${entity.name} must have invariants array`);
      }
      
      // Validate properties
      entity.properties?.forEach((prop, propIndex) => {
        if (!prop.name) errors.push(`Entity ${entity.name} property ${propIndex} missing name`);
        if (!prop.type) errors.push(`Entity ${entity.name} property ${prop.name} missing type`);
      });
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async storeEntities(entities, projectId) {
    const artifact = {
      type: 'domain_entities',
      projectId: projectId || `project_${Date.now()}`,
      data: entities,
      metadata: {
        toolName: this.name,
        timestamp: new Date().toISOString(),
        entityCount: entities.length,
        contextsRepresented: [...new Set(entities.map(e => e.boundedContext))]
      }
    };
    
    console.log('[EntityModelingTool] Storing entities:', artifact.metadata.entityCount);
    
    return {
      ...artifact,
      id: `artifact_${Date.now()}`
    };
  }
}