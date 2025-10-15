/**
 * Example: How a Planning Agent Would Create a Plan
 *
 * This demonstrates how a Claude sub-agent (Orchestrator/Planner) would:
 * 1. Create project structure
 * 2. Break down into tasks with dependencies
 * 3. Query and monitor the plan
 */

import { ResourceManager } from '@legion/resource-manager';

/**
 * Simulates a Planning Agent creating a plan for building a todo app
 */
async function createTodoPlan() {
  console.log('🤖 Planning Agent: Creating plan for Todo App...\n');

  const resourceManager = await ResourceManager.getInstance();
  const neo4j = await resourceManager.getNeo4jServer();

  // Clean up any existing test data
  await neo4j.run(`
    MATCH (n)
    WHERE n.id STARTS WITH 'TODO-PROJECT' OR n.id STARTS WITH 'TODO-EPIC' OR n.id STARTS WITH 'TODO-TASK'
    DETACH DELETE n
  `);

  // Step 1: Create Project
  console.log('📋 Step 1: Creating project structure...');
  await neo4j.run(`
    CREATE (p:Project {
      id: 'TODO-PROJECT',
      name: 'Production Todo App',
      description: 'Build a production-ready todo application with backend API and frontend',
      status: 'active',
      created: datetime(),
      updated: datetime()
    })
    RETURN p
  `);

  // Step 2: Create Epics
  console.log('📦 Step 2: Breaking into epics...');
  await neo4j.run(`
    MATCH (p:Project {id: 'TODO-PROJECT'})
    CREATE (e1:Epic {
      id: 'TODO-EPIC-BACKEND',
      name: 'Backend API',
      description: 'REST API with authentication and CRUD operations',
      status: 'pending',
      priority: 'critical'
    })
    CREATE (e2:Epic {
      id: 'TODO-EPIC-FRONTEND',
      name: 'Frontend UI',
      description: 'React-based user interface',
      status: 'pending',
      priority: 'high'
    })
    CREATE (e3:Epic {
      id: 'TODO-EPIC-UAT',
      name: 'UAT Testing',
      description: 'User acceptance testing scenarios',
      status: 'pending',
      priority: 'high'
    })
    CREATE (p)-[:CONTAINS]->(e1)
    CREATE (p)-[:CONTAINS]->(e2)
    CREATE (p)-[:CONTAINS]->(e3)
    RETURN e1, e2, e3
  `);

  // Step 3: Create Backend Tasks with Dependencies
  console.log('🔨 Step 3: Creating backend tasks with dependencies...');

  // Backend Task 1: Database Schema (no dependencies)
  await neo4j.run(`
    MATCH (e:Epic {id: 'TODO-EPIC-BACKEND'})
    CREATE (t:Task {
      id: 'TODO-TASK-001',
      name: 'Design database schema',
      description: 'Design MongoDB schema for users, todos, and sessions',
      status: 'pending',
      priority: 'critical',
      requiredCapabilities: ['architecture', 'database-design'],
      estimatedDuration: '1h',
      created: datetime(),
      updated: datetime()
    })
    CREATE (e)-[:HAS_TASK]->(t)
    RETURN t
  `);

  // Backend Task 2: Implement Models (depends on TASK-001)
  await neo4j.run(`
    MATCH (e:Epic {id: 'TODO-EPIC-BACKEND'})
    MATCH (dep:Task {id: 'TODO-TASK-001'})
    CREATE (t:Task {
      id: 'TODO-TASK-002',
      name: 'Implement data models',
      description: 'Create Mongoose models for User and Todo entities',
      status: 'pending',
      priority: 'critical',
      requiredCapabilities: ['coding', 'nodejs', 'mongodb'],
      estimatedDuration: '2h',
      created: datetime(),
      updated: datetime()
    })
    CREATE (e)-[:HAS_TASK]->(t)
    CREATE (t)-[:DEPENDS_ON]->(dep)
    RETURN t
  `);

  // Backend Task 3: Build API (depends on TASK-002)
  await neo4j.run(`
    MATCH (e:Epic {id: 'TODO-EPIC-BACKEND'})
    MATCH (dep:Task {id: 'TODO-TASK-002'})
    CREATE (t:Task {
      id: 'TODO-TASK-003',
      name: 'Build REST API endpoints',
      description: 'Create Express routes for CRUD operations',
      status: 'pending',
      priority: 'critical',
      requiredCapabilities: ['coding', 'nodejs', 'api-design'],
      estimatedDuration: '3h',
      created: datetime(),
      updated: datetime()
    })
    CREATE (e)-[:HAS_TASK]->(t)
    CREATE (t)-[:DEPENDS_ON]->(dep)
    RETURN t
  `);

  // Backend Task 4: Authentication (depends on TASK-002)
  await neo4j.run(`
    MATCH (e:Epic {id: 'TODO-EPIC-BACKEND'})
    MATCH (dep:Task {id: 'TODO-TASK-002'})
    CREATE (t:Task {
      id: 'TODO-TASK-004',
      name: 'Implement authentication',
      description: 'Add JWT-based authentication with login/register',
      status: 'pending',
      priority: 'critical',
      requiredCapabilities: ['coding', 'nodejs', 'security'],
      estimatedDuration: '2h',
      created: datetime(),
      updated: datetime()
    })
    CREATE (e)-[:HAS_TASK]->(t)
    CREATE (t)-[:DEPENDS_ON]->(dep)
    RETURN t
  `);

  // Step 4: Create Frontend Tasks
  console.log('🎨 Step 4: Creating frontend tasks...');

  // Frontend Task 5: Setup React (depends on backend API)
  await neo4j.run(`
    MATCH (e:Epic {id: 'TODO-EPIC-FRONTEND'})
    MATCH (dep:Task {id: 'TODO-TASK-003'})
    CREATE (t:Task {
      id: 'TODO-TASK-005',
      name: 'Setup React application',
      description: 'Initialize React app with routing and state management',
      status: 'pending',
      priority: 'high',
      requiredCapabilities: ['coding', 'react', 'frontend'],
      estimatedDuration: '2h',
      created: datetime(),
      updated: datetime()
    })
    CREATE (e)-[:HAS_TASK]->(t)
    CREATE (t)-[:DEPENDS_ON]->(dep)
    RETURN t
  `);

  // Frontend Task 6: Build UI Components (depends on TASK-005)
  await neo4j.run(`
    MATCH (e:Epic {id: 'TODO-EPIC-FRONTEND'})
    MATCH (dep:Task {id: 'TODO-TASK-005'})
    CREATE (t:Task {
      id: 'TODO-TASK-006',
      name: 'Build todo UI components',
      description: 'Create TodoList, TodoItem, and TodoForm components',
      status: 'pending',
      priority: 'high',
      requiredCapabilities: ['coding', 'react', 'ui-design'],
      estimatedDuration: '3h',
      created: datetime(),
      updated: datetime()
    })
    CREATE (e)-[:HAS_TASK]->(t)
    CREATE (t)-[:DEPENDS_ON]->(dep)
    RETURN t
  `);

  // Step 5: Create UAT Tasks
  console.log('🧪 Step 5: Creating UAT tasks...');

  // UAT Task 7: Test user flows (depends on frontend)
  await neo4j.run(`
    MATCH (e:Epic {id: 'TODO-EPIC-UAT'})
    MATCH (dep:Task {id: 'TODO-TASK-006'})
    CREATE (t:Task {
      id: 'TODO-TASK-007',
      name: 'Test user registration and login',
      description: 'Verify users can register, login, and access their todos',
      status: 'pending',
      priority: 'high',
      requiredCapabilities: ['testing', 'browser-automation'],
      estimatedDuration: '1h',
      created: datetime(),
      updated: datetime()
    })
    CREATE (e)-[:HAS_TASK]->(t)
    CREATE (t)-[:DEPENDS_ON]->(dep)
    RETURN t
  `);

  // Step 6: Query the complete plan
  console.log('\n📊 Step 6: Querying complete plan...\n');

  const planResult = await neo4j.run(`
    MATCH (p:Project {id: 'TODO-PROJECT'})-[:CONTAINS]->(e:Epic)-[:HAS_TASK]->(t:Task)
    OPTIONAL MATCH (t)-[:DEPENDS_ON]->(dep:Task)
    RETURN
      p.name AS projectName,
      e.name AS epicName,
      t.id AS taskId,
      t.name AS taskName,
      t.priority AS priority,
      t.estimatedDuration AS duration,
      t.requiredCapabilities AS capabilities,
      COLLECT(dep.id) AS dependencies
    ORDER BY e.name, t.id
  `);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    📋 PROJECT PLAN CREATED                     ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let currentEpic = null;
  for (const record of planResult.records) {
    const epicName = record.get('epicName');

    if (epicName !== currentEpic) {
      currentEpic = epicName;
      console.log(`\n📦 Epic: ${epicName}`);
      console.log('─────────────────────────────────────────────────────────────');
    }

    const taskId = record.get('taskId');
    const taskName = record.get('taskName');
    const priority = record.get('priority');
    const duration = record.get('duration');
    const capabilities = record.get('capabilities');
    const dependencies = record.get('dependencies').filter(d => d !== null);

    console.log(`\n  🔹 ${taskId}: ${taskName}`);
    console.log(`     Priority: ${priority} | Duration: ${duration}`);
    console.log(`     Capabilities: ${capabilities.join(', ')}`);
    if (dependencies.length > 0) {
      console.log(`     Dependencies: ${dependencies.join(', ')}`);
    } else {
      console.log(`     Dependencies: None (ready to start)`);
    }
  }

  // Step 7: Show execution order
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('                   🚀 EXECUTION ORDER                           ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('📌 Ready to start immediately (no dependencies):');
  const readyTasks = await neo4j.run(`
    MATCH (t:Task)
    WHERE t.id STARTS WITH 'TODO-TASK'
      AND NOT EXISTS((t)-[:DEPENDS_ON]->(:Task))
    RETURN t.id AS taskId, t.name AS taskName
  `);

  for (const record of readyTasks.records) {
    console.log(`   ✓ ${record.get('taskId')}: ${record.get('taskName')}`);
  }

  console.log('\n📌 Will be unlocked as dependencies complete:');
  const blockedTasks = await neo4j.run(`
    MATCH (t:Task)-[:DEPENDS_ON]->(dep:Task)
    WHERE t.id STARTS WITH 'TODO-TASK'
    WITH t, COLLECT(dep.id) AS deps
    RETURN t.id AS taskId, t.name AS taskName, deps AS dependencies
    ORDER BY SIZE(deps), t.id
  `);

  for (const record of blockedTasks.records) {
    const deps = record.get('dependencies');
    console.log(`   ⏳ ${record.get('taskId')}: ${record.get('taskName')}`);
    console.log(`      Waiting for: ${deps.join(', ')}`);
  }

  // Step 8: Get project statistics
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('                   📊 PROJECT STATISTICS                        ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const stats = await neo4j.run(`
    MATCH (p:Project {id: 'TODO-PROJECT'})-[:CONTAINS]->(e:Epic)
    OPTIONAL MATCH (e)-[:HAS_TASK]->(t:Task)
    RETURN
      COUNT(DISTINCT e) AS epicCount,
      COUNT(DISTINCT t) AS taskCount,
      SUM(CASE WHEN NOT EXISTS((t)-[:DEPENDS_ON]->(:Task)) THEN 1 ELSE 0 END) AS readyTasks,
      SUM(CASE WHEN EXISTS((t)-[:DEPENDS_ON]->(:Task)) THEN 1 ELSE 0 END) AS blockedTasks
  `);

  const statRecord = stats.records[0];
  console.log(`  📦 Epics: ${statRecord.get('epicCount').toNumber()}`);
  console.log(`  🔨 Total Tasks: ${statRecord.get('taskCount').toNumber()}`);
  console.log(`  ✅ Ready to Start: ${statRecord.get('readyTasks').toNumber()}`);
  console.log(`  ⏳ Blocked by Dependencies: ${statRecord.get('blockedTasks').toNumber()}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ Plan created successfully! Ready for agent execution.');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('💡 Next Steps:');
  console.log('   1. Orchestrator calls pm_get_next_task() to get first task');
  console.log('   2. Spawn appropriate agent based on capabilities');
  console.log('   3. Agent executes and calls pm_report_progress()');
  console.log('   4. Dependent tasks automatically unblock');
  console.log('   5. Repeat until all tasks completed\n');
}

// Run the example
createTodoPlan().catch(console.error);
