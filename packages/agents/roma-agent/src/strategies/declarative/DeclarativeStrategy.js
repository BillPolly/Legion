/**
 * DeclarativeStrategy - Declarative parent-child data flow strategy with DSL support
 * 
 * This strategy treats parent context as a ResourceManager and uses
 * declarative query/update specifications to manage data flow between
 * parent and child tasks.
 * 
 * Each child task configuration includes:
 * - querySpec: What data to pull from parent context when invoking child
 *   Supports: JSON objects, DSL template literals, function queries, path strings
 * - updateSpec: How to route child's return values back to parent context
 *   Supports: JSON objects, DSL template literals, function updates, path strings
 * 
 * DSL Examples:
 * - querySpec: query`find ?artifact where artifact/type = "requirements"`
 * - updateSpec: update`+artifacts = ${childResult}; status = "completed"`
 */

import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';
import { ContextResourceManager, ContextDataSource, ContextHandle } from '@legion/tasks';
import { Handle } from '@legion/handle';

/**
 * Core strategy implementation function
 */
async function doWork() {
  console.log(`📋 DeclarativeStrategy processing: ${this.description}`);
  
  // Get declarative task configuration
  const taskConfig = this.metadata?.declarativeConfig || {};
  
  if (!taskConfig.children || taskConfig.children.length === 0) {
    return this.failWithError(
      new Error('No child tasks defined in declarative configuration'),
      'Declarative strategy requires child task definitions'
    );
  }
  
  // Wrap context as DataSource for Handle/DSL support
  // NOTE: ContextResourceManager implements DataSource interface despite its name
  const contextRM = new ContextResourceManager(this.context);
  const contextDataSource = new ContextDataSource(this.context);
  const contextHandle = new ContextHandle(contextRM);
  
  // Execute child tasks with declarative data flow
  const results = [];
  
  for (const childConfig of taskConfig.children) {
    try {
      // Execute query spec to get input data for child
      const inputData = await executeQuery(contextRM, contextHandle, childConfig.querySpec);
      
      // Create and execute child task with queried data
      const childResult = await executeChild(this, childConfig, inputData);
      
      // Execute update spec to route child results back to parent
      if (childResult && childConfig.updateSpec) {
        await executeUpdate(contextRM, contextHandle, contextDataSource, childConfig.updateSpec, childResult);
      }
      
      results.push({
        childId: childConfig.id,
        success: true,
        result: childResult
      });
      
    } catch (error) {
      console.error(`Failed to execute child ${childConfig.id}:`, error);
      results.push({
        childId: childConfig.id,
        success: false,
        error: error.message
      });
    }
  }
  
  // Complete with results
  this.completeWithArtifacts({
    'execution-results': {
      value: JSON.stringify(results, null, 2),
      description: 'Declarative execution results',
      type: 'json'
    }
  }, {
    success: results.every(r => r.success),
    message: `Executed ${results.length} child tasks`,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  });
};

/**
 * Execute a query spec against the context DataSource (contextRM) or Handle
 * NOTE: contextRM is a ContextResourceManager which implements DataSource interface
 */
async function executeQuery(contextRM, contextHandle, querySpec) {
  if (!querySpec) {
    return {}; // No query means no input data
  }
  
  // Support different query spec formats
  if (typeof querySpec === 'string') {
    // Simple path query: "user.profile.settings"
    return contextRM.query({ path: querySpec });
  }
  
  if (typeof querySpec === 'function') {
    // Function query for complex logic
    return querySpec(contextRM, contextHandle);
  }
  
  if (typeof querySpec === 'object') {
    // DSL query object from template literal
    if (querySpec.type === 'query' && querySpec.originalDSL) {
      return contextHandle.query(querySpec);
    }
    
    // Object query spec with find/where clauses
    if (querySpec.find || querySpec.where) {
      return contextRM.query(querySpec);
    }
    
    // Fluent query builder spec
    if (querySpec.builder) {
      return executeFluentQuery(contextRM, contextHandle, querySpec.builder);
    }
    
    // Multiple named queries
    if (querySpec.queries) {
      const results = {};
      for (const [name, query] of Object.entries(querySpec.queries)) {
        results[name] = await executeQuery(contextRM, contextHandle, query);
      }
      return results;
    }
  }
  
  throw new Error(`Unsupported query spec type: ${typeof querySpec}`);
}

/**
 * Execute fluent query builder operations
 */
function executeFluentQuery(contextRM, contextHandle, builderSpec) {
  let handle = contextHandle; // Use the Handle for fluent operations
  
  // Apply each builder operation
  for (const op of builderSpec) {
    const { method, args = [] } = op;
    
    if (typeof handle[method] !== 'function') {
      throw new Error(`Unknown query method: ${method}`);
    }
    
    handle = handle[method](...args);
  }
  
  // Terminal operation to get results
  if (typeof handle.toArray === 'function') {
    return handle.toArray();
  }
  
  if (typeof handle.value === 'function') {
    return handle.value();
  }
  
  return handle;
}

/**
 * Execute a child task with input data
 */
async function executeChild(parentTask, childConfig, inputData) {
  const { id, description, strategy, metadata = {} } = childConfig;
  
  // Merge input data into child metadata
  const childMetadata = {
    ...metadata,
    parentId: parentTask.id,
    inputData,
    declarativeChild: true
  };
  
  // Create child task
  const childTask = parentTask.createSubtask(
    description || `Child task ${id}`,
    strategy,
    childMetadata
  );
  
  // Execute child task
  await childTask.execute();
  
  // Return child results
  return {
    artifacts: childTask.artifacts,
    status: childTask.status,
    result: childTask.result
  };
}

/**
 * Execute an update spec to route data back to parent context
 */
async function executeUpdate(contextRM, contextHandle, contextDataSource, updateSpec, childResult) {
  if (!updateSpec) {
    return; // No update spec means no data routing
  }
  
  // Support different update spec formats
  if (typeof updateSpec === 'string') {
    // Simple path update: "results.childA"
    return contextRM.update({
      path: updateSpec,
      value: childResult
    });
  }
  
  if (typeof updateSpec === 'function') {
    // Function update for complex logic
    return updateSpec(contextRM, contextHandle, childResult);
  }
  
  if (typeof updateSpec === 'object') {
    // DSL update object from template literal
    if (updateSpec.type === 'update' && updateSpec.assignments) {
      // Substitute expressions with child result data
      const processedUpdate = processUpdateExpressions(updateSpec, childResult);
      return contextDataSource.update(processedUpdate);
    }
    
    // Object update spec
    if (updateSpec.set) {
      // Simple set operations
      for (const [path, value] of Object.entries(updateSpec.set)) {
        const actualValue = value === '$result' ? childResult : value;
        contextRM.update({ path, value: actualValue });
      }
      return;
    }
    
    // Transaction-style update
    if (updateSpec.transaction) {
      return contextRM.update({
        transaction: updateSpec.transaction,
        data: childResult
      });
    }
    
    // Multiple named updates
    if (updateSpec.updates) {
      for (const update of updateSpec.updates) {
        await executeUpdate(contextRM, contextHandle, contextDataSource, update, childResult);
      }
      return;
    }
  }
  
  throw new Error(`Unsupported update spec type: ${typeof updateSpec}`);
}

/**
 * Process DSL update expressions with child result data
 */
function processUpdateExpressions(updateSpec, childResult) {
  const processedAssignments = updateSpec.assignments.map(assignment => {
    let value = assignment.value;
    
    // Substitute common placeholders
    if (value === '${childResult}' || value === '$result') {
      value = childResult;
    } else if (typeof value === 'string' && value.includes('${')) {
      // Handle template expressions
      value = value.replace(/\$\{([^}]+)\}/g, (match, expr) => {
        try {
          // Simple expression evaluation (could be enhanced)
          if (expr === 'childResult') return childResult;
          if (expr.startsWith('childResult.')) {
            const path = expr.substring(12);
            return getNestedValue(childResult, path);
          }
          return match; // Return original if can't process
        } catch (error) {
          console.warn(`Failed to process expression ${expr}:`, error);
          return match;
        }
      });
    }
    
    return {
      ...assignment,
      value
    };
  });
  
  return {
    ...updateSpec,
    assignments: processedAssignments
  };
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Create the declarative strategy
 */
export const createDeclarativeStrategy = createTypedStrategy(
  'declarative',
  [],  // No direct tools - uses child tasks
  {
    // Prompts for LLM operations if needed
    planExecution: 'declarative-plan',
    evaluateResult: 'declarative-evaluate'
  },
  {
    // Additional configuration
    enableContextAsResourceManager: true,
    enableDeclarativeDataFlow: true,
    // Attach the implementation function
    doWork: doWork
  }
);

// Export default for backward compatibility
export default createDeclarativeStrategy;