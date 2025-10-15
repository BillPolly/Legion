/**
 * Sample Data Creation
 *
 * Creates sample project structure with Project, Epic, Tasks, Agent, and Artifacts.
 * Based on DESIGN.md Appendix A sample data.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Create complete sample data structure
 * @returns {Promise<void>}
 */
export async function createSampleData() {
  const neo4j = await getNeo4j();

  // Use transaction to ensure atomicity
  await neo4j.transaction(async (tx) => {
    // 1. Create Project
    await tx.run(`
      CREATE (p:Project {
        id: 'working-todo-app',
        name: 'Working Todo App',
        description: 'Production-ready todo application with UAT',
        status: 'active',
        created: datetime(),
        updated: datetime()
      })
    `);

    // 2. Create Epic and link to Project
    await tx.run(`
      MATCH (p:Project {id: 'working-todo-app'})
      CREATE (e:Epic {
        id: 'uat-testing',
        name: 'UAT Testing',
        description: 'User acceptance testing scenarios',
        status: 'in_progress',
        priority: 'high'
      })
      CREATE (p)-[:CONTAINS]->(e)
    `);

    // 3. Create Task 1 (completed) and link to Epic
    await tx.run(`
      MATCH (e:Epic {id: 'uat-testing'})
      CREATE (t1:Task {
        id: 'UAT-001',
        name: 'Test user registration',
        description: 'Verify user can register with valid credentials',
        status: 'completed',
        priority: 'high',
        requiredCapabilities: ['browser-automation'],
        estimatedDuration: '5m',
        actualDuration: '4m 30s',
        created: datetime(),
        started: datetime(),
        completed: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t1)
    `);

    // 4. Create Task 2 (pending) and link to Epic
    await tx.run(`
      MATCH (e:Epic {id: 'uat-testing'})
      CREATE (t2:Task {
        id: 'UAT-002',
        name: 'Test duplicate email handling',
        description: 'Verify system rejects duplicate email addresses',
        status: 'pending',
        priority: 'high',
        requiredCapabilities: ['browser-automation'],
        estimatedDuration: '3m',
        created: datetime(),
        updated: datetime()
      })
      CREATE (e)-[:HAS_TASK]->(t2)
    `);

    // 5. Create dependency: Task 2 depends on Task 1
    await tx.run(`
      MATCH (t1:Task {id: 'UAT-001'})
      MATCH (t2:Task {id: 'UAT-002'})
      CREATE (t2)-[:DEPENDS_ON]->(t1)
    `);

    // 6. Create Agent
    await tx.run(`
      CREATE (a:Agent {
        name: 'integration-tester',
        type: 'integration-tester',
        capabilities: ['browser-automation', 'screenshot-capture', 'test-execution'],
        status: 'idle',
        lastActive: datetime()
      })
    `);

    // 7. Link Agent to completed Task
    await tx.run(`
      MATCH (a:Agent {name: 'integration-tester'})
      MATCH (t:Task {id: 'UAT-001'})
      CREATE (a)-[:COMPLETED]->(t)
    `);

    // 8. Create Artifacts and link to Task
    await tx.run(`
      MATCH (t:Task {id: 'UAT-001'})
      CREATE (art1:Artifact {
        id: randomUUID(),
        path: 'screenshots/scenario-001/',
        type: 'screenshot',
        created: datetime(),
        size: 45678
      })
      CREATE (t)-[:PRODUCES]->(art1)
    `);

    await tx.run(`
      MATCH (t:Task {id: 'UAT-001'})
      CREATE (art2:Artifact {
        id: randomUUID(),
        path: 'reports/UAT-001.md',
        type: 'report',
        created: datetime(),
        size: 12345
      })
      CREATE (t)-[:PRODUCES]->(art2)
    `);
  });
}
