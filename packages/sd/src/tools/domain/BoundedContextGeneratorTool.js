/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * BoundedContextGeneratorTool - Generates bounded contexts using DDD with LLM
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const boundedContextGeneratorToolInputSchema = {
  type: 'object',
  properties: {
    requirementsContext: {
      description: 'Requirements context from database'
    },
    projectId: {
      type: 'string',
      description: 'Project ID'
    },
    strategy: {
      type: 'object',
      properties: {
        boundedContextCount: {
          type: 'number',
          description: 'Suggested number of contexts'
        },
        coreDomain: {
          type: 'string',
          description: 'Core domain focus'
        },
        supportingDomains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Supporting domains'
        }
      },
      description: 'Domain strategy from agent'
    }
  },
  required: ['requirementsContext']
};

// Output schema as plain JSON Schema
const boundedContextGeneratorToolOutputSchema = {
  type: 'object',
  properties: {
    boundedContexts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          isCore: { type: 'boolean' },
          domainType: {
            type: 'string',
            enum: ['core', 'supporting', 'generic']
          },
          boundaries: {
            type: 'array',
            items: { type: 'string' }
          },
          responsibilities: {
            type: 'array',
            items: { type: 'string' }
          },
          interfaces: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['inbound', 'outbound']
                },
                name: { type: 'string' },
                description: { type: 'string' }
              }
            }
          },
          relationshipsWith: {
            type: 'array',
            items: { type: 'string' }
          },
          ubiquitousLanguage: {
            type: 'array',
            items: { type: 'string' }
          },
          createdAt: { type: 'string' },
          requirementsCount: { type: 'number' },
          status: { type: 'string' },
          validationStatus: { type: 'string' }
        }
      },
      description: 'Identified bounded contexts'
    },
    artifactId: {
      type: 'string',
      description: 'Stored artifact ID'
    },
    summary: {
      type: 'object',
      properties: {
        contextCount: { type: 'number' },
        coreDomain: { type: 'string' },
        supportingDomains: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      description: 'Summary of bounded contexts'
    },
    llmReasoning: {
      type: 'string',
      description: 'LLM reasoning for context boundaries'
    }
  },
  required: ['boundedContexts', 'artifactId', 'summary']
};

export class BoundedContextGeneratorTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'identify_bounded_contexts',
      description: 'Identify bounded contexts from requirements using DDD principles',
      inputSchema: boundedContextGeneratorToolInputSchema,
      outputSchema: boundedContextGeneratorToolOutputSchema
    });
    
    this.llmClient = dependencies.llmClient;
    this.designDatabase = dependencies.designDatabase;
    this.resourceManager = dependencies.resourceManager;
  }

  async execute(args) {
    const { requirementsContext, projectId, strategy } = args;
    
    try {
      this.emit('progress', { percentage: 0, status: 'Analyzing requirements for bounded contexts...' });
      
      // Get LLM client
      const llmClient = await this.getLLMClient();
      
      // Build context analysis prompt
      const prompt = this.createBoundedContextPrompt(requirementsContext, strategy);
      
      this.emit('progress', { percentage: 30, status: 'Identifying context boundaries with LLM...' });
      
      // Call LLM for bounded context identification
      const llmResponse = await llmClient.complete(prompt, {
        temperature: 0.3,
        maxTokens: 3000,
        system: 'You are a Domain-Driven Design expert. Identify bounded contexts with clear boundaries and responsibilities.'
      });
      
      this.emit('progress', { percentage: 60, status: 'Processing bounded contexts...' });
      
      // Parse LLM response
      const boundedContexts = this.parseLLMResponse(llmResponse);
      
      // Validate bounded contexts
      const validation = this.validateBoundedContexts(boundedContexts);
      if (!validation.valid) {
        return throw new Error(`Invalid bounded contexts: ${validation.errors.join(', ', {
        cause: {
          errorType: 'operation_error'
        }
      })}`);
      }
      
      // Enrich with relationships
      const enrichedContexts = this.enrichContexts(boundedContexts, requirementsContext);
      
      this.emit('progress', { percentage: 80, status: 'Storing bounded contexts...' });
      
      // Store in design database
      const storedArtifact = await this.storeBoundedContexts(enrichedContexts, projectId);
      
      this.emit('progress', { percentage: 100, status: 'Bounded contexts identified successfully' });
      
      return {
        boundedContexts: enrichedContexts,
        artifactId: storedArtifact.id,
        summary: {
          contextCount: enrichedContexts.length,
          coreDomain: enrichedContexts.find(c => c.isCore)?.name,
          supportingDomains: enrichedContexts.filter(c => !c.isCore).map(c => c.name)
        },
        llmReasoning: boundedContexts.reasoning
      };
      
    } catch (error) {
      return throw new Error(`Failed to identify bounded contexts: ${error.message}`, {
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

  createBoundedContextPrompt(requirementsContext, strategy) {
    const strategyHint = strategy ? `
Consider the following strategy hints:
- Suggested number of contexts: ${strategy.boundedContextCount || 'determine based on complexity'}
- Core domain focus: ${strategy.coreDomain || 'identify from requirements'}
- Supporting domains: ${strategy.supportingDomains?.join(', ') || 'identify as needed'}
` : '';

    return `Analyze the following requirements and identify bounded contexts using Domain-Driven Design principles.

Requirements Context:
${JSON.stringify(requirementsContext, null, 2)}

${strategyHint}

Identify bounded contexts following these DDD principles:
1. Each context should have a clear boundary and single responsibility
2. Contexts should align with business capabilities
3. Minimize coupling between contexts
4. Identify the core domain (main business value)
5. Identify supporting and generic subdomains
6. Define clear interfaces between contexts

Return a JSON array of bounded contexts with this structure:
{
  "boundedContexts": [
    {
      "id": "bc-[name]",
      "name": "Context Name",
      "description": "Clear description of the context's responsibility",
      "isCore": true/false,
      "domainType": "core|supporting|generic",
      "boundaries": ["Clear boundary 1", "Clear boundary 2"],
      "responsibilities": ["Responsibility 1", "Responsibility 2"],
      "interfaces": [
        {
          "type": "inbound|outbound",
          "name": "Interface name",
          "description": "What this interface does"
        }
      ],
      "relationshipsWith": ["bc-other-context"],
      "ubiquitousLanguage": ["Term1", "Term2"]
    }
  ],
  "contextMap": {
    "relationships": [
      {
        "from": "bc-context1",
        "to": "bc-context2",
        "type": "upstream-downstream|partnership|shared-kernel|customer-supplier",
        "description": "Nature of the relationship"
      }
    ]
  },
  "reasoning": "Explanation of the bounded context identification and boundaries"
}

Focus on identifying natural boundaries in the domain. Return ONLY valid JSON.`;
  }

  parseLLMResponse(response) {
    try {
      const cleanedResponse = response.trim();
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = cleanedResponse.substring(jsonStart, jsonEnd);
        const parsed = JSON.parse(jsonStr);
        
        // Ensure we have the expected structure
        if (parsed.boundedContexts) {
          return parsed;
        }
        
        // If it's an array, wrap it
        if (Array.isArray(parsed)) {
          return { boundedContexts: parsed, reasoning: 'Contexts identified from requirements' };
        }
      }
      
      return JSON.parse(cleanedResponse);
      
    } catch (error) {
      // FAIL FAST - no fallbacks allowed
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}. Response was: ${response.substring(0, 200)}...`);
    }
  }

  validateBoundedContexts(parsed) {
    const errors = [];
    
    if (!parsed.boundedContexts || !Array.isArray(parsed.boundedContexts)) {
      errors.push('Bounded contexts must be an array');
      return { valid: false, errors };
    }
    
    parsed.boundedContexts.forEach((context, index) => {
      if (!context.id) errors.push(`Context ${index} missing ID`);
      if (!context.name) errors.push(`Context ${index} missing name`);
      if (!context.description) errors.push(`Context ${index} missing description`);
      if (!context.boundaries || !Array.isArray(context.boundaries)) {
        errors.push(`Context ${index} must have boundaries array`);
      }
    });
    
    // Ensure at least one core domain
    const hasCore = parsed.boundedContexts.some(c => c.isCore || c.domainType === 'core');
    if (!hasCore) {
      errors.push('Must have at least one core domain context');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  enrichContexts(boundedContexts, requirementsContext) {
    // Add additional metadata and relationships
    return boundedContexts.boundedContexts.map(context => ({
      ...context,
      createdAt: new Date().toISOString(),
      requirementsCount: requirementsContext?.artifacts?.requirements?.functional?.length || 0,
      status: 'identified',
      validationStatus: 'pending'
    }));
  }

  async storeBoundedContexts(boundedContexts, projectId) {
    const artifact = {
      type: 'bounded_contexts',
      projectId: projectId || `project_${Date.now()}`,
      data: boundedContexts,
      metadata: {
        toolName: this.name,
        timestamp: new Date().toISOString(),
        contextCount: boundedContexts.length,
        hasCore: boundedContexts.some(c => c.isCore)
      }
    };
    
    console.log('[BoundedContextGeneratorTool] Storing bounded contexts:', artifact.metadata.contextCount);
    
    return {
      ...artifact,
      id: `artifact_${Date.now()}`
    };
  }
}