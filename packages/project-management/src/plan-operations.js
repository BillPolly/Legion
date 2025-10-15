/**
 * Plan Operations
 *
 * CRUD operations for Plan entities in the knowledge graph.
 * Plans store high-level thinking, strategy, and implementation plans
 * created by Claude sub-agents. Supports versioning and incremental updates.
 */

import { getNeo4j } from './neo4j.js';

/**
 * Create a new plan
 * @param {Object} params
 * @param {string} params.planId - Unique plan identifier
 * @param {string} params.projectId - Parent project ID
 * @param {string} params.title - Plan title
 * @param {string} params.content - Plan content (markdown)
 * @param {string} params.createdBy - Agent name
 * @returns {Promise<Object>} Created plan details
 */
export async function createPlan(params) {
  const { planId, projectId, title, content, createdBy } = params;

  const neo4j = await getNeo4j();

  return await neo4j.transaction(async (tx) => {
    // Ensure Project exists (auto-create if missing)
    await tx.run(`
      MERGE (p:Project {id: $projectId})
      ON CREATE SET
        p.name = $projectId,
        p.status = 'active',
        p.created = datetime(),
        p.updated = datetime()
    `, { projectId });

    // Ensure Agent exists (auto-create if missing)
    await tx.run(`
      MERGE (a:Agent {name: $createdBy})
      ON CREATE SET
        a.type = 'ai-assistant',
        a.status = 'active',
        a.capabilities = ['planning', 'analysis'],
        a.lastActive = datetime()
    `, { createdBy });

    // Create plan node
    const result = await tx.run(`
      MATCH (p:Project {id: $projectId})
      CREATE (plan:Plan {
        id: $planId,
        projectId: $projectId,
        title: $title,
        content: $content,
        version: 1,
        status: 'active',
        createdBy: $createdBy,
        created: datetime(),
        updated: datetime()
      })
      CREATE (p)-[:HAS_PLAN]->(plan)
      WITH plan
      MATCH (a:Agent {name: $createdBy})
      CREATE (a)-[:CREATED]->(plan)
      RETURN plan
    `, {
      planId,
      projectId,
      title,
      content,
      createdBy
    });

    if (result.records.length === 0) {
      throw new Error(`Failed to create plan`);
    }

    const plan = result.records[0].get('plan').properties;

    return {
      planId: plan.id,
      version: plan.version.toNumber(),
      title: plan.title,
      status: plan.status,
      contentLength: plan.content.length
    };
  });
}

/**
 * Update existing plan with new content
 * @param {Object} params
 * @param {string} params.planId - Plan identifier
 * @param {string} params.content - New content
 * @param {string} params.updateType - 'append', 'replace', or 'update_section'
 * @param {string} [params.section] - Section heading (for update_section type)
 * @param {string} params.updatedBy - Agent making the update
 * @returns {Promise<Object>} Updated plan details
 */
export async function updatePlan(params) {
  const { planId, content, updateType, section, updatedBy } = params;

  const neo4j = await getNeo4j();

  return await neo4j.transaction(async (tx) => {
    // Get current plan - handle both base ID and versioned ID
    const currentResult = await tx.run(`
      MATCH (plan:Plan {status: 'active'})
      WHERE plan.id = $planId OR plan.id STARTS WITH $planId + '-v'
      RETURN plan
      ORDER BY plan.version DESC
      LIMIT 1
    `, { planId });

    if (currentResult.records.length === 0) {
      throw new Error(`Active plan not found: ${planId}`);
    }

    const currentPlan = currentResult.records[0].get('plan').properties;
    let newContent;

    // Determine new content based on update type
    switch (updateType) {
      case 'append':
        newContent = currentPlan.content + '\n\n' + content;
        break;

      case 'replace':
        newContent = content;
        break;

      case 'update_section':
        if (!section) {
          throw new Error('Section required for update_section type');
        }
        newContent = updateSection(currentPlan.content, section, content);
        break;

      default:
        throw new Error(`Invalid update type: ${updateType}`);
    }

    // Mark current plan as superseded
    await tx.run(`
      MATCH (plan:Plan {id: $currentPlanId})
      SET plan.status = 'superseded'
    `, { currentPlanId: currentPlan.id });

    // Create new version - keep same base ID, just update properties
    const currentVersion = typeof currentPlan.version === 'number' ? currentPlan.version : currentPlan.version.toNumber();
    const newVersion = currentVersion + 1;

    // Extract base plan ID (remove version suffix if present)
    const basePlanId = planId.includes('-v') ? planId.split('-v')[0] : planId;
    const newPlanId = `${basePlanId}-v${newVersion}`;

    const newResult = await tx.run(`
      MATCH (p:Project {id: $projectId})
      MATCH (oldPlan:Plan {id: $currentPlanId})
      CREATE (newPlan:Plan {
        id: $newPlanId,
        projectId: $projectId,
        title: $title,
        content: $newContent,
        version: $newVersion,
        status: 'active',
        createdBy: $createdBy,
        created: $created,
        updated: datetime()
      })
      CREATE (p)-[:HAS_PLAN]->(newPlan)
      CREATE (newPlan)-[:PREVIOUS_VERSION]->(oldPlan)
      WITH newPlan
      MATCH (a:Agent {name: $updatedBy})
      MERGE (a)-[:CREATED]->(newPlan)
      RETURN newPlan
    `, {
      currentPlanId: currentPlan.id,
      newPlanId,
      projectId: currentPlan.projectId,
      title: currentPlan.title,
      newContent,
      newVersion,
      createdBy: currentPlan.createdBy,
      created: currentPlan.created,
      updatedBy
    });

    const newPlan = newResult.records[0].get('newPlan').properties;

    return {
      planId: newPlanId,
      version: newVersion, // Already a number
      previousVersion: currentVersion, // Already converted above
      contentLength: newPlan.content.length,
      updateType
    };
  });
}

/**
 * Get plan by ID or get latest plan for project
 * @param {Object} params
 * @param {string} [params.planId] - Specific plan ID (optional)
 * @param {string} [params.projectId] - Project ID to get latest plan (optional)
 * @param {number} [params.version] - Specific version (optional)
 * @returns {Promise<Object|null>} Plan details or null
 */
export async function getPlan(params) {
  const { planId, projectId, version } = params;
  const neo4j = await getNeo4j();

  let query;
  let queryParams;

  if (planId && version) {
    // Get specific version - handle v1 which might not have version suffix
    if (version === 1) {
      query = `
        MATCH (plan:Plan {id: $planId, version: 1})
        OPTIONAL MATCH (plan)-[:PREVIOUS_VERSION*]->(prev:Plan)
        RETURN plan, COLLECT(DISTINCT prev.version) AS previousVersions
      `;
      queryParams = { planId };
    } else {
      const versionedPlanId = `${planId}-v${version}`;
      query = `
        MATCH (plan:Plan {id: $versionedPlanId})
        OPTIONAL MATCH (plan)-[:PREVIOUS_VERSION*]->(prev:Plan)
        RETURN plan, COLLECT(DISTINCT prev.version) AS previousVersions
      `;
      queryParams = { versionedPlanId };
    }
  } else if (planId) {
    // Get latest version of specific plan
    query = `
      MATCH (plan:Plan {status: 'active'})
      WHERE plan.id = $planId OR plan.id STARTS WITH $planId + '-v'
      OPTIONAL MATCH (plan)-[:PREVIOUS_VERSION*]->(prev:Plan)
      RETURN plan, COLLECT(DISTINCT prev.version) AS previousVersions
      ORDER BY plan.version DESC
      LIMIT 1
    `;
    queryParams = { planId };
  } else if (projectId) {
    // Get latest active plan for project
    query = `
      MATCH (p:Project {id: $projectId})-[:HAS_PLAN]->(plan:Plan {status: 'active'})
      OPTIONAL MATCH (plan)-[:PREVIOUS_VERSION*]->(prev:Plan)
      RETURN plan, COLLECT(DISTINCT prev.version) AS previousVersions
      ORDER BY plan.version DESC
      LIMIT 1
    `;
    queryParams = { projectId };
  } else {
    throw new Error('Either planId or projectId required');
  }

  const result = await neo4j.run(query, queryParams);

  if (result.records.length === 0) {
    return null;
  }

  const plan = result.records[0].get('plan').properties;
  const previousVersions = result.records[0].get('previousVersions')
    .filter(v => v !== null)
    .map(v => typeof v === 'number' ? v : v.toNumber());

  return {
    planId: plan.id,
    projectId: plan.projectId,
    title: plan.title,
    content: plan.content,
    version: typeof plan.version === 'number' ? plan.version : plan.version.toNumber(),
    status: plan.status,
    createdBy: plan.createdBy,
    created: plan.created.toString(),
    updated: plan.updated.toString(),
    previousVersions: previousVersions.sort((a, b) => a - b)
  };
}

/**
 * List all plans for a project
 * @param {string} projectId - Project identifier
 * @returns {Promise<Array>} Array of plan summaries
 */
export async function listPlans(projectId) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    MATCH (p:Project {id: $projectId})-[:HAS_PLAN]->(plan:Plan {status: 'active'})
    RETURN
      plan.id AS planId,
      plan.title AS title,
      plan.version AS version,
      plan.createdBy AS createdBy,
      plan.updated AS updated,
      plan.content AS content
    ORDER BY plan.updated DESC
  `, { projectId });

  return result.records.map(record => {
    const version = record.get('version');
    const content = record.get('content');
    return {
      planId: record.get('planId'),
      title: record.get('title'),
      version: typeof version === 'number' ? version : version.toNumber(),
      createdBy: record.get('createdBy'),
      updated: record.get('updated').toString(),
      contentLength: content.length
    };
  });
}

/**
 * Delete a plan (marks as deleted, doesn't actually delete)
 * @param {string} planId - Plan identifier
 * @returns {Promise<Object>} Deletion confirmation
 */
export async function deletePlan(planId) {
  const neo4j = await getNeo4j();

  const result = await neo4j.run(`
    MATCH (plan:Plan)
    WHERE plan.id = $planId OR plan.id STARTS WITH $planId + '-v'
    SET plan.status = 'deleted'
    RETURN COUNT(plan) AS deletedCount
  `, { planId });

  return {
    success: true,
    deletedCount: result.records[0].get('deletedCount').toNumber()
  };
}

/**
 * Helper: Update specific section in markdown content
 * @param {string} content - Current content
 * @param {string} sectionHeading - Section heading to update
 * @param {string} newSectionContent - New content for section
 * @returns {string} Updated content
 */
function updateSection(content, sectionHeading, newSectionContent) {
  // Find the section by heading
  const lines = content.split('\n');
  let sectionStart = -1;
  let sectionEnd = -1;
  let sectionLevel = 0;

  // Find section start
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#')) {
      const match = line.match(/^(#+)\s+(.+)/);
      if (match && match[2].trim() === sectionHeading.trim()) {
        sectionStart = i;
        sectionLevel = match[1].length;
        break;
      }
    }
  }

  if (sectionStart === -1) {
    // Section not found, append to end
    return content + '\n\n' + newSectionContent;
  }

  // Find section end (next heading of same or higher level)
  for (let i = sectionStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#')) {
      const match = line.match(/^(#+)\s+/);
      if (match && match[1].length <= sectionLevel) {
        sectionEnd = i;
        break;
      }
    }
  }

  if (sectionEnd === -1) {
    sectionEnd = lines.length;
  }

  // Replace section content
  const before = lines.slice(0, sectionStart).join('\n');
  const after = lines.slice(sectionEnd).join('\n');

  return before + '\n\n' + newSectionContent + '\n\n' + after;
}
