/**
 * DeclarativeStrategy - Declarative parent-child data flow strategy
 * 
 * This strategy treats parent context as a ResourceManager and uses
 * declarative query/update specifications to manage data flow between
 * parent and child tasks.
 * 
 * Each child task configuration includes:
 * - querySpec: What data to pull from parent context when invoking child
 * - updateSpec: How to route child's return values back to parent context
 */

import { createTypedStrategy } from '../utils/StandardTaskStrategy.js';
import { ContextResourceManager } from './ContextResourceManager.js';

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
    enableDeclarativeDataFlow: true
  }
);

// Export default for backward compatibility
export default createDeclarativeStrategy;

/**
 * Core strategy implementation
 */
createDeclarativeStrategy.doWork = async function doWork() {
  console.log(`📋 DeclarativeStrategy processing: ${this.description}`);
  
  // Get declarative task configuration
  const taskConfig = this.metadata?.declarativeConfig || {};
  
  if (!taskConfig.children || taskConfig.children.length === 0) {
    return this.failWithError(
      new Error('No child tasks defined in declarative configuration'),
      'Declarative strategy requires child task definitions'
    );
  }
  
  // Wrap context as ResourceManager
  const contextRM = new ContextResourceManager(this.context);
  
  // Execute child tasks with declarative data flow
  const results = [];
  
  for (const childConfig of taskConfig.children) {
    try {
      // Execute query spec to get input data for child
      const inputData = await executeQuery(contextRM, childConfig.querySpec);
      
      // Create and execute child task with queried data
      const childResult = await executeChild(this, childConfig, inputData);
      
      // Execute update spec to route child results back to parent
      if (childResult && childConfig.updateSpec) {
        await executeUpdate(contextRM, childConfig.updateSpec, childResult);
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
 * Execute a query spec against the context ResourceManager
 */
async function executeQuery(contextRM, querySpec) {
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
    return querySpec(contextRM);
  }
  
  if (typeof querySpec === 'object') {
    // Object query spec with find/where clauses
    if (querySpec.find || querySpec.where) {
      return contextRM.query(querySpec);
    }
    
    // Fluent query builder spec
    if (querySpec.builder) {
      return executeFluentQuery(contextRM, querySpec.builder);
    }
    
    // Multiple named queries
    if (querySpec.queries) {
      const results = {};
      for (const [name, query] of Object.entries(querySpec.queries)) {
        results[name] = await executeQuery(contextRM, query);
      }
      return results;
    }
  }
  
  throw new Error(`Unsupported query spec type: ${typeof querySpec}`);
}

/**
 * Execute fluent query builder operations
 */
function executeFluentQuery(contextRM, builderSpec) {
  let handle = contextRM.getHandle();
  
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
async function executeUpdate(contextRM, updateSpec, childResult) {
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
    return updateSpec(contextRM, childResult);
  }
  
  if (typeof updateSpec === 'object') {
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
        await executeUpdate(contextRM, update, childResult);
      }
      return;
    }
  }
  
  throw new Error(`Unsupported update spec type: ${typeof updateSpec}`);
}