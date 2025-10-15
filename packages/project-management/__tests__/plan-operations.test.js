/**
 * Tests for Plan Operations
 *
 * Tests CRUD operations for Plan entities with version history.
 * NO MOCKS - uses real Neo4j database.
 */

import { getNeo4j } from '../src/neo4j.js';
import { initializeSchema } from '../src/schema.js';
import {
  createPlan,
  updatePlan,
  getPlan,
  listPlans,
  deletePlan
} from '../src/plan-operations.js';

describe('Plan Operations', () => {
  let neo4j;

  beforeAll(async () => {
    neo4j = await getNeo4j();
    await initializeSchema();
  }, 30000);

  beforeEach(async () => {
    // Clean up test data
    await neo4j.run(`
      MATCH (n)
      WHERE n.id STARTS WITH 'TEST-PLAN' OR n.id STARTS WITH 'TEST-PROJ-PLAN' OR n.name = 'test-planner'
      DETACH DELETE n
    `);

    // Create test project and agent
    await neo4j.run(`
      CREATE (p:Project {
        id: 'TEST-PROJ-PLAN',
        name: 'Test Project',
        description: 'Project for plan tests',
        status: 'active',
        created: datetime(),
        updated: datetime()
      })
      CREATE (a:Agent {
        name: 'test-planner',
        type: 'planner',
        capabilities: ['planning'],
        status: 'idle',
        lastActive: datetime()
      })
    `);
  });

  afterAll(async () => {
    // Clean up test data
    await neo4j.run(`
      MATCH (n)
      WHERE n.id STARTS WITH 'TEST-PLAN' OR n.id STARTS WITH 'TEST-PROJ-PLAN' OR n.name = 'test-planner'
      DETACH DELETE n
    `);
  }, 10000);

  describe('createPlan', () => {
    test('should create plan with all properties', async () => {
      const result = await createPlan({
        planId: 'TEST-PLAN-001',
        projectId: 'TEST-PROJ-PLAN',
        title: 'Implementation Plan',
        content: '# Plan\n\nThis is the plan content.',
        createdBy: 'test-planner'
      });

      expect(result).toEqual({
        planId: 'TEST-PLAN-001',
        version: 1,
        title: 'Implementation Plan',
        status: 'active',
        contentLength: 33
      });

      // Verify in database
      const dbResult = await neo4j.run(`
        MATCH (plan:Plan {id: 'TEST-PLAN-001'})
        RETURN plan
      `);

      const plan = dbResult.records[0].get('plan').properties;
      expect(plan.id).toBe('TEST-PLAN-001');
      expect(plan.projectId).toBe('TEST-PROJ-PLAN');
      expect(plan.title).toBe('Implementation Plan');
      expect(plan.content).toBe('# Plan\n\nThis is the plan content.');
      expect(plan.version.toNumber()).toBe(1);
      expect(plan.status).toBe('active');
      expect(plan.createdBy).toBe('test-planner');
      expect(plan.created).toBeDefined();
      expect(plan.updated).toBeDefined();
    });

    test('should create HAS_PLAN relationship', async () => {
      await createPlan({
        planId: 'TEST-PLAN-002',
        projectId: 'TEST-PROJ-PLAN',
        title: 'Test Plan',
        content: 'Content',
        createdBy: 'test-planner'
      });

      const result = await neo4j.run(`
        MATCH (p:Project {id: 'TEST-PROJ-PLAN'})-[:HAS_PLAN]->(plan:Plan {id: 'TEST-PLAN-002'})
        RETURN COUNT(plan) AS count
      `);

      expect(result.records[0].get('count').toNumber()).toBe(1);
    });

    test('should create CREATED relationship with agent', async () => {
      await createPlan({
        planId: 'TEST-PLAN-003',
        projectId: 'TEST-PROJ-PLAN',
        title: 'Test Plan',
        content: 'Content',
        createdBy: 'test-planner'
      });

      const result = await neo4j.run(`
        MATCH (a:Agent {name: 'test-planner'})-[:CREATED]->(plan:Plan {id: 'TEST-PLAN-003'})
        RETURN COUNT(plan) AS count
      `);

      expect(result.records[0].get('count').toNumber()).toBe(1);
    });

    test('should fail if project does not exist', async () => {
      await expect(createPlan({
        planId: 'TEST-PLAN-FAIL',
        projectId: 'NON-EXISTENT',
        title: 'Test Plan',
        content: 'Content',
        createdBy: 'test-planner'
      })).rejects.toThrow('Project not found: NON-EXISTENT');
    });
  });

  describe('updatePlan - append', () => {
    beforeEach(async () => {
      await createPlan({
        planId: 'TEST-PLAN-UPDATE',
        projectId: 'TEST-PROJ-PLAN',
        title: 'Evolving Plan',
        content: '# Original Plan\n\nOriginal content.',
        createdBy: 'test-planner'
      });
    });

    test('should append content to plan', async () => {
      const result = await updatePlan({
        planId: 'TEST-PLAN-UPDATE',
        content: '## New Section\n\nNew content added.',
        updateType: 'append',
        updatedBy: 'test-planner'
      });

      expect(result.version).toBe(2);
      expect(result.previousVersion).toBe(1);
      expect(result.updateType).toBe('append');

      // Get updated plan
      const plan = await getPlan({ planId: 'TEST-PLAN-UPDATE' });
      expect(plan.version).toBe(2);
      expect(plan.content).toBe(
        '# Original Plan\n\nOriginal content.\n\n## New Section\n\nNew content added.'
      );
    });

    test('should mark previous version as superseded', async () => {
      await updatePlan({
        planId: 'TEST-PLAN-UPDATE',
        content: 'New content',
        updateType: 'append',
        updatedBy: 'test-planner'
      });

      const result = await neo4j.run(`
        MATCH (plan:Plan {id: 'TEST-PLAN-UPDATE'})
        RETURN plan.status AS status
      `);

      expect(result.records[0].get('status')).toBe('superseded');
    });

    test('should create PREVIOUS_VERSION relationship', async () => {
      await updatePlan({
        planId: 'TEST-PLAN-UPDATE',
        content: 'New content',
        updateType: 'append',
        updatedBy: 'test-planner'
      });

      const result = await neo4j.run(`
        MATCH (new:Plan)-[:PREVIOUS_VERSION]->(old:Plan {id: 'TEST-PLAN-UPDATE'})
        RETURN new.version AS newVersion, old.version AS oldVersion
      `);

      const newVersion = result.records[0].get('newVersion');
      const oldVersion = result.records[0].get('oldVersion');
      expect(typeof newVersion === 'number' ? newVersion : newVersion.toNumber()).toBe(2);
      expect(typeof oldVersion === 'number' ? oldVersion : oldVersion.toNumber()).toBe(1);
    });
  });

  describe('updatePlan - replace', () => {
    beforeEach(async () => {
      await createPlan({
        planId: 'TEST-PLAN-REPLACE',
        projectId: 'TEST-PROJ-PLAN',
        title: 'Plan to Replace',
        content: 'Old content',
        createdBy: 'test-planner'
      });
    });

    test('should replace entire content', async () => {
      await updatePlan({
        planId: 'TEST-PLAN-REPLACE',
        content: '# Completely New Plan\n\nAll new content.',
        updateType: 'replace',
        updatedBy: 'test-planner'
      });

      const plan = await getPlan({ planId: 'TEST-PLAN-REPLACE' });
      expect(plan.content).toBe('# Completely New Plan\n\nAll new content.');
      expect(plan.version).toBe(2);
    });
  });

  describe('updatePlan - update_section', () => {
    beforeEach(async () => {
      await createPlan({
        planId: 'TEST-PLAN-SECTION',
        projectId: 'TEST-PROJ-PLAN',
        title: 'Plan with Sections',
        content: `# Main Plan

## Phase 1
Original phase 1 content.

## Phase 2
Original phase 2 content.

## Phase 3
Original phase 3 content.`,
        createdBy: 'test-planner'
      });
    });

    test('should update specific section', async () => {
      await updatePlan({
        planId: 'TEST-PLAN-SECTION',
        content: '## Phase 2\nUpdated phase 2 content with new details.',
        updateType: 'update_section',
        section: 'Phase 2',
        updatedBy: 'test-planner'
      });

      const plan = await getPlan({ planId: 'TEST-PLAN-SECTION' });
      expect(plan.content).toContain('Updated phase 2 content with new details');
      expect(plan.content).toContain('Original phase 1 content');
      expect(plan.content).toContain('Original phase 3 content');
    });

    test('should fail if section parameter missing', async () => {
      await expect(updatePlan({
        planId: 'TEST-PLAN-SECTION',
        content: 'New content',
        updateType: 'update_section',
        updatedBy: 'test-planner'
      })).rejects.toThrow('Section required for update_section type');
    });

    test('should append if section not found', async () => {
      await updatePlan({
        planId: 'TEST-PLAN-SECTION',
        content: '## Phase 4\nNew phase 4 content.',
        updateType: 'update_section',
        section: 'Phase 4',
        updatedBy: 'test-planner'
      });

      const plan = await getPlan({ planId: 'TEST-PLAN-SECTION' });
      expect(plan.content).toContain('## Phase 4');
      expect(plan.content).toContain('New phase 4 content');
    });
  });

  describe('getPlan', () => {
    beforeEach(async () => {
      await createPlan({
        planId: 'TEST-PLAN-GET',
        projectId: 'TEST-PROJ-PLAN',
        title: 'Retrievable Plan',
        content: 'Initial content',
        createdBy: 'test-planner'
      });

      // Create version 2
      await updatePlan({
        planId: 'TEST-PLAN-GET',
        content: 'Updated content',
        updateType: 'append',
        updatedBy: 'test-planner'
      });
    });

    test('should get latest version by planId', async () => {
      const plan = await getPlan({ planId: 'TEST-PLAN-GET' });

      expect(plan.version).toBe(2);
      expect(plan.content).toContain('Updated content');
      expect(plan.previousVersions).toContain(1);
    });

    test('should get specific version', async () => {
      const plan = await getPlan({ planId: 'TEST-PLAN-GET', version: 1 });

      expect(plan.version).toBe(1);
      expect(plan.content).toBe('Initial content');
    });

    test('should get latest plan by projectId', async () => {
      const plan = await getPlan({ projectId: 'TEST-PROJ-PLAN' });

      expect(plan).toBeDefined();
      expect(plan.projectId).toBe('TEST-PROJ-PLAN');
      expect(plan.version).toBe(2);
    });

    test('should return null if plan not found', async () => {
      const plan = await getPlan({ planId: 'NON-EXISTENT' });
      expect(plan).toBeNull();
    });

    test('should fail if neither planId nor projectId provided', async () => {
      await expect(getPlan({})).rejects.toThrow('Either planId or projectId required');
    });

    test('should include all metadata', async () => {
      const plan = await getPlan({ planId: 'TEST-PLAN-GET' });

      expect(plan.planId).toBeDefined();
      expect(plan.projectId).toBe('TEST-PROJ-PLAN');
      expect(plan.title).toBe('Retrievable Plan');
      expect(plan.content).toBeDefined();
      expect(plan.version).toBe(2);
      expect(plan.status).toBe('active');
      expect(plan.createdBy).toBe('test-planner');
      expect(plan.created).toBeDefined();
      expect(plan.updated).toBeDefined();
      expect(Array.isArray(plan.previousVersions)).toBe(true);
    });
  });

  describe('listPlans', () => {
    beforeEach(async () => {
      await createPlan({
        planId: 'TEST-PLAN-LIST-1',
        projectId: 'TEST-PROJ-PLAN',
        title: 'Plan 1',
        content: 'Content 1',
        createdBy: 'test-planner'
      });

      await createPlan({
        planId: 'TEST-PLAN-LIST-2',
        projectId: 'TEST-PROJ-PLAN',
        title: 'Plan 2',
        content: 'Content 2',
        createdBy: 'test-planner'
      });

      // Update plan 1 to create version 2
      await updatePlan({
        planId: 'TEST-PLAN-LIST-1',
        content: 'Updated',
        updateType: 'append',
        updatedBy: 'test-planner'
      });
    });

    test('should list all active plans for project', async () => {
      const plans = await listPlans('TEST-PROJ-PLAN');

      expect(plans.length).toBe(2);
      expect(plans[0].title).toBeDefined();
      expect(plans[0].version).toBeDefined();
      expect(plans[0].contentLength).toBeDefined();
    });

    test('should only list active versions', async () => {
      const plans = await listPlans('TEST-PROJ-PLAN');

      // Should have plan 1 version 2 and plan 2 version 1
      const plan1Versions = plans.filter(p => p.planId.startsWith('TEST-PLAN-LIST-1'));
      const plan2Versions = plans.filter(p => p.planId.startsWith('TEST-PLAN-LIST-2'));

      // Plan 1 should only show version 2 (active)
      expect(plan1Versions.length).toBe(1);
      expect(plan1Versions[0].version).toBe(2);

      // Plan 2 should show version 1 (only version)
      expect(plan2Versions.length).toBe(1);
      expect(plan2Versions[0].version).toBe(1);
    });

    test('should return empty array if no plans', async () => {
      // Create project with no plans
      await neo4j.run(`
        MERGE (p:Project {id: 'TEST-PROJ-EMPTY'})
        ON CREATE SET
          p.name = 'Empty Project',
          p.status = 'active',
          p.created = datetime(),
          p.updated = datetime()
      `);

      const plans = await listPlans('TEST-PROJ-EMPTY');
      expect(plans).toEqual([]);
    });
  });

  describe('deletePlan', () => {
    beforeEach(async () => {
      await createPlan({
        planId: 'TEST-PLAN-DELETE',
        projectId: 'TEST-PROJ-PLAN',
        title: 'Plan to Delete',
        content: 'Content',
        createdBy: 'test-planner'
      });

      await updatePlan({
        planId: 'TEST-PLAN-DELETE',
        content: 'Updated',
        updateType: 'append',
        updatedBy: 'test-planner'
      });
    });

    test('should mark all versions as deleted', async () => {
      const result = await deletePlan('TEST-PLAN-DELETE');

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2); // Both versions

      // Verify deleted status
      const dbResult = await neo4j.run(`
        MATCH (plan:Plan)
        WHERE plan.id STARTS WITH 'TEST-PLAN-DELETE'
        RETURN plan.status AS status
      `);

      dbResult.records.forEach(record => {
        expect(record.get('status')).toBe('deleted');
      });
    });

    test('should not appear in listPlans after deletion', async () => {
      await deletePlan('TEST-PLAN-DELETE');

      const plans = await listPlans('TEST-PROJ-PLAN');
      const deletedPlan = plans.find(p => p.planId.startsWith('TEST-PLAN-DELETE'));

      expect(deletedPlan).toBeUndefined();
    });
  });

  describe('Version history', () => {
    test('should maintain version history through multiple updates', async () => {
      // Create initial version
      await createPlan({
        planId: 'TEST-PLAN-HISTORY',
        projectId: 'TEST-PROJ-PLAN',
        title: 'Plan with History',
        content: 'Version 1',
        createdBy: 'test-planner'
      });

      // Update to version 2
      await updatePlan({
        planId: 'TEST-PLAN-HISTORY',
        content: 'Version 2 update',
        updateType: 'append',
        updatedBy: 'test-planner'
      });

      // Update to version 3
      await updatePlan({
        planId: 'TEST-PLAN-HISTORY',
        content: 'Version 3 update',
        updateType: 'append',
        updatedBy: 'test-planner'
      });

      // Get latest version
      const latestPlan = await getPlan({ planId: 'TEST-PLAN-HISTORY' });
      expect(latestPlan.version).toBe(3);
      expect(latestPlan.previousVersions).toEqual([1, 2]);

      // Get version 2
      const v2Plan = await getPlan({ planId: 'TEST-PLAN-HISTORY', version: 2 });
      expect(v2Plan.version).toBe(2);
      expect(v2Plan.content).toContain('Version 2 update');

      // Get version 1
      const v1Plan = await getPlan({ planId: 'TEST-PLAN-HISTORY', version: 1 });
      expect(v1Plan.version).toBe(1);
      expect(v1Plan.content).toBe('Version 1');
    });
  });
});
