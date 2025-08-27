/**
 * Schema definitions index
 * 
 * Central export point for all JSON Schema definitions used in tool registry verification
 */

// Module schemas
export {
  ModuleMetadataSchema,
  ModuleInterfaceSchema,
  ModuleConfigSchema
} from './ModuleSchema.js';

// Tool schemas
export {
  ToolMetadataSchema,
  ToolInterfaceSchema,
  ToolExecutionResultSchema
} from './ToolSchema.js';

// Test case schemas
export {
  TestCaseSchema,
  TestSuiteSchema,
  TestResultSchema
} from './TestCaseSchema.js';

// Compliance report schema
export const ComplianceReportSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Compliance Report',
  type: 'object',
  properties: {
    timestamp: {
      type: 'string',
      format: 'date-time'
    },
    summary: {
      type: 'object',
      properties: {
        totalModules: { type: 'number' },
        totalTools: { type: 'number' },
        complianceScore: { type: 'number', minimum: 0, maximum: 100 },
        testCoverage: { type: 'number', minimum: 0, maximum: 100 },
        successRate: { type: 'number', minimum: 0, maximum: 100 },
        criticalIssues: { type: 'number' },
        warnings: { type: 'number' }
      },
      required: ['totalModules', 'totalTools', 'complianceScore']
    },
    modules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          complianceScore: { type: 'number' },
          status: { type: 'string' },
          tools: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                status: { type: 'string' },
                complianceScore: { type: 'number' },
                issues: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          module: { type: 'string' },
          tool: { type: 'string' },
          issue: { type: 'string' },
          solution: { type: 'string' },
          autoFixable: { type: 'boolean' }
        }
      }
    }
  },
  required: ['timestamp', 'summary']
};

// Validation error schema
export const ValidationErrorSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Validation Error',
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description: 'Error code',
      pattern: '^TR\\d{3}$'
    },
    severity: {
      type: 'string',
      enum: ['critical', 'high', 'medium', 'low']
    },
    message: {
      type: 'string',
      description: 'Error message'
    },
    path: {
      type: 'string',
      description: 'Path to the error location'
    },
    module: {
      type: 'string',
      description: 'Module name'
    },
    tool: {
      type: 'string',
      description: 'Tool name'
    },
    autoFixable: {
      type: 'boolean',
      description: 'Whether this can be auto-fixed'
    },
    suggestion: {
      type: 'string',
      description: 'Suggested fix'
    }
  },
  required: ['code', 'severity', 'message']
};