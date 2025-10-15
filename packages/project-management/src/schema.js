/**
 * Neo4j Schema Initialization
 *
 * Creates all constraints and indexes for the Project Management knowledge graph.
 * All operations use IF NOT EXISTS to ensure idempotency.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Initialize complete Neo4j schema
 * @returns {Promise<void>}
 */
export async function initializeSchema() {
  const neo4j = await getNeo4j();

  // Create constraints
  await createConstraints(neo4j);

  // Create indexes
  await createIndexes(neo4j);
}

/**
 * Create all unique constraints
 * @param {Object} neo4j - Neo4j handle
 * @returns {Promise<void>}
 */
async function createConstraints(neo4j) {
  const constraints = [
    'CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
    'CREATE CONSTRAINT epic_id IF NOT EXISTS FOR (e:Epic) REQUIRE e.id IS UNIQUE',
    'CREATE CONSTRAINT task_id IF NOT EXISTS FOR (t:Task) REQUIRE t.id IS UNIQUE',
    'CREATE CONSTRAINT agent_name IF NOT EXISTS FOR (a:Agent) REQUIRE a.name IS UNIQUE',
    'CREATE CONSTRAINT artifact_id IF NOT EXISTS FOR (a:Artifact) REQUIRE a.id IS UNIQUE',
    'CREATE CONSTRAINT bug_id IF NOT EXISTS FOR (b:Bug) REQUIRE b.id IS UNIQUE',
    'CREATE CONSTRAINT test_scenario_id IF NOT EXISTS FOR (ts:TestScenario) REQUIRE ts.id IS UNIQUE',
    'CREATE CONSTRAINT plan_id IF NOT EXISTS FOR (pl:Plan) REQUIRE pl.id IS UNIQUE'
  ];

  for (const constraint of constraints) {
    await neo4j.run(constraint);
  }
}

/**
 * Create all indexes
 * @param {Object} neo4j - Neo4j handle
 * @returns {Promise<void>}
 */
async function createIndexes(neo4j) {
  const indexes = [
    // Status indexes for filtering
    'CREATE INDEX task_status IF NOT EXISTS FOR (t:Task) ON (t.status)',
    'CREATE INDEX task_priority IF NOT EXISTS FOR (t:Task) ON (t.priority)',
    'CREATE INDEX task_assignedTo IF NOT EXISTS FOR (t:Task) ON (t.assignedTo)',
    'CREATE INDEX agent_status IF NOT EXISTS FOR (a:Agent) ON (a.status)',
    'CREATE INDEX bug_status IF NOT EXISTS FOR (b:Bug) ON (b.status)',
    'CREATE INDEX bug_severity IF NOT EXISTS FOR (b:Bug) ON (b.severity)',
    'CREATE INDEX plan_status IF NOT EXISTS FOR (pl:Plan) ON (pl.status)',
    'CREATE INDEX plan_projectId IF NOT EXISTS FOR (pl:Plan) ON (pl.projectId)',

    // Timestamp indexes for queries
    'CREATE INDEX task_created IF NOT EXISTS FOR (t:Task) ON (t.created)',
    'CREATE INDEX task_completed IF NOT EXISTS FOR (t:Task) ON (t.completed)',
    'CREATE INDEX plan_created IF NOT EXISTS FOR (pl:Plan) ON (pl.created)',
    'CREATE INDEX plan_updated IF NOT EXISTS FOR (pl:Plan) ON (pl.updated)'
  ];

  for (const index of indexes) {
    await neo4j.run(index);
  }
}
