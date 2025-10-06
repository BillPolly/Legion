/**
 * Response schemas for ConvFinQA agent phases
 */

export const semanticUnderstandingSchema = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array',
      description: 'Ontology concepts relevant to this question',
      items: {
        type: 'string'
      }
    },
    entities: {
      type: 'array',
      description: 'Named entities mentioned in the question',
      items: {
        type: 'string'
      }
    },
    relations: {
      type: 'array',
      description: 'Relations or operations being asked about',
      items: {
        type: 'string'
      }
    },
    temporalScope: {
      type: 'object',
      description: 'Temporal constraints (years, periods)',
      properties: {
        years: {
          type: 'array',
          items: { type: 'string' }
        },
        period: { type: 'string' },
        endYear: { type: 'string' }
      }
    },
    categoricalScope: {
      type: 'object',
      description: 'Categorical constraints',
      properties: {
        categories: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    outputFormat: {
      type: 'object',
      description: 'Required output format for the answer',
      properties: {
        unit: {
          type: 'string',
          enum: ['percentage', '%', 'dollars', '$', 'millions', 'billions', 'number'],
          description: 'The unit for the answer'
        },
        precision: {
          type: 'number',
          description: 'Number of decimal places',
          minimum: 0,
          maximum: 4
        },
        includeSymbol: {
          type: 'boolean',
          description: 'Whether to include unit symbol (%, $, etc.)'
        },
        symbol: {
          type: 'string',
          description: 'The symbol to include if applicable'
        }
      },
      required: ['unit', 'precision']
    },
    reasoning: {
      type: 'string',
      description: 'Brief explanation of the semantic understanding'
    }
  },
  required: ['concepts', 'entities', 'relations', 'outputFormat', 'reasoning']
};

export const dataRetrievalPlanSchema = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      description: 'Ordered steps to retrieve and compute data',
      items: {
        type: 'object',
        properties: {
          stepNumber: { type: 'number' },
          action: {
            type: 'string',
            enum: ['query_kg', 'calculate']
          },
          description: { type: 'string' },
          parameters: {
            type: 'object',
            description: 'Parameters for the tool call'
          },
          expectedOutput: { type: 'string' }
        },
        required: ['stepNumber', 'action', 'parameters']
      }
    },
    reasoning: {
      type: 'string',
      description: 'Explanation of the retrieval plan'
    }
  },
  required: ['steps', 'reasoning']
};

export const calculationResultSchema = {
  type: 'object',
  properties: {
    rawValue: {
      type: 'number',
      description: 'The computed numerical value'
    },
    calculation: {
      type: 'string',
      description: 'Description of the calculation performed'
    },
    inputs: {
      type: 'array',
      description: 'Input values used in calculation',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: { type: 'number' }
        }
      }
    }
  },
  required: ['rawValue']
};

export const toolCallSchema = {
  type: 'object',
  properties: {
    tool: {
      type: 'string',
      enum: ['query_kg', 'calculate'],
      description: 'Name of the tool to call'
    },
    input: {
      type: 'object',
      description: 'Input parameters for the tool'
    },
    reasoning: {
      type: 'string',
      description: 'Why this tool call is needed'
    }
  },
  required: ['tool', 'input']
};
