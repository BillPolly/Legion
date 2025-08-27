/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * ValueObjectIdentifierTool - Identifies value objects in domain model using LLM
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const valueObjectIdentifierToolInputSchema = {
  type: 'object',
  properties: {
    entities: {
      type: 'array',
      items: {},
      description: 'Domain entities to analyze'
    },
    boundedContexts: {
      type: 'array',
      items: {},
      description: 'Bounded contexts for reference'
    },
    projectId: {
      type: 'string',
      description: 'Project ID'
    }
  },
  required: ['entities', 'boundedContexts']
};

// Output schema as plain JSON Schema
const valueObjectIdentifierToolOutputSchema = {
  type: 'object',
  properties: {
    valueObjects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          entityId: { type: 'string' },
          attributes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                required: { type: 'boolean' },
                validation: { type: 'string' },
                example: { type: 'string' }
              }
            }
          },
          immutability: {
            type: 'object',
            properties: {
              enforcedBy: { type: 'string' },
              description: { type: 'string' }
            }
          },
          equality: {
            type: 'object',
            properties: {
              basedOn: {
                type: 'array',
                items: { type: 'string' }
              },
              description: { type: 'string' }
            }
          },
          validation: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rule: { type: 'string' },
                errorMessage: { type: 'string' }
              }
            }
          },
          usedIn: {
            type: 'array',
            items: { type: 'string' }
          },
          examples: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      },
      description: 'Identified value objects'
    },
    artifactId: {
      type: 'string',
      description: 'Stored artifact ID'
    },
    summary: {
      type: 'object',
      properties: {
        totalValueObjects: { type: 'number' },
        byEntity: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entity: { type: 'string' },
              valueObjectCount: { type: 'number' }
            }
          }
        }
      },
      description: 'Summary of value objects'
    }
  },
  required: ['valueObjects', 'artifactId', 'summary']
};

export class ValueObjectIdentifierTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'identify_value_objects',
      description: 'Identify value objects within entities following DDD principles',
      inputSchema: valueObjectIdentifierToolInputSchema,
      outputSchema: valueObjectIdentifierToolOutputSchema
    });
    
    this.llmClient = dependencies.llmClient;
    this.designDatabase = dependencies.designDatabase;
    this.resourceManager = dependencies.resourceManager;
  }

  async execute(args) {
    const { entities, boundedContexts, projectId } = args;
    
    try {
      this.emit('progress', { percentage: 0, status: 'Starting value object identification...' });
      
      // Get LLM client
      const llmClient = await this.getLLMClient();
      
      // Identify value objects for each entity
      const allValueObjects = [];
      
      for (const entity of entities) {
        this.emit('progress', { 
          percentage: Math.floor((entities.indexOf(entity) / entities.length) * 70),
          status: `Analyzing entity ${entity.name} for value objects...`
        });
        
        // Create value object identification prompt
        const prompt = this.createValueObjectPrompt(entity, boundedContexts);
        
        // Call LLM for value object identification
        const llmResponse = await llmClient.complete(prompt, {
          temperature: 0.3,
          maxTokens: 2000,
          system: 'You are a DDD expert. Identify value objects with immutability and no identity.'
        });
        
        // Parse value objects from response
        const entityValueObjects = this.parseLLMResponse(llmResponse, entity.id);
        
        allValueObjects.push(...entityValueObjects);
      }
      
      this.emit('progress', { percentage: 80, status: 'Validating value objects...' });
      
      // Validate all value objects
      const validation = this.validateValueObjects(allValueObjects);
      if (!validation.valid) {
        return throw new Error(`Invalid value objects: ${validation.errors.join(', ', {
        cause: {
          errorType: 'operation_error'
        }
      })}`);
      }
      
      // Store value objects
      const storedArtifact = await this.storeValueObjects(allValueObjects, projectId);
      
      this.emit('progress', { percentage: 100, status: 'Value object identification completed' });
      
      return {
        valueObjects: allValueObjects,
        artifactId: storedArtifact.id,
        summary: {
          totalValueObjects: allValueObjects.length,
          byEntity: entities.map(e => ({
            entity: e.name,
            valueObjectCount: allValueObjects.filter(vo => vo.entityId === e.id).length
          }))
        }
      };
      
    } catch (error) {
      return throw new Error(`Failed to identify value objects: ${error.message}`, {
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

  createValueObjectPrompt(entity, boundedContexts) {
    return `Analyze the entity and identify value objects following DDD principles.

Entity Details:
${JSON.stringify(entity, null, 2)}

Bounded Context:
${JSON.stringify(boundedContexts.find(c => c.id === entity.boundedContext), null, 2)}

Identify value objects following these DDD principles:
1. Value objects have no identity (they are equal if their values are equal)
2. Value objects are immutable (once created, they cannot change)
3. Value objects encapsulate related attributes that form a conceptual whole
4. Value objects should have validation logic for their values
5. Value objects can contain other value objects but not entities

Common examples: Money, Address, DateRange, Email, PhoneNumber, Name

Return a JSON array of value objects with this structure:
{
  "valueObjects": [
    {
      "id": "vo-[name]",
      "name": "ValueObjectName",
      "description": "What this value object represents",
      "attributes": [
        {
          "name": "attributeName",
          "type": "string|number|boolean|date",
          "required": true/false,
          "validation": "Validation rules",
          "example": "Example value"
        }
      ],
      "immutability": {
        "enforcedBy": "constructor|factory|builder",
        "description": "How immutability is enforced"
      },
      "equality": {
        "basedOn": ["attribute1", "attribute2"],
        "description": "How equality is determined"
      },
      "validation": [
        {
          "rule": "Validation rule description",
          "errorMessage": "Error message when validation fails"
        }
      ],
      "usedIn": ["Property name in entity where this VO is used"],
      "examples": ["Example usage scenarios"]
    }
  ],
  "reasoning": "Explanation of value object identification decisions"
}

Focus on identifying true value objects that enhance the domain model. Return ONLY valid JSON.`;
  }

  parseLLMResponse(response, entityId) {
    try {
      const cleanedResponse = response.trim();
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = cleanedResponse.substring(jsonStart, jsonEnd);
        const parsed = JSON.parse(jsonStr);
        
        // Add entity reference to each value object
        const valueObjects = (parsed.valueObjects || []).map(vo => ({
          ...vo,
          entityId: entityId
        }));
        
        return valueObjects;
      }
      
      return JSON.parse(cleanedResponse).valueObjects || [];
      
    } catch (error) {
      // FAIL FAST - no fallbacks allowed
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}. Response was: ${response.substring(0, 200)}...`);
    }
  }

  validateValueObjects(valueObjects) {
    const errors = [];
    
    valueObjects.forEach((vo, index) => {
      if (!vo.id) errors.push(`Value object ${index} missing ID`);
      if (!vo.name) errors.push(`Value object ${index} missing name`);
      if (!vo.attributes || !Array.isArray(vo.attributes)) {
        errors.push(`Value object ${vo.name} must have attributes array`);
      }
      if (!vo.immutability) {
        errors.push(`Value object ${vo.name} must define immutability enforcement`);
      }
      if (!vo.equality) {
        errors.push(`Value object ${vo.name} must define equality rules`);
      }
      
      // Validate attributes
      vo.attributes?.forEach((attr, attrIndex) => {
        if (!attr.name) errors.push(`Value object ${vo.name} attribute ${attrIndex} missing name`);
        if (!attr.type) errors.push(`Value object ${vo.name} attribute ${attr.name} missing type`);
      });
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  async storeValueObjects(valueObjects, projectId) {
    const artifact = {
      type: 'value_objects',
      projectId: projectId || `project_${Date.now()}`,
      data: valueObjects,
      metadata: {
        toolName: this.name,
        timestamp: new Date().toISOString(),
        valueObjectCount: valueObjects.length,
        entitiesAnalyzed: [...new Set(valueObjects.map(vo => vo.entityId))]
      }
    };
    
    console.log('[ValueObjectIdentifierTool] Storing value objects:', artifact.metadata.valueObjectCount);
    
    return {
      ...artifact,
      id: `artifact_${Date.now()}`
    };
  }
}