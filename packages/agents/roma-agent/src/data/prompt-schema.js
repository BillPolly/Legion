/**
 * Prompt Data Schema for ROMA Agent
 * 
 * This schema defines entities specifically needed for prompt execution and data
 * used in the ROMA agent's coding strategies. These entities represent the data
 * structures that prompts expect as input and produce as output.
 * 
 * This extends the deliverables-schema.js with prompt-specific entities.
 */
import { deliverablesSchema } from './deliverables-schema.js';

export const promptSchema = {
  // ===== PROJECT PLAN ENTITY =====
  // Structured execution plan with phases and tasks
  ':plan/id': { type: 'string', cardinality: 'one', unique: 'identity' },
  ':plan/project': { type: 'ref', cardinality: 'one' },
  ':plan/created': { type: 'instant', cardinality: 'one' },
  ':plan/status': { type: 'string', cardinality: 'one' }, // draft, active, completed, abandoned
  
  // ===== PLAN PHASE ENTITY =====
  // Phases within a project plan
  ':phase/name': { type: 'string', cardinality: 'one' },
  ':phase/priority': { type: 'long', cardinality: 'one' },
  ':phase/plan': { type: 'ref', cardinality: 'one' },
  ':phase/status': { type: 'string', cardinality: 'one' }, // pending, in_progress, completed, failed
  
  // ===== ENDPOINT ENTITY =====
  // API endpoint specifications
  ':endpoint/method': { type: 'string', cardinality: 'one' }, // GET, POST, PUT, DELETE, PATCH
  ':endpoint/path': { type: 'string', cardinality: 'one' },
  ':endpoint/description': { type: 'string', cardinality: 'one' },
  ':endpoint/project': { type: 'ref', cardinality: 'one' },
  ':endpoint/parameters': { type: 'string', cardinality: 'one' }, // JSON string of parameter specs
  ':endpoint/responses': { type: 'string', cardinality: 'one' }, // JSON string of response specs
  ':endpoint/middleware': { type: 'string', cardinality: 'many' },
  ':endpoint/authentication': { type: 'boolean', cardinality: 'one' },
  
  // ===== SERVER CONFIGURATION ENTITY =====
  // Server setup specifications
  ':server/type': { type: 'string', cardinality: 'one' }, // express, fastify, koa, http
  ':server/port': { type: 'long', cardinality: 'one' },
  ':server/project': { type: 'ref', cardinality: 'one' },
  ':server/middleware': { type: 'string', cardinality: 'many' },
  ':server/environment': { type: 'string', cardinality: 'one' }, // development, production, test
  ':server/settings': { type: 'string', cardinality: 'one' }, // JSON string of configuration
  
  // ===== QUALITY ASSESSMENT ENTITY =====
  // Code quality evaluation results
  ':assessment/code': { type: 'ref', cardinality: 'one' }, // Reference to file being assessed
  ':assessment/score': { type: 'float', cardinality: 'one' }, // 0-10 quality score
  ':assessment/issues': { type: 'string', cardinality: 'many' },
  ':assessment/strengths': { type: 'string', cardinality: 'many' },
  ':assessment/criteria': { type: 'string', cardinality: 'one' }, // JSON string of criteria used
  ':assessment/timestamp': { type: 'instant', cardinality: 'one' },
  ':assessment/project': { type: 'ref', cardinality: 'one' },
  
  // ===== TOOL DESCRIPTION ENTITY =====
  // Available tools for task execution
  ':tool/name': { type: 'string', cardinality: 'one', unique: 'identity' },
  ':tool/description': { type: 'string', cardinality: 'one' },
  ':tool/capabilities': { type: 'string', cardinality: 'many' },
  ':tool/parameters': { type: 'string', cardinality: 'one' }, // JSON schema for parameters
  ':tool/category': { type: 'string', cardinality: 'one' },
  ':tool/tags': { type: 'string', cardinality: 'many' },
  
  // ===== EXECUTION CONTEXT ENTITY =====
  // Runtime environment and execution state
  ':context/task': { type: 'ref', cardinality: 'one' },
  ':context/environment': { type: 'string', cardinality: 'one' }, // JSON string of env vars
  ':context/variables': { type: 'string', cardinality: 'one' }, // JSON string of context vars
  ':context/constraints': { type: 'string', cardinality: 'many' },
  ':context/workingDirectory': { type: 'string', cardinality: 'one' },
  ':context/timestamp': { type: 'instant', cardinality: 'one' },
  
  // ===== ERROR LOCATION ENTITY =====
  // Enhanced error location information (extends base error entity)
  ':location/file': { type: 'string', cardinality: 'one' },
  ':location/line': { type: 'long', cardinality: 'one' },
  ':location/column': { type: 'long', cardinality: 'one' },
  ':location/function': { type: 'string', cardinality: 'one' },
  ':location/error': { type: 'ref', cardinality: 'one' },
  
  // ===== TEST CASE ENTITY =====
  // Enhanced test case specifications (extends base test entity)
  ':testcase/target': { type: 'string', cardinality: 'one' }, // Name of target being tested
  ':testcase/targetType': { type: 'string', cardinality: 'one' }, // function, class, endpoint, etc
  ':testcase/edgeCases': { type: 'string', cardinality: 'many' },
  ':testcase/mockData': { type: 'string', cardinality: 'one' }, // JSON string of test data
  ':testcase/assertions': { type: 'string', cardinality: 'many' },
  ':testcase/project': { type: 'ref', cardinality: 'one' },
  
  // ===== REQUIREMENT ANALYSIS ENTITY =====
  // Analysis results from requirement processing
  ':analysis/requirement': { type: 'ref', cardinality: 'one' },
  ':analysis/extractedFeatures': { type: 'string', cardinality: 'many' },
  ':analysis/constraints': { type: 'string', cardinality: 'many' },
  ':analysis/suggestedTechnologies': { type: 'string', cardinality: 'many' },
  ':analysis/projectType': { type: 'string', cardinality: 'one' }, // api, web, cli, library
  ':analysis/complexity': { type: 'string', cardinality: 'one' }, // low, medium, high
  ':analysis/timestamp': { type: 'instant', cardinality: 'one' },
  
  // ===== FAILURE ANALYSIS ENTITY =====
  // Analysis of task failures for recovery
  ':failure/task': { type: 'ref', cardinality: 'one' },
  ':failure/error': { type: 'ref', cardinality: 'one' },
  ':failure/reason': { type: 'string', cardinality: 'one' },
  ':failure/missingItems': { type: 'string', cardinality: 'many' },
  ':failure/failedApproaches': { type: 'string', cardinality: 'many' },
  ':failure/suggestedConstraints': { type: 'string', cardinality: 'one' }, // JSON object
  ':failure/recoverable': { type: 'boolean', cardinality: 'one' },
  ':failure/timestamp': { type: 'instant', cardinality: 'one' },
  
  // ===== PROMPT EXECUTION ENTITY =====
  // Track prompt executions and results
  ':prompt/name': { type: 'string', cardinality: 'one' },
  ':prompt/category': { type: 'string', cardinality: 'one' },
  ':prompt/variables': { type: 'string', cardinality: 'one' }, // JSON string of input variables
  ':prompt/result': { type: 'string', cardinality: 'one' }, // JSON string of prompt result
  ':prompt/task': { type: 'ref', cardinality: 'one' },
  ':prompt/executionTime': { type: 'long', cardinality: 'one' }, // milliseconds
  ':prompt/timestamp': { type: 'instant', cardinality: 'one' },
  ':prompt/success': { type: 'boolean', cardinality: 'one' },
  
  // ===== STRATEGY EXECUTION ENTITY =====
  // Track strategy usage and effectiveness
  ':strategy/name': { type: 'string', cardinality: 'one' },
  ':strategy/type': { type: 'string', cardinality: 'one' }, // coding, analysis, execution, etc
  ':strategy/task': { type: 'ref', cardinality: 'one' },
  ':strategy/prompts': { type: 'ref', cardinality: 'many' }, // References to executed prompts
  ':strategy/result': { type: 'string', cardinality: 'one' }, // JSON string of strategy result
  ':strategy/success': { type: 'boolean', cardinality: 'one' },
  ':strategy/duration': { type: 'long', cardinality: 'one' }, // milliseconds
  ':strategy/timestamp': { type: 'instant', cardinality: 'one' },
};

/**
 * Helper function to create indexes for better query performance on prompt entities
 */
export function getPromptSchemaIndexes() {
  return [
    // Unique identifiers
    [':plan/id'],
    [':tool/name'],
    
    // Project relationships
    [':endpoint/project'],
    [':server/project'],
    [':assessment/project'],
    [':testcase/project'],
    
    // Task relationships
    [':context/task'],
    [':failure/task'],
    [':prompt/task'],
    [':strategy/task'],
    
    // Plan relationships
    [':phase/plan'],
    
    // Status and type queries
    [':plan/status'],
    [':phase/status'],
    [':analysis/projectType'],
    [':strategy/type'],
    
    // Time-based queries
    [':assessment/timestamp'],
    [':failure/timestamp'],
    [':prompt/timestamp'],
    [':strategy/timestamp'],
    
    // Success/failure tracking
    [':prompt/success'],
    [':strategy/success'],
    [':failure/recoverable'],
  ];
}

/**
 * Helper function to validate prompt entity data before insertion
 */
export function validatePromptEntityData(entityType, data) {
  const requiredFields = {
    plan: [':plan/id', ':plan/project', ':plan/status'],
    phase: [':phase/name', ':phase/priority', ':phase/plan', ':phase/status'],
    endpoint: [':endpoint/method', ':endpoint/path', ':endpoint/project'],
    server: [':server/type', ':server/project'],
    assessment: [':assessment/code', ':assessment/score', ':assessment/project'],
    tool: [':tool/name', ':tool/description'],
    context: [':context/task', ':context/timestamp'],
    location: [':location/file', ':location/line', ':location/error'],
    testcase: [':testcase/target', ':testcase/targetType', ':testcase/project'],
    analysis: [':analysis/requirement', ':analysis/projectType', ':analysis/timestamp'],
    failure: [':failure/task', ':failure/reason', ':failure/timestamp'],
    prompt: [':prompt/name', ':prompt/category', ':prompt/task', ':prompt/timestamp'],
    strategy: [':strategy/name', ':strategy/type', ':strategy/task', ':strategy/timestamp'],
  };
  
  const required = requiredFields[entityType];
  if (!required) {
    throw new Error(`Unknown prompt entity type: ${entityType}`);
  }
  
  const missing = required.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields for ${entityType}: ${missing.join(', ')}`);
  }
  
  return true;
}

/**
 * Helper function to detect prompt entity type from attributes
 */
export function detectPromptEntityType(attributes) {
  const namespaces = new Set();
  
  for (const attr of Object.keys(attributes)) {
    if (attr.includes('/')) {
      const namespace = attr.split('/')[0];
      const cleanNamespace = namespace.startsWith(':') ? namespace.slice(1) : namespace;
      namespaces.add(cleanNamespace);
    }
  }
  
  const typeNamespaces = Array.from(namespaces).filter(ns => ns !== 'db');
  
  if (typeNamespaces.length === 1) {
    return typeNamespaces[0];
  } else if (typeNamespaces.length > 1) {
    // Prioritize prompt-specific entity types
    const priority = ['plan', 'phase', 'endpoint', 'server', 'assessment', 'tool', 
                     'context', 'location', 'testcase', 'analysis', 'failure', 
                     'prompt', 'strategy'];
    for (const type of priority) {
      if (typeNamespaces.includes(type)) {
        return type;
      }
    }
    return typeNamespaces[0];
  }
  
  return null;
}

/**
 * Combined schema that includes both deliverables and prompt schemas
 */
export function getCombinedSchema() {
  // Import the deliverables schema

  
  return {
    ...deliverablesSchema,
    ...promptSchema
  };
}