/**
 * Bug Entity Operations
 *
 * CRUD operations for Bug entities.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Create a new bug
 * @param {Object} params - Bug parameters
 * @param {string} params.title - Bug title
 * @param {string} params.description - Bug description
 * @param {string} params.severity - Bug severity (low, medium, high, critical)
 * @param {string} params.foundBy - Agent name that found the bug
 * @param {string} params.foundInTask - Task ID where bug was found
 * @returns {Promise<Object>} Created bug info
 */
export async function createBug(params) {
  const neo4j = await getNeo4j();

  const result = await neo4j.transaction(async (tx) => {
    // Create bug with generated ID
    const bugResult = await tx.run(`
      CREATE (b:Bug {
        id: 'BUG-TEST-' + toString(randomUUID()),
        title: $title,
        description: $description,
        severity: $severity,
        status: 'open',
        foundBy: $foundBy,
        created: datetime()
      })
      RETURN b.id AS bugId
    `, {
      title: params.title,
      description: params.description,
      severity: params.severity,
      foundBy: params.foundBy
    });

    const bugId = bugResult.records[0].get('bugId');

    // Link to reporting agent
    await tx.run(`
      MATCH (a:Agent {name: $foundBy})
      MATCH (b:Bug {id: $bugId})
      CREATE (a)-[:REPORTED]->(b)
    `, {
      foundBy: params.foundBy,
      bugId
    });

    // Link to task where found
    if (params.foundInTask) {
      await tx.run(`
        MATCH (t:Task {id: $foundInTask})
        MATCH (b:Bug {id: $bugId})
        CREATE (b)-[:FOUND_IN]->(t)
      `, {
        foundInTask: params.foundInTask,
        bugId
      });
    }

    return { bugId, status: 'open' };
  });

  return result;
}

/**
 * Link bug to tasks it blocks
 * @param {string} bugId - Bug ID
 * @param {string[]} taskIds - Array of task IDs to block
 * @returns {Promise<Object>} Result with blocked tasks
 */
export async function linkBugToTasks(bugId, taskIds) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    MATCH (b:Bug {id: $bugId})
    UNWIND $taskIds AS taskId
    MATCH (t:Task {id: taskId})
    SET t.status = 'blocked'
    CREATE (t)-[:BLOCKED_BY]->(b)
    RETURN COLLECT(t.id) AS blockedTasks
  `, { bugId, taskIds });

  const blockedTasks = result.records[0].get('blockedTasks');

  return {
    bugId,
    blockedTasksCount: blockedTasks.length,
    blockedTasks
  };
}

/**
 * Update bug status
 * @param {string} bugId - Bug ID
 * @param {string} newStatus - New status (open, investigating, fixed, wont_fix)
 * @returns {Promise<Object>} Update result
 */
export async function updateBugStatus(bugId, newStatus) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    MATCH (b:Bug {id: $bugId})
    WITH b, b.status AS previousStatus
    SET b.status = $newStatus,
        b.resolved = CASE
          WHEN $newStatus IN ['fixed', 'wont_fix']
          THEN datetime()
          ELSE b.resolved
        END
    RETURN previousStatus, b.status AS newStatus
  `, { bugId, newStatus });

  const record = result.records[0];

  return {
    previousStatus: record.get('previousStatus'),
    newStatus: record.get('newStatus')
  };
}

/**
 * Find bugs by severity
 * @param {string} severity - Bug severity
 * @returns {Promise<Object[]>} Array of bugs
 */
export async function findBugsBySeverity(severity) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(
    'MATCH (b:Bug {severity: $severity}) RETURN b ORDER BY b.created DESC',
    { severity }
  );

  return result.records.map(record => {
    const bug = record.get('b').properties;
    return {
      id: bug.id,
      title: bug.title,
      description: bug.description,
      severity: bug.severity,
      status: bug.status,
      foundBy: bug.foundBy,
      created: bug.created,
      resolved: bug.resolved || null
    };
  });
}

/**
 * Report a bug and optionally block tasks
 * @param {Object} params - Bug report parameters
 * @param {string} params.title - Bug title
 * @param {string} params.description - Bug description
 * @param {string} params.severity - Bug severity (low, medium, high, critical)
 * @param {string} params.foundBy - Agent that discovered the bug
 * @param {string} params.foundInTask - Task ID where bug was found
 * @param {string[]} params.blockedTasks - Task IDs blocked by this bug
 * @returns {Promise<Object>} Bug report result
 */
export async function reportBug(params) {
  // Create the bug
  const { bugId } = await createBug({
    title: params.title,
    description: params.description,
    severity: params.severity,
    foundBy: params.foundBy,
    foundInTask: params.foundInTask
  });

  // Block tasks if specified
  let blockedTasksCount = 0;
  let tasksMarkedBlocked = [];

  if (params.blockedTasks && params.blockedTasks.length > 0) {
    const blockResult = await linkBugToTasks(bugId, params.blockedTasks);
    blockedTasksCount = blockResult.blockedTasksCount;
    tasksMarkedBlocked = blockResult.blockedTasks;
  }

  return {
    success: true,
    bugId,
    blockedTasksCount,
    tasksMarkedBlocked
  };
}
