/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * DomainEventExtractorTool - Extracts domain events from entities
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const domainEventExtractorToolInputSchema = {
  type: 'object',
  properties: {
    entities: {
      type: 'array',
      items: {},
      description: 'Domain entities'
    },
    aggregates: {
      type: 'array',
      items: {},
      description: 'Domain aggregates'
    },
    projectId: {
      type: 'string',
      description: 'Project ID'
    }
  },
  required: ['entities', 'aggregates']
};

// Output schema as plain JSON Schema
const domainEventExtractorToolOutputSchema = {
  type: 'object',
  properties: {
    domainEvents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          aggregateId: { type: 'string' },
          aggregateName: { type: 'string' },
          trigger: { type: 'string' },
          timing: { type: 'string' },
          payload: {
            type: 'object',
            properties: {
              structure: { type: 'object' },
              example: { type: 'object' }
            }
          },
          consequences: {
            type: 'array',
            items: { type: 'string' }
          },
          eventType: { type: 'string' },
          version: { type: 'string' },
          metadata: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              correlationId: { type: 'string' },
              causationId: { type: 'string' }
            }
          }
        }
      },
      description: 'Extracted domain events'
    },
    artifactId: {
      type: 'string',
      description: 'Stored artifact ID'
    },
    summary: {
      type: 'object',
      properties: {
        totalEvents: { type: 'number' },
        byAggregate: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              aggregate: { type: 'string' },
              eventCount: { type: 'number' }
            }
          }
        },
        eventTypes: {
          type: 'object',
          properties: {
            creation: { type: 'number' },
            modification: { type: 'number' },
            deletion: { type: 'number' },
            business: { type: 'number' }
          }
        }
      },
      description: 'Summary of domain events'
    }
  },
  required: ['domainEvents', 'artifactId', 'summary']
};

export class DomainEventExtractorTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'extract_domain_events',
      description: 'Extract domain events from entities and aggregates using event storming techniques',
      inputSchema: domainEventExtractorToolInputSchema,
      outputSchema: domainEventExtractorToolOutputSchema
    });
    
    this.llmClient = dependencies.llmClient;
    this.designDatabase = dependencies.designDatabase;
    this.resourceManager = dependencies.resourceManager;
  }

  async _execute(args) {
    const { entities, aggregates, projectId } = args;
    
    try {
      this.emit('progress', { percentage: 0, status: 'Starting domain event extraction...' });
      
      // Get LLM client
      const llmClient = await this.getLLMClient();
      
      // Extract domain events for each aggregate
      const allDomainEvents = [];
      
      for (const aggregate of aggregates) {
        this.emit('progress', { 
          percentage: Math.floor((aggregates.indexOf(aggregate) / aggregates.length) * 70),
          status: `Extracting events for ${aggregate.name}...`
        });
        
        // Get entities for this aggregate
        const aggregateEntities = entities.filter(e => 
          aggregate.entities?.some(ae => ae.entityId === e.id) ||
          aggregate.aggregateRoot?.entityId === e.id
        );
        
        // Create event extraction prompt
        const prompt = this.createEventExtractionPrompt(aggregate, aggregateEntities);
        
        // Call LLM for event extraction
        const llmResponse = await llmClient.complete(prompt, {
          temperature: 0.3,
          maxTokens: 3000,
          system: 'You are a DDD expert specializing in event storming. Extract meaningful domain events that capture state changes and business decisions.'
        });
        
        // Parse events from response
        const aggregateEvents = this.parseLLMResponse(llmResponse, aggregate);
        
        allDomainEvents.push(...aggregateEvents);
      }
      
      this.emit('progress', { percentage: 80, status: 'Validating domain events...' });
      
      // Validate all domain events
      const validation = this.validateDomainEvents(allDomainEvents);
      if (!validation.valid) {
        throw new Error(`Invalid domain events: ${validation.errors.join(', ', {
        cause: {
          errorType: 'operation_error'
        }
      })}`)
      }
      
      // Store domain events
      const storedArtifact = await this.storeDomainEvents(allDomainEvents, projectId);
      
      this.emit('progress', { percentage: 100, status: 'Domain event extraction completed' });
      
      return {
        domainEvents: allDomainEvents,
        artifactId: storedArtifact.id,
        summary: {
          totalEvents: allDomainEvents.length,
          byAggregate: aggregates.map(a => ({
            aggregate: a.name,
            eventCount: allDomainEvents.filter(e => e.aggregateId === a.id).length
          })),
          eventTypes: this.categorizeEvents(allDomainEvents)
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to extract domain events: ${error.message}`, {
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

  createEventExtractionPrompt(aggregate, entities) {
    return `Extract domain events for the aggregate using event storming principles.

Aggregate Details:
${JSON.stringify(aggregate, null, 2)}

Entities in this aggregate:
${JSON.stringify(entities, null, 2)}

Extract domain events following these principles:

1. **Event Storming Approach**:
   - Events represent something that happened in the domain
   - Events are named in past tense (e.g., "OrderPlaced", "CustomerRegistered")
   - Events capture state changes and business decisions
   - Events should be meaningful to domain experts

2. **Event Categories**:
   - **Creation Events**: When entities are created
   - **Modification Events**: When entity state changes
   - **Business Events**: When business rules trigger
   - **Deletion Events**: When entities are removed

3. **Event Structure**:
   - Clear naming following past-tense convention
   - Rich payload containing relevant data
   - Timing information (when it occurs)
   - Trigger information (what causes it)
   - Consequences (what happens as a result)

4. **Event Design Considerations**:
   - Events should be atomic (single responsibility)
   - Events should contain enough data for downstream processing
   - Events should be immutable once created
   - Events should follow versioning strategy

Return a JSON array of domain events with this structure:
{
  "domainEvents": [
    {
      "id": "event-[name]",
      "name": "EventName", 
      "description": "Detailed description of what this event represents",
      "trigger": "What action or condition triggers this event",
      "timing": "before|after|during action_name",
      "payload": {
        "structure": {
          "field1": "string",
          "field2": "number",
          "aggregateId": "string",
          "timestamp": "datetime",
          "userId": "string"
        },
        "example": {
          "field1": "example value",
          "field2": 123,
          "aggregateId": "agg-123",
          "timestamp": "2024-01-01T10:00:00Z",
          "userId": "user-456"
        }
      },
      "consequences": [
        "What happens as a result of this event",
        "Other events that may be triggered",
        "Side effects in the system"
      ],
      "eventType": "creation|modification|business|deletion",
      "version": "1.0",
      "metadata": {
        "source": "aggregate_name",
        "correlationId": "How to correlate with other events",
        "causationId": "What caused this event"
      }
    }
  ],
  "reasoning": "Explanation of event extraction decisions and event storming insights"
}

Focus on extracting events that:
- Capture meaningful business state changes
- Provide value for event sourcing and CQRS patterns
- Enable proper audit trails and business analytics
- Support eventual consistency across aggregates

Return ONLY valid JSON.`;
  }

  parseLLMResponse(response, aggregate) {
    try {
      const cleanedResponse = response.trim();
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = cleanedResponse.substring(jsonStart, jsonEnd);
        const parsed = JSON.parse(jsonStr);
        
        // Add aggregate reference to each domain event
        const domainEvents = (parsed.domainEvents || []).map(event => ({
          ...event,
          aggregateId: aggregate.id,
          aggregateName: aggregate.name
        }));
        
        return domainEvents;
      }
      
      return JSON.parse(cleanedResponse).domainEvents || [];
      
    } catch (error) {
      // FAIL FAST - no fallbacks allowed
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}. Response was: ${response.substring(0, 200)}...`);
    }
  }

  validateDomainEvents(domainEvents) {
    const errors = [];
    
    domainEvents.forEach((event, index) => {
      if (!event.id) errors.push(`Domain event ${index} missing ID`);
      if (!event.name) errors.push(`Domain event ${index} missing name`);
      if (!event.aggregateId) errors.push(`Domain event ${event.name} missing aggregate ID`);
      if (!event.aggregateName) errors.push(`Domain event ${event.name} missing aggregate name`);
      if (!event.description) errors.push(`Domain event ${event.name} missing description`);
      if (!event.trigger) errors.push(`Domain event ${event.name} missing trigger`);
      if (!event.eventType) errors.push(`Domain event ${event.name} missing event type`);
      
      // Validate event naming convention (should be past tense)
      if (event.name && !this.isPastTense(event.name)) {
        errors.push(`Domain event ${event.name} should be named in past tense`);
      }
      
      // Validate payload structure
      if (!event.payload) {
        errors.push(`Domain event ${event.name} missing payload`);
      } else {
        if (!event.payload.structure) {
          errors.push(`Domain event ${event.name} payload missing structure`);
        }
        if (!event.payload.example) {
          errors.push(`Domain event ${event.name} payload missing example`);
        }
      }
      
      // Validate consequences
      if (!event.consequences || !Array.isArray(event.consequences)) {
        errors.push(`Domain event ${event.name} must have consequences array`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  isPastTense(eventName) {
    // Simple heuristic to check if event name follows past tense convention
    const pastTenseEndings = ['ed', 'Created', 'Updated', 'Deleted', 'Added', 'Removed', 'Changed', 'Completed', 'Started', 'Finished', 'Approved', 'Rejected', 'Cancelled'];
    return pastTenseEndings.some(ending => eventName.endsWith(ending));
  }

  categorizeEvents(domainEvents) {
    const categories = {
      creation: 0,
      modification: 0,
      deletion: 0,
      business: 0
    };
    
    domainEvents.forEach(event => {
      const type = event.eventType?.toLowerCase();
      if (categories.hasOwnProperty(type)) {
        categories[type]++;
      }
    });
    
    return categories;
  }

  async storeDomainEvents(domainEvents, projectId) {
    const artifact = {
      type: 'domain_events',
      projectId: projectId || `project_${Date.now()}`,
      data: domainEvents,
      metadata: {
        toolName: this.name,
        timestamp: new Date().toISOString(),
        eventCount: domainEvents.length,
        aggregatesAnalyzed: [...new Set(domainEvents.map(e => e.aggregateId))],
        eventTypes: this.categorizeEvents(domainEvents)
      }
    };
    
    console.log('[DomainEventExtractorTool] Storing domain events:', artifact.metadata.eventCount);
    
    return {
      ...artifact,
      id: `artifact_${Date.now()}`
    };
  }
}