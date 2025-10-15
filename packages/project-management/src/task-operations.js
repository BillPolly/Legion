/**
 * Task Entity Operations
 *
 * CRUD operations for Task entities.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Create a new task
 * @param {Object} params - Task parameters
 * @param {string} params.taskId - Unique task ID
 * @param {string} params.name - Task name
 * @param {string} params.description - Task description
 * @param {string} params.priority - Task priority (low, medium, high, critical)
 * @param {string} params.epicId - Parent epic ID
 * @param {string[]} params.requiredCapabilities - Required capabilities
 * @param {string} params.estimatedDuration - Estimated duration
 * @returns {Promise<Object>} Created task info
 */
export async function createTask(params) {
  const neo4j = await getNeo4j();

  // Use transaction to create task and dependencies
  return await neo4j.transaction(async (tx) => {
    // Create task
    const taskResult = await tx.run(`
      MATCH (e:Epic {id: $epicId})
      CREATE (t:Task {
        id: $taskId,
        name: $name,
        description: $description,
        priority: COALESCE($priority, 'medium'),
        status: 'pending',
        requiredCapabilities: $requiredCapabilities,
        estimatedDuration: $estimatedDuration,
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t)
      RETURN t
    `, {
      taskId: params.taskId,
      name: params.name,
      description: params.description,
      priority: params.priority,
      epicId: params.epicId,
      requiredCapabilities: params.requiredCapabilities || [],
      estimatedDuration: params.estimatedDuration
    });

    const task = taskResult.records[0].get('t').properties;

    // Add dependencies if provided
    const dependencies = params.dependencies || [];
    if (dependencies.length > 0) {
      await tx.run(`
        MATCH (t:Task {id: $taskId})
        UNWIND $dependencies AS depId
        MATCH (dep:Task {id: depId})
        CREATE (t)-[:DEPENDS_ON]->(dep)
      `, {
        taskId: params.taskId,
        dependencies
      });
    }

    return {
      success: true,
      taskId: task.id,
      status: task.status,
      dependenciesMet: dependencies.length === 0
    };
  });
}

/**
 * Find task by ID
 * @param {string} taskId - Task ID
 * @returns {Promise<Object|null>} Task object or null if not found
 */
export async function findTaskById(taskId) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(
    'MATCH (t:Task {id: $taskId}) RETURN t',
    { taskId }
  );

  if (result.records.length === 0) {
    return null;
  }

  const task = result.records[0].get('t').properties;

  return {
    id: task.id,
    name: task.name,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignedTo: task.assignedTo || null,
    estimatedDuration: task.estimatedDuration || null,
    actualDuration: task.actualDuration || null,
    requiredCapabilities: task.requiredCapabilities || [],
    created: task.created,
    started: task.started || null,
    completed: task.completed || null,
    updated: task.updated
  };
}

/**
 * Update task status
 * @param {string} taskId - Task ID
 * @param {string} newStatus - New status (pending, in_progress, blocked, completed, failed)
 * @returns {Promise<Object>} Update result
 */
export async function updateTaskStatus(taskId, newStatus) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    MATCH (t:Task {id: $taskId})
    WITH t, t.status AS previousStatus
    SET t.status = $newStatus,
        t.updated = datetime(),
        t.started = CASE
          WHEN $newStatus = 'in_progress' AND t.started IS NULL
          THEN datetime()
          ELSE t.started
        END,
        t.completed = CASE
          WHEN $newStatus = 'completed'
          THEN datetime()
          ELSE t.completed
        END
    RETURN previousStatus, t.status AS newStatus
  `, { taskId, newStatus });

  const record = result.records[0];

  return {
    previousStatus: record.get('previousStatus'),
    newStatus: record.get('newStatus')
  };
}

/**
 * Delete task
 * @param {string} taskId - Task ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteTask(taskId) {
  const neo4j = await getNeo4j();

  await neo4j.run(
    'MATCH (t:Task {id: $taskId}) DETACH DELETE t',
    { taskId }
  );

  return {
    success: true,
    taskId
  };
}

/**
 * Find tasks by status
 * @param {string} status - Task status
 * @returns {Promise<Object[]>} Array of tasks
 */
export async function findTasksByStatus(status) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(
    'MATCH (t:Task {status: $status}) RETURN t ORDER BY t.priority DESC, t.created',
    { status }
  );

  return result.records.map(record => {
    const task = record.get('t').properties;
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignedTo: task.assignedTo || null,
      estimatedDuration: task.estimatedDuration || null,
      actualDuration: task.actualDuration || null,
      requiredCapabilities: task.requiredCapabilities || [],
      created: task.created,
      started: task.started || null,
      completed: task.completed || null,
      updated: task.updated
    };
  });
}
