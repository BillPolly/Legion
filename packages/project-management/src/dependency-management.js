/**
 * Dependency Management Operations
 *
 * Operations for managing task dependencies.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Create a task with dependencies
 * @param {Object} params - Task parameters
 * @param {string} params.taskId - Unique task ID
 * @param {string} params.name - Task name
 * @param {string} params.description - Task description
 * @param {string} params.priority - Task priority
 * @param {string} params.epicId - Parent epic ID
 * @param {string[]} params.dependencies - Array of task IDs this task depends on
 * @param {string[]} params.requiredCapabilities - Required capabilities
 * @param {string} params.estimatedDuration - Estimated duration
 * @returns {Promise<Object>} Created task info with dependency count
 */
export async function createTaskWithDependencies(params) {
  const neo4j = await getNeo4j();

  const result = await neo4j.transaction(async (tx) => {
    // Create task - handle optional estimatedDuration
    const query = params.estimatedDuration
      ? `
        MATCH (e:Epic {id: $epicId})
        CREATE (t:Task {
          id: $taskId,
          name: $name,
          description: $description,
          priority: COALESCE($priority, 'medium'),
          status: 'pending',
          requiredCapabilities: COALESCE($requiredCapabilities, []),
          estimatedDuration: $estimatedDuration,
          created: datetime(),
          updated: datetime()
        })
        CREATE (e)-[:HAS_TASK]->(t)
      `
      : `
        MATCH (e:Epic {id: $epicId})
        CREATE (t:Task {
          id: $taskId,
          name: $name,
          description: $description,
          priority: COALESCE($priority, 'medium'),
          status: 'pending',
          requiredCapabilities: COALESCE($requiredCapabilities, []),
          created: datetime(),
          updated: datetime()
        })
        CREATE (e)-[:HAS_TASK]->(t)
      `;

    const queryParams = {
      taskId: params.taskId,
      name: params.name,
      description: params.description,
      priority: params.priority,
      epicId: params.epicId,
      requiredCapabilities: params.requiredCapabilities || []
    };

    if (params.estimatedDuration) {
      queryParams.estimatedDuration = params.estimatedDuration;
    }

    await tx.run(query, queryParams);

    // Create dependencies
    if (params.dependencies && params.dependencies.length > 0) {
      const depResult = await tx.run(`
        MATCH (t:Task {id: $taskId})
        UNWIND $dependencies AS depId
        MATCH (dep:Task {id: depId})
        CREATE (t)-[:DEPENDS_ON]->(dep)
        RETURN count(*) AS dependenciesCreated
      `, {
        taskId: params.taskId,
        dependencies: params.dependencies
      });

      return {
        taskId: params.taskId,
        dependenciesCreated: depResult.records[0].get('dependenciesCreated').low
      };
    }

    return {
      taskId: params.taskId,
      dependenciesCreated: 0
    };
  });

  return result;
}

/**
 * Get dependencies for a task
 * @param {string} taskId - Task ID
 * @returns {Promise<Object[]>} Array of dependency tasks
 */
export async function getDependencies(taskId) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    MATCH (t:Task {id: $taskId})-[:DEPENDS_ON]->(dep:Task)
    RETURN dep
    ORDER BY dep.id
  `, { taskId });

  return result.records.map(record => {
    const dep = record.get('dep').properties;
    return {
      id: dep.id,
      name: dep.name,
      status: dep.status,
      priority: dep.priority
    };
  });
}

/**
 * Get tasks that depend on a given task
 * @param {string} taskId - Task ID
 * @returns {Promise<Object[]>} Array of dependent tasks
 */
export async function getDependentTasks(taskId) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    MATCH (dependent:Task)-[:DEPENDS_ON]->(t:Task {id: $taskId})
    RETURN dependent
    ORDER BY dependent.id
  `, { taskId });

  return result.records.map(record => {
    const dep = record.get('dependent').properties;
    return {
      id: dep.id,
      name: dep.name,
      status: dep.status,
      priority: dep.priority
    };
  });
}

/**
 * Detect if adding dependencies would create a cycle
 * @param {string} taskId - Task ID that would get new dependencies
 * @param {string[]} proposedDependencies - Array of task IDs to check
 * @returns {Promise<Object>} Object with hasCircularDependency and cycle path
 */
export async function detectCircularDependencies(taskId, proposedDependencies) {
  const neo4j = await getNeo4j();

  // For each proposed dependency, check if there's a path from that dependency back to taskId
  // If such a path exists, adding the dependency would create a cycle

  for (const depId of proposedDependencies) {
    const result = await neo4j.run(`
      MATCH path = (start:Task {id: $depId})-[:DEPENDS_ON*]->(end:Task {id: $taskId})
      RETURN [node IN nodes(path) | node.id] AS cyclePath
      LIMIT 1
    `, { taskId, depId });

    if (result.records.length > 0) {
      const cyclePath = result.records[0].get('cyclePath');
      return {
        hasCircularDependency: true,
        cycle: [taskId, ...cyclePath]
      };
    }
  }

  return {
    hasCircularDependency: false,
    cycle: null
  };
}
