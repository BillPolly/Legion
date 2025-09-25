/**
 * DataStore Schema for Software Deliverables
 * 
 * This schema defines all entities for tracking software project deliverables
 * using DataScript attribute format. These entities represent the actual data
 * that exists in a software project - files, tests, requirements, etc.
 */

export const deliverablesSchema = {
  // ===== PROJECT ENTITY =====
  // Root entity that all deliverables belong to
  ':project/name': { type: 'string', cardinality: 'one' },
  ':project/description': { type: 'string', cardinality: 'one' },
  ':project/type': { type: 'string', cardinality: 'one' }, // api, webapp, cli, library, service, fullstack
  ':project/status': { type: 'string', cardinality: 'one' }, // planning, in_progress, completed, failed
  ':project/created': { type: 'instant', cardinality: 'one' },
  ':project/completed': { type: 'instant', cardinality: 'one' },
  ':project/rootPath': { type: 'string', cardinality: 'one' },
  ':project/repository': { type: 'string', cardinality: 'one' },
  
  // ===== SOURCE FILE ENTITY =====
  // Actual code files created during development
  ':file/path': { type: 'string', cardinality: 'one', unique: 'identity' },
  ':file/content': { type: 'string', cardinality: 'one' },
  ':file/type': { type: 'string', cardinality: 'one' }, // source, test, config, documentation
  ':file/language': { type: 'string', cardinality: 'one' }, // javascript, typescript, python, etc
  ':file/project': { type: 'ref', cardinality: 'one' },
  ':file/created': { type: 'instant', cardinality: 'one' },
  ':file/modified': { type: 'instant', cardinality: 'one' },
  ':file/size': { type: 'long', cardinality: 'one' },
  ':file/lineCount': { type: 'long', cardinality: 'one' },
  
  // ===== REQUIREMENTS ENTITY =====
  // What needs to be built (functional and non-functional)
  ':requirement/description': { type: 'string', cardinality: 'one' },
  ':requirement/type': { type: 'string', cardinality: 'one' }, // functional, nonfunctional, constraint
  ':requirement/priority': { type: 'string', cardinality: 'one' }, // critical, high, medium, low
  ':requirement/status': { type: 'string', cardinality: 'one' }, // pending, implemented, tested, accepted
  ':requirement/project': { type: 'ref', cardinality: 'one' },
  ':requirement/acceptanceCriteria': { type: 'string', cardinality: 'many' },
  
  // ===== TEST ENTITY =====
  // Test cases and test results
  ':test/name': { type: 'string', cardinality: 'one' },
  ':test/description': { type: 'string', cardinality: 'one' },
  ':test/type': { type: 'string', cardinality: 'one' }, // unit, integration, e2e, performance
  ':test/status': { type: 'string', cardinality: 'one' }, // pending, passed, failed, skipped
  ':test/file': { type: 'ref', cardinality: 'one' }, // Reference to test file
  ':test/project': { type: 'ref', cardinality: 'one' },
  ':test/executionTime': { type: 'long', cardinality: 'one' }, // milliseconds
  ':test/lastRun': { type: 'instant', cardinality: 'one' },
  ':test/failureMessage': { type: 'string', cardinality: 'one' },
  
  // ===== DEPENDENCY ENTITY =====
  // External packages/libraries needed
  ':dependency/name': { type: 'string', cardinality: 'one' },
  ':dependency/version': { type: 'string', cardinality: 'one' },
  ':dependency/type': { type: 'string', cardinality: 'one' }, // runtime, dev, peer, optional
  ':dependency/project': { type: 'ref', cardinality: 'one' },
  ':dependency/source': { type: 'string', cardinality: 'one' }, // npm, pip, maven, cargo
  
  // ===== ERROR/ISSUE ENTITY =====
  // Problems encountered during development
  ':error/message': { type: 'string', cardinality: 'one' },
  ':error/stack': { type: 'string', cardinality: 'one' },
  ':error/file': { type: 'ref', cardinality: 'one' },
  ':error/line': { type: 'long', cardinality: 'one' },
  ':error/column': { type: 'long', cardinality: 'one' },
  ':error/timestamp': { type: 'instant', cardinality: 'one' },
  ':error/resolved': { type: 'boolean', cardinality: 'one' },
  ':error/resolution': { type: 'string', cardinality: 'one' },
  ':error/project': { type: 'ref', cardinality: 'one' },
  ':error/severity': { type: 'string', cardinality: 'one' }, // fatal, error, warning, info
  
  // ===== TASK ENTITY =====
  // Work items and execution tracking
  ':task/description': { type: 'string', cardinality: 'one' },
  ':task/strategy': { type: 'string', cardinality: 'one' },
  ':task/status': { type: 'string', cardinality: 'one' }, // pending, in_progress, completed, failed
  ':task/parent': { type: 'ref', cardinality: 'one' },
  ':task/project': { type: 'ref', cardinality: 'one' },
  ':task/started': { type: 'instant', cardinality: 'one' },
  ':task/completed': { type: 'instant', cardinality: 'one' },
  ':task/result': { type: 'string', cardinality: 'one' },
  
  // ===== CONFIGURATION ENTITY =====
  // Config files like package.json, tsconfig, etc
  ':config/type': { type: 'string', cardinality: 'one' }, // package, build, deploy, environment
  ':config/file': { type: 'ref', cardinality: 'one' },
  ':config/project': { type: 'ref', cardinality: 'one' },
  ':config/settings': { type: 'string', cardinality: 'one' }, // JSON string of settings
  
  // ===== DOCUMENTATION ENTITY =====
  // README, API docs, guides
  ':doc/title': { type: 'string', cardinality: 'one' },
  ':doc/type': { type: 'string', cardinality: 'one' }, // readme, api, user, developer, architecture
  ':doc/content': { type: 'string', cardinality: 'one' }, // Markdown or HTML
  ':doc/file': { type: 'ref', cardinality: 'one' },
  ':doc/project': { type: 'ref', cardinality: 'one' },
  ':doc/version': { type: 'string', cardinality: 'one' },
  
  // ===== BUILD ARTIFACT ENTITY =====
  // Build outputs and deliverables
  ':artifact/name': { type: 'string', cardinality: 'one' },
  ':artifact/type': { type: 'string', cardinality: 'one' }, // executable, library, bundle, container
  ':artifact/version': { type: 'string', cardinality: 'one' },
  ':artifact/path': { type: 'string', cardinality: 'one' },
  ':artifact/size': { type: 'long', cardinality: 'one' },
  ':artifact/checksum': { type: 'string', cardinality: 'one' },
  ':artifact/project': { type: 'ref', cardinality: 'one' },
  ':artifact/buildTime': { type: 'instant', cardinality: 'one' },
  
  // ===== DEPLOYMENT ENTITY =====
  // Deployment tracking
  ':deployment/version': { type: 'string', cardinality: 'one' },
  ':deployment/environment': { type: 'string', cardinality: 'one' }, // development, staging, production
  ':deployment/status': { type: 'string', cardinality: 'one' }, // pending, in_progress, completed, failed
  ':deployment/project': { type: 'ref', cardinality: 'one' },
  ':deployment/artifact': { type: 'ref', cardinality: 'one' },
  ':deployment/deployedAt': { type: 'instant', cardinality: 'one' },
  ':deployment/deployedBy': { type: 'string', cardinality: 'one' },
  
  // ===== QUALITY METRICS ENTITY =====
  // Code quality and performance metrics
  ':metrics/type': { type: 'string', cardinality: 'one' }, // coverage, complexity, performance
  ':metrics/project': { type: 'ref', cardinality: 'one' },
  ':metrics/timestamp': { type: 'instant', cardinality: 'one' },
  ':metrics/coverage': { type: 'float', cardinality: 'one' }, // Test coverage percentage
  ':metrics/complexity': { type: 'long', cardinality: 'one' }, // Cyclomatic complexity
  ':metrics/duplications': { type: 'long', cardinality: 'one' }, // Code duplication count
  ':metrics/issues': { type: 'long', cardinality: 'one' }, // Code issues count
};

/**
 * Helper function to create indexes for better query performance
 */
export function getSchemaIndexes() {
  return [
    // Unique paths within a project
    [':file/path'],
    [':file/project', ':file/path'],
    
    // Quick lookup by status
    [':project/status'],
    [':requirement/status'],
    [':test/status'],
    [':task/status'],
    
    // Find all entities for a project
    [':file/project'],
    [':requirement/project'],
    [':test/project'],
    [':dependency/project'],
    [':error/project'],
    [':task/project'],
    
    // Find errors by file
    [':error/file'],
    
    // Find tests by file
    [':test/file'],
  ];
}

/**
 * Helper function to validate entity data before insertion
 */
export function validateEntityData(entityType, data) {
  const requiredFields = {
    project: [':project/name', ':project/type', ':project/status'],
    file: [':file/path', ':file/content', ':file/type', ':file/project'],
    requirement: [':requirement/description', ':requirement/type', ':requirement/project'],
    test: [':test/name', ':test/type', ':test/project'],
    dependency: [':dependency/name', ':dependency/version', ':dependency/project'],
    error: [':error/message', ':error/project'],
    task: [':task/description', ':task/status', ':task/project'],
  };
  
  const required = requiredFields[entityType];
  if (!required) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }
  
  const missing = required.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields for ${entityType}: ${missing.join(', ')}`);
  }
  
  return true;
}

/**
 * Helper function to detect entity type from attributes
 */
export function detectEntityType(attributes) {
  const namespaces = new Set();
  
  for (const attr of Object.keys(attributes)) {
    if (attr.includes('/')) {
      const namespace = attr.split('/')[0];
      // Remove ':' prefix from namespace for comparison
      const cleanNamespace = namespace.startsWith(':') ? namespace.slice(1) : namespace;
      namespaces.add(cleanNamespace);
    }
  }
  
  // Return the most common namespace (excluding db)
  const typeNamespaces = Array.from(namespaces).filter(ns => ns !== 'db');
  
  if (typeNamespaces.length === 1) {
    return typeNamespaces[0];
  } else if (typeNamespaces.length > 1) {
    // Prioritize certain entity types
    const priority = ['project', 'file', 'test', 'requirement', 'task', 'error'];
    for (const type of priority) {
      if (typeNamespaces.includes(type)) {
        return type;
      }
    }
    return typeNamespaces[0];
  }
  
  return null;
}