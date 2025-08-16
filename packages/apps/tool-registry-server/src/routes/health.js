/**
 * Health Routes
 * Health check and monitoring endpoints
 */

import { Router } from 'express';
import toolRegistry from '@legion/tools-registry';

export const healthRoutes = Router();

// Basic health check
healthRoutes.get('/', async (req, res) => {
  res.json({
    status: 'healthy',
    service: 'tool-registry-server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Detailed health check
healthRoutes.get('/detailed', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      service: 'tool-registry-server',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks: {}
    };
    
    // Check registry status
    try {
      health.checks.registry = {
        status: toolRegistry.initialized ? 'healthy' : 'unhealthy',
        initialized: toolRegistry.initialized
      };
    } catch (error) {
      health.checks.registry = {
        status: 'unhealthy',
        error: error.message
      };
    }
    
    // Check database connection
    try {
      const provider = toolRegistry.provider;
      if (provider && provider.db) {
        await provider.db.admin().ping();
        health.checks.database = {
          status: 'healthy',
          connected: true
        };
      } else {
        health.checks.database = {
          status: 'unhealthy',
          error: 'No database connection'
        };
      }
    } catch (error) {
      health.checks.database = {
        status: 'unhealthy',
        error: error.message
      };
    }
    
    // Check loader status
    try {
      const loader = await toolRegistry.getLoader();
      const pipelineState = loader.getPipelineState();
      health.checks.loader = {
        status: 'healthy',
        pipeline: pipelineState
      };
    } catch (error) {
      health.checks.loader = {
        status: 'unhealthy',
        error: error.message
      };
    }
    
    // Determine overall health
    const allHealthy = Object.values(health.checks).every(
      check => check.status === 'healthy'
    );
    
    health.status = allHealthy ? 'healthy' : 'degraded';
    
    res.status(allHealthy ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Readiness check
healthRoutes.get('/ready', async (req, res) => {
  try {
    // Check if all critical services are ready
    const isReady = 
      toolRegistry.initialized &&
      toolRegistry.provider !== null;
    
    if (isReady) {
      res.json({ ready: true });
    } else {
      res.status(503).json({ ready: false });
    }
  } catch (error) {
    res.status(503).json({ 
      ready: false, 
      error: error.message 
    });
  }
});

// Liveness check
healthRoutes.get('/live', (req, res) => {
  res.json({ alive: true });
});