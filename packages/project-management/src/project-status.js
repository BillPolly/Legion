/**
 * Project Status Query Logic
 *
 * Provides comprehensive project status with aggregated metrics.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Get project status with all metrics
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Project status object
 */
export async function getProjectStatus(projectId) {
  const neo4j = await getNeo4j();

  // Get project info
  const projectResult = await neo4j.run(`
    MATCH (p:Project {id: $projectId})
    RETURN p.id AS projectId, p.name AS projectName, p.status AS status
  `, { projectId });

  if (projectResult.records.length === 0) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const project = projectResult.records[0];
  const projectName = project.get('projectName');
  const projectStatus = project.get('status');

  // Get epic statistics
  const epicResult = await neo4j.run(`
    MATCH (p:Project {id: $projectId})-[:CONTAINS]->(e:Epic)
    RETURN
      COUNT(e) AS total,
      SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN e.status = 'in_progress' THEN 1 ELSE 0 END) AS inProgress,
      SUM(CASE WHEN e.status = 'pending' THEN 1 ELSE 0 END) AS pending
  `, { projectId });

  const epicStats = epicResult.records.length > 0 ? {
    total: Number(epicResult.records[0].get('total').low || epicResult.records[0].get('total')),
    completed: Number(epicResult.records[0].get('completed').low || epicResult.records[0].get('completed')),
    inProgress: Number(epicResult.records[0].get('inProgress').low || epicResult.records[0].get('inProgress')),
    pending: Number(epicResult.records[0].get('pending').low || epicResult.records[0].get('pending'))
  } : { total: 0, completed: 0, inProgress: 0, pending: 0 };

  // Get task statistics
  const taskResult = await neo4j.run(`
    MATCH (p:Project {id: $projectId})-[:CONTAINS]->(e:Epic)-[:HAS_TASK]->(t:Task)
    RETURN
      COUNT(t) AS total,
      SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS inProgress,
      SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) AS failed
  `, { projectId });

  const taskStats = taskResult.records.length > 0 ? {
    total: Number(taskResult.records[0].get('total').low || taskResult.records[0].get('total')),
    pending: Number(taskResult.records[0].get('pending').low || taskResult.records[0].get('pending')),
    inProgress: Number(taskResult.records[0].get('inProgress').low || taskResult.records[0].get('inProgress')),
    blocked: Number(taskResult.records[0].get('blocked').low || taskResult.records[0].get('blocked')),
    completed: Number(taskResult.records[0].get('completed').low || taskResult.records[0].get('completed')),
    failed: Number(taskResult.records[0].get('failed').low || taskResult.records[0].get('failed'))
  } : { total: 0, pending: 0, inProgress: 0, blocked: 0, completed: 0, failed: 0 };

  // Get bug statistics
  const bugResult = await neo4j.run(`
    MATCH (p:Project {id: $projectId})-[:CONTAINS]->(e:Epic)-[:HAS_TASK]->(t:Task)
    OPTIONAL MATCH (t)-[:BLOCKED_BY]->(b:Bug)
    WITH COLLECT(DISTINCT b) AS bugs
    UNWIND bugs AS bug
    WITH bug WHERE bug IS NOT NULL
    RETURN
      COUNT(bug) AS total,
      SUM(CASE WHEN bug.status = 'open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN bug.severity = 'critical' THEN 1 ELSE 0 END) AS critical
  `, { projectId });

  const bugStats = bugResult.records.length > 0 && bugResult.records[0].get('total') ? {
    total: Number(bugResult.records[0].get('total').low || bugResult.records[0].get('total')),
    open: Number(bugResult.records[0].get('open').low || bugResult.records[0].get('open')),
    critical: Number(bugResult.records[0].get('critical').low || bugResult.records[0].get('critical'))
  } : { total: 0, open: 0, critical: 0 };

  // Calculate progress percentage
  const progress = taskStats.total > 0
    ? (taskStats.completed / taskStats.total) * 100
    : 0;

  return {
    projectId,
    projectName,
    status: projectStatus,
    epics: epicStats,
    tasks: taskStats,
    bugs: bugStats,
    progress: Math.round(progress * 100) / 100 // Round to 2 decimal places
  };
}
