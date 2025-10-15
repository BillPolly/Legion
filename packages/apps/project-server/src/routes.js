/**
 * Project Server REST API Routes
 *
 * Exposes all project management operations as HTTP endpoints.
 * Imports business logic from @legion/project-management package.
 */

import express from 'express';
import {
  getNextTask,
  reportProgress,
  createTask,
  reportBug,
  queryGraph,
  getProjectStatus,
  createPlan,
  updatePlan,
  getPlan,
  listPlans
} from '@legion/project-management';

const router = express.Router();

/**
 * POST /api/tasks/next
 * Get next available task for an agent
 *
 * Body: { agentName: string, capabilities?: string[], priority?: string }
 * Returns: Task object or null
 */
router.post('/tasks/next', async (req, res, next) => {
  try {
    const { agentName, capabilities, priority } = req.body;

    if (!agentName) {
      return res.status(400).json({ error: 'agentName is required' });
    }

    const task = await getNextTask(agentName, capabilities, priority);

    if (!task) {
      return res.json({ message: 'No tasks available' });
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks/progress
 * Report task progress or completion
 *
 * Body: { agentName: string, taskId: string, status: string, artifacts?: array }
 * Returns: Progress report with unblocked tasks
 */
router.post('/tasks/progress', async (req, res, next) => {
  try {
    const { agentName, taskId, status, artifacts } = req.body;

    if (!agentName || !taskId || !status) {
      return res.status(400).json({
        error: 'agentName, taskId, and status are required'
      });
    }

    const result = await reportProgress({ agentName, taskId, status, artifacts });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks
 * Create a new task
 *
 * Body: { taskId, name, epicId, priority?, dependencies?, requiredCapabilities?, estimatedDuration? }
 * Returns: Created task summary
 */
router.post('/tasks', async (req, res, next) => {
  try {
    const { taskId, name, epicId } = req.body;

    if (!taskId || !name || !epicId) {
      return res.status(400).json({
        error: 'taskId, name, and epicId are required'
      });
    }

    const result = await createTask(req.body);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bugs
 * Report a bug
 *
 * Body: { title, description, severity, foundBy, foundInTask?, blockedTasks? }
 * Returns: Bug report with blocked task count
 */
router.post('/bugs', async (req, res, next) => {
  try {
    const { title, description, severity, foundBy } = req.body;

    if (!title || !description || !severity || !foundBy) {
      return res.status(400).json({
        error: 'title, description, severity, and foundBy are required'
      });
    }

    const result = await reportBug(req.body);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/query
 * Execute custom Cypher query (read-only)
 *
 * Body: { query: string, parameters?: object }
 * Returns: Query results
 */
router.post('/query', async (req, res, next) => {
  try {
    const { query, parameters } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const result = await queryGraph({ query, parameters });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:projectId/status
 * Get project status and metrics
 *
 * Returns: Project status with task counts, bugs, and progress percentage
 */
router.get('/projects/:projectId/status', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const status = await getProjectStatus(projectId);

    res.json(status);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/plans
 * Create or update a plan
 *
 * Body: { projectId, planId?, title, content, updateType, section?, agentName }
 * Returns: Plan update result with version info
 */
router.post('/plans', async (req, res, next) => {
  try {
    const { projectId, title, content, updateType, agentName } = req.body;

    if (!projectId || !title || !content || !updateType || !agentName) {
      return res.status(400).json({
        error: 'projectId, title, content, updateType, and agentName are required'
      });
    }

    let result;
    if (updateType === 'create') {
      const planId = req.body.planId || `PLAN-${Date.now()}`;
      result = await createPlan({
        planId,
        projectId,
        title,
        content,
        createdBy: agentName
      });
    } else {
      if (!req.body.planId) {
        return res.status(400).json({
          error: 'planId required for update operations'
        });
      }
      result = await updatePlan({
        planId: req.body.planId,
        content,
        updateType,
        section: req.body.section,
        updatedBy: agentName
      });
    }

    res.status(updateType === 'create' ? 201 : 200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/plans/:planId?version=N
 * OR GET /api/plans?projectId=X
 * Get plan by ID or by project
 *
 * Returns: Plan with content and version history
 */
router.get('/plans/:planId?', async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { projectId, version } = req.query;

    if (!planId && !projectId) {
      return res.status(400).json({
        error: 'Either planId or projectId is required'
      });
    }

    const plan = await getPlan({
      planId,
      projectId,
      version: version ? parseInt(version) : undefined
    });

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    res.json(plan);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:projectId/plans
 * List all plans for a project
 *
 * Returns: Array of plan summaries
 */
router.get('/projects/:projectId/plans', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const plans = await listPlans(projectId);

    res.json({ plans, count: plans.length });
  } catch (error) {
    next(error);
  }
});

export { router };
